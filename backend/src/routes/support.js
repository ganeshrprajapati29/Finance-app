import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import Ticket from '../models/SupportTicket.js';
import AuditLog from '../models/AuditLog.js';
import Settings from '../models/Settings.js';
import { ok, fail } from '../utils/response.js';
import { sendFCMToToken } from '../services/fcm.js';
import { notifyUserSmart } from '../services/smartNotifications.js';

const router = Router();

// user create ticket
router.post('/', requireAuth, async (req,res,next)=>{
  try{
    const { subject, message } = await Joi.object({
      subject: Joi.string().required(),
      message: Joi.string().required()
    }).validateAsync(req.body);
    const t = await Ticket.create({ userId: req.user.uid, subject, message });
    await notifyUserSmart(req.user.uid, 'support_created', {
      subject,
      data: {
        ticketId: String(t._id),
      },
    });

    // Notify admin via FCM if enabled
    const settings = await Settings.findOne();
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
  try{
    const { status, search, page = 1, limit = 50 } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (search) {
      const safe = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      query.$or = [{ subject: regex }, { message: regex }, { adminNotes: regex }];
    }

    const tickets = await Ticket.find(query)
      .populate('userId', 'name email mobile')
      .sort({ createdAt:-1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    const total = await Ticket.countDocuments(query);
    ok(res, {
      tickets,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)) || 1
      }
    });
  }catch(e){ next(e) }
});
router.put('/:id', requireAuth, requireRole(['admin']), async (req,res,next)=>{
  try{
    const { status, adminNotes } = await Joi.object({
      status: Joi.string().valid('OPEN','IN_PROGRESS','RESOLVED','CLOSED').optional(),
      adminNotes: Joi.string().allow('',null)
    }).validateAsync(req.body);
    const update = {};
    if (status) update.status = status;
    if (adminNotes !== undefined) update.adminNotes = adminNotes;
    const t = await Ticket.findByIdAndUpdate(req.params.id, update, { new:true }).populate('userId', 'name email mobile');
    if (!t) return fail(res,'NOT_FOUND','Ticket not found',404);
    await AuditLog.create({
      actorId: req.user.uid,
      action: 'UPDATE_SUPPORT_TICKET',
      entityType: 'SupportTicket',
      entityId: t._id.toString(),
      meta: { status, adminNotes }
    });
    await notifyUserSmart(t.userId, 'support_updated', {
      subject: t.subject,
      status: t.status,
      data: {
        ticketId: String(t._id),
        status: t.status,
      },
    });
    ok(res, t, 'Ticket updated');
  }catch(e){ next(e) }
});

export default router;
