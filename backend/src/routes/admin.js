import { Router } from 'express';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import User from '../models/User.js';
import Loan from '../models/Loan.js';
import Payment from '../models/Payment.js';
import Bill from '../models/Bill.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import AdminNotificationHistory from '../models/AdminNotificationHistory.js';
import Settings from '../models/Settings.js';
import Settlement from '../models/Settlement.js';
import CreditReport from '../models/CreditReport.js';
import { ok, fail } from '../utils/response.js';
import { sendFCMToToken } from '../services/fcm.js';  // ✅ New import
import { quickSort } from '../utils/dsa.js';
import { createRazorpayOrder } from '../services/razorpay.js';
import { normalizeAadhaarKycData } from '../utils/aadhaarKyc.js';
import { notifyUserSmart } from '../services/smartNotifications.js';

const router = Router();

const escapeRegex = (value) => String(value || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function maskNumber(value, keep = 4) {
  const raw = String(value || '').replace(/\s+/g, '');
  if (!raw) return '';
  if (raw.length <= keep) return raw;
  return `${'*'.repeat(raw.length - keep)}${raw.slice(-keep)}`;
}

function buildKycSummary(user = {}) {
  const kyc = user.kyc || {};
  const aadhaarSource =
    kyc.aadhaarVerification?.response ||
    kyc.aadhaarData?.raw ||
    kyc.aadhaarData ||
    {};
  const aadhaarData = normalizeAadhaarKycData(aadhaarSource, kyc.aadhaarData || {});
  const docs = Array.isArray(kyc.docs) ? kyc.docs : Array.isArray(kyc.documents) ? kyc.documents : [];

  return {
    status: kyc.status || 'PENDING',
    kycNumber: kyc.kycNumber,
    submittedAt: kyc.submittedAt,
    reviewedAt: kyc.reviewedAt,
    approvedAt: kyc.approvedAt,
    rejectionReason: kyc.rejectionReason,
    aadhaar: {
      number: kyc.aadhaarNumber,
      maskedNumber: maskNumber(kyc.aadhaarNumber),
      mobile: kyc.aadhaarMobile,
      verified: kyc.aadhaarVerified === true,
      verifiedAt: kyc.aadhaarVerification?.verifiedAt,
      orderId: kyc.aadhaarVerification?.orderId,
      data: aadhaarData,
    },
    pan: {
      number: kyc.panNumber,
      maskedNumber: maskNumber(kyc.panNumber, 4),
      name: kyc.panName,
      verified: kyc.panVerified === true,
      verifiedAt: kyc.panVerification?.verifiedAt,
      orderId: kyc.panVerification?.orderId,
      data: kyc.panData,
      response: kyc.panVerification?.response,
    },
    docs,
  };
}

function buildCreditReportSummary(report) {
  if (!report) return null;
  return {
    id: report._id,
    provider: report.provider,
    environment: report.environment,
    referenceId: report.referenceId,
    name: report.name,
    mobile: report.mobile,
    panMasked: report.panMasked,
    bureau: report.bureau,
    status: report.status,
    score: report.score,
    purpose: report.purpose,
    consent: report.consent,
    request: report.request,
    response: report.response,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}

// Settings routes (no auth required for dynamic updates)
router.get('/settings', async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      // Create default settings if none exist
      settings = await Settings.create({
        appName: 'Khatu Pay',
        appVersion: '1.0.0',
        supportEmail: 'support@khatupay.com',
        maintenanceMode: false,
        maxLoanAmount: 50000,
        minLoanAmount: 1000,
        interestRate: 12.5,
        loanDuration: 12,
        fcmEnabled: false,
        emailEnabled: true,
        smsEnabled: false
      });
    }
    ok(res, settings);
  } catch (e) { next(e); }
});

