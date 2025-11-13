import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';
import Notification from '../models/Notification.js';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

/**
 * Get user notifications
 * GET /notifications
 */
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const query = { userId: req.user.uid };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'name email');

    const total = await Notification.countDocuments(query);

    ok(res, {
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (e) {
    console.error('Get notifications error:', e.message);
    next(e);
  }
});

/**
 * Mark notification as read
 * PUT /notifications/:id/read
 */
router.put('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.uid },
      { isRead: true, updatedAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return fail(res, 'NOT_FOUND', 'Notification not found', 404);
    }

    ok(res, notification, 'Notification marked as read');
  } catch (e) {
    console.error('Mark read error:', e.message);
    next(e);
  }
});

/**
 * Mark all notifications as read
 * PUT /notifications/read-all
 */
router.put('/read-all', async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.uid, isRead: false },
      { isRead: true, updatedAt: new Date() }
    );

    ok(res, { updatedCount: result.modifiedCount }, 'All notifications marked as read');
  } catch (e) {
    console.error('Mark all read error:', e.message);
    next(e);
  }
});

/**
 * Get unread count
 * GET /notifications/unread-count
 */
router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user.uid,
      isRead: false,
    });

    ok(res, { count });
  } catch (e) {
    console.error('Get unread count error:', e.message);
    next(e);
  }
});

/**
 * Delete notification
 * DELETE /notifications/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.uid,
    });

    if (!notification) {
      return fail(res, 'NOT_FOUND', 'Notification not found', 404);
    }

    ok(res, null, 'Notification deleted');
  } catch (e) {
    console.error('Delete notification error:', e.message);
    next(e);
  }
});

export default router;
