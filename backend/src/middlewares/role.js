export function requireRole(allowed=[]){
  return (req,res,next)=>{
    const roles = req.user?.roles || [];
    if (!allowed.some(r=>roles.includes(r))) return res.status(403).json({ success:false, code:'NO_PERMISSION', message:'Forbidden' });
    next();
  }
}
