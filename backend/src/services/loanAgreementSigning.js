import axios from 'axios';
import Loan from '../models/Loan.js';
import LoanVerification from '../models/LoanVerification.js';
import { privatePdfDeliveryUrl, uploadPdfToCloudinary } from './cloudinary.js';
import { agreementSha256, generateLoanAgreementPdf } from './loanAgreement.js';
import { SignCareError, createESign, getESignAudit, getESignStatus, signcareRequestId } from './signcare.js';

// Everything about the borrower agreement and its Aadhaar eSign lives here so
// the customer app, the admin panel, the SignCare webhook and the background
// job all move a loan through the same states:
//   NOT_AVAILABLE -> PENDING_SIGNATURE (PDF generated at approval)
//   -> SIGNING (SignCare document created) -> SIGNED | FAILED (can restart)

const SIGNING_LINK_TTL_MS = 24 * 60 * 60 * 1000;
const LOCK_MS = 60 * 1000;
const UPLOAD_TIMEOUT_MS = 25_000;
const DOWNLOAD_TIMEOUT_MS = 15_000;
const COMPLETED = new Set(['COMPLETED', 'COMPLETE', 'SIGNED', 'SUCCESS']);
const TERMINAL_FAILURE = new Set(['FAILED', 'REJECTED', 'DECLINED', 'EXPIRED', 'REVOKED', 'CANCELLED', 'CANCELED']);

export class AgreementError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.code = code;
    this.status = status;
    this.expose = true;
  }
}

// Provider billing/configuration messages must not be shown verbatim to a
// borrower, but the app should explain that this is not a document error.
export function eSignStartFailure(error) {
  const providerMessage = String(error?.providerMessage || error?.message || '');
  if (/insufficient\s+wallet\s+balance|wallet\s+balance.*top\s*up/i.test(providerMessage)) {
    return new AgreementError(
      'ESIGN_SERVICE_UNAVAILABLE',
      'Digital agreement signing is temporarily unavailable. Please contact KhatuPay support.',
      503,
    );
  }
  return new AgreementError(
    'ESIGN_START_FAILED',
    'The signing page could not be created. Please try again in a moment.',
    error?.status >= 500 ? 503 : 422,
  );
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

const upper = (value) => String(value || '').trim().toUpperCase();

/**
 * Older loans only have decision.agreement* fields. Build loan.agreement from
 * them so every code path can rely on one shape.
 */
export function hydrateAgreement(loan) {
  if (loan.agreement?.status) return loan.agreement;
  const decision = loan.decision || {};
  const legacy = upper(decision.agreementStatus);
  let status = 'NOT_AVAILABLE';
  if (legacy === 'SIGNED' && decision.signedAgreementUrl) status = 'SIGNED';
  else if (decision.agreementDocumentId) status = 'SIGNING';
  else if (decision.agreementUrl || legacy === 'PENDING_SIGNATURE') status = 'PENDING_SIGNATURE';
  loan.agreement = {
    status,
    agreementUrl: decision.agreementUrl || '',
    documentId: decision.agreementDocumentId || '',
    signedAgreementUrl: decision.signedAgreementUrl || '',
    signedAt: decision.agreementSignedAt || null,
    attempts: decision.agreementDocumentId ? 1 : 0,
  };
  return loan.agreement;
}

/** Keeps decision.agreement* equal to loan.agreement for older clients. */
export function mirrorAgreementToDecision(loan) {
  const agreement = loan.agreement || {};
  if (!loan.decision) loan.decision = {};
  loan.decision.agreementStatus = agreement.status === 'SIGNING' ? 'PENDING_SIGNATURE' : agreement.status;
  loan.decision.agreementUrl = agreement.agreementUrl || loan.decision.agreementUrl || '';
  loan.decision.agreementDocumentId = agreement.documentId || '';
  loan.decision.signedAgreementUrl = agreement.signedAgreementUrl || '';
  loan.decision.agreementSignedAt = agreement.signedAt || null;
}

/** What the customer app and admin panel may see; never the signing link of someone else. */
export function agreementView(loan, { includeSigningUrl = false } = {}) {
  const agreement = hydrateAgreement(loan);
  const agreementUrl = privatePdfDeliveryUrl(agreement.agreementUrl) || agreement.agreementUrl || '';
  const signedAgreementUrl = privatePdfDeliveryUrl(agreement.signedAgreementUrl) || agreement.signedAgreementUrl || '';
  return {
    status: agreement.status,
    // This response URL is deliberately short-lived. The persistent storage
    // URL remains in MongoDB and is never exposed as the app's document link.
    agreementUrl,
    signedAgreementUrl,
    documentId: agreement.documentId || '',
    signedAt: agreement.signedAt || null,
    signerStatus: agreement.signerStatus || '',
    providerStatus: agreement.providerStatus || '',
    lastError: agreement.lastError || '',
    lastSyncedAt: agreement.lastSyncedAt || null,
    auditTrailStatus: agreement.auditTrailStatus || 'NOT_STARTED',
    attempts: agreement.attempts || 0,
    ...(includeSigningUrl && agreement.status === 'SIGNING' ? { signingUrl: agreement.signingUrl || '' } : {}),
  };
}

/** Generates, uploads and fingerprints the agreement a loan is approved with. */
export async function prepareApprovedAgreement(loan, borrower) {
  const pdf = await generateLoanAgreementPdf(loan, borrower);
  const uploaded = await withTimeout(
    uploadPdfToCloudinary(pdf, 'khatupay/loan-agreements'),
    UPLOAD_TIMEOUT_MS,
    'Agreement upload timed out.',
  );
  loan.agreement = {
    status: 'PENDING_SIGNATURE',
    agreementUrl: uploaded.secure_url,
    agreementSha256: agreementSha256(pdf),
    generatedAt: new Date(),
    attempts: 0,
    auditTrailStatus: 'NOT_STARTED',
  };
  mirrorAgreementToDecision(loan);
  return pdf;
}

// Sign exactly the PDF the admin approved: download it and check its hash.
async function approvedAgreementPdf(loan, borrower) {
  const agreement = hydrateAgreement(loan);
  if (!agreement.agreementUrl) return prepareApprovedAgreement(loan, borrower);
  let pdf;
  try {
    const response = await axios.get(agreement.agreementUrl, { responseType: 'arraybuffer', timeout: DOWNLOAD_TIMEOUT_MS });
    pdf = Buffer.from(response.data);
  } catch (error) {
    console.error('[Agreement] approved PDF download failed', { loanId: String(loan._id), message: error.message });
    // Older agreements may have been uploaded with Cloudinary auto-detection.
    // Rebuild the same immutable loan terms as a proper raw PDF once.
    return prepareApprovedAgreement(loan, borrower);
  }
  if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    console.error('[Agreement] approved document was not a PDF', { loanId: String(loan._id) });
    return prepareApprovedAgreement(loan, borrower);
  }
  const hash = agreementSha256(pdf);
  if (agreement.agreementSha256 && agreement.agreementSha256 !== hash) {
    throw new AgreementError('AGREEMENT_CHANGED', 'The approved agreement file does not match its record. Please contact support.', 409);
  }
  agreement.agreementSha256 = hash;
  return pdf;
}

