import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';
import QRCodeModel from '../models/QRCode.js';
import VirtualAccount from '../models/VirtualAccount.js';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import razorpayVA from '../services/razorpayVirtualAccount.js';
import { uploadToCloudinary } from '../services/cloudinary.js';
import { ensureUserPaymentQr } from '../services/qrAuto.js';

const router = Router();

// Get or create the user's automatic KhatuPay QR
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const rec = await ensureUserPaymentQr(req.user.uid);
    await rec.populate('virtualAccountId');
    ok(res, rec, 'KhatuPay QR ready');
  } catch (e) { next(e); }
});

// Backward-compatible endpoint: return the automatic QR instead of creating manual QR variants.
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const rec = await ensureUserPaymentQr(req.user.uid);
    await rec.populate('virtualAccountId');
    ok(res, rec, 'KhatuPay QR ready');
  } catch (e) { next(e); }
});

// Generate P2C dynamic QR using virtual account
router.post('/p2c', requireAuth, async (req, res, next) => {
  try {
    const { amount, description, expiresIn = 3600 } = req.body; // expiresIn in seconds

    if (!amount || amount <= 0) return fail(res, 'INVALID_AMOUNT', 'Amount is required and must be positive', 400);

    // Get or create virtual account for user
    let virtualAccount = await VirtualAccount.findOne({ userId: req.user.uid, isActive: true });

    if (!virtualAccount) {
      virtualAccount = await razorpayVA.createVirtualAccount(req.user.uid, {
        description: `Virtual Account for ${req.user.name}`
      });
    }

    // Get VPA from virtual account receivers
    const vpaReceiver = virtualAccount.receivers?.vpa?.[0];
    if (!vpaReceiver) return fail(res, 'NO_VPA', 'No VPA available for virtual account', 400);

    const pa = vpaReceiver.address;
    const pn = virtualAccount.name || req.user.name || 'Khatu Pay Merchant';
    const am = `&am=${amount}`;
    const tn = description ? `&tn=${encodeURIComponent(description)}` : '';
    const uri = `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}${am}${tn}&cu=INR`;

    const dir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `p2c-qr-${Date.now()}-${Math.round(Math.random() * 1e9)}.png`;
    const filepath = path.join(dir, filename);

    await QRCode.toFile(filepath, uri, { type: 'png', width: 400 });

    const expiresAt = new Date(Date.now() + (expiresIn * 1000));

    // Upload to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(filepath, 'qr-codes');

    const rec = await QRCodeModel.create({
      userId: req.user.uid,
      type: 'P2C',
      virtualAccountId: virtualAccount._id,
      payload: { pa, pn, amount, note: description, uri },
      imagePath: cloudinaryResult.url,
      cloudinaryPublicId: cloudinaryResult.public_id,
      expiresAt,
      isActive: true
    });

    ok(res, {
      id: rec._id,
      imagePath: cloudinaryResult.url,
      uri,
      virtualAccountId: virtualAccount._id,
      expiresAt: expiresAt.toISOString()
    });
  } catch (e) { next(e); }
});

// Get QR history
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    await ensureUserPaymentQr(req.user.uid);
    const recs = await QRCodeModel.find({ userId: req.user.uid })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('virtualAccountId');
    ok(res, recs);
  } catch (e) { next(e); }
});

// Get QR details
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const rec = await QRCodeModel.findById(req.params.id).populate('virtualAccountId');
    if (!rec) return fail(res, 'NOT_FOUND', 'QR not found', 404);

    // Check if user owns this QR
    if (rec.userId.toString() !== req.user.uid) return fail(res, 'UNAUTHORIZED', 'Access denied', 403);

    ok(res, rec);
  } catch (e) { next(e); }
});

// Deactivate QR
router.put('/:id/deactivate', requireAuth, async (req, res, next) => {
  try {
    const rec = await QRCodeModel.findById(req.params.id);
    if (!rec) return fail(res, 'NOT_FOUND', 'QR not found', 404);

    if (rec.userId.toString() !== req.user.uid) return fail(res, 'UNAUTHORIZED', 'Access denied', 403);

    rec.isActive = false;
    await rec.save();

    ok(res, rec, 'QR deactivated');
  } catch (e) { next(e); }
});

// Delete inactive QR
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const rec = await QRCodeModel.findById(req.params.id);
    if (!rec) return fail(res, 'NOT_FOUND', 'QR not found', 404);

    if (rec.userId.toString() !== req.user.uid) return fail(res, 'UNAUTHORIZED', 'Access denied', 403);
    if (rec.isActive) return fail(res, 'CANNOT_DELETE', 'Only inactive QR codes can be deleted', 400);

    await QRCodeModel.findByIdAndDelete(req.params.id);
    ok(res, null, 'QR deleted');
  } catch (e) { next(e); }
});

export default router;
