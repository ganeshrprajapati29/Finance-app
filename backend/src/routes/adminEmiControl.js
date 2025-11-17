import { Router } from 'express';
import Loan from '../models/Loan.js';
import Payment from '../models/Payment.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

// Get EMI schedule for a loan
router.get('/schedule/:loanId', requireAdmin, async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.loanId)
      .populate('userId', 'name email phone')
      .populate('application');

    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);

    // Calculate EMI status and statistics
    const schedule = loan.schedule || [];
    const totalEmis = schedule.length;
    const paidEmis = schedule.filter(inst => inst.paid).length;
    const pendingEmis = totalEmis - paidEmis;
    const overdueEmis = schedule.filter(inst => !inst.paid && new Date(inst.dueDate) < new Date()).length;

    // Calculate total amounts
    const totalAmount = schedule.reduce((sum, inst) => sum + (inst.total || 0), 0);
    const paidAmount = schedule.filter(inst => inst.paid).reduce((sum, inst) => sum + (inst.total || 0), 0);
    const pendingAmount = totalAmount - paidAmount;

    ok(res, {
      loanId: loan._id,
      loanAccountNumber: loan.loanAccountNumber,
      user: loan.userId,
      application: loan.application,
      decision: loan.decision,
      schedule: schedule,
      statistics: {
        totalEmis,
        paidEmis,
        pendingEmis,
        overdueEmis,
        totalAmount,
        paidAmount,
        pendingAmount,
        completionPercentage: totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0
      }
    });
  } catch (e) {
    next(e);
  }
});

// Mark EMI as paid
router.post('/mark-paid/:loanId/:installmentNo', requireAdmin, async (req, res, next) => {
  try {
    const { loanId, installmentNo } = req.params;
    const { paymentAmount, paymentDate, reference, notes } = req.body;

    const loan = await Loan.findById(loanId);
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);

    const installment = loan.schedule.find(inst => inst.installmentNo === parseInt(installmentNo));
    if (!installment) return fail(res, 'NOT_FOUND', 'Installment not found', 404);

    if (installment.paid) return fail(res, 'ALREADY_PAID', 'Installment already paid', 400);

    // Create payment record
    const payment = new Payment({
      userId: loan.userId,
      loanId: loan._id,
      type: 'REPAYMENT',
      amount: paymentAmount || installment.total,
      status: 'COMPLETED',
      method: 'MANUAL',
      reference: reference || `MANUAL-${Date.now()}`,
      metadata: {
        installmentNo,
        notes,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date()
      }
    });
    await payment.save();

    // Update installment
    installment.paid = true;
    installment.paidAt = new Date();
    installment.paymentId = payment._id;

    await loan.save();

    ok(res, { installment, payment }, 'EMI marked as paid successfully');
  } catch (e) {
    next(e);
  }
});

// Auto Debit Management
router.get('/auto-debit', requireAdmin, async (req, res, next) => {
  try {
    const loans = await Loan.find({ status: 'DISBURSED' })
      .select('loanAccountNumber application.personal.name decision.amountApproved autoDebit schedule')
      .populate('userId', 'name email');

    // Calculate auto debit statistics
    const totalLoans = loans.length;
    const autoDebitEnabled = loans.filter(loan => loan.autoDebit?.enabled).length;
    const autoDebitDisabled = totalLoans - autoDebitEnabled;

    // Calculate pending EMIs for auto debit
    const loansWithPendingEmis = loans.filter(loan =>
      loan.schedule?.some(inst => !inst.paid)
    ).length;

    ok(res, {
      loans,
      statistics: {
        totalLoans,
        autoDebitEnabled,
        autoDebitDisabled,
        loansWithPendingEmis,
        autoDebitCoverage: totalLoans > 0 ? Math.round((autoDebitEnabled / totalLoans) * 100) : 0
      }
    });
  } catch (e) {
    next(e);
  }
});

router.post('/auto-debit/:loanId/toggle', requireAdmin, async (req, res, next) => {
  try {
    const { enabled } = req.body;
    const loan = await Loan.findById(req.params.loanId);

    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);

    // Add autoDebit field to loan if not exists
    if (typeof loan.autoDebit === 'undefined') {
      loan.autoDebit = {};
    }

    loan.autoDebit.enabled = enabled;
    loan.autoDebit.updatedAt = new Date();
    loan.autoDebit.updatedBy = req.admin.uid;

    await loan.save();

    ok(res, loan.autoDebit, `Auto debit ${enabled ? 'enabled' : 'disabled'} successfully`);
  } catch (e) {
    next(e);
  }
});

