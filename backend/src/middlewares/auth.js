import jwt from 'jsonwebtoken';

// JWT Token verification function
export function verifyToken(token, type = 'access') {
  try {
    const secret = type === 'access' 
      ? process.env.JWT_ACCESS_SECRET 
      : process.env.JWT_REFRESH_SECRET;
    
    if (!secret) {
      throw new Error('JWT secret not configured');
    }

    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

// Main authentication middleware
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      code: 'NO_TOKEN', 
      message: 'Missing auth token' 
    });
  }
  
  try {
    req.user = verifyToken(token, 'access');
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      code: 'INVALID_TOKEN', 
      message: 'Invalid or expired token' 
    });
  }
}

// Optional auth middleware (doesn't throw error if no token)
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  
  if (token) {
    try {
      req.user = verifyToken(token, 'access');
    } catch (error) {
      // Continue without user info if token is invalid
      req.user = null;
    }
  }
  
  next();
}

// Admin role check middleware
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      return res.status(403).json({
        success: false,
        code: 'ACCESS_DENIED',
        message: 'Admin access required'
      });
    }
  });
}

// Employee role check middleware
export function requireEmployee(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user && (req.user.role === 'employee' || req.user.role === 'admin')) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        code: 'ACCESS_DENIED',
        message: 'Employee access required'
      });
    }
  });
}

// API Key authentication middleware
export function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      code: 'NO_API_KEY',
      message: 'API key is required'
    });
  }
  
  // Validate API key (you can implement your own logic)
  const validApiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
  
  if (!validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_API_KEY',
      message: 'Invalid API key'
    });
  }
  
  next();
}