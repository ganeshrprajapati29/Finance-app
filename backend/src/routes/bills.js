import { Router } from 'express';
import Joi from 'joi';
import Bill from '../models/Bill.js';
import Payment from '../models/Payment.js';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';
import { ensurePaymentInvoice } from '../services/paymentInvoiceService.js';

const router = Router();

router.post('/', requireAuth, async (req,res,next)=>{
  try{
    const payload = await Joi.object({
      type:Joi.string().valid('ELECTRICITY','WATER','MOBILE','DTH','GAS','RENT','OTHER').default('OTHER'),
      provider:Joi.string().allow('',null),
      accountRef:Joi.string().allow('',null),
      amount:Joi.number().min(0).required(),
      dueDate:Joi.date().required(),
      notes:Joi.string().allow('',null)
    }).validateAsync(req.body);
    const row = await Bill.create({ ...payload, userId:req.user.uid });
    ok(res, row, 'Bill added');
  }catch(e){ next(e) }
});

router.post('/fetch', requireAuth, async (req,res,next)=>{
  try{
    const { type, provider, accountRef, customerMobile, opvalue1, opvalue2, opvalue3, opvalue4, opvalue5 } = await Joi.object({
      type:Joi.string().valid('ELECTRICITY','WATER','MOBILE','DTH','GAS').required(),
      provider:Joi.string().required(),
      accountRef:Joi.string().required(),
      customerMobile:Joi.string().allow('', null),
      opvalue1:Joi.string().allow('', null),
      opvalue2:Joi.string().allow('', null),
      opvalue3:Joi.string().allow('', null),
      opvalue4:Joi.string().allow('', null),
      opvalue5:Joi.string().allow('', null)
    }).validateAsync(req.body);
    const { bbpsFetchBill } = await import('../services/bbps.js');
    const billData = await bbpsFetchBill({ provider, accountRef, billType: type, customerMobile, opvalue1, opvalue2, opvalue3, opvalue4, opvalue5 });
    ok(res, billData, 'Bill fetched');
  }catch(e){ next(e) }
});

router.post('/pay', requireAuth, async (req,res,next)=>{
  try{
    const { billId, amount, bbpsId, customerMobile, opvalue1, opvalue2, opvalue3, opvalue4, opvalue5 } = await Joi.object({
      billId:Joi.string().required(),
      amount:Joi.number().min(0).required(),
      bbpsId:Joi.string().optional(),
      customerMobile:Joi.string().allow('', null),
      opvalue1:Joi.string().allow('', null),
      opvalue2:Joi.string().allow('', null),
      opvalue3:Joi.string().allow('', null),
      opvalue4:Joi.string().allow('', null),
      opvalue5:Joi.string().allow('', null)
    }).validateAsync(req.body);
    const bill = await Bill.findOne({ _id:billId, userId:req.user.uid });
    if (!bill) return fail(res,'NOT_FOUND','Bill not found',404);
    const { bbpsPay } = await import('../services/bbps.js');
    const payResult = await bbpsPay({ provider:bill.provider, accountRef:bill.accountRef, billType:bill.type, amount, billNumber:bill.accountRef, bbpsId, customerMobile, opvalue1, opvalue2, opvalue3, opvalue4, opvalue5 });
    bill.status = 'PAID';
    bill.paidAt = new Date();
    await bill.save();
    const payment = await Payment.create({
      userId: req.user.uid,
      billId: bill._id,
      type: 'BILL',
      amount,
      method: 'OTHER',
      reference: payResult?.transactionId || payResult?.reference || `BILL-${Date.now()}`,
      status: 'CONFIRMED',
      metadata: { notes: `Bill payment for ${bill.provider || bill.type}`, paymentDate: new Date() }
    });
    await ensurePaymentInvoice(payment);
    ok(res, { bill, payment, gateway: payResult }, 'Bill payment successful');
  }catch(e){ next(e) }
});

router.get('/', requireAuth, async (req,res,next)=>{
  try{ const rows = await Bill.find({ userId:req.user.uid }).sort({ createdAt:-1 }); ok(res, rows); }catch(e){ next(e) }
});

router.put('/:id/pay', requireAuth, async (req,res,next)=>{
  try{
    const row = await Bill.findOne({ _id:req.params.id, userId:req.user.uid });
    if (!row) return fail(res,'NOT_FOUND','Bill not found',404);
    row.status='PAID'; row.paidAt=new Date(); await row.save();
    const payment = await Payment.create({
      userId: req.user.uid,
      billId: row._id,
      type: 'BILL',
      amount: row.amount || 0,
      method: 'OTHER',
      reference: `BILL-MARK-${Date.now()}`,
      status: 'CONFIRMED',
      metadata: { notes: `Bill marked paid for ${row.provider || row.type}`, paymentDate: new Date() }
    });
    await ensurePaymentInvoice(payment);
    ok(res, { bill: row, payment }, 'Bill marked paid');
  }catch(e){ next(e) }
});

router.delete('/:id', requireAuth, async (req,res,next)=>{
  try{ await Bill.deleteOne({ _id:req.params.id, userId:req.user.uid }); ok(res, {}, 'Deleted'); }catch(e){ next(e) }
});

export default router;
