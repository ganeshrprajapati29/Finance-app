import { Router } from 'express';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import User from '../models/User.js';
import Loan from '../models/Loan.js';
import Payment from '../models/Payment.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import AdminNotificationHistory from '../models/AdminNotificationHistory.js';
import Settings from '../models/Settings.js';
import { ok, fail } from '../utils/response.js';
import { sendFCMToToken } from '../services/fcm.js';  // ✅ New import

const router = Router();

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

router.put('/settings', async (req, res, next) => {
  try {
    const { appName, appVersion, supportEmail, maintenanceMode, maxLoanAmount, minLoanAmount, interestRate, loanDuration, fcmEnabled, emailEnabled, smsEnabled } = await Joi.object({
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

    await settings.save();

    await AuditLog.create({
      actorId: null, // No auth required for settings
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
        smsEnabled
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

/* ---------------- USERS ---------------- */
router.get('/users', async (req, res, next) => {
  try {
    const q = {};
    if (req.query.status) q.status = req.query.status;
    const list = await User.find(q).sort({ createdAt: -1 }).limit(1000);
    ok(res, list);
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
    const { status } = await Joi.object({
      status: Joi.string().valid('active', 'blocked').required(),
    }).validateAsync(req.body);

    const u = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!u) return fail(res, 'NOT_FOUND', 'User not found', 404);

    await AuditLog.create({
      actorId: req.user.uid,
      action: 'SET_STATUS',
      entityType: 'User',
      entityId: u._id.toString(),
      meta: { status },
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

    ok(res, u, 'Loan limit updated');
  } catch (e) { next(e); }
});

/* ---------------- DATA FETCH ---------------- */
router.get('/loans', async (req, res, next) => {
  try {
    const q = {};
    if (req.query.status) q.status = req.query.status;
    const rows = await Loan.find(q).sort({ createdAt: -1 }).limit(1000);
    ok(res, rows);
  } catch (e) { next(e); }
});

router.get('/payments', async (req, res, next) => {
  try {
    const q = {};
    if (req.query.status) q.status = req.query.status;
    const rows = await Payment.find(q).sort({ createdAt: -1 }).limit(1000);
    ok(res, rows);
  } catch (e) { next(e); }
});

router.get('/audit', async (req, res, next) => {
  try {
    const rows = await AuditLog.find().sort({ createdAt: -1 }).limit(500);
    ok(res, rows);
  } catch (e) { next(e); }
});

/* ---------------- PUSH NOTIFICATION ---------------- */
router.post('/push', async (req, res, next) => {
  try {
    const { userId, title, body, data = {} } = await Joi.object({
      userId: Joi.string().optional(),
      title: Joi.string().required(),
      body: Joi.string().required(),
      data: Joi.object().default({}),
    }).validateAsync(req.body);

    const adminId = req.user.uid; // from middleware

    if (userId) {
      // Send to specific user
      const user = await User.findById(userId);
      if (!user) return fail(res, 'USER_NOT_FOUND', 'User not found', 404);

      // Create notification in database
      await Notification.create({
        userId: user._id,
        title,
        message: body,
        type: 'general',
        data,
      });

      // Save to history
      await AdminNotificationHistory.create({
        title,
        message: body,
        sentTo: 'user',
        userId: user._id,
        sentBy: adminId,
        totalRecipients: 1,
      });

      ok(res, { sent: 1, total: 1 }, 'Notification sent to user');
    } else {
      // Send to all users
      const users = await User.find({ status: 'active' });
      const notifications = users.map(user => ({
        userId: user._id,
        title,
        message: body,
        type: 'general',
        data,
      }));

      await Notification.insertMany(notifications);

      // Save to history
      await AdminNotificationHistory.create({
        title,
        message: body,
        sentTo: 'all',
        sentBy: adminId,
        totalRecipients: users.length,
      });

      ok(res, { sent: users.length, total: users.length }, 'Notification sent to all users');
    }
  } catch (e) { next(e); }
});

/* ---------------- GET NOTIFICATION HISTORY ---------------- */
router.get('/notification-history', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const history = await AdminNotificationHistory.find()
      .sort({ sentAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'name email')
      .populate('sentBy', 'name email');

    const total = await AdminNotificationHistory.countDocuments();

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



export default router;
