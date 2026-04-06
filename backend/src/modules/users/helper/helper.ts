import * as crypto from 'crypto';
import { parsePhoneNumberFromString } from "libphonenumber-js/max";

const algorithm = 'aes-256-cbc';

export const encryptPassword = (text: string): string => {
  const secretKey = process.env.ENCRYPTION_KEY;
  if (!secretKey) throw new Error("ENCRYPTION_KEY not set");

  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(secretKey).digest();

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
};

export const decryptPassword = (encryptedText: string): string => {
  const secretKey = process.env.ENCRYPTION_KEY;
  if (!secretKey) throw new Error("ENCRYPTION_KEY not set");

  const [ivHex, encryptedData] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  if (iv.length !== 16) {
    throw new Error(`Invalid IV length: ${iv.length}, expected 16`);
  }

  const key = crypto.createHash('sha256').update(secretKey).digest();

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

// Helper method to generate webhook token
export const generateWebhookToken = (companyId: string): string => {
  const ENCRYPTION_KEY: any = process.env.API_ENCRYPTION_KEY;
  const KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);

  let encrypted = cipher.update(companyId, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // IV (32 chars) + Encrypted data
  return `${iv.toString('hex')}${encrypted}`;
}


export function validatePhone(num: string) {
  try {
    const phone = parsePhoneNumberFromString(num);
    return phone?.isValid() && phone?.isPossible();
  } catch {
    return false;
  }
}
