import { Router } from 'express';
import Payment from '../models/Payment.js';
import Loan from '../models/Loan.js';
import QRCode from '../models/QRCode.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import User from '../models/User.js';
import AdsCampaign from '../models/AdsCampaign.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

// Dashboard overview
router.get('/dashboard', requireAdmin, async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Total earnings
    const totalEarnings = await calculateTotalEarnings();

    // Today's earnings
    const todayEarnings = await calculateEarningsInRange(today, new Date());

    // This month's earnings
    const monthEarnings = await calculateEarningsInRange(monthStart, new Date());

    // Earnings by category
    const categoryEarnings = await calculateCategoryEarnings();

    // Last 30 days trend
    const trendData = await calculateTrendData(thirtyDaysAgo, new Date());

    ok(res, {
      totalEarnings,
      todayEarnings,
      monthEarnings,
      categoryEarnings,
      trendData
    });
  } catch (e) { next(e); }
});

// Bill Payments Earnings
router.get('/bills', requireAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, operator, dateFrom, dateTo, status } = req.query;
    const query = { type: 'BILL' };

    if (operator) query['metadata.operator'] = operator;
    if (status) query.status = status;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const payments = await Payment.find(query)
      .populate('userId', 'name email mobile')
      .populate('billId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Payment.countDocuments(query);

    const earningsData = payments.map(payment => ({
      txnId: payment._id,
      user: payment.userId,
      operator: payment.metadata?.operator || 'Unknown',
      amount: payment.amount,
      convenienceFee: payment.metadata?.convenienceFee || 0,
      netProfit: payment.metadata?.convenienceFee || 0,
      status: payment.status,
      date: payment.createdAt
    }));

    ok(res, { items: earningsData, total });
  } catch (e) { next(e); }
});

// Loan Earnings
router.get('/loans', requireAdmin, async (req, res, next) => {
  try {
    const loans = await Loan.find({ status: { $in: ['DISBURSED', 'CLOSED'] } })
      .populate('userId', 'name email mobile')
      .sort({ createdAt: -1 });

    const earningsData = loans.map(loan => {
      const processingFee = loan.decision?.amountApproved * 0.02 || 0; // Assume 2%
      const totalInterest = loan.schedule?.reduce((sum, s) => sum + (s.interest || 0), 0) || 0;
      const lateFees = loan.penalties?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      return {
        loanId: loan._id,
        user: loan.userId,
        loanAmount: loan.decision?.amountApproved || 0,
        processingFee,
        interest: totalInterest,
        lateFee: lateFees,
        profit: processingFee + totalInterest + lateFees
      };
    });

    const stats = {
      activeLoans: loans.filter(l => l.status === 'DISBURSED').length,
      completedLoans: loans.filter(l => l.status === 'CLOSED').length
    };

    ok(res, { items: earningsData, stats });
  } catch (e) { next(e); }
});

// QR Payments Earnings
router.get('/qr', requireAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, merchant, dateFrom, dateTo } = req.query;
    const query = { type: 'P2C' };

    if (merchant) query['payload.merchantId'] = merchant;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const qrCodes = await QRCode.find(query)
      .populate('userId', 'name email mobile')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await QRCode.countDocuments(query);

    // For each QR, calculate earnings from associated payments
    const earningsData = await Promise.all(qrCodes.map(async (qr) => {
      const payments = await Payment.find({ reference: qr._id, type: 'P2P' });
      const totalVolume = payments.reduce((sum, p) => sum + p.amount, 0);
      const commission = totalVolume * 0.005; // Assume 0.5% commission
      const razorpayFee = totalVolume * 0.002; // Assume 0.2% Razorpay fee
      const subscriptionFee = 100; // Monthly subscription

      return {
        merchantId: qr.payload?.merchantId || qr._id,
        merchantName: qr.userId?.name || 'Unknown',
        totalVolume,
        commissionPercent: 0.5,
        razorpayFee,
        subscriptionFee,
        netProfit: commission - razorpayFee + subscriptionFee
      };
    }));

    ok(res, { items: earningsData, total });
  } catch (e) { next(e); }
});

