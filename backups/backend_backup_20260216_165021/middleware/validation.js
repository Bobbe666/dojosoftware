/**
 * Input-Validation Middleware
 * Zentrale Validierung für alle API-Endpoints
 */

const { ApiError } = require('./errorHandler');

/**
 * Validiert, dass Pflichtfelder vorhanden sind
 * @param {string[]} fields - Liste der Pflichtfelder
 */
const requireFields = (fields) => {
    return (req, res, next) => {
        const missing = [];
        const body = req.body || {};

        for (const field of fields) {
            if (body[field] === undefined || body[field] === null || body[field] === '') {
                missing.push(field);
            }
        }

        if (missing.length > 0) {
            return next(ApiError.badRequest(
                `Pflichtfelder fehlen: ${missing.join(', ')}`,
                { missing_fields: missing }
            ));
        }

        next();
    };
};

/**
 * Validiert numerische Parameter
 * @param {string} paramName - Name des Parameters
 * @param {object} options - { min, max, integer, required }
 */
const validateNumber = (paramName, options = {}) => {
    const { min, max, integer = false, required = true } = options;

    return (req, res, next) => {
        const value = req.params[paramName] || req.query[paramName] || req.body[paramName];

        // Nicht vorhanden
        if (value === undefined || value === null || value === '') {
            if (required) {
                return next(ApiError.badRequest(`${paramName} ist erforderlich`));
            }
            return next();
        }

        // Parse
        const num = Number(value);

        // Keine gültige Zahl
        if (isNaN(num)) {
            return next(ApiError.badRequest(`${paramName} muss eine Zahl sein`));
        }

        // Integer-Prüfung
        if (integer && !Number.isInteger(num)) {
            return next(ApiError.badRequest(`${paramName} muss eine Ganzzahl sein`));
        }

        // Min/Max-Prüfung
        if (min !== undefined && num < min) {
            return next(ApiError.badRequest(`${paramName} muss mindestens ${min} sein`));
        }

        if (max !== undefined && num > max) {
            return next(ApiError.badRequest(`${paramName} darf maximal ${max} sein`));
        }

        next();
    };
};

/**
 * Validiert ID-Parameter (positive Ganzzahl)
 * @param {string} paramName - Name des ID-Parameters (default: 'id')
 */
const validateId = (paramName = 'id') => {
    return validateNumber(paramName, { min: 1, integer: true, required: true });
};

/**
 * Validiert E-Mail-Adressen
 * @param {string} fieldName - Name des E-Mail-Feldes
 * @param {boolean} required - Ob das Feld erforderlich ist
 */
const validateEmail = (fieldName = 'email', required = true) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return (req, res, next) => {
        const value = req.body[fieldName];

        if (!value) {
            if (required) {
                return next(ApiError.badRequest(`${fieldName} ist erforderlich`));
            }
            return next();
        }

        if (!emailRegex.test(value)) {
            return next(ApiError.badRequest(`${fieldName} ist keine gültige E-Mail-Adresse`));
        }

        next();
    };
};

/**
 * Validiert Datum im ISO-Format (YYYY-MM-DD)
 * @param {string} fieldName - Name des Datumsfeldes
 * @param {object} options - { required, minDate, maxDate }
 */
const validateDate = (fieldName, options = {}) => {
    const { required = true, minDate, maxDate } = options;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    return (req, res, next) => {
        const value = req.body[fieldName] || req.query[fieldName];

        if (!value) {
            if (required) {
                return next(ApiError.badRequest(`${fieldName} ist erforderlich`));
            }
            return next();
        }

        // Format-Prüfung
        if (!dateRegex.test(value)) {
            return next(ApiError.badRequest(
                `${fieldName} muss im Format YYYY-MM-DD sein`
            ));
        }

        // Gültiges Datum
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return next(ApiError.badRequest(`${fieldName} ist kein gültiges Datum`));
        }

        // Min/Max-Prüfung
        if (minDate && date < new Date(minDate)) {
            return next(ApiError.badRequest(
                `${fieldName} darf nicht vor ${minDate} liegen`
            ));
        }

        if (maxDate && date > new Date(maxDate)) {
            return next(ApiError.badRequest(
                `${fieldName} darf nicht nach ${maxDate} liegen`
            ));
        }

        next();
    };
};

/**
 * Validiert String-Länge
 * @param {string} fieldName - Name des Feldes
 * @param {object} options - { min, max, required, trim }
 */
