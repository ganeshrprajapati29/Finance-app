import { Router } from 'express';
import Joi from 'joi';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';
import { sendFcmNotification, sendFCMToToken } from '../services/fcm.js';
import User from '../models/User.js';

const router = Router();

/**
 * Admin Push Notification
 * Only admins can call this route.
 */
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    // Validate request body
    const { title, body, topic, token, userId } = await Joi.object({
      title: Joi.string().required(),
      body: Joi.string().required(),
      topic: Joi.string().optional().allow(''),
      token: Joi.string().optional().allow(''),
      userId: Joi.string().optional().allow(''),
    }).validateAsync(req.body);

    if (userId) {
      // Send to specific user
      const user = await User.findById(userId);
      if (!user) return fail(res, 'USER_NOT_FOUND', 'User not found', 404);
      if (!user.fcmTokens || user.fcmTokens.length === 0)
        return fail(res, 'NO_TOKENS', 'User has no FCM tokens', 400);

      let sent = 0;
      for (const t of user.fcmTokens) {
        const success = await sendFCMToToken(t, { title, body });
        if (success) sent++;
      }
      ok(res, { sent, total: user.fcmTokens.length }, 'Notification pushed to user');
    } else {
      // Send via topic or token
      const payload = { title, body, topic, token };
      const response = await sendFcmNotification(payload);
      ok(res, response, 'Notification pushed successfully');
    }
  } catch (e) {
    if (e.isJoi) return fail(res, 'VALIDATION_ERROR', e.message, 400);
    console.error('Push Error:', e.message);
    next(e);
  }
});

export default router;
