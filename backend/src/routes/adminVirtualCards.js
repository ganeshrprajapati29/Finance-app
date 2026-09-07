import { Router } from 'express';
import Joi from 'joi';
import KhatuVirtualCard from '../models/KhatuVirtualCard.js';
import User from '../models/User.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';
import { sendEmail } from '../services/email.js';

const router = Router();
const allowedServices = ['BILLS', 'RECHARGE', 'QR', 'LOAN_EMI', 'WALLET'];

function emailTemplate(card, message) {
  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
      <h2 style="color:#0f766e;margin-bottom:8px">KhatuPay Virtual Card</h2>
      <p>${message}</p>
      <table style="border-collapse:collapse;width:100%;max-width:520px">
        <tr><td style="padding:8px;border:1px solid #e2e8f0"><b>Application No</b></td><td style="padding:8px;border:1px solid #e2e8f0">${card.applicationNo}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0"><b>Status</b></td><td style="padding:8px;border:1px solid #e2e8f0">${card.status}</td></tr>
        ${card.cardNumberMasked ? `<tr><td style="padding:8px;border:1px solid #e2e8f0"><b>Card</b></td><td style="padding:8px;border:1px solid #e2e8f0">${card.cardNumberMasked}</td></tr>` : ''}
      </table>
      <p style="font-size:12px;color:#64748b">This is a KhatuPay-only virtual service card. It is not issued by any bank or RBI network and cannot be used outside KhatuPay services.</p>
    </div>
  `;
}

async function notify(card, subject, message) {
  if (!card.email) return;
  await sendEmail(card.email, subject, emailTemplate(card, message)).catch(console.error);
}

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status = 'ALL', search = '' } = req.query;
    const query = {};
    if (status !== 'ALL') query.status = status;
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { mobile: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      query.$or = [
        { userId: { $in: users.map((user) => user._id) } },
        { applicationNo: { $regex: search, $options: 'i' } },
        { cardId: { $regex: search, $options: 'i' } },
        { cardholderName: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total, stats] = await Promise.all([
      KhatuVirtualCard.find(query).populate('userId', 'name email mobile').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      KhatuVirtualCard.countDocuments(query),
      KhatuVirtualCard.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);
    ok(res, { items, total, stats });
  } catch (e) { next(e); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const body = await Joi.object({
      userId: Joi.string().required(),
      cardholderName: Joi.string().trim().required(),
      mobile: Joi.string().trim().allow('', null),
      email: Joi.string().email().allow('', null),
      purpose: Joi.string().trim().default('KhatuPay services'),
      monthlyLimit: Joi.number().min(500).max(100000).default(10000),
      allowedServices: Joi.array().items(Joi.string().valid(...allowedServices)).default(allowedServices),
      activateNow: Joi.boolean().default(true),
      adminNote: Joi.string().allow('', null)
    }).unknown(true).validateAsync(req.body);

    const user = await User.findById(body.userId).select('name email mobile');
    if (!user) return fail(res, 'NOT_FOUND', 'User not found', 404);
    const existing = await KhatuVirtualCard.findOne({ userId: body.userId }).sort({ createdAt: -1 });
    if (existing) return fail(res, 'ALREADY_EXISTS', 'This user already has a virtual card application/card', 409);

    const card = await KhatuVirtualCard.create({
      ...body,
      email: body.email || user.email,
      mobile: body.mobile || user.mobile,
      status: body.activateNow ? 'ACTIVE' : 'APPROVED',
      issuedBy: req.admin.id,
      approvedAt: new Date()
    });
    await notify(card, 'Your KhatuPay Virtual Card is ready', 'Your KhatuPay-only virtual card has been created by the admin team.');
    ok(res.status(201), card, 'Virtual card created');
  } catch (e) { next(e); }
});

router.get('/:id', requireAdmin, async (req, res, next) => {
  try {
    const card = await KhatuVirtualCard.findById(req.params.id).populate('userId', 'name email mobile');
    if (!card) return fail(res, 'NOT_FOUND', 'Virtual card not found', 404);
    ok(res, card);
  } catch (e) { next(e); }
});

router.put('/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const body = await Joi.object({
      status: Joi.string().valid('UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'FROZEN', 'BLOCKED', 'REJECTED', 'EXPIRED').required(),
      rejectionReason: Joi.string().allow('', null),
      adminNote: Joi.string().allow('', null),
      monthlyLimit: Joi.number().min(500).max(100000).optional(),
      allowedServices: Joi.array().items(Joi.string().valid(...allowedServices)).optional()
    }).validateAsync(req.body);

    const card = await KhatuVirtualCard.findById(req.params.id);
    if (!card) return fail(res, 'NOT_FOUND', 'Virtual card not found', 404);
    card.status = body.status;
    if (body.monthlyLimit !== undefined) card.monthlyLimit = body.monthlyLimit;
    if (body.allowedServices) card.allowedServices = body.allowedServices;
    if (body.rejectionReason !== undefined) card.rejectionReason = body.rejectionReason || '';
    if (body.adminNote !== undefined) card.adminNote = body.adminNote || '';
    if (['APPROVED', 'ACTIVE'].includes(body.status) && !card.approvedAt) {
      card.approvedAt = new Date();
      card.issuedBy = req.admin.id;
    }
    if (body.status === 'BLOCKED') card.blockedAt = new Date();
    if (body.status === 'ACTIVE') card.blockedAt = undefined;
    await card.save();

    const messages = {
      ACTIVE: 'Your KhatuPay-only virtual card is now active.',
      APPROVED: 'Your KhatuPay virtual card has been approved.',
      FROZEN: 'Your KhatuPay virtual card has been frozen.',
      BLOCKED: 'Your KhatuPay virtual card has been blocked.',
      REJECTED: `Your KhatuPay virtual card request was rejected. ${card.rejectionReason || ''}`,
      UNDER_REVIEW: 'Your KhatuPay virtual card request is under review.',
      EXPIRED: 'Your KhatuPay virtual card has expired.'
    };
    await notify(card, 'KhatuPay Virtual Card status update', messages[body.status] || 'Your virtual card status has been updated.');
    ok(res, card, 'Virtual card updated');
  } catch (e) { next(e); }
});

export default router;
