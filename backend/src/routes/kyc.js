import { Router } from 'express';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import User from '../models/User.js';
import { uploadMany } from '../middlewares/upload.js';
import { uploadToCloudinary } from '../services/cloudinary.js';
import { ok, fail } from '../utils/response.js';
import { notifyUserSmart } from '../services/smartNotifications.js';
import { sendAadhaarOtp, verifyAadhaarOtp, verifyPan } from '../services/clubapiUtility.js';
import { normalizeAadhaarKycData } from '../utils/aadhaarKyc.js';
import multer from 'multer';

// Memory storage for Cloudinary uploads
const memoryStorage = multer.memoryStorage();
const uploadManyMemory = (field='files', max=6) => multer({ storage: memoryStorage, limits:{ fileSize: 10*1024*1024 } }).array(field, max);

const router = Router();

// Aadhaar OTP is identity-verification-grade; cap attempts even though the
// route already requires a logged-in session (security audit finding 5.4).
// See auth.js for why `validate` is relaxed here - avoids the same
// trust-proxy crash that previously broke rate-limited auth routes.
const aadhaarOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
  handler: (req, res) => fail(res, 'TOO_MANY_REQUESTS', 'Too many attempts. Please try again later.', 429),
});

const docTypeMap = {
  AADHAAR: 'aadhaarNumber',
  PAN: 'panNumber'
};

function generateKycNumber(user) {
  const date = new Date();
  const y = String(date.getFullYear()).slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const userPart = String(user._id).slice(-6).toUpperCase();
  const mobilePart = String(user.mobile || '').replace(/\D/g, '').slice(-4).padStart(4, '0');
  return `KYC-KP-${y}${m}-${mobilePart}-${userPart}`;
}

function applyKycReviewState(user, reviewerId, notes = '') {
  const docs = user.kyc?.docs || [];
  if (docs.length && docs.every(doc => doc.status === 'APPROVED')) {
    user.kyc.status = 'APPROVED';
    user.kyc.kycNumber = user.kyc.kycNumber || generateKycNumber(user);
    user.kyc.approvedAt = user.kyc.approvedAt || new Date();
    user.kyc.rejectionReason = undefined;
  } else if (docs.some(doc => doc.status === 'REJECTED')) {
    user.kyc.status = 'REJECTED';
    user.kyc.rejectionReason = notes || user.kyc.rejectionReason || 'Document verification failed';
    user.kyc.approvedAt = undefined;
  } else {
    user.kyc.status = 'SUBMITTED';
    user.kyc.rejectionReason = undefined;
  }
  user.kyc.reviewedBy = reviewerId;
  user.kyc.reviewedAt = new Date();
}

function aadhaarOtpSession(result) {
  return result?.otpSessionId ||
    result?.sessionId ||
    result?.aadhaarData?.otpSessionId ||
    result?.data?.otpSessionId ||
    result?.data?.sessionId ||
    result?.aadhaarOfflineKyc?.otpSessionId ||
    '';
}

function isClubSuccess(result) {
  const status = String(result?.status || '').toUpperCase();
  const text = String(result?.resText || result?.message || '').toLowerCase();
  return status === 'SUCCESS' || text.includes('success') || Boolean(result?.aadhaarData || result?.data);
}

function panKycData(result) {
  const data = result?.panData || result?.data || result?.panDetails || {};
  const name = [
    data.firstName,
    data.middleName,
    data.lastName
  ]
    .filter((part) => part !== undefined && part !== null && String(part).trim())
    .map((part) => String(part).trim())
    .join(' ');
  return {
    pan: data.pan || data.panNumber || result?.pan || '',
    name: data.name || data.fullName || data.panName || result?.name || result?.panName || name,
    firstName: data.firstName || '',
    middleName: data.middleName || '',
    lastName: data.lastName || '',
    aadhaarSeedingStatus: data.aadhaarSeedingStatus || data.aadhaarLinked || '',
    raw: result
  };
}

