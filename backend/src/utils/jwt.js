import jwt from 'jsonwebtoken';
export function signAccessToken(payload){ return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: `${parseInt(process.env.ACCESS_TOKEN_TTL_MIN||'15',10)}m` }); }
export function signRefreshToken(payload){ return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: `${parseInt(process.env.REFRESH_TOKEN_TTL_DAYS||'7',10)}d` }); }
export function verifyToken(token, type='access'){ return jwt.verify(token, type==='access'?process.env.JWT_ACCESS_SECRET:process.env.JWT_REFRESH_SECRET); }
