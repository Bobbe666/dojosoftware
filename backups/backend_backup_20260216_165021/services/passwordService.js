/**
 * Password Service
 *
 * Handles password hashing and verification with:
 * - Argon2id (recommended, new passwords)
 * - bcrypt (legacy, auto-migration on next login)
 *
 * Features:
 * - Automatic algorithm detection
 * - Seamless migration from bcrypt to Argon2
 * - Secure password policy validation
 */

const argon2 = require('argon2');
const bcrypt = require('bcrypt');

// =============================================================================
// CONFIGURATION
// =============================================================================

// Argon2 configuration (OWASP recommended settings)
const ARGON2_CONFIG = {
  type: argon2.argon2id, // Argon2id (hybrid, recommended)
  memoryCost: 65536,     // 64 MB
  timeCost: 3,           // 3 iterations
  parallelism: 4,        // 4 parallel threads
  hashLength: 32         // 32 bytes output
};

// bcrypt configuration (legacy)
const BCRYPT_ROUNDS = 12;

// Password policy
const PASSWORD_POLICY = {
  minLength: 12,         // Minimum 12 characters (NIST recommendation)
  maxLength: 128,        // Maximum 128 characters
  requireUppercase: false, // Not required (NIST says focus on length)
  requireLowercase: false,
  requireNumbers: false,
  requireSpecial: false,
  commonPasswordsCheck: true // Check against common passwords list
};

// Common passwords list (top 100 most common)
const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', '1234567',
  'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
  'ashley', 'bailey', 'shadow', '123123', '654321', 'superman', 'qazwsx',
  'michael', 'football', 'password1', 'password123', 'batman', 'login',
  'welcome', 'solo', 'princess', 'starwars', 'admin', 'passw0rd', 'hello',
  'charlie', 'donald', 'password2', 'qwerty123', 'whatever', 'freedom',
  'nothing', 'maggie', 'computer', 'secret', 'internet', 'game', 'pass',
  'test', '123', '1234', '12345', '123456789', '1234567890', 'abcd1234'
]);

// =============================================================================
// PASSWORD HASHING
// =============================================================================

/**
 * Hash a password using Argon2id
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  try {
    const hash = await argon2.hash(password, ARGON2_CONFIG);
    return hash;
  } catch (error) {
    console.error('❌ [Password] Argon2 hash failed:', error.message);
    throw new Error('Passwort-Hashing fehlgeschlagen');
  }
};

/**
 * Hash a password using bcrypt (legacy, for compatibility)
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPasswordBcrypt = async (password) => {
  try {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return hash;
  } catch (error) {
    console.error('❌ [Password] bcrypt hash failed:', error.message);
    throw new Error('Passwort-Hashing fehlgeschlagen');
  }
};

// =============================================================================
// PASSWORD VERIFICATION
// =============================================================================

/**
 * Detect hash algorithm from hash string
 * @param {string} hash - Password hash
 * @returns {'argon2'|'bcrypt'|'unknown'}
 */
const detectAlgorithm = (hash) => {
  if (!hash) return 'unknown';

  // Argon2 hashes start with $argon2
  if (hash.startsWith('$argon2')) {
    return 'argon2';
  }

  // bcrypt hashes start with $2a$, $2b$, or $2y$
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    return 'bcrypt';
  }

  return 'unknown';
};

/**
 * Verify password against hash (supports both Argon2 and bcrypt)
 * @param {string} password - Plain text password
 * @param {string} hash - Stored hash
 * @returns {Promise<{valid: boolean, needsRehash: boolean, algorithm: string}>}
 */