// user add docs (form-data files[] + documentType/documentNumber)
router.post('/me/docs', requireAuth, uploadManyMemory('files', 6), async (req,res,next)=>{
  try{
    if (!req.files || req.files.length === 0) return fail(res, 'NO_FILES', 'No files uploaded', 400);
    const { documentType = 'OTHER', documentNumber = '' } = await Joi.object({
      documentType: Joi.string().valid('AADHAAR', 'PAN', 'VOTER_ID', 'DRIVING_LICENSE', 'PASSPORT', 'SELFIE', 'BANK_STATEMENT', 'OTHER').default('OTHER'),
      documentNumber: Joi.string().trim().max(40).allow('', null).default('')
    }).validateAsync(req.body);

    // Upload to Cloudinary
    const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer, 'khatupay/kyc'));
    const results = await Promise.all(uploadPromises);
    const files = results.map((result, index) => ({
      type: documentType,
      documentType,
      documentNumber,
      url: result.secure_url,
      public_id: result.public_id,
      publicId: result.public_id,
      originalName: req.files[index].originalname
    }));

    const u = await User.findById(req.user.uid);
    if (!u) return fail(res,'NOT_FOUND','User not found',404);
    u.kyc = u.kyc || { docs: [], documents: [] };
    u.kyc.status = 'SUBMITTED';
    u.kyc.kycNumber = undefined;
    u.kyc.approvedAt = undefined;
    u.kyc.rejectionReason = undefined;
    u.kyc.documentType = documentType;
    u.kyc.documentNumber = documentNumber;
    u.kyc.submittedAt = new Date();
    const field = docTypeMap[documentType];
    if (field && documentNumber) u.kyc[field] = documentNumber;
    u.kyc.docs.push(...files);
    u.kyc.documents = u.kyc.docs;
    await u.save();
    await notifyUserSmart(req.user.uid, 'kyc_submitted', {
      data: {
        documentType,
      },
    });
    ok(res, u.kyc, 'KYC docs uploaded to Cloudinary');
  }catch(e){ next(e) }
});

router.post('/me/aadhaar/send-otp', requireAuth, aadhaarOtpLimiter, async (req, res, next) => {
  try {
    const payload = await Joi.object({
      aadhaarNumber: Joi.string().pattern(/^\d{12}$/).required(),
      aadhaarMobile: Joi.string().pattern(/^\d{10}$/).allow('', null)
    }).validateAsync(req.body);

    const result = await sendAadhaarOtp(payload);
    const u = await User.findById(req.user.uid);
    if (!u) return fail(res, 'NOT_FOUND', 'User not found', 404);
    u.kyc = u.kyc || { docs: [], documents: [] };
    u.kyc.aadhaarNumber = payload.aadhaarNumber;
    u.kyc.aadhaarMobile = payload.aadhaarMobile;
    u.kyc.aadhaarOtp = {
      status: result?.aadhaarData?.otpStatus || result?.status,
      orderId: result?.orderId,
      otpSessionId: aadhaarOtpSession(result),
      sentAt: new Date()
    };
    await u.save();
    ok(res, { ...result, otpSessionId: u.kyc.aadhaarOtp.otpSessionId }, 'Aadhaar OTP sent');
  } catch (e) { next(e); }
});

router.post('/me/aadhaar/verify-otp', requireAuth, aadhaarOtpLimiter, async (req, res, next) => {
  try {
    const payload = await Joi.object({
      aadhaarNumber: Joi.string().pattern(/^\d{12}$/).required(),
      aadhaarMobile: Joi.string().pattern(/^\d{10}$/).allow('', null),
      otp: Joi.string().min(4).max(8).required(),
      otpSessionId: Joi.string().allow('', null)
    }).validateAsync(req.body);

    const u = await User.findById(req.user.uid);
    if (!u) return fail(res, 'NOT_FOUND', 'User not found', 404);
    const otpSessionId = payload.otpSessionId || u.kyc?.aadhaarOtp?.otpSessionId;
    const result = await verifyAadhaarOtp({ ...payload, otpSessionId });
    const verified = isClubSuccess(result);
    const aadhaarData = normalizeAadhaarKycData(result);
    u.kyc = u.kyc || { docs: [], documents: [] };
    u.kyc.aadhaarNumber = payload.aadhaarNumber;
    u.kyc.aadhaarMobile = payload.aadhaarMobile || u.kyc.aadhaarMobile;
    u.kyc.documentType = 'AADHAAR';
    u.kyc.documentNumber = payload.aadhaarNumber;
    u.kyc.aadhaarVerified = verified;
    u.kyc.aadhaarData = aadhaarData;
    u.kyc.aadhaarVerification = {
      status: result?.status,
      orderId: result?.orderId,
      otpSessionId,
      mobileMatched: aadhaarData.mobileMatched,
      verifiedAt: new Date(),
      response: result
    };
    if (verified && u.kyc.status === 'PENDING') {
      u.kyc.status = 'SUBMITTED';
      u.kyc.submittedAt = new Date();
    }
    await u.save();
    ok(res, { verified, aadhaarData, response: result }, 'Aadhaar OTP verified');
  } catch (e) { next(e); }
});