// Wallet Earnings
router.get('/wallet', requireAdmin, async (req, res, next) => {
  try {
    const withdrawals = await WithdrawalRequest.find({ status: 'APPROVED' })
      .populate('userId', 'name email mobile')
      .sort({ createdAt: -1 });

    const earningsData = withdrawals.map(withdrawal => ({
      userId: withdrawal.userId?._id,
      type: 'Withdraw',
      fees: withdrawal.amount * 0.01, // Assume 1% fee
      netProfit: withdrawal.amount * 0.01,
      status: withdrawal.status
    }));

    // Add load fees from user wallet balance changes (simplified)
    const users = await User.find({ walletBalance: { $gt: 0 } });
    const loadEarnings = users.map(user => ({
      userId: user._id,
      type: 'Top-up',
      fees: user.walletBalance * 0.005, // Assume 0.5% load fee
      netProfit: user.walletBalance * 0.005,
      status: 'Completed'
    }));

    ok(res, { items: [...earningsData, ...loadEarnings] });
  } catch (e) { next(e); }
});

// Ads & Referral Earnings
router.get('/ads', requireAdmin, async (req, res, next) => {
  try {
    const { partner, status, dateFrom, dateTo, search } = req.query;
    const query = {};

    if (partner && partner !== 'ALL') query.partner = partner;
    if (status && status !== 'ALL') query.status = status;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }
    if (search) {
      query.$or = [
        { partner: { $regex: search, $options: 'i' } },
        { campaign: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    const items = await AdsCampaign.find(query).sort({ createdAt: -1 });
    const stats = await calculateAdsStats(query);
    ok(res, { items, stats });
  } catch (e) { next(e); }
});

router.post('/ads', requireAdmin, async (req, res, next) => {
  try {
    const { partner, campaign, leadsClicks = 0, perLeadRate = 0, totalEarned, status = 'active', startDate, endDate, notes } = req.body;
    if (!partner || !campaign) return fail(res, 'VALIDATION_ERROR', 'Partner and campaign are required', 400);

    const row = await AdsCampaign.create({
      partner,
      campaign,
      leadsClicks: Number(leadsClicks) || 0,
      perLeadRate: Number(perLeadRate) || 0,
      totalEarned: totalEarned !== undefined ? Number(totalEarned) : undefined,
      status,
      startDate: startDate || null,
      endDate: endDate || null,
      notes,
      createdBy: req.admin.id
    });

    ok(res.status(201), row, 'Ads campaign created');
  } catch (e) { next(e); }
});

router.put('/ads/:id', requireAdmin, async (req, res, next) => {
  try {
    const allowed = ['partner', 'campaign', 'leadsClicks', 'perLeadRate', 'totalEarned', 'status', 'startDate', 'endDate', 'notes'];
    const update = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    });
    if (update.leadsClicks !== undefined) update.leadsClicks = Number(update.leadsClicks) || 0;
    if (update.perLeadRate !== undefined) update.perLeadRate = Number(update.perLeadRate) || 0;
    if (update.totalEarned !== undefined) update.totalEarned = Number(update.totalEarned) || 0;
    if (update.totalEarned === undefined && (update.leadsClicks !== undefined || update.perLeadRate !== undefined)) {
      const existing = await AdsCampaign.findById(req.params.id);
      if (!existing) return fail(res, 'NOT_FOUND', 'Ads campaign not found', 404);
      const leads = update.leadsClicks !== undefined ? update.leadsClicks : existing.leadsClicks;
      const rate = update.perLeadRate !== undefined ? update.perLeadRate : existing.perLeadRate;
      update.totalEarned = leads * rate;
    }
    update.updatedBy = req.admin.id;

    const row = await AdsCampaign.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!row) return fail(res, 'NOT_FOUND', 'Ads campaign not found', 404);
    ok(res, row, 'Ads campaign updated');
  } catch (e) { next(e); }
});

router.delete('/ads/:id', requireAdmin, async (req, res, next) => {
  try {
    const row = await AdsCampaign.findByIdAndDelete(req.params.id);
    if (!row) return fail(res, 'NOT_FOUND', 'Ads campaign not found', 404);
    ok(res, {}, 'Ads campaign deleted');
  } catch (e) { next(e); }
});

// Helper functions
async function calculateTotalEarnings() {
  const [billEarnings, loanEarnings, qrEarnings, walletEarnings, adsEarnings] = await Promise.all([
    calculateBillEarnings(),
    calculateLoanEarnings(),
    calculateQREarnings(),
    calculateWalletEarnings(),
    calculateAdsEarnings()
  ]);

  return billEarnings + loanEarnings + qrEarnings + walletEarnings + adsEarnings;
}