const validateString = (fieldName, options = {}) => {
    const { min = 0, max = 1000, required = true, trim = true } = options;

    return (req, res, next) => {
        let value = req.body[fieldName];

        if (value && trim && typeof value === 'string') {
            value = value.trim();
            req.body[fieldName] = value;
        }

        if (!value || value === '') {
            if (required) {
                return next(ApiError.badRequest(`${fieldName} ist erforderlich`));
            }
            return next();
        }

        if (typeof value !== 'string') {
            return next(ApiError.badRequest(`${fieldName} muss ein Text sein`));
        }

        if (value.length < min) {
            return next(ApiError.badRequest(
                `${fieldName} muss mindestens ${min} Zeichen haben`
            ));
        }

        if (value.length > max) {
            return next(ApiError.badRequest(
                `${fieldName} darf maximal ${max} Zeichen haben`
            ));
        }

        next();
    };
};

/**
 * Validiert Enum-Werte
 * @param {string} fieldName - Name des Feldes
 * @param {string[]} allowedValues - Erlaubte Werte
 * @param {boolean} required - Ob das Feld erforderlich ist
 */
const validateEnum = (fieldName, allowedValues, required = true) => {
    return (req, res, next) => {
        const value = req.body[fieldName] || req.query[fieldName];

        if (!value) {
            if (required) {
                return next(ApiError.badRequest(`${fieldName} ist erforderlich`));
            }
            return next();
        }

        if (!allowedValues.includes(value)) {
            return next(ApiError.badRequest(
                `${fieldName} muss einer der folgenden Werte sein: ${allowedValues.join(', ')}`
            ));
        }

        next();
    };
};

/**
 * Validiert IBAN
 * @param {string} fieldName - Name des IBAN-Feldes
 * @param {boolean} required - Ob das Feld erforderlich ist
 */
const validateIBAN = (fieldName = 'iban', required = true) => {
    // IBAN-Regex (vereinfacht, für DE/AT/CH)
    const ibanRegex = /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/;

    return (req, res, next) => {
        let value = req.body[fieldName];

        if (!value) {
            if (required) {
                return next(ApiError.badRequest(`${fieldName} ist erforderlich`));
            }
            return next();
        }

        // Leerzeichen entfernen und Großschreibung
        value = value.replace(/\s/g, '').toUpperCase();
        req.body[fieldName] = value;

        if (!ibanRegex.test(value)) {
            return next(ApiError.badRequest(`${fieldName} ist keine gültige IBAN`));
        }

        next();
    };
};

/**
 * Validiert dojo_id aus Query oder Body
 * Erlaubt 'all' für Super-Admin
 */
const validateDojoId = (required = false) => {
    return (req, res, next) => {
        const value = req.query.dojo_id || req.body.dojo_id;

        if (!value || value === '') {
            if (required) {
                return next(ApiError.badRequest('dojo_id ist erforderlich'));
            }
            return next();
        }

        // 'all' ist erlaubt für Super-Admins
        if (value === 'all') {
            return next();
        }

        const num = parseInt(value, 10);
        if (isNaN(num) || num < 1) {
            return next(ApiError.badRequest('dojo_id muss eine positive Zahl oder "all" sein'));
        }

        next();
    };
};

/**
 * Sanitize: Entfernt gefährliche HTML-Tags aus String-Feldern
 * @param {string[]} fields - Liste der zu sanitizenden Felder
 */
const sanitizeStrings = (fields) => {
    return (req, res, next) => {
        for (const field of fields) {
            if (req.body[field] && typeof req.body[field] === 'string') {
                // Entferne Script-Tags und Event-Handler
                req.body[field] = req.body[field]
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/on\w+="[^"]*"/gi, '')
                    .replace(/on\w+='[^']*'/gi, '');
            }
        }
        next();
    };
};

/**
 * Kombiniert mehrere Validatoren
 * @param  {...Function} validators - Array von Validation-Middlewares
 */
const validate = (...validators) => {
    return async (req, res, next) => {
        for (const validator of validators) {
            await new Promise((resolve, reject) => {
                validator(req, res, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            }).catch(next);
        }
        next();
    };
};

module.exports = {
    requireFields,
    validateNumber,
    validateId,
    validateEmail,
    validateDate,
    validateString,
    validateEnum,
    validateIBAN,
    validateDojoId,
    sanitizeStrings,
    validate
};
