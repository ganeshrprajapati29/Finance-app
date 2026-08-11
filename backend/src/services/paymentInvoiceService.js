import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';

const COMPANY = {
  gstin: '09AAMCK7213N1ZY',
  name: 'KHATUPAY SECURITIES PRIVATE LIMITED',
  address: 'S-216, Transport Nagar Road, Lucknow, Uttar Pradesh - 226012'
};

const paymentLabels = {
  BILL: 'Bill payment',
  REPAYMENT: 'Loan EMI payment',
  FULL_REPAYMENT: 'Loan full closure payment',
  P2P: 'UPI / QR payment',
  WALLET_SPEND: 'Wallet payment',
  WALLET_TOPUP: 'Wallet top-up',
  OTHER: 'KhatuPay payment'
};

export function invoiceNumber(prefix = 'KPINV') {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-6)}`;
}

export async function ensurePaymentInvoice(paymentOrId) {
  const payment = typeof paymentOrId === 'object'
    ? paymentOrId
    : await Payment.findById(paymentOrId);
  if (!payment || payment.status !== 'CONFIRMED') return null;

  const existing = await Invoice.findOne({ paymentId: payment._id });
  if (existing) return existing;

  const label = paymentLabels[payment.type] || paymentLabels.OTHER;
  const payeeName = payment.payeeDetails?.name ? ` to ${payment.payeeDetails.name}` : '';
  const serviceAmount = Number(payment.amount || 0);
  const taxableAmount = 0;

  const invoice = await Invoice.create({
    invoiceNumber: invoiceNumber(),
    userId: payment.userId,
    paymentId: payment._id,
    amount: serviceAmount,
    taxableAmount,
    cgst: 0,
    sgst: 0,
    igst: 0,
    gstin: COMPANY.gstin,
    companyName: COMPANY.name,
    companyAddress: COMPANY.address,
    date: payment.updatedAt || payment.createdAt || new Date(),
    dueDate: payment.updatedAt || payment.createdAt || new Date(),
    status: 'PAID',
    invoiceType: payment.type,
    description: `${label}${payeeName}`,
    notes: [
      `KhatuPay Payment ID: ${payment.khatuPaymentId || payment._id}`,
      payment.gateway?.paymentId ? `Gateway Payment ID: ${payment.gateway.paymentId}` : '',
      payment.payeeDetails?.vpa ? `UPI ID: ${payment.payeeDetails.vpa}` : '',
      payment.metadata?.notes ? `Note: ${payment.metadata.notes}` : ''
    ].filter(Boolean).join(' | '),
    items: [{
      description: `${label}${payeeName}`,
      quantity: 1,
      rate: serviceAmount,
      total: serviceAmount
    }]
  });

  return invoice;
}