// Manual Payment Update
router.post('/manual-payment/:loanId/:installmentNo', requireAdmin, async (req, res, next) => {
  try {
    const { loanId, installmentNo } = req.params;
    const { amount, paymentDate, reference, notes } = req.body;

    const loan = await Loan.findById(loanId);
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);

    const installment = loan.schedule.find(inst => inst.installmentNo === parseInt(installmentNo));
    if (!installment) return fail(res, 'NOT_FOUND', 'Installment not found', 404);

    // Create payment record
    const payment = new Payment({
      userId: loan.userId,
      loanId: loan._id,
      type: 'REPAYMENT',
      amount: parseFloat(amount),
      status: 'COMPLETED',
      method: 'MANUAL',
      reference: reference || `MANUAL-${Date.now()}`,
      metadata: {
        installmentNo: parseInt(installmentNo),
        notes,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date()
      }
    });
    await payment.save();

    // Update installment if full payment
    if (parseFloat(amount) >= installment.total) {
      installment.paid = true;
      installment.paidAt = new Date();
      installment.paymentId = payment._id;
    }

    await loan.save();

    ok(res, { installment, payment }, 'Manual payment recorded successfully');
  } catch (e) {
    next(e);
  }
});

// Part Payment Support
router.post('/part-payment/:loanId/:installmentNo', requireAdmin, async (req, res, next) => {
  try {
    const { loanId, installmentNo } = req.params;
    const { amount, paymentDate, reference, notes } = req.body;

    const loan = await Loan.findById(loanId);
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);

    const installment = loan.schedule.find(inst => inst.installmentNo === parseInt(installmentNo));
    if (!installment) return fail(res, 'NOT_FOUND', 'Installment not found', 404);

    // Create part payment record
    const payment = new Payment({
      userId: loan.userId,
      loanId: loan._id,
      type: 'PART_PAYMENT',
      amount: parseFloat(amount),
      status: 'COMPLETED',
      method: 'MANUAL',
      reference: reference || `PART-${Date.now()}`,
      metadata: {
        installmentNo: parseInt(installmentNo),
        notes,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        isPartPayment: true
      }
    });
    await payment.save();

    // Add to installment part payments
    if (!installment.partPayments) {
      installment.partPayments = [];
    }
    installment.partPayments.push({
      amount: parseFloat(amount),
      paymentId: payment._id,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      reference
    });

    // Check if fully paid
    const totalPartPayments = installment.partPayments.reduce((sum, p) => sum + p.amount, 0);
    if (totalPartPayments >= installment.total) {
      installment.paid = true;
      installment.paidAt = new Date();
    }

    await loan.save();

    ok(res, { installment, payment }, 'Part payment recorded successfully');
  } catch (e) {
    next(e);
  }
});

// Penalty Charges Management
router.get('/penalties', requireAdmin, async (req, res, next) => {
  try {
    const loans = await Loan.find({ 'penalties.0': { $exists: true } })
      .select('loanAccountNumber penalties schedule')
      .populate('userId', 'name email');

    const penalties = [];
    let totalPenaltyAmount = 0;
    let pendingPenalties = 0;
    let paidPenalties = 0;

    loans.forEach(loan => {
      loan.penalties.forEach(penalty => {
        penalties.push({
          _id: penalty._id,
          loanId: loan.loanAccountNumber,
          loanMongoId: loan._id,
          userName: loan.userId?.name || 'N/A',
          userEmail: loan.userId?.email || 'N/A',
          ...penalty.toObject()
        });

        totalPenaltyAmount += penalty.amount || 0;
        if (penalty.status === 'PENDING') pendingPenalties++;
        if (penalty.status === 'PAID') paidPenalties++;
      });
    });

    ok(res, {
      penalties,
      statistics: {
        totalPenalties: penalties.length,
        totalPenaltyAmount,
        pendingPenalties,
        paidPenalties,
        waivedPenalties: penalties.length - pendingPenalties - paidPenalties
      }
    });
  } catch (e) {
    next(e);
  }
});

