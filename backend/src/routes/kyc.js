import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import User from '../models/User.js';
import { uploadMany } from '../middlewares/upload.js';
import { uploadToCloudinary } from '../services/cloudinary.js';
import { ok, fail } from '../utils/response.js';
import multer from 'multer';

// Memory storage for Cloudinary uploads
const memoryStorage = multer.memoryStorage();
const uploadManyMemory = (field='files', max=6) => multer({ storage: memoryStorage, limits:{ fileSize: 10*1024*1024 } }).array(field, max);

const router = Router();

// user add docs (form-data files[])
router.post('/me/docs', requireAuth, uploadManyMemory('files', 6), async (req,res,next)=>{
  try{
    if (!req.files || req.files.length === 0) return fail(res, 'NO_FILES', 'No files uploaded', 400);
    // Upload to Cloudinary
    const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer, 'khatupay/kyc'));
    const results = await Promise.all(uploadPromises);
    const files = results.map((result, index) => ({
      type: 'OTHER',
      url: result.secure_url,
      public_id: result.public_id,
      originalName: req.files[index].originalname
    }));

    const u = await User.findById(req.user.uid);
    if (!u) return fail(res,'NOT_FOUND','User not found',404);
    u.kyc = u.kyc || { docs: [] };
    u.kyc.docs.push(...files);
    await u.save();
    ok(res, u.kyc, 'KYC docs uploaded to Cloudinary');
  }catch(e){ next(e) }
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
    u.kyc.reviewedBy = req.user.uid;
    u.kyc.reviewedAt = new Date();
    await u.save();
    ok(res, u.kyc, 'KYC updated');
  }catch(e){ next(e) }
});

export default router;