/* ---------------- DYNAMIC MARQUEE (No auth required for dashboard display) ---------------- */
router.get('/marquee', async (req, res, next) => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch recent activities with DSA optimization
    const [recentLoans, recentPayments, recentNotifications, recentUsers, overdueLoans, recentSettlements] = await Promise.all([
      Loan.find({ createdAt: { $gte: last24Hours } }).populate('userId', 'name').limit(5),
      Payment.find({ createdAt: { $gte: last24Hours } }).populate('userId', 'name').limit(5),
      Notification.find({ createdAt: { $gte: last24Hours } }).populate('userId', 'name').limit(5),
      User.find({ createdAt: { $gte: last24Hours } }).select('name').limit(5),
      Loan.find({
        status: 'disbursed',
        nextDueDate: { $lt: now, $gte: last7Days }
      }).populate('userId', 'name').limit(5),
      Settlement.find({ createdAt: { $gte: last24Hours } }).populate('loanId').populate('userId', 'name').limit(5)
    ]);

    // Combine all activities with priority levels
    const activities = [
      ...recentLoans.map(loan => ({
        type: 'loan',
        priority: 1, // High priority
        message: `🚨 New loan application from ${loan.userId?.name || 'Unknown User'} for ₹${loan.amount}`,
        createdAt: loan.createdAt
      })),
      ...recentPayments.map(payment => ({
        type: 'payment',
        priority: 2, // Medium priority
        message: `💰 Payment received from ${payment.userId?.name || 'Unknown User'} for ₹${payment.amount}`,
        createdAt: payment.createdAt
      })),
      ...recentNotifications.map(notification => ({
        type: 'notification',
        priority: 3, // Medium priority
        message: `📢 ${notification.title}`,
        createdAt: notification.createdAt
      })),
      ...recentUsers.map(user => ({
        type: 'user',
        priority: 4, // Low priority
        message: `👤 New user registered: ${user.name}`,
        createdAt: user.createdAt
      })),
      ...overdueLoans.map(loan => ({
        type: 'overdue',
        priority: 1, // High priority
        message: `⚠️ Overdue loan alert: ${loan.userId?.name || 'Unknown User'} - ₹${loan.amount}`,
        createdAt: now // Use current time for overdue alerts
      })),
      ...recentSettlements.map(settlement => ({
        type: 'settlement',
        priority: 2, // Medium priority
        message: `✅ Loan settlement completed for ${settlement.userId?.name || 'Unknown User'}`,
        createdAt: settlement.createdAt
      }))
    ];

    // Sort activities by priority first, then by creation date (most recent first) using quickSort
    const sortedActivities = quickSort(activities, (a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority; // Lower number = higher priority
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Extract messages for marquee (limit to 15 for more alerts)
    const messages = sortedActivities.slice(0, 15).map(activity => activity.message);

    // If no recent activities, provide default messages
    if (messages.length === 0) {
      messages.push(
        'Welcome to Khatu Pay Admin Dashboard',
        'No recent activities to display',
        'Check back later for updates'
      );
    }

    ok(res, messages);
  } catch (e) {
    next(e);
  }
});

router.put('/settings', requireAuth, requireRole(['admin']), async (req, res, next) => {
  try {
    const { appName, appVersion, supportEmail, maintenanceMode, maxLoanAmount, minLoanAmount, interestRate, loanDuration, fcmEnabled, emailEnabled, smsEnabled, appUpdate } = await Joi.object({
      appName: Joi.string().optional(),
      appVersion: Joi.string().optional(),
      supportEmail: Joi.string().email().optional(),
      maintenanceMode: Joi.boolean().optional(),
      maxLoanAmount: Joi.number().min(0).optional(),
      minLoanAmount: Joi.number().min(0).optional(),
      interestRate: Joi.number().min(0).optional(),
      loanDuration: Joi.number().min(1).optional(),
      fcmEnabled: Joi.boolean().optional(),
      emailEnabled: Joi.boolean().optional(),
      smsEnabled: Joi.boolean().optional(),
      appUpdate: Joi.object({
        android: Joi.object({
          latestVersion: Joi.string().trim().max(30).required(),
          latestBuild: Joi.number().integer().min(1).required(),
          minimumSupportedBuild: Joi.number().integer().min(1).required(),
          forceUpdate: Joi.boolean().required(),
          message: Joi.string().trim().min(10).max(500).required(),
          storeUrl: Joi.string().uri({ scheme: ['https'] }).required(),
        }).required(),
      }).optional(),
    }).unknown(true).validateAsync(req.body);

    // Save to database
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    settings.appName = appName;
    settings.appVersion = appVersion;
    settings.supportEmail = supportEmail;
    settings.maintenanceMode = maintenanceMode;
    settings.maxLoanAmount = maxLoanAmount;
    settings.minLoanAmount = minLoanAmount;
    settings.interestRate = interestRate;
    settings.loanDuration = loanDuration;
    settings.fcmEnabled = fcmEnabled;
    settings.emailEnabled = emailEnabled;
    settings.smsEnabled = smsEnabled;
    if (appUpdate?.android) {
      if (appUpdate.android.minimumSupportedBuild > appUpdate.android.latestBuild) {
        return fail(
          res,
          'INVALID_VERSION_POLICY',
          'Minimum supported build cannot be greater than the latest build.',
          400
        );
      }
      settings.appUpdate = { android: appUpdate.android };
    }

    await settings.save();

    await AuditLog.create({
      actorId: req.user.uid,
      action: 'UPDATE_SETTINGS',
      entityType: 'System',
      entityId: 'settings',
      meta: {
        appName,
        appVersion,
        supportEmail,
        maintenanceMode,
        maxLoanAmount,
        minLoanAmount,
        interestRate,
        loanDuration,
        fcmEnabled,
        emailEnabled,
        smsEnabled,
        appUpdate
      },
    });

    ok(res, settings, 'Settings updated successfully');
  } catch (e) { next(e); }
});

router.use(requireAuth, requireRole(['admin']));

// Stats route
router.get('/stats', async (req, res, next) => {
  try {
    const pending = await Loan.countDocuments({ status: 'pending' });
    const approved = await Loan.countDocuments({ status: 'approved' });
    const disbursed = await Loan.countDocuments({ status: 'disbursed' });
    ok(res, { pending, approved, disbursed });
  } catch (e) { next(e); }
});

