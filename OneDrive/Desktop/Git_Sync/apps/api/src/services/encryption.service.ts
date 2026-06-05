import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'hazina_default_key_32_characters';
const IV = process.env.ENCRYPTION_IV || 'hazina_iv_16char';

/**
 * Encrypt sensitive data using AES-256
 */
export function encrypt(text: string): string {
  const key = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY);
  const iv = CryptoJS.enc.Utf8.parse(IV);
  const encrypted = CryptoJS.AES.encrypt(text, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.toString();
}

/**
 * Decrypt AES-256 encrypted data
 */
export function decrypt(ciphertext: string): string {
  const key = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY);
  const iv = CryptoJS.enc.Utf8.parse(IV);
  const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * Hash data for integrity checks (non-reversible)
 */
export function hash(text: string): string {
  return CryptoJS.SHA256(text).toString();
}

/**
 * Mask phone number for display (e.g., 2547****1234)
 */
export function maskPhone(phone: string): string {
  if (phone.length < 8) return '****';
  return phone.substring(0, 4) + '****' + phone.substring(phone.length - 4);
}

/**
 * Mask email for display (e.g., j***@gmail.com)
 */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return '***@***.com';
  return `${user[0]}***@${domain}`;
}
