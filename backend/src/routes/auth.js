import { Router } from 'express';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import MobileOnboardingSession from '../models/MobileOnboardingSession.js';
import { ok, fail } from '../utils/response.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../utils/jwt.js';
import { sendOtpMail } from '../services/mailer.js';
import { sendApitxtOtp, OtpDeliveryError } from '../services/apitxtOtp.js';

import { requireAuth } from '../middlewares/auth.js';
import { ensureUserPaymentQr } from '../services/qrAuto.js';
import { notifyUserSmart } from '../services/smartNotifications.js';
import { decryptSessionMobile, encryptSessionMobile, hashSessionToken } from '../utils/secureMobileSession.js';

// India is the only supported mobile market for KhatuPay today. Accept common
// user input formats while storing one canonical 10-digit number everywhere.
const indianMobile = Joi.string().trim().custom((value, helpers) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('0091')) digits = digits.slice(4);
  else if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  if (!/^[6-9]\d{9}$/.test(digits)) return helpers.error('string.indianMobile');
  return digits;
}).messages({ 'string.indianMobile': 'Enter a valid 10-digit Indian mobile number.' });

const router = Router();

function authLimitFail(req, res) {
  return fail(res, 'TOO_MANY_REQUESTS', 'Too many attempts. Please try again later.', 429);
}

// Prevent brute-force on the whole auth surface (was previously disabled
// with no re-enable - security audit finding, 2026-08-16).
//
// `validate` is deliberately relaxed: express-rate-limit otherwise throws
// on every request whenever an X-Forwarded-For header is present without
// a matching `trust proxy` setting (set in app.js) - which silently broke
// login/register for everyone in production after these limiters were
// first added, since real traffic always arrives via a reverse proxy.
// Keeping validation off here means a proxy-topology mismatch degrades to
// "less precise limiting" instead of "requests fail".
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
  handler: authLimitFail,
});
router.use(authLimiter);

// Tighter limit specifically on credential-guessing endpoints.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
  handler: authLimitFail,
});

const mobileOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
  handler: authLimitFail,
});

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 15;

// Utility: Generate a crypto-secure random 6-digit OTP
function genOTP() {
  return String(crypto.randomInt(100000, 1000000));
}

function requestIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || '';
}

function isDifferentLoginContext(previous = {}, current = {}) {
  if (!previous.lastLoginAt) return false;
  const oldIp = String(previous.lastLoginIp || '');
  const oldAgent = String(previous.lastLoginUserAgent || '');
  const newIp = String(current.ip || '');
  const newAgent = String(current.userAgent || '');
  return Boolean((oldIp && newIp && oldIp !== newIp) || (oldAgent && newAgent && oldAgent !== newAgent));
}

// Store OTPs hashed, never in plaintext
async function createOtp(email, purpose, ttlMinutes = 10) {
  const normalizedEmail = email.toLowerCase();
  const otp = genOTP();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  await Otp.create({ email: normalizedEmail, otp: otpHash, purpose, expiresAt });
  return otp;
}

// Find the newest unused, unexpired OTP for email+purpose and verify the candidate against its hash
async function verifyOtp(email, purpose, candidate, { consume = true } = {}) {
  const record = await Otp.findOne({ email: email.toLowerCase(), purpose, used: false }).sort({ createdAt: -1 });
  if (!record) return { ok: false, error: 'INVALID_OTP' };
  if (record.expiresAt < new Date()) return { ok: false, error: 'OTP_EXPIRED' };
  if (record.attempts >= 5) return { ok: false, error: 'OTP_LOCKED' };

  const valid = await bcrypt.compare(candidate, record.otp);
  if (!valid) {
    record.attempts += 1;
    await record.save();
    return { ok: false, error: 'INVALID_OTP' };
  }

  if (consume) {
    record.used = true;
    await record.save();
  }
  return { ok: true, record };
}

