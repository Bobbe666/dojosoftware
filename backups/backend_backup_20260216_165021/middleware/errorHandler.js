/**
 * Zentrale Error-Handling Middleware
 * Stellt einheitliche Error-Responses sicher
 */

const logger = require('../utils/logger');

// Benutzerdefinierte API Error Klasse
class ApiError extends Error {
    constructor(statusCode, message, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true; // Unterscheidet von unerwarteten Fehlern

        Error.captureStackTrace(this, this.constructor);
    }

    // Factory-Methoden für häufige Fehler
    static badRequest(message, details = null) {
        return new ApiError(400, message, details);
    }

    static unauthorized(message = 'Nicht autorisiert') {
        return new ApiError(401, message);
    }

    static forbidden(message = 'Zugriff verweigert') {
        return new ApiError(403, message);
    }

    static notFound(message = 'Ressource nicht gefunden') {
        return new ApiError(404, message);
    }

    static conflict(message, details = null) {
        return new ApiError(409, message, details);
    }

    static validationError(errors) {
        return new ApiError(422, 'Validierungsfehler', { errors });
    }

    static internal(message = 'Interner Serverfehler') {
        return new ApiError(500, message);
    }
}

/**
 * Einheitliches Error-Response Format
 */
function formatErrorResponse(err, req) {
    const isDev = process.env.NODE_ENV === 'development';

    const response = {
        success: false,
        error: {
            message: err.message || 'Ein Fehler ist aufgetreten',
            code: err.statusCode || 500,
        }
    };

    // Details nur bei operationellen Fehlern
    if (err.details) {
        response.error.details = err.details;
    }

    // Stack-Trace nur in Development
    if (isDev && err.stack) {
        response.error.stack = err.stack;
    }

    // Request-Info für Debugging
    if (isDev) {
        response.error.path = req.path;
        response.error.method = req.method;
    }

    return response;
}

/**
 * Async Handler Wrapper - verhindert try-catch in jeder Route
 * Verwendung: router.get('/route', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * 404 Handler - für nicht gefundene Routen
 */
function notFoundHandler(req, res, next) {
    next(new ApiError(404, `Route nicht gefunden: ${req.method} ${req.originalUrl}`));
}

/**
 * Zentrale Error-Handler Middleware
 * MUSS als letzte Middleware registriert werden!
 */
function errorHandler(err, req, res, next) {
    // Standardisiere den Fehler
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Interner Serverfehler';

    // MySQL-Fehler behandeln
    if (err.code === 'ER_DUP_ENTRY') {
        statusCode = 409;
        message = 'Eintrag existiert bereits';
    } else if (err.code === 'ER_NO_REFERENCED_ROW') {
        statusCode = 400;
        message = 'Referenzierte Ressource nicht gefunden';
    } else if (err.code === 'ER_ROW_IS_REFERENCED') {
        statusCode = 409;
        message = 'Ressource wird noch verwendet und kann nicht gelöscht werden';
    }

    // JWT-Fehler behandeln
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Ungültiger Token';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token abgelaufen';
    }

    // Validation-Fehler behandeln
    if (err.name === 'ValidationError') {
        statusCode = 422;
    }

    // Erstelle standardisierten Fehler
    const apiError = new ApiError(statusCode, message, err.details);
    apiError.stack = err.stack;

    // Logging
    if (statusCode >= 500) {
        logger.error('Server-Fehler', {
            error: message,
            stack: err.stack,
            path: req.path,
            method: req.method,
            userId: req.user?.id
        });
    } else {
        logger.warn('Client-Fehler', {
            error: message,
            statusCode,
            path: req.path,
            method: req.method
        });
    }

    // Response senden
    const errorResponse = formatErrorResponse(apiError, req);
    res.status(statusCode).json(errorResponse);
}

/**
 * Success-Response Helper
 * Für einheitliche erfolgreiche Responses
 */
function sendSuccess(res, data = null, message = null, statusCode = 200) {
    const response = { success: true };

    if (message) {
        response.message = message;
    }

    if (data !== null) {
        if (Array.isArray(data)) {
            response.count = data.length;
            response.data = data;
        } else if (typeof data === 'object') {
            Object.assign(response, data);
        } else {
            response.data = data;
        }
    }

    res.status(statusCode).json(response);
}

module.exports = {
    ApiError,
    asyncHandler,
    notFoundHandler,
    errorHandler,
    sendSuccess
};
