import { Router } from 'express';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
// import rateLimit from 'express-rate-limit'; // Commented out for development
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import { ok, fail } from '../utils/response.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../utils/jwt.js';
import { sendMail } from '../services/mailer.js';

const router = Router();

// 🧠 Prevent brute-force (disabled for development)
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100,
//   standardHeaders: true,
// });
// router.use(authLimiter);

// Utility: Generate random 6-digit OTP
function genOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/* ===============================
   REGISTER
   =============================== */
router.post('/register', async (req, res, next) => {
  try {
    const schema = Joi.object({
      name: Joi.string().min(2).required(),
      email: Joi.string().email().required(),
      mobile: Joi.string().min(8).required(),
      password: Joi.string().min(6).required(),
    });

    const { name, email, mobile, password } = await schema.validateAsync(req.body);

    const exists = await User.findOne({ $or: [{ email }, { mobile }] });
    if (exists)
      return fail(res, 'USER_EXISTS', 'Email or mobile already registered', 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      mobile,
      passwordHash,
      roles: ['user'], // default role
      status: 'active',
    });

    // Generate and email OTP
    const otp = genOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await Otp.create({ email, otp, purpose: 'email_verify', expiresAt });

    await sendMail(
      email,
      'Verify your email - Khatu Pay',
      `<p>Hi ${name},</p><p>Your OTP is <b>${otp}</b> (valid for 10 minutes)</p>`,
      `OTP: ${otp}`
    );

    ok(res, { userId: user._id, email }, 'Registered successfully. OTP sent.');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

/* ===============================
   VERIFY EMAIL
   =============================== */
router.post('/verify-email', async (req, res, next) => {
  try {
    const { email, otp } = await Joi.object({
      email: Joi.string().email().required(),
      otp: Joi.string().length(6).required(),
    }).validateAsync(req.body);

    const record = await Otp.findOne({
      email,
      otp,
      purpose: 'email_verify',
      used: false,
    });

    if (!record) return fail(res, 'INVALID_OTP', 'Invalid OTP', 400);
    if (record.expiresAt < new Date()) return fail(res, 'OTP_EXPIRED', 'OTP expired', 400);

    await User.updateOne({ email }, { $set: { emailVerified: true } });
    record.used = true;
    await record.save();

    ok(res, { emailVerified: true }, 'Email verified successfully');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

/* ===============================
   LOGIN (email or mobile)
   =============================== */
router.post('/login', async (req, res, next) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email(),
      mobile: Joi.string().min(8),
      password: Joi.string().required(),
    }).xor('email', 'mobile');

    const { email, mobile, password } = await schema.validateAsync(req.body);

    // Find user by email or mobile
    const user = await User.findOne(email ? { email: email.toLowerCase() } : { mobile });
    if (!user) return fail(res, 'INVALID_CREDENTIALS', 'Invalid credentials', 401);

    // 🧠 Important: use passwordHash, not password
    const okPwd = await bcrypt.compare(password, user.passwordHash);
    if (!okPwd) return fail(res, 'INVALID_CREDENTIALS', 'Invalid credentials', 401);

    if (user.status !== 'active')
      return fail(res, 'USER_BLOCKED', 'User is blocked', 403);

    const payload = { uid: user._id.toString(), roles: user.roles };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    ok(
      res,
      {
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          roles: user.roles,
          emailVerified: user.emailVerified,
        },
      },
      'Login successful'
    );
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

/* ===============================
   REFRESH TOKEN
   =============================== */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = await Joi.object({
      refreshToken: Joi.string().required(),
    }).validateAsync(req.body);

    try {
      const payload = verifyToken(refreshToken, 'refresh');
      const accessToken = signAccessToken({
        uid: payload.uid,
        roles: payload.roles,
      });
      ok(res, { accessToken }, 'Access token refreshed');
    } catch (e) {
      return fail(res, 'INVALID_REFRESH', 'Invalid or expired refresh token', 401);
    }
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

/* ===============================
   FORGOT PASSWORD (Send OTP)
   =============================== */
router.post('/forgot', async (req, res, next) => {
  try {
    const { email } = await Joi.object({
      email: Joi.string().email().required(),
    }).validateAsync(req.body);

    const otp = genOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await Otp.create({ email, otp, purpose: 'password_reset', expiresAt });

    await sendMail(
      email,
      'Reset password OTP - Khatu Pay',
      `<p>Your password reset OTP is <b>${otp}</b></p>`,
      `OTP: ${otp}`
    );

    ok(res, {}, 'If account exists, OTP has been sent');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

/* ===============================
   RESET PASSWORD
   =============================== */
router.post('/reset', async (req, res, next) => {
  try {
    const { email, otp, newPassword } = await Joi.object({
      email: Joi.string().email().required(),
      otp: Joi.string().length(6).required(),
      newPassword: Joi.string().min(6).required(),
    }).validateAsync(req.body);

    const record = await Otp.findOne({
      email,
      otp,
      purpose: 'password_reset',
      used: false,
    });

    if (!record) return fail(res, 'INVALID_OTP', 'Invalid OTP', 400);
    if (record.expiresAt < new Date()) return fail(res, 'OTP_EXPIRED', 'OTP expired', 400);

    const user = await User.findOne({ email });
    if (!user) return fail(res, 'USER_NOT_FOUND', 'User not found', 404);

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    record.used = true;
    await record.save();

    ok(res, {}, 'Password reset successful');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

export default router;