async function calculateEarningsInRange(startDate, endDate) {
  const billEarnings = await Payment.aggregate([
    { $match: { type: 'BILL', createdAt: { $gte: startDate, $lte: endDate } } },
    { $group: { _id: null, total: { $sum: '$metadata.convenienceFee' } } }
  ]);

  const loanEarnings = await Loan.aggregate([
    { $match: { status: { $in: ['DISBURSED', 'CLOSED'] }, createdAt: { $gte: startDate, $lte: endDate } } },
    { $group: { _id: null, total: { $sum: { $add: ['$decision.amountApproved', { $multiply: ['$decision.amountApproved', 0.02] }] } } } }
  ]);

  // For simplicity, include ads earnings in range calculations (could be filtered by date in future)
  const adsEarnings = await calculateAdsEarnings();

  return (billEarnings[0]?.total || 0) + (loanEarnings[0]?.total || 0) + adsEarnings;
}

async function calculateCategoryEarnings() {
  const billEarnings = await calculateBillEarnings();
  const loanEarnings = await calculateLoanEarnings();
  const qrEarnings = await calculateQREarnings();
  const walletEarnings = await calculateWalletEarnings();

  return {
    bills: billEarnings,
    loans: loanEarnings,
    qr: qrEarnings,
    wallet: walletEarnings,
    ads: await calculateAdsEarnings()
  };
}

async function calculateTrendData(startDate, endDate) {
  const days = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayStart = new Date(d);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);

    const earnings = await calculateEarningsInRange(dayStart, dayEnd);
    days.push({
      date: dayStart.toISOString().split('T')[0],
      earnings
    });
  }
  return days;
}

async function calculateBillEarnings() {
  const result = await Payment.aggregate([
    { $match: { type: 'BILL' } },
    { $group: { _id: null, total: { $sum: '$metadata.convenienceFee' } } }
  ]);
  return result[0]?.total || 0;
}

async function calculateLoanEarnings() {
  const loans = await Loan.find({ status: { $in: ['DISBURSED', 'CLOSED'] } });
  return loans.reduce((total, loan) => {
    const processingFee = loan.decision?.amountApproved * 0.02 || 0;
    const interest = loan.schedule?.reduce((sum, s) => sum + (s.interest || 0), 0) || 0;
    const penalties = loan.penalties?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    return total + processingFee + interest + penalties;
  }, 0);
}

async function calculateQREarnings() {
  const qrCodes = await QRCode.find({ type: 'P2C' });
  let total = 0;
  for (const qr of qrCodes) {
    const payments = await Payment.find({ reference: qr._id, type: 'P2P' });
    const volume = payments.reduce((sum, p) => sum + p.amount, 0);
    const commission = volume * 0.005;
    const razorpayFee = volume * 0.002;
    total += commission - razorpayFee + 100; // + subscription
  }
  return total;
}

async function calculateWalletEarnings() {
  const withdrawals = await WithdrawalRequest.find({ status: 'APPROVED' });
  const withdrawFees = withdrawals.reduce((sum, w) => sum + (w.amount * 0.01), 0);

  const users = await User.find({ walletBalance: { $gt: 0 } });
  const loadFees = users.reduce((sum, u) => sum + (u.walletBalance * 0.005), 0);

  return withdrawFees + loadFees;
}

async function calculateAdsEarnings() {
  const result = await AdsCampaign.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    { $group: { _id: null, total: { $sum: '$totalEarned' } } }
  ]);
  return result[0]?.total || 0;
}

async function calculateAdsStats(match = {}) {
  const result = await AdsCampaign.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalEarnings: { $sum: '$totalEarned' },
        totalLeads: { $sum: '$leadsClicks' },
        activeCampaigns: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        campaigns: { $sum: 1 }
      }
    }
  ]);
  const stats = result[0] || { totalEarnings: 0, totalLeads: 0, activeCampaigns: 0, campaigns: 0 };
  return {
    ...stats,
    avgRate: stats.totalLeads > 0 ? stats.totalEarnings / stats.totalLeads : 0
  };
}

export default router;
