import { Router } from 'express';
import Joi from 'joi';
import RewardCampaign from '../models/RewardCampaign.js';
import RewardClaim from '../models/RewardClaim.js';
import User from '../models/User.js';
import { requireAuth } from '../middlewares/auth.js';
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

function rewardAmount(campaign) {
  if (campaign.type === 'SCRATCH' && campaign.maxCashback > 0) {
    const min = Number(campaign.minCashback || 0);
    const max = Number(campaign.maxCashback || 0);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  return Number(campaign.cashbackAmount || 0);
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { placement = 'ALL', type = 'ALL', limit = 50 } = req.query;
    const query = activeWindow();
    if (placement !== 'ALL') query.placement = { $in: [placement, 'ALL'] };
    if (type !== 'ALL') query.type = type;

    const [campaigns, claims] = await Promise.all([
      RewardCampaign.find(query).sort({ priority: -1, createdAt: -1 }).limit(Math.min(Number(limit) || 50, 100)),
      RewardClaim.find({ userId: req.user.uid }).select('campaignId cashbackAmount points couponCode status createdAt')
    ]);
    const claimedMap = new Map(claims.map((claim) => [String(claim.campaignId), claim]));
    ok(res, campaigns.map((campaign) => {
      const item = campaign.toObject();
      item.myClaim = claimedMap.get(String(campaign._id)) || null;
      return item;
    }));
  } catch (e) { next(e); }
});

router.get('/claims', requireAuth, async (req, res, next) => {
  try {
    const claims = await RewardClaim.find({ userId: req.user.uid })
      .populate('campaignId', 'title imageUrl type')
      .sort({ createdAt: -1 });
    ok(res, claims);
  } catch (e) { next(e); }
});

router.post('/:id/claim', requireAuth, async (req, res, next) => {
  try {
    const body = await Joi.object({
      couponCode: Joi.string().allow('', null),
      answerIndex: Joi.number().allow(null)
    }).validateAsync(req.body || {});

    const campaign = await RewardCampaign.findOne({ _id: req.params.id, ...activeWindow() });
    if (!campaign) return fail(res, 'NOT_FOUND', 'Reward campaign not found', 404);
    if (campaign.usageLimit > 0 && campaign.usedCount >= campaign.usageLimit) {
      return fail(res, 'LIMIT_OVER', 'This reward is fully claimed', 400);
    }

    const perUserCount = await RewardClaim.countDocuments({ userId: req.user.uid, campaignId: campaign._id, status: { $ne: 'FAILED' } });
    if (perUserCount >= (campaign.perUserLimit || 1)) {
      return fail(res, 'ALREADY_CLAIMED', 'Aap ye reward already claim kar chuke hain', 409);
    }

    if (campaign.type === 'COUPON' && campaign.couponCode && body.couponCode && body.couponCode.toUpperCase() !== campaign.couponCode) {
      return fail(res, 'INVALID_COUPON', 'Coupon code valid nahi hai', 400);
    }
    if (campaign.type === 'PUZZLE' && Number(campaign.puzzle?.answerIndex) !== Number(body.answerIndex)) {
      await RewardClaim.create({ userId: req.user.uid, campaignId: campaign._id, type: campaign.type, status: 'FAILED', note: 'Wrong puzzle answer' });
      return fail(res, 'WRONG_ANSWER', 'Puzzle answer galat hai. Dobara try karein.', 400);
    }

    const cashbackAmount = rewardAmount(campaign);
    const points = Number(campaign.points || 0);
    const user = await User.findById(req.user.uid).select('walletBalance');
    if (!user) return fail(res, 'NOT_FOUND', 'User not found', 404);
    if (cashbackAmount > 0) user.walletBalance = Number(user.walletBalance || 0) + cashbackAmount;
    await user.save();

    campaign.usedCount += 1;
    await campaign.save();

    const claim = await RewardClaim.create({
      userId: req.user.uid,
      campaignId: campaign._id,
      type: campaign.type,
      couponCode: campaign.couponCode,
      cashbackAmount,
      points,
      status: 'CLAIMED',
      walletBalanceAfter: user.walletBalance,
      note: cashbackAmount > 0 ? `Rs. ${cashbackAmount} cashback added to wallet` : 'Reward claimed'
    });

    ok(res, { claim, walletBalance: user.walletBalance }, 'Reward claimed successfully');
  } catch (e) { next(e); }
});

export default router;
