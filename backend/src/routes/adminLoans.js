import { Router } from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import Loan from '../models/Loan.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import LoanVerification from '../models/LoanVerification.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';
import { quickSort } from '../utils/dsa.js';
import { notifyUserSmart } from '../services/smartNotifications.js';
import { verificationWithoutWorkbook } from '../utils/signcareCreditReport.js';
import { buildUnderwritingSummary } from '../utils/underwritingRisk.js';
import loanPolicy from '../config/loanPolicy.js';
import { agreementTerms, generateLoanAgreementPdf } from '../services/loanAgreement.js';
import {
  AgreementError, agreementView, hydrateAgreement, prepareApprovedAgreement, syncAgreementSignature,
} from '../services/loanAgreementSigning.js';
import {
  REVIEWABLE_STAGES, approvalBlockingStages, evaluateLoanVerification, loanPolicyInput, stageLabel, describeStages,
} from '../utils/loanVerificationPolicy.js';
import { buildRepaymentSchedule } from '../utils/loanSchedule.js';
import { SignCareError } from '../services/signcare.js';

const router = Router();
const OPEN_STATUSES = ['PENDING', 'UNDER_REVIEW', 'DOCUMENTS_REQUIRED'];
const STAGE_KEYS = ['pan', 'aadhaar', 'liveness', 'faceMatch', 'bank', 'upi', 'bankStatement', 'credit', 'accountAggregator', 'agreement', 'eStamp', 'eSign', 'auditTrail'];
const MAX_PAGE_SIZE = 1000;

// Fields that are large (images, raw provider payloads) and never needed in a list.
const LOAN_LIST_EXCLUDE = [
  '-application.documents.aadhaarEkyc.aadhaarData.photoBase64',
  '-application.documents.aadhaarEkyc.aadhaarData.raw',
  '-application.documents.panVerification.response',
  '-agreement.auditTrail',
].join(' ');
const VERIFICATION_LIST_EXCLUDE = [
  '-aadhaar.data', '-liveness.data', '-faceMatch.data', '-credit.data.excelExperianReport',
  '-credit.data.request', '-bankStatement.data.consolidatedinfo', '-eSign.data', '-auditTrail.data',
].join(' ');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function stageSummary(verification) {
  return Object.fromEntries(STAGE_KEYS.map((key) => {
    const stage = verification?.[key] || {};
    return [key, {
      status: stage.status || 'NOT_STARTED',
      message: stage.message || '',
      updatedAt: stage.updatedAt || null,
      verifiedAt: stage.verifiedAt || null,
      reviewedAt: stage.reviewedAt || null,
      reviewNote: stage.reviewNote || '',
    }];
  }));
}

function policySummary(loan, verification) {
  const input = loanPolicyInput(loan);
  const evaluation = evaluateLoanVerification(verification, input);
  const blocking = approvalBlockingStages(verification, input);
  return {
    ...evaluation,
    approvalBlocking: blocking,
    approvalBlockingLabels: blocking.map(stageLabel),
    approvable: blocking.length === 0,
  };
}

// Portfolio-wide counts for the admin stat cards (the list itself is paginated).
async function loanPortfolioSummary() {
  const now = new Date();
  const [groups, overdue] = await Promise.all([
    Loan.aggregate([{ $group: {
      _id: '$status',
      count: { $sum: 1 },
      requested: { $sum: { $ifNull: ['$application.amountRequested', 0] } },
      approved: { $sum: { $ifNull: ['$decision.amountApproved', 0] } },
    } }]),
    Loan.countDocuments({ status: 'DISBURSED', schedule: { $elemMatch: { paid: false, dueDate: { $lt: now } } } }),
  ]);
  const byStatus = Object.fromEntries(groups.map((row) => [row._id || 'UNKNOWN', row.count]));
  return {
    total: groups.reduce((sum, row) => sum + row.count, 0),
    byStatus,
    totalRequested: groups.reduce((sum, row) => sum + row.requested, 0),
    totalApproved: groups.reduce((sum, row) => sum + row.approved, 0),
    overdue,
  };
}

