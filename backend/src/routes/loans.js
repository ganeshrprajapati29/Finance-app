import { Router } from 'express';
import Joi from 'joi';
import Loan from '../models/Loan.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { requireAuth } from '../middlewares/auth.js';
import { uploadToCloudinary } from '../services/cloudinary.js';
import { ok, fail } from '../utils/response.js';
import { notifyUserSmart } from '../services/smartNotifications.js';
import { normalizeAadhaarKycData } from '../utils/aadhaarKyc.js';
import multer from 'multer';

// Memory storage for Cloudinary uploads
const memoryStorage = multer.memoryStorage();
const uploadManyMemory = (field='files', max=10) => multer({ storage: memoryStorage, limits:{ fileSize: 10*1024*1024 } }).array(field, max);

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_PATTERN = /^\d{6,20}$/;
const MOBILE_PATTERN = /^[6-9]\d{9}$/;
const UPI_PATTERN = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

/**
 * Classifies an uploaded document from its filename. The Flutter client names
 * each part deliberately (`aadhaar_front.jpg`, `income_proof.pdf`, ...), so
 * matching on that is reliable; anything unrecognised is ignored rather than
 * being written over the Aadhaar front slot.
 * @returns {string|null} the document field, or null when unrecognised
 */
function documentFieldFor(originalName = '') {
  const name = String(originalName).toLowerCase();
  if (name.includes('aadhaar') && name.includes('back')) return 'aadhaarBackUrl';
  if (name.includes('aadhaar')) return 'aadhaarFrontUrl';
  if (name.includes('pan')) return 'panUrl';
  if (name.includes('selfie') || name.includes('photo')) return 'selfieUrl';
  if (name.includes('income') || name.includes('salary') || name.includes('statement')) {
    return 'incomeProofUrl';
  }
  return null;
}

const router = Router();

const nonClosedLoanStatuses = ['PENDING', 'APPROVED', 'DISBURSED'];

function loanOutstanding(loan) {
  const schedule = Array.isArray(loan.schedule) ? loan.schedule : [];
  if (!schedule.length) return loan.status === 'DISBURSED' ? 1 : 0;
  return schedule.reduce((sum, item) => sum + (item.paid ? 0 : Number(item.total || 0)), 0);
}

async function closeIfFullyPaid(loan) {
  if (loan.status !== 'DISBURSED') return loan;
  const schedule = Array.isArray(loan.schedule) ? loan.schedule : [];
  if (schedule.length && schedule.every((item) => item.paid)) {
    loan.status = 'CLOSED';
    await loan.save();
  }
  return loan;
}

async function getLoanEligibility(userId) {
  // Users may apply for a new loan even while an existing one is under
  // review, approved, or still being repaid - re-application is always
  // allowed. The existing loan's status/outstanding amount is still
  // returned as context, it just no longer blocks anything.
  const latestActiveLoan = await Loan.findOne({
    userId,
    status: { $in: nonClosedLoanStatuses }
  }).sort({ createdAt: -1 });

  if (!latestActiveLoan) {
    return { eligible: true, message: 'You can apply for a new loan.' };
  }

  const loan = await closeIfFullyPaid(latestActiveLoan);
  if (loan.status === 'CLOSED') {
    return { eligible: true, message: 'Previous loan is closed. You can apply for a new loan.' };
  }

  const outstandingAmount = loanOutstanding(loan);
  const messages = {
    PENDING: 'You already have a loan application under review, and you can still apply for another loan.',
    APPROVED: 'You have an approved loan awaiting disbursement, and you can still apply for another loan.',
    DISBURSED: 'You have an active loan with an outstanding balance, and you can still apply for another loan.'
  };

  return {
    eligible: true,
    message: messages[loan.status] || 'You can apply for a new loan.',
    loan: {
      _id: loan._id,
      loanAccountNumber: loan.loanAccountNumber,
      status: loan.status,
      outstandingAmount
    }
  };
}

