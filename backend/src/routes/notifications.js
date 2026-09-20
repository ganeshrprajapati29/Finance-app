import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { notifyUserSmart } from '../services/smartNotifications.js';
import { runSmartNotificationScan, unreadSummary } from '../services/autoNotificationService.js';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

router.post('/test-push', async (req, res, next) => {
  try {
    const fcmToken = String(req.body.fcmToken || '').trim();
    if (fcmToken) {
      await User.findByIdAndUpdate(req.user.uid, {
        $addToSet: { fcmTokens: fcmToken },
        notificationsEnabled: true,
      });
    }

    const notification = await notifyUserSmart(req.user.uid, 'push_test', {
      data: { route: '/notifications' },
    });

    ok(res, { notification, tokenSaved: Boolean(fcmToken) }, 'Test notification sent');
  } catch (e) {
    console.error('Test push error:', e.message);
    next(e);
  }
});

router.post('/generate-smart', async (req, res, next) => {
  try {
    const result = await runSmartNotificationScan({
      userId: req.user.uid,
      dryRun: req.body?.dryRun === true,
      limit: 1,
    });
    ok(res, result, 'Smart notifications generated');
  } catch (e) {
    console.error('Generate smart notifications error:', e.message);
    next(e);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    ok(res, await unreadSummary(req.user.uid));
  } catch (e) {
    next(e);
  }
});

/**
 * Get user notifications
 * GET /notifications
 */
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false, category } = req.query;

    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));

    const query = { userId: req.user.uid };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }
    if (category && category !== 'all') {
      query.$or = [{ category: String(category).toLowerCase() }, { type: String(category).toLowerCase() }];
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .skip((safePage - 1) * safeLimit)
      .lean();

    const total = await Notification.countDocuments(query);

    ok(res, {
      notifications,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit),
        hasMore: safePage * safeLimit < total,
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
      { isRead: true, readAt: new Date(), updatedAt: new Date() },
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
      { isRead: true, readAt: new Date(), updatedAt: new Date() }
    );

    ok(res, { updatedCount: result.modifiedCount }, 'All notifications marked as read');
  } catch (e) {
    console.error('Mark all read error:', e.message);
    next(e);
  }
});

router.put('/:id/unread', async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.uid },
      { $set: { isRead: false, updatedAt: new Date() }, $unset: { readAt: 1 } },
      { new: true }
    );
    if (!notification) return fail(res, 'NOT_FOUND', 'Notification not found', 404);
    ok(res, notification, 'Notification marked as unread');
  } catch (e) {
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
