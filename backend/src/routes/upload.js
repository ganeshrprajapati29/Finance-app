import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { uploadSingle, uploadMany } from '../middlewares/upload.js';
const router = Router();
router.post('/single', requireAuth, uploadSingle('file'), (req,res)=> res.json({ success:true, data:{ url: `/uploads/${req.file.filename}` } }) );
router.post('/many', requireAuth, uploadMany('files',8), (req,res)=> res.json({ success:true, data:{ urls: (req.files||[]).map(f=>`/uploads/${f.filename}`) } }) );
export default router;
