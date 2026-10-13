import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function cloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
}

function requireCloudinary() {
  if (!cloudinaryConfigured()) {
    throw new Error('Cloudinary document storage is not configured.');
  }
}

function publicIdFromDeliveryUrl(assetUrl) {
  try {
    const parts = new URL(String(assetUrl || '')).pathname.split('/').filter(Boolean);
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex < 0) return '';
    const publicParts = parts.slice(uploadIndex + 1);
    if (/^v\d+$/.test(publicParts[0] || '')) publicParts.shift();
    // Unlike image assets, Cloudinary raw-resource public IDs retain the file
    // extension. Keep `.pdf` here or private_download_url resolves to 404.
    return decodeURIComponent(publicParts.join('/'));
  } catch (_) {
    return '';
  }
}

// Cloudinary can block direct PDF delivery at account level. Its signed
// private-download URL keeps documents protected and still renders inline.
export const privatePdfDeliveryUrl = (assetUrl, expiresAt = Math.floor(Date.now() / 1000) + 900) => {
  if (!cloudinaryConfigured()) return '';
  const publicId = publicIdFromDeliveryUrl(assetUrl);
  if (!publicId) return '';
  try {
    return cloudinary.utils.private_download_url(publicId, 'pdf', {
      resource_type: 'raw', type: 'upload', expires_at: expiresAt,
    });
  } catch (_) {
    return '';
  }
};

export const uploadToCloudinary = (fileBuffer, folder = 'khatupay', options = {}) => {
  requireCloudinary();
  if (typeof fileBuffer === 'string' && fs.existsSync(fileBuffer)) {
    return cloudinary.uploader.upload(fileBuffer, { folder, resource_type: 'auto', ...options });
  }
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto', ...options },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// Legal agreements must remain PDFs at delivery time, rather than being
// auto-classified as image assets by the generic upload helper.
export const uploadPdfToCloudinary = (pdfBuffer, folder) =>
  uploadToCloudinary(pdfBuffer, folder, {
    resource_type: 'raw',
    format: 'pdf',
    use_filename: true,
    unique_filename: true,
    overwrite: false,
  });

export const privateBusinessDocumentRef = (publicId, format) =>
  `private://${encodeURIComponent(publicId)}?format=${encodeURIComponent(format || 'pdf')}`;

export const privateBusinessDocumentDeliveryUrl = (reference, expiresAt = Math.floor(Date.now() / 1000) + 600) => {
  try {
    const value = new URL(String(reference || ''));
    if (value.protocol !== 'private:') return '';
    const publicId = decodeURIComponent(`${value.hostname}${value.pathname}`.replace(/^\/+/, ''));
    const format = value.searchParams.get('format') || 'pdf';
    return publicId ? cloudinary.utils.private_download_url(publicId, format, { resource_type: 'raw', type: 'private', expires_at: expiresAt }) : '';
  } catch (_) { return ''; }
};

export const deleteFromCloudinary = (publicId) => {
  requireCloudinary();
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
};

export default cloudinary;
