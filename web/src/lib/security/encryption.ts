import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

function base64UrlEncode(value: Buffer) {
  return value.toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url');
}

function getEncryptionKey(): Buffer {
  const raw = process.env.BROKER_TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY || '';
  if (!raw) {
    throw new Error('BROKER_TOKEN_ENCRYPTION_KEY is not configured.');
  }

  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  try {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === KEY_BYTES) return decoded;
  } catch {
    // Fall through to hashed key support for deployment ergonomics.
  }

  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, base64UrlEncode(iv), base64UrlEncode(ciphertext), base64UrlEncode(tag)].join(':');
}

export function decryptSecret(payload: string): string {
  const [version, ivText, ciphertextText, tagText] = payload.split(':');
  if (version !== VERSION || !ivText || !ciphertextText || !tagText) {
    throw new Error('Invalid encrypted secret payload.');
  }

  const key = getEncryptionKey();
  const iv = base64UrlDecode(ivText);
  const ciphertext = base64UrlDecode(ciphertextText);
  const tag = base64UrlDecode(tagText);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