// Repair an older auto-uploaded Cloudinary document before handing its URL to
// the mobile app. The loan terms are immutable once the application is
// approved, so this can only regenerate the same agreement.
export async function ensureApprovedAgreementDocument(loan, borrower) {
  await approvedAgreementPdf(loan, borrower);
  await persistAgreement(loan);
  return agreementView(loan);
}

// SignCare ExternalDocUserInfo: name allows letters, digits, spaces and , @ _ . ' - ( ) [ ];
// emailId is required and must contain "@" and "."; mobileNo is 10 digits.
export function signerIdentity({ borrower = {}, loan = {} } = {}) {
  const personal = loan.application?.personal || {};
  const name = String(borrower.name || personal.name || '')
    .replace(/[^A-Za-z0-9 ,@_.'()[\]-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  const emailId = String(borrower.email || personal.email || '').trim().toLowerCase();
  const mobileNo = String(borrower.mobile || personal.mobile || '').replace(/\D/g, '').slice(-10);
  if (name.length < 2) {
    throw new AgreementError('NAME_REQUIRED', 'Add your full name in your profile before signing the agreement.', 409);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailId)) {
    throw new AgreementError('EMAIL_REQUIRED', 'Add a valid email address in your profile before signing the agreement.', 409);
  }
  return { name, emailId, ...(/^\d{10}$/.test(mobileNo) ? { mobileNo } : {}) };
}

export function buildESignPayload({ loan, signer, pdf, attempt }) {
  const reference = String(loan.loanAccountNumber || loan._id).replace(/[^A-Za-z0-9]/g, '');
  return {
    referenceId: `KP-LOAN-${String(loan._id)}-${attempt}`.slice(0, 64),
    documentInfo: { name: `KhatuPay Loan Agreement ${reference}.pdf`, content: pdf.toString('base64') },
    sequentialSigning: false,
    userInfo: [{
      ...signer,
      userType: 'Signer',
      signatureType: 'Aadhaar',
      userReferenceId: `KPUSER-${String(loan.userId?._id || loan.userId)}`.slice(0, 64),
      aadhaarOptions: { otp: true, biometricThumbScan: false, irisScan: false, face: false },
      // PageToBeSigned 2 = LAST page, Coordinates 4 = Bottom_Right. The PDF keeps
      // that corner of its last page empty (see loanAgreement.js).
      pageToBeSigned: 2,
      signAppearance: 4,
    }],
    senderName: 'KhatuPay',
    descriptionForInvitee: 'Review and sign your KhatuPay loan agreement.',
    skipVerificationCode: false,
  };
}

const providerData = (result) => {
  const body = result?.response || {};
  return body?.data && typeof body.data === 'object' ? body.data : body;
};

export function readStatus(data = {}) {
  const signer = Array.isArray(data.signerInfo) ? data.signerInfo[0] || {} : {};
  const providerStatus = upper(data.documentStatus || data.status);
  const signerStatus = upper(signer.signerStatus);
  const content = data.content || data.documentContent || data.signedDocument || data.document?.content || '';
  const signedDocumentUrl = String(
    data.signedDocumentUrl || data.signedPdfUrl || data.documentUrl ||
    data.documentDownloadUrl || data.documentDownloadLink || data.document?.url || '',
  ).trim();
  return {
    providerStatus,
    signerStatus,
    esignLink: String(signer.esignLink || '').trim(),
    rejectReason: String(signer.rejectReason || '').trim(),
    content,
    signedDocumentUrl,
    completed: COMPLETED.has(providerStatus) || (COMPLETED.has(signerStatus) && Boolean(content || signedDocumentUrl)),
    failed: TERMINAL_FAILURE.has(providerStatus) || TERMINAL_FAILURE.has(signerStatus),
  };
}

export function signingStartDetails(data = {}) {
  const signer = (Array.isArray(data.userInfo) && data.userInfo[0]) ||
    (Array.isArray(data.signerInfo) && data.signerInfo[0]) || {};
  return {
    documentId: String(data.documentId || data.document_id || data.id || '').trim(),
    documentReferenceId: String(data.documentReferenceId || data.document_reference_id || '').trim(),
    signingUrl: String(
      signer.esignLink || signer.eSignLink || signer.signingUrl ||
      data.esignLink || data.eSignLink || data.signingUrl || data.url || '',
    ).trim(),
  };
}

async function signedPdfBuffer(status, loanId) {
  if (status.content) {
    const base64 = String(status.content).replace(/^data:[^;]+;base64,/i, '').replace(/\s/g, '');
    return Buffer.from(base64, 'base64');
  }
  if (!status.signedDocumentUrl) return null;
  try {
    const response = await axios.get(status.signedDocumentUrl, { responseType: 'arraybuffer', timeout: DOWNLOAD_TIMEOUT_MS });
    return Buffer.from(response.data);
  } catch (error) {
    console.error('[Agreement] signed PDF download failed', { loanId: String(loanId), message: error.message });
    return null;
  }
}

async function claimLoan(loanId) {
  const now = new Date();
  const result = await Loan.updateOne(
    { _id: loanId, $or: [{ 'agreement.lockUntil': { $exists: false } }, { 'agreement.lockUntil': null }, { 'agreement.lockUntil': { $lt: now } }] },
    { $set: { 'agreement.lockUntil': new Date(now.getTime() + LOCK_MS) } },
  );
  return result.modifiedCount === 1;
}

const releaseLoan = (loanId) => Loan.updateOne({ _id: loanId }, { $unset: { 'agreement.lockUntil': 1 } }).catch(() => {});

async function persistAgreement(loan) {
  mirrorAgreementToDecision(loan);
  const agreement = { ...(loan.agreement?.toObject?.() || loan.agreement) };
  delete agreement.lockUntil;
  await Loan.updateOne(
    { _id: loan._id, 'agreement.status': { $ne: 'SIGNED' } },
    { $set: {
      ...Object.fromEntries(Object.entries(agreement).map(([key, value]) => [`agreement.${key}`, value])),
      'decision.agreementStatus': loan.decision.agreementStatus,
      'decision.agreementUrl': loan.decision.agreementUrl,
      'decision.agreementDocumentId': loan.decision.agreementDocumentId,
    } },
  );
}

async function recordVerificationStage(userId, key, stage) {
  await LoanVerification.updateOne({ userId }, { $set: { [key]: { ...stage, updatedAt: new Date() } } }).catch((error) =>
    console.warn('[Agreement] verification stage update failed', { key, message: error.message }));
}

/**
 * Starts (or resumes) Aadhaar eSign for an APPROVED loan.
 * @returns {Promise<{status: string, signingUrl?: string, documentId?: string, reused?: boolean, signedAgreementUrl?: string}>}
 */
export async function startAgreementSigning(loan, borrower) {
  if (loan.status !== 'APPROVED') {
    throw new AgreementError('INVALID_STATE', 'The agreement becomes available after loan approval.', 409);
  }
  const agreement = hydrateAgreement(loan);
  if (agreement.status === 'SIGNED') return agreementView(loan);

  const signer = signerIdentity({ borrower, loan });
  if (!(await claimLoan(loan._id))) {
    throw new AgreementError('AGREEMENT_BUSY', 'Your signing page is being prepared. Please wait a few seconds and try again.', 409);
  }
  try {
    // Resume the existing SignCare document while its link is still valid.
    const fresh = agreement.status === 'SIGNING' && agreement.documentId &&
      agreement.signingStartedAt && Date.now() - new Date(agreement.signingStartedAt).getTime() < SIGNING_LINK_TTL_MS;
    if (agreement.status === 'SIGNING' && agreement.documentId) {
      const synced = await syncAgreementSignature(loan, { retry: false, actorType: 'USER', actorId: loan.userId }).catch((error) => {
        console.warn('[Agreement] status check before resume failed', { loanId: String(loan._id), message: error.message });
        return null;
      });
      if (synced?.status === 'SIGNED') return synced;
      if (synced?.status === 'SIGNING' && loan.agreement.signingUrl && fresh) {
        return { ...agreementView(loan), signingUrl: loan.agreement.signingUrl, reused: true };
      }
      if (!synced && fresh && agreement.signingUrl) {
        return { ...agreementView(loan), signingUrl: agreement.signingUrl, reused: true };
      }
    }

    const pdf = await approvedAgreementPdf(loan, borrower);
    const attempt = Number(loan.agreement.attempts || 0) + 1;
    const payload = buildESignPayload({ loan, signer, pdf, attempt });
    const requestId = signcareRequestId('KP-ESIGN');
    let result;
    try {
      result = await createESign(payload, requestId);
    } catch (error) {
      loan.agreement.lastError = error.message;
      loan.agreement.attempts = attempt;
      await persistAgreement(loan);
      if (error instanceof SignCareError) {
        throw eSignStartFailure(error);
      }
      throw error;
    }
    const data = providerData(result);
    const { documentId, documentReferenceId, signingUrl } = signingStartDetails(data);
    if (!documentId || !signingUrl) {
      throw new AgreementError('ESIGN_START_FAILED', 'The signing page could not be created. Please try again.', 502);
    }
    Object.assign(loan.agreement, {
      status: 'SIGNING',
      documentId,
      documentReferenceId,
      referenceId: payload.referenceId,
      attempts: attempt,
      signingUrl,
      signingStartedAt: new Date(),
      signerStatus: '',
      providerStatus: '',
      lastError: '',
    });
    await persistAgreement(loan);
    await recordVerificationStage(loan.userId, 'eSign', {
      status: 'PENDING', requestId: result.requestId || requestId, providerReference: documentId,
      message: 'Agreement is awaiting Aadhaar eSign.', data: { loanId: String(loan._id), documentId },
    });
    return { ...agreementView(loan), signingUrl, reused: false };
  } finally {
    await releaseLoan(loan._id);
  }
}

async function syncAuditTrail(loanId, documentId, userId) {
  try {
    const result = await getESignAudit(documentId, signcareRequestId('KP-ESIGN-AUDIT'));
    const data = providerData(result);
    const trail = typeof data === 'string' ? { text: data.slice(0, 20000) } : data;
    await Loan.updateOne({ _id: loanId }, { $set: { 'agreement.auditTrailStatus': 'VERIFIED', 'agreement.auditTrail': trail } });
    await recordVerificationStage(userId, 'auditTrail', {
      status: 'VERIFIED', providerReference: documentId, message: 'Digital signing audit trail verified.', verifiedAt: new Date(),
    });
  } catch (error) {
    console.warn('[Agreement] audit trail fetch failed', { loanId: String(loanId), message: error.message });
    await Loan.updateOne({ _id: loanId }, { $set: { 'agreement.auditTrailStatus': 'PENDING' } }).catch(() => {});
  }
}

/**
 * Asks SignCare for the signing status and, once signed, stores the signed PDF
 * and marks the loan SIGNED. Safe to run concurrently: only one caller wins the
 * SIGNED transition.
 */
export async function syncAgreementSignature(loan, { retry = true, actorType = 'SYSTEM', actorId, awaitAudit = false } = {}) {
  const agreement = hydrateAgreement(loan);
  if (agreement.status === 'SIGNED') return agreementView(loan);
  if (!agreement.documentId) {
    throw new AgreementError('ESIGN_NOT_STARTED', 'Agreement signing has not been started yet.', 409);
  }
  const requestId = signcareRequestId('KP-ESIGN-STATUS');
  const result = await getESignStatus({
    documentId: agreement.documentId,
    ...(agreement.documentReferenceId ? { documentReferenceId: agreement.documentReferenceId } : {}),
  }, requestId, { retry });
  const status = readStatus(providerData(result));
  agreement.providerStatus = status.providerStatus;
  agreement.signerStatus = status.signerStatus;
  agreement.lastSyncedAt = new Date();
  if (status.esignLink) agreement.signingUrl = status.esignLink;

  if (!status.completed) {
    if (status.failed) {
      agreement.status = 'FAILED';
      agreement.lastError = status.rejectReason || `Signing ${status.signerStatus || status.providerStatus || 'was not completed'}.`.toLowerCase();
    } else {
      agreement.status = 'SIGNING';
    }
    await persistAgreement(loan);
    return agreementView(loan);
  }

  const signedPdf = await signedPdfBuffer(status, loan._id);
  if (!signedPdf || !signedPdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    agreement.status = 'SIGNING';
    agreement.lastError = 'Signature complete; the signed copy is still being prepared.';
    await persistAgreement(loan);
    return { ...agreementView(loan), signedCopyPending: true };
  }

  const uploaded = await withTimeout(
    uploadPdfToCloudinary(signedPdf, 'khatupay/signed-loan-agreements'),
    UPLOAD_TIMEOUT_MS,
    'Signed agreement upload timed out.',
  );
  const signedAt = new Date();
  const updated = await Loan.findOneAndUpdate(
    { _id: loan._id, 'agreement.status': { $ne: 'SIGNED' } },
    {
      $set: {
        'agreement.status': 'SIGNED',
        'agreement.signedAgreementUrl': uploaded.secure_url,
        'agreement.signedAt': signedAt,
        'agreement.providerStatus': status.providerStatus,
        'agreement.signerStatus': status.signerStatus,
        'agreement.lastSyncedAt': signedAt,
        'agreement.lastError': '',
        'agreement.auditTrailStatus': 'PENDING',
        'decision.agreementStatus': 'SIGNED',
        'decision.signedAgreementUrl': uploaded.secure_url,
        'decision.agreementSignedAt': signedAt,
        'decision.agreementDocumentId': agreement.documentId,
      },
      $push: { statusHistory: {
        status: 'AGREEMENT_SIGNED', title: 'Agreement signed',
        message: 'The digital loan agreement was signed with Aadhaar eSign.',
        actorType, ...(actorId ? { actorId } : {}),
      } },
    },
    { new: true },
  );
  const winner = updated || await Loan.findById(loan._id);
  if (winner) {
    loan.agreement = winner.agreement;
    loan.decision = winner.decision;
    loan.statusHistory = winner.statusHistory;
  }
  if (updated) {
    await recordVerificationStage(loan.userId, 'eSign', {
      status: 'VERIFIED', providerReference: agreement.documentId, message: 'Loan agreement signed successfully.',
      verifiedAt: signedAt, data: { loanId: String(loan._id), documentId: agreement.documentId },
    });
    const audit = syncAuditTrail(loan._id, agreement.documentId, loan.userId);
    if (awaitAudit) await audit;
  }
  return agreementView(loan);
}