router.put('/change-password', async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = await Joi.object({
      oldPassword: Joi.string().required(),
      newPassword: Joi.string().min(6).required(),
    }).validateAsync(req.body);

    const admin = await User.findById(req.user.uid);
    if (!admin) return fail(res, 'NOT_FOUND', 'Admin not found', 404);

    if (!admin.passwordHash) return fail(res, 'INVALID_CREDENTIALS', 'Invalid credentials', 401);

    // Use bcryptjs directly like in auth.js
    const isValid = await bcrypt.compare(oldPassword, admin.passwordHash);
    if (!isValid) return fail(res, 'INVALID_PASSWORD', 'Old password is incorrect', 400);

    admin.passwordHash = await bcrypt.hash(newPassword, 12);
    await admin.save();

    await AuditLog.create({
      actorId: req.user.uid,
      action: 'CHANGE_PASSWORD',
      entityType: 'Admin',
      entityId: req.user.uid,
      meta: { changedAt: new Date() },
    });

    ok(res, { message: 'Password changed successfully' });
  } catch (e) { next(e); }
});

router.use(requireAuth, requireRole(['admin']));

/* ---------------- PROFILE ---------------- */
router.get('/profile', async (req, res, next) => {
  try {
    const admin = await User.findById(req.user.uid).select('name email mobile roles');
    if (!admin) return fail(res, 'NOT_FOUND', 'Admin not found', 404);
    ok(res, admin);
  } catch (e) { next(e); }
});

router.put('/profile', async (req, res, next) => {
  try {
    const { name, email, mobile } = await Joi.object({
      name: Joi.string().trim().min(2).max(50).required(),
      email: Joi.string().email().lowercase().required(),
      mobile: Joi.string().pattern(/^[6-9]\d{9}$/).optional().allow(''),
    }).unknown(true).validateAsync(req.body);

    const adminId = req.user.uid;

    // Check if email is already taken by another user
    const existingEmailUser = await User.findOne({ email, _id: { $ne: adminId } });
    if (existingEmailUser) return fail(res, 'EMAIL_EXISTS', 'Email is already in use', 400);

    // Check if mobile is already taken by another user (if provided)
    if (mobile) {
      const existingMobileUser = await User.findOne({ mobile, _id: { $ne: adminId } });
      if (existingMobileUser) return fail(res, 'MOBILE_EXISTS', 'Mobile number is already in use', 400);
    }

    const updatedAdmin = await User.findByIdAndUpdate(
      adminId,
      { name, email, mobile: mobile || null },
      { new: true, select: 'name email mobile roles' }
    );

    if (!updatedAdmin) return fail(res, 'NOT_FOUND', 'Admin not found', 404);

    await AuditLog.create({
      actorId: adminId,
      action: 'UPDATE_PROFILE',
      entityType: 'Admin',
      entityId: adminId,
      meta: { name, email, mobile },
    });

    ok(res, updatedAdmin, 'Profile updated successfully');
  } catch (e) { next(e); }
});

/* ---------------- USERS ---------------- */
function withPinStatus(userDoc) {
  const user = userDoc.toObject ? userDoc.toObject() : userDoc;
  const mpinHash = user.mpinHash;
  const pinLockedUntil = user.pinLockedUntil;
  delete user.mpinHash;
  user.pinStatus = pinLockedUntil && new Date(pinLockedUntil) > new Date()
    ? 'LOCKED'
    : mpinHash ? 'SET' : 'NOT_SET';
  return user;
}

router.get('/users', async (req, res, next) => {
  try {
    const q = {};
    if (req.query.status) q.status = req.query.status;
    const list = await User.find(q).select('-passwordHash').sort({ createdAt: -1 }).limit(1000);
    ok(res, list.map(withPinStatus));
  } catch (e) { next(e); }
});

router.get('/users/search', async (req, res, next) => {
  try {
    const term = String(req.query.q || '').trim();
    if (!term) return ok(res, []);
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safe, 'i');
    const users = await User.find({
      $or: [{ name: regex }, { email: regex }, { mobile: regex }]
    }).select('name email mobile status walletBalance').sort({ createdAt: -1 }).limit(20);
    ok(res, users);
  } catch (e) { next(e); }
});

router.post('/users', async (req, res, next) => {
  try {
    const {
      name,
      email,
      mobile,
      password,
      status,
      role,
      loanLimitAmount,
      walletBalance,
      emailVerified,
    } = await Joi.object({
      name: Joi.string().trim().min(2).max(80).required(),
      email: Joi.string().email().lowercase().required(),
      mobile: Joi.string().trim().min(8).max(15).required(),
      password: Joi.string().min(6).required(),
      status: Joi.string().valid('active', 'blocked').default('active'),
      role: Joi.string().valid('user', 'admin', 'employee').default('user'),
      loanLimitAmount: Joi.number().min(0).default(0),
      walletBalance: Joi.number().min(0).default(0),
      emailVerified: Joi.boolean().default(true),
    }).validateAsync(req.body);

    const exists = await User.findOne({ $or: [{ email }, { mobile }] });
    if (exists) return fail(res, 'USER_EXISTS', 'Email or mobile already registered', 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      mobile,
      passwordHash,
      status,
      roles: [role],
      walletBalance,
      emailVerified,
      loanLimit: loanLimitAmount > 0 ? { amount: loanLimitAmount, setBy: req.user.uid, setAt: new Date() } : undefined,
    });

    await AuditLog.create({
      actorId: req.user.uid,
      action: 'CREATE_USER',
      entityType: 'User',
      entityId: user._id.toString(),
      meta: { email, mobile, status, role, loanLimitAmount, walletBalance },
    });

    const safeUser = user.toObject();
    delete safeUser.passwordHash;
    ok(res, safeUser, 'User created successfully');
  } catch (e) {
    if (e.isJoi) return fail(res, 'VALIDATION_ERROR', e.message, 400);
    next(e);
  }
});