// 🟢 Loan applications, paginated and filtered on the server.
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const status = String(req.query.status || 'ALL').toUpperCase();
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const sortBy = ['createdAt', 'updatedAt', 'application.amountRequested', 'decision.amountApproved', 'nextDueDate']
      .includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const search = String(req.query.search || '').trim();

    const query = {};
    if (status !== 'ALL') query.status = status;
    const risk = String(req.query.risk || 'ALL').toUpperCase();
    const now = new Date();
    if (risk === 'OVERDUE') {
      query.status = 'DISBURSED';
      query.schedule = { $elemMatch: { paid: false, dueDate: { $lt: now } } };
    } else if (risk === 'DUE_SOON') {
      query.status = 'DISBURSED';
      query.$and = [
        { schedule: { $elemMatch: { paid: false, dueDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 86400000) } } } },
        { schedule: { $not: { $elemMatch: { paid: false, dueDate: { $lt: now } } } } },
      ];
    } else if (risk === 'NO_SCHEDULE') {
      query.status = 'DISBURSED';
      query.schedule = { $size: 0 };
    }
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      const users = await User.find({ $or: [{ name: pattern }, { mobile: pattern }, { email: pattern }] }).select('_id').limit(200).lean();
      query.$or = [
        { loanAccountNumber: pattern },
        { 'application.personal.name': pattern },
        { 'application.personal.mobile': pattern },
        { userId: { $in: users.map((user) => user._id) } },
      ];
    }

    const [loans, total] = await Promise.all([
      Loan.find(query)
        .select(LOAN_LIST_EXCLUDE)
        .populate('userId', 'name email mobile')
        .sort({ [sortBy === 'nextDueDate' ? 'createdAt' : sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Loan.countDocuments(query),
    ]);

    const userIds = loans.map((loan) => loan.userId?._id || loan.userId).filter(Boolean);
    const verificationRows = await LoanVerification.find({ userId: { $in: userIds } }).select(VERIFICATION_LIST_EXCLUDE).lean();
    const verificationByUser = new Map(verificationRows.map((row) => [String(row.userId), row]));

    let items = loans.map((loan) => {
      const verification = verificationByUser.get(String(loan.userId?._id || loan.userId)) || null;
      hydrateAgreement(loan);
      return {
        ...loan,
        signcareVerification: verification ? stageSummary(verification) : null,
        verificationPolicy: policySummary(loan, verification),
        underwriting: loan.verification?.snapshot?.underwriting || buildUnderwritingSummary({ loan, verification: verification || {} }),
      };
    });

    if (sortBy === 'nextDueDate') {
      const dueTime = (loan) => new Date(loan.schedule?.find((row) => !row.paid)?.dueDate || 8.64e15).getTime();
      items = quickSort(items, (a, b) => (sortOrder === -1 ? dueTime(b) - dueTime(a) : dueTime(a) - dueTime(b)));
    }
    const summary = req.query.summary === 'false' ? undefined : await loanPortfolioSummary();
    ok(res, { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), summary });
  } catch (e) {
    next(e);
  }
});

// Full application with its verification evidence, for the admin detail drawer.
router.get('/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 'INVALID_ID', 'Invalid loan id.', 400);
    const loan = await Loan.findById(req.params.id).populate('userId', 'name email mobile').lean();
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);
    const rawVerification = await LoanVerification.findOne({ userId: loan.userId?._id || loan.userId }).lean();
    const verification = verificationWithoutWorkbook(rawVerification);
    hydrateAgreement(loan);
    ok(res, {
      ...loan,
      signcareVerification: verification || null,
      verificationPolicy: policySummary(loan, verification),
      agreementDetails: agreementView(loan),
      underwriting: buildUnderwritingSummary({ loan, verification: verification || {} }),
    });
  } catch (e) { next(e); }
});

const reviewSchema = Joi.object({
  decision: Joi.string().valid('VERIFIED', 'FAILED').required(),
  note: Joi.string().trim().min(3).max(500).required().messages({
    'string.min': 'Write a short review note (at least 3 characters).',
    'any.required': 'A review note is required.',
  }),
});

