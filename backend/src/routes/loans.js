import { Router } from 'express';
import Joi from 'joi';
import Loan from '../models/Loan.js';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

// Create loan application (wizard or simple)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const schema = Joi.object({
      // wizard payload
      personal: Joi.object({
        name: Joi.string().required(),
        email: Joi.string().email().required(),
        mobile: Joi.string().required(),
        address: Joi.string().required(),
        fatherName: Joi.string().allow(''),
        motherName: Joi.string().allow(''),
      }).optional(),
      qualification: Joi.object({
        highestEducation: Joi.string().allow(''),
        stream: Joi.string().allow(''),
        institution: Joi.string().allow(''),
      }).optional(),
      employment: Joi.object({
        employmentType: Joi.string().allow(''),
        monthlyIncome: Joi.number().default(0),
        employerOrBusiness: Joi.string().allow(''),
        experienceYears: Joi.number().default(0),
      }).optional(),
      documents: Joi.object({
        aadhaarFrontUrl: Joi.string().allow(null,''),
        aadhaarBackUrl: Joi.string().allow(null,''),
        panUrl: Joi.string().allow(null,''),
        selfieUrl: Joi.string().allow(null,''),
      }).optional(),
      references: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        relation: Joi.string().required(),
        mobile: Joi.string().required()
      })).min(3).optional(),
      amountRequested: Joi.number().required(),
      tenureMonths: Joi.number().required(),
      purpose: Joi.string().allow('').default('Personal'),
      // simple mode
      docs: Joi.array().items(Joi.string()).optional(),
    });

    const payload = await schema.validateAsync(req.body);

    const loan = await Loan.create({
      userId: req.user.uid,
      application: {
        amountRequested: payload.amountRequested,
        tenureMonths: payload.tenureMonths,
        purpose: payload.purpose,
        personal: payload.personal,
        qualification: payload.qualification,
        employment: payload.employment,
        documents: payload.documents,
        references: payload.references,
      },
      status: 'PENDING'
    });

    ok(res, { loanId: loan._id }, 'Loan application submitted');
  } catch (e) { next(e); }
});

// list my loans
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await Loan.find({ userId: req.user.uid }).sort({ createdAt: -1 });
    ok(res, rows);
  } catch (e) { next(e); }
});

// get one
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);
    ok(res, loan);
  } catch (e) { next(e); }
});

export default router;
