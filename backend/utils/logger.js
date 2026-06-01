/**
 * Strukturierter Logger für DojoSoftware
 *
 * Verwendung:
 *   const logger = require('./utils/logger');
 *   logger.info('Server gestartet', { port: 3000 });
 *   logger.error('Datenbankfehler', { error: err.message });
 *   logger.debug('Debug-Info', { userId: 123 });
 *
 * Log-Level: error, warn, info, http, debug
 */

const fs = require('fs');
const path = require('path');

// Log-Verzeichnis erstellen
const LOG_DIR = path.join(__dirname, '../logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Umgebung
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug');

// Log-Level Hierarchie
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};

// Emoji-Mapping für Console-Output (nur Development)
const EMOJI_MAP = {
    error: '❌',
    warn: '⚠️',
    info: 'ℹ️',
    http: '🌐',
    debug: '🔍',
    success: '✅',
    database: '🗄️',
    api: '📡',
    auth: '🔐',
    payment: '💳',
    email: '📧',
    file: '📁',
    user: '👤',
    dojo: '🏯'
};

/**
 * SECURITY: Liste sensibler Felder die maskiert werden sollen
 */
const SENSITIVE_FIELDS = [
    'password', 'passwort', 'passwort_hash', 'password_hash',
    'token', 'jwt', 'secret', 'api_key', 'apikey', 'api_secret',
    'stripe_secret', 'paypal_secret', 'client_secret',
    'authorization', 'auth', 'bearer',
    'iban', 'bic', 'kreditkarte', 'credit_card', 'cvv', 'cvc',
    'smtp_password', 'email_password',
    'session', 'cookie', 'csrf'
];

/**
 * SECURITY: Maskiert sensible Daten in Objekten
 */
function sanitizeObject(obj, depth = 0) {
    if (depth > 5) return '[MAX_DEPTH]';  // Prevent infinite recursion
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    // Arrays durchlaufen
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, depth + 1));
    }

    // Objekte durchlaufen
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();

        // Prüfe ob Key sensibel ist
        const isSensitive = SENSITIVE_FIELDS.some(field =>
            lowerKey.includes(field.toLowerCase())
        );

        if (isSensitive && value) {
            // Zeige nur Länge und letzte 4 Zeichen für Debugging
            if (typeof value === 'string' && value.length > 4) {
                sanitized[key] = `[REDACTED:${value.length}chars]`;
            } else {
                sanitized[key] = '[REDACTED]';
            }
        } else if (typeof value === 'object') {
            sanitized[key] = sanitizeObject(value, depth + 1);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

/**
 * Formatiert Timestamp
 */
function formatTimestamp() {
    return new Date().toISOString();
}

/**
 * Formatiert Log-Nachricht für Console
 */
function formatConsoleMessage(level, message, meta = {}) {
    const timestamp = new Date().toLocaleString('de-DE');
    const emoji = EMOJI_MAP[level] || EMOJI_MAP[meta.category] || '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';

    return `[${timestamp}] ${emoji} ${level.toUpperCase()}: ${message}${metaStr}`;
}

/**
 * Formatiert Log-Nachricht für File (JSON)
 */
function formatFileMessage(level, message, meta = {}) {
    return JSON.stringify({
        timestamp: formatTimestamp(),
        level,
        message,
        ...meta,
        environment: NODE_ENV
    });
}

/**
 * Schreibt Log in Datei
 */
function writeToFile(level, message, meta = {}) {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const logFile = path.join(LOG_DIR, `${date}-${level}.log`);
    const allLogFile = path.join(LOG_DIR, `${date}-all.log`);

    const logEntry = formatFileMessage(level, message, meta) + '\n';

    // Schreibe in level-spezifische Datei
    fs.appendFileSync(logFile, logEntry);

    // Schreibe in all.log
    fs.appendFileSync(allLogFile, logEntry);
}

/**
 * Haupt-Logger-Funktion
 */
function log(level, message, meta = {}) {
    // Prüfe ob Level aktiv ist
    if (LOG_LEVELS[level] > LOG_LEVELS[LOG_LEVEL]) {
        return;
    }

    // SECURITY: Sensible Daten maskieren bevor sie geloggt werden
    const safeMeta = sanitizeObject(meta);

    // Console-Output (Development/Test) oder strukturiert (Production)
    if (NODE_ENV !== 'production') {
        const consoleMsg = formatConsoleMessage(level, message, safeMeta);

        switch (level) {
            case 'error':
                console.error(consoleMsg);
                break;
            case 'warn':
                console.warn(consoleMsg);
                break;
            case 'debug':
                console.debug(consoleMsg);
                break;
            default:
                console.log(consoleMsg);
        }
    }

    // Immer in File schreiben (außer in Tests)
    if (NODE_ENV !== 'test') {
        writeToFile(level, message, safeMeta);
    }
}

/**
 * Export Logger-Methoden
 */
const logger = {
    error: (message, meta = {}) => log('error', message, meta),
    warn: (message, meta = {}) => log('warn', message, meta),
    info: (message, meta = {}) => log('info', message, meta),
    http: (message, meta = {}) => log('http', message, meta),
    debug: (message, meta = {}) => log('debug', message, meta),

    // Convenience-Methoden mit Kategorien
    database: (message, meta = {}) => log('debug', message, { ...meta, category: 'database' }),
    api: (message, meta = {}) => log('http', message, { ...meta, category: 'api' }),
    auth: (message, meta = {}) => log('info', message, { ...meta, category: 'auth' }),
    payment: (message, meta = {}) => log('info', message, { ...meta, category: 'payment' }),
    email: (message, meta = {}) => log('info', message, { ...meta, category: 'email' }),
    success: (message, meta = {}) => log('info', message, { ...meta, category: 'success' }),

    // Log-Rotation (alte Logs löschen)
    cleanOldLogs: (daysToKeep = 30) => {
        try {
            const files = fs.readdirSync(LOG_DIR);
            const now = Date.now();
            const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

            files.forEach(file => {
                const filePath = path.join(LOG_DIR, file);
                const stats = fs.statSync(filePath);
                const age = now - stats.mtimeMs;

                if (age > maxAge) {
                    fs.unlinkSync(filePath);
                    logger.info('Alte Log-Datei gelöscht', { file });
                }
            });
        } catch (error) {
            logger.error('Fehler beim Löschen alter Logs', { error: error.message });
        }
    }
};

// Log-Rotation beim Start (einmal pro Tag)
if (NODE_ENV === 'production') {
    logger.cleanOldLogs(30);
}

module.exports = logger;