router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) return fail(res, 'NOT_FOUND', 'User not found', 404);
    ok(res, withPinStatus(user));
  } catch (e) { next(e); }
});

router.get('/users/:id/transactions', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Payment.find({ userId: req.params.id }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Payment.countDocuments({ userId: req.params.id }),
    ]);
    ok(res, { items, total, page: Number(page), limit: Number(limit) });
  } catch (e) { next(e); }
});

router.get('/users/:id/loans', async (req, res, next) => {
  try {
    const items = await Loan.find({ userId: req.params.id }).sort({ createdAt: -1 }).limit(1000);
    ok(res, items);
  } catch (e) { next(e); }
});

router.post('/users/:id/reset-password', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return fail(res, 'NOT_FOUND', 'User not found', 404);

    const tempPassword = `KP${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString().slice(-2)}`;
    user.passwordHash = await bcrypt.hash(tempPassword, 12);
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    await user.save();

    await AuditLog.create({
      actorId: req.user.uid,
      action: 'RESET_USER_PASSWORD',
      entityType: 'User',
      entityId: user._id.toString(),
      meta: { resetAt: new Date() },
    });

    await notifyUserSmart(user._id, 'admin_user_action', {
      force: true,
      email: true,
      message: 'A temporary password was generated for your account. Please log in and change it immediately.',
      adminAction: 'Password reset',
      route: '/change-password',
      data: { action: 'RESET_USER_PASSWORD' },
    });

    ok(res, { tempPassword }, 'Temporary password generated');
  } catch (e) { next(e); }
});

router.post('/users/:id/reset-pin', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return fail(res, 'NOT_FOUND', 'User not found', 404);

    user.mpinHash = undefined;
    user.pinAttempts = 0;
    user.pinLockedUntil = undefined;
    user.pinResetRequired = true;
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    await user.save();

    await AuditLog.create({
      actorId: req.user.uid,
      action: 'RESET_USER_PIN',
      entityType: 'User',
      entityId: user._id.toString(),
      meta: { resetAt: new Date() },
    });

    await notifyUserSmart(user._id, 'admin_user_action', {
      force: true,
      email: true,
      message: 'Your MPIN was reset for security. Please set a new MPIN from the app.',
      adminAction: 'MPIN reset',
      route: '/settings',
      data: { action: 'RESET_USER_PIN' },
    });

    ok(res, {}, 'User PIN cleared. They must set a new PIN via Forgot PIN.');
  } catch (e) { next(e); }
});

router.put('/users/:id/roles', async (req, res, next) => {
  try {
    const { roles } = await Joi.object({
      roles: Joi.array().items(Joi.string()).required(),
    }).validateAsync(req.body);

    const u = await User.findByIdAndUpdate(req.params.id, { roles }, { new: true });
    if (!u) return fail(res, 'NOT_FOUND', 'User not found', 404);

    await AuditLog.create({
      actorId: req.user.uid,
      action: 'SET_ROLES',
      entityType: 'User',
      entityId: u._id.toString(),
      meta: { roles },
    });

    ok(res, u, 'Roles updated');
  } catch (e) { next(e); }
});

router.put('/users/:id/status', async (req, res, next) => {
  try {
    const { status, reason } = await Joi.object({
      status: Joi.string().valid('active', 'blocked').required(),
      reason: Joi.string().trim().max(300).allow('').default(''),
    }).validateAsync(req.body);

    if (String(req.params.id) === String(req.user.uid) && status === 'blocked') {
      return fail(res, 'SELF_BLOCK_NOT_ALLOWED', 'You cannot block your own account', 400);
    }

    const target = await User.findById(req.params.id);
    if (!target) return fail(res, 'NOT_FOUND', 'User not found', 404);
    if (target.roles?.includes('admin') && status === 'blocked') {
      return fail(res, 'ADMIN_BLOCK_NOT_ALLOWED', 'Admin accounts cannot be blocked from customer controls', 400);
    }

    target.status = status;
    target.sessionVersion = (target.sessionVersion || 0) + 1;
    target.fcmTokens = [];
    target.accessControl = {
      ...(target.accessControl?.toObject?.() || target.accessControl || {}),
      ...(status === 'blocked'
        ? { blockedAt: new Date(), blockedBy: req.user.uid, blockReason: reason || 'Blocked by account administrator' }
        : { unblockedAt: new Date(), unblockedBy: req.user.uid, blockReason: '' }),
    };
    await target.save();
    const u = target;

    await AuditLog.create({
      actorId: req.user.uid,
      action: 'SET_STATUS',
      entityType: 'User',
      entityId: u._id.toString(),
      meta: { status, reason, sessionRevoked: true },
    });

    await notifyUserSmart(u._id, 'admin_user_action', {
      force: true,
      email: true,
      message: status === 'active'
        ? 'Your Khatu Pay account has been activated.'
        : 'Your Khatu Pay account has been temporarily blocked. Contact support if you need help.',
      adminAction: 'Account status updated',
      route: '/profile',
      data: { action: 'SET_STATUS', status },
    });

    ok(res, u, 'Status updated');
  } catch (e) { next(e); }
});

