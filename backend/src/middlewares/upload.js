import multer from 'multer';
import path from 'path';
import fs from 'fs';
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive:true });
const storage = multer.diskStorage({
  destination:(req,file,cb)=>cb(null, UPLOAD_DIR),
  filename:(req,file,cb)=>cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(file.originalname)}`)
});
export const uploadSingle = (field='file') => multer({ storage, limits:{ fileSize: 10*1024*1024 } }).single(field);
export const uploadMany = (field='files', max=8) => multer({ storage, limits:{ fileSize: 10*1024*1024 } }).array(field, max);