// Admin clears (or rejects) a stage the providers could not settle automatically.
router.post('/:id/verification/:stage/review', requireAdmin, async (req, res, next) => {
  try {
    const { stage } = req.params;
    if (!REVIEWABLE_STAGES.includes(stage)) return fail(res, 'INVALID_STAGE', 'This verification stage cannot be reviewed manually.', 400);
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 'INVALID_ID', 'Invalid loan id.', 400);
    const payload = await reviewSchema.validateAsync(req.body || {});
    const loan = await Loan.findById(req.params.id).select('userId status application.bankDetails.upiId application.documents.incomeProofType');
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);
    if (!OPEN_STATUSES.includes(loan.status)) {
      return fail(res, 'INVALID_STATE', 'Verification can only be reviewed before the loan is decided.', 409);
    }
    const verification = await LoanVerification.findOne({ userId: loan.userId });
    if (!verification) return fail(res, 'VERIFICATION_NOT_FOUND', 'The borrower verification record is unavailable.', 409);

    const previous = verification[stage]?.toObject?.() || {};
    const verified = payload.decision === 'VERIFIED';
    verification[stage] = {
      ...previous,
      status: payload.decision,
      message: verified
        ? `Verified by Khatu Pay review: ${payload.note}`
        : `Rejected by Khatu Pay review: ${payload.note}`,
      reviewedBy: req.admin.id,
      reviewedAt: new Date(),
      reviewNote: payload.note,
      reviewDecision: payload.decision,
      ...(verified ? { verifiedAt: new Date() } : {}),
      updatedAt: new Date(),
    };
    await verification.save();
    await AuditLog.create({
      actorId: req.admin.id,
      action: 'LOAN_VERIFICATION_REVIEW',
      entityType: 'Loan',
      entityId: String(loan._id),
      meta: { stage, decision: payload.decision, note: payload.note, previousStatus: previous.status || 'NOT_STARTED' },
    }).catch((error) => console.error('Verification review audit log failed', error.message));

    const lean = verification.toObject();
    ok(res, {
      stage,
      stageStatus: stageSummary(lean)[stage],
      verificationPolicy: policySummary(loan, lean),
    }, `${stageLabel(stage)} marked ${verified ? 'verified' : 'failed'}.`);
  } catch (e) { next(e); }
});

const approveSchema = Joi.object({
  decision: Joi.string().valid('APPROVED').required(),
  amountApproved: Joi.number().positive().max(loanPolicy.maxAmount).required().messages({
    'number.base': 'Enter a valid approved amount.',
    'number.positive': 'Approved amount must be more than zero.',
  }),
  rateAPR: Joi.number().min(0).max(loanPolicy.maxAprPercent).required().messages({
    'number.base': 'Enter a valid interest rate.',
    'number.max': `Interest rate cannot exceed ${loanPolicy.maxAprPercent}% per annum.`,
  }),
  tenureMonths: Joi.number().integer().min(loanPolicy.minTenureMonths).max(loanPolicy.maxTenureMonths).required(),
  processingFee: Joi.number().min(0).default(0),
  taxAmount: Joi.number().min(0).default(0),
  lenderName: Joi.string().trim().allow('').max(120).default(''),
  kfsUrl: Joi.string().trim().uri({ scheme: ['https'] }).allow('').default(''),
}).unknown(true);

const rejectSchema = Joi.object({
  decision: Joi.string().valid('REJECTED').required(),
  rejectionReason: Joi.string().trim().min(3).max(500).required().messages({
    'any.required': 'A customer-friendly rejection reason is required.',
    'string.empty': 'A customer-friendly rejection reason is required.',
  }),
}).unknown(true);

async function notifySafely(label, work) {
  try {
    await work();
  } catch (error) {
    console.error(`Loan ${label} notification failed`, error.message);
  }
}

