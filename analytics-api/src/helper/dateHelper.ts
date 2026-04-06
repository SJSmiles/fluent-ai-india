import dayjs from 'dayjs';


export const getComparisonRanges = (startDate: string, endDate: string) => {
  const start: any = dayjs(startDate);
  const end: any = dayjs(endDate);

  const diffDays = end.diff(start, 'day') + 1;

  return {
    currentRange: {
      start: new Date(start),
      end: new Date(end)
    },
    previousRange: {
      start: new Date(start.subtract(diffDays, 'day')),
      end: new Date(end.subtract(diffDays, 'day'))
    }
  };

};


import crypto from 'crypto';
export const decryptToken = (token: string): string => {
  const ENCRYPTION_KEY: any = process.env.API_ENCRYPTION_KEY
  const KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();

  // First 32 characters are IV (16 bytes in hex)
  const iv = Buffer.from(token.substring(0, 32), 'hex');
  const encrypted = token.substring(32);

  const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
