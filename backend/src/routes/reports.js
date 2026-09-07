import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import User from '../models/User.js';
import Loan from '../models/Loan.js';
import Payment from '../models/Payment.js';
import Bill from '../models/Bill.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import { ok, fail } from '../utils/response.js';
import createCsvWriter from 'csv-writer';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import os from 'os';
import path from 'path';

const router = Router();

router.use(requireAuth, requireAdmin);

// Helper function to parse date range
const parseDateRange = (startDate, endDate) => {
  const start = startDate ? new Date(startDate) : new Date('2020-01-01');
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999); // End of day
  return { start, end };
};

const sendGeneratedFile = (res, filePath) => {
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending file:', err);
      return fail(res, 'FILE_ERROR', 'Error generating report', 500);
    }
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
    });
  });
};

// Helper function to generate CSV
const generateCSV = async (data, headers, filename) => {
  const filePath = path.join(os.tmpdir(), filename);
  const csvWriter = createCsvWriter.createObjectCsvWriter({
    path: filePath,
    header: headers
  });
  await csvWriter.writeRecords(data);
  return filePath;
};

// Helper function to generate Excel
const generateExcel = async (data, headers, filename, sheetName) => {
  const filePath = path.join(os.tmpdir(), filename);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Add headers
  worksheet.columns = headers.map(h => ({ header: h.title, key: h.id, width: 20 }));

  // Add data
  data.forEach(row => {
    worksheet.addRow(row);
  });

  await workbook.xlsx.writeFile(filePath);
  return filePath;
};

// Helper function to generate PDF
const generatePDF = async (data, headers, filename, title) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const filePath = path.join(os.tmpdir(), filename);
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Title
    doc.fontSize(20).text(title, { align: 'center' });
    doc.moveDown();

    // Headers
    const colWidth = 540 / headers.length;
    headers.forEach((header, index) => {
      doc.fontSize(10).text(header.title, 50 + (index * colWidth), doc.y, { width: colWidth, align: 'left' });
    });
    doc.moveDown();

    // Data
    data.forEach(row => {
      headers.forEach((header, index) => {
        const value = row[header.id] || '';
        doc.fontSize(8).text(value.toString(), 50 + (index * colWidth), doc.y, { width: colWidth, align: 'left' });
      });
      doc.moveDown(0.5);
    });

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
};

router.get('/summary', async (req, res, next) => {
  try {
    const { startDate, endDate } = await Joi.object({
      startDate: Joi.string().optional(),
      endDate: Joi.string().optional()
    }).validateAsync(req.query);

    const { start, end } = parseDateRange(startDate, endDate);
    const dateQuery = { createdAt: { $gte: start, $lte: end } };

    const [users, loans, payments, bills, withdrawals] = await Promise.all([
      User.find(dateQuery).select('status emailVerified walletBalance kyc createdAt'),
      Loan.find(dateQuery).select('status application decision schedule createdAt'),
      Payment.find(dateQuery).select('status type amount createdAt'),
      Bill.find(dateQuery).select('status amount createdAt'),
      WithdrawalRequest.find(dateQuery).select('status amount createdAt')
    ]);

    const confirmedPayments = payments.filter(p => ['CONFIRMED', 'success'].includes(p.status));
    const pendingEmis = loans.flatMap(l => l.schedule || []).filter(emi => !emi.paid);
    const overdueEmis = pendingEmis.filter(emi => emi.dueDate && new Date(emi.dueDate) < new Date());

    ok(res, {
      totals: {
        users: users.length,
        loans: loans.length,
        payments: payments.length,
        bills: bills.length,
        withdrawals: withdrawals.length,
        receivedAmount: confirmedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        requestedLoanAmount: loans.reduce((sum, l) => sum + Number(l.application?.amountRequested || 0), 0),
        approvedLoanAmount: loans.reduce((sum, l) => sum + Number(l.decision?.amountApproved || 0), 0),
        withdrawalAmount: withdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0),
        pendingEmis: pendingEmis.length,
        overdueEmis: overdueEmis.length
      },
      status: {
        loans: {
          pending: loans.filter(l => l.status === 'PENDING').length,
          approved: loans.filter(l => l.status === 'APPROVED').length,
          disbursed: loans.filter(l => l.status === 'DISBURSED').length,
          rejected: loans.filter(l => l.status === 'REJECTED').length,
          closed: loans.filter(l => l.status === 'CLOSED').length
        },
        payments: {
          confirmed: payments.filter(p => p.status === 'CONFIRMED').length,
          pending: payments.filter(p => p.status === 'PENDING').length,
          failed: payments.filter(p => p.status === 'FAILED').length
        },
        withdrawals: {
          pending: withdrawals.filter(w => w.status === 'PENDING').length,
          approved: withdrawals.filter(w => w.status === 'APPROVED').length,
          rejected: withdrawals.filter(w => w.status === 'REJECTED').length
        },
        bills: {
          pending: bills.filter(b => b.status === 'PENDING').length,
          paid: bills.filter(b => b.status === 'PAID').length,
          cancelled: bills.filter(b => b.status === 'CANCELLED').length
        }
      }
    });
  } catch (e) { next(e); }
});