async function createMobileOtp(mobile, purpose = 'mobile_verify', ttlMinutes = 10) {
  const otp = genOTP();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  await Otp.create({ mobile, otp: otpHash, purpose, expiresAt });
  return otp;
}

async function verifyMobileOtp(mobile, candidate, purpose = 'mobile_verify') {
  const record = await Otp.findOne({ mobile, purpose, used: false })
    .sort({ createdAt: -1 });
  if (!record) return { ok: false, error: 'INVALID_OTP' };
  if (record.expiresAt < new Date()) return { ok: false, error: 'OTP_EXPIRED' };
  if (record.attempts >= 5) return { ok: false, error: 'OTP_LOCKED' };
  const valid = await bcrypt.compare(candidate, record.otp);
  if (!valid) {
    record.attempts += 1;
    await record.save();
    return { ok: false, error: 'INVALID_OTP' };
  }
  record.used = true;
  await record.save();
  return { ok: true };
}

function otpFailure(res, error) {
  const messages = {
    INVALID_OTP: 'Incorrect OTP. Please check the 6-digit code and try again.',
    OTP_EXPIRED: 'OTP expired. Please request a new code.',
    OTP_LOCKED: 'Too many incorrect OTP attempts. Please request a new code.',
  };
  return fail(res, error, messages[error] || 'Incorrect OTP. Please try again.', 400);
}

function authSessionPayload(user) {
  const payload = { uid: user._id.toString(), roles: user.roles, sv: user.sessionVersion || 0 };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      khatuUpiId: user.khatuUpiId,
      roles: user.roles,
      emailVerified: user.emailVerified,
    },
  };
}

async function recordMobileLogin(user, req) {
  user.mobileVerified = true;
  user.security = {
    ...(user.security || {}),
    lastLoginAt: new Date(),
    lastLoginIp: requestIp(req),
    lastLoginUserAgent: req.headers['user-agent'] || '',
  };
  await user.save();
}

/* ===============================
   MOBILE-FIRST AUTHENTICATION
   =============================== */
router.post('/mobile-auth/send', mobileOtpLimiter, async (req, res, next) => {
  try {
    const { mobile } = await Joi.object({
      mobile: indianMobile.required(),
    }).validateAsync(req.body);
    const user = await User.findOne({ mobile }).select('status');
    if (user?.status === 'blocked') {
      return ok(res, {}, 'If this mobile number can access Khatu Pay, a verification code has been sent.');
    }
    const otp = await createMobileOtp(mobile, 'mobile_auth');
    try {
      await sendApitxtOtp({ mobile, otp, purpose: 'mobile_auth' });
    } catch (error) {
      await Otp.updateMany({ mobile, purpose: 'mobile_auth', used: false }, { $set: { used: true } });
      if (error instanceof OtpDeliveryError) return fail(res, 'OTP_DELIVERY_UNAVAILABLE', error.message, 503);
      throw error;
    }
    ok(res, {}, 'A verification code has been sent to your mobile number.');
  } catch (error) {
    if (error.isJoi) return fail(res, 'VALIDATION_ERROR', 'Enter a valid 10-digit Indian mobile number.', 400);
    next(error);
  }
});

