export function notFound(req,res,next){ res.status(404).json({success:false,code:'NOT_FOUND',message:'Route not found'}); }
export function errorHandler(err, req, res, next){
  console.error(err);
  res.status(err.status||500).json({success:false,code:err.code||'INTERNAL_ERROR',message:err.message||'Something went wrong'});
}
