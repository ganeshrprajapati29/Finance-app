import MerchantBankAccount from '../models/MerchantBankAccount.js';
import {
  RazorpayPartnerError, createRazorpayStakeholder, createRazorpaySubMerchant, fetchRazorpayTerms,
  mapRazorpayAccountStatus, requestRazorpayProductConfiguration, updateRazorpayProductConfiguration,
} from './razorpayPartner.js';

// Business onboarding for QR collections. The customer fills everything once;
// this module pushes it to Razorpay step by step and can always be re-run:
// every provider id is saved as soon as it exists, so a retry continues from
// the step that failed instead of creating a second Razorpay account.

export const RAZORPAY_CATEGORY_BY_BUSINESS_CATEGORY = Object.freeze({
  'Retail store': { category: 'ecommerce', subcategory: 'department_stores' },
  'Professional services': { category: 'services', subcategory: 'professional_services' },
  'Food and beverages': { category: 'food', subcategory: 'restaurant' },
  'Fashion and lifestyle': { category: 'ecommerce', subcategory: 'fashion_and_lifestyle' },
  'Recharge and bill payments': { category: 'utilities', subcategory: 'bill_and_recharge_aggregators' },
});

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

/** Customers paste GSTINs with spaces, dashes and lower case. */
export function normalizeGstin(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function gstinProblem(value) {
  const gstin = normalizeGstin(value);
  if (!gstin) return '';
  return GSTIN_PATTERN.test(gstin) ? '' : 'Enter a valid 15-character GSTIN, or leave it blank.';
}

const lower = (value) => String(value || '').toLowerCase();

// Razorpay has not enabled sub-merchant creation for the partner account, the
// token endpoint is rate limited, or Razorpay is down: none of these is the
// customer's fault, so the application waits in a queue instead of failing.
export function isProviderAccessIssue(error) {
  if (!(error instanceof RazorpayPartnerError)) return false;
  return error.code === 'RAZORPAY_PARTNER_UNAVAILABLE' || Number(error.status) >= 500 ||
    /access denied|not authori[sz]ed|permission|forbidden|too many requests|feature.*not enabled/i.test(error.message || '');
}

export const settlementConfiguration = (bank) => ({
  settlement: {
    account_number: bank.accountNumber,
    ifsc_code: bank.ifscCode,
    beneficiary_name: bank.accountHolderName,
  },
});

export function applyProviderProduct(business, product) {
  if (!product) return;
  business.razorpay.productId = product.id || business.razorpay.productId;
  business.razorpay.productStatus = product.status || business.razorpay.productStatus;
  business.razorpay.requirements = product.requirements || business.razorpay.requirements;
  business.razorpay.productConfiguration = product;
  if (product.status) business.status = mapRazorpayAccountStatus(product.status);
}

/**
 * Pushes the saved onboarding request to Razorpay. Safe to call repeatedly.
 * @returns {Promise<{ queued: boolean, reason?: string }>}
 */
export async function submitProviderOnboarding(business, user) {
  const request = business.onboardingRequest;
  if (!request) throw new RazorpayPartnerError('Submit your business details first.', { status: 409, code: 'ONBOARDING_NOT_STARTED' });
  const providerCategory = RAZORPAY_CATEGORY_BY_BUSINESS_CATEGORY[business.category] ||
    RAZORPAY_CATEGORY_BY_BUSINESS_CATEGORY['Retail store'];
  const email = business.email || user?.email;
  const phone = business.mobile || user?.mobile;
  const address = {
    street1: request.address.street1, street2: request.address.street2 || undefined,
    city: request.address.city, state: request.address.state,
    postal_code: request.address.postalCode, country: 'IN',
  };
  if (!business.razorpay) business.razorpay = {};
  try {
    if (!business.razorpay.accountId) {
      const terms = await fetchRazorpayTerms().catch(() => null);
      const account = await createRazorpaySubMerchant({
        email, phone,
        legal_business_name: request.legalBusinessName,
        customer_facing_business_name: request.customerFacingBusinessName,
        business_type: request.businessType,
        reference_id: business.publicId,
        profile: {
          category: providerCategory.category, subcategory: providerCategory.subcategory,
          business_model: request.businessModel, addresses: { operation: address, registered: address },
        },
        legal_info: {
          ...(request.legalPan ? { pan: request.legalPan } : {}),
          ...(request.gstNumber ? { gst: request.gstNumber } : {}),
          ...(request.cin ? { cin: request.cin } : {}),
        },
        brand: { color: '0F766E' }, notes: { khatupay_business_id: business.publicId },
        contact_name: business.ownerName,
        contact_info: { support: { email, phone, policy_url: 'https://khatupay.com/support' } },
        apps: { websites: ['https://khatupay.com'], android: [{ name: 'KhatuPay', url: 'https://play.google.com/store/apps/details?id=com.finance.khatupay' }] },
      });
      business.razorpay.accountId = account.id;
      business.razorpay.accountStatus = account.status;
      business.razorpay.requirements = account.requirements;
      if (terms) {
        business.razorpay.termsId = terms.id;
        business.razorpay.termsVersionAt = terms.last_published_at ? new Date(Number(terms.last_published_at) * 1000) : undefined;
      }
      business.status = mapRazorpayAccountStatus(account.status);
      // Saved before the next call so a failure below never loses the account id.
      await business.save();
    }
    if (!business.razorpay.stakeholderId) {
      const stakeholder = await createRazorpayStakeholder(business.razorpay.accountId, {
        percentage_ownership: request.ownership || 100, name: business.ownerName, email,
        relationship: { director: ['private_limited', 'public_limited', 'llp'].includes(request.businessType), executive: true },
        phone: { primary: phone },
        addresses: { residential: { street: request.address.street1, city: request.address.city, state: request.address.state, postal_code: request.address.postalCode, country: 'IN' } },
        kyc: { pan: user?.kyc?.panNumber }, notes: { khatupay_business_id: business.publicId },
      });
      business.razorpay.stakeholderId = stakeholder.id;
      await business.save();
    }
    if (!business.razorpay.productId) {
      const product = await requestRazorpayProductConfiguration(business.razorpay.accountId, { product_name: 'payment_gateway', tnc_accepted: true });
      applyProviderProduct(business, product);
      await business.save();
    }
    const productStatus = lower(business.razorpay.productStatus);
    if (!business.razorpay.settlementConfiguredAt && ['requested', 'needs_clarification'].includes(productStatus)) {
      const bank = await MerchantBankAccount.findOne({ businessId: business._id, status: 'VERIFIED' });
      if (bank) {
        const product = await updateRazorpayProductConfiguration(business.razorpay.accountId, business.razorpay.productId, settlementConfiguration(bank));
        applyProviderProduct(business, product);
        business.razorpay.settlementConfiguredAt = new Date();
      }
    }
    business.razorpay.providerState = 'SUBMITTED';
    business.razorpay.lastProviderError = undefined;
    business.razorpay.queuedAt = undefined;
    business.razorpay.lastSyncedAt = new Date();
    await business.save();
    return { queued: false };
  } catch (error) {
    if (!isProviderAccessIssue(error)) throw error;
    console.error('[merchant-onboarding] provider not available; application queued', {
      business: business.publicId, step: business.razorpay.accountId ? (business.razorpay.stakeholderId ? 'product' : 'stakeholder') : 'account',
      message: error.message,
    });
    business.razorpay.providerState = 'QUEUED';
    business.razorpay.lastProviderError = String(error.message || '').slice(0, 300);
    business.razorpay.queuedAt = business.razorpay.queuedAt || new Date();
    if (business.status === 'DRAFT') business.status = 'SUBMITTED';
    await business.save();
    return { queued: true, reason: business.razorpay.lastProviderError };
  }
}

const REQUIREMENT_LABELS = Object.freeze({
  'settlements.account_number': 'Settlement bank account number',
  'settlements.ifsc_code': 'Settlement bank IFSC',
  'settlements.beneficiary_name': 'Bank account holder name',
  individual_proof_of_address: 'Owner address proof',
  individual_proof_of_identification: 'Owner identity proof',
  business_proof_of_identification: 'Business proof document',
  business_proof_url: 'Business proof document',
  gst_certificate: 'GST certificate',
  shop_establishment_certificate: 'Shop establishment certificate',
  cancelled_cheque: 'Cancelled cheque',
  'kyc.pan': 'Owner PAN',
  'legal_info.pan': 'Business PAN',
  'legal_info.gst': 'GSTIN',
  'profile.business_model': 'Business activity description',
  name: 'Owner name',
  'contact_name': 'Contact name',
});

/** Turns Razorpay's requirement objects into text a shop owner can act on. */
export function describeRequirements(requirements) {
  if (!Array.isArray(requirements)) return [];
  const seen = new Set();
  const rows = [];
  for (const item of requirements) {
    const field = String(item?.field_reference || '').trim();
    if (!field || seen.has(field)) continue;
    seen.add(field);
    const isDocument = /document|proof|certificate|cheque/i.test(`${field} ${item?.resolution_url || ''}`);
    rows.push({
      field,
      label: REQUIREMENT_LABELS[field] || field.replace(/[._]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
      kind: isDocument ? 'DOCUMENT' : field.startsWith('settlements.') ? 'BANK' : 'DETAIL',
      reason: String(item?.reason_code || item?.status || 'required').replace(/_/g, ' '),
    });
  }
  return rows;
}

const step = (key, title, status, message, extra = {}) => ({ key, title, status, message, ...extra });

/**
 * 'oauth' (default): the owner connects (or creates) a Razorpay account on
 * Razorpay's own page and KhatuPay creates the QR with their authorisation.
 * 'api': KhatuPay creates the Razorpay account itself - needs Razorpay to
 * enable the partner onboarding API for the account.
 */
export const merchantOnboardingMode = () => {
  const configured = String(process.env.MERCHANT_ONBOARDING_MODE || '').trim().toLowerCase();
  if (configured === 'api' || configured === 'oauth') return configured;
  // Partner API keys mean KhatuPay can create sub-merchants itself.
  return String(process.env.RAZORPAY_PARTNER_KEY_ID || '').trim() ? 'api' : 'oauth';
};

function buildConnectChecklist({ business, qr, user }) {
  const razorpay = business.razorpay || {};
  const personalDone = user?.kyc?.panVerified === true && user?.kyc?.aadhaarVerified === true;
  const connected = Boolean(razorpay.oauthConnectedAt);
  const blocked = ['REJECTED', 'SUSPENDED'].includes(business.status);
  const qrActive = Boolean(qr && qr.provider === 'RAZORPAY_PARTNER' && qr.status === 'ACTIVE');
  const steps = [
    step('profile', 'Business profile', 'DONE', business.businessName),
    personalDone
      ? step('personalKyc', 'Owner PAN & Aadhaar', 'DONE', 'Your identity is verified.')
      : step('personalKyc', 'Owner PAN & Aadhaar', 'CURRENT', 'Verify your PAN and Aadhaar once. It takes about 2 minutes.'),
  ];
  if (blocked) steps.push(step('activation', 'Connect Razorpay', 'FAILED', business.rejectionReason || 'Your business is on hold. Contact KhatuPay support for help.'));
  else if (connected) steps.push(step('activation', 'Connect Razorpay', 'DONE', 'Your Razorpay account is connected.'));
  else steps.push(step('activation', 'Connect Razorpay', personalDone ? 'CURRENT' : 'LOCKED', 'Sign in to Razorpay (or create a free account) and allow KhatuPay to create your QR.'));
  if (qrActive) steps.push(step('qr', 'Business QR', 'DONE', 'Your QR is live. Display it at your counter.'));
  else steps.push(step('qr', 'Business QR', connected && !blocked ? 'CURRENT' : 'LOCKED', connected ? 'Create your QR and start collecting payments.' : 'Available right after you connect Razorpay.'));
  const done = steps.filter((item) => item.status === 'DONE').length;
  const next = steps.find((item) => ['CURRENT', 'FAILED'].includes(item.status));
  return {
    mode: 'oauth', steps, nextStep: next?.key || null, progress: Math.round((done / steps.length) * 100),
    canCreateQr: connected && !blocked && !qrActive, qrActive, connected, requirements: [],
    providerState: connected ? 'CONNECTED' : 'NOT_STARTED',
  };
}

/**
 * The single description of "where is this business in setup" used by the app.
 * Statuses: DONE, CURRENT (customer must act), REVIEW (waiting on KhatuPay or
 * Razorpay), FAILED (customer must fix), LOCKED.
 */
export function buildOnboardingChecklist({ business, bank, qr, user, mode = merchantOnboardingMode() } = {}) {
  if (!business) {
    return {
      mode, connected: false,
      steps: [step('profile', 'Create business profile', 'CURRENT', 'Tell us about your shop or service.')],
      nextStep: 'profile', progress: 0, canCreateQr: false, qrActive: false, requirements: [], providerState: 'NOT_STARTED',
    };
  }
  // A business that already went through API onboarding stays on that path.
  if (mode === 'oauth' && !business.razorpay?.productId) return buildConnectChecklist({ business, qr, user });
  const razorpay = business.razorpay || {};
  const productStatus = lower(razorpay.productStatus || razorpay.accountStatus);
  const personalDone = user?.kyc?.panVerified === true && user?.kyc?.aadhaarVerified === true;
  const bankStatus = String(bank?.status || '').toUpperCase();
  const bankDone = bankStatus === 'VERIFIED';
  const bankInReview = bankStatus === 'REVIEW';
  const detailsDone = Boolean(business.onboardingRequest || razorpay.accountId);
  const queued = razorpay.providerState === 'QUEUED' || (detailsDone && !razorpay.productId);
  const activated = productStatus === 'activated';
  const qrActive = Boolean(qr && qr.provider === 'RAZORPAY_PARTNER' && qr.status === 'ACTIVE');
  const requirements = describeRequirements(razorpay.requirements);

  const steps = [step('profile', 'Business profile', 'DONE', business.businessName)];

  steps.push(personalDone
    ? step('personalKyc', 'Owner PAN & Aadhaar', 'DONE', 'Your identity is verified.')
    : step('personalKyc', 'Owner PAN & Aadhaar', 'CURRENT', 'Verify your PAN and Aadhaar once. It takes about 2 minutes.'));

  if (bankDone) steps.push(step('bank', 'Settlement bank account', 'DONE', `${bank.bankName || 'Bank'} account ending ${String(bank.accountNumber || '').slice(-4)}`));
  else if (bankInReview) steps.push(step('bank', 'Settlement bank account', 'REVIEW', 'Bank details received. KhatuPay is verifying them.'));
  else if (bankStatus === 'FAILED') steps.push(step('bank', 'Settlement bank account', personalDone ? 'FAILED' : 'LOCKED', bank.verificationMessage || 'The bank account could not be verified. Check the details and try again.'));
  else steps.push(step('bank', 'Settlement bank account', personalDone ? 'CURRENT' : 'LOCKED', 'Add the bank account where your collections will be settled.'));

  const bankReady = bankDone || bankInReview;
  if (detailsDone) steps.push(step('businessDetails', 'Business details', 'DONE', 'Legal name, address and terms submitted.'));
  else steps.push(step('businessDetails', 'Business details', personalDone && bankReady ? 'CURRENT' : 'LOCKED', 'Legal name, business type and address for payment activation.'));

  let activation;
  if (!detailsDone) activation = step('activation', 'Payment activation', 'LOCKED', 'Starts automatically after you submit business details.');
  else if (activated) activation = step('activation', 'Payment activation', 'DONE', 'Your business is approved to accept payments.');
  else if (['rejected', 'suspended'].includes(productStatus) || ['REJECTED', 'SUSPENDED'].includes(business.status)) {
    activation = step('activation', 'Payment activation', 'FAILED', business.rejectionReason || 'Your business could not be approved. Contact KhatuPay support for help.');
  } else if (productStatus === 'needs_clarification' && requirements.length) {
    activation = step('activation', 'Payment activation', 'CURRENT', `${requirements.length} more detail${requirements.length === 1 ? '' : 's'} needed to finish verification.`);
  } else if (queued) {
    activation = step('activation', 'Payment activation', 'REVIEW', 'Your application is with the KhatuPay team. We will notify you as soon as payments are activated.');
  } else {
    activation = step('activation', 'Payment activation', 'REVIEW', 'Your business is under verification. This usually takes 1-3 working days.');
  }
  steps.push(activation);

  if (qrActive) steps.push(step('qr', 'Business QR', 'DONE', 'Your QR is live. Display it at your counter.'));
  else steps.push(step('qr', 'Business QR', activated ? 'CURRENT' : 'LOCKED', activated ? 'Create your QR and start collecting payments.' : 'Available right after payment activation.'));

  const done = steps.filter((item) => item.status === 'DONE').length;
  const next = steps.find((item) => ['CURRENT', 'FAILED'].includes(item.status));
  return {
    mode: 'api', connected: false,
    steps,
    nextStep: next?.key || null,
    progress: Math.round((done / steps.length) * 100),
    canCreateQr: activated && !qrActive,
    qrActive,
    requirements,
    providerState: razorpay.providerState || (razorpay.accountId ? 'SUBMITTED' : 'NOT_STARTED'),
  };
}
