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

    // Console-Output (Development) oder strukturiert (Production)
    if (NODE_ENV === 'development') {
        const consoleMsg = formatConsoleMessage(level, message, meta);

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
        writeToFile(level, message, meta);
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
