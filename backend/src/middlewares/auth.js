import { verifyToken } from '../utils/jwt.js';
export function requireAuth(req,res,next){
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')? header.slice(7): null;
  if(!token) return res.status(401).json({ success:false, code:'NO_TOKEN', message:'Missing auth token' });
  try{ req.user = verifyToken(token,'access'); next(); }
  catch(e){ return res.status(401).json({ success:false, code:'INVALID_TOKEN', message:'Invalid or expired token' }); }
}
