import ClubAPITransaction from './models/transaction.js';
import Invoice from '../../models/Invoice.js';
import { generateURID, validateResponse, formatAmount, getTransactionType } from './helper.js';
import { invoiceNumber } from '../../services/paymentInvoiceService.js';
import { emitToUser } from '../../realtime.js';
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
        customerMobile,
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
          message: 'Missing required fields: bbpsId, mobile, customerMobile'
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
          bbpsId,
          mobile,
          customerMobile,
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

      res.json({
        success: true,
        data: {
          urid,
          bill: validatedResponse.billData || validatedResponse.bill || validatedResponse.data || validatedResponse,
          transaction: transaction
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Pay bill
  static async payBill(req, res, next) {
    try {
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
      const { type, operatorId, accountRef, amount, customerMobile, cbId, opvalue1, opvalue2, opvalue3, opvalue4, opvalue5 } = req.body;
      const userId = req.user?.uid || req.user?.id;

      if (!type || !operatorId || !accountRef || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: type, operatorId, accountRef, amount'
        });
      }

      const urid = generateURID();
      const formattedAmount = formatAmount(amount);
      const transactionType = getTransactionType(type);

      // Create transaction record
      const transaction = new ClubAPITransaction({
        urid,
        type: transactionType,
        status: 'processing',
        amount: formattedAmount,
        provider: operatorId,
        accountRef,
        customerMobile,
        userId
      });
      await transaction.save();

      emitClubTransaction(userId, transaction);

      let clubapiResponse;
      try {
        clubapiResponse = await callClubAPITransaction({
          urid,
          operatorId,
          mobile: accountRef,
          amount: formattedAmount,
          cbId,
          customerMobile,
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
          invoiceNumber: invoiceNumber('KPRECH'),
          userId,
          amount: Number(formattedAmount || 0),
          taxableAmount: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          status: 'PAID',
          invoiceType: transactionType.toUpperCase(),
          description: `${transactionType} payment - ${operatorId}`,
          notes: `Transaction ID: ${urid} | Account: ${accountRef}`,
          items: [{ description: `${transactionType} payment - ${operatorId}`, quantity: 1, rate: Number(formattedAmount || 0), total: Number(formattedAmount || 0) }]
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

  // Get transaction status
  static async getTransactionStatus(req, res, next) {
    try {
      const { urid } = req.params;

      if (!urid) {
        return res.status(400).json({
          success: false,
          message: 'URID is required'
        });
      }

      // Find transaction in database
      const transaction = await ClubAPITransaction.findOne({ urid });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }

      // If still processing, check with ClubAPI
      if (transaction.status === 'processing') {
        try {
          const validatedResponse = validateResponse(await callClubAPITransaction({
            urid
          }));

          // Update transaction status
          transaction.status = clubStatusToLocal(validatedResponse);
          transaction.response = validatedResponse;
          await transaction.save();
          emitClubTransaction(transaction.userId, transaction);

        } catch (apiError) {
          // If API call fails, return current status
          console.log('API status check failed:', apiError.message);
        }
      }

      res.json({
        success: true,
        data: transaction
      });

    } catch (error) {
      next(error);
    }
  }

  // Get transaction history
  static async getTransactionHistory(req, res, next) {
    try {
      const userId = req.user?.uid || req.user?.id;
      const { page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;

      const transactions = await ClubAPITransaction
        .find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await ClubAPITransaction.countDocuments({ userId });

      res.json({
        success: true,
        data: {
          transactions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }
}

export default ClubAPIController;
