export const ok = (res, data, message='OK') => res.json({ success:true, message, data });
export const fail = (res, code, message, status=400) => res.status(status).json({ success:false, code, message });
