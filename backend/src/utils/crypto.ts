import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Recommended for GCM
const KEY_LENGTH = 32; // 256 bits

export function encrypt(text: string, key: Buffer): { iv: string; content: string; tag: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    content: encrypted,
    tag: tag.toString('base64'),
  };
}

export function decrypt(encrypted: { iv: string; content: string; tag: string }, key: Buffer): string {
  const iv = Buffer.from(encrypted.iv, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted.content, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function deriveKey(passphrase: string, salt: string): Buffer {
  return crypto.scryptSync(passphrase, salt, KEY_LENGTH);
}
