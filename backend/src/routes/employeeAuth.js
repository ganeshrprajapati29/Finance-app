import { Router } from 'express';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import Employee from '../models/Employee.js';
import { ok, fail } from '../utils/response.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../utils/jwt.js';
import { sendMail } from '../services/mailer.js';

const router = Router();

// Employee login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = await Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    }).validateAsync(req.body);

    const employee = await Employee.findOne({ email: email.toLowerCase() });
    if (!employee) return fail(res, 'INVALID_CREDENTIALS', 'Invalid credentials', 401);

    if (!employee.passwordHash) return fail(res, 'INVALID_CREDENTIALS', 'Invalid credentials', 401);

    const okPwd = await bcrypt.compare(password, employee.passwordHash);
    if (!okPwd) return fail(res, 'INVALID_CREDENTIALS', 'Invalid credentials', 401);

    if (employee.status !== 'active') return fail(res, 'EMPLOYEE_INACTIVE', 'Employee account is inactive', 403);

    const payload = {
      uid: employee._id.toString(),
      roles: employee.roles,
      type: 'employee'
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    ok(res, {
      accessToken,
      refreshToken,
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        roles: employee.roles,
        permissions: employee.permissions,
      },
    }, 'Login successful');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

// Refresh token for employees
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = await Joi.object({
      refreshToken: Joi.string().required(),
    }).validateAsync(req.body);

    try {
      const payload = verifyToken(refreshToken, 'refresh');
      if (payload.type !== 'employee') return fail(res, 'INVALID_TOKEN', 'Invalid token type', 401);

      const accessToken = signAccessToken({
        uid: payload.uid,
        roles: payload.roles,
        type: 'employee'
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

export default router;
