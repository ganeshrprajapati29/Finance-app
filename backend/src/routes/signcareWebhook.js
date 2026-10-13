import crypto from 'crypto';
import { Router } from 'express';
import Loan from '../models/Loan.js';
import LoanVerification from '../models/LoanVerification.js';
import signcareConfig from '../config/signcare.js';
import { syncAgreementSignature } from '../services/loanAgreementSigning.js';

const router = Router();

if (!signcareConfig.webhookSecret) {
  console.warn('[SignCare webhook] SIGNCARE_WEBHOOK_SECRET is not set; webhook calls are accepted without a token.');
}

// SignCare calls the URL we registered, which carries ?token=<secret>
// (see config/signcare.js). A header is accepted too for manual replays.
export function webhookTokenValid(req, secret = signcareConfig.webhookSecret) {
  if (!secret) return true;
  const supplied = String(req.query?.token || req.get?.('x-webhook-token') || '');
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

// DigiLocker and eSign webhooks use the same { success, data: {...} } envelope
// as their status APIs; older payloads arrive unwrapped.
export function unwrap(raw = {}) {
  const body = isObject(raw.data) ? raw.data : raw;
  if (!isObject(body)) return body;
  // SignCare status responses are camelCase, while its live callbacks use
  // PascalCase. Normalize both before classifying the event.
  return {
    ...body,
    transactionId: body.transactionId || body.TransactionId,
    documentId: body.documentId || body.DocumentId,
    documentReferenceId: body.documentReferenceId || body.DocumentReferenceId,
    documentStatus: body.documentStatus || body.DocumentStatus,
    signerInfo: body.signerInfo || body.SignerInfo,
    content: body.content || body.Content,
  };
}

export function classifyWebhook(body = {}) {
  if (Array.isArray(body.docs) || body.transactionId) return 'digilocker';
  if (body.verifiedClaims || body.verificationPassed !== undefined) return 'aadhaarOvse';
  if (body.documentStatus || Array.isArray(body.signerInfo) || body.documentId) return 'eSign';
  return 'unknown';
}

async function handleDigiLocker(body, raw) {
  const providerReference = String(body.transactionId || '');
  const reference = String(raw.request_id || body.referenceId || '');
  const query = { $or: [
    ...(providerReference ? [{ 'aadhaar.providerReference': providerReference }] : []),
    ...(reference ? [{ 'aadhaar.requestId': reference }] : []),
  ] };
  if (!query.$or.length) return;
  const record = await LoanVerification.findOne(query);
  // Status stays PENDING; GET /loan-verification/digilocker/result confirms it
  // with SignCare. Large eAadhaar files are not stored from the webhook.
  if (!record || record.aadhaar?.status === 'VERIFIED') return;
  const docs = Array.isArray(body.docs) ? body.docs.map(({ dataPdf, dataXml, ...rest }) => rest) : body.docs;
  record.aadhaar = {
    ...record.aadhaar?.toObject?.(), status: 'PENDING',
    requestId: record.aadhaar?.requestId || reference,
    providerReference: providerReference || record.aadhaar?.providerReference,
    message: 'DigiLocker update received; confirming document status.', updatedAt: new Date(),
    data: { ...body, docs },
  };
  await record.save();
}

async function handleAadhaarOvse(body) {
  const txnId = String(body.txnId || '');
  if (!txnId) return;
  const record = await LoanVerification.findOne({ 'aadhaar.providerReference': txnId });
  if (!record || record.aadhaar?.status === 'VERIFIED') return;
  record.aadhaar = {
    ...record.aadhaar?.toObject?.(), status: 'PENDING',
    message: 'Aadhaar update received; awaiting authoritative status check.', updatedAt: new Date(),
  };
  await record.save();
}

// The webhook is only a hint: syncAgreementSignature asks SignCare for the
// authoritative status before anything is marked SIGNED.
async function handleESign(body) {
  const documentId = String(body.documentId || '');
  const documentReferenceId = String(body.documentReferenceId || '');
  const query = { $or: [
    ...(documentId ? [{ 'agreement.documentId': documentId }, { 'decision.agreementDocumentId': documentId }] : []),
    ...(documentReferenceId ? [{ 'agreement.documentReferenceId': documentReferenceId }] : []),
  ] };
  if (!query.$or.length) return;
  const loan = await Loan.findOne(query);
  if (!loan) return;
  await syncAgreementSignature(loan, { actorType: 'SYSTEM' });
}

router.post('/', async (req, res) => {
  if (!webhookTokenValid(req)) {
    console.warn('[SignCare webhook] rejected call with a missing or wrong token', { ip: req.ip });
    return res.status(401).json({ received: false });
  }
  res.status(200).json({ received: true });
  const raw = req.body || {};
  const body = unwrap(raw);
  const kind = classifyWebhook(body);
  try {
    if (kind === 'digilocker') await handleDigiLocker(body, raw);
    else if (kind === 'aadhaarOvse') await handleAadhaarOvse(body);
    else if (kind === 'eSign') await handleESign(body);
    else console.info('[SignCare webhook] unrecognised payload', { keys: Object.keys(body).slice(0, 12) });
  } catch (error) {
    console.error('SignCare webhook reconciliation failed:', { kind, message: error.message });
  }
});

export default router;