router.post('/penalty/:loanId/:installmentNo', requireAdmin, async (req, res, next) => {
  try {
    const { loanId, installmentNo } = req.params;
    const { amount, reason, dueDate } = req.body;

    const loan = await Loan.findById(loanId);
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);

    // Add penalty to loan
    if (!loan.penalties) {
      loan.penalties = [];
    }

    const penalty = {
      installmentNo: parseInt(installmentNo),
      amount: parseFloat(amount),
      reason,
      dueDate: dueDate ? new Date(dueDate) : new Date(),
      status: 'PENDING',
      createdAt: new Date(),
      createdBy: req.admin.uid
    };

    loan.penalties.push(penalty);
    await loan.save();

    ok(res, penalty, 'Penalty added successfully');
  } catch (e) {
    next(e);
  }
});

router.put('/penalty/:penaltyId/status', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    const loan = await Loan.findOne({ 'penalties._id': req.params.penaltyId });

    if (!loan) return fail(res, 'NOT_FOUND', 'Penalty not found', 404);

    const penalty = loan.penalties.id(req.params.penaltyId);
    penalty.status = status;
    penalty.updatedAt = new Date();

    await loan.save();

    ok(res, penalty, 'Penalty status updated successfully');
  } catch (e) {
    next(e);
  }
});

// Extend EMI Due Date
router.post('/extend-due-date/:loanId/:installmentNo', requireAdmin, async (req, res, next) => {
  try {
    const { loanId, installmentNo } = req.params;
    const { newDueDate, reason, notes, approvedBy } = req.body;

    const loan = await Loan.findById(loanId);
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);

    const installment = loan.schedule.find(inst => inst.installmentNo === parseInt(installmentNo));
    if (!installment) return fail(res, 'NOT_FOUND', 'Installment not found', 404);

    const originalDueDate = installment.dueDate;

    // Update due date
    installment.dueDate = new Date(newDueDate);
    installment.extensionHistory = installment.extensionHistory || [];
    installment.extensionHistory.push({
      originalDueDate,
      newDueDate: new Date(newDueDate),
      reason,
      notes,
      approvedBy,
      approvedAt: new Date(),
      approvedByAdmin: req.admin.uid
    });

    await loan.save();

    ok(res, installment, 'Due date extended successfully');
  } catch (e) {
    next(e);
  }
});

// Get extension history
router.get('/extensions/:loanId', requireAdmin, async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.loanId);
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);

    const extensions = [];
    loan.schedule.forEach(inst => {
      if (inst.extensionHistory && inst.extensionHistory.length > 0) {
        inst.extensionHistory.forEach(ext => {
          extensions.push({
            loanId: loan._id,
            loanAccountNumber: loan.loanAccountNumber,
            installmentNo: inst.installmentNo,
            ...ext
          });
        });
      }
    });

    ok(res, extensions);
  } catch (e) {
    next(e);
  }
});

// Get all extensions across all loans
router.get('/extensions', requireAdmin, async (req, res, next) => {
  try {
    const loans = await Loan.find({ 'schedule.extensionHistory.0': { $exists: true } })
      .select('loanAccountNumber schedule.extensionHistory')
      .populate('userId', 'name email');

    const extensions = [];
    let totalExtensions = 0;
    let approvedExtensions = 0;
    let pendingExtensions = 0;

    loans.forEach(loan => {
      loan.schedule.forEach(inst => {
        if (inst.extensionHistory && inst.extensionHistory.length > 0) {
          inst.extensionHistory.forEach(ext => {
            extensions.push({
              _id: ext._id,
              loanId: loan.loanAccountNumber,
              loanMongoId: loan._id,
              installmentNo: inst.installmentNo,
              userName: loan.userId?.name || 'N/A',
              userEmail: loan.userId?.email || 'N/A',
              ...ext.toObject()
            });

            totalExtensions++;
            // Note: Extension status might need to be added to the schema
            // For now, we'll assume all extensions are approved
            approvedExtensions++;
          });
        }
      });
    });

    ok(res, {
      extensions,
      statistics: {
        totalExtensions,
        approvedExtensions,
        pendingExtensions,
        extensionRate: totalExtensions > 0 ? Math.round((approvedExtensions / totalExtensions) * 100) : 0
      }
    });
  } catch (e) {
    next(e);
  }
});

export default router;
