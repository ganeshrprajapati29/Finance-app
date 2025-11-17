import { Router } from 'express';
import Joi from 'joi';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';
import Notification from '../models/Notification.js';
import SupportTicket from '../models/SupportTicket.js';
import User from '../models/User.js';

const router = Router();

// Apply admin middleware to all routes
router.use(requireAdmin);

/**
 * Get admin notifications with user details
 * GET /admin/notifications
 */
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false, type } = req.query;

    const query = {};
    if (unreadOnly === 'true') {
      query.isRead = false;
    }
    if (type) {
      query.type = type;
    }

    const notifications = await Notification.find(query)
      .populate('userId', 'name email mobile')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ ...query, isRead: false });

    ok(res, {
      notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (e) {
    console.error('Get admin notifications error:', e.message);
    next(e);
  }
});

/**
 * Mark admin notification as read
 * PUT /admin/notifications/:id/read
 */
router.put('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true, updatedAt: new Date() },
      { new: true }
    ).populate('userId', 'name email mobile');

    if (!notification) {
      return fail(res, 'NOT_FOUND', 'Notification not found', 404);
    }

    ok(res, notification, 'Notification marked as read');
  } catch (e) {
    console.error('Mark admin read error:', e.message);
    next(e);
  }
});

/**
 * Mark all admin notifications as read
 * PUT /admin/notifications/read-all
 */
router.put('/read-all', async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { isRead: false },
      { isRead: true, updatedAt: new Date() }
    );

    ok(res, { updatedCount: result.modifiedCount }, 'All notifications marked as read');
  } catch (e) {
    console.error('Mark all admin read error:', e.message);
    next(e);
  }
});

/**
 * Create notification for admin
 * POST /admin/notifications
 */
router.post('/', async (req, res, next) => {
  try {
    const schema = Joi.object({
      userId: Joi.string().required(),
      title: Joi.string().required(),
      message: Joi.string().required(),
      type: Joi.string().valid('loan', 'payment', 'kyc', 'support', 'general').default('general'),
      priority: Joi.string().valid('HIGH', 'MEDIUM', 'LOW').default('MEDIUM'),
      data: Joi.object().default({})
    });

    const payload = await schema.validateAsync(req.body);

    // Verify user exists
    const user = await User.findById(payload.userId);
    if (!user) {
      return fail(res, 'NOT_FOUND', 'User not found', 404);
    }

    const notification = await Notification.create({
      userId: payload.userId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      data: {
        ...payload.data,
        priority: payload.priority,
        adminId: req.admin.uid
      }
    });

    ok(res, notification, 'Notification created successfully');
  } catch (e) {
    console.error('Create notification error:', e.message);
    next(e);
  }
});

/**
 * Claim notification as support ticket
 * POST /admin/notifications/claim
 */
router.post('/claim', async (req, res, next) => {
  try {
    const schema = Joi.object({
      notificationId: Joi.string().required(),
      subject: Joi.string().required(),
      message: Joi.string().required(),
      userId: Joi.string().required(),
      priority: Joi.string().valid('HIGH', 'MEDIUM', 'LOW').default('MEDIUM')
    });

    const payload = await schema.validateAsync(req.body);

    // Create support ticket
    const ticket = await SupportTicket.create({
      userId: payload.userId,
      subject: payload.subject,
      message: payload.message,
      status: 'OPEN'
    });

    // Update notification status
    await Notification.findByIdAndUpdate(payload.notificationId, {
      status: 'CLAIMED',
      updatedAt: new Date()
    });

    ok(res, { ticket, notificationId: payload.notificationId }, 'Notification claimed as support ticket');
  } catch (e) {
    console.error('Claim notification error:', e.message);
    next(e);
  }
});

/**
 * Get notification statistics
 * GET /admin/notifications/stats
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await Notification.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
          byType: {
            $push: {
              type: '$type',
              isRead: '$isRead'
            }
          }
        }
      }
    ]);

    const typeStats = {};
    if (stats.length > 0) {
      const byType = stats[0].byType;
      ['loan', 'payment', 'kyc', 'support', 'general'].forEach(type => {
        const typeItems = byType.filter(item => item.type === type);
        typeStats[type] = {
          total: typeItems.length,
          unread: typeItems.filter(item => !item.isRead).length
        };
      });
    }

    ok(res, {
      total: stats[0]?.total || 0,
      unread: stats[0]?.unread || 0,
      byType: typeStats
    });
  } catch (e) {
    console.error('Get notification stats error:', e.message);
    next(e);
  }
});

/**
 * Delete admin notification
 * DELETE /admin/notifications/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);

    if (!notification) {
      return fail(res, 'NOT_FOUND', 'Notification not found', 404);
    }

    ok(res, null, 'Notification deleted');
  } catch (e) {
    console.error('Delete admin notification error:', e.message);
    next(e);
  }
});

export default router;
