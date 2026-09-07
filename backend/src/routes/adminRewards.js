import { Router } from 'express';
import Joi from 'joi';
import RewardCampaign from '../models/RewardCampaign.js';
import RewardClaim from '../models/RewardClaim.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

const schema = Joi.object({
  title: Joi.string().trim().required(),
  subtitle: Joi.string().allow('', null),
  description: Joi.string().allow('', null),
  imageUrl: Joi.string().allow('', null),
  type: Joi.string().valid('OFFER', 'COUPON', 'CASHBACK', 'SCRATCH', 'PUZZLE', 'POINTS').default('OFFER'),
  placement: Joi.string().valid('HOME', 'REWARDS', 'BILLS', 'RECHARGE', 'PAYMENT', 'ALL').default('ALL'),
  couponCode: Joi.string().allow('', null),
  cashbackAmount: Joi.number().min(0).default(0),
  minCashback: Joi.number().min(0).default(0),
  maxCashback: Joi.number().min(0).default(0),
  points: Joi.number().min(0).default(0),
  minTxnAmount: Joi.number().min(0).default(0),
  puzzle: Joi.object({
    question: Joi.string().allow('', null),
    options: Joi.array().items(Joi.string().allow('')).default([]),
    answerIndex: Joi.number().allow(null)
  }).default({}),
  terms: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string().allow('', null)).default([]),
  usageLimit: Joi.number().min(0).default(0),
  perUserLimit: Joi.number().min(1).default(1),
  priority: Joi.number().default(0),
  isActive: Joi.boolean().default(true),
  startAt: Joi.string().allow('', null),
  endAt: Joi.string().allow('', null)
});

function normalize(body) {
  return {
    ...body,
    couponCode: body.couponCode ? String(body.couponCode).toUpperCase() : '',
    startAt: body.startAt ? new Date(body.startAt) : null,
    endAt: body.endAt ? new Date(body.endAt) : null,
    terms: Array.isArray(body.terms) ? body.terms.filter(Boolean) : String(body.terms || '').split('\n').map((x) => x.trim()).filter(Boolean)
  };
}

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status = 'ALL', type = 'ALL', search = '' } = req.query;
    const query = {};
    if (status === 'ACTIVE') query.isActive = true;
    if (status === 'INACTIVE') query.isActive = false;
    if (type !== 'ALL') query.type = type;
    if (search) query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { couponCode: { $regex: search, $options: 'i' } },
      { subtitle: { $regex: search, $options: 'i' } }
    ];
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total, claims] = await Promise.all([
      RewardCampaign.find(query).sort({ priority: -1, createdAt: -1 }).skip(skip).limit(Number(limit)),
      RewardCampaign.countDocuments(query),
      RewardClaim.countDocuments()
    ]);
    ok(res, { items, total, claims });
  } catch (e) { next(e); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const body = normalize(await schema.validateAsync(req.body));
    const item = await RewardCampaign.create({ ...body, createdBy: req.admin.id, updatedBy: req.admin.id });
    ok(res.status(201), item, 'Reward campaign created');
  } catch (e) { next(e); }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const body = normalize(await schema.validateAsync(req.body));
    const item = await RewardCampaign.findByIdAndUpdate(req.params.id, { ...body, updatedBy: req.admin.id }, { new: true });
    if (!item) return fail(res, 'NOT_FOUND', 'Reward campaign not found', 404);
    ok(res, item, 'Reward campaign updated');
  } catch (e) { next(e); }
});

router.patch('/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const { isActive } = await Joi.object({ isActive: Joi.boolean().required() }).validateAsync(req.body);
    const item = await RewardCampaign.findByIdAndUpdate(req.params.id, { isActive, updatedBy: req.admin.id }, { new: true });
    if (!item) return fail(res, 'NOT_FOUND', 'Reward campaign not found', 404);
    ok(res, item, 'Reward campaign status updated');
  } catch (e) { next(e); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const item = await RewardCampaign.findByIdAndDelete(req.params.id);
    if (!item) return fail(res, 'NOT_FOUND', 'Reward campaign not found', 404);
    ok(res, {}, 'Reward campaign deleted');
  } catch (e) { next(e); }
});

router.get('/claims/list', requireAdmin, async (_req, res, next) => {
  try {
    const claims = await RewardClaim.find()
      .populate('userId', 'name mobile email walletBalance')
      .populate('campaignId', 'title type couponCode')
      .sort({ createdAt: -1 })
      .limit(500);
    ok(res, claims);
  } catch (e) { next(e); }
});

export default router;
