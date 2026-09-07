import { Router } from 'express';
import Invoice from '../models/Invoice.js';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';
import { generateInvoicePDF } from '../services/invoiceService.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const invoices = await Invoice.find({ userId: req.user.uid })
      .populate('paymentId')
      .sort({ createdAt: -1 });
    ok(res, invoices);
  } catch (e) { next(e); }
});

router.get('/payment/:paymentId', requireAuth, async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ userId: req.user.uid, paymentId: req.params.paymentId });
    if (!invoice) return fail(res, 'NOT_FOUND', 'Invoice not found for this payment', 404);
    ok(res, invoice);
  } catch (e) { next(e); }
});

router.get('/clubapi/:urid/pdf', requireAuth, async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      userId: req.user.uid,
      notes: { $regex: req.params.urid, $options: 'i' }
    }).sort({ createdAt: -1 });
    if (!invoice) return fail(res, 'NOT_FOUND', 'Invoice not found for this transaction', 404);
    const pdfBuffer = await generateInvoicePDF(invoice._id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${invoice.invoiceNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (e) { next(e); }
});

router.get('/:id/pdf', requireAuth, async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!invoice) return fail(res, 'NOT_FOUND', 'Invoice not found', 404);
    const pdfBuffer = await generateInvoicePDF(invoice._id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${invoice.invoiceNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (e) { next(e); }
});

export default router;
