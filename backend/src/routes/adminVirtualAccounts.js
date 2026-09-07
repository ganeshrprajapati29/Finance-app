import { Router } from 'express';
import VirtualAccount from '../models/VirtualAccount.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';
import razorpayVA from '../services/razorpayVirtualAccount.js';

const router = Router();

// Get all virtual accounts (paginated)
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status = 'ALL' } = req.query;
    const query = status === 'ALL' ? {} : { isActive: status === 'ACTIVE' };

    const virtualAccounts = await VirtualAccount.find(query)
      .populate('userId', 'name email mobile')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await VirtualAccount.countDocuments(query);

    ok(res, { items: virtualAccounts, total });
  } catch (e) { next(e); }
});

// Create virtual account for a user
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { userId, description } = req.body;

    if (!userId) return fail(res, 'MISSING_USER', 'User ID is required', 400);

    const virtualAccount = await razorpayVA.createVirtualAccount(userId, {
      description: description || `Virtual Account for User ${userId}`
    });

    ok(res, virtualAccount, 'Virtual account created successfully');
  } catch (e) { next(e); }
});

// Get virtual account details
router.get('/:id', requireAdmin, async (req, res, next) => {
  try {
    const virtualAccount = await VirtualAccount.findById(req.params.id)
      .populate('userId', 'name email mobile');

    if (!virtualAccount) return fail(res, 'NOT_FOUND', 'Virtual account not found', 404);

    ok(res, virtualAccount);
  } catch (e) { next(e); }
});

// Update virtual account
router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { description, isActive } = req.body;

    const virtualAccount = await VirtualAccount.findById(req.params.id);
    if (!virtualAccount) return fail(res, 'NOT_FOUND', 'Virtual account not found', 404);

    if (description !== undefined) virtualAccount.description = description;
    if (isActive !== undefined) virtualAccount.isActive = isActive;

    await virtualAccount.save();

    ok(res, virtualAccount, 'Virtual account updated successfully');
  } catch (e) { next(e); }
});

// Deactivate virtual account
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const virtualAccount = await VirtualAccount.findById(req.params.id);
    if (!virtualAccount) return fail(res, 'NOT_FOUND', 'Virtual account not found', 404);

    virtualAccount.isActive = false;
    await virtualAccount.save();

    ok(res, virtualAccount, 'Virtual account deactivated successfully');
  } catch (e) { next(e); }
});

export default router;
