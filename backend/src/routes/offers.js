import { Router } from 'express';
import Offer from '../models/Offer.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

const activeWindow = () => {
  const now = new Date();
  return {
    isActive: true,
    $and: [
      { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
      { $or: [{ endAt: null }, { endAt: { $gte: now } }] }
    ]
  };
};

router.get('/', async (req, res, next) => {
  try {
    const { placement = 'ALL', category = 'ALL', limit = 30 } = req.query;
    const query = activeWindow();
    if (category !== 'ALL') query.category = category;
    if (placement !== 'ALL') query.placement = { $in: [placement, 'ALL'] };

    const offers = await Offer.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .limit(Math.min(Number(limit) || 30, 100));
    ok(res, offers);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const offer = await Offer.findOne({ _id: req.params.id, ...activeWindow() });
    if (!offer) return fail(res, 'NOT_FOUND', 'Offer not found', 404);
    ok(res, offer);
  } catch (e) { next(e); }
});

export default router;
