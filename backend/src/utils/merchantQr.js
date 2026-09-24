import { velxapayConfig } from '../config/velxapay.js';
import MerchantQR from '../models/MerchantQR.js';
import QRCode from 'qrcode';

const clean = (value) => String(value || '').trim();

export function merchantPayUrl(publicId) {
  const base = String(velxapayConfig.publicPayBaseUrl || 'https://khatupay.com/pay/merchant').replace(/\/+$/, '');
  return `${base}/${encodeURIComponent(String(publicId || '').trim())}`;
}

export function merchantQrPayee() {
  return {
    vpa: clean(process.env.MERCHANT_QR_UPI_VPA) || clean(process.env.UPI_DEFAULT_VPA),
    name: clean(process.env.MERCHANT_QR_PAYEE_NAME) || clean(process.env.UPI_PAYEE_NAME) || 'Khatu Pay',
  };
}

export function merchantUpiPayload(business) {
  const qrReference = clean(business?.publicId);
  const businessName = clean(business?.businessName) || 'Khatu Pay Business';
  const payee = merchantQrPayee();
  if (!payee.vpa) {
    const error = new Error('Merchant UPI QR is not configured. Add MERCHANT_QR_UPI_VPA or UPI_DEFAULT_VPA.');
    error.status = 503;
    error.code = 'MERCHANT_QR_UPI_NOT_CONFIGURED';
    throw error;
  }

  const params = new URLSearchParams({
    pa: payee.vpa,
    pn: payee.name,
    cu: 'INR',
    tr: qrReference,
    tn: `Khatu Pay ${businessName} ${qrReference}`.slice(0, 80),
  });
  return `upi://pay?${params.toString()}`;
}

export function merchantVelxapayQrPayload(business) {
  const qrReference = clean(business?.publicId);
  if (!qrReference) {
    const error = new Error('Approved business QR reference is missing. Please refresh and try again.');
    error.status = 409;
    error.code = 'BUSINESS_QR_REFERENCE_MISSING';
    throw error;
  }
  return merchantPayUrl(qrReference);
}

export async function merchantQrImageDataUrl(payload) {
  return QRCode.toDataURL(String(payload || ''), {
    type: 'image/png',
    width: 720,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#053C3B',
      light: '#FFFFFF',
    },
  });
}

export async function activateMerchantQr(business, userId = business?.userId) {
  const businessId = business?._id;
  const qrReference = String(business?.publicId || '').trim();
  if (!businessId || !userId || !qrReference) {
    const error = new Error('Approved business details are incomplete. Please refresh and try again.');
    error.status = 409;
    error.code = 'BUSINESS_QR_DETAILS_MISSING';
    throw error;
  }

  const payee = merchantQrPayee();
  const payload = merchantVelxapayQrPayload(business);
  const qrImageDataUrl = await merchantQrImageDataUrl(payload);
  const historyEntry = {
    status: 'ACTIVE',
    note: 'QR activated for VelxaPay payment collection.',
    actor: 'SYSTEM',
    at: new Date(),
  };
  const update = {
    businessId,
    userId,
    qrReference,
    payload,
    paymentUrl: merchantPayUrl(qrReference),
    payeeVpa: payee.vpa,
    payeeName: payee.name,
    qrImageDataUrl,
    provider: 'VELXAPAY',
    collectionMode: 'VELXAPAY_CHECKOUT',
    status: 'ACTIVE',
    disabledAt: null,
    disabledReason: '',
  };
  const query = { $or: [{ businessId }, { qrReference }, { userId }] };

  const existing = await MerchantQR.find(query).sort({ updatedAt: -1 });
  const target = existing.find((qr) => String(qr.businessId) === String(businessId)) ||
    existing.find((qr) => qr.qrReference === qrReference) ||
    existing.find((qr) => String(qr.userId) === String(userId));

  if (target) {
    const staleIds = existing
      .filter((qr) => String(qr._id) !== String(target._id))
      .map((qr) => qr._id);
    if (staleIds.length) await MerchantQR.deleteMany({ _id: { $in: staleIds } });
    target.set(update);
    target.statusHistory = [...(target.statusHistory || []), historyEntry].slice(-30);
    return target.save();
  }

  try {
    return await MerchantQR.create({ ...update, statusHistory: [historyEntry] });
  } catch (error) {
    if (error?.code !== 11000) throw error;

    const duplicates = await MerchantQR.find(query).sort({ updatedAt: -1 });
    const duplicate = duplicates[0];
    if (!duplicate) throw error;
    const staleIds = duplicates.slice(1).map((qr) => qr._id);
    if (staleIds.length) await MerchantQR.deleteMany({ _id: { $in: staleIds } });
    duplicate.set(update);
    duplicate.statusHistory = [...(duplicate.statusHistory || []), historyEntry].slice(-30);
    return duplicate.save();
  }
}
