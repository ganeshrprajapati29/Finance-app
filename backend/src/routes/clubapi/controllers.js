import ClubAPITransaction from './models/transaction.js';
import Invoice from '../../models/Invoice.js';
import { generateURID, validateResponse, formatAmount, getTransactionType } from './helper.js';
import { invoiceNumber } from '../../services/paymentInvoiceService.js';
import { emitToUser } from '../../realtime.js';
import { syncTransactionStatus } from '../../services/rechargePaymentService.js';
import {
  callClubAPITransaction,
  fetchBbpsBill,
  payBbpsBill
} from '../../services/clubapiUtility.js';

function clubStatusToLocal(data = {}) {
  const raw = String(data.status || data.txnStatus || data.transactionStatus || data.resCode || '').toUpperCase();
  const text = String(data.resText || data.message || data.statusMessage || '').toLowerCase();
  if (raw === 'SUCCESS' || raw === 'COMPLETED' || /success|completed/.test(text)) return 'completed';
  if (['FAILED', 'FAILURE', 'ERROR', 'CANCELLED', 'CANCELED'].includes(raw) || /fail|error|cancel|reject/.test(text)) return 'failed';
  return 'processing';
}

function cleanText(value) {
  return String(value || '').replace(/^Exception:\s*/i, '').trim();
}