// Users Report
router.get('/users', async (req, res, next) => {
  try {
    const { startDate, endDate, format = 'json' } = await Joi.object({
      startDate: Joi.string().optional(),
      endDate: Joi.string().optional(),
      format: Joi.string().valid('json', 'csv', 'excel', 'pdf').default('json')
    }).validateAsync(req.query);

    const { start, end } = parseDateRange(startDate, endDate);

    const users = await User.find({
      createdAt: { $gte: start, $lte: end }
    }).select('-passwordHash').sort({ createdAt: -1 });

    const data = users.map(user => ({
      id: user._id.toString(),
      name: user.name || 'N/A',
      email: user.email || 'N/A',
      mobile: user.mobile || 'N/A',
      roles: (user.roles || []).join('|'),
      status: user.status || 'active',
      emailVerified: user.emailVerified ? 'Yes' : 'No',
      walletBalance: user.walletBalance || 0,
      loanLimit: user.loanLimit?.amount || 0,
      createdAt: user.createdAt.toISOString().split('T')[0]
    }));

    const headers = [
      { id: 'id', title: 'User ID' },
      { id: 'name', title: 'Name' },
      { id: 'email', title: 'Email' },
      { id: 'mobile', title: 'Mobile' },
      { id: 'roles', title: 'Roles' },
      { id: 'status', title: 'Status' },
      { id: 'emailVerified', title: 'Email Verified' },
      { id: 'walletBalance', title: 'Wallet Balance' },
      { id: 'loanLimit', title: 'Loan Limit' },
      { id: 'createdAt', title: 'Created Date' }
    ];

    if (format === 'json') return ok(res, data);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `users_report_${timestamp}`;
    let filePath;
    if (format === 'csv') {
      filePath = await generateCSV(data, headers, `${filename}.csv`);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    } else if (format === 'excel') {
      filePath = await generateExcel(data, headers, `${filename}.xlsx`, 'Users Report');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    } else if (format === 'pdf') {
      filePath = await generatePDF(data, headers, `${filename}.pdf`, 'Users Report');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    }

    sendGeneratedFile(res, filePath);
  } catch (e) { next(e); }
});

// Loans Report
router.get('/loans', async (req, res, next) => {
  try {
    const { startDate, endDate, format = 'json' } = await Joi.object({
      startDate: Joi.string().optional(),
      endDate: Joi.string().optional(),
      format: Joi.string().valid('json', 'csv', 'excel', 'pdf').default('json')
    }).validateAsync(req.query);

    const { start, end } = parseDateRange(startDate, endDate);

    const loans = await Loan.find({
      createdAt: { $gte: start, $lte: end }
    }).populate('userId', 'name email mobile').sort({ createdAt: -1 });

    const data = loans.map(loan => ({
      id: loan._id.toString(),
      userName: loan.userId?.name || 'N/A',
      userEmail: loan.userId?.email || 'N/A',
      userMobile: loan.userId?.mobile || 'N/A',
      amountRequested: loan.application?.amountRequested || 0,
      amountApproved: loan.decision?.amountApproved || 0,
      status: loan.status,
      createdAt: loan.createdAt.toISOString().split('T')[0],
      disbursementDate: loan.disbursementDate ? loan.disbursementDate.toISOString().split('T')[0] : 'N/A'
    }));

    const headers = [
      { id: 'id', title: 'Loan ID' },
      { id: 'userName', title: 'User Name' },
      { id: 'userEmail', title: 'Email' },
      { id: 'userMobile', title: 'Mobile' },
      { id: 'amountRequested', title: 'Requested Amount' },
      { id: 'amountApproved', title: 'Approved Amount' },
      { id: 'status', title: 'Status' },
      { id: 'createdAt', title: 'Created Date' },
      { id: 'disbursementDate', title: 'Disbursement Date' }
    ];

    if (format === 'json') {
      return ok(res, data);
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `loans_report_${timestamp}`;

    let filePath;
    if (format === 'csv') {
      filePath = await generateCSV(data, headers, `${filename}.csv`);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    } else if (format === 'excel') {
      filePath = await generateExcel(data, headers, `${filename}.xlsx`, 'Loans Report');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    } else if (format === 'pdf') {
      filePath = await generatePDF(data, headers, `${filename}.pdf`, 'Loans Report');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    }

    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        return fail(res, 'FILE_ERROR', 'Error generating report', 500);
      }
      // Clean up file after sending
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    });

  } catch (e) { next(e); }
});

