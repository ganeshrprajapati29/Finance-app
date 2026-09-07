import { Router } from 'express';
import Joi from 'joi';
import Offer from '../models/Offer.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

const offerSchema = Joi.object({
  title: Joi.string().trim().required(),
  subtitle: Joi.string().allow('', null),
  description: Joi.string().allow('', null),
  imageUrl: Joi.string().allow('', null),
  thumbnailUrl: Joi.string().allow('', null),
  category: Joi.string().valid('GENERAL', 'LOAN', 'QR', 'BILL', 'WALLET', 'SHOPPING', 'REFERRAL').default('GENERAL'),
  placement: Joi.string().valid('HOME_BANNER', 'OFFERS_PAGE', 'POPUP', 'ALL').default('ALL'),
  ctaText: Joi.string().allow('', null).default('View Offer'),
  ctaUrl: Joi.string().allow('', null),
  deepLink: Joi.string().allow('', null),
  couponCode: Joi.string().allow('', null),
  discountText: Joi.string().allow('', null),
  priority: Joi.number().default(0),
  isActive: Joi.boolean().default(true),
  startAt: Joi.string().allow('', null),
  endAt: Joi.string().allow('', null),
  terms: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string().allow('', null)).default([])
});

function normalize(body) {
  return {
    ...body,
    startAt: body.startAt ? new Date(body.startAt) : null,
    endAt: body.endAt ? new Date(body.endAt) : null,
    terms: Array.isArray(body.terms)
      ? body.terms.filter(Boolean)
      : String(body.terms || '').split('\n').map((item) => item.trim()).filter(Boolean)
  };
}

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status = 'ALL', category = 'ALL', placement = 'ALL', search = '' } = req.query;
    const query = {};
    if (status === 'ACTIVE') query.isActive = true;
    if (status === 'INACTIVE') query.isActive = false;
    if (category !== 'ALL') query.category = category;
    if (placement !== 'ALL') query.placement = placement;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subtitle: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { couponCode: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total, active] = await Promise.all([
      Offer.find(query).sort({ priority: -1, createdAt: -1 }).skip(skip).limit(Number(limit)),
      Offer.countDocuments(query),
      Offer.countDocuments({ isActive: true })
    ]);
    ok(res, { items, total, active });
  } catch (e) { next(e); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const body = normalize(await offerSchema.validateAsync(req.body));
    const offer = await Offer.create({ ...body, createdBy: req.admin.id, updatedBy: req.admin.id });
    ok(res.status(201), offer, 'Offer created');
  } catch (e) { next(e); }
});

router.get('/:id', requireAdmin, async (req, res, next) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return fail(res, 'NOT_FOUND', 'Offer not found', 404);
    ok(res, offer);
  } catch (e) { next(e); }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const body = normalize(await offerSchema.validateAsync(req.body));
    const offer = await Offer.findByIdAndUpdate(req.params.id, { ...body, updatedBy: req.admin.id }, { new: true });
    if (!offer) return fail(res, 'NOT_FOUND', 'Offer not found', 404);
    ok(res, offer, 'Offer updated');
  } catch (e) { next(e); }
});

router.patch('/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const { isActive } = await Joi.object({ isActive: Joi.boolean().required() }).validateAsync(req.body);
    const offer = await Offer.findByIdAndUpdate(req.params.id, { isActive, updatedBy: req.admin.id }, { new: true });
    if (!offer) return fail(res, 'NOT_FOUND', 'Offer not found', 404);
    ok(res, offer, 'Offer status updated');
  } catch (e) { next(e); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) return fail(res, 'NOT_FOUND', 'Offer not found', 404);
    ok(res, {}, 'Offer deleted');
  } catch (e) { next(e); }
});

export default router;
