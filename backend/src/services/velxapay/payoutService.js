import { velxapayConfig } from '../../config/velxapay.js';
import MerchantBankAccount from '../../models/MerchantBankAccount.js';
import MerchantLedger from '../../models/MerchantLedger.js';
import MerchantPayout from '../../models/MerchantPayout.js';
import MerchantSettlement from '../../models/MerchantSettlement.js';
import { velxapayPost } from './velxapayClient.js';

function providerStatus(response = {}) {
  const data = response?.data && typeof response.data === 'object' ? response.data : response;
  return String(data.status || data.withdraw_status || data.payment_status || data.state || '').toUpperCase();
}

function providerReference(response = {}) {
  const data = response?.data && typeof response.data === 'object' ? response.data : response;
  return String(data.platOrderNum || data.providerOrderId || data.order_id || data.orderId || data.referenceId || '').trim();
}

function providerUtr(response = {}) {
  const data = response?.data && typeof response.data === 'object' ? response.data : response;
  return String(data.utr || data.UTR || data.bankRef || data.reference || '').trim();
}

export async function initiateMerchantPayout({ payout, settlement, bank }) {
  const providerOrderId = payout.providerOrderId || settlement.settlementId;
  const request = {
    order_id: providerOrderId,
    orderId: providerOrderId,
    amount: Number(payout.amount),
    transfer_amount: Number(payout.amount),
    account_number: bank.accountNumber,
    bankAccountNumber: bank.accountNumber,
    ifsc: String(bank.ifscCode || '').toUpperCase(),
    bankIfscCode: String(bank.ifscCode || '').toUpperCase(),
    beneficiary_name: bank.accountHolderName,
    beneficiaryName: bank.accountHolderName,
    bank_name: bank.bankName || '',
  };
  const response = await velxapayPost(velxapayConfig.payoutUrl, request);
  return { providerOrderId, request, response };
}

export async function processQueuedMerchantPayouts({ limit = 10 } = {}) {
  const payouts = await MerchantPayout.find({ status: 'QUEUED' }).sort({ createdAt: 1 }).limit(limit);
  const results = [];
  for (const payout of payouts) {
    const settlement = await MerchantSettlement.findById(payout.settlementId);
    if (!settlement || settlement.status !== 'REQUESTED') {
      payout.status = 'FAILED';
      payout.response = { error: 'Settlement is unavailable or no longer requestable.' };
      await payout.save();
      results.push({ payoutId: payout._id, status: payout.status });
      continue;
    }
    const bank = await MerchantBankAccount.findById(settlement.bankAccountId);
    if (!bank || bank.status !== 'VERIFIED') {
      payout.status = 'FAILED';
      payout.response = { error: 'Verified settlement bank account is unavailable.' };
      settlement.status = 'FAILED';
      settlement.failureReason = 'Verified settlement bank account is unavailable.';
      await Promise.all([payout.save(), settlement.save()]);
      results.push({ payoutId: payout._id, status: payout.status });
      continue;
    }

    payout.status = 'PROCESSING';
    settlement.status = 'PROCESSING';
    await Promise.all([payout.save(), settlement.save()]);

    try {
      const result = await initiateMerchantPayout({ payout, settlement, bank });
      payout.providerOrderId = result.providerOrderId;
      payout.request = result.request;
      payout.response = result.response;
      const status = providerStatus(result.response);
      const utr = providerUtr(result.response);
      const reference = providerReference(result.response) || result.providerOrderId;
      payout.providerOrderId = reference;
      payout.utr = utr || payout.utr;

      if (['SUCCESS', 'COMPLETED', 'SETTLED', 'PAID'].includes(status)) {
        payout.status = 'SUCCESS';
        settlement.status = 'SETTLED';
        settlement.utr = utr || settlement.utr;
        settlement.providerReference = reference;
        settlement.settledAt = new Date();
        await MerchantLedger.updateOne(
          { idempotencyKey: `VELXA:SETTLEMENT:${settlement.settlementId}` },
          {
            $setOnInsert: {
              businessId: settlement.businessId,
              userId: settlement.userId,
              settlementId: settlement._id,
              type: 'SETTLEMENT_DEBIT',
              amount: settlement.amount,
              status: 'SETTLED',
              description: `Settlement ${settlement.settlementId}`,
            },
          },
          { upsert: true },
        );
      } else if (['FAILED', 'FAILURE', 'REJECTED', 'CANCELLED'].includes(status)) {
        payout.status = 'FAILED';
        settlement.status = 'FAILED';
        settlement.failureReason = result.response?.message || result.response?.resText || 'Provider rejected the payout.';
      } else {
        payout.status = 'PROCESSING';
        settlement.status = 'PROCESSING';
        settlement.providerReference = reference;
      }
      await Promise.all([payout.save(), settlement.save()]);
      results.push({ payoutId: payout._id, status: payout.status });
    } catch (error) {
      payout.status = error.code === 'VELXAPAY_NOT_CONFIGURED' ? 'QUEUED' : 'FAILED';
      payout.response = { error: error.message, code: error.code || 'PAYOUT_FAILED' };
      if (payout.status === 'FAILED') {
        settlement.status = 'FAILED';
        settlement.failureReason = error.message || 'Payout could not be started.';
      } else {
        settlement.status = 'REQUESTED';
      }
      await Promise.all([payout.save(), settlement.save()]);
      results.push({ payoutId: payout._id, status: payout.status, error: error.message });
    }
  }
  return results;
}
