import crypto from 'crypto';

const encryptionKey = () => crypto
  .createHash('sha256')
  .update(String(process.env.AUTH_DATA_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET || ''))
  .digest();

export function encryptSessionMobile(mobile) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(mobile), 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSessionMobile(value) {
  const [ivText, tagText, encryptedText] = String(value || '').split('.');
  if (!ivText || !tagText || !encryptedText) return '';
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return '';
  }
}

export const hashSessionToken = (value) => crypto
  .createHash('sha256')
  .update(String(value || ''))
  .digest('hex');