router.put('/users/:id/limit', async (req, res, next) => {
  try {
    const { amount } = await Joi.object({
      amount: Joi.number().min(0).required(),
    }).validateAsync(req.body);

    const u = await User.findById(req.params.id);
    if (!u) return fail(res, 'NOT_FOUND', 'User not found', 404);

    u.loanLimit = { amount, setBy: req.user.uid, setAt: new Date() };
    await u.save();

    await AuditLog.create({
      actorId: req.user.uid,
      action: 'SET_LOAN_LIMIT',
      entityType: 'User',
      entityId: u._id.toString(),
      meta: { amount },
    });

    await notifyUserSmart(u._id, 'admin_user_action', {
      force: true,
      email: true,
      message: `Your eligible service limit has been updated to ${amount}.`,
      adminAction: 'Limit updated',
      route: '/loans',
      data: { action: 'SET_LOAN_LIMIT', amount },
    });

    ok(res, u, 'Loan limit updated');
  } catch (e) { next(e); }
});

/* ---------------- DATA FETCH ---------------- */
router.get('/kyc', async (req, res, next) => {
  try {
    const { status = 'ALL', search = '', page = 1, limit = 50 } = req.query;
    const q = {};
    if (status && status !== 'ALL') q['kyc.status'] = status;
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      q.$or = [
        { name: regex },
        { email: regex },
        { mobile: regex },
        { 'kyc.kycNumber': regex },
        { 'kyc.panNumber': regex },
        { 'kyc.panName': regex },
        { 'kyc.aadhaarNumber': regex },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(q)
        .select('name email mobile status kyc createdAt updatedAt')
        .sort({ 'kyc.submittedAt': -1, updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(q),
    ]);

    const userIds = users.map((user) => user._id);
    const [loanCounts, creditReports] = await Promise.all([
      Loan.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: '$userId', total: { $sum: 1 }, latestLoanAt: { $max: '$createdAt' } } },
      ]),
      CreditReport.find({ userId: { $in: userIds } }).sort({ createdAt: -1 }).lean(),
    ]);

    const loanCountByUser = new Map(loanCounts.map((item) => [String(item._id), item]));
    const creditByUser = new Map();
    for (const report of creditReports) {
      const key = String(report.userId);
      if (!creditByUser.has(key)) creditByUser.set(key, report);
    }

    const items = users.map((user) => {
      const key = String(user._id);
      const loanMeta = loanCountByUser.get(key) || {};
      return {
        ...user,
        kycSummary: buildKycSummary(user),
        loanSummary: {
          total: loanMeta.total || 0,
          latestLoanAt: loanMeta.latestLoanAt,
        },
        creditReport: buildCreditReportSummary(creditByUser.get(key)),
      };
    });

    ok(res, { items, total, page: Number(page), limit: Number(limit) });
  } catch (e) { next(e); }
});

router.get('/kyc/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('name email mobile status kyc createdAt updatedAt')
      .lean();
    if (!user) return fail(res, 'USER_NOT_FOUND', 'User not found', 404);

    const [loans, creditReports] = await Promise.all([
      Loan.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10).lean(),
      CreditReport.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
    ]);

    ok(res, {
      user,
      kycSummary: buildKycSummary(user),
      loans,
      creditReports: creditReports.map(buildCreditReportSummary),
    });
  } catch (e) { next(e); }
});

