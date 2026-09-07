import express from 'express';
import Invoice from '../models/Invoice.js';
import User from '../models/User.js';
import { generateInvoicePDF, generateInvoiceCSV } from '../services/invoiceService.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const router = express.Router();

router.use(requireAuth, requireRole(['admin']));

const buildInvoiceQuery = async ({ status = 'ALL', search = '' }) => {
  const query = {};
  if (status !== 'ALL') query.status = status;

  if (search) {
    const users = await User.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } }
      ]
    }).select('_id');

    query.$or = [
      { invoiceNumber: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { notes: { $regex: search, $options: 'i' } },
      { userId: { $in: users.map((user) => user._id) } }
    ];
  }

  return query;
};

router.get('/stats/summary', async (req, res) => {
  try {
    const [total, pending, paid, overdue, amounts] = await Promise.all([
      Invoice.countDocuments(),
      Invoice.countDocuments({ status: 'PENDING' }),
      Invoice.countDocuments({ status: 'PAID' }),
      Invoice.countDocuments({ status: 'OVERDUE' }),
      Invoice.aggregate([
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            pendingAmount: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, '$amount', 0] } },
            paidAmount: { $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, '$amount', 0] } },
            overdueAmount: { $sum: { $cond: [{ $eq: ['$status', 'OVERDUE'] }, '$amount', 0] } }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        counts: { total, pending, paid, overdue },
        amounts: amounts[0] || { totalAmount: 0, pendingAmount: 0, paidAmount: 0, overdueAmount: 0 }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/csv/export', async (req, res) => {
  try {
    const csv = await generateInvoiceCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=invoices.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = 'ALL',
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = await buildInvoiceQuery({ status, search });
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (Number(page) - 1) * Number(limit);

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate('userId', 'name email mobile')
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit)),
      Invoice.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        items: invoices,
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)) || 1
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { invoiceNumber, userId, amount, date, dueDate, items = [], status, description, notes } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User is required' });

    const normalizedItems = items.length
      ? items.map((item) => ({
          description: item.description || 'Invoice item',
          quantity: Number(item.quantity) || 1,
          rate: Number(item.rate) || 0,
          total: Number(item.total) || (Number(item.quantity || 1) * Number(item.rate || 0))
        }))
      : [{ description: description || 'Invoice amount', quantity: 1, rate: Number(amount) || 0, total: Number(amount) || 0 }];

    const finalAmount = normalizedItems.reduce((sum, item) => sum + Number(item.total || 0), 0);

    const invoice = await Invoice.create({
      invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      userId,
      amount: finalAmount || Number(amount) || 0,
      date: date || new Date(),
      dueDate: dueDate || null,
      items: normalizedItems,
      status: status || 'PENDING',
      description,
      notes
    });

    await invoice.populate('userId', 'name email mobile');
    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('userId', 'name email mobile');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const allowed = ['status', 'amount', 'dueDate', 'description', 'notes', 'items'];
    const updateData = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    });

    const updatedInvoice = await Invoice.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('userId', 'name email mobile');

    if (!updatedInvoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, data: updatedInvoice });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const pdfBuffer = await generateInvoicePDF(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=invoice.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
