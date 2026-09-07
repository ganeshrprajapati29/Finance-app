import { Router } from 'express';
import QRCode from '../models/QRCode.js';
import User from '../models/User.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';
import { deleteFromCloudinary } from '../services/cloudinary.js';
import QRCodeGenerator from 'qrcode';

const router = Router();

// Get all QR codes (paginated)
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status = 'ALL', type = 'ALL', search = '' } = req.query;
    const query = {};
    if (status === 'ACTIVE') query.isActive = true;
    else if (status === 'INACTIVE') query.isActive = false;
    if (type !== 'ALL') query.type = type;
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
        { 'payload.merchantName': { $regex: search, $options: 'i' } },
        { 'payload.merchantVpa': { $regex: search, $options: 'i' } },
        { 'payload.label': { $regex: search, $options: 'i' } },
        { 'payload.qrString': { $regex: search, $options: 'i' } },
        { 'payload.pn': { $regex: search, $options: 'i' } },
        { 'payload.pa': { $regex: search, $options: 'i' } },
        { 'payload.tn': { $regex: search, $options: 'i' } },
        { 'payload.note': { $regex: search, $options: 'i' } },
        { 'payload.uri': { $regex: search, $options: 'i' } }
      ];
    }

    const qrCodes = await QRCode.find(query)
      .populate('userId', 'name email mobile')
      .populate('virtualAccountId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await QRCode.countDocuments(query);

    ok(res, { items: qrCodes, total });
  } catch (e) { next(e); }
});

// Create KhatuPay printable QR code
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const {
      userId,
      type = 'P2C',
      merchantName = 'KhatuPay',
      merchantVpa,
      amount,
      label,
      note,
      expiresAt
    } = req.body;

    if (!merchantVpa) return fail(res, 'VALIDATION_ERROR', 'Merchant UPI ID is required', 400);

    let user = null;
    if (userId) {
      user = await User.findById(userId).select('name email mobile');
      if (!user) return fail(res, 'NOT_FOUND', 'User not found', 404);
    }

    const qrId = `KPQR-${Date.now()}`;
    const params = new URLSearchParams({
      pa: merchantVpa,
      pn: merchantName || user?.name || 'KhatuPay',
      tn: note || label || 'KhatuPay Payment',
      tr: qrId,
      cu: 'INR'
    });
    if (Number(amount) > 0) params.set('am', String(Number(amount).toFixed(2)));

    const qrString = `upi://pay?${params.toString()}`;
    const imagePath = await QRCodeGenerator.toDataURL(qrString, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 720,
      color: { dark: '#111827', light: '#FFFFFF' }
    });

    const qrCode = await QRCode.create({
      userId: user?._id,
      type,
      payload: {
        qrId,
        qrString,
        merchantName: merchantName || user?.name || 'KhatuPay',
        merchantVpa,
        amount: Number(amount) > 0 ? Number(amount) : null,
        label: label || 'KhatuPay Payment QR',
        note: note || '',
        brand: 'KhatuPay',
        createdBy: req.admin?.id
      },
      imagePath,
      expiresAt: expiresAt || null,
      isActive: true
    });

    await qrCode.populate('userId', 'name email mobile');
    ok(res.status(201), qrCode, 'QR code created successfully');
  } catch (e) { next(e); }
});

// Get QR details
router.get('/:id', requireAdmin, async (req, res, next) => {
  try {
    const qrCode = await QRCode.findById(req.params.id)
      .populate('userId', 'name email mobile')
      .populate('virtualAccountId');

    if (!qrCode) return fail(res, 'NOT_FOUND', 'QR code not found', 404);

    ok(res, qrCode);
  } catch (e) { next(e); }
});

// Deactivate QR
router.put('/:id/deactivate', requireAdmin, async (req, res, next) => {
  try {
    const qrCode = await QRCode.findById(req.params.id);
    if (!qrCode) return fail(res, 'NOT_FOUND', 'QR code not found', 404);

    qrCode.isActive = false;
    await qrCode.save();

    ok(res, qrCode, 'QR code deactivated successfully');
  } catch (e) { next(e); }
});

// Delete QR (only if inactive)
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const qrCode = await QRCode.findById(req.params.id);
    if (!qrCode) return fail(res, 'NOT_FOUND', 'QR code not found', 404);

    if (qrCode.isActive) {
      return fail(res, 'CANNOT_DELETE', 'Only inactive QR codes can be deleted', 400);
    }

    // Delete from Cloudinary if publicId exists
    if (qrCode.cloudinaryPublicId) {
      try {
        await deleteFromCloudinary(qrCode.cloudinaryPublicId);
      } catch (cloudinaryError) {
        console.error('Error deleting from Cloudinary:', cloudinaryError);
        // Continue with DB deletion even if Cloudinary fails
      }
    }

    await QRCode.findByIdAndDelete(req.params.id);

    ok(res, null, 'QR code deleted successfully');
  } catch (e) { next(e); }
});

export default router;