router.post('/me/pan/verify', requireAuth, async (req, res, next) => {
  try {
    const { pan } = await Joi.object({
      pan: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/i).required()
    }).validateAsync(req.body);

    const result = await verifyPan({ pan });
    const verified = isClubSuccess(result);
    const panData = panKycData(result);
    const u = await User.findById(req.user.uid);
    if (!u) return fail(res, 'NOT_FOUND', 'User not found', 404);
    u.kyc = u.kyc || { docs: [], documents: [] };
    u.kyc.panNumber = pan.toUpperCase();
    u.kyc.documentType = 'PAN';
    u.kyc.documentNumber = pan.toUpperCase();
    u.kyc.panVerified = verified;
    u.kyc.panName = panData.name;
    u.kyc.panData = panData;
    u.kyc.panVerification = {
      status: result?.status,
      orderId: result?.orderId,
      panData,
      verifiedAt: new Date(),
      response: result
    };
    if (verified && u.kyc.status === 'PENDING') {
      u.kyc.status = 'SUBMITTED';
      u.kyc.submittedAt = new Date();
    }
    await u.save();
    ok(res, { verified, panData, response: result }, 'PAN verified');
  } catch (e) { next(e); }
});

// admin review/approve
router.put('/users/:id/review', requireAuth, requireRole(['admin','reviewer']), async (req,res,next)=>{
  try{
    const { docIndex, status='APPROVED', notes='' } = await Joi.object({
      docIndex: Joi.number().required(),
      status: Joi.string().valid('PENDING','APPROVED','REJECTED').required(),
      notes: Joi.string().allow('',null)
    }).validateAsync(req.body);

    const u = await User.findById(req.params.id);
    if (!u) return fail(res,'NOT_FOUND','User not found',404);
    if (!u.kyc?.docs?.[docIndex]) return fail(res,'NOT_FOUND','Doc not found',404);

    u.kyc.docs[docIndex].status = status;
    u.kyc.docs[docIndex].notes = notes;
    u.kyc.documents = u.kyc.docs;
    applyKycReviewState(u, req.user.uid, notes);
    await u.save();
    const event = u.kyc.status === 'APPROVED'
      ? 'kyc_approved'
      : u.kyc.status === 'REJECTED'
        ? 'kyc_rejected'
        : 'kyc_submitted';
    await notifyUserSmart(u._id, event, {
      notes,
      data: {
        documentStatus: status,
        docIndex,
        kycNumber: u.kyc.kycNumber,
      },
    });
    ok(res, u.kyc, 'KYC updated');
  }catch(e){ next(e) }
});

router.put('/users/:id/review-all', requireAuth, requireRole(['admin','reviewer']), async (req,res,next)=>{
  try{
    const { status='APPROVED', notes='' } = await Joi.object({
      status: Joi.string().valid('APPROVED','REJECTED').required(),
      notes: Joi.string().allow('',null)
    }).validateAsync(req.body);

    const u = await User.findById(req.params.id);
    if (!u) return fail(res,'NOT_FOUND','User not found',404);
    if (!u.kyc?.docs?.length) return fail(res,'NO_DOCS','No KYC documents found',404);

    u.kyc.docs = u.kyc.docs.map(doc => {
      doc.status = status;
      doc.notes = notes;
      return doc;
    });
    u.kyc.documents = u.kyc.docs;
    applyKycReviewState(u, req.user.uid, notes);
    await u.save();

    await notifyUserSmart(u._id, status === 'APPROVED' ? 'kyc_approved' : 'kyc_rejected', {
      notes,
      data: {
        documentStatus: status,
        kycNumber: u.kyc.kycNumber,
      },
    });
    ok(res, u.kyc, status === 'APPROVED' ? 'KYC approved' : 'KYC rejected');
  }catch(e){ next(e) }
});

export default router;
