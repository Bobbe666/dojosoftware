/**
 * File Upload Security Utilities
 * Sichere Validierung von hochgeladenen Dateien
 */

const path = require('path');
const crypto = require('crypto');

/**
 * Sanitize filename - entfernt gefährliche Zeichen
 * Verhindert Path Traversal Attacks
 */
const sanitizeFilename = (filename) => {
  if (!filename) {
    return 'file_' + Date.now() + '.dat';
  }

  // Entferne Path Traversal Zeichen
  let safe = filename.replace(/\.\./g, '');
  safe = path.basename(safe);

  // Entferne gefährliche Zeichen
  safe = safe.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Füge Timestamp hinzu für Eindeutigkeit
  const ext = path.extname(safe);
  const name = path.basename(safe, ext);
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');

  return name + '_' + timestamp + '_' + random + ext;
};

/**
 * Validate image file type - prüft gegen Magic Bytes
 * Sicherer als MIME-Type alleine
 */
const validateImageFile = (buffer, allowedTypes = ['image/jpeg', 'image/png', 'image/webp']) => {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Leere Datei' };
  }

  // Magic Bytes für gängige Bildformate
  const magicNumbers = {
    'image/jpeg': [
      [0xFF, 0xD8, 0xFF, 0xE0], // JPEG JFIF
      [0xFF, 0xD8, 0xFF, 0xE1], // JPEG Exif
      [0xFF, 0xD8, 0xFF, 0xE2], // JPEG
      [0xFF, 0xD8, 0xFF, 0xE3], // JPEG
    ],
    'image/png': [
      [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
    ],
    'image/webp': [
      [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50], // WEBP (RIFF....WEBP)
    ],
  };

  // Prüfe Magic Bytes
  let detectedType = null;
  for (const [mimeType, signatures] of Object.entries(magicNumbers)) {
    for (const signature of signatures) {
      let matches = true;
      for (let i = 0; i < signature.length; i++) {
        if (signature[i] !== null && buffer[i] !== signature[i]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        detectedType = mimeType;
        break;
      }
    }
    if (detectedType) break;
  }

  if (!detectedType) {
    return { valid: false, error: 'Ungültiges Dateiformat (kein gültiges Bild)' };
  }

  if (!allowedTypes.includes(detectedType)) {
    return { valid: false, error: 'Dateityp ' + detectedType + ' nicht erlaubt' };
  }

  return { valid: true, mimeType: detectedType };
};

/**
 * Validate file size
 */
const validateFileSize = (size, maxSize = 10 * 1024 * 1024) => {
  if (size > maxSize) {
    return {
      valid: false,
      error: 'Datei zu groß (max ' + (maxSize / 1024 / 1024) + 'MB)',
    };
  }
  return { valid: true };
};

/**
 * Complete file validation for images
 */
const validateUploadedImage = (file, options = {}) => {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
  } = options;

  // 1. Prüfe Dateiname
  if (!file.originalname) {
    return { valid: false, error: 'Kein Dateiname' };
  }

  // 2. Prüfe Größe
  const sizeCheck = validateFileSize(file.size, maxSize);
  if (!sizeCheck.valid) {
    return sizeCheck;
  }

  // 3. Prüfe Magic Bytes
  const typeCheck = validateImageFile(file.buffer, allowedTypes);
  if (!typeCheck.valid) {
    return typeCheck;
  }

  // 4. Sanitize Filename
  const safeFilename = sanitizeFilename(file.originalname);

  return {
    valid: true,
    safeFilename,
    mimeType: typeCheck.mimeType,
  };
};

module.exports = {
  sanitizeFilename,
  validateImageFile,
  validateFileSize,
  validateUploadedImage,
};
