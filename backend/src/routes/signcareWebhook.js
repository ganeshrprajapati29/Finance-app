import { Router } from 'express';
import LoanVerification from '../models/LoanVerification.js';

const router = Router();

router.post('/', async (req, res) => {
  res.status(200).json({ received: true });
  try {
    const body = req.body || {};
    const reference = String(body.documentReferenceId || body.referenceId || body.txnId || '');
    const providerReference = String(body.documentId || body.transactionId || body.txnId || '');
    if (!reference && !providerReference) return;
    const query = { $or: [
      { 'aadhaar.requestId': reference }, { 'aadhaar.providerReference': providerReference },
      { 'eStamp.requestId': reference }, { 'eStamp.providerReference': providerReference },
      { 'eSign.requestId': reference }, { 'eSign.providerReference': providerReference },
    ] };
    const record = await LoanVerification.findOne(query);
    if (!record) return;
    if (Array.isArray(body.docs) || body.transactionId) {
      record.aadhaar = { ...record.aadhaar?.toObject?.(), status: 'PENDING', requestId: reference, providerReference, message: 'DigiLocker update received; confirming document status.', updatedAt: new Date(), data: body };
    } else if (body.verifiedClaims || body.verificationPassed !== undefined) {
      record.aadhaar = { ...record.aadhaar?.toObject?.(), status: 'PENDING', requestId: reference, providerReference, message: 'Aadhaar update received; awaiting authoritative status check.', updatedAt: new Date(), data: body };
    } else if (body.documentStatus || body.signerInfo) {
      record.eSign = { ...record.eSign?.toObject?.(), status: 'PENDING', requestId: reference, providerReference, message: 'eSign update received; awaiting authoritative status check.', updatedAt: new Date(), data: body };
    } else {
      record.eStamp = { ...record.eStamp?.toObject?.(), status: 'PENDING', requestId: reference, providerReference, message: 'eStamp update received; awaiting authoritative status check.', updatedAt: new Date(), data: body };
    }
    await record.save();
  } catch (error) {
    console.error('SignCare webhook reconciliation failed:', error.message);
  }
});

export default router;
