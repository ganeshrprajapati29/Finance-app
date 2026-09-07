import { Router } from 'express';
import Joi from 'joi';
import KhatuVirtualCard from '../models/KhatuVirtualCard.js';
import User from '../models/User.js';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';
import { sendEmail } from '../services/email.js';

const router = Router();

const serviceLabels = ['BILLS', 'RECHARGE', 'QR', 'LOAN_EMI', 'WALLET'];

function cardMail(card, title) {
  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
      <h2 style="color:#0f766e;margin:0 0 8px">KhatuPay Virtual Card</h2>
      <p>${title}</p>
      <p><b>Application:</b> ${card.applicationNo}</p>
      <p><b>Status:</b> ${card.status}</p>
      <p style="font-size:12px;color:#64748b">This is not a bank/RBI card. It works only inside eligible KhatuPay services.</p>
    </div>
  `;
}

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const cards = await KhatuVirtualCard.find({ userId: req.user.uid }).sort({ createdAt: -1 });
    ok(res, cards);
  } catch (e) { next(e); }
});

router.post('/apply', requireAuth, async (req, res, next) => {
  try {
    const body = await Joi.object({
      cardholderName: Joi.string().trim().required(),
      mobile: Joi.string().trim().required(),
      email: Joi.string().email().allow('', null),
      purpose: Joi.string().trim().required(),
      monthlyLimit: Joi.number().min(500).max(100000).default(10000),
      allowedServices: Joi.array().items(Joi.string().valid(...serviceLabels)).default(serviceLabels)
    }).validateAsync(req.body);

    const existing = await KhatuVirtualCard.findOne({ userId: req.user.uid }).sort({ createdAt: -1 });
    if (existing) {
      return ok(res, {
        alreadyApplied: true,
        card: existing,
        status: existing.status
      }, 'Virtual card already applied');
    }

    const user = await User.findById(req.user.uid).select('email mobile name');
    const card = await KhatuVirtualCard.create({
      userId: req.user.uid,
      ...body,
      email: body.email || user?.email,
      mobile: body.mobile || user?.mobile
    });

    if (card.email) {
      sendEmail(card.email, 'KhatuPay Virtual Card application received', cardMail(card, 'Your virtual card application has been received and is under review.')).catch(console.error);
    }

    ok(res.status(201), card, 'Virtual card application submitted');
  } catch (e) { next(e); }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const card = await KhatuVirtualCard.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!card) return fail(res, 'NOT_FOUND', 'Virtual card not found', 404);
    ok(res, card);
  } catch (e) { next(e); }
});

router.put('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const body = await Joi.object({
      action: Joi.string().valid('FREEZE', 'UNFREEZE', 'BLOCK', 'UNLOCK').required()
    }).validateAsync(req.body);

    const card = await KhatuVirtualCard.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!card) return fail(res, 'NOT_FOUND', 'Virtual card not found', 404);
    if (['APPLIED', 'UNDER_REVIEW', 'REJECTED', 'EXPIRED'].includes(card.status)) {
      return fail(res, 'INVALID_STATUS', 'This card cannot be controlled until it is active', 400);
    }

    if (body.action === 'FREEZE') {
      if (card.status !== 'ACTIVE') return fail(res, 'INVALID_STATUS', 'Only active card can be frozen', 400);
      card.status = 'FROZEN';
    } else if (body.action === 'UNFREEZE' || body.action === 'UNLOCK') {
      if (!['FROZEN', 'BLOCKED', 'APPROVED'].includes(card.status)) {
        return fail(res, 'INVALID_STATUS', 'This card cannot be unlocked right now', 400);
      }
      card.status = 'ACTIVE';
      card.blockedAt = undefined;
    } else if (body.action === 'BLOCK') {
      if (!['ACTIVE', 'FROZEN', 'APPROVED'].includes(card.status)) {
        return fail(res, 'INVALID_STATUS', 'This card cannot be blocked right now', 400);
      }
      card.status = 'BLOCKED';
      card.blockedAt = new Date();
    }

    await card.save();
    if (card.email) {
      sendEmail(
        card.email,
        'KhatuPay Virtual Card status update',
        cardMail(card, `Your virtual card status is now ${card.status}.`)
      ).catch(console.error);
    }
    ok(res, card, 'Virtual card status updated');
  } catch (e) { next(e); }
});

export default router;
