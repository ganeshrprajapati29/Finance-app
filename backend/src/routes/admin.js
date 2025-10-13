// ...top imports same
import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import User from '../models/User.js';
import Loan from '../models/Loan.js';
import Payment from '../models/Payment.js';
import AuditLog from '../models/AuditLog.js';
import { ok, fail } from '../utils/response.js';
import { sendFCMToToken } from '../services/fcm.js';  // ✅ New import

const router = Router();
router.use(requireAuth, requireRole(['admin']));

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
      userId: Joi.string().required(),
      title: Joi.string().required(),
      body: Joi.string().required(),
      data: Joi.object().default({}),
    }).validateAsync(req.body);

    const user = await User.findById(userId);
    if (!user || !user.fcmTokens?.length)
      return fail(res, 'NO_TOKENS', 'User has no FCM tokens', 400);

    let sent = 0;
    for (const t of user.fcmTokens) {
      const okk = await sendFCMToToken(t, { title, body }, data);
      if (okk) sent++;
    }

    ok(res, { sent, total: user.fcmTokens.length }, 'Push attempted');
  } catch (e) { next(e); }
});

export default router;
