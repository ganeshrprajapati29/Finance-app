import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import Employee from '../models/Employee.js';
import SupportTicket from '../models/SupportTicket.js';
import Notification from '../models/Notification.js';
import AdminNotificationHistory from '../models/AdminNotificationHistory.js';
import { ok, fail } from '../utils/response.js';
import { sendFCMToToken } from '../services/fcm.js';

const router = Router();

// Employee authentication middleware
const requireEmployee = (req, res, next) => {
  if (!req.user || req.user.type !== 'employee') {
    return res.status(403).json({ success: false, code: 'NO_PERMISSION', message: 'Employee access required' });
  }
  next();
};

// Employee profile
router.get('/profile', requireAuth, requireEmployee, async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.user.uid).select('name email phone roles permissions');
    if (!employee) return fail(res, 'NOT_FOUND', 'Employee not found', 404);
    ok(res, employee);
  } catch (e) { next(e); }
});

// Support tickets (employees can manage support)
router.get('/support', requireAuth, requireEmployee, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const q = {};
    if (status) q.status = status;

    const tickets = await SupportTicket.find(q)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'name email mobile');

    const total = await SupportTicket.countDocuments(q);

    ok(res, {
      tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (e) { next(e); }
});

// Update support ticket
router.put('/support/:id', requireAuth, requireEmployee, async (req, res, next) => {
  try {
    const { status, adminNotes } = await Joi.object({
      status: Joi.string().valid('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED').required(),
      adminNotes: Joi.string().optional(),
    }).validateAsync(req.body);

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      {
        status,
        adminNotes,
        updatedBy: req.user.uid,
        updatedAt: new Date()
      },
      { new: true }
    ).populate('userId', 'name email mobile');

    if (!ticket) return fail(res, 'NOT_FOUND', 'Ticket not found', 404);

    ok(res, ticket, 'Ticket updated successfully');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

// Send notification (if employee has permission)
router.post('/push', requireAuth, requireEmployee, async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.user.uid);
    if (!employee.permissions.canSendNotifications) {
      return fail(res, 'NO_PERMISSION', 'You do not have permission to send notifications', 403);
    }

    const { userId, title, body, data = {} } = await Joi.object({
      userId: Joi.string().optional(),
      title: Joi.string().required(),
      body: Joi.string().required(),
      data: Joi.object().default({}),
    }).validateAsync(req.body);

    // Similar logic as admin push but with employee permissions
    if (userId) {
      // Employees can only send to users, not other employees
      const User = (await import('../models/User.js')).default;
      const targetUser = await User.findById(userId);
      if (!targetUser) return fail(res, 'USER_NOT_FOUND', 'User not found', 404);

      await Notification.create({
        userId: targetUser._id,
        title,
        message: body,
        type: 'general',
        data,
      });

      await AdminNotificationHistory.create({
        title,
        message: body,
        sentTo: 'user',
        userId: targetUser._id,
        sentBy: req.user.uid,
        totalRecipients: 1,
      });

      ok(res, { sent: 1, total: 1 }, 'Notification sent to user');
    } else {
      return fail(res, 'INVALID_REQUEST', 'Employee can only send to specific users', 400);
    }
  } catch (e) { next(e); }
});

// Get users (if employee has permission)
router.get('/users', requireAuth, requireEmployee, async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.user.uid);
    if (!employee.permissions.canManageUsers) {
      return fail(res, 'NO_PERMISSION', 'You do not have permission to view users', 403);
    }

    const q = {};
    if (req.query.status) q.status = req.query.status;
    const User = (await import('../models/User.js')).default;
    const users = await User.find(q).sort({ createdAt: -1 }).limit(1000);
    ok(res, users);
  } catch (e) { next(e); }
});

// Get loans (if employee has permission)
router.get('/loans', requireAuth, requireEmployee, async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.user.uid);
    if (!employee.permissions.canManageLoans) {
      return fail(res, 'NO_PERMISSION', 'You do not have permission to view loans', 403);
    }

    const q = {};
    if (req.query.status) q.status = req.query.status;
    const Loan = (await import('../models/Loan.js')).default;
    const rows = await Loan.find(q).sort({ createdAt: -1 }).limit(1000);
    ok(res, rows);
  } catch (e) { next(e); }
});

// Get payments (if employee has permission)
router.get('/payments', requireAuth, requireEmployee, async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.user.uid);
    if (!employee.permissions.canManagePayments) {
      return fail(res, 'NO_PERMISSION', 'You do not have permission to view payments', 403);
    }

    const q = {};
    if (req.query.status) q.status = req.query.status;
    const Payment = (await import('../models/Payment.js')).default;
    const rows = await Payment.find(q).sort({ createdAt: -1 }).limit(1000);
    ok(res, rows);
  } catch (e) { next(e); }
});

// Get employee history (employees can view employee creation history)
router.get('/history', requireAuth, requireEmployee, async (req, res, next) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    ok(res, employees);
  } catch (e) { next(e); }
});

export default router;
