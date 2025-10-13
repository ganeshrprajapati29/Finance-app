import { Router } from 'express';
import Joi from 'joi';
import FAQ from '../models/FAQ.js';
import { ok, fail } from '../utils/response.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = Router();
router.get('/', async (req,res,next)=>{ try{ const list = await FAQ.find({ active:true }).sort({ order:1, createdAt:1 }); ok(res, list); }catch(e){ next(e) } });
router.post('/', requireAuth, requireRole(['admin']), async (req,res,next)=>{
  try{
    const { question, answer, category, order=0, active=true } = await Joi.object({ question:Joi.string().required(), answer:Joi.string().required(), category:Joi.string().allow('',null), order:Joi.number().default(0), active:Joi.boolean().default(true) }).validateAsync(req.body);
    const row = await FAQ.create({ question, answer, category, order, active }); ok(res, row, 'FAQ created');
  }catch(e){ next(e) }
});
router.put('/:id', requireAuth, requireRole(['admin']), async (req,res,next)=>{ try{ const row = await FAQ.findByIdAndUpdate(req.params.id, req.body, { new:true }); if(!row) return fail(res,'NOT_FOUND','FAQ not found',404); ok(res, row, 'FAQ updated'); }catch(e){ next(e) } });
router.delete('/:id', requireAuth, requireRole(['admin']), async (req,res,next)=>{ try{ await FAQ.findByIdAndDelete(req.params.id); ok(res, {}, 'FAQ deleted'); }catch(e){ next(e) } });
export default router;
