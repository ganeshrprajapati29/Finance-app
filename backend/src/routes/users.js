import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';
import User from '../models/User.js';

const router = Router();
router.get('/me', requireAuth, async (req,res,next)=>{
  try{ const u = await User.findById(req.user.uid); if(!u) return fail(res,'NOT_FOUND','User not found',404); ok(res,{ id:u._id, name:u.name, email:u.email, mobile:u.mobile, roles:u.roles, emailVerified:u.emailVerified, loanLimit:u.loanLimit, kyc:u.kyc }); }catch(e){ next(e) }
});
router.put('/me', requireAuth, async (req,res,next)=>{
  try{ const u = await User.findById(req.user.uid); if(!u) return fail(res,'NOT_FOUND','User not found',404); if(req.body.name) u.name=req.body.name; if(req.body.mobile) u.mobile=req.body.mobile; await u.save(); ok(res,{ id:u._id, name:u.name, email:u.email, mobile:u.mobile }); }catch(e){ next(e) }
});
export default router;
