import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';
import User from '../models/User.js';
import Loan from '../models/Loan.js';

const router = Router();
router.get('/me', requireAuth, async (req,res,next)=>{
  try{ const u = await User.findById(req.user.uid); if(!u) return fail(res,'NOT_FOUND','User not found',404); ok(res,{ id:u._id, name:u.name, email:u.email, mobile:u.mobile, roles:u.roles, emailVerified:u.emailVerified, loanLimit:u.loanLimit, kyc:u.kyc }); }catch(e){ next(e) }
});
router.put('/me', requireAuth, async (req,res,next)=>{
  try{ const u = await User.findById(req.user.uid); if(!u) return fail(res,'NOT_FOUND','User not found',404); if(req.body.name) u.name=req.body.name; if(req.body.mobile) u.mobile=req.body.mobile; await u.save(); ok(res,{ id:u._id, name:u.name, email:u.email, mobile:u.mobile }); }catch(e){ next(e) }
});
router.post('/search-loan', async (req,res,next)=>{
  try{ const { loanId, mobile } = req.body; if(!loanId || !mobile) return fail(res,'BAD_REQUEST','Loan ID and mobile are required',400); const loan = await Loan.findById(loanId).populate('userId'); if(!loan) return fail(res,'NOT_FOUND','Loan not found',404); if(loan.userId.mobile !== mobile) return fail(res,'FORBIDDEN','Mobile number does not match',403); const outstandingAmount = loan.schedule.reduce((sum, s) => sum + (s.paid ? 0 : s.total), 0); ok(res, { _id: loan._id, outstandingAmount }); }catch(e){ next(e) }
});
router.post('/search-loans', async (req,res,next)=>{
  try{ const { mobile } = req.body; if(!mobile) return fail(res,'BAD_REQUEST','Mobile number is required',400); const user = await User.findOne({ mobile }); const loans = user ? await Loan.find({ userId: user._id, status: { $in: ['DISBURSED', 'ACTIVE', 'OVERDUE'] } }) : []; const loanData = loans.map(loan => { const outstandingAmount = loan.schedule.reduce((sum, s) => sum + (s.paid ? 0 : s.total), 0); return { _id: loan._id, outstandingAmount }; }); ok(res, loanData); }catch(e){ next(e) }
});
export default router;
