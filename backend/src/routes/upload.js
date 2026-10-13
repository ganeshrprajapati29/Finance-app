import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { uploadSingle, uploadMany } from '../middlewares/upload.js';
import { uploadToCloudinary } from '../services/cloudinary.js';
import { ok, fail } from '../utils/response.js';
import multer from 'multer';
import path from 'path';
import { privateBusinessDocumentRef } from '../services/cloudinary.js';

const router = Router();

// Memory storage for Cloudinary uploads
const memoryStorage = multer.memoryStorage();
const uploadManyMemory = (field='files', max=8) => multer({ storage: memoryStorage, limits:{ fileSize: 10*1024*1024 } }).array(field, max);

// Local upload (existing)
router.post('/single', requireAuth, uploadSingle('file'), (req,res)=> res.json({ success:true, data:{ url: `/uploads/${req.file.filename}` } }) );
router.post('/many', requireAuth, uploadMany('files',8), (req,res)=> res.json({ success:true, data:{ urls: (req.files||[]).map(f=>`/uploads/${f.filename}`) } }) );

// Cloudinary upload
router.post('/cloudinary/single', requireAuth, uploadSingle('file'), async (req, res) => {
  try {
    if (!req.file) return fail(res, 'NO_FILE', 'No file uploaded', 400);
    const result = await uploadToCloudinary(req.file.buffer, 'khatupay');
    ok(res, { url: result.secure_url, public_id: result.public_id }, 'File uploaded to Cloudinary');
  } catch (e) {
    fail(res, 'UPLOAD_FAILED', e.message, 500);
  }
});

router.post('/cloudinary/business-document', requireAuth, uploadSingle('file'), async (req, res) => {
  try {
    if (!req.file) return fail(res, 'NO_FILE', 'Select a document to upload.', 400);
    const extension = path.extname(req.file.originalname || '').slice(1).toLowerCase();
    if (!['pdf', 'jpg', 'jpeg', 'png'].includes(extension)) return fail(res, 'DOCUMENT_TYPE_INVALID', 'Use a PDF, JPG, JPEG, or PNG document.', 400);
    const result = await uploadToCloudinary(req.file.buffer, 'khatupay/private-business-documents', { resource_type: 'raw', type: 'private', format: extension, use_filename: true, unique_filename: true, overwrite: false });
    ok(res, { url: privateBusinessDocumentRef(result.public_id, extension) }, 'Business document uploaded securely.');
  } catch (_) { fail(res, 'UPLOAD_FAILED', 'Business document could not be uploaded securely.', 500); }
});

router.post('/cloudinary/many', requireAuth, uploadManyMemory('files', 8), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return fail(res, 'NO_FILES', 'No files uploaded', 400);
    const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer, 'khatupay'));
    const results = await Promise.all(uploadPromises);
    const data = results.map(result => ({ url: result.secure_url, public_id: result.public_id }));
    ok(res, data, 'Files uploaded to Cloudinary');
  } catch (e) {
    fail(res, 'UPLOAD_FAILED', e.message, 500);
  }
});

export default router;
