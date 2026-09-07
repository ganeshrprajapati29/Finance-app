import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';
import User from '../models/User.js';
import CreditReport from '../models/CreditReport.js';
import {
  decentroConfigured,
  fetchCreditReportCustomerData,
  fetchCreditReportSummary,
  fetchCreditScore,
  maskPan,
  normalizeCreditReportInput,
  presentDecentroStatus,
  sanitizeCreditPayload
} from '../services/decentroCreditReport.js';
import decentroConfig from '../config/decentro.js';

const router = Router();

const schema = Joi.object({
  referenceId: Joi.string().allow(''),
  name: Joi.string().min(2).required(),
  mobile: Joi.string().pattern(/^\d{10}$/).required(),
  pan: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/i).required(),
  dob: Joi.string().allow(''),
  dateOfBirth: Joi.string().allow(''),
  address: Joi.string().allow(''),
  addressType: Joi.string().valid('H', 'O', 'X', 'h', 'o', 'x').allow('').default('H'),
  address_type: Joi.string().valid('H', 'O', 'X', 'h', 'o', 'x').allow(''),
  pincode: Joi.string().pattern(/^\d{6}$/).allow(''),
  documentType: Joi.string().allow('').default('PAN'),
  document_type: Joi.string().allow(''),
  documentId: Joi.string().allow(''),
  document_id: Joi.string().allow(''),
  bureau: Joi.string().allow(''),
  purpose: Joi.string().min(20).max(50).allow('').default('For loan eligibility assessment'),
  consentPurpose: Joi.string().min(20).max(50).allow(''),
  inquiryPurpose: Joi.string().valid('BL', 'CL', 'CC', 'GL', 'HL', 'PL', 'bl', 'cl', 'cc', 'gl', 'hl', 'pl').allow('').default('PL'),
  inquiry_purpose: Joi.string().valid('BL', 'CL', 'CC', 'GL', 'HL', 'PL', 'bl', 'cl', 'cc', 'gl', 'hl', 'pl').allow(''),
  generatePdf: Joi.boolean().default(false),
  generate_pdf: Joi.boolean(),
  reportType: Joi.string().allow(''),
  consent: Joi.boolean().valid(true).required()
});

function extractScore(response = {}) {
  const candidates = [
    response.score,
    response.credit_score,
    response.data?.score,
    response.data?.credit_score,
    response.result?.score,
    response.result?.credit_score,
    response.creditReport?.score,
    response.credit_report?.score,
    response.data?.scoreDetails?.[0]?.value,
    response.data?.cCRResponse?.cIRReportDataLst?.[0]?.cIRReportData?.scoreDetails?.[0]?.value
  ];
  for (const item of candidates) {
    const value = Number(item);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

async function handleCreditRequest(req, res, next, type, caller) {
  try {
    if (!decentroConfigured()) {
      return fail(res, 'DECENTRO_NOT_CONFIGURED', 'Decentro credentials are not configured', 503);
    }
    const payload = await schema.validateAsync(req.body, { abortEarly: false });
    const user = await User.findById(req.user.uid).select('name mobile');
    if (!user) return fail(res, 'NOT_FOUND', 'User not found', 404);

    const decentroPayload = normalizeCreditReportInput(payload, user);
    if (decentroPayload.consent !== true) {
      return fail(res, 'CONSENT_REQUIRED', 'Customer consent is required for credit report pull', 400);
    }

    const response = await caller(decentroPayload);
    const score = extractScore(response);
    const record = await CreditReport.create({
      userId: req.user.uid,
      environment: decentroConfig.env,
      referenceId: decentroPayload.reference_id,
      name: payload.name,
      mobile: payload.mobile,
      panMasked: maskPan(payload.pan),
      bureau: payload.bureau,
      status: response.status || response.decentroTxnStatus || response.response_status || 'RECEIVED',
      score,
      purpose: payload.purpose,
      consent: {
        accepted: true,
        timestamp: new Date(),
        ip: req.ip,
        userAgent: req.get('user-agent')
      },
      request: sanitizeCreditPayload(decentroPayload),
      response
    });

    ok(res, { id: record._id, referenceId: record.referenceId, type, score, response }, 'Credit report response received');
  } catch (error) {
    if (error.isJoi) {
      return fail(res, 'INVALID_CREDIT_REPORT_PAYLOAD', error.message, 400);
    }
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        code: 'DECENTRO_CREDIT_REPORT_FAILED',
        message: error.message,
        data: error.data
      });
    }
    next(error);
  }
}

router.get('/config', requireAuth, async (req, res) => {
  ok(res, presentDecentroStatus(), 'Decentro credit report config');
});

router.post('/summary', requireAuth, (req, res, next) => {
  handleCreditRequest(req, res, next, 'summary', fetchCreditReportSummary);
});

router.post('/customer-data', requireAuth, (req, res, next) => {
  handleCreditRequest(req, res, next, 'customer_data', fetchCreditReportCustomerData);
});

router.post('/score', requireAuth, (req, res, next) => {
  handleCreditRequest(req, res, next, 'score', fetchCreditScore);
});

router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const rows = await CreditReport.find({ userId: req.user.uid })
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 20, 100))
      .select('-response -request')
      .lean();
    ok(res, rows);
  } catch (error) {
    next(error);
  }
});

export default router;
