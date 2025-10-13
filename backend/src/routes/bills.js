import { Router } from 'express';
import Joi from 'joi';
import Bill from '../models/Bill.js';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

router.post('/', requireAuth, async (req,res,next)=>{
  try{
    const payload = await Joi.object({
      type:Joi.string().valid('ELECTRICITY','WATER','MOBILE','DTH','RENT','OTHER').default('OTHER'),
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

router.get('/', requireAuth, async (req,res,next)=>{
  try{ const rows = await Bill.find({ userId:req.user.uid }).sort({ createdAt:-1 }); ok(res, rows); }catch(e){ next(e) }
});

router.put('/:id/pay', requireAuth, async (req,res,next)=>{
  try{
    const row = await Bill.findOne({ _id:req.params.id, userId:req.user.uid });
    if (!row) return fail(res,'NOT_FOUND','Bill not found',404);
    row.status='PAID'; row.paidAt=new Date(); await row.save();
    ok(res, row, 'Bill marked paid');
  }catch(e){ next(e) }
});

router.delete('/:id', requireAuth, async (req,res,next)=>{
  try{ await Bill.deleteOne({ _id:req.params.id, userId:req.user.uid }); ok(res, {}, 'Deleted'); }catch(e){ next(e) }
});

export default router;
