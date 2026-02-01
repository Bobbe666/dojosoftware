/**
 * Backend Konstanten
 * Zentrale Definition für wiederverwendbare Strings und Werte
 */

// =============================================================================
// HTTP Status Codes (zur Dokumentation)
// =============================================================================
const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500
};

// =============================================================================
// Error Messages - Deutsch
// =============================================================================
const ERROR_MESSAGES = {
    // Authentifizierung
    AUTH: {
        INVALID_CREDENTIALS: 'Ungültige E-Mail oder Passwort',
        NOT_AUTHENTICATED: 'Nicht authentifiziert',
        TOKEN_INVALID: 'Token ungültig oder abgelaufen',
        TOKEN_MISSING: 'Token fehlt',
        TOKEN_EXPIRED: 'Token abgelaufen',
        ACCESS_DENIED: 'Zugriff verweigert',
        EMAIL_PASSWORD_REQUIRED: 'E-Mail und Passwort sind erforderlich',
        PASSWORD_MIN_LENGTH: 'Passwort muss mindestens 8 Zeichen lang sein',
        SET_PASSWORD_FIRST: 'Bitte setze zuerst ein Passwort über "Passwort vergessen"',
        OLD_PASSWORD_WRONG: 'Altes Passwort ist falsch',
        PASSWORDS_REQUIRED: 'Altes und neues Passwort sind erforderlich'
    },

    // Validierung
    VALIDATION: {
        REQUIRED_FIELD: 'Pflichtfeld',
        REQUIRED_FIELDS_MISSING: 'Pflichtfelder fehlen',
        VALIDATION_FAILED: 'Validierungsfehler',
        INVALID_EMAIL: 'Ungültige E-Mail-Adresse',
        INVALID_DATE: 'Ungültiges Datum',
        INVALID_ID: 'Ungültige ID',
        INVALID_IBAN: 'Ungültige IBAN',
        INVALID_TYPE: 'Ungültiger Typ',
        NO_CHANGES: 'Keine Änderungen'
    },

    // Ressourcen
    RESOURCE: {
        NOT_FOUND: 'Ressource nicht gefunden',
        ALREADY_EXISTS: 'Ressource existiert bereits',
        MITGLIED_NOT_FOUND: 'Mitglied nicht gefunden',
        VORLAGE_NOT_FOUND: 'Vorlage nicht gefunden',
        DOJO_NOT_FOUND: 'Dojo nicht gefunden',
        STIL_NOT_FOUND: 'Stil nicht gefunden',
        PRUEFUNG_NOT_FOUND: 'Prüfung nicht gefunden',
        VERTRAG_NOT_FOUND: 'Vertrag nicht gefunden',
        SEPA_NOT_FOUND: 'SEPA-Mandat nicht gefunden',
        USER_NOT_FOUND: 'Benutzer nicht gefunden',
        KURS_NOT_FOUND: 'Kurs nicht gefunden',
        TERMIN_NOT_FOUND: 'Termin nicht gefunden'
    },

    // Datenbankfehler
    DATABASE: {
        ERROR: 'Datenbankfehler',
        CONNECTION_FAILED: 'Datenbankverbindung fehlgeschlagen',
        QUERY_FAILED: 'Abfrage fehlgeschlagen'
    },

    // Allgemeine Fehler
    GENERAL: {
        SERVER_ERROR: 'Serverfehler',
        INTERNAL_ERROR: 'Interner Server-Fehler',
        OPERATION_FAILED: 'Operation fehlgeschlagen',
        LOADING_ERROR: 'Fehler beim Laden der Daten',
        SAVE_ERROR: 'Fehler beim Speichern',
        DELETE_ERROR: 'Fehler beim Löschen',
        UPDATE_ERROR: 'Aktualisierung fehlgeschlagen'
    },

    // Registrierung
    REGISTRATION: {
        EMAIL_EXISTS: 'Diese E-Mail ist bereits registriert',
        INVALID_TYPE: 'Ungültiger Mitgliedschaftstyp',
        AGB_REQUIRED: 'AGB und Datenschutz müssen akzeptiert werden',
        FAILED: 'Registrierung fehlgeschlagen'
    },

    // SEPA
    SEPA: {
        IBAN_REQUIRED: 'IBAN ist erforderlich',
        INVALID_IBAN: 'Ungültige IBAN',
        MANDATE_EXISTS: 'Aktives Mandat existiert bereits'
    },

    // PDF/Dokumente
    DOCUMENT: {
        GENERATION_FAILED: 'Fehler beim Generieren des PDFs',
        TEMPLATE_ERROR: 'Vorlagenfehler'
    }
};

// =============================================================================
// Success Messages - Deutsch
// =============================================================================
const SUCCESS_MESSAGES = {
    // Auth
    AUTH: {
        LOGIN_SUCCESS: 'Erfolgreich angemeldet',
        LOGOUT_SUCCESS: 'Erfolgreich abgemeldet',
        PASSWORD_CHANGED: 'Passwort erfolgreich geändert',
        PASSWORD_RESET_SENT: 'E-Mail zum Zurücksetzen des Passworts wurde gesendet',
        EMAIL_VERIFIED: 'E-Mail erfolgreich verifiziert!'
    },

    // CRUD
    CRUD: {
        CREATED: 'Erfolgreich erstellt',
        UPDATED: 'Erfolgreich aktualisiert',
        DELETED: 'Erfolgreich gelöscht',
        SAVED: 'Erfolgreich gespeichert'
    },

    // Registrierung
    REGISTRATION: {
        SUCCESS: 'Registrierung erfolgreich! Bitte prüfe deine E-Mails.'
    },

    // Mitglieder
    MEMBER: {
        ARCHIVED: 'Mitglied archiviert',
        RESTORED: 'Mitglied wiederhergestellt',
        IMPORTED: 'Mitglieder importiert'
    },

    // Prüfungen
    EXAM: {
        SCHEDULED: 'Prüfung geplant',
        PASSED: 'Prüfung bestanden',
        CANCELLED: 'Prüfung abgesagt'
    }
};

