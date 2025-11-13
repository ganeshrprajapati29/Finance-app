import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { fail } from '../utils/response.js';

export async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer '))
      return fail(res, 'NO_TOKEN', 'Missing auth token', 401);

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await User.findById(decoded.uid);
    if (!user) return fail(res, 'NOT_FOUND', 'User not found', 404);

    if (!user.roles?.includes('admin'))
      return fail(res, 'FORBIDDEN', 'Admin access only', 403);

    req.admin = { id: user._id, email: user.email };
    next();
  } catch (err) {
    console.error('Admin auth error:', err.message);
    return fail(res, 'UNAUTHORIZED', 'Invalid or expired token', 401);
  }
}