const verifyPassword = async (password, hash) => {
  const algorithm = detectAlgorithm(hash);

  try {
    let valid = false;
    let needsRehash = false;

    switch (algorithm) {
      case 'argon2':
        valid = await argon2.verify(hash, password);
        // Check if we need to rehash (e.g., config changed)
        needsRehash = valid && argon2.needsRehash(hash, ARGON2_CONFIG);
        break;

      case 'bcrypt':
        valid = await bcrypt.compare(password, hash);
        // Always migrate bcrypt to Argon2
        needsRehash = valid;
        break;

      default:
        console.warn('⚠️ [Password] Unknown hash algorithm');
        valid = false;
        needsRehash = false;
    }

    return { valid, needsRehash, algorithm };

  } catch (error) {
    console.error('❌ [Password] Verification failed:', error.message);
    return { valid: false, needsRehash: false, algorithm };
  }
};

// =============================================================================
// PASSWORD POLICY VALIDATION
// =============================================================================

/**
 * Validate password against policy
 * @param {string} password - Plain text password
 * @returns {{valid: boolean, errors: string[]}}
 */
const validatePasswordPolicy = (password) => {
  const errors = [];

  // Length check
  if (!password || password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Passwort muss mindestens ${PASSWORD_POLICY.minLength} Zeichen lang sein`);
  }

  if (password && password.length > PASSWORD_POLICY.maxLength) {
    errors.push(`Passwort darf maximal ${PASSWORD_POLICY.maxLength} Zeichen lang sein`);
  }

  // Common password check
  if (PASSWORD_POLICY.commonPasswordsCheck && password) {
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lowerPassword)) {
      errors.push('Dieses Passwort ist zu häufig verwendet. Bitte wählen Sie ein sichereres Passwort.');
    }
  }

  // Optional complexity checks (disabled by default per NIST guidelines)
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Passwort muss mindestens einen Großbuchstaben enthalten');
  }

  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Passwort muss mindestens einen Kleinbuchstaben enthalten');
  }

  if (PASSWORD_POLICY.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Passwort muss mindestens eine Zahl enthalten');
  }

  if (PASSWORD_POLICY.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Passwort muss mindestens ein Sonderzeichen enthalten');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Calculate password strength score (0-100)
 * @param {string} password - Plain text password
 * @returns {number} Strength score
 */
const calculatePasswordStrength = (password) => {
  if (!password) return 0;

  let score = 0;

  // Length score (up to 40 points)
  score += Math.min(password.length * 2, 40);

  // Character variety (up to 40 points)
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[^a-zA-Z0-9]/.test(password)) score += 10;

  // Penalty for common patterns (up to -20 points)
  if (/^[a-zA-Z]+$/.test(password)) score -= 10; // Only letters
  if (/^[0-9]+$/.test(password)) score -= 20; // Only numbers
  if (/(.)\1{2,}/.test(password)) score -= 10; // Repeated characters
  if (/^(123|abc|qwe)/i.test(password)) score -= 10; // Common starts

  return Math.max(0, Math.min(100, score));
};

// =============================================================================
// DATABASE MIGRATION HELPER
// =============================================================================

/**
 * Migrate user password from bcrypt to Argon2
 * Call this after successful login if needsRehash is true
 * @param {object} db - Database connection
 * @param {number} userId - User ID
 * @param {string} newHash - New Argon2 hash
 */
const migratePasswordHash = async (db, userId, newHash) => {
  try {
    await db.promise().execute(
      `UPDATE admin_users
       SET password = ?,
           password_algorithm = 'argon2id',
           password_changed_at = NOW()
       WHERE id = ?`,
      [newHash, userId]
    );
    console.log(`✅ [Password] Migrated user ${userId} to Argon2id`);
    return true;
  } catch (error) {
    console.error(`❌ [Password] Migration failed for user ${userId}:`, error.message);
    return false;
  }
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Hashing
  hashPassword,
  hashPasswordBcrypt,

  // Verification
  verifyPassword,
  detectAlgorithm,

  // Validation
  validatePasswordPolicy,
  calculatePasswordStrength,

  // Migration
  migratePasswordHash,

  // Configuration (for testing/customization)
  PASSWORD_POLICY,
  ARGON2_CONFIG
};