// 🟡 Approve / Reject Loan
router.post('/:id/decision', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 'INVALID_ID', 'Invalid loan id.', 400);
    const decisionType = String(req.body?.decision || '').toUpperCase();
    if (!['APPROVED', 'REJECTED'].includes(decisionType)) return fail(res, 'INVALID', 'Invalid decision');
    const loan = await Loan.findById(req.params.id);
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);
    if (!OPEN_STATUSES.includes(loan.status)) {
      return fail(res, 'INVALID_STATE', 'This application has already been decided.', 409);
    }

    if (decisionType === 'REJECTED') {
      const payload = await rejectSchema.validateAsync({ ...req.body, decision: 'REJECTED' });
      loan.status = 'REJECTED';
      loan.decision = { rejectionReason: payload.rejectionReason, decidedAt: new Date(), decidedBy: req.admin.id };
      loan.statusHistory.push({
        status: 'REJECTED', title: 'Application not approved',
        message: 'The application did not meet the current eligibility criteria.',
        reason: payload.rejectionReason, actorType: 'ADMIN', actorId: req.admin.id,
      });
      await loan.save();
      await notifySafely('rejection', async () => {
        await Notification.create({
          userId: loan.userId, title: 'Loan Application Rejected',
          message: 'We regret to inform you that your loan application has been rejected.',
          type: 'loan', priority: 'MEDIUM', data: { loanId: loan._id },
        });
        await notifyUserSmart(loan.userId, 'loan_rejected', { persist: false, loanId: loan._id, data: { loanId: String(loan._id) } });
      });
      return ok(res, loan, 'Loan rejected successfully');
    }

    const payload = await approveSchema.validateAsync({ ...req.body, decision: 'APPROVED' });
    const requested = Number(loan.application?.amountRequested || 0);
    if (requested > 0 && payload.amountApproved > requested) {
      return fail(res, 'INVALID_OFFER', `Approved amount cannot exceed the requested Rs. ${requested.toLocaleString('en-IN')}.`, 400);
    }
    if (payload.processingFee + payload.taxAmount >= payload.amountApproved) {
      return fail(res, 'INVALID_OFFER', 'Processing fee and taxes must be less than the approved amount.', 400);
    }

    const verification = await LoanVerification.findOne({ userId: loan.userId }).lean();
    const blocking = approvalBlockingStages(verification, loanPolicyInput(loan));
    if (blocking.length) {
      return fail(
        res,
        'VERIFICATION_INCOMPLETE',
        `Complete or review verification before approval: ${describeStages(blocking)}.`,
        409,
        { incompleteStages: blocking.map(stageLabel), stages: blocking },
      );
    }

    loan.decision = {
      amountApproved: payload.amountApproved,
      rateAPR: payload.rateAPR,
      tenureMonths: payload.tenureMonths,
      processingFee: payload.processingFee,
      taxAmount: payload.taxAmount,
      netDisbursalAmount: payload.amountApproved - payload.processingFee - payload.taxAmount,
      lenderName: payload.lenderName || loanPolicy.agreement.lenderName,
      kfsUrl: payload.kfsUrl,
      decidedAt: new Date(),
      decidedBy: req.admin.id,
    };
    const terms = agreementTerms(loan);
    Object.assign(loan.decision, {
      emi: terms.emi,
      totalInterest: terms.totalInterest,
      totalRepaymentAmount: terms.totalRepayment,
      allInclusiveApr: terms.allInclusiveApr,
    });

    const borrower = await User.findById(loan.userId).select('name email mobile').lean();
    try {
      await prepareApprovedAgreement(loan, borrower);
    } catch (error) {
      console.error('Loan agreement generation failed', { loanId: String(loan._id), message: error.message });
      return fail(res, 'AGREEMENT_GENERATION_FAILED', 'The loan agreement could not be generated. Please try again.', 503);
    }

    // Another admin may have decided this loan while the PDF was being built.
    if (!(await Loan.exists({ _id: loan._id, status: { $in: OPEN_STATUSES } }))) {
      return fail(res, 'INVALID_STATE', 'This application has already been decided.', 409);
    }
    loan.status = 'APPROVED';
    loan.verification = {
      provider: loan.verification?.provider || 'SIGNCARE',
      verificationId: loan.verification?.verificationId || verification?._id,
      capturedAt: loan.verification?.capturedAt || new Date(),
      snapshot: {
        ...(loan.verification?.snapshot || {}),
        underwriting: buildUnderwritingSummary({ loan, verification }),
        approvedStages: Object.fromEntries(Object.entries(stageSummary(verification)).map(([key, value]) => [key, value.status])),
      },
    };
    loan.statusHistory.push({
      status: 'APPROVED', title: 'Loan approved',
      message: 'Your loan offer is ready. Review and sign the agreement to receive the funds.',
      actorType: 'ADMIN', actorId: req.admin.id,
    });
    await loan.save();

    await LoanVerification.updateOne({ userId: loan.userId }, { $set: { agreement: {
      status: 'VERIFIED', message: 'Final loan agreement generated and ready for signature.',
      providerReference: String(loan._id), verifiedAt: new Date(), updatedAt: new Date(),
      data: { loanId: String(loan._id), agreementUrl: loan.agreement.agreementUrl },
    } } }).catch((error) => console.warn('Agreement stage update failed', error.message));

    await AuditLog.create({
      actorId: req.admin.id, action: 'LOAN_APPROVED', entityType: 'Loan', entityId: String(loan._id),
      meta: { amountApproved: payload.amountApproved, rateAPR: payload.rateAPR, tenureMonths: payload.tenureMonths },
    }).catch((error) => console.error('Loan approval audit log failed', error.message));

    await notifySafely('approval', async () => {
      await Notification.create({
        userId: loan.userId, title: 'Loan Application Approved',
        message: `Congratulations! Your loan of Rs. ${payload.amountApproved.toLocaleString('en-IN')} is approved. Sign the agreement to receive the funds.`,
        type: 'loan', priority: 'HIGH',
        data: { loanId: loan._id, amountApproved: payload.amountApproved, rateAPR: payload.rateAPR, tenureMonths: payload.tenureMonths },
      });
      await notifyUserSmart(loan.userId, 'loan_approved', {
        persist: false, loanId: loan._id, loanAccountNumber: loan.loanAccountNumber, amount: payload.amountApproved,
        data: { loanId: String(loan._id), amountApproved: payload.amountApproved, rateAPR: payload.rateAPR, tenureMonths: payload.tenureMonths },
      });
    });
    ok(res, loan, 'Loan approved successfully');
  } catch (e) {
    next(e);
  }
});

