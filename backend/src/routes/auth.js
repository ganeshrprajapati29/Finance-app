import { Router } from 'express';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import { ok, fail } from '../utils/response.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../utils/jwt.js';
import { sendMail } from '../services/mailer.js';
import { requireAuth } from '../middlewares/auth.js';
import { ensureUserPaymentQr } from '../services/qrAuto.js';
import { notifyUserSmart } from '../services/smartNotifications.js';

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
async function verifyOtp(email, purpose, candidate) {
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

  record.used = true;
  await record.save();
  return { ok: true, record };
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

    await sendMail(
      normalizedEmail,
      'Verify your email - Khatu Pay',
      `<p>Hi ${name},</p><p>Your OTP is <b>${otp}</b> (valid for 10 minutes)</p>`,
      `OTP: ${otp}`
    );

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
      const messages = { INVALID_OTP: 'Invalid OTP', OTP_EXPIRED: 'OTP expired', OTP_LOCKED: 'Too many attempts, request a new OTP' };
      return fail(res, result.error, messages[result.error] || 'Invalid OTP', 400);
    }

    await User.updateOne({ email: email.toLowerCase() }, { $set: { emailVerified: true } });

    ok(res, { emailVerified: true }, 'Email verified successfully');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
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
      email: suspiciousLogin,
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

      await sendMail(
        user.email,
        'Reset password OTP - Khatu Pay',
        `<p>Your password reset OTP is <b>${otp}</b> (valid for 10 minutes)</p>`,
        `OTP: ${otp}`
      );
    }

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

    const result = await verifyOtp(email, 'password_reset', otp);
    if (!result.ok) {
      const messages = { INVALID_OTP: 'Invalid OTP', OTP_EXPIRED: 'OTP expired', OTP_LOCKED: 'Too many attempts, request a new OTP' };
      return fail(res, result.error, messages[result.error] || 'Invalid OTP', 400);
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
      await sendMail(
        user.email,
        'Reset PIN OTP - Khatu Pay',
        `<p>Your PIN reset OTP is <b>${otp}</b> (valid for 10 minutes)</p>`,
        `OTP: ${otp}`
      );
    }

    ok(res, {}, 'If account exists, OTP has been sent');
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
    const { email, otp, newPin } = await Joi.object({
      email: Joi.string().email().required(),
      otp: Joi.string().length(6).required(),
      newPin: Joi.string().pattern(/^\d{4}$/).required(),
    }).validateAsync(req.body);

    const result = await verifyOtp(email, 'pin_reset', otp);
    if (!result.ok) {
      const messages = { INVALID_OTP: 'Invalid OTP', OTP_EXPIRED: 'OTP expired', OTP_LOCKED: 'Too many attempts, request a new OTP' };
      return fail(res, result.error, messages[result.error] || 'Invalid OTP', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return fail(res, 'USER_NOT_FOUND', 'User not found', 404);

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