// Create loan application (wizard or simple)
router.post('/', requireAuth, uploadManyMemory('files', 10), async (req, res, next) => {
  try {
    const eligibility = await getLoanEligibility(req.user.uid);
    if (!eligibility.eligible) {
      return fail(
        res,
        eligibility.code || 'NOT_ELIGIBLE',
        eligibility.message,
        409,
        { loan: eligibility.loan || null }
      );
    }

    const schema = Joi.object({
      // wizard payload
      personal: Joi.object({
        name: Joi.string().required(),
        email: Joi.string().email().allow('').default(''),
        mobile: Joi.string().required(),
        address: Joi.string().allow('').default(''),
        fatherName: Joi.string().allow(''),
        motherName: Joi.string().allow(''),
      }).optional(),
      qualification: Joi.object({
        highestEducation: Joi.string().allow(''),
        stream: Joi.string().allow(''),
        institution: Joi.string().allow(''),
      }).optional(),
      employment: Joi.object({
        employmentType: Joi.string().allow(''),
        monthlyIncome: Joi.number().default(0),
        employerOrBusiness: Joi.string().allow(''),
        experienceYears: Joi.number().default(0),
      }).optional(),
      documents: Joi.object({
        aadhaarFrontUrl: Joi.string().allow(null,''),
        aadhaarBackUrl: Joi.string().allow(null,''),
        panUrl: Joi.string().allow(null,''),
        selfieUrl: Joi.string().allow(null,''),
        incomeProofUrl: Joi.string().allow(null,''),
        incomeProofType: Joi.string().valid('SALARY_SLIP', 'BANK_STATEMENT', 'OTHER').allow(null,''),
        aadhaarEkyc: Joi.object().unknown(true).optional(),
        panVerification: Joi.object().unknown(true).optional(),
      }).optional(),
      references: Joi.array().items(Joi.object({
        name: Joi.string().allow(''),
        relation: Joi.string().allow(''),
        mobile: Joi.string().allow('')
      })).default([]),
      bankDetails: Joi.object({
        bankName: Joi.string().allow('').default(''),
        accountNumber: Joi.string().pattern(ACCOUNT_PATTERN).required().messages({
          'string.pattern.base': 'Enter a valid bank account number (6-20 digits).',
          'any.required': 'Bank account number is required.',
        }),
        ifscCode: Joi.string().uppercase().pattern(IFSC_PATTERN).required().messages({
          'string.pattern.base': 'Enter a valid 11-character IFSC code.',
          'any.required': 'IFSC code is required.',
        }),
        accountHolderName: Joi.string().min(2).required().messages({
          'any.required': 'Account holder name is required.',
        }),
        upiId: Joi.string().pattern(UPI_PATTERN).allow('').default('').messages({
          'string.pattern.base': 'Enter a valid UPI ID, for example name@bank.',
        }),
        upiAccountName: Joi.string().allow('').default(''),
        bankValidation: Joi.object().unknown(true).optional(),
        upiValidation: Joi.object().unknown(true).optional(),
      }).required(),
      amountRequested: Joi.number().min(1000).max(500000).required().messages({
        'number.min': 'Minimum loan amount is Rs. 1,000.',
        'number.max': 'Maximum loan amount is Rs. 5,00,000.',
        'any.required': 'Loan amount is required.',
      }),
      tenureMonths: Joi.number().integer().min(3).max(60).required().messages({
        'number.min': 'Minimum tenure is 3 months.',
        'number.max': 'Maximum tenure is 60 months.',
        'any.required': 'Loan tenure is required.',
      }),
      purpose: Joi.string().allow('').default('Personal'),
      // simple mode
      docs: Joi.array().items(Joi.string()).optional(),
    });

    // Wizard submissions arrive as multipart: a `payload` JSON field plus the
    // document files. Simple submissions post plain JSON.
    let requestBody = req.body;
    if (req.body?.payload) {
      try {
        requestBody = JSON.parse(req.body.payload);
      } catch {
        return fail(
          res,
          'INVALID_PAYLOAD',
          'Your application data could not be read. Please try submitting again.',
          400
        );
      }
    }

    // abortEarly:false so the client can surface everything wrong at once
    // instead of one field per round trip.
    const payload = await schema.validateAsync(requestBody, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (!payload.personal?.mobile || !MOBILE_PATTERN.test(String(payload.personal.mobile).trim())) {
      return fail(
        res,
        'INVALID_MOBILE',
        'Enter a valid 10-digit mobile number.',
        400
      );
    }

    const monthlyIncome = Number(payload.employment?.monthlyIncome || 0);
    if (!(monthlyIncome > 0)) {
      return fail(
        res,
        'INCOME_REQUIRED',
        'Please enter your monthly income so we can assess this application.',
        400
      );
    }
    const user = await User.findById(req.user.uid).select('kyc');
    const aadhaarVerified = user?.kyc?.aadhaarVerified === true;
    if (!aadhaarVerified) {
      return fail(
        res,
        'AADHAAR_EKYC_REQUIRED',
        'Please complete Aadhaar Offline eKYC OTP verification before submitting the loan application.',
        400
      );
    }
    const panVerified = user?.kyc?.panVerified === true;
    if (!panVerified) {
      return fail(
        res,
        'PAN_VERIFICATION_REQUIRED',
        'Please verify PAN details before submitting the loan application.',
        400
      );
    }

    // Handle document uploads to Cloudinary if files are provided
    let documents = payload.documents || {};
    const aadhaarData = normalizeAadhaarKycData(
      user.kyc?.aadhaarVerification?.response || user.kyc?.aadhaarData?.raw || user.kyc?.aadhaarData,
      user.kyc?.aadhaarData
    );
    documents.aadhaarEkyc = {
      verified: true,
      aadhaarNumber: user.kyc?.aadhaarNumber,
      aadhaarMobile: user.kyc?.aadhaarMobile,
      verifiedAt: user.kyc?.aadhaarVerification?.verifiedAt,
      orderId: user.kyc?.aadhaarVerification?.orderId,
      aadhaarData
    };
    documents.panVerification = {
      verified: true,
      panNumber: user.kyc?.panNumber,
      panName: user.kyc?.panName,
      verifiedAt: user.kyc?.panVerification?.verifiedAt,
      orderId: user.kyc?.panVerification?.orderId,
      panData: user.kyc?.panData,
      response: user.kyc?.panVerification?.response
    };
    if (req.files && req.files.length > 0) {
      let results;
      try {
        results = await Promise.all(
          req.files.map((file) => uploadToCloudinary(file.buffer, 'loan-documents'))
        );
      } catch (uploadError) {
        console.error('Loan document upload failed', uploadError);
        return fail(
          res,
          'DOCUMENT_UPLOAD_FAILED',
          'Your documents could not be uploaded. Please check your connection and try again.',
          502
        );
      }

      results.forEach((result, index) => {
        const field = documentFieldFor(req.files[index]?.originalname);
        // Unrecognised filenames are skipped rather than defaulting into the
        // Aadhaar-front slot, which previously let an unnamed upload silently
        // replace a real Aadhaar scan.
        if (field && result?.secure_url) documents[field] = result.secure_url;
      });
    }

    // Selfie and income proof can arrive either as a fresh upload above or as
    // a URL the client already had; require at least one source for each.
    if (!documents.selfieUrl) {
      return fail(
        res,
        'SELFIE_REQUIRED',
        'Please capture your live photo before submitting the application.',
        400
      );
    }

    if (!documents.incomeProofUrl) {
      return fail(
        res,
        'INCOME_PROOF_REQUIRED',
        'Please upload your income proof (salary slip or bank statement).',
        400
      );
    }

    documents.incomeProofType = payload.documents?.incomeProofType || 'OTHER';

    const references = Array.isArray(payload.references)
      ? payload.references.filter((ref) => ref?.name || ref?.relation || ref?.mobile)
      : [];

    // Generate 8-digit loan account number
    const generateLoanAccountNumber = () => {
      const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
      const random = Math.floor(Math.random() * 100); // 2-digit random number
      return (timestamp + random.toString().padStart(2, '0')).slice(-8); // Ensure exactly 8 digits
    };

    const loanAccountNumber = generateLoanAccountNumber();

    const loan = await Loan.create({
      userId: req.user.uid,
      loanAccountNumber: loanAccountNumber,
      application: {
        amountRequested: payload.amountRequested,
        tenureMonths: payload.tenureMonths,
        purpose: payload.purpose,
        personal: payload.personal,
        qualification: payload.qualification,
        employment: payload.employment,
        documents: documents,
        references,
        bankDetails: payload.bankDetails,
      },
      status: 'PENDING'
    });

    // Notifications are best-effort. The loan is already persisted at this
    // point, so a push/notification outage must not turn a successful
    // application into an error the user is asked to retry - which would
    // create a duplicate loan.
    try {
      await Notification.create({
        userId: req.user.uid,
        title: 'New Loan Application Submitted',
        message: `${payload.personal?.name || 'A user'} has submitted a loan application for Rs. ${payload.amountRequested} for ${payload.tenureMonths} months`,
        type: 'loan',
        priority: 'HIGH',
        data: {
          loanId: loan._id,
          loanAccountNumber,
          amountRequested: payload.amountRequested,
          tenureMonths: payload.tenureMonths,
          userName: payload.personal?.name,
          userEmail: payload.personal?.email
        }
      });

      await notifyUserSmart(req.user.uid, 'loan_application_submitted', {
        persist: false,
        loanId: loan._id,
        amount: payload.amountRequested,
        data: {
          loanId: String(loan._id),
          loanAccountNumber,
          amountRequested: payload.amountRequested,
          tenureMonths: payload.tenureMonths,
        },
      });
    } catch (notifyError) {
      console.error('Loan application notification failed', notifyError);
    }

    ok(
      res,
      {
        loanId: loan._id,
        loanAccountNumber,
        status: loan.status,
        amountRequested: payload.amountRequested,
        tenureMonths: payload.tenureMonths,
      },
      'Loan application submitted. Our team will review it shortly.',
      { code: 'LOAN_APPLICATION_SUBMITTED', status: 201 }
    );
  } catch (e) { next(e); }
});

router.get('/eligibility/status', requireAuth, async (req, res, next) => {
  try {
    const eligibility = await getLoanEligibility(req.user.uid);
    ok(res, eligibility);
  } catch (e) { next(e); }
});

// list my loans
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await Loan.find({ userId: req.user.uid }).sort({ createdAt: -1 });
    ok(res, rows);
  } catch (e) { next(e); }
});

// get one
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);
    ok(res, loan);
  } catch (e) { next(e); }
});

export default router;