// Payments Report
router.get('/payments', async (req, res, next) => {
  try {
    const { startDate, endDate, format = 'json' } = await Joi.object({
      startDate: Joi.string().optional(),
      endDate: Joi.string().optional(),
      format: Joi.string().valid('json', 'csv', 'excel', 'pdf').default('json')
    }).validateAsync(req.query);

    const { start, end } = parseDateRange(startDate, endDate);

    const payments = await Payment.find({
      createdAt: { $gte: start, $lte: end }
    }).populate('userId', 'name email mobile').sort({ createdAt: -1 });

    const data = payments.map(payment => ({
      id: payment._id.toString(),
      userName: payment.userId?.name || 'N/A',
      userEmail: payment.userId?.email || 'N/A',
      userMobile: payment.userId?.mobile || 'N/A',
      type: payment.type,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      reference: payment.reference || 'N/A',
      createdAt: payment.createdAt.toISOString().split('T')[0]
    }));

    const headers = [
      { id: 'id', title: 'Payment ID' },
      { id: 'userName', title: 'User Name' },
      { id: 'userEmail', title: 'Email' },
      { id: 'userMobile', title: 'Mobile' },
      { id: 'type', title: 'Type' },
      { id: 'amount', title: 'Amount' },
      { id: 'method', title: 'Method' },
      { id: 'status', title: 'Status' },
      { id: 'reference', title: 'Reference' },
      { id: 'createdAt', title: 'Date' }
    ];

    if (format === 'json') {
      return ok(res, data);
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `payments_report_${timestamp}`;

    let filePath;
    if (format === 'csv') {
      filePath = await generateCSV(data, headers, `${filename}.csv`);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    } else if (format === 'excel') {
      filePath = await generateExcel(data, headers, `${filename}.xlsx`, 'Payments Report');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    } else if (format === 'pdf') {
      filePath = await generatePDF(data, headers, `${filename}.pdf`, 'Payments Report');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    }

    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        return fail(res, 'FILE_ERROR', 'Error generating report', 500);
      }
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    });

  } catch (e) { next(e); }
});

