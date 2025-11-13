import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';
import QRCodeModel from '../models/QRCode.js';
import QRCode from 'qrcode';
import fs from 'fs'; import path from 'path';
const router = Router();
router.post('/', requireAuth, async (req,res,next)=>{
  try{
    const { vpa, name, amount, note } = req.body;
    const pa = vpa || process.env.UPI_DEFAULT_VPA; const pn = name || process.env.UPI_PAYEE_NAME || 'Khatu Pay';
    const am = amount? `&am=${amount}` : ''; const tn = note? `&tn=${encodeURIComponent(note)}`: '';
    const uri = `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}${am}${tn}&cu=INR`;
    const dir = process.env.UPLOAD_DIR || './uploads'; if (!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
    const filename=`qr-${Date.now()}-${Math.round(Math.random()*1e9)}.png`; const filepath = path.join(dir, filename);
    await QRCode.toFile(filepath, uri, { type:'png', width:400 });
    const rec = await QRCodeModel.create({ userId:req.user.uid, payload:{ pa,pn,amount,note,uri }, imagePath: filepath });
    ok(res, { id: rec._id, imagePath: filepath, uri });
  }catch(e){ next(e) }
});
router.get('/:id', requireAuth, async (req,res,next)=>{ try{ const rec = await QRCodeModel.findById(req.params.id); if(!rec) return fail(res,'NOT_FOUND','QR not found',404); ok(res, rec); }catch(e){ next(e) } });
router.get('/history', requireAuth, async (req,res,next)=>{ try{ const recs = await QRCodeModel.find({userId:req.user.uid}).sort({createdAt:-1}).limit(50); ok(res, recs); }catch(e){ next(e) } });
export default router;
