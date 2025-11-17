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

const router = Router();

router.use(requireAuth, requireAdmin);

// Helper function to parse date range
const parseDateRange = (startDate, endDate) => {
  const start = startDate ? new Date(startDate) : new Date('2020-01-01');
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999); // End of day
  return { start, end };
};

// Helper function to generate CSV
const generateCSV = async (data, headers, filename) => {
  const csvWriter = createCsvWriter.createObjectCsvWriter({
    path: `/tmp/${filename}`,
    header: headers
  });
  await csvWriter.writeRecords(data);
  return `/tmp/${filename}`;
};

// Helper function to generate Excel
const generateExcel = async (data, headers, filename, sheetName) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Add headers
  worksheet.columns = headers.map(h => ({ header: h.title, key: h.id, width: 20 }));

  // Add data
  data.forEach(row => {
    worksheet.addRow(row);
  });

  await workbook.xlsx.writeFile(`/tmp/${filename}`);
  return `/tmp/${filename}`;
};

// Helper function to generate PDF
const generatePDF = async (data, headers, filename, title) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const filePath = `/tmp/${filename}`;
    const stream = require('fs').createWriteStream(filePath);

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
      require('fs').unlink(filePath, (err) => {
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
      require('fs').unlink(filePath, (err) => {
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
      require('fs').unlink(filePath, (err) => {
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
      require('fs').unlink(filePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    });

  } catch (e) { next(e); }
});

export default router;