// Renders the agreement for the offer being typed in the approve modal, without
// saving anything, so the admin sees exactly what the borrower will sign.
router.post('/:id/agreement/preview', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 'INVALID_ID', 'Invalid loan id.', 400);
    const payload = await approveSchema.validateAsync({ ...req.body, decision: 'APPROVED' });
    if (payload.processingFee + payload.taxAmount >= payload.amountApproved) {
      return fail(res, 'INVALID_OFFER', 'Processing fee and taxes must be less than the approved amount.', 400);
    }
    const loan = await Loan.findById(req.params.id).lean();
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);
    const borrower = await User.findById(loan.userId).select('name email mobile').lean();
    const draft = {
      ...loan,
      decision: {
        amountApproved: payload.amountApproved,
        rateAPR: payload.rateAPR,
        tenureMonths: payload.tenureMonths,
        processingFee: payload.processingFee,
        taxAmount: payload.taxAmount,
        netDisbursalAmount: payload.amountApproved - payload.processingFee - payload.taxAmount,
        lenderName: payload.lenderName || loanPolicy.agreement.lenderName,
        decidedAt: new Date(),
      },
    };
    const pdf = await generateLoanAgreementPdf(draft, borrower);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="agreement-preview-${loan.loanAccountNumber || loan._id}.pdf"`,
      'Cache-Control': 'no-store',
    });
    res.send(pdf);
  } catch (e) { next(e); }
});

// Admin "Refresh signature status" - the same sync the webhook and job use.
router.post('/:id/agreement/refresh', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 'INVALID_ID', 'Invalid loan id.', 400);
    const loan = await Loan.findById(req.params.id);
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);
    const agreement = await syncAgreementSignature(loan, { actorType: 'ADMIN', actorId: req.admin.id, awaitAudit: true });
    ok(res, agreement, agreement.status === 'SIGNED' ? 'Agreement is signed.' : 'Signature is still pending.');
  } catch (e) {
    if (e instanceof AgreementError) return fail(res, e.code, e.message, e.status);
    if (e instanceof SignCareError) return fail(res, 'SIGNCARE_REQUEST_FAILED', e.message, e.status >= 500 ? 503 : e.status);
    next(e);
  }
});

const disburseSchema = Joi.object({
  txnId: Joi.string().trim().min(4).max(64).pattern(/^[A-Za-z0-9/_-]+$/).required().messages({
    'any.required': 'Enter the confirmed bank transfer reference before marking this loan disbursed.',
    'string.empty': 'Enter the confirmed bank transfer reference before marking this loan disbursed.',
    'string.pattern.base': 'The UTR/reference may contain only letters, numbers, / _ and -.',
  }),
}).unknown(true);

// 🟣 Mark an approved, signed loan as disbursed after the bank transfer.
router.post('/:id/disburse', requireAdmin, async (req, res, next) => {
  let claimed = false;
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 'INVALID_ID', 'Invalid loan id.', 400);
    const { txnId } = await disburseSchema.validateAsync(req.body || {});
    const existing = await Loan.findById(req.params.id);
    if (!existing || existing.status !== 'APPROVED') {
      return fail(res, 'INVALID_STATE', 'Only approved loans can be disbursed', 409);
    }
    const agreement = hydrateAgreement(existing);
    if (agreement.status !== 'SIGNED' || !agreement.signedAgreementUrl) {
      return fail(res, 'AGREEMENT_NOT_SIGNED', 'The borrower must sign the loan agreement before disbursal.', 409);
    }
    if (await Loan.exists({ _id: { $ne: existing._id }, 'disbursement.reference': txnId })) {
      return fail(res, 'DUPLICATE_REFERENCE', 'This UTR/reference is already used for another loan.', 409);
    }

    // Atomic claim: a double click must not disburse twice.
    const loan = await Loan.findOneAndUpdate(
      { _id: existing._id, status: 'APPROVED' },
      { $set: { status: 'DISBURSEMENT_PROCESSING', 'disbursement.status': 'PROCESSING', 'disbursement.initiatedAt': new Date() } },
      { new: true },
    );
    if (!loan) return fail(res, 'INVALID_STATE', 'This loan is already being disbursed.', 409);
    claimed = true;

    const approved = Number(loan.decision.amountApproved || 0);
    const netAmount = Number(loan.decision.netDisbursalAmount ?? approved);
    const bankDetails = loan.application.bankDetails || {};
    const disbursedAt = new Date();
    const repayment = buildRepaymentSchedule({
      principal: approved,
      annualRatePercent: Number(loan.decision.rateAPR || 0),
      months: Number(loan.decision.tenureMonths || 0),
      startDate: disbursedAt,
    });

    loan.transactions.push({
      type: 'WITHDRAWAL',
      amount: netAmount,
      bankName: bankDetails.bankName,
      accountNumber: bankDetails.accountNumber,
      ifscCode: bankDetails.ifscCode,
      accountHolderName: bankDetails.accountHolderName,
      txnId,
      status: 'COMPLETED',
      timestamp: disbursedAt,
    });
    loan.status = 'DISBURSED';
    loan.disbursementDate = disbursedAt;
    loan.disbursement = {
      status: 'COMPLETED', amount: approved, netAmount,
      reference: txnId, initiatedAt: loan.disbursement?.initiatedAt || disbursedAt, completedAt: disbursedAt,
    };
    loan.decision.emi = repayment.emi;
    loan.decision.totalInterest = repayment.totalInterest;
    loan.decision.totalRepaymentAmount = repayment.totalRepayment;
    loan.schedule = repayment.schedule;
    loan.statusHistory.push({
      status: 'DISBURSED', title: 'Loan disbursed',
      message: 'Funds were transferred to your verified bank account.',
      actorType: 'ADMIN', actorId: req.admin.id,
    });
    await loan.save();
    claimed = false;

    await AuditLog.create({
      actorId: req.admin.id, action: 'LOAN_DISBURSED', entityType: 'Loan', entityId: String(loan._id),
      meta: { txnId, amount: approved, netAmount },
    }).catch((error) => console.error('Loan disbursal audit log failed', error.message));
    await notifySafely('disbursal', () => notifyUserSmart(loan.userId, 'loan_disbursed', {
      loanId: loan._id, loanAccountNumber: loan.loanAccountNumber, amount: netAmount,
      data: { loanId: String(loan._id), txnId },
    }));

    ok(res, loan, 'Loan marked disbursed and the EMI schedule is created.');
  } catch (e) {
    if (claimed) {
      await Loan.updateOne(
        { _id: req.params.id, status: 'DISBURSEMENT_PROCESSING' },
        { $set: { status: 'APPROVED', 'disbursement.status': 'NOT_STARTED' } },
      ).catch(() => {});
    }
    next(e);
  }
});

export default router;
