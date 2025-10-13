import { Router } from 'express';
import Joi from 'joi';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';
import { sendFcmNotification } from '../services/fcm.js';

const router = Router();

/**
 * Admin Push Notification
 * Only admins can call this route.
 */
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    // Validate request body
    const { title, body, topic, token } = await Joi.object({
      title: Joi.string().required(),
      body: Joi.string().required(),
      topic: Joi.string().optional().allow(''),
      token: Joi.string().optional().allow(''),
    }).validateAsync(req.body);

    const payload = { title, body, topic, token };

    // Send via FCM
    const response = await sendFcmNotification(payload);
    ok(res, response, 'Notification pushed successfully');
  } catch (e) {
    if (e.isJoi) return fail(res, 'VALIDATION_ERROR', e.message, 400);
    console.error('Push Error:', e.message);
    next(e);
  }
});

export default router;
