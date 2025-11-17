import { Router } from 'express';
import Joi from 'joi';
import Loan from '../models/Loan.js';
import Notification from '../models/Notification.js';
import { requireAuth } from '../middlewares/auth.js';
import { uploadMany } from '../middlewares/upload.js';
import { uploadToCloudinary } from '../services/cloudinary.js';
import { ok, fail } from '../utils/response.js';
import multer from 'multer';

// Memory storage for Cloudinary uploads
const memoryStorage = multer.memoryStorage();
const uploadManyMemory = (field='files', max=10) => multer({ storage: memoryStorage, limits:{ fileSize: 10*1024*1024 } }).array(field, max);

const router = Router();

// Create loan application (wizard or simple)
router.post('/', requireAuth, uploadManyMemory('files', 10), async (req, res, next) => {
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
      })).min(3).required(),
      bankDetails: Joi.object({
        bankName: Joi.string().required(),
        accountNumber: Joi.string().required(),
        ifscCode: Joi.string().required(),
        accountHolderName: Joi.string().required(),
      }).required(),
      amountRequested: Joi.number().required(),
      tenureMonths: Joi.number().required(),
      purpose: Joi.string().allow('').default('Personal'),
      // simple mode
      docs: Joi.array().items(Joi.string()).optional(),
    });

    const payload = await schema.validateAsync(req.body);

    // Handle document uploads to Cloudinary if files are provided
    let documents = payload.documents || {};
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer, 'loan-documents'));
      const results = await Promise.all(uploadPromises);

      // Map uploaded files to document fields based on original names or order
      const fileMap = {
        'aadhaar_front': 'aadhaarFrontUrl',
        'aadhaar_back': 'aadhaarBackUrl',
        'pan': 'panUrl',
        'selfie': 'selfieUrl'
      };

      results.forEach((result, index) => {
        const originalName = req.files[index].originalname.toLowerCase();
        let field = 'aadhaarFrontUrl'; // default

        if (originalName.includes('aadhaar') && originalName.includes('front')) {
          field = 'aadhaarFrontUrl';
        } else if (originalName.includes('aadhaar') && originalName.includes('back')) {
          field = 'aadhaarBackUrl';
        } else if (originalName.includes('pan')) {
          field = 'panUrl';
        } else if (originalName.includes('selfie')) {
          field = 'selfieUrl';
        }

        documents[field] = result.secure_url;
      });
    }

    // Generate 8-digit loan account number
    const generateLoanAccountNumber = () => {
      const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
      const random = Math.floor(Math.random() * 100); // 2-digit random number
      return (timestamp + random.toString().padStart(2, '0')).slice(-8); // Ensure exactly 8 digits
    };

    const loanAccountNumber = generateLoanAccountNumber();

    const loan = await Loan.create({
      userId: req.user.uid,
      loanAccountNumber: loanAccountNumber,
      application: {
        amountRequested: payload.amountRequested,
        tenureMonths: payload.tenureMonths,
        purpose: payload.purpose,
        personal: payload.personal,
        qualification: payload.qualification,
        employment: payload.employment,
        documents: documents,
        references: payload.references,
        bankDetails: payload.bankDetails,
      },
      status: 'PENDING'
    });

    // Create notification for admin about new loan application
    await Notification.create({
      userId: req.user.uid,
      title: 'New Loan Application Submitted',
      message: `${payload.personal?.name || 'A user'} has submitted a loan application for ₹${payload.amountRequested} for ${payload.tenureMonths} months`,
      type: 'loan',
      priority: 'HIGH',
      data: {
        loanId: loan._id,
        amountRequested: payload.amountRequested,
        tenureMonths: payload.tenureMonths,
        userName: payload.personal?.name,
        userEmail: payload.personal?.email
      }
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