// =============================================================================
// Zahlungsmethoden
// =============================================================================
const PAYMENT_METHODS = {
    LASTSCHRIFT: 'Lastschrift',
    UEBERWEISUNG: 'Überweisung',
    BAR: 'Bar',
    RECHNUNG: 'Rechnung'
};

const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHODS);

// =============================================================================
// Mitglied Status
// =============================================================================
const MEMBER_STATUS = {
    AKTIV: 'aktiv',
    INAKTIV: 'inaktiv',
    ARCHIVIERT: 'archiviert',
    PAUSIERT: 'pausiert'
};

const MEMBER_STATUS_VALUES = Object.values(MEMBER_STATUS);

// =============================================================================
// Vertrags-Status
// =============================================================================
const CONTRACT_STATUS = {
    AKTIV: 'aktiv',
    GEKUENDIGT: 'gekuendigt',
    AUSSTEHEND: 'ausstehend',
    BEENDET: 'beendet'
};

const CONTRACT_STATUS_VALUES = Object.values(CONTRACT_STATUS);

// =============================================================================
// SEPA Status
// =============================================================================
const SEPA_STATUS = {
    AKTIV: 'aktiv',
    INAKTIV: 'inaktiv',
    WIDERRUFEN: 'widerrufen'
};

const SEPA_STATUS_VALUES = Object.values(SEPA_STATUS);

// =============================================================================
// Prüfungs-Status
// =============================================================================
const EXAM_STATUS = {
    GEPLANT: 'geplant',
    BESTANDEN: 'bestanden',
    NICHT_BESTANDEN: 'nicht_bestanden',
    ABGESAGT: 'abgesagt',
    ANGEMELDET: 'angemeldet'
};

const EXAM_STATUS_VALUES = Object.values(EXAM_STATUS);

// =============================================================================
// Mitgliedschafts-Typen (Verband)
// =============================================================================
const MEMBERSHIP_TYPES = {
    DOJO: 'dojo',
    EINZELPERSON: 'einzelperson'
};

const MEMBERSHIP_TYPE_VALUES = Object.values(MEMBERSHIP_TYPES);

// =============================================================================
// Rollen
// =============================================================================
const ROLES = {
    ADMIN: 'admin',
    SUPERADMIN: 'superadmin',
    TRAINER: 'trainer',
    MITGLIED: 'mitglied',
    VERBANDSMITGLIED: 'verbandsmitglied'
};

const ROLE_VALUES = Object.values(ROLES);

// =============================================================================
// Geschlecht
// =============================================================================
const GENDER = {
    MAENNLICH: 'männlich',
    WEIBLICH: 'weiblich',
    DIVERS: 'divers'
};

const GENDER_VALUES = Object.values(GENDER);

// =============================================================================
// Wochentage
// =============================================================================
const WEEKDAYS = {
    MONTAG: 'Montag',
    DIENSTAG: 'Dienstag',
    MITTWOCH: 'Mittwoch',
    DONNERSTAG: 'Donnerstag',
    FREITAG: 'Freitag',
    SAMSTAG: 'Samstag',
    SONNTAG: 'Sonntag'
};

const WEEKDAY_VALUES = Object.values(WEEKDAYS);

// =============================================================================
// Regex Patterns
// =============================================================================
const PATTERNS = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    IBAN_DE: /^DE\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2}$/i,
    PHONE: /^[\d\s\-\+\(\)\/]+$/,
    DATE_ISO: /^\d{4}-\d{2}-\d{2}$/,
    POSTAL_CODE_DE: /^\d{5}$/
};

// =============================================================================
// Limits
// =============================================================================
const LIMITS = {
    PASSWORD_MIN_LENGTH: 8,
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 50,
    EMAIL_MAX_LENGTH: 255,
    NAME_MAX_LENGTH: 100,
    DESCRIPTION_MAX_LENGTH: 1000,
    NOTES_MAX_LENGTH: 5000,
    FILE_SIZE_MAX: 10 * 1024 * 1024, // 10MB
    PAGINATION_DEFAULT: 50,
    PAGINATION_MAX: 500
};

// =============================================================================
// Exports
// =============================================================================
module.exports = {
    HTTP_STATUS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    PAYMENT_METHODS,
    PAYMENT_METHOD_VALUES,
    MEMBER_STATUS,
    MEMBER_STATUS_VALUES,
    CONTRACT_STATUS,
    CONTRACT_STATUS_VALUES,
    SEPA_STATUS,
    SEPA_STATUS_VALUES,
    EXAM_STATUS,
    EXAM_STATUS_VALUES,
    MEMBERSHIP_TYPES,
    MEMBERSHIP_TYPE_VALUES,
    ROLES,
    ROLE_VALUES,
    GENDER,
    GENDER_VALUES,
    WEEKDAYS,
    WEEKDAY_VALUES,
    PATTERNS,
    LIMITS
};
