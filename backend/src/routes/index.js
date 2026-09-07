import { Router } from 'express';
import User from '../models/User.js';
import Loan from '../models/Loan.js';
import Payment from '../models/Payment.js';
import { ok } from '../utils/response.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();

router.get('/health', (req,res)=> ok(res, { status:'ok', time:new Date().toISOString() }));

router.get('/public/overview', async (req, res, next) => {
  try {
    ok(res, {
      status: 'online',
      updatedAt: new Date().toISOString(),
      highlights: [
        { label: 'API status', value: 'Online' },
        { label: 'Recharge & Bills', value: 'Available' },
        { label: 'QR support', value: 'Enabled' },
        { label: 'Loan assistance', value: 'Partner based' },
        { label: 'Customer portal', value: 'Enabled' },
        { label: 'Service status', value: 'Online' },
      ],
      services: [
        { key: 'mobile-recharge', label: 'Mobile Recharge', status: 'live' },
        { key: 'dth-recharge', label: 'DTH Recharge', status: 'live' },
        { key: 'bbps-bills', label: 'Bill Payments', status: 'live' },
        { key: 'qr-payments', label: 'QR Support', status: 'live' },
        { key: 'partner-loan-assistance', label: 'Partner Loan Assistance', status: 'partner_service' },
        { key: 'service-requests', label: 'Service Requests', status: 'available' },
        { key: 'utility-bills', label: 'Utility Bill Payments', status: 'coming_soon' },
        { key: 'business-tools', label: 'Business Tools', status: 'coming_soon' },
      ],
    });
  } catch (e) {
    next(e);
  }
});

router.post('/public/contact', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const message = String(req.body?.message || '').trim();

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'Name, email and message are required' });
  }

  ok(res, {
    received: true,
    reference: `KP-${Date.now()}`,
  }, 'Message received');
});

router.get('/admin/metrics', requireAuth, requireRole(['admin']), async (req,res,next)=>{
  try{
    const users = await User.countDocuments();
    const loans = await Loan.countDocuments();
    const pending = await Loan.countDocuments({ status:'PENDING' });
    const approved = await Loan.countDocuments({ status:'APPROVED' });
    const disbursed = await Loan.countDocuments({ status:'DISBURSED' });
    const closed = await Loan.countDocuments({ status:'CLOSED' });
    const totalReceivedAgg = await Payment.aggregate([{ $match:{ status:'CONFIRMED' } }, { $group:{ _id:null, sum:{ $sum:'$amount' } } }]);
    const totalReceived = totalReceivedAgg[0]?.sum || 0;
    ok(res, { users, loans, pending, approved, disbursed, closed, totalReceived });
  }catch(e){ next(e) }
});

router.get('/admin/metrics/timeseries', requireAuth, requireRole(['admin']), async (req,res,next)=>{
  try{
    const days = parseInt(req.query.days || '30', 10);
    const since = new Date(); since.setDate(since.getDate()-days+1);
    function emptySeries(){ const map={}; for(let i=0;i<days;i++){ const d=new Date(since); d.setDate(since.getDate()+i); const key=d.toISOString().slice(0,10); map[key]=0; } return map; }
    const usersMap = emptySeries(); const loansMap = emptySeries(); const paymentsMap = emptySeries();
    const users = await User.aggregate([{ $match:{ createdAt:{ $gte: since } } }, { $group:{ _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$createdAt' } }, c:{ $sum:1 } } }]);
    users.forEach(r=>{ usersMap[r._id]=r.c; });
    const loans = await Loan.aggregate([{ $match:{ updatedAt:{ $gte: since }, status:'APPROVED' } }, { $group:{ _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$updatedAt' } }, c:{ $sum:1 } } }]);
    loans.forEach(r=>{ loansMap[r._id]=r.c; });
    const pays = await Payment.aggregate([{ $match:{ updatedAt:{ $gte: since }, status:'CONFIRMED' } }, { $group:{ _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$updatedAt' } }, sum:{ $sum:'$amount' } } }]);
    pays.forEach(r=>{ paymentsMap[r._id]=r.sum; });
    const labels = Object.keys(usersMap);
    const data = labels.map(d=>({ date:d, newUsers: usersMap[d]||0, approvedLoans: loansMap[d]||0, receivedAmount: paymentsMap[d]||0 }));
    ok(res, data);
  }catch(e){ next(e) }
});

export default router;
