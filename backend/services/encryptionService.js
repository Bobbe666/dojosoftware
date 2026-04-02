// encryptionService.js — AES-256-CBC Feldverschlüsselung für sensible Daten
// Verwendet ENCRYPTION_KEY aus .env (64 hex chars = 32 bytes)
const crypto = require('crypto');

const KEY_HEX = process.env.ENCRYPTION_KEY;
if (!KEY_HEX || KEY_HEX.length !== 64) {
  console.warn('⚠️  ENCRYPTION_KEY fehlt oder hat falsches Format in .env (64 hex chars erwartet)');
}

const ALGORITHM = 'aes-256-cbc';
const PREFIX    = 'ENC:';

function getKey() {
  return Buffer.from(KEY_HEX, 'hex');
}

/**
 * Verschlüsselt einen String oder ein Objekt (wird zu JSON).
 * Rückgabe: "ENC:<iv_hex>:<ciphertext_hex>"
 */
function encrypt(value) {
  if (value === null || value === undefined) return null;
  const plaintext = typeof value === 'string' ? value : JSON.stringify(value);
  const iv        = crypto.randomBytes(16);
  const cipher    = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return PREFIX + iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Entschlüsselt einen verschlüsselten String.
 * Rückgabe: Originalstring oder null bei Fehler.
 * Transparentes Fallback: Wenn Wert nicht mit "ENC:" beginnt → ungekürzt zurückgeben (Altdaten).
 */
function decrypt(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) {
    return value; // Plaintext-Fallback für Altdaten
  }
  try {
    const parts      = value.slice(PREFIX.length).split(':');
    const iv         = Buffer.from(parts[0], 'hex');
    const ciphertext = Buffer.from(parts[1], 'hex');
    const decipher   = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (e) {
    console.error('Entschlüsselung fehlgeschlagen:', e.message);
    return null;
  }
}

/**
 * Entschlüsselt und parsed JSON. Gibt Objekt zurück.
 */
function decryptJSON(value) {
  const plain = decrypt(value);
  if (!plain) return null;
  try { return JSON.parse(plain); } catch { return plain; }
}

module.exports = { encrypt, decrypt, decryptJSON };
