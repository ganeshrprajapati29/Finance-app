import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';
import User from '../models/User.js';
import Loan from '../models/Loan.js';
import { normalizeAadhaarKycData } from '../utils/aadhaarKyc.js';

const router = Router();
function serializeUser(user) {
  const plain = user.toObject ? user.toObject() : user;
  const kyc = plain.kyc || {};
  if (kyc.aadhaarData || kyc.aadhaarVerification?.response) {
    kyc.aadhaarData = normalizeAadhaarKycData(
      kyc.aadhaarVerification?.response || kyc.aadhaarData?.raw || kyc.aadhaarData,
      kyc.aadhaarData
    );
  }
  return {
    id: plain._id,
    name: plain.name,
    email: plain.email,
    mobile: plain.mobile,
    upiId: plain.upiId,
    khatuUpiId: plain.khatuUpiId,
    roles: plain.roles,
    emailVerified: plain.emailVerified,
    loanLimit: plain.loanLimit,
    walletBalance: plain.walletBalance,
    kyc
  };
}

router.get('/me', requireAuth, async (req,res,next)=>{
  try{
    const u = await User.findById(req.user.uid);
    if(!u) return fail(res,'NOT_FOUND','User not found',404);
    ok(res, serializeUser(u));
  }catch(e){ next(e) }
});
router.put('/me', requireAuth, async (req,res,next)=>{
  try{
    const u = await User.findById(req.user.uid);
    if(!u) return fail(res,'NOT_FOUND','User not found',404);
    if(req.body.name) u.name=req.body.name;
    if(req.body.mobile) u.mobile=req.body.mobile;
    if(req.body.fcmToken) {
      const fcmToken = String(req.body.fcmToken || '').trim();
      if (fcmToken) {
        u.fcmTokens = Array.isArray(u.fcmTokens) ? u.fcmTokens.filter(Boolean) : [];
        u.fcmTokens = u.fcmTokens.filter(token => token !== fcmToken);
        u.fcmTokens.unshift(fcmToken);
        u.fcmTokens = u.fcmTokens.slice(0, 10);
        u.notificationsEnabled = true;
      }
    }
    if(Object.prototype.hasOwnProperty.call(req.body, 'upiId')) {
      const upiId = String(req.body.upiId || '').trim().toLowerCase();
      if (upiId && !/^[a-z0-9.\-_]{2,}@[a-z0-9.\-_]{2,}$/i.test(upiId)) {
        return fail(res,'INVALID_UPI','Please enter a valid UPI ID',400);
      }
      u.upiId = upiId;
    }
    await u.save();
    ok(res, serializeUser(u));
  }catch(e){ next(e) }
});

router.get('/me/settings', requireAuth, async (req,res,next)=>{
  try{
    const u = await User.findById(req.user.uid);
    if(!u) return fail(res,'NOT_FOUND','User not found',404);
    ok(res,{ notificationsEnabled: u.notificationsEnabled });
  }catch(e){ next(e) }
});
router.put('/me/settings', requireAuth, async (req,res,next)=>{
  try{
    const u = await User.findById(req.user.uid);
    if(!u) return fail(res,'NOT_FOUND','User not found',404);
    if(Object.prototype.hasOwnProperty.call(req.body, 'notificationsEnabled')) {
      u.notificationsEnabled = Boolean(req.body.notificationsEnabled);
    }
    await u.save();
    ok(res,{ notificationsEnabled: u.notificationsEnabled });
  }catch(e){ next(e) }
});

router.delete('/me/fcm-token', requireAuth, async (req,res,next)=>{
  try {
    const token = String(req.body?.fcmToken || '').trim();
    if (!token) return fail(res,'BAD_REQUEST','Device token is required',400);
    await User.findByIdAndUpdate(req.user.uid, { $pull: { fcmTokens: token } });
    ok(res, null, 'Device unregistered');
  } catch (e) { next(e) }
});

router.post('/resolve-upi', requireAuth, async (req,res,next)=>{
  try{
    const mobile = String(req.body.mobile || '').replace(/\D/g, '');
    if (mobile.length < 10) return fail(res,'BAD_REQUEST','Enter a valid registered mobile number',400);
    const last10 = mobile.slice(-10);
    const user = await User.findOne({
      $or: [
        { mobile },
        { mobile: last10 },
        { mobile: { $regex: `${last10}$` } }
      ]
    }).select('name mobile upiId status');
    if(!user) return fail(res,'NOT_FOUND','No KhatuPay user found with this mobile number',404);
    if(String(user._id) === String(req.user.uid)) return fail(res,'SELF_PAYMENT','You cannot send money to your own number',400);
    if(user.status !== 'active') return fail(res,'USER_BLOCKED','This receiver account is not active',400);
    if(!user.upiId) return fail(res,'UPI_NOT_SET','Receiver has not saved a UPI ID yet',400);
    ok(res,{ id:user._id, name:user.name, mobile:user.mobile, upiId:user.upiId }, 'Receiver found');
  }catch(e){ next(e) }
});
router.post('/search-loan', async (req,res,next)=>{
  try{ const { loanId, mobile } = req.body; if(!loanId || !mobile) return fail(res,'BAD_REQUEST','Loan ID and mobile are required',400); const loan = await Loan.findById(loanId).populate('userId'); if(!loan) return fail(res,'NOT_FOUND','Loan not found',404); if(loan.userId.mobile !== mobile) return fail(res,'FORBIDDEN','Mobile number does not match',403); const outstandingAmount = loan.schedule.reduce((sum, s) => sum + (s.paid ? 0 : s.total), 0); ok(res, { _id: loan._id, outstandingAmount }); }catch(e){ next(e) }
});
router.post('/search-loans', async (req,res,next)=>{
  try{ const { mobile } = req.body; if(!mobile) return fail(res,'BAD_REQUEST','Mobile number is required',400); const user = await User.findOne({ mobile }); const loans = user ? await Loan.find({ userId: user._id, status: { $in: ['DISBURSED', 'ACTIVE', 'OVERDUE'] } }) : []; const loanData = loans.map(loan => { const outstandingAmount = loan.schedule.reduce((sum, s) => sum + (s.paid ? 0 : s.total), 0); return { _id: loan._id, outstandingAmount }; }); ok(res, loanData); }catch(e){ next(e) }
});
export default router;