router.post('/mobile-auth/verify', mobileOtpLimiter, async (req, res, next) => {
  try {
    const { mobile, otp } = await Joi.object({
      mobile: indianMobile.required(),
      otp: Joi.string().length(6).required(),
    }).validateAsync(req.body);
    const result = await verifyMobileOtp(mobile, otp, 'mobile_auth');
    if (!result.ok) return otpFailure(res, result.error);

    const user = await User.findOne({ mobile });
    if (user) {
      if (user.status !== 'active') return fail(res, 'ACCOUNT_BLOCKED', 'This account is temporarily unavailable. Please contact Khatu Pay support.', 403);
      await recordMobileLogin(user, req);
      return ok(res, { next: 'LOGIN', ...authSessionPayload(user) }, 'Login successful.');
    }

    const secret = crypto.randomBytes(32).toString('base64url');
    const session = await MobileOnboardingSession.create({
      tokenHash: hashSessionToken(secret),
      mobileCiphertext: encryptSessionMobile(mobile),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    return ok(res, {
      next: 'PROFILE',
      onboardingToken: `${session._id}.${secret}`,
    }, 'Mobile number verified. Complete your profile to continue.');
  } catch (error) {
    if (error.isJoi) return fail(res, 'VALIDATION_ERROR', 'Enter a valid mobile number and 6-digit code.', 400);
    next(error);
  }
});

router.post('/mobile-auth/complete-profile', credentialLimiter, async (req, res, next) => {
  try {
    const { onboardingToken, name, email, mpin, termsAccepted } = await Joi.object({
      onboardingToken: Joi.string().min(40).max(300).required(),
      name: Joi.string().trim().min(2).max(100).required(),
      email: Joi.string().email().allow('').optional(),
      mpin: Joi.string().pattern(/^\d{4}$/).required(),
      termsAccepted: Joi.boolean().valid(true).required(),
    }).validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    if (['0000', '1111', '1234'].includes(mpin)) return fail(res, 'WEAK_MPIN', 'Choose a stronger 4-digit MPIN.', 400);
    const [sessionId, secret] = onboardingToken.split('.');
    if (!sessionId || !secret) return fail(res, 'ONBOARDING_EXPIRED', 'Your verified session expired. Please start again.', 400);
    const session = await MobileOnboardingSession.findOne({
      _id: sessionId,
      tokenHash: hashSessionToken(secret),
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });
    const mobile = decryptSessionMobile(session?.mobileCiphertext);
    if (!session || !/^[6-9]\d{9}$/.test(mobile)) return fail(res, 'ONBOARDING_EXPIRED', 'Your verified session expired. Please start again.', 400);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const duplicate = await User.findOne({ $or: [{ mobile }, ...(normalizedEmail ? [{ email: normalizedEmail }] : [])] }).select('_id');
    if (duplicate) return fail(res, 'PROFILE_ALREADY_EXISTS', 'This mobile number already has an account. Please sign in again.', 409);
    const user = await User.create({
      name,
      mobile,
      mobileVerified: true,
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      mpinHash: await bcrypt.hash(mpin, 12),
      roles: ['user'],
      status: 'active',
    });
    session.usedAt = new Date();
    await session.save();
    await recordMobileLogin(user, req);
    ensureUserPaymentQr(user._id).catch((error) => console.error('Auto QR setup failed:', error.message));
    ok(res, { next: 'LOGIN', ...authSessionPayload(user) }, 'Profile created successfully.');
  } catch (error) {
    if (error.isJoi) return fail(res, 'VALIDATION_ERROR', 'Complete the required profile details.', 400);
    if (error?.code === 11000) return fail(res, 'PROFILE_ALREADY_EXISTS', 'This mobile number or email already has an account.', 409);
    next(error);
  }
});

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
      mpin: Joi.string().pattern(/^\d{4}$/).allow('', null),
    });

    const { name, email, mobile, password, mpin } = await schema.validateAsync(req.body);
    const normalizedEmail = email.toLowerCase();

    const exists = await User.findOne({ $or: [{ email: normalizedEmail }, { mobile }] });
    if (exists)
      return fail(res, 'USER_EXISTS', 'Email or mobile already registered', 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const mpinHash = mpin ? await bcrypt.hash(mpin, 12) : undefined;
    const user = await User.create({
      name,
      email: normalizedEmail,
      mobile,
      passwordHash,
      ...(mpinHash ? { mpinHash } : {}),
      roles: ['user'], // default role
      status: 'active',
    });

    // Generate and email OTP
    const otp = await createOtp(normalizedEmail, 'email_verify');

    await sendOtpMail(normalizedEmail, { name, otp, purpose: 'email_verify' });

    try {
      await ensureUserPaymentQr(user._id);
    } catch (qrError) {
      console.error('Auto QR setup failed:', qrError);
    }

    ok(res, { userId: user._id, email: normalizedEmail }, 'Registered successfully. OTP sent.');
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

    const result = await verifyOtp(email, 'email_verify', otp);
    if (!result.ok) {
      return otpFailure(res, result.error);
    }

    await User.updateOne({ email: email.toLowerCase() }, { $set: { emailVerified: true } });

    ok(res, { emailVerified: true }, 'Email verified successfully');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

router.post('/resend-verification', credentialLimiter, async (req, res, next) => {
  try {
    const { email } = await Joi.object({
      email: Joi.string().email().required(),
    }).validateAsync(req.body);

    const user = await User.findOne({ email: email.toLowerCase() });
    if (user && !user.emailVerified) {
      const otp = await createOtp(user.email, 'email_verify');
      await sendOtpMail(user.email, {
        name: user.name,
        otp,
        purpose: 'email_verify',
      });
    }

    ok(res, {}, 'If verification is pending, a new code has been sent');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

/* ===============================
   MOBILE OTP (APITxT delivery)
   =============================== */
router.post('/mobile-otp/send', mobileOtpLimiter, async (req, res, next) => {
  try {
    const { mobile } = await Joi.object({
      mobile: indianMobile.required(),
    }).validateAsync(req.body);

    const user = await User.findOne({ mobile }).select('_id status');
    if (!user || user.status !== 'active') {
      return ok(res, {}, 'If this mobile number is registered, a verification code has been sent.');
    }

    const otp = await createMobileOtp(mobile);
    try {
      await sendApitxtOtp({ mobile, otp, purpose: 'mobile_verify' });
    } catch (error) {
      // Do not retain a code that was never delivered.
      await Otp.updateMany(
        { mobile, purpose: 'mobile_verify', otp: { $exists: true }, used: false },
        { $set: { used: true } }
      );
      if (error instanceof OtpDeliveryError) {
        return fail(res, 'OTP_DELIVERY_UNAVAILABLE', error.message, 503);
      }
      throw error;
    }
    ok(res, {}, 'A verification code has been sent to your mobile number.');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', 'Enter a valid 10-digit Indian mobile number.', 400);
    next(err);
  }
});

router.post('/mobile-otp/verify', mobileOtpLimiter, async (req, res, next) => {
  try {
    const { mobile, otp } = await Joi.object({
      mobile: indianMobile.required(),
      otp: Joi.string().length(6).required(),
    }).validateAsync(req.body);
    const user = await User.findOne({ mobile });
    if (!user) return otpFailure(res, 'INVALID_OTP');
    const result = await verifyMobileOtp(mobile, otp);
    if (!result.ok) return otpFailure(res, result.error);
    user.mobileVerified = true;
    await user.save();
    ok(res, { mobileVerified: true }, 'Mobile number verified successfully.');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', 'Enter a valid mobile number and 6-digit code.', 400);
    next(err);
  }
});

/* ===============================
   MOBILE OTP LOGIN
   =============================== */
router.post('/login/mobile-otp/send', mobileOtpLimiter, async (req, res, next) => {
  try {
    const { mobile } = await Joi.object({
      mobile: indianMobile.required(),
    }).validateAsync(req.body);
    const user = await User.findOne({ mobile }).select('_id status');
    if (!user || user.status !== 'active') {
      return ok(res, {}, 'If this mobile number is registered, a verification code has been sent.');
    }
    const otp = await createMobileOtp(mobile, 'mobile_login');
    try {
      await sendApitxtOtp({ mobile, otp, purpose: 'mobile_login' });
    } catch (error) {
      await Otp.updateMany(
        { mobile, purpose: 'mobile_login', used: false },
        { $set: { used: true } }
      );
      if (error instanceof OtpDeliveryError) {
        return fail(res, 'OTP_DELIVERY_UNAVAILABLE', error.message, 503);
      }
      throw error;
    }
    ok(res, {}, 'A verification code has been sent to your mobile number.');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', 'Enter a valid 10-digit Indian mobile number.', 400);
    next(err);
  }
});

router.post('/login/mobile-otp/verify', mobileOtpLimiter, async (req, res, next) => {
  try {
    const { mobile, otp } = await Joi.object({
      mobile: indianMobile.required(),
      otp: Joi.string().length(6).required(),
    }).validateAsync(req.body);
    const user = await User.findOne({ mobile });
    if (!user || user.status !== 'active') return otpFailure(res, 'INVALID_OTP');
    const result = await verifyMobileOtp(mobile, otp, 'mobile_login');
    if (!result.ok) return otpFailure(res, result.error);

    user.mobileVerified = true;
    user.security = {
      ...(user.security || {}),
      lastLoginAt: new Date(),
      lastLoginIp: requestIp(req),
      lastLoginUserAgent: req.headers['user-agent'] || '',
    };
    await user.save();

    const payload = { uid: user._id.toString(), roles: user.roles, sv: user.sessionVersion || 0 };
    ok(res, {
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        khatuUpiId: user.khatuUpiId,
        roles: user.roles,
        emailVerified: user.emailVerified,
      },
    }, 'Login successful');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', 'Enter a valid mobile number and 6-digit code.', 400);
    next(err);
  }
});

/* ===============================
   LOGIN (email or mobile)
   =============================== */
router.post('/login', credentialLimiter, async (req, res, next) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email(),
      mobile: Joi.string().min(8),
      password: Joi.string(),
      mpin: Joi.string().pattern(/^\d{4}$/),
    }).xor('email', 'mobile');

    const { email, mobile, password, mpin } = await schema.validateAsync(req.body);
    if (!password && !mpin) return fail(res, 'VALIDATION_ERROR', 'Password or MPIN is required', 400);

    // Find user by email or mobile
    const user = await User.findOne(email ? { email: email.toLowerCase() } : { mobile });
    if (!user) return fail(res, 'INVALID_CREDENTIALS', 'Invalid credentials', 401);

    if (mpin) {
      if (user.pinResetRequired) return fail(res, 'PIN_RESET_REQUIRED', 'Your PIN was reset. Please set a new PIN via Forgot PIN.', 401);
      if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
        return fail(res, 'PIN_LOCKED', `Too many attempts. Try again after ${user.pinLockedUntil.toISOString()}`, 429);
      }
      if (!user.mpinHash) return fail(res, 'MPIN_NOT_SET', 'MPIN is not set for this account. Please login with password once.', 401);

      const okMpin = await bcrypt.compare(mpin, user.mpinHash);
      if (!okMpin) {
        user.pinAttempts = (user.pinAttempts || 0) + 1;
        if (user.pinAttempts >= PIN_MAX_ATTEMPTS) {
          user.pinLockedUntil = new Date(Date.now() + PIN_LOCK_MINUTES * 60 * 1000);
          await user.save();
          return fail(res, 'PIN_LOCKED', `Too many attempts. Try again after ${user.pinLockedUntil.toISOString()}`, 429);
        }
        await user.save();
        return fail(res, 'INVALID_CREDENTIALS', 'Invalid credentials', 401);
      }

      if (user.pinAttempts || user.pinLockedUntil) {
        user.pinAttempts = 0;
        user.pinLockedUntil = undefined;
        await user.save();
      }
    } else {
      if (!user.passwordHash) return fail(res, 'INVALID_CREDENTIALS', 'Invalid credentials', 401);
      const okPwd = await bcrypt.compare(password, user.passwordHash);
      if (!okPwd) return fail(res, 'INVALID_CREDENTIALS', 'Invalid credentials', 401);
    }

    if (user.status !== 'active')
      return fail(res, 'USER_BLOCKED', 'User is blocked', 403);

    const payload = { uid: user._id.toString(), roles: user.roles, sv: user.sessionVersion || 0 };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const loginContext = {
      ip: requestIp(req),
      device: req.headers['user-agent'] || 'Khatu Pay app',
      userAgent: req.headers['user-agent'] || '',
      time: new Date(),
    };
    const suspiciousLogin = isDifferentLoginContext(user.security || {}, loginContext);

    user.security = {
      ...(user.security || {}),
      lastLoginAt: loginContext.time,
      lastLoginIp: loginContext.ip,
      lastLoginUserAgent: loginContext.userAgent,
      ...(suspiciousLogin ? { lastSuspiciousLoginAt: loginContext.time } : {}),
    };
    await user.save();

    notifyUserSmart(user._id, suspiciousLogin ? 'login_suspicious' : 'login_success', {
      ip: loginContext.ip,
      device: loginContext.device,
      force: suspiciousLogin,
      email: false,
      dedupeKey: suspiciousLogin
        ? `login-suspicious:${user._id}:${loginContext.ip}:${new Date().toISOString().slice(0, 10)}`
        : undefined,
      data: {
        loginAt: loginContext.time.toISOString(),
        suspicious: suspiciousLogin,
      },
    }).catch((error) => console.error('Login notification failed:', error.message));

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
          khatuUpiId: user.khatuUpiId,
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

      // Reject refresh tokens issued before the user's last password/PIN
      // reset or explicit "log out everywhere" - closes the gap where a
      // stolen refresh token could otherwise mint fresh access tokens for
      // its full multi-day lifetime with no way to revoke it server-side.
      const user = await User.findById(payload.uid).select('sessionVersion status');
      if (!user || user.status !== 'active') {
        return fail(res, 'INVALID_REFRESH', 'Invalid or expired refresh token', 401);
      }
      if ((payload.sv || 0) !== (user.sessionVersion || 0)) {
        return fail(res, 'SESSION_REVOKED', 'Your session has been signed out. Please log in again.', 401);
      }

      const accessToken = signAccessToken({
        uid: payload.uid,
        roles: payload.roles,
        sv: user.sessionVersion || 0,
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

    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      const otp = await createOtp(user.email, 'password_reset');

      await sendOtpMail(user.email, {
        name: user.name,
        otp,
        purpose: 'password_reset',
      });
    }

    ok(res, {}, 'If account exists, OTP has been sent');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

router.post('/check-reset-otp', async (req, res, next) => {
  try {
    const { email, otp } = await Joi.object({
      email: Joi.string().email().required(),
      otp: Joi.string().length(6).required(),
    }).validateAsync(req.body);

    const result = await verifyOtp(email, 'password_reset', otp, { consume: false });
    if (!result.ok) return otpFailure(res, result.error);
    ok(res, { otpValid: true }, 'OTP verified.');
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

    const result = await verifyOtp(email, 'password_reset', otp);
    if (!result.ok) {
      return otpFailure(res, result.error);
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return fail(res, 'USER_NOT_FOUND', 'User not found', 404);

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    await user.save();

    ok(res, {}, 'Password reset successful');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

/* ===============================
   FORGOT PIN (Send OTP)
   =============================== */
router.post('/forgot-pin', async (req, res, next) => {
  try {
    const { email, mobile } = await Joi.object({
      email: Joi.string().email(),
      mobile: Joi.string().min(8),
    }).xor('email', 'mobile').validateAsync(req.body);

    const user = await User.findOne(email ? { email: email.toLowerCase() } : { mobile });
    // Always respond generically to avoid account enumeration, but only send mail if the user exists
    if (user) {
      const otp = await createOtp(user.email, 'pin_reset');
      await sendOtpMail(user.email, {
        name: user.name,
        otp,
        purpose: 'pin_reset',
      });
    }

    ok(res, {}, 'If account exists, OTP has been sent');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

router.post('/check-pin-otp', async (req, res, next) => {
  try {
    const { email, mobile, otp } = await Joi.object({
      email: Joi.string().email(),
      mobile: Joi.string().min(8),
      otp: Joi.string().length(6).required(),
    }).xor('email', 'mobile').validateAsync(req.body);

    const user = await User.findOne(email ? { email: email.toLowerCase() } : { mobile });
    if (!user) return otpFailure(res, 'INVALID_OTP');

    const result = await verifyOtp(user.email, 'pin_reset', otp, { consume: false });
    if (!result.ok) return otpFailure(res, result.error);
    ok(res, { otpValid: true }, 'OTP verified.');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

/* ===============================
   RESET PIN
   =============================== */
router.post('/reset-pin', async (req, res, next) => {
  try {
    const { email, mobile, otp, newPin } = await Joi.object({
      email: Joi.string().email(),
      mobile: Joi.string().min(8),
      otp: Joi.string().length(6).required(),
      newPin: Joi.string().pattern(/^\d{4}$/).required(),
    }).xor('email', 'mobile').validateAsync(req.body);

    const user = await User.findOne(email ? { email: email.toLowerCase() } : { mobile });
    if (!user) return fail(res, 'INVALID_OTP', 'The verification code is invalid or expired.', 400);

    const result = await verifyOtp(user.email, 'pin_reset', otp);
    if (!result.ok) {
      return otpFailure(res, result.error);
    }

    user.mpinHash = await bcrypt.hash(newPin, 12);
    user.pinAttempts = 0;
    user.pinLockedUntil = undefined;
    user.pinResetRequired = false;
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    await user.save();

    ok(res, {}, 'PIN reset successful');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

router.put('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = await Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(6).required(),
    }).validateAsync(req.body);

    if (currentPassword === newPassword) {
      return fail(res, 'SAME_PASSWORD', 'New password must be different from the old password', 400);
    }

    const user = await User.findById(req.user.uid);
    if (!user || !user.passwordHash) return fail(res, 'USER_NOT_FOUND', 'User not found', 404);

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return fail(res, 'INVALID_PASSWORD', 'Current password is incorrect', 400);

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    await user.save();

    notifyUserSmart(user._id, 'password_changed', {
      force: true,
      email: true,
      device: req.headers['user-agent'] || 'Khatu Pay app',
      ip: requestIp(req),
      data: { changedAt: new Date().toISOString() },
    }).catch((error) => console.error('Password change notification failed:', error.message));

    ok(res, {}, 'Password changed successfully');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

router.put('/set-mpin', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, mpin } = await Joi.object({
      currentPassword: Joi.string().required(),
      mpin: Joi.string().pattern(/^\d{4}$/).required(),
    }).validateAsync(req.body);

    const user = await User.findById(req.user.uid);
    if (!user || !user.passwordHash) return fail(res, 'USER_NOT_FOUND', 'User not found', 404);

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return fail(res, 'INVALID_PASSWORD', 'Current password is incorrect', 400);

    user.mpinHash = await bcrypt.hash(mpin, 12);
    user.pinAttempts = 0;
    user.pinLockedUntil = undefined;
    user.pinResetRequired = false;
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    await user.save();

    ok(res, {}, 'MPIN updated successfully');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

/* ===============================
   LOG OUT EVERYWHERE
   Invalidates every refresh token issued so far (e.g. after a lost/stolen
   device) without requiring a password or PIN change.
   =============================== */
router.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.uid);
    if (!user) return fail(res, 'USER_NOT_FOUND', 'User not found', 404);

    user.sessionVersion = (user.sessionVersion || 0) + 1;
    await user.save();

    notifyUserSmart(user._id, 'security_alert', {
      force: true,
      email: true,
      message: 'All active sessions for your Khatu Pay account were signed out.',
      device: req.headers['user-agent'] || 'Khatu Pay app',
      ip: requestIp(req),
      data: { action: 'logout_all', at: new Date().toISOString() },
    }).catch((error) => console.error('Logout-all notification failed:', error.message));

    ok(res, {}, 'Logged out of all devices');
  } catch (err) {
    next(err);
  }
});

export default router;
