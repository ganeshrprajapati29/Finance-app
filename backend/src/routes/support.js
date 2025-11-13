import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import Ticket from '../models/SupportTicket.js';
import { ok, fail } from '../utils/response.js';
import { sendFCMToToken } from '../services/fcm.js';

const router = Router();

// user create ticket
router.post('/', requireAuth, async (req,res,next)=>{
  try{
    const { subject, message } = await Joi.object({
      subject: Joi.string().required(),
      message: Joi.string().required()
    }).validateAsync(req.body);
    const t = await Ticket.create({ userId: req.user.uid, subject, message });

    // Notify admin via FCM if enabled
    const settings = await require('../models/Settings.js').findOne();
    if (settings && settings.fcmEnabled) {
      // Send notification to admin (assuming admin has FCM token stored)
      // For now, we can send a general notification or to a specific admin token
      // This is a placeholder; in a real app, you'd have admin FCM tokens
      console.log('New support ticket created:', t.subject);
    }

    ok(res, t, 'Ticket created');
  }catch(e){ next(e) }
});

// user list own tickets
router.get('/me', requireAuth, async (req,res,next)=>{
  try{ ok(res, await Ticket.find({ userId: req.user.uid }).sort({ createdAt:-1 })); }catch(e){ next(e) }
});

// admin manage
router.get('/', requireAuth, requireRole(['admin']), async (req,res,next)=>{
  try{ ok(res, await Ticket.find().populate('userId', 'name email').sort({ createdAt:-1 })); }catch(e){ next(e) }
});
router.put('/:id', requireAuth, requireRole(['admin']), async (req,res,next)=>{
  try{
    const { status, adminNotes } = await Joi.object({
      status: Joi.string().valid('OPEN','IN_PROGRESS','RESOLVED','CLOSED').optional(),
      adminNotes: Joi.string().allow('',null)
    }).validateAsync(req.body);
    const t = await Ticket.findByIdAndUpdate(req.params.id, { status, adminNotes }, { new:true });
    if (!t) return fail(res,'NOT_FOUND','Ticket not found',404);
    ok(res, t, 'Ticket updated');
  }catch(e){ next(e) }
});

export default router;