// Bills Report
router.get('/bills', async (req, res, next) => {
  try {
    const { startDate, endDate, format = 'json' } = await Joi.object({
      startDate: Joi.string().optional(),
      endDate: Joi.string().optional(),
      format: Joi.string().valid('json', 'csv', 'excel', 'pdf').default('json')
    }).validateAsync(req.query);

    const { start, end } = parseDateRange(startDate, endDate);

    const bills = await Bill.find({
      createdAt: { $gte: start, $lte: end }
    }).populate('userId', 'name email mobile').sort({ createdAt: -1 });

    const data = bills.map(bill => ({
      id: bill._id.toString(),
      userName: bill.userId?.name || 'N/A',
      userEmail: bill.userId?.email || 'N/A',
      userMobile: bill.userId?.mobile || 'N/A',
      type: bill.type,
      provider: bill.provider || 'N/A',
      accountRef: bill.accountRef || 'N/A',
      amount: bill.amount,
      dueDate: bill.dueDate ? bill.dueDate.toISOString().split('T')[0] : 'N/A',
      status: bill.status,
      paidAt: bill.paidAt ? bill.paidAt.toISOString().split('T')[0] : 'N/A',
      createdAt: bill.createdAt.toISOString().split('T')[0]
    }));

    const headers = [
      { id: 'id', title: 'Bill ID' },
      { id: 'userName', title: 'User Name' },
      { id: 'userEmail', title: 'Email' },
      { id: 'userMobile', title: 'Mobile' },
      { id: 'type', title: 'Type' },
      { id: 'provider', title: 'Provider' },
      { id: 'accountRef', title: 'Account Reference' },
      { id: 'amount', title: 'Amount' },
      { id: 'dueDate', title: 'Due Date' },
      { id: 'status', title: 'Status' },
      { id: 'paidAt', title: 'Paid At' },
      { id: 'createdAt', title: 'Created Date' }
    ];

    if (format === 'json') {
      return ok(res, data);
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `bills_report_${timestamp}`;

    let filePath;
    if (format === 'csv') {
      filePath = await generateCSV(data, headers, `${filename}.csv`);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    } else if (format === 'excel') {
      filePath = await generateExcel(data, headers, `${filename}.xlsx`, 'Bills Report');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    } else if (format === 'pdf') {
      filePath = await generatePDF(data, headers, `${filename}.pdf`, 'Bills Report');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    }

    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        return fail(res, 'FILE_ERROR', 'Error generating report', 500);
      }
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    });

  } catch (e) { next(e); }
});

// Withdrawals Report
router.get('/withdrawals', async (req, res, next) => {
  try {
    const { startDate, endDate, format = 'json' } = await Joi.object({
      startDate: Joi.string().optional(),
      endDate: Joi.string().optional(),
      format: Joi.string().valid('json', 'csv', 'excel', 'pdf').default('json')
    }).validateAsync(req.query);

    const { start, end } = parseDateRange(startDate, endDate);

    const withdrawals = await WithdrawalRequest.find({
      createdAt: { $gte: start, $lte: end }
    }).populate('userId', 'name email mobile').sort({ createdAt: -1 });

    const data = withdrawals.map(withdrawal => ({
      id: withdrawal._id.toString(),
      userName: withdrawal.userId?.name || 'N/A',
      userEmail: withdrawal.userId?.email || 'N/A',
      userMobile: withdrawal.userId?.mobile || 'N/A',
      amount: withdrawal.amount,
      bankName: withdrawal.bankDetails?.bankName || 'N/A',
      accountNumber: withdrawal.bankDetails?.accountNumber || 'N/A',
      ifscCode: withdrawal.bankDetails?.ifscCode || 'N/A',
      accountHolderName: withdrawal.bankDetails?.accountHolderName || 'N/A',
      status: withdrawal.status,
      decidedAt: withdrawal.decidedAt ? withdrawal.decidedAt.toISOString().split('T')[0] : 'N/A',
      txnId: withdrawal.txnId || 'N/A',
      notes: withdrawal.notes || 'N/A',
      createdAt: withdrawal.createdAt.toISOString().split('T')[0]
    }));

    const headers = [
      { id: 'id', title: 'Withdrawal ID' },
      { id: 'userName', title: 'User Name' },
      { id: 'userEmail', title: 'Email' },
      { id: 'userMobile', title: 'Mobile' },
      { id: 'amount', title: 'Amount' },
      { id: 'bankName', title: 'Bank Name' },
      { id: 'accountNumber', title: 'Account Number' },
      { id: 'ifscCode', title: 'IFSC Code' },
      { id: 'accountHolderName', title: 'Account Holder' },
      { id: 'status', title: 'Status' },
      { id: 'decidedAt', title: 'Decided At' },
      { id: 'txnId', title: 'Transaction ID' },
      { id: 'notes', title: 'Notes' },
      { id: 'createdAt', title: 'Created Date' }
    ];

    if (format === 'json') {
      return ok(res, data);
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `withdrawals_report_${timestamp}`;

    let filePath;
    if (format === 'csv') {
      filePath = await generateCSV(data, headers, `${filename}.csv`);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    } else if (format === 'excel') {
      filePath = await generateExcel(data, headers, `${filename}.xlsx`, 'Withdrawals Report');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    } else if (format === 'pdf') {
      filePath = await generatePDF(data, headers, `${filename}.pdf`, 'Withdrawals Report');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    }

    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        return fail(res, 'FILE_ERROR', 'Error generating report', 500);
      }
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    });

  } catch (e) { next(e); }
});

export default router;