function pickFirst(data = {}, keys = []) {
  for (const key of keys) {
    const value = data?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

function pickAmount(data = {}) {
  const raw = pickFirst(data, [
    'amount',
    'dueAmount',
    'billAmount',
    'billNetAmount',
    'billnetamount',
    'bill_amount',
    'payableAmount'
  ]);
  const number = Number(String(raw || '').replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function normalizeBbpsBillResponse(response = {}, urid = '') {
  const nested = response.data && typeof response.data === 'object' ? response.data : {};
  const billData = response.billData && typeof response.billData === 'object' ? response.billData : {};
  const bill = response.bill && typeof response.bill === 'object' ? response.bill : {};
  const source = Object.keys(billData).length
    ? billData
    : Object.keys(bill).length
      ? bill
      : Object.keys(nested).length
        ? nested
        : response;

  return {
    urid: cleanText(pickFirst(source, ['urid', 'billId', '_id']) || pickFirst(response, ['urid', 'billId']) || urid),
    customerName: cleanText(pickFirst(source, ['customerName', 'consumerName', 'name', 'billName'])),
    amount: pickAmount(source),
    dueDate: cleanText(pickFirst(source, ['dueDate', 'billDueDate', 'bill_due_date'])),
    billNumber: cleanText(pickFirst(source, ['billNumber', 'billNo', 'billId', 'bill_number'])),
    billDate: cleanText(pickFirst(source, ['billDate', 'bill_date'])),
    billPeriod: cleanText(pickFirst(source, ['billPeriod', 'bill_period'])),
    status: cleanText(pickFirst(response, ['status', 'txnStatus', 'resCode'])),
    message: cleanText(pickFirst(response, ['message', 'resText', 'statusMessage'])),
    additionalInfo: source.additionalInfo && typeof source.additionalInfo === 'object' ? source.additionalInfo : source,
    raw: response
  };
}

function friendlyBbpsMessage(error) {
  const raw = cleanText(
    error?.response?.data?.message ||
    error?.response?.data?.resText ||
    error?.message
  );
  const lower = raw.toLowerCase();
  if (/token|unauthori[sz]ed|auth|kyc|whitelist/.test(lower)) {
    return 'Service configuration issue hai. Please support se contact karein.';
  }
  if (/timeout|etimedout|network|econn|enotfound|socket/.test(lower)) {
    return 'Bill service abhi slow hai. Thodi der baad dobara try karein.';
  }
  if (/invalid|not found|no bill|bill not|consumer|account|mobile|parameter|field|required/.test(lower)) {
    return 'Bill details match nahi ho rahe. Biller aur consumer/account number check karke dobara try karein.';
  }
  if (/pending|process/.test(lower)) {
    return 'Bill fetch request process ho rahi hai. Thodi der baad status check karein.';
  }
  return raw || 'Bill fetch nahi ho paya. Details check karke dobara try karein.';
}

function emitClubTransaction(userId, transaction) {
  if (!userId) return;
  emitToUser(userId, 'clubapi:transaction_updated', {
    urid: transaction.urid,
    status: transaction.status,
    type: transaction.type,
    amount: transaction.amount,
    transaction
  });
}

async function markTransactionFailed(transaction, userId, error) {
  transaction.status = 'failed';
  transaction.response = {
    message: error.response?.data?.message || error.response?.data?.resText || error.message || 'ClubAPI request failed',
    clubapi: error.response?.data
  };
  await transaction.save();
  emitClubTransaction(userId, transaction);
}

class ClubAPIController {
  // Fetch bill details
  static async fetchBill(req, res, next) {
    try {
      const {
        type,
        provider,
        accountRef,
        bbpsId = provider,
        mobile = accountRef,
        customerMobile = req.user?.mobile || mobile,
        opvalue1,
        opvalue2,
        opvalue3,
        opvalue4,
        opvalue5
      } = req.body;
      const userId = req.user?.uid || req.user?.id;

      if (!bbpsId || !mobile || !customerMobile) {
        return res.status(400).json({
          success: false,
          code: 'BBPS_DETAILS_REQUIRED',
          message: 'Biller, consumer/account number aur customer mobile required hai.'
        });
      }

      if (!/^\d{10}$/.test(String(customerMobile))) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_CUSTOMER_MOBILE',
          message: 'Customer mobile 10 digit ka hona chahiye.'
        });
      }

      const urid = generateURID();

      // Create transaction record
      const transaction = new ClubAPITransaction({
        urid,
        type: 'bill_fetch',
        status: 'processing',
        amount: 0,
        provider: bbpsId,
        accountRef: mobile,
        userId
      });
      await transaction.save();

      emitClubTransaction(userId, transaction);

      let clubapiResponse;
      try {
        clubapiResponse = await fetchBbpsBill({
          urid,
          bbpsId: String(bbpsId).trim(),
          mobile: String(mobile).trim(),
          customerMobile: String(customerMobile).trim(),
          opvalue1,
          opvalue2,
          opvalue3,
          opvalue4,
          opvalue5
        });
      } catch (error) {
        await markTransactionFailed(transaction, userId, error);
        return res.status(400).json({
          success: false,
          code: 'BBPS_FETCH_FAILED',
          message: friendlyBbpsMessage(error)
        });
      }
      const validatedResponse = validateResponse(clubapiResponse);
      const bill = normalizeBbpsBillResponse(validatedResponse, urid);

      // Update transaction
      transaction.status = clubStatusToLocal(validatedResponse);
      transaction.response = validatedResponse;
      await transaction.save();
      emitClubTransaction(userId, transaction);

      res.json({
        success: true,
        message: bill.amount > 0 ? 'Bill fetched successfully' : (bill.message || 'Bill details fetched'),
        data: {
          urid,
          bill,
          transaction: transaction
        }
      });

    } catch (error) {
      return res.status(400).json({
        success: false,
        code: 'BBPS_FETCH_FAILED',
        message: friendlyBbpsMessage(error)
      });
    }
  }

  // Pay bill
  static async payBill(req, res, next) {
    try {
      return res.status(402).json({
        success: false,
        code: 'PAYMENT_REQUIRED',
        message: 'Please pay with Razorpay first. Bill payment will start automatically after payment verification.'
      });
      const {
        billId,
        amount,
        operatorId,
        accountRef,
        bbpsId = operatorId,
        mobile = accountRef,
        customerMobile,
        opvalue1,
        opvalue2,
        opvalue3,
        opvalue4,
        opvalue5
      } = req.body;
      const userId = req.user?.uid || req.user?.id;

      if (!amount || !bbpsId || !mobile || !customerMobile) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: amount, bbpsId, mobile, customerMobile'
        });
      }

      const urid = generateURID();
      const formattedAmount = formatAmount(amount);

      // Create transaction record
      const transaction = new ClubAPITransaction({
        urid,
        type: 'bill_payment',
        status: 'processing',
        amount: formattedAmount,
        provider: bbpsId,
        accountRef: mobile,
        billId,
        userId
      });
      await transaction.save();

      emitClubTransaction(userId, transaction);

      let clubapiResponse;
      try {
        clubapiResponse = await payBbpsBill({
          urid,
          bbpsId,
          mobile,
          customerMobile,
          amount: formattedAmount,
          opvalue1,
          opvalue2,
          opvalue3,
          opvalue4,
          opvalue5
        });
      } catch (error) {
        await markTransactionFailed(transaction, userId, error);
        throw error;
      }
      const validatedResponse = validateResponse(clubapiResponse);

      // Update transaction
      transaction.status = clubStatusToLocal(validatedResponse);
      transaction.response = validatedResponse;
      await transaction.save();
      emitClubTransaction(userId, transaction);

      if (transaction.status === 'completed' && userId) {
        await Invoice.create({
          invoiceNumber: invoiceNumber('KPBBPS'),
          userId,
          amount: Number(formattedAmount || 0),
          taxableAmount: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          status: 'PAID',
          invoiceType: 'BBPS',
          description: `BBPS bill payment - ${bbpsId}`,
          notes: `Transaction ID: ${urid} | Bill ID: ${billId || ''} | Account: ${mobile}`,
          items: [{ description: `BBPS bill payment - ${bbpsId}`, quantity: 1, rate: Number(formattedAmount || 0), total: Number(formattedAmount || 0) }]
        });
      }

      res.json({
        success: true,
        data: {
          urid,
          transaction: transaction,
          response: validatedResponse
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Recharge (Mobile/DTH)
  static async recharge(req, res, next) {
    try {
      return res.status(402).json({
        success: false,
        code: 'PAYMENT_REQUIRED',
        message: 'Please pay with Razorpay first. Recharge will start automatically after payment verification.'
      });
    } catch (error) {
      next(error);
    }
  }

  // Get transaction status (the caller's own transactions only)
  static async getTransactionStatus(req, res, next) {
    try {
      const { urid } = req.params;
      const userId = req.user?.uid || req.user?.id;

      if (!urid) {
        return res.status(400).json({ success: false, message: 'URID is required', data: null });
      }

      const transaction = await ClubAPITransaction.findOne({ urid, userId });
      if (!transaction) {
        return res.status(404).json({ success: false, message: 'Transaction not found', data: null });
      }

      // Uses ClubAPI's transactionStatus API with urid + orderId, throttled.
      const refreshed = await syncTransactionStatus(transaction);
      res.json({ success: true, message: 'OK', data: refreshed || transaction });
    } catch (error) {
      next(error);
    }
  }

  // Get transaction history
  static async getTransactionHistory(req, res, next) {
    try {
      const userId = req.user?.uid || req.user?.id;
      const {
        page = 1,
        limit = 100,
        type,
        status,
        q
      } = req.query;

      const safePage = Math.max(parseInt(page, 10) || 1, 1);
      const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
      const skip = (safePage - 1) * safeLimit;
      const query = { userId };

      if (type) {
        const types = String(type)
          .split(',')
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean);
        if (types.length) query.type = { $in: types };
      }

      if (status) {
        const statuses = String(status)
          .split(',')
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean);
        if (statuses.length) query.status = { $in: statuses };
      }

      if (q) {
        const pattern = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [
          { urid: pattern },
          { provider: pattern },
          { accountRef: pattern },
          { billId: pattern },
          { customerMobile: pattern }
        ];
      }

      const transactions = await ClubAPITransaction
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit);

      const total = await ClubAPITransaction.countDocuments(query);

      res.json({
        success: true,
        data: {
          transactions,
          pagination: {
            page: safePage,
            limit: safeLimit,
            total,
            pages: Math.ceil(total / safeLimit)
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }
}

export default ClubAPIController;
