/**
 * Encryption Utility für sensible Daten
 * Verwendet AES-256-GCM (Authenticated Encryption)
 *
 * AES-256-GCM bietet:
 * - 256-bit Verschlüsselung
 * - Authentifizierung (verhindert Manipulation)
 * - Unique IV pro Verschlüsselung
 */

const crypto = require('crypto');
const logger = require('./logger');

// Algorithmus: AES-256-GCM (Galois/Counter Mode)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Holt den Encryption Key aus der Umgebung
 * Der Key muss 32 Bytes (256 bits) sein
 */
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;

    if (!key) {
        throw new Error('ENCRYPTION_KEY nicht in Umgebungsvariablen gesetzt');
    }

    // Key als hex oder base64 decodieren
    let keyBuffer;

    if (key.length === 64) {
        // Hex-encoded (64 hex chars = 32 bytes)
        keyBuffer = Buffer.from(key, 'hex');
    } else if (key.length === 44) {
        // Base64-encoded (44 chars = 32 bytes)
        keyBuffer = Buffer.from(key, 'base64');
    } else {
        // Raw key - hash it to get 32 bytes
        keyBuffer = crypto.createHash('sha256').update(key).digest();
    }

    if (keyBuffer.length !== KEY_LENGTH) {
        throw new Error(`Encryption Key muss ${KEY_LENGTH} Bytes sein`);
    }

    return keyBuffer;
}

/**
 * Verschlüsselt einen String
 *
 * @param {string} plaintext - Der zu verschlüsselnde Text
 * @returns {string} - Verschlüsselter Text (Format: iv:authTag:ciphertext, Base64)
 */
function encrypt(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') {
        return plaintext;
    }

    // Bereits verschlüsselt? (beginnt mit "enc:")
    if (plaintext.startsWith('enc:')) {
        return plaintext;
    }

    try {
        const key = getEncryptionKey();

        // Generiere zufälligen IV
        const iv = crypto.randomBytes(IV_LENGTH);

        // Erstelle Cipher
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        // Verschlüssele
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        // Hole Auth Tag
        const authTag = cipher.getAuthTag();

        // Kombiniere: iv:authTag:ciphertext (alle Base64)
        const combined = `enc:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;

        return combined;

    } catch (error) {
        logger.error('Verschlüsselungsfehler:', { error: error.message });
        throw new Error('Verschlüsselung fehlgeschlagen');
    }
}

/**
 * Entschlüsselt einen String
 *
 * @param {string} ciphertext - Der verschlüsselte Text (Format: enc:iv:authTag:ciphertext)
 * @returns {string} - Entschlüsselter Klartext
 */
function decrypt(ciphertext) {
    if (!ciphertext || typeof ciphertext !== 'string') {
        return ciphertext;
    }

    // Nicht verschlüsselt? (beginnt nicht mit "enc:")
    if (!ciphertext.startsWith('enc:')) {
        return ciphertext;
    }

    try {
        const key = getEncryptionKey();

        // Parse das Format: enc:iv:authTag:ciphertext
        const parts = ciphertext.split(':');
        if (parts.length !== 4) {
            throw new Error('Ungültiges verschlüsseltes Format');
        }

        const iv = Buffer.from(parts[1], 'base64');
        const authTag = Buffer.from(parts[2], 'base64');
        const encrypted = parts[3];

        // Erstelle Decipher
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        // Entschlüssele
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;

    } catch (error) {
        logger.error('Entschlüsselungsfehler:', { error: error.message });
        throw new Error('Entschlüsselung fehlgeschlagen');
    }
}

/**
 * Prüft ob ein String verschlüsselt ist
 */
function isEncrypted(text) {
    return text && typeof text === 'string' && text.startsWith('enc:');
}

/**
 * Generiert einen neuen sicheren Encryption Key
 * @returns {string} - Hex-encoded 256-bit Key
 */
function generateEncryptionKey() {
    return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Hash für sensible Daten (z.B. für Logs)
 */
function hashSensitive(text) {
    if (!text) return null;
    return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16) + '...';
}

module.exports = {
    encrypt,
    decrypt,
    isEncrypted,
    generateEncryptionKey,
    hashSensitive
};