router.put('/kyc/:id/review', async (req, res, next) => {
  try {
    const { status, notes = '' } = await Joi.object({
      status: Joi.string().valid('APPROVED', 'REJECTED', 'SUBMITTED', 'PENDING').required(),
      notes: Joi.string().allow('').max(500).default(''),
    }).validateAsync(req.body);

    const user = await User.findById(req.params.id);
    if (!user) return fail(res, 'USER_NOT_FOUND', 'User not found', 404);

    user.kyc = user.kyc || { docs: [], documents: [] };
    const docs = Array.isArray(user.kyc.docs) ? user.kyc.docs : [];
    user.kyc.docs = docs.map((doc) => ({
      ...doc,
      status: status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : doc.status,
      notes,
      reviewedAt: new Date(),
      reviewedBy: req.user.uid,
    }));
    user.kyc.documents = user.kyc.docs;
    user.kyc.status = status;
    user.kyc.reviewedBy = req.user.uid;
    user.kyc.reviewedAt = new Date();
    if (status === 'APPROVED') {
      user.kyc.kycNumber = user.kyc.kycNumber || `KYC${Date.now()}${String(user._id).slice(-4).toUpperCase()}`;
      user.kyc.approvedAt = user.kyc.approvedAt || new Date();
      user.kyc.rejectionReason = undefined;
    } else if (status === 'REJECTED') {
      user.kyc.approvedAt = undefined;
      user.kyc.rejectionReason = notes || 'KYC verification could not be approved';
    } else {
      user.kyc.approvedAt = undefined;
      user.kyc.rejectionReason = undefined;
    }

    await user.save();
    await AuditLog.create({
      actorId: req.user.uid,
      action: 'REVIEW_KYC',
      entityType: 'User',
      entityId: user._id.toString(),
      meta: { status, notes },
    });

    const notificationEvent = status === 'APPROVED'
      ? 'kyc_approved'
      : status === 'REJECTED'
        ? 'kyc_rejected'
        : 'kyc_pending_review';
    await notifyUserSmart(user._id, notificationEvent, {
      force: true,
      email: status === 'APPROVED' || status === 'REJECTED',
      notes,
      data: { status, kycNumber: user.kyc.kycNumber, reviewedByAdmin: true },
    });

    ok(res, { kyc: user.kyc, kycSummary: buildKycSummary(user) }, 'KYC review updated');
  } catch (e) { next(e); }
});

router.get('/loans', async (req, res, next) => {
  try {
    const { status = 'ALL', page = 1, limit = 1000, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const q = {};
    if (status && status !== 'ALL') q.status = status;
    const skip = (Number(page) - 1) * Number(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const [loans, total] = await Promise.all([
      Loan.find(q)
        .populate('userId', 'name email mobile status walletBalance kyc')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Loan.countDocuments(q),
    ]);
    const userIds = loans.map((loan) => loan.userId?._id).filter(Boolean);
    const creditReports = await CreditReport.find({ userId: { $in: userIds } }).sort({ createdAt: -1 }).lean();
    const creditByUser = new Map();
    for (const report of creditReports) {
      const key = String(report.userId);
      if (!creditByUser.has(key)) creditByUser.set(key, report);
    }

    const items = loans.map((loan) => {
      const userKyc = loan.userId?.kyc || {};
      const documents = loan.application?.documents || {};
      const aadhaarEkyc = documents.aadhaarEkyc || {};
      const panVerification = documents.panVerification || {};
      const aadhaarSource = userKyc.aadhaarVerification?.response ||
        aadhaarEkyc.aadhaarData?.raw ||
        userKyc.aadhaarData?.raw ||
        userKyc.aadhaarData ||
        aadhaarEkyc.aadhaarData ||
        {};
      const aadhaarData = normalizeAadhaarKycData(aadhaarSource, aadhaarEkyc.aadhaarData || userKyc.aadhaarData || {});

      return {
        ...loan,
        application: {
          ...(loan.application || {}),
          documents: {
            ...documents,
            aadhaarEkyc: {
              ...aadhaarEkyc,
              verified: aadhaarEkyc.verified || userKyc.aadhaarVerified === true,
              aadhaarNumber: aadhaarEkyc.aadhaarNumber || userKyc.aadhaarNumber,
              aadhaarMobile: aadhaarEkyc.aadhaarMobile || userKyc.aadhaarMobile,
              verifiedAt: aadhaarEkyc.verifiedAt || userKyc.aadhaarVerification?.verifiedAt,
              orderId: aadhaarEkyc.orderId || userKyc.aadhaarVerification?.orderId,
              aadhaarData
            },
            panVerification: {
              ...panVerification,
              verified: panVerification.verified || userKyc.panVerified === true,
              panNumber: panVerification.panNumber || userKyc.panNumber,
              panName: panVerification.panName || userKyc.panName,
              verifiedAt: panVerification.verifiedAt || userKyc.panVerification?.verifiedAt,
              orderId: panVerification.orderId || userKyc.panVerification?.orderId,
              panData: panVerification.panData || userKyc.panData,
              response: panVerification.response || userKyc.panVerification?.response,
            }
          },
        },
        userKyc: loan.userId ? buildKycSummary(loan.userId) : null,
        creditReport: buildCreditReportSummary(creditByUser.get(String(loan.userId?._id))),
      };
    });
    ok(res, { items, total, page: Number(page), limit: Number(limit) });
  } catch (e) { next(e); }
});

router.get('/payments', async (req, res, next) => {
  try {
    const { status = 'ALL', page = 1, limit = 1000, type = 'ALL', method = 'ALL' } = req.query;
    const q = {};
    if (status && status !== 'ALL') q.status = status;
    if (type && type !== 'ALL') q.type = type;
    if (method && method !== 'ALL') q.method = method;
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Payment.find(q)
        .populate('userId', 'name email mobile walletBalance')
        .populate('loanId', 'loanAccountNumber status')
        .populate('billId', 'billType provider amount status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Payment.countDocuments(q),
    ]);
    ok(res, { items, total, page: Number(page), limit: Number(limit) });
  } catch (e) { next(e); }
});

/* ---------------- ADMIN PAYMENT ORDER (Razorpay) ---------------- */
router.post('/payments/razorpay/order', async (req, res, next) => {
  try {
    const { amount, currency = 'INR', loanId = null, billId = null, installmentNo = null, isFullPayment = false, notes = {}, payeeVPA = null, payeeName = null, payeeNote = null } =
      await Joi.object({
        amount: Joi.number().min(1).required(),
        currency: Joi.string().default('INR'),
        loanId: Joi.string().allow(null, '').default(null),
        billId: Joi.string().allow(null, '').default(null),
        installmentNo: Joi.number().integer().allow(null).default(null),
        isFullPayment: Joi.boolean().default(false),
        notes: Joi.object().default({}),
        payeeVPA: Joi.string().allow(null, '').default(null),
        payeeName: Joi.string().allow(null, '').default(null),
        payeeNote: Joi.string().allow(null, '').default(null)
      }).validateAsync(req.body);

    // Get user from loan if loanId provided
    let userId = null;
    if (loanId) {
      const loan = await Loan.findById(loanId);
      if (!loan) return fail(res, 'LOAN_NOT_FOUND', 'Loan not found', 404);
      userId = loan.userId;
    } else if (billId) {
      // For bills, we might need to get user from bill
      // Assuming bill has userId field
      const bill = await Bill.findById(billId);
      if (!bill) return fail(res, 'BILL_NOT_FOUND', 'Bill not found', 404);
      userId = bill.userId;
    } else {
      return fail(res, 'MISSING_REFERENCE', 'Either loanId or billId must be provided', 400);
    }

    const receipt = `KP-ADMIN-${Date.now()}`;
    const order = await createRazorpayOrder({
      amount: Math.round(amount * 100),
      currency,
      receipt,
      notes: { ...notes, initiatedBy: 'admin', adminId: req.user.uid }
    });

    const type = isFullPayment ? 'FULL_REPAYMENT' : (loanId ? 'REPAYMENT' : (billId ? 'BILL' : (payeeVPA ? 'P2P' : 'OTHER')));
    const payment = await Payment.create({
      userId,
      loanId,
      billId,
      installmentNo,
      type,
      amount,
      method: 'RAZORPAY',
      reference: order.id,
      status: 'PENDING',
      gateway: { provider: 'razorpay', orderId: order.id },
      payeeDetails: payeeVPA ? { vpa: payeeVPA, name: payeeName, note: payeeNote } : undefined,
      initiatedBy: 'admin',
      adminId: req.user.uid
    });

    await AuditLog.create({
      actorId: req.user.uid,
      action: 'CREATE_PAYMENT_ORDER',
      entityType: 'Payment',
      entityId: payment._id.toString(),
      meta: { amount, loanId, billId, installmentNo, orderId: order.id },
    });

    ok(res, { order, paymentId: payment._id, key_id: process.env.RAZORPAY_KEY_ID }, 'Order created');
  } catch (e) { next(e); }
});

router.get('/audit', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, action, entityType, search } = req.query;
    const query = {};
    if (action) query.action = action;
    if (entityType) query.entityType = entityType;
    if (search) {
      const safe = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      query.$or = [{ action: regex }, { entityType: regex }, { entityId: regex }];
    }

    const rows = await AuditLog.find(query)
      .populate('actorId', 'name email mobile')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    const total = await AuditLog.countDocuments(query);

    ok(res, {
      logs: rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)) || 1
      }
    });
  } catch (e) { next(e); }
});

