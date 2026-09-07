import { Router } from 'express';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import Employee from '../models/Employee.js';
import AuditLog from '../models/AuditLog.js';
import { ok, fail } from '../utils/response.js';
import { sendMail } from '../services/mailer.js';

const router = Router();

// Only admins can manage employees
router.use(requireAuth, requireRole(['admin']));

// Get all employees
router.get('/', async (req, res, next) => {
  try {
    const { role, search = '', page = 1, limit = 20 } = req.query;
    let query = {};

    if (role) {
      query.roles = { $in: [role] };
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } }
      ];
    }

    const [employees, total] = await Promise.all([
      Employee.find(query)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit)),
      Employee.countDocuments(query)
    ]);

    ok(res, {
      items: employees,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)) || 1
    });
  } catch (e) { next(e); }
});

// Create new employee
router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, password, permissions, roles, department, agentProfile } = await Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      phone: Joi.string().required(),
      password: Joi.string().min(6).required(),
      roles: Joi.array().items(Joi.string()).default(['employee']),
      department: Joi.string().default('GENERAL'),
      agentProfile: Joi.object().unknown(true).default({}),
      permissions: Joi.object({
        canManageUsers: Joi.boolean().default(false),
        canManageLoans: Joi.boolean().default(false),
        canManagePayments: Joi.boolean().default(false),
        canManageSupport: Joi.boolean().default(true),
        canSendNotifications: Joi.boolean().default(false),
        canViewAudit: Joi.boolean().default(false),
        canManageSettings: Joi.boolean().default(false),
        canManageCollections: Joi.boolean().default(false),
        canViewReports: Joi.boolean().default(false),
      }).default({
        canManageUsers: false,
        canManageLoans: false,
        canManagePayments: false,
        canManageSupport: true,
        canSendNotifications: false,
        canViewAudit: false,
        canManageSettings: false,
        canManageCollections: false,
        canViewReports: false,
      }),
    }).validateAsync(req.body);

    const exists = await Employee.findOne({ email: email.toLowerCase() });
    if (exists) return fail(res, 'EMPLOYEE_EXISTS', 'Employee with this email already exists', 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const employee = await Employee.create({
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      roles,
      permissions,
      department,
      agentProfile,
      createdBy: req.user.uid,
    });

    // Send welcome email
    await sendMail(
      email,
      'Welcome to Khatu Pay Team',
      `<p>Hi ${name},</p><p>You have been added to the Khatu Pay team.</p><p>Your login credentials:</p><p>Email: ${email}</p><p>Password: ${password}</p><p>Please change your password after first login.</p>`,
      `Welcome to Khatu Pay Team. Email: ${email}, Password: ${password}`
    );

    await AuditLog.create({
      actorId: req.user.uid,
      action: 'CREATE_EMPLOYEE',
      entityType: 'Employee',
      entityId: employee._id.toString(),
      meta: { name, email, department, permissions },
    });

    ok(res, employee, 'Employee created successfully');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

// Update employee
router.put('/:id', async (req, res, next) => {
  try {
    const { name, phone, permissions, status, roles, department, agentProfile } = await Joi.object({
      name: Joi.string().optional(),
      phone: Joi.string().optional(),
      roles: Joi.array().items(Joi.string()).optional(),
      department: Joi.string().optional(),
      agentProfile: Joi.object().unknown(true).optional(),
      permissions: Joi.object({
        canManageUsers: Joi.boolean(),
        canManageLoans: Joi.boolean(),
        canManagePayments: Joi.boolean(),
        canManageSupport: Joi.boolean(),
        canSendNotifications: Joi.boolean(),
        canViewAudit: Joi.boolean(),
        canManageSettings: Joi.boolean(),
        canManageCollections: Joi.boolean(),
        canViewReports: Joi.boolean(),
      }).optional(),
      status: Joi.string().valid('active', 'inactive').optional(),
    }).validateAsync(req.body);

    const update = {};
    if (name !== undefined) update.name = name;
    if (phone !== undefined) update.phone = phone;
    if (roles !== undefined) update.roles = roles;
    if (department !== undefined) update.department = department;
    if (agentProfile !== undefined) update.agentProfile = agentProfile;
    if (permissions !== undefined) update.permissions = permissions;
    if (status !== undefined) {
      update.status = status;
      update.isActive = status === 'active';
    }

    const employee = await Employee.findByIdAndUpdate(req.params.id, update, { new: true });

    if (!employee) return fail(res, 'NOT_FOUND', 'Employee not found', 404);

    await AuditLog.create({
      actorId: req.user.uid,
      action: 'UPDATE_EMPLOYEE',
      entityType: 'Employee',
      entityId: employee._id.toString(),
      meta: update,
    });

    ok(res, employee, 'Employee updated successfully');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

router.put('/:id/status', async (req, res, next) => {
  try {
    const { isActive, status } = await Joi.object({
      isActive: Joi.boolean().optional(),
      status: Joi.string().valid('active', 'inactive').optional()
    }).validateAsync(req.body);

    const nextStatus = status || (isActive ? 'active' : 'inactive');
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { isActive: nextStatus === 'active', status: nextStatus },
      { new: true }
    );

    if (!employee) return fail(res, 'NOT_FOUND', 'Employee not found', 404);

    await AuditLog.create({
      actorId: req.user.uid,
      action: 'UPDATE_EMPLOYEE_STATUS',
      entityType: 'Employee',
      entityId: employee._id.toString(),
      meta: { status: nextStatus }
    });

    ok(res, employee, 'Employee status updated successfully');
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

// Delete employee
router.delete('/:id', async (req, res, next) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) return fail(res, 'NOT_FOUND', 'Employee not found', 404);

    await AuditLog.create({
      actorId: req.user.uid,
      action: 'DELETE_EMPLOYEE',
      entityType: 'Employee',
      entityId: employee._id.toString(),
      meta: { name: employee.name, email: employee.email },
    });

    ok(res, { message: 'Employee deleted successfully' });
  } catch (e) { next(e); }
});

// Reset employee password
router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const { password } = await Joi.object({
      password: Joi.string().min(6).required(),
    }).validateAsync(req.body);

    const employee = await Employee.findById(req.params.id);
    if (!employee) return fail(res, 'NOT_FOUND', 'Employee not found', 404);

    employee.passwordHash = await bcrypt.hash(password, 12);
    await employee.save();

    // Send password reset email
    await sendMail(
      employee.email,
      'Password Reset - Khatu Pay',
      `<p>Hi ${employee.name},</p><p>Your password has been reset.</p><p>New password: ${password}</p><p>Please change your password after login.</p>`,
      `Password reset. New password: ${password}`
    );

    await AuditLog.create({
      actorId: req.user.uid,
      action: 'RESET_EMPLOYEE_PASSWORD',
      entityType: 'Employee',
      entityId: employee._id.toString(),
      meta: { email: employee.email },
    });

    ok(res, { message: 'Password reset successfully' });
  } catch (err) {
    if (err.isJoi) return fail(res, 'VALIDATION_ERROR', err.message, 400);
    next(err);
  }
});

export default router;