/* ---------------- PUSH NOTIFICATION ---------------- */
function personalizeNotificationText(text, user) {
  const name = user.name || 'KhatuPay user';
  return String(text)
    .replace(/\{name\}/gi, name)
    .replace(/\{mobile\}/gi, user.mobile || '')
    .replace(/\{email\}/gi, user.email || '');
}

router.post('/push', async (req, res, next) => {
  try {
    const { userId, title, body, type, priority, data = {} } = await Joi.object({
      userId: Joi.string().allow('', null).optional(),
      title: Joi.string().trim().min(2).max(120).required(),
      body: Joi.string().trim().min(2).max(1000).required(),
      type: Joi.string().valid('loan', 'payment', 'kyc', 'support', 'general').default('general'),
      priority: Joi.string().valid('HIGH', 'MEDIUM', 'LOW').default('MEDIUM'),
      data: Joi.object().default({}),
    }).validateAsync(req.body);

    const adminId = req.user.uid; // from middleware
    const targetUsers = userId
      ? await User.find({ _id: userId }).select('name email mobile status fcmTokens')
      : await User.find({ status: 'active' }).select('name email mobile status fcmTokens');

    if (userId && targetUsers.length === 0) {
      return fail(res, 'USER_NOT_FOUND', 'User not found', 404);
    }

    const notifications = targetUsers.map(user => ({
      userId: user._id,
      title: personalizeNotificationText(title, user),
      message: personalizeNotificationText(body, user),
      type,
      priority,
      data,
    }));

    if (notifications.length) {
      await Notification.insertMany(notifications);
    }

    let fcmSent = 0;
    let fcmFailed = 0;
    for (const user of targetUsers) {
      const userTitle = personalizeNotificationText(title, user);
      const userBody = personalizeNotificationText(body, user);
      const userTokens = Array.isArray(user.fcmTokens) ? user.fcmTokens.filter(Boolean) : [];

      for (const token of userTokens.slice(0, 5)) {
        try {
          const sent = await sendFCMToToken(
            token,
            { title: userTitle, body: userBody },
            { ...data, type, priority, userId: String(user._id), route: data.route || '/notifications' }
          );
          if (sent) fcmSent += 1;
          else fcmFailed += 1;
        } catch {
          fcmFailed += 1;
        }
      }
    }

    const history = await AdminNotificationHistory.create({
      title,
      message: body,
      type,
      priority,
      sentTo: userId ? 'user' : 'all',
      userId: userId || undefined,
      sentBy: adminId,
      totalRecipients: targetUsers.length,
      fcmSent,
      fcmFailed,
      status: fcmFailed > 0 && fcmSent > 0 ? 'partial' : 'sent',
      data,
    });

    ok(res, { sent: targetUsers.length, total: targetUsers.length, fcmSent, fcmFailed, history }, userId ? 'Notification sent to user' : 'Notification sent to all users');
  } catch (e) { next(e); }
});

/* ---------------- GET NOTIFICATION HISTORY ---------------- */
router.get('/notification-history', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, sentTo, type, priority, search } = req.query;
    const query = {};
    if (sentTo) query.sentTo = sentTo;
    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (search) {
      const safe = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      query.$or = [{ title: regex }, { message: regex }];
    }

    const history = await AdminNotificationHistory.find(query)
      .sort({ sentAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'name email mobile')
      .populate('sentBy', 'name email');

    const total = await AdminNotificationHistory.countDocuments(query);

    ok(res, {
      history,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (e) { next(e); }
});

/* ---------------- DYNAMIC MARQUEE ---------------- */
router.get('/marquee', async (req, res, next) => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch recent activities with DSA optimization
    const [recentLoans, recentPayments, recentNotifications, recentUsers, overdueLoans, recentSettlements] = await Promise.all([
      Loan.find({ createdAt: { $gte: last24Hours } }).populate('userId', 'name').limit(5),
      Payment.find({ createdAt: { $gte: last24Hours } }).populate('userId', 'name').limit(5),
      Notification.find({ createdAt: { $gte: last24Hours } }).populate('userId', 'name').limit(5),
      User.find({ createdAt: { $gte: last24Hours } }).select('name').limit(5),
      Loan.find({
        status: 'disbursed',
        nextDueDate: { $lt: now, $gte: last7Days }
      }).populate('userId', 'name').limit(5),
      Settlement.find({ createdAt: { $gte: last24Hours } }).populate('loanId').populate('userId', 'name').limit(5)
    ]);

    // Combine all activities with priority levels
    const activities = [
      ...recentLoans.map(loan => ({
        type: 'loan',
        priority: 1, // High priority
        message: `🚨 New loan application from ${loan.userId?.name || 'Unknown User'} for ₹${loan.amount}`,
        createdAt: loan.createdAt
      })),
      ...recentPayments.map(payment => ({
        type: 'payment',
        priority: 2, // Medium priority
        message: `💰 Payment received from ${payment.userId?.name || 'Unknown User'} for ₹${payment.amount}`,
        createdAt: payment.createdAt
      })),
      ...recentNotifications.map(notification => ({
        type: 'notification',
        priority: 3, // Medium priority
        message: `📢 ${notification.title}`,
        createdAt: notification.createdAt
      })),
      ...recentUsers.map(user => ({
        type: 'user',
        priority: 4, // Low priority
        message: `👤 New user registered: ${user.name}`,
        createdAt: user.createdAt
      })),
      ...overdueLoans.map(loan => ({
        type: 'overdue',
        priority: 1, // High priority
        message: `⚠️ Overdue loan alert: ${loan.userId?.name || 'Unknown User'} - ₹${loan.amount}`,
        createdAt: now // Use current time for overdue alerts
      })),
      ...recentSettlements.map(settlement => ({
        type: 'settlement',
        priority: 2, // Medium priority
        message: `✅ Loan settlement completed for ${settlement.userId?.name || 'Unknown User'}`,
        createdAt: settlement.createdAt
      }))
    ];

    // Sort activities by priority first, then by creation date (most recent first) using quickSort
    const sortedActivities = quickSort(activities, (a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority; // Lower number = higher priority
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Extract messages for marquee (limit to 15 for more alerts)
    const messages = sortedActivities.slice(0, 15).map(activity => activity.message);

    // If no recent activities, provide default messages
    if (messages.length === 0) {
      messages.push(
        'Welcome to Khatu Pay Admin Dashboard',
        'No recent activities to display',
        'Check back later for updates'
      );
    }

    ok(res, messages);
  } catch (e) {
    next(e);
  }
});

export default router;
