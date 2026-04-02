/**
 * VERBAND AUTH ROUTES
 * ===================
 * Login/Register für Verbandsmitglieder-Portal auf tda-intl.com
 */

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailTemplates');

// Magic-Bytes Prüfung für sicheren File-Upload
const checkImageMagicBytes = (buffer) => {
  if (!buffer || buffer.length < 12) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;
  // WebP: RIFF....WEBP (bytes 0-3 = 52 49 46 46, bytes 8-11 = 57 45 42 50)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return true;
  return false;
};

const logoUpload = multer({
  storage: multer.memoryStorage(), // In-Memory für Magic-Bytes Check
  limits: { fileSize: 500 * 1024 }, // 500KB - Logos brauchen nicht mehr
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bildformate (JPEG, PNG, GIF, WebP) erlaubt'), false);
    }
  }
});

// Helper: Logo-Buffer auf Disk speichern (nach Magic-Bytes-Check)
const saveLogoBuffer = async (buffer, filename) => {
  const fs = require('fs');
  const uploadDir = require('path').join(__dirname, '../uploads/verband-logos');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const filepath = require('path').join(uploadDir, filename);
  await fs.promises.writeFile(filepath, buffer);
  return filepath;
};
const {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  MEMBERSHIP_TYPE_VALUES,
  LIMITS
} = require('../utils/constants');

// JWT_SECRET wird aus der zentralen auth.js importiert (hat Startup-Check)
const { JWT_SECRET } = require('../middleware/auth');

// Debug-Logging
router.use((req, res, next) => {
  logger.debug('🔐 Verband-Auth Route:', req.method, req.path);
  next();
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const queryAsync = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// Rate Limiter für Auth-Endpoints
const verbandLoginLimiter = require("express-rate-limit")({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Zu viele Login-Versuche. Bitte warte 15 Minuten." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});
const verbandRegisterLimiter = require("express-rate-limit")({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Zu viele Registrierungsversuche. Bitte warte eine Stunde." },
  standardHeaders: true,
  legacyHeaders: false,
});
const verbandResetLimiter = require("express-rate-limit")({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Zu viele Anfragen. Bitte warte eine Stunde." },
  standardHeaders: true,
  legacyHeaders: false,
});
const generateMitgliedsnummer = async (typ) => {
  const prefix = typ === 'dojo' ? 'TDA-D' : 'TDA-E';
  const year = new Date().getFullYear().toString().slice(-2);

  const result = await queryAsync(
    `SELECT COUNT(*) as count FROM verbandsmitgliedschaften WHERE typ = ? AND YEAR(created_at) = YEAR(NOW())`,
    [typ]
  );

  const count = result[0].count + 1;
  return `${prefix}${year}-${count.toString().padStart(4, '0')}`;
};

// ============================================================================
// PUBLIC ROUTES (NO AUTH REQUIRED)
// ============================================================================

/**
 * POST /api/verband-auth/register
 * Registrierung als Verbandsmitglied (Dojo oder Einzelperson)
 */
router.post('/register', verbandRegisterLimiter, async (req, res) => {
  try {
    const {
      typ, // 'dojo' oder 'einzelperson'
      email,
      passwort,
      // Personen-Daten (für Einzelperson oder Ansprechpartner)
      vorname,
      nachname,
      telefon,
      strasse,
      plz,
      ort,
      land,
      geburtsdatum,
      // Dojo-Daten (nur für typ='dojo')
      dojo_name,
      dojo_inhaber,
      dojo_strasse,
      dojo_plz,
      dojo_ort,
      dojo_land,
      dojo_telefon,
      dojo_website,
      dojo_mitglieder_anzahl,
      // Optionen
      newsletter,
      agb_akzeptiert,
      dsgvo_akzeptiert
    } = req.body;

    // Validierung
    if (!typ || !MEMBERSHIP_TYPE_VALUES.includes(typ)) {
      return res.status(400).json({ error: ERROR_MESSAGES.REGISTRATION.INVALID_TYPE });
    }

    if (!email || !passwort) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.EMAIL_PASSWORD_REQUIRED });
    }

    if (passwort.length < LIMITS.PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.PASSWORD_MIN_LENGTH });
    }

    // Passwort-Komplexität prüfen (min. Großbuchstabe + Kleinbuchstabe + Zahl)
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(passwort)) {
      return res.status(400).json({
        error: 'Passwort muss mindestens einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten.'
      });
    }

    if (!agb_akzeptiert || !dsgvo_akzeptiert) {
      return res.status(400).json({ error: ERROR_MESSAGES.REGISTRATION.AGB_REQUIRED });
    }

    // Prüfen ob E-Mail schon existiert
    const existing = await queryAsync(
      `SELECT id FROM verbandsmitgliedschaften WHERE
       (typ = 'einzelperson' AND person_email = ?) OR
       (typ = 'dojo' AND dojo_email = ?)`,
      [email, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: ERROR_MESSAGES.REGISTRATION.EMAIL_EXISTS });
    }

    // Passwort hashen
    const passwort_hash = await bcrypt.hash(passwort, 10);

    // Verification Token generieren
    const verification_token = crypto.randomBytes(32).toString('hex');

    // Mitgliedsnummer generieren
    const mitgliedsnummer = await generateMitgliedsnummer(typ);

    // Jahresbeitrag aus Einstellungen holen
    const beitragResult = await queryAsync(
      `SELECT einstellung_value FROM verband_einstellungen WHERE einstellung_key = ?`,
      [typ === 'dojo' ? 'preis_dojo_mitgliedschaft' : 'preis_einzel_mitgliedschaft']
    );
    const jahresbeitrag = beitragResult.length > 0 ? parseFloat(beitragResult[0].einstellung_value) : (typ === 'dojo' ? 99.00 : 49.00);

    // Gültigkeit berechnen (1 Jahr ab jetzt)
    const gueltig_von = new Date();
    const gueltig_bis = new Date();
    gueltig_bis.setFullYear(gueltig_bis.getFullYear() + 1);

    // Mitgliedschaft erstellen
    const insertData = {
      typ,
      mitgliedsnummer,
      jahresbeitrag,
      gueltig_von: gueltig_von.toISOString().split('T')[0],
      gueltig_bis: gueltig_bis.toISOString().split('T')[0],
      status: 'ausstehend', // Wird 'aktiv' nach Zahlung
      passwort_hash,
      verification_token,
      email_verified: 0,
      newsletter: newsletter ? 1 : 0,
      agb_akzeptiert: 1,
      agb_akzeptiert_am: new Date(),
      dsgvo_akzeptiert: 1,
      dsgvo_akzeptiert_am: new Date(),
      zahlungsart: 'rechnung'
    };

    if (typ === 'einzelperson') {
      insertData.person_vorname = vorname;
      insertData.person_nachname = nachname;
      insertData.person_email = email;
      insertData.person_telefon = telefon;
      insertData.person_strasse = strasse;
      insertData.person_plz = plz;
      insertData.person_ort = ort;
      insertData.person_land = land || 'Deutschland';
      insertData.person_geburtsdatum = geburtsdatum;
    } else {
      // Dojo-Mitgliedschaft
      insertData.dojo_name = dojo_name;
      insertData.dojo_inhaber = dojo_inhaber || `${vorname} ${nachname}`;
      insertData.dojo_email = email;
      insertData.dojo_strasse = dojo_strasse;
      insertData.dojo_plz = dojo_plz;
      insertData.dojo_ort = dojo_ort;
      insertData.dojo_land = dojo_land || 'Deutschland';
      insertData.dojo_telefon = dojo_telefon;
      insertData.dojo_website = dojo_website;
      insertData.dojo_mitglieder_anzahl = dojo_mitglieder_anzahl;
      // Ansprechpartner-Daten
      insertData.person_vorname = vorname;
      insertData.person_nachname = nachname;
      insertData.person_email = email;
      insertData.person_telefon = telefon;
    }

    const columns = Object.keys(insertData).join(', ');
    const placeholders = Object.keys(insertData).map(() => '?').join(', ');
    const values = Object.values(insertData);

    const result = await queryAsync(
      `INSERT INTO verbandsmitgliedschaften (${columns}) VALUES (${placeholders})`,
      values
    );

    // Verification-E-Mail senden
    try {
      await sendVerificationEmail(email, {
        name: `${vorname} ${nachname}`,
        verificationToken: verification_token,
        verificationUrl: `https://tda-intl.com/verify?token=${verification_token}`
      });
      logger.info(`Verification-Email gesendet an ${email}`);
    } catch (emailErr) {
      logger.warn(`Verification-Email konnte nicht gesendet werden: ${emailErr.message}`);
    }

    // Super-Admin Benachrichtigung erstellen
    try {
      await queryAsync(`
        INSERT INTO super_admin_notifications (typ, titel, nachricht, prioritaet, empfaenger_typ)
        VALUES (?, ?, ?, 'normal', 'admin')
      `, [
        typ === 'dojo' ? 'dojo_registriert' : 'verbandsmitglied_registriert',
        typ === 'dojo' ? 'Neues Dojo registriert' : 'Neues Verbandsmitglied',
        typ === 'dojo'
          ? `${dojo_name || 'Unbekanntes Dojo'} hat sich registriert (${vorname} ${nachname})`
          : `${vorname} ${nachname} (${email}) hat sich als Verbandsmitglied registriert`
      ]);
      logger.debug('📬 Super-Admin Benachrichtigung erstellt');
    } catch (notifErr) {
      logger.warn('⚠️ Konnte Super-Admin Benachrichtigung nicht erstellen:', notifErr.message);
    }

    res.json({
      success: true,
      message: SUCCESS_MESSAGES.REGISTRATION.SUCCESS,
      mitgliedsnummer,
      id: result.insertId
    });

  } catch (error) {
    logger.error('Register-Fehler:', error);
    res.status(500).json({ error: ERROR_MESSAGES.REGISTRATION.FAILED, details: error.message });
  }
});

/**
 * POST /api/verband-auth/login
 * Login für Verbandsmitglieder (E-Mail oder Benutzername/Mitgliedsnummer)
 */
router.post('/login', verbandLoginLimiter, async (req, res) => {
  try {
    const { email, benutzername, passwort } = req.body;
    const loginIdentifier = email || benutzername;

    if (!loginIdentifier || !passwort) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.EMAIL_PASSWORD_REQUIRED });
    }

    logger.info('Login-Versuch:', { loginIdentifier, isEmail: loginIdentifier.includes('@') });

    // Mitglied suchen - COALESCE für verknüpfte Dojos
    // Suche nach E-Mail ODER Mitgliedsnummer (Benutzername)
    const members = await queryAsync(
      `SELECT
        vm.id, vm.typ, vm.dojo_id, vm.mitglied_id, vm.mitgliedsnummer,
        vm.person_vorname, vm.person_nachname, vm.person_email,
        vm.person_telefon, vm.person_strasse, vm.person_plz, vm.person_ort,
        vm.person_land, vm.person_geburtsdatum, vm.person_firma, vm.person_position,
        vm.status, vm.jahresbeitrag, vm.gueltig_von, vm.gueltig_bis,
        vm.zahlungsart, vm.beitragsfrei, vm.agb_akzeptiert, vm.dsgvo_akzeptiert,
        vm.widerrufsrecht_akzeptiert, vm.unterschrift_digital, vm.unterschrift_datum,
        vm.passwort_hash, vm.email_verified, vm.last_login, vm.notizen,
        vm.created_at, vm.updated_at, vm.dojo_mitglieder_anzahl, vm.logo_url,
        COALESCE(d.dojoname, vm.dojo_name) as dojo_name,
        COALESCE(d.ort, vm.dojo_ort) as dojo_ort,
        COALESCE(d.email, vm.dojo_email) as dojo_email,
        COALESCE(d.strasse, vm.dojo_strasse) as dojo_strasse,
        COALESCE(d.plz, vm.dojo_plz) as dojo_plz,
        COALESCE(d.telefon, vm.dojo_telefon) as dojo_telefon,
        COALESCE(d.internet, vm.dojo_website) as dojo_website,
        COALESCE(d.inhaber, vm.dojo_inhaber) as dojo_inhaber,
        COALESCE(d.land, vm.dojo_land) as dojo_land
      FROM verbandsmitgliedschaften vm
      LEFT JOIN dojo d ON vm.dojo_id = d.id
      WHERE vm.person_email = ? OR vm.dojo_email = ? OR d.email = ? OR vm.mitgliedsnummer = ?`,
      [loginIdentifier, loginIdentifier, loginIdentifier, loginIdentifier]
    );

    // DEBUG
    logger.info('Login Query Result:', {
      loginIdentifier,
      foundMembers: members.length,
      firstMember: members[0] ? { id: members[0].id, dojo_name: members[0].dojo_name, typ: members[0].typ } : null
    });

    if (members.length === 0) {
      return res.status(401).json({ error: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS });
    }

    const member = members[0];

    // Passwort prüfen
    if (!member.passwort_hash) {
      return res.status(401).json({ error: ERROR_MESSAGES.AUTH.SET_PASSWORD_FIRST });
    }

    const isValid = await bcrypt.compare(passwort, member.passwort_hash);
    if (!isValid) {
      return res.status(401).json({ error: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS });
    }

    // E-Mail-Verifikation prüfen
    if (member.email_verified === 0 || member.email_verified === false) {
      return res.status(403).json({
        error: 'E-Mail-Adresse nicht verifiziert. Bitte prüfe dein Postfach und bestätige deine E-Mail.',
        requiresVerification: true
      });
    }

    // Last login aktualisieren
    await queryAsync(
      `UPDATE verbandsmitgliedschaften SET last_login = NOW() WHERE id = ?`,
      [member.id]
    );

    // JWT Access Token erstellen (kurzlebig)
    const token = jwt.sign(
      {
        id: member.id,
        typ: member.typ,
        mitgliedsnummer: member.mitgliedsnummer,
        email: member.person_email || member.dojo_email,
        role: 'verbandsmitglied',
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_SECRET,
      { expiresIn: '4h' }
    );

    // Refresh-Token generieren (langlebig, in DB speichern)
    const refreshToken = require('crypto').randomBytes(40).toString('hex');
    const refreshExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 Tage
    await queryAsync(
      'UPDATE verbandsmitgliedschaften SET refresh_token = ?, refresh_token_expires = ? WHERE id = ?',
      [refreshToken, refreshExpires, member.id]
    );

    // Sensible Daten entfernen
    delete member.passwort_hash;
    delete member.verification_token;
    delete member.reset_token;
    delete member.reset_token_expires;

    // DEBUG: Log member data including logo_url
    logger.info('Login erfolgreich - Member Daten:', {
      id: member.id,
      typ: member.typ,
      dojo_name: member.dojo_name,
      dojo_id: member.dojo_id,
      person_vorname: member.person_vorname,
      logo_url: member.logo_url || 'NICHT GESETZT'
    });

    res.json({
      success: true,
      token,
      refreshToken,
      member
    });

  } catch (error) {
    logger.error('Login-Fehler:', error);
    res.status(500).json({ error: 'Login fehlgeschlagen', details: error.message });
  }
});

/**
 * POST /api/verband-auth/admin-login
 * Admin-Login für TDA-INTL Website
 * SECURITY: Credentials aus Environment Variables, nicht hardcoded
 */
router.post('/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
    }

    // SECURITY: Admin-Credentials aus Umgebungsvariablen
    const adminUsername = process.env.TDA_ADMIN_USERNAME;
    const adminPasswordHash = process.env.TDA_ADMIN_PASSWORD_HASH;

    if (!adminUsername || !adminPasswordHash) {
      logger.error('KRITISCH: TDA_ADMIN_USERNAME oder TDA_ADMIN_PASSWORD_HASH nicht konfiguriert!');
      return res.status(500).json({ error: 'Admin-Login nicht konfiguriert' });
    }

    // Benutzername prüfen (case-insensitive)
    if (username.toLowerCase() !== adminUsername.toLowerCase()) {
      logger.warn('Admin-Login fehlgeschlagen: Ungültiger Benutzername', { username });
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // Passwort mit bcrypt prüfen
    const isValid = await bcrypt.compare(password, adminPasswordHash);
    if (!isValid) {
      logger.warn('Admin-Login fehlgeschlagen: Ungültiges Passwort', { username });
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // JWT Token für Admin erstellen
    const token = jwt.sign(
      {
        role: 'tda_admin',
        username: adminUsername
      },
      JWT_SECRET,
      { expiresIn: '8h' }  // Kürzere Gültigkeit für Admin-Token
    );

    logger.info('Admin-Login erfolgreich', { username });

    res.json({
      success: true,
      token
    });

  } catch (error) {
    logger.error('Admin-Login-Fehler:', error);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

/**
 * POST /api/verband-auth/verify-email
 * E-Mail-Adresse verifizieren
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.TOKEN_MISSING });
    }

    const result = await queryAsync(
      `UPDATE verbandsmitgliedschaften
       SET email_verified = 1, verification_token = NULL
       WHERE verification_token = ?`,
      [token]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.TOKEN_INVALID });
    }

    res.json({ success: true, message: SUCCESS_MESSAGES.AUTH.EMAIL_VERIFIED });

  } catch (error) {
    logger.error('Verify-Email-Fehler:', error);
    res.status(500).json({ error: ERROR_MESSAGES.GENERAL.OPERATION_FAILED });
  }
});

/**
 * POST /api/verband-auth/forgot-password
 * Passwort-Reset anfordern
 */
router.post('/forgot-password', verbandResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'E-Mail ist erforderlich' });
    }

    const members = await queryAsync(
      `SELECT id FROM verbandsmitgliedschaften
       WHERE person_email = ? OR dojo_email = ?`,
      [email, email]
    );

    // Immer success zurückgeben (Sicherheit - keine Info ob E-Mail existiert)
    if (members.length === 0) {
      return res.json({ success: true, message: 'Falls die E-Mail existiert, wurde ein Reset-Link gesendet.' });
    }

    const reset_token = crypto.randomBytes(32).toString('hex');
    const reset_expires = new Date();
    reset_expires.setMinutes(reset_expires.getMinutes() + 30);

    await queryAsync(
      `UPDATE verbandsmitgliedschaften
       SET reset_token = ?, reset_token_expires = ?
       WHERE id = ?`,
      [reset_token, reset_expires, members[0].id]
    );

    // Reset-E-Mail senden
    try {
      await sendPasswordResetEmail(email, {
        resetToken: reset_token,
        resetUrl: `https://tda-intl.com/reset-password?token=${reset_token}`
      });
      logger.info(`Password-Reset-Email gesendet an ${email}`);
    } catch (emailErr) {
      logger.warn(`Password-Reset-Email konnte nicht gesendet werden: ${emailErr.message}`);
    }

    res.json({ success: true, message: 'Falls die E-Mail existiert, wurde ein Reset-Link gesendet.' });

  } catch (error) {
    logger.error('Forgot-Password-Fehler:', error);
    res.status(500).json({ error: 'Anfrage fehlgeschlagen' });
  }
});

/**
 * POST /api/verband-auth/reset-password
 * Passwort mit Token zurücksetzen
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, passwort } = req.body;

    if (!token || !passwort) {
      return res.status(400).json({ error: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELDS_MISSING });
    }

    if (passwort.length < LIMITS.PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.PASSWORD_MIN_LENGTH });
    }

    const members = await queryAsync(
      `SELECT id FROM verbandsmitgliedschaften
       WHERE reset_token = ? AND reset_token_expires > NOW()`,
      [token]
    );

    if (members.length === 0) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.TOKEN_INVALID });
    }

    const passwort_hash = await bcrypt.hash(passwort, 10);

    await queryAsync(
      `UPDATE verbandsmitgliedschaften
       SET passwort_hash = ?, reset_token = NULL, reset_token_expires = NULL
       WHERE id = ?`,
      [passwort_hash, members[0].id]
    );

    res.json({ success: true, message: SUCCESS_MESSAGES.AUTH.PASSWORD_CHANGED });

  } catch (error) {
    logger.error('Reset-Password-Fehler:', error);
    res.status(500).json({ error: ERROR_MESSAGES.GENERAL.OPERATION_FAILED });
  }
});

// ============================================================================
// PROTECTED ROUTES (AUTH REQUIRED)
// ============================================================================

/**
 * Middleware: JWT Token prüfen
 */
const verifyVerbandToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: ERROR_MESSAGES.AUTH.NOT_AUTHENTICATED });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ error: ERROR_MESSAGES.AUTH.TOKEN_INVALID });
  }

  // Prüfen ob User sich nach Token-Ausstellung ausgeloggt hat (Token-Invalidierung)
  if (decoded.id) {
    try {
      const rows = await queryAsync(
        'SELECT last_logout_at FROM verbandsmitgliedschaften WHERE id = ? LIMIT 1',
        [decoded.id]
      );
      if (rows.length > 0 && rows[0].last_logout_at) {
        const logoutTime = new Date(rows[0].last_logout_at).getTime() / 1000;
        if (decoded.iat && decoded.iat < logoutTime) {
          return res.status(401).json({ error: 'Session abgelaufen. Bitte erneut anmelden.' });
        }
      }
    } catch (dbErr) {
      // DB-Fehler nicht blockierend - weiter mit normaler Auth
      logger.warn('verifyVerbandToken DB-Check fehlgeschlagen:', dbErr.message);
    }
  }

  req.verbandUser = decoded;
  next();
};

/**
 * GET /api/verband-auth/me
 * Eigene Mitgliedschaftsdaten abrufen
 */
router.get('/me', verifyVerbandToken, async (req, res) => {
  try {
    // COALESCE: Bei verknüpften Dojos die Daten aus der dojo-Tabelle laden
    // Explizite Feldliste um Überschreibung durch vm.* zu vermeiden
    const members = await queryAsync(
      `SELECT
        vm.id, vm.typ, vm.dojo_id, vm.mitglied_id, vm.mitgliedsnummer,
        vm.person_vorname, vm.person_nachname, vm.person_email,
        vm.person_telefon, vm.person_strasse, vm.person_plz, vm.person_ort,
        vm.person_land, vm.person_geburtsdatum, vm.person_firma, vm.person_position,
        vm.status, vm.jahresbeitrag, vm.gueltig_von, vm.gueltig_bis,
        vm.zahlungsart, vm.beitragsfrei, vm.agb_akzeptiert, vm.dsgvo_akzeptiert,
        vm.widerrufsrecht_akzeptiert, vm.unterschrift_digital, vm.unterschrift_datum,
        vm.email_verified, vm.last_login, vm.notizen,
        vm.created_at, vm.updated_at, vm.dojo_mitglieder_anzahl, vm.logo_url,
        COALESCE(d.dojoname, vm.dojo_name) as dojo_name,
        COALESCE(d.ort, vm.dojo_ort) as dojo_ort,
        COALESCE(d.email, vm.dojo_email) as dojo_email,
        COALESCE(d.strasse, vm.dojo_strasse) as dojo_strasse,
        COALESCE(d.plz, vm.dojo_plz) as dojo_plz,
        COALESCE(d.telefon, vm.dojo_telefon) as dojo_telefon,
        COALESCE(d.internet, vm.dojo_website) as dojo_website,
        COALESCE(d.inhaber, vm.dojo_inhaber) as dojo_inhaber,
        COALESCE(d.land, vm.dojo_land) as dojo_land
      FROM verbandsmitgliedschaften vm
      LEFT JOIN dojo d ON vm.dojo_id = d.id
      WHERE vm.id = ?`,
      [req.verbandUser.id]
    );

    if (members.length === 0) {
      return res.status(404).json({ error: ERROR_MESSAGES.RESOURCE.MITGLIED_NOT_FOUND });
    }

    const member = members[0];

    // Passwort-Hash nicht zurückgeben
    delete member.passwort_hash;
    delete member.verification_token;
    delete member.reset_token;
    delete member.reset_token_expires;

    res.json({ success: true, member });

  } catch (error) {
    logger.error('Me-Fehler:', error);
    res.status(500).json({ error: ERROR_MESSAGES.GENERAL.LOADING_ERROR });
  }
});

/**
 * PUT /api/verband-auth/me
 * Eigene Daten aktualisieren
 */
router.put('/me', verifyVerbandToken, async (req, res) => {
  try {
    const allowedFields = [
      'person_vorname', 'person_nachname', 'person_email', 'person_telefon',
      'person_strasse', 'person_plz', 'person_ort', 'person_land',
      'dojo_name', 'dojo_strasse', 'dojo_plz', 'dojo_ort', 'dojo_land',
      'dojo_telefon', 'dojo_website', 'dojo_mitglieder_anzahl',
      'newsletter', 'kommunikation_email', 'kommunikation_post'
    ];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: ERROR_MESSAGES.VALIDATION.NO_CHANGES });
    }

    values.push(req.verbandUser.id);

    await queryAsync(
      `UPDATE verbandsmitgliedschaften SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Falls Mitglied mit einer Dojo verknüpft ist, auch dort die Felder aktualisieren
    // damit COALESCE in GET /me die neuen Werte zurückgibt
    const member = await queryAsync(
      `SELECT dojo_id FROM verbandsmitgliedschaften WHERE id = ?`,
      [req.verbandUser.id]
    );
    if (member[0]?.dojo_id) {
      const dojoFieldMap = {
        dojo_name:     'dojoname',
        dojo_strasse:  'strasse',
        dojo_plz:      'plz',
        dojo_ort:      'ort',
        dojo_land:     'land',
        dojo_telefon:  'telefon',
        dojo_website:  'internet',
        dojo_email:    'email',
      };
      const dojoUpdates = [];
      const dojoValues = [];
      for (const [vmField, dojoField] of Object.entries(dojoFieldMap)) {
        if (req.body[vmField] !== undefined) {
          dojoUpdates.push(`${dojoField} = ?`);
          dojoValues.push(req.body[vmField]);
        }
      }
      if (dojoUpdates.length > 0) {
        dojoValues.push(member[0].dojo_id);
        await queryAsync(
          `UPDATE dojo SET ${dojoUpdates.join(', ')} WHERE id = ?`,
          dojoValues
        );
      }
    }

    res.json({ success: true, message: SUCCESS_MESSAGES.CRUD.UPDATED });

  } catch (error) {
    logger.error('Update-Fehler:', error);
    res.status(500).json({ error: ERROR_MESSAGES.GENERAL.UPDATE_ERROR });
  }
});

/**
 * PUT /api/verband-auth/change-password
 * Passwort ändern (eingeloggt)
 */
router.put('/change-password', verifyVerbandToken, async (req, res) => {
  try {
    const { altes_passwort, neues_passwort } = req.body;

    if (!altes_passwort || !neues_passwort) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.PASSWORDS_REQUIRED });
    }

    if (neues_passwort.length < LIMITS.PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.PASSWORD_MIN_LENGTH });
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(neues_passwort)) {
      return res.status(400).json({
        error: 'Passwort muss mindestens einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten.'
      });
    }

    const members = await queryAsync(
      `SELECT passwort_hash FROM verbandsmitgliedschaften WHERE id = ?`,
      [req.verbandUser.id]
    );

    if (members.length === 0) {
      return res.status(404).json({ error: ERROR_MESSAGES.RESOURCE.MITGLIED_NOT_FOUND });
    }

    const isValid = await bcrypt.compare(altes_passwort, members[0].passwort_hash);
    if (!isValid) {
      return res.status(401).json({ error: ERROR_MESSAGES.AUTH.OLD_PASSWORD_WRONG });
    }

    const passwort_hash = await bcrypt.hash(neues_passwort, 10);

    await queryAsync(
      `UPDATE verbandsmitgliedschaften SET passwort_hash = ? WHERE id = ?`,
      [passwort_hash, req.verbandUser.id]
    );

    res.json({ success: true, message: SUCCESS_MESSAGES.AUTH.PASSWORD_CHANGED });

  } catch (error) {
    logger.error('Change-Password-Fehler:', error);
    res.status(500).json({ error: ERROR_MESSAGES.GENERAL.OPERATION_FAILED });
  }
});

/**
 * GET /api/verband-auth/invoices
 * Eigene Rechnungen abrufen (aus beiden Rechnungstabellen)
 */
router.get('/invoices', verifyVerbandToken, async (req, res) => {
  try {
    // Rechnungen aus verbandsmitgliedschaft_zahlungen (Beitragsrechnungen)
    const beitragsRechnungen = await queryAsync(
      `SELECT id, rechnungsnummer, rechnungsdatum, faellig_am, betrag_brutto as betrag,
              status, bezahlt_am, 'beitrag' as typ
       FROM verbandsmitgliedschaft_zahlungen
       WHERE verbandsmitgliedschaft_id = ?`,
      [req.verbandUser.id]
    );

    // Rechnungen aus verband_rechnungen (Shop, Sonstiges)
    // Ausschluss: Rechnungsnummern die bereits in verbandsmitgliedschaft_zahlungen stehen
    const sonstigeRechnungen = await queryAsync(
      `SELECT id, rechnungsnummer, rechnungsdatum, faellig_am, summe_brutto as betrag,
              status, bezahlt_am, 'sonstig' as typ
       FROM verband_rechnungen
       WHERE empfaenger_typ = 'verbandsmitglied' AND empfaenger_id = ?
         AND rechnungsnummer NOT IN (
           SELECT rechnungsnummer FROM verbandsmitgliedschaft_zahlungen
           WHERE verbandsmitgliedschaft_id = ?
         )`,
      [req.verbandUser.id, req.verbandUser.id]
    );

    // Kombinieren und nach Datum sortieren
    const invoices = [...beitragsRechnungen, ...sonstigeRechnungen]
      .sort((a, b) => new Date(b.rechnungsdatum) - new Date(a.rechnungsdatum));

    res.json({ success: true, invoices });

  } catch (error) {
    logger.error('Invoices-Fehler:', error);
    res.status(500).json({ error: ERROR_MESSAGES.GENERAL.LOADING_ERROR });
  }
});

/**
 * Middleware für PDF-Download: akzeptiert Token auch als Query-Parameter
 * (ermöglicht direkten Browser-Download ohne fetch+blob)
 */
const verifyVerbandTokenForPdf = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];
  const queryToken = req.query.token;
  const token = headerToken || queryToken;

  if (!token) {
    return res.status(401).json({ error: ERROR_MESSAGES.AUTH.NOT_AUTHENTICATED });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: ERROR_MESSAGES.AUTH.TOKEN_INVALID });
    }
    req.verbandUser = decoded;
    next();
  });
};

/**
 * GET /api/verband-auth/invoices/:id/pdf
 * Rechnungs-PDF herunterladen (mit Besitzprüfung)
 */
router.get('/invoices/:id/pdf', verifyVerbandTokenForPdf, async (req, res) => {
  try {
    const typ = req.query.typ || 'beitrag';
    let invoice;

    if (typ === 'beitrag') {
      // Beitragsrechnung aus verbandsmitgliedschaft_zahlungen
      invoice = await queryAsync(
        `SELECT * FROM verbandsmitgliedschaft_zahlungen
         WHERE id = ? AND verbandsmitgliedschaft_id = ?`,
        [req.params.id, req.verbandUser.id]
      );
    } else {
      // Sonstige Rechnung aus verband_rechnungen
      invoice = await queryAsync(
        `SELECT * FROM verband_rechnungen
         WHERE id = ? AND empfaenger_typ = 'verbandsmitglied' AND empfaenger_id = ?`,
        [req.params.id, req.verbandUser.id]
      );
    }

    if (invoice.length === 0) {
      return res.status(404).json({ error: 'Rechnung nicht gefunden oder kein Zugriff' });
    }

    // PDF generieren
    const { generateVerbandRechnungPdf } = require('../utils/verbandVertragPdfGenerator');
    await generateVerbandRechnungPdf(req.params.id, res, typ);

  } catch (error) {
    logger.error('Invoice PDF-Fehler:', error);
    res.status(500).json({ error: 'PDF konnte nicht erstellt werden' });
  }
});

// ============================================================================
// DOJOSOFTWARE LINKING
// ============================================================================

/**
 * GET /api/verband-auth/dojosoftware-status
 * Prüft ob das Verbandsmitglied einen DojoSoftware-Account hat
 */
router.get('/dojosoftware-status', verifyVerbandToken, async (req, res) => {
  try {
    // Verbandsmitglied-Daten holen
    const members = await queryAsync(
      `SELECT id, typ, dojo_id, person_email, dojo_email FROM verbandsmitgliedschaften WHERE id = ?`,
      [req.verbandUser.id]
    );

    if (members.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const member = members[0];
    const email = member.person_email || member.dojo_email;

    // Fall 1: Bereits mit einem Dojo verknüpft
    if (member.dojo_id) {
      const dojos = await queryAsync(
        `SELECT id, dojoname, subdomain FROM dojo WHERE id = ?`,
        [member.dojo_id]
      );

      if (dojos.length > 0) {
        return res.json({
          success: true,
          status: 'linked',
          dojo: {
            id: dojos[0].id,
            name: dojos[0].dojoname,
            subdomain: dojos[0].subdomain
          },
          email,
          loginUrl: 'https://dojo.tda-intl.org/login'
        });
      }
    }

    // Fall 2: Prüfen ob gleiche Email in admin_users existiert
    const adminUsers = await queryAsync(
      `SELECT au.id, au.email, au.dojo_id, d.dojoname, d.subdomain
       FROM admin_users au
       LEFT JOIN dojo d ON au.dojo_id = d.id
       WHERE au.email = ? AND au.aktiv = 1`,
      [email]
    );

    if (adminUsers.length > 0) {
      // Account existiert mit gleicher Email - kann verknüpft werden
      return res.json({
        success: true,
        status: 'can_link',
        dojo: {
          id: adminUsers[0].dojo_id,
          name: adminUsers[0].dojoname,
          subdomain: adminUsers[0].subdomain
        },
        email,
        message: 'Ein DojoSoftware-Account mit dieser E-Mail existiert bereits. Sie können sich mit den gleichen Zugangsdaten einloggen.',
        loginUrl: 'https://dojo.tda-intl.org/login'
      });
    }

    // Fall 3: Kein Account vorhanden
    return res.json({
      success: true,
      status: 'none',
      email,
      message: 'Sie haben noch keinen DojoSoftware-Account.',
      registerUrl: 'https://dojo.tda-intl.org/registrieren'
    });

  } catch (error) {
    logger.error('DojoSoftware-Status-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des DojoSoftware-Status' });
  }
});

/**
 * POST /api/verband-auth/generate-sso-token
 * Generiert einen einmaligen SSO-Token für automatischen DojoSoftware-Login
 */
router.post('/generate-sso-token', verifyVerbandToken, async (req, res) => {
  try {
    // Verbandsmitglied-Daten holen
    const members = await queryAsync(
      `SELECT id, typ, dojo_id, person_email, dojo_email FROM verbandsmitgliedschaften WHERE id = ?`,
      [req.verbandUser.id]
    );

    if (members.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const member = members[0];
    const email = member.person_email || member.dojo_email;

    // Prüfen ob ein DojoSoftware-Account existiert
    const adminUsers = await queryAsync(
      `SELECT au.id, au.email, au.dojo_id, d.dojoname, d.subdomain
       FROM admin_users au
       LEFT JOIN dojo d ON au.dojo_id = d.id
       WHERE au.email = ? AND au.aktiv = 1`,
      [email]
    );

    if (adminUsers.length === 0) {
      return res.status(404).json({ error: 'Kein DojoSoftware-Account gefunden' });
    }

    const adminUser = adminUsers[0];

    // Einmaligen SSO-Token generieren (gültig für 60 Sekunden)
    const ssoToken = crypto.randomBytes(32).toString('hex');
    const ssoExpires = new Date();
    ssoExpires.setSeconds(ssoExpires.getSeconds() + 60);

    // Token in admin_users speichern
    await queryAsync(
      `UPDATE admin_users SET session_token = ?, session_ablauf = ? WHERE id = ?`,
      [ssoToken, ssoExpires, adminUser.id]
    );

    logger.info(`SSO-Token generiert für Verbandsmitglied ${req.verbandUser.id} -> Admin ${adminUser.id}`);

    res.json({
      success: true,
      ssoToken,
      loginUrl: `https://dojo.tda-intl.org/sso-login?token=${ssoToken}`,
      expiresAt: ssoExpires.toISOString()
    });

  } catch (error) {
    logger.error('Generate-SSO-Token-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Generieren des SSO-Tokens' });
  }
});

/**
 * POST /api/verband-auth/link-dojosoftware
 * Verknüpft den Verbandsmitglied-Account mit einem DojoSoftware-Account
 * Prüft die Credentials und verknüpft bei Erfolg
 */
router.post('/link-dojosoftware', verifyVerbandToken, async (req, res) => {
  try {
    const { email, passwort } = req.body;

    if (!email || !passwort) {
      return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich' });
    }

    // Admin-User suchen
    const adminUsers = await queryAsync(
      `SELECT au.id, au.email, au.password, au.dojo_id, d.dojoname, d.subdomain
       FROM admin_users au
       LEFT JOIN dojo d ON au.dojo_id = d.id
       WHERE au.email = ? AND au.aktiv = 1`,
      [email]
    );

    if (adminUsers.length === 0) {
      return res.status(401).json({ error: 'Kein DojoSoftware-Account mit dieser E-Mail gefunden' });
    }

    const adminUser = adminUsers[0];

    // Passwort prüfen
    const isValid = await bcrypt.compare(passwort, adminUser.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Falsches Passwort' });
    }

    // Verknüpfung herstellen
    await queryAsync(
      `UPDATE verbandsmitgliedschaften SET dojo_id = ? WHERE id = ?`,
      [adminUser.dojo_id, req.verbandUser.id]
    );

    logger.info(`Verbandsmitglied ${req.verbandUser.id} mit Dojo ${adminUser.dojo_id} verknüpft`);

    res.json({
      success: true,
      message: 'Erfolgreich verknüpft!',
      dojo: {
        id: adminUser.dojo_id,
        name: adminUser.dojoname,
        subdomain: adminUser.subdomain
      },
      loginUrl: 'https://dojo.tda-intl.org/login'
    });

  } catch (error) {
    logger.error('Link-DojoSoftware-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Verknüpfen' });
  }
});

// ============================================================================
// PUBLIC TOURNAMENT DATA (from events.tda-intl.org)
// ============================================================================

/**
 * GET /api/verband-auth/turniere
 * Holt öffentliche Turniere von der Turniersoftware
 */
router.get('/turniere', async (req, res) => {
  try {
    const https = require('https');

    const fetchTurniere = () => {
      return new Promise((resolve, reject) => {
        https.get('https://events.tda-intl.org/api/turniere/public', (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        }).on('error', reject);
      });
    };

    const result = await fetchTurniere();

    if (result.success) {
      res.json({ success: true, turniere: result.data });
    } else {
      res.json({ success: true, turniere: [] });
    }

  } catch (error) {
    logger.error('Turniere-Fetch-Fehler:', error);
    res.json({ success: true, turniere: [] }); // Graceful fallback
  }
});

// ============================================================================
// SHOP (TDA ARTIKEL)
// ============================================================================

/**
 * GET /api/verband-auth/shop/artikel
 * Holt TDA-Artikel für den Mitglieder-Shop (nur aktive, sichtbare Artikel)
 * Inkl. Mitglieder-Rabatte für zahlende/beitragsfreie Mitglieder
 */
router.get('/shop/artikel', verifyVerbandToken, async (req, res) => {
  try {
    // TDA Verband Dojo-ID = 2
    const TDA_DOJO_ID = 2;

    // Mitgliedschaftsstatus laden
    const memberResult = await queryAsync(
      `SELECT id, typ, status, beitragsfrei FROM verbandsmitgliedschaften WHERE id = ?`,
      [req.verbandUser.id]
    );
    const member = memberResult[0] || {};

    // Prüfen ob Mitglied Rabattberechtigung hat
    // Vollmitglied: status='aktiv' ODER 'vertragsfrei' ODER beitragsfrei=1
    // Basic: hat Account aber kein Vollmitglied
    const istVollmitglied = member.status === 'aktiv' || member.status === 'vertragsfrei' || member.beitragsfrei === 1;
    const istBasicMitglied = !istVollmitglied && member.id;

    // Globale Rabatt-Einstellungen laden
    let globalRabattSettings = {
      standard_rabatt_prozent: 0,
      rabatte_aktiv: false,
      hinweis_nicht_mitglied: '',
      hinweis_basic_mitglied: ''
    };

    try {
      const rabattSettingsResult = await queryAsync(
        `SELECT * FROM verband_rabatt_einstellungen LIMIT 1`
      );
      if (rabattSettingsResult.length > 0) {
        globalRabattSettings = rabattSettingsResult[0];
      }
    } catch (e) {
      // Tabelle existiert möglicherweise noch nicht
      logger.warn('verband_rabatt_einstellungen nicht gefunden:', e.message);
    }

    // Individuelle Artikel-Rabatte laden
    let artikelRabatte = {};
    try {
      const rabatteResult = await queryAsync(
        `SELECT artikel_id, rabatt_typ, rabatt_wert, gilt_fuer_dojo, gilt_fuer_einzelperson, aktiv
         FROM verband_artikel_rabatte WHERE aktiv = TRUE`
      );
      rabatteResult.forEach(r => {
        artikelRabatte[r.artikel_id] = r;
      });
    } catch (e) {
      logger.warn('verband_artikel_rabatte nicht gefunden:', e.message);
    }

    const artikel = await queryAsync(
      `SELECT
        a.artikel_id,
        a.name,
        a.beschreibung,
        a.verkaufspreis_cent,
        a.mwst_prozent,
        a.lagerbestand,
        a.lager_tracking,
        a.bild_url,
        a.bild_base64,
        a.hat_varianten,
        a.varianten_groessen,
        a.varianten_farben,
        a.varianten_material,
        a.varianten_bestand,
        a.preis_kids_cent,
        a.preis_erwachsene_cent,
        a.hat_preiskategorien,
        a.groessen_kids,
        a.groessen_erwachsene,
        ag.name as kategorie_name,
        ag.farbe as kategorie_farbe,
        ag.icon as kategorie_icon,
        ag.id as kategorie_id
      FROM artikel a
      LEFT JOIN artikelgruppen ag ON a.kategorie_id = ag.id
      WHERE a.dojo_id = ? AND a.aktiv = TRUE AND a.sichtbar_kasse = TRUE
      ORDER BY ag.sortierung ASC, a.name ASC`,
      [TDA_DOJO_ID]
    );

    // Parse JSON fields and format prices
    const formattedArtikel = artikel.map(art => {
      const parseJson = (val) => {
        if (!val) return null;
        try { return typeof val === 'string' ? JSON.parse(val) : val; }
        catch { return null; }
      };

      // Rabatt berechnen
      let rabattProzent = 0;
      let rabattCent = 0;
      let hatRabatt = false;
      let rabattInfo = null;

      if (globalRabattSettings.rabatte_aktiv) {
        // Individueller Rabatt für diesen Artikel?
        const indRabatt = artikelRabatte[art.artikel_id];
        if (indRabatt) {
          // Prüfen ob Rabatt für Mitgliedstyp gilt
          const giltFuerTyp = member.typ === 'dojo' ? indRabatt.gilt_fuer_dojo : indRabatt.gilt_fuer_einzelperson;
          if (giltFuerTyp) {
            if (indRabatt.rabatt_typ === 'prozent') {
              rabattProzent = parseFloat(indRabatt.rabatt_wert) || 0;
            } else {
              rabattCent = parseFloat(indRabatt.rabatt_wert) || 0;
            }
            hatRabatt = true;
          }
        } else {
          // Standard-Rabatt verwenden
          rabattProzent = parseFloat(globalRabattSettings.standard_rabatt_prozent) || 0;
          hatRabatt = rabattProzent > 0;
        }
      }

      // Preise berechnen
      const bruttoMultiplier = 1 + (art.mwst_prozent || 19) / 100;
      const originalPreisCent = art.verkaufspreis_cent;
      const originalPreisBruttoCent = Math.round(originalPreisCent * bruttoMultiplier);

      let rabattierterPreisCent = originalPreisCent;
      let rabattierterPreisBruttoCent = originalPreisBruttoCent;

      if (hatRabatt) {
        if (rabattProzent > 0) {
          rabattierterPreisCent = Math.round(originalPreisCent * (1 - rabattProzent / 100));
          rabattierterPreisBruttoCent = Math.round(rabattierterPreisCent * bruttoMultiplier);
          rabattInfo = { typ: 'prozent', wert: rabattProzent };
        } else if (rabattCent > 0) {
          rabattierterPreisCent = Math.max(0, originalPreisCent - rabattCent);
          rabattierterPreisBruttoCent = Math.round(rabattierterPreisCent * bruttoMultiplier);
          rabattInfo = { typ: 'festbetrag', wert: rabattCent / 100 };
        }
      }

      const ersparnisCent = originalPreisBruttoCent - rabattierterPreisBruttoCent;

      return {
        artikel_id: art.artikel_id,
        name: art.name,
        beschreibung: art.beschreibung,
        verkaufspreis_cent: art.verkaufspreis_cent,
        verkaufspreis_euro: art.verkaufspreis_cent / 100,
        // Brutto-Preise (was der Kunde zahlt)
        originalpreis_brutto_cent: originalPreisBruttoCent,
        originalpreis_brutto_euro: originalPreisBruttoCent / 100,
        // Rabattierter Preis (nur für Vollmitglieder)
        rabattierter_preis_cent: rabattierterPreisCent,
        rabattierter_preis_brutto_cent: rabattierterPreisBruttoCent,
        rabattierter_preis_brutto_euro: rabattierterPreisBruttoCent / 100,
        ersparnis_cent: ersparnisCent,
        ersparnis_euro: ersparnisCent / 100,
        // Rabatt-Infos
        hat_rabatt: hatRabatt,
        rabatt_info: rabattInfo,
        mwst_prozent: art.mwst_prozent,
        lagerbestand: art.lagerbestand,
        lager_tracking: art.lager_tracking,
        bild_url: art.bild_url,
        bild_base64: art.bild_base64,
        verfuegbar: art.lager_tracking ? art.lagerbestand > 0 : true,
        hat_varianten: art.hat_varianten === 1,
        varianten_groessen: parseJson(art.varianten_groessen) || [],
        varianten_farben: parseJson(art.varianten_farben) || [],
        varianten_material: parseJson(art.varianten_material) || [],
        varianten_bestand: parseJson(art.varianten_bestand) || {},
        hat_preiskategorien: art.hat_preiskategorien === 1,
        preis_kids_cent: art.preis_kids_cent,
        preis_kids_euro: art.preis_kids_cent ? art.preis_kids_cent / 100 : null,
        preis_erwachsene_cent: art.preis_erwachsene_cent,
        preis_erwachsene_euro: art.preis_erwachsene_cent ? art.preis_erwachsene_cent / 100 : null,
        groessen_kids: parseJson(art.groessen_kids) || [],
        groessen_erwachsene: parseJson(art.groessen_erwachsene) || [],
        kategorie: {
          id: art.kategorie_id,
          name: art.kategorie_name,
          farbe: art.kategorie_farbe,
          icon: art.kategorie_icon
        }
      };
    });

    // Gruppiere nach Kategorien
    const kategorien = {};
    formattedArtikel.forEach(art => {
      const katId = art.kategorie.id || 'sonstige';
      if (!kategorien[katId]) {
        kategorien[katId] = {
          kategorie_id: katId,
          name: art.kategorie.name || 'Sonstige',
          farbe: art.kategorie.farbe,
          icon: art.kategorie.icon,
          artikel: []
        };
      }
      kategorien[katId].artikel.push(art);
    });

    res.json({
      success: true,
      artikel: formattedArtikel,
      kategorien: Object.values(kategorien),
      // Mitgliedschafts-Infos für Frontend
      mitglied: {
        ist_vollmitglied: istVollmitglied,
        ist_basic_mitglied: istBasicMitglied,
        typ: member.typ
      },
      // Rabatt-Hinweise
      rabatt_hinweise: {
        aktiv: globalRabattSettings.rabatte_aktiv,
        hinweis_basic: globalRabattSettings.hinweis_basic_mitglied,
        hinweis_nicht_mitglied: globalRabattSettings.hinweis_nicht_mitglied,
        standard_rabatt: parseFloat(globalRabattSettings.standard_rabatt_prozent) || 0
      }
    });

  } catch (error) {
    logger.error('Shop-Artikel-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Artikel' });
  }
});

/**
 * POST /api/verband-auth/shop/bestellung
 * Erstellt eine neue Bestellung (mit Mitglieder-Rabatt falls berechtigt)
 */
router.post('/shop/bestellung', verifyVerbandToken, async (req, res) => {
  try {
    const { positionen, lieferadresse, kundennotiz } = req.body;

    if (!positionen || positionen.length === 0) {
      return res.status(400).json({ error: 'Keine Artikel im Warenkorb' });
    }

    // Mitgliedsdaten holen (inkl. Status für Rabattberechtigung)
    const members = await queryAsync(
      `SELECT id, typ, status, beitragsfrei,
              person_vorname, person_nachname, person_email, person_telefon,
              dojo_name, dojo_email, dojo_strasse, dojo_plz, dojo_ort, dojo_land,
              person_strasse, person_plz, person_ort, person_land
       FROM verbandsmitgliedschaften WHERE id = ?`,
      [req.verbandUser.id]
    );

    if (members.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const member = members[0];

    // Prüfen ob Mitglied Rabattberechtigung hat (status='aktiv' oder 'vertragsfrei' oder beitragsfrei)
    const istVollmitglied = member.status === 'aktiv' || member.status === 'vertragsfrei' || member.beitragsfrei === 1;

    // Rabatt-Einstellungen laden
    let globalRabattSettings = { standard_rabatt_prozent: 0, rabatte_aktiv: false };
    let artikelRabatte = {};

    try {
      const rabattSettingsResult = await queryAsync(`SELECT * FROM verband_rabatt_einstellungen LIMIT 1`);
      if (rabattSettingsResult.length > 0) {
        globalRabattSettings = rabattSettingsResult[0];
      }

      const rabatteResult = await queryAsync(
        `SELECT artikel_id, rabatt_typ, rabatt_wert, gilt_fuer_dojo, gilt_fuer_einzelperson
         FROM verband_artikel_rabatte WHERE aktiv = TRUE`
      );
      rabatteResult.forEach(r => { artikelRabatte[r.artikel_id] = r; });
    } catch (e) {
      logger.warn('Rabatt-Tabellen nicht gefunden:', e.message);
    }

    // Bestellnummer generieren
    const year = new Date().getFullYear();
    const countResult = await queryAsync(
      `SELECT COUNT(*) as count FROM shop_bestellungen WHERE YEAR(bestellt_am) = ?`,
      [year]
    );
    const orderNum = (countResult[0].count + 1).toString().padStart(5, '0');
    const bestellnummer = `TDA-${year}-${orderNum}`;

    // Kundendaten bestimmen
    const kundeName = member.typ === 'dojo'
      ? member.dojo_name
      : `${member.person_vorname} ${member.person_nachname}`;
    const kundeEmail = member.typ === 'dojo' ? member.dojo_email : member.person_email;
    const kundeTelefon = member.person_telefon;

    // Lieferadresse (aus Request oder Mitgliedsdaten)
    const liefStrasse = lieferadresse?.strasse || (member.typ === 'dojo' ? member.dojo_strasse : member.person_strasse);
    const liefPlz = lieferadresse?.plz || (member.typ === 'dojo' ? member.dojo_plz : member.person_plz);
    const liefOrt = lieferadresse?.ort || (member.typ === 'dojo' ? member.dojo_ort : member.person_ort);
    const liefLand = lieferadresse?.land || (member.typ === 'dojo' ? member.dojo_land : member.person_land) || 'Deutschland';

    // Artikel validieren und Preise berechnen (mit Rabatt falls berechtigt)
    let zwischensumme = 0;
    let gesamtRabatt = 0;
    const validatedPositionen = [];

    for (const pos of positionen) {
      const artikelResult = await queryAsync(
        `SELECT artikel_id, name, beschreibung, verkaufspreis_cent, mwst_prozent, lagerbestand, lager_tracking
         FROM artikel WHERE artikel_id = ? AND aktiv = TRUE`,
        [pos.artikel_id]
      );

      if (artikelResult.length === 0) {
        return res.status(400).json({ error: `Artikel ${pos.artikel_id} nicht gefunden` });
      }

      const artikel = artikelResult[0];

      // Lagerbestand prüfen
      if (artikel.lager_tracking && artikel.lagerbestand < pos.menge) {
        return res.status(400).json({ error: `Artikel "${artikel.name}" nicht ausreichend auf Lager` });
      }

      // Rabatt berechnen (nur für Vollmitglieder)
      let einzelpreis = artikel.verkaufspreis_cent;
      let rabattBetrag = 0;

      if (istVollmitglied && globalRabattSettings.rabatte_aktiv) {
        const indRabatt = artikelRabatte[artikel.artikel_id];
        let rabattProzent = 0;
        let rabattCent = 0;

        if (indRabatt) {
          const giltFuerTyp = member.typ === 'dojo' ? indRabatt.gilt_fuer_dojo : indRabatt.gilt_fuer_einzelperson;
          if (giltFuerTyp) {
            if (indRabatt.rabatt_typ === 'prozent') {
              rabattProzent = parseFloat(indRabatt.rabatt_wert) || 0;
            } else {
              rabattCent = parseFloat(indRabatt.rabatt_wert) || 0;
            }
          }
        } else {
          rabattProzent = parseFloat(globalRabattSettings.standard_rabatt_prozent) || 0;
        }

        if (rabattProzent > 0) {
          rabattBetrag = Math.round(einzelpreis * rabattProzent / 100);
          einzelpreis = einzelpreis - rabattBetrag;
        } else if (rabattCent > 0) {
          rabattBetrag = Math.min(rabattCent, einzelpreis);
          einzelpreis = einzelpreis - rabattBetrag;
        }
      }

      const gesamtpreis = einzelpreis * pos.menge;
      zwischensumme += gesamtpreis;
      gesamtRabatt += rabattBetrag * pos.menge;

      validatedPositionen.push({
        artikel_id: artikel.artikel_id,
        artikel_name: artikel.name,
        artikel_beschreibung: artikel.beschreibung,
        variante: pos.variante || null,
        menge: pos.menge,
        einzelpreis_cent: einzelpreis,
        gesamtpreis_cent: gesamtpreis,
        mwst_prozent: artikel.mwst_prozent || 19.00
      });
    }

    // Versandkosten (kostenlos für Verbandsmitglieder)
    const versandkosten = 0;
    const gesamtbetrag = zwischensumme + versandkosten;

    // Bestellung erstellen
    const bestellungResult = await queryAsync(
      `INSERT INTO shop_bestellungen
       (bestellnummer, verbandsmitgliedschaft_id, kunde_name, kunde_email, kunde_telefon,
        lieferadresse_strasse, lieferadresse_plz, lieferadresse_ort, lieferadresse_land,
        zwischensumme_cent, versandkosten_cent, gesamtbetrag_cent, kundennotiz, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offen')`,
      [bestellnummer, req.verbandUser.id, kundeName, kundeEmail, kundeTelefon,
       liefStrasse, liefPlz, liefOrt, liefLand,
       zwischensumme, versandkosten, gesamtbetrag, kundennotiz || null]
    );

    const bestellungId = bestellungResult.insertId;

    // Bestellpositionen einfügen
    for (const pos of validatedPositionen) {
      await queryAsync(
        `INSERT INTO shop_bestellpositionen
         (bestellung_id, artikel_id, artikel_name, artikel_beschreibung, variante,
          menge, einzelpreis_cent, gesamtpreis_cent, mwst_prozent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bestellungId, pos.artikel_id, pos.artikel_name, pos.artikel_beschreibung, pos.variante,
         pos.menge, pos.einzelpreis_cent, pos.gesamtpreis_cent, pos.mwst_prozent]
      );

      // Lagerbestand reduzieren
      await queryAsync(
        `UPDATE artikel SET lagerbestand = lagerbestand - ? WHERE artikel_id = ? AND lager_tracking = TRUE`,
        [pos.menge, pos.artikel_id]
      );
    }

    logger.info(`Shop-Bestellung erstellt: ${bestellnummer} von Mitglied ${req.verbandUser.id}`);

    res.json({
      success: true,
      bestellung: {
        id: bestellungId,
        bestellnummer,
        gesamtbetrag_euro: gesamtbetrag / 100,
        status: 'offen'
      },
      message: 'Bestellung erfolgreich aufgegeben'
    });

  } catch (error) {
    logger.error('Shop-Bestellung-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Bestellung' });
  }
});

/**
 * GET /api/verband-auth/shop/bestellungen
 * Holt eigene Bestellungen des Mitglieds
 */
router.get('/shop/bestellungen', verifyVerbandToken, async (req, res) => {
  try {
    const bestellungen = await queryAsync(
      `SELECT b.*,
              (SELECT COUNT(*) FROM shop_bestellpositionen WHERE bestellung_id = b.id) as anzahl_positionen
       FROM shop_bestellungen b
       WHERE b.verbandsmitgliedschaft_id = ?
       ORDER BY b.bestellt_am DESC`,
      [req.verbandUser.id]
    );

    // Positionen für jede Bestellung laden
    for (const bestellung of bestellungen) {
      const positionen = await queryAsync(
        `SELECT * FROM shop_bestellpositionen WHERE bestellung_id = ?`,
        [bestellung.id]
      );
      bestellung.positionen = positionen;
      bestellung.gesamtbetrag_euro = bestellung.gesamtbetrag_cent / 100;
    }

    res.json({ success: true, bestellungen });

  } catch (error) {
    logger.error('Shop-Bestellungen-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Bestellungen' });
  }
});

// ============================================================================
// ADMIN ROUTES (für TDA SuperAdmin)
// ============================================================================

/**
 * Middleware: Prüft ob User SuperAdmin ist
 */
const verifySuperAdmin = async (req, res, next) => {
  // Prüfe ob Token die tda_admin Rolle hat (gesetzt beim Admin-Login via /admin-login)
  if (req.verbandUser.role === 'tda_admin') {
    next();
  } else {
    res.status(403).json({ error: 'Keine Berechtigung' });
  }
};

/**
 * GET /api/verband-auth/admin/bestellungen
 * Holt alle Shop-Bestellungen (nur für Admins)
 */
router.get('/admin/bestellungen', verifyVerbandToken, verifySuperAdmin, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let whereClause = '1=1';
    const params = [];

    if (status && status !== 'alle') {
      whereClause += ' AND b.status = ?';
      params.push(status);
    }

    params.push(parseInt(limit), parseInt(offset));

    const bestellungen = await queryAsync(
      `SELECT b.*,
              vm.mitgliedsnummer,
              vm.typ as mitglied_typ,
              (SELECT COUNT(*) FROM shop_bestellpositionen WHERE bestellung_id = b.id) as anzahl_positionen
       FROM shop_bestellungen b
       LEFT JOIN verbandsmitgliedschaften vm ON b.verbandsmitgliedschaft_id = vm.id
       WHERE ${whereClause}
       ORDER BY b.bestellt_am DESC
       LIMIT ? OFFSET ?`,
      params
    );

    // Statistik
    const stats = await queryAsync(
      `SELECT
        COUNT(*) as gesamt,
        SUM(CASE WHEN status = 'offen' THEN 1 ELSE 0 END) as offen,
        SUM(CASE WHEN status = 'in_bearbeitung' THEN 1 ELSE 0 END) as in_bearbeitung,
        SUM(CASE WHEN status = 'versendet' THEN 1 ELSE 0 END) as versendet,
        SUM(CASE WHEN status = 'abgeschlossen' THEN 1 ELSE 0 END) as abgeschlossen,
        SUM(CASE WHEN status = 'storniert' THEN 1 ELSE 0 END) as storniert
       FROM shop_bestellungen`
    );

    // Positionen für jede Bestellung laden
    for (const bestellung of bestellungen) {
      const positionen = await queryAsync(
        `SELECT * FROM shop_bestellpositionen WHERE bestellung_id = ?`,
        [bestellung.id]
      );
      bestellung.positionen = positionen;
      bestellung.gesamtbetrag_euro = bestellung.gesamtbetrag_cent / 100;
      bestellung.zwischensumme_euro = bestellung.zwischensumme_cent / 100;
      bestellung.versandkosten_euro = bestellung.versandkosten_cent / 100;
    }

    res.json({
      success: true,
      bestellungen,
      stats: stats[0]
    });

  } catch (error) {
    logger.error('Admin-Bestellungen-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Bestellungen' });
  }
});

/**
 * GET /api/verband-auth/admin/bestellungen/:id
 * Holt eine einzelne Bestellung mit Details
 */
router.get('/admin/bestellungen/:id', verifyVerbandToken, verifySuperAdmin, async (req, res) => {
  try {
    const bestellungen = await queryAsync(
      `SELECT b.*,
              vm.mitgliedsnummer, vm.typ as mitglied_typ,
              vm.person_vorname, vm.person_nachname, vm.person_email,
              vm.dojo_name
       FROM shop_bestellungen b
       LEFT JOIN verbandsmitgliedschaften vm ON b.verbandsmitgliedschaft_id = vm.id
       WHERE b.id = ?`,
      [req.params.id]
    );

    if (bestellungen.length === 0) {
      return res.status(404).json({ error: 'Bestellung nicht gefunden' });
    }

    const bestellung = bestellungen[0];

    // Positionen laden
    bestellung.positionen = await queryAsync(
      `SELECT * FROM shop_bestellpositionen WHERE bestellung_id = ?`,
      [bestellung.id]
    );

    bestellung.gesamtbetrag_euro = bestellung.gesamtbetrag_cent / 100;

    res.json({ success: true, bestellung });

  } catch (error) {
    logger.error('Admin-Bestellung-Detail-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Bestellung' });
  }
});

/**
 * PUT /api/verband-auth/admin/bestellungen/:id
 * Aktualisiert eine Bestellung (Status, Tracking, etc.)
 */
router.put('/admin/bestellungen/:id', verifyVerbandToken, verifySuperAdmin, async (req, res) => {
  try {
    const { status, tracking_nummer, versanddienstleister, interne_notiz } = req.body;

    // Bestellung prüfen
    const bestellungen = await queryAsync(
      `SELECT * FROM shop_bestellungen WHERE id = ?`,
      [req.params.id]
    );

    if (bestellungen.length === 0) {
      return res.status(404).json({ error: 'Bestellung nicht gefunden' });
    }

    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);

      // Timestamps setzen
      if (status === 'in_bearbeitung') {
        updates.push('bearbeitet_am = NOW()');
      } else if (status === 'versendet') {
        updates.push('versendet_am = NOW()');
      } else if (status === 'abgeschlossen') {
        updates.push('abgeschlossen_am = NOW()');
      }
    }

    if (tracking_nummer !== undefined) {
      updates.push('tracking_nummer = ?');
      params.push(tracking_nummer);
    }

    if (versanddienstleister !== undefined) {
      updates.push('versanddienstleister = ?');
      params.push(versanddienstleister);
    }

    if (interne_notiz !== undefined) {
      updates.push('interne_notiz = ?');
      params.push(interne_notiz);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Keine Änderungen' });
    }

    params.push(req.params.id);

    await queryAsync(
      `UPDATE shop_bestellungen SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    logger.info(`Bestellung ${req.params.id} aktualisiert: ${updates.join(', ')}`);

    res.json({ success: true, message: 'Bestellung aktualisiert' });

  } catch (error) {
    logger.error('Admin-Bestellung-Update-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Bestellung' });
  }
});

// ============================================================================
// LOGO UPLOAD/MANAGEMENT
// ============================================================================

/**
 * POST /api/verband-auth/logo
 * Logo für Verbandsmitglied hochladen
 */
router.post('/logo', verifyVerbandToken, logoUpload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    // SECURITY: Magic-Bytes prüfen (verhindert gefälschte MIME-Types)
    if (!checkImageMagicBytes(req.file.buffer)) {
      return res.status(400).json({ error: 'Ungültiges Bildformat. Datei ist kein echtes Bild.' });
    }

    const memberId = req.verbandUser.id;
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
    const filename = `logo_${memberId}_${Date.now()}${safeExt}`;
    const logoUrl = `/api/verband-auth/logo/${filename}`;

    // Altes Logo löschen falls vorhanden
    const existing = await queryAsync(
      `SELECT logo_url FROM verbandsmitgliedschaften WHERE id = ?`,
      [memberId]
    );

    if (existing[0]?.logo_url) {
      const oldPath = path.join(__dirname, '../uploads/verband-logos', path.basename(existing[0].logo_url));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Datei auf Disk schreiben (nach Magic-Bytes-Check)
    await saveLogoBuffer(req.file.buffer, filename);

    // URL in DB speichern
    await queryAsync(
      `UPDATE verbandsmitgliedschaften SET logo_url = ? WHERE id = ?`,
      [logoUrl, memberId]
    );

    logger.info(`Logo hochgeladen für Verbandsmitglied ${memberId}`);

    res.json({
      success: true,
      logo_url: logoUrl,
      message: 'Logo erfolgreich hochgeladen'
    });

  } catch (error) {
    logger.error('Logo-Upload-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Hochladen des Logos' });
  }
});

/**
 * GET /api/verband-auth/logo/:filename
 * Logo-Datei abrufen
 */
router.get('/logo/:filename', (req, res) => {
  // SECURITY: path.basename() verhindert Path Traversal Attacken (../../../etc/passwd)
  const filename = path.basename(req.params.filename);
  const filepath = path.join(__dirname, '../uploads/verband-logos', filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Logo nicht gefunden' });
  }

  // Content-Type basierend auf Dateiendung setzen
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  // Erlaube Cross-Origin Zugriff auf Logos
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  res.sendFile(filepath);
});

/**
 * DELETE /api/verband-auth/logo
 * Logo löschen
 */
router.delete('/logo', verifyVerbandToken, async (req, res) => {
  try {
    const memberId = req.verbandUser.id;

    const existing = await queryAsync(
      `SELECT logo_url FROM verbandsmitgliedschaften WHERE id = ?`,
      [memberId]
    );

    if (existing[0]?.logo_url) {
      const oldPath = path.join(__dirname, '../uploads/verband-logos', path.basename(existing[0].logo_url));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await queryAsync(
      `UPDATE verbandsmitgliedschaften SET logo_url = NULL WHERE id = ?`,
      [memberId]
    );

    logger.info(`Logo gelöscht für Verbandsmitglied ${memberId}`);

    res.json({ success: true, message: 'Logo gelöscht' });

  } catch (error) {
    logger.error('Logo-Lösch-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Logos' });
  }
});

/**
 * GET /api/verband-auth/member-logo/:id
 * Logo eines Mitglieds abrufen (für Ausweis)
 * Prüft zuerst verbandsmitgliedschaften.logo_url, dann dojo_logos
 */
router.get('/member-logo/:id', async (req, res) => {
  try {
    const memberId = req.params.id;

    // Verbandsmitglied laden
    const members = await queryAsync(
      `SELECT vm.logo_url, vm.dojo_id, dl.file_path as dojo_logo_path
       FROM verbandsmitgliedschaften vm
       LEFT JOIN dojo_logos dl ON vm.dojo_id = dl.dojo_id AND dl.logo_type = 'haupt'
       WHERE vm.id = ?`,
      [memberId]
    );

    if (members.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const member = members[0];

    // Priorität: 1. Eigenes Logo, 2. Dojo-Logo
    if (member.logo_url) {
      const filepath = path.join(__dirname, '../uploads/verband-logos', path.basename(member.logo_url));
      if (fs.existsSync(filepath)) {
        return res.sendFile(filepath);
      }
    }

    if (member.dojo_logo_path && fs.existsSync(member.dojo_logo_path)) {
      return res.sendFile(member.dojo_logo_path);
    }

    // Fallback: TDA Logo
    const tdaLogo = path.join(__dirname, '../uploads/verband-logos/tda-default.png');
    if (fs.existsSync(tdaLogo)) {
      return res.sendFile(tdaLogo);
    }

    res.status(404).json({ error: 'Kein Logo gefunden' });

  } catch (error) {
    logger.error('Member-Logo-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Logos' });
  }
});

// ============================================================================
// SUPPORT TICKETS FÜR VERBANDSMITGLIEDER
// ============================================================================

/**
 * GET /api/verband-auth/support-tickets
 * Eigene Support-Tickets abrufen
 */
router.get('/support-tickets', verifyVerbandToken, async (req, res) => {
  try {
    const userId = req.verbandUser.id;
    const tickets = await queryAsync(
      `SELECT id, ticket_nummer, betreff, kategorie, prioritaet, status, created_at, updated_at
       FROM support_tickets
       WHERE ersteller_typ = 'verbandsmitglied' AND ersteller_id = ?
       ORDER BY updated_at DESC`,
      [userId]
    );
    res.json({ success: true, data: tickets });
  } catch (error) {
    logger.error('Verband-Support-Tickets Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Tickets' });
  }
});

/**
 * POST /api/verband-auth/support-tickets
 * Neues Support-Ticket erstellen
 */
router.post('/support-tickets', verifyVerbandToken, async (req, res) => {
  try {
    const userId = req.verbandUser.id;
    const { kategorie, betreff, nachricht, prioritaet = 'mittel' } = req.body;

    if (!betreff || !nachricht || !kategorie) {
      return res.status(400).json({ error: 'Betreff, Kategorie und Nachricht sind erforderlich' });
    }

    // Ticket-Nummer generieren (TKT-YYYY-NNNNN)
    const year = new Date().getFullYear();
    const numResult = await queryAsync(
      `SELECT COALESCE(MAX(aktuelle_nummer), 0) + 1 AS naechste FROM support_ticket_nummern WHERE jahr = ?`,
      [year]
    );
    const naechste = numResult[0].naechste;
    await queryAsync(
      `INSERT INTO support_ticket_nummern (jahr, aktuelle_nummer) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE aktuelle_nummer = ?`,
      [year, naechste, naechste]
    );
    const ticketNummer = `TKT-${year}-${String(naechste).padStart(5, '0')}`;

    // Absendername ermitteln
    const memberData = await queryAsync(
      `SELECT typ, person_vorname, person_nachname, person_email, dojo_name FROM verbandsmitgliedschaften WHERE id = ?`,
      [userId]
    );
    const m = memberData[0];
    const absenderName = m
      ? (m.typ === 'dojo' ? m.dojo_name : `${m.person_vorname} ${m.person_nachname}`)
      : 'Verbandsmitglied';
    const absenderEmail = m ? m.person_email : '';

    // Ticket einfügen
    const result = await queryAsync(
      `INSERT INTO support_tickets
       (ticket_nummer, ersteller_typ, ersteller_id, ersteller_name, ersteller_email, bereich, kategorie, betreff, prioritaet, status)
       VALUES (?, 'verbandsmitglied', ?, ?, ?, 'verband', ?, ?, ?, 'offen')`,
      [ticketNummer, userId, absenderName, absenderEmail, kategorie, betreff, prioritaet]
    );
    const ticketId = result.insertId;

    // Erste Nachricht einfügen
    await queryAsync(
      `INSERT INTO support_ticket_nachrichten (ticket_id, absender_typ, absender_id, absender_name, nachricht, ist_intern)
       VALUES (?, 'verbandsmitglied', ?, ?, ?, 0)`,
      [ticketId, userId, absenderName, nachricht]
    );

    res.status(201).json({ success: true, data: { id: ticketId, ticket_nummer: ticketNummer } });
  } catch (error) {
    logger.error('Verband-Support-Ticket erstellen Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Tickets' });
  }
});

/**
 * GET /api/verband-auth/support-tickets/:id
 * Ticket-Detail mit Nachrichten abrufen
 */
router.get('/support-tickets/:id', verifyVerbandToken, async (req, res) => {
  try {
    const userId = req.verbandUser.id;
    const { id } = req.params;

    const tickets = await queryAsync(
      `SELECT * FROM support_tickets WHERE id = ? AND ersteller_typ = 'verbandsmitglied' AND ersteller_id = ?`,
      [id, userId]
    );
    if (!tickets.length) {
      return res.status(404).json({ error: 'Ticket nicht gefunden' });
    }

    const nachrichten = await queryAsync(
      `SELECT id, absender_typ, absender_name, nachricht, ist_intern, created_at
       FROM support_ticket_nachrichten
       WHERE ticket_id = ? AND ist_intern = 0
       ORDER BY created_at ASC`,
      [id]
    );

    res.json({ success: true, data: { ...tickets[0], nachrichten } });
  } catch (error) {
    logger.error('Verband-Support-Ticket-Detail Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Tickets' });
  }
});

/**
 * POST /api/verband-auth/support-tickets/:id/nachrichten
 * Nachricht zu Ticket hinzufügen
 */
router.post('/support-tickets/:id/nachrichten', verifyVerbandToken, async (req, res) => {
  try {
    const userId = req.verbandUser.id;
    const { id } = req.params;
    const { nachricht } = req.body;

    if (!nachricht) {
      return res.status(400).json({ error: 'Nachricht ist erforderlich' });
    }

    const tickets = await queryAsync(
      `SELECT * FROM support_tickets WHERE id = ? AND ersteller_typ = 'verbandsmitglied' AND ersteller_id = ?`,
      [id, userId]
    );
    if (!tickets.length) {
      return res.status(404).json({ error: 'Ticket nicht gefunden' });
    }

    const memberData = await queryAsync(
      `SELECT typ, person_vorname, person_nachname, dojo_name FROM verbandsmitgliedschaften WHERE id = ?`,
      [userId]
    );
    const m = memberData[0];
    const absenderName = m
      ? (m.typ === 'dojo' ? m.dojo_name : `${m.person_vorname} ${m.person_nachname}`)
      : 'Verbandsmitglied';

    await queryAsync(
      `INSERT INTO support_ticket_nachrichten (ticket_id, absender_typ, absender_id, absender_name, nachricht, ist_intern)
       VALUES (?, 'verbandsmitglied', ?, ?, ?, 0)`,
      [id, userId, absenderName, nachricht]
    );

    // Status auf "warten_auf_antwort" setzen wenn Mitglied antwortet
    if (tickets[0].status === 'in_bearbeitung') {
      await queryAsync(
        `UPDATE support_tickets SET status = 'warten_auf_antwort', updated_at = NOW() WHERE id = ?`,
        [id]
      );
    } else {
      await queryAsync(`UPDATE support_tickets SET updated_at = NOW() WHERE id = ?`, [id]);
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Verband-Support-Nachricht Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Senden der Nachricht' });
  }
});

// ============================================================================
// FEATURE REQUESTS / WUNSCHLISTE FÜR VERBANDSMITGLIEDER
// ============================================================================

/**
 * GET /api/verband-auth/feature-requests
 * Alle Feature-Wünsche abrufen (sortiert nach Votes)
 */
router.get('/feature-requests', verifyVerbandToken, async (req, res) => {
  try {
    const userId = req.verbandUser.id;
    const features = await queryAsync(
      `SELECT fr.*,
              (SELECT COUNT(*) FROM feature_votes WHERE feature_id = fr.id) AS votes_count,
              (SELECT COUNT(*) FROM feature_votes WHERE feature_id = fr.id AND user_id = ? AND user_typ = 'verbandsmitglied') AS user_voted,
              (fr.ersteller_typ = 'verbandsmitglied' AND fr.ersteller_id = ?) AS is_own
       FROM feature_requests fr
       ORDER BY votes_count DESC, fr.created_at DESC`,
      [userId, userId]
    );
    res.json({ success: true, data: features });
  } catch (error) {
    logger.error('Verband-Feature-Requests Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Feature-Wünsche' });
  }
});

/**
 * POST /api/verband-auth/feature-requests
 * Neuen Feature-Wunsch erstellen
 */
router.post('/feature-requests', verifyVerbandToken, async (req, res) => {
  try {
    const userId = req.verbandUser.id;
    const { titel, beschreibung, kategorie = 'funktion' } = req.body;

    if (!titel || titel.trim().length < 5) {
      return res.status(400).json({ error: 'Titel muss mindestens 5 Zeichen lang sein' });
    }

    const memberData = await queryAsync(
      `SELECT typ, person_vorname, person_nachname, dojo_name FROM verbandsmitgliedschaften WHERE id = ?`,
      [userId]
    );
    const m = memberData[0];
    const absenderName = m
      ? (m.typ === 'dojo' ? m.dojo_name : `${m.person_vorname} ${m.person_nachname}`)
      : 'Verbandsmitglied';

    const result = await queryAsync(
      `INSERT INTO feature_requests (titel, beschreibung, kategorie, ersteller_typ, ersteller_id, ersteller_name, status)
       VALUES (?, ?, ?, 'verbandsmitglied', ?, ?, 'neu')`,
      [titel.trim(), beschreibung || '', kategorie, userId, absenderName]
    );
    const featureId = result.insertId;

    // Ersteller stimmt automatisch für eigenen Wunsch ab
    await queryAsync(
      `INSERT INTO feature_votes (feature_id, user_typ, user_id) VALUES (?, 'verbandsmitglied', ?)`,
      [featureId, userId]
    );

    res.status(201).json({ success: true, data: { id: featureId } });
  } catch (error) {
    logger.error('Verband-Feature-Request erstellen Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Feature-Wunsches' });
  }
});

/**
 * POST /api/verband-auth/feature-requests/:id/vote
 * Für Feature-Wunsch abstimmen (Toggle)
 */
router.post('/feature-requests/:id/vote', verifyVerbandToken, async (req, res) => {
  try {
    const userId = req.verbandUser.id;
    const { id } = req.params;

    const existing = await queryAsync(
      `SELECT id FROM feature_votes WHERE feature_id = ? AND user_id = ? AND user_typ = 'verbandsmitglied'`,
      [id, userId]
    );

    if (existing.length) {
      await queryAsync(
        `DELETE FROM feature_votes WHERE feature_id = ? AND user_id = ? AND user_typ = 'verbandsmitglied'`,
        [id, userId]
      );
      res.json({ success: true, voted: false });
    } else {
      await queryAsync(
        `INSERT INTO feature_votes (feature_id, user_typ, user_id) VALUES (?, 'verbandsmitglied', ?)`,
        [id, userId]
      );
      res.json({ success: true, voted: true });
    }
  } catch (error) {
    logger.error('Verband-Feature-Vote Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Abstimmen' });
  }
});

// ============================================================================
// PUBLIC ENDPOINTS (kein Auth erforderlich, Rate-Limit gesetzt)
// ============================================================================

const rateLimit = require('express-rate-limit');

const publicContactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 5,
  message: { error: 'Zu viele Anfragen. Bitte warte 15 Minuten.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const publicNewsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 Stunde
  max: 3,
  message: { error: 'Zu viele Anfragen. Bitte warte eine Stunde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/verband-auth/public/contact
 * Kontaktformular (öffentlich, kein Token nötig)
 */
router.post('/public/contact', publicContactLimiter, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Alle Felder sind erforderlich.' });
    }

    // Einfache E-Mail-Validierung
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse.' });
    }

    if (message.length > 5000) {
      return res.status(400).json({ error: 'Nachricht zu lang (max. 5000 Zeichen).' });
    }

    const ip = req.ip || req.connection.remoteAddress || null;

    await queryAsync(
      'INSERT INTO kontakt_anfragen (name, email, subject, message, ip_address) VALUES (?, ?, ?, ?, ?)',
      [name.trim().substring(0, 200), email.trim().substring(0, 200), subject.trim().substring(0, 100), message.trim(), ip]
    );

    logger.info('Neue Kontaktanfrage', { email, subject });
    res.json({ success: true, message: 'Kontaktanfrage erfolgreich gesendet.' });
  } catch (error) {
    logger.error('Kontaktformular-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Senden der Anfrage.' });
  }
});

/**
 * POST /api/verband-auth/public/newsletter-subscribe
 * Newsletter-Anmeldung (öffentlich, kein Token nötig)
 */
router.post('/public/newsletter-subscribe', publicNewsletterLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'E-Mail-Adresse erforderlich.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse.' });
    }

    const trimmedEmail = email.trim().toLowerCase().substring(0, 255);

    // Prüfen ob bereits angemeldet
    const existing = await queryAsync(
      'SELECT id, status FROM newsletter_subscriptions WHERE email = ?',
      [trimmedEmail]
    );

    if (existing.length > 0) {
      if (existing[0].status === 'active') {
        return res.json({ success: true, message: 'Du bist bereits für den Newsletter angemeldet.' });
      }
      // Re-Aktivierung bei unsubscribed
      await queryAsync(
        'UPDATE newsletter_subscriptions SET status = ?, unsubscribe_date = NULL, subscription_date = CURRENT_TIMESTAMP WHERE email = ?',
        ['active', trimmedEmail]
      );
    } else {
      const unsubscribeToken = require('crypto').randomBytes(32).toString('hex');
      await queryAsync(
        'INSERT INTO newsletter_subscriptions (email, status, unsubscribe_token) VALUES (?, ?, ?)',
        [trimmedEmail, 'active', unsubscribeToken]
      );
    }

    logger.info('Newsletter-Anmeldung', { email: trimmedEmail });
    res.json({ success: true, message: 'Newsletter-Anmeldung erfolgreich.' });
  } catch (error) {
    logger.error('Newsletter-Subscribe-Fehler:', error);
    res.status(500).json({ error: 'Fehler bei der Anmeldung.' });
  }
});


// ============================================================================
// ADMIN NEWSLETTER ENDPOINTS (Admin-Token erforderlich)
// ============================================================================

const verifyAdminToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Kein Admin-Token vorhanden.' });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || decoded?.role !== 'tda_admin') {
      return res.status(403).json({ error: 'Nur für Administratoren.' });
    }
    req.adminUser = decoded;
    next();
  });
};

/**
 * GET /api/verband-auth/admin/newsletter-subscribers
 */
router.get('/admin/newsletter-subscribers', verifyAdminToken, async (req, res) => {
  try {
    const rows = await queryAsync(
      'SELECT id, email, status, DATE_FORMAT(subscription_date, "%Y-%m-%d") AS subscribedAt FROM newsletter_subscriptions ORDER BY subscription_date DESC',
      []
    );
    res.json({ success: true, subscribers: rows });
  } catch (error) {
    logger.error('Admin Newsletter Subscribers Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Abonnenten.' });
  }
});

/**
 * PUT /api/verband-auth/admin/newsletter-subscribers/:id
 * Status toggeln (active <-> unsubscribed)
 */
router.put('/admin/newsletter-subscribers/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'unsubscribed'].includes(status)) {
      return res.status(400).json({ error: 'Ungültiger Status.' });
    }
    await queryAsync('UPDATE newsletter_subscriptions SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Admin Newsletter Status Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren.' });
  }
});

/**
 * GET /api/verband-auth/admin/kontakt-anfragen
 */
router.get('/admin/kontakt-anfragen', verifyAdminToken, async (req, res) => {
  try {
    const rows = await queryAsync(
      'SELECT id, name, email, subject, LEFT(message, 200) AS message_preview, bearbeitet, DATE_FORMAT(erstellt_am, "%Y-%m-%d %H:%i") AS erstellt_am FROM kontakt_anfragen ORDER BY erstellt_am DESC LIMIT 100',
      []
    );
    res.json({ success: true, anfragen: rows });
  } catch (error) {
    logger.error('Admin Kontaktanfragen Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden.' });
  }
});


// ============================================================================
// LOGOUT & REFRESH-TOKEN
// ============================================================================

/**
 * POST /api/verband-auth/logout
 * Setzt last_logout_at → invalidiert alle bestehenden Access-Tokens
 */
router.post('/logout', verifyVerbandToken, async (req, res) => {
  try {
    await queryAsync(
      'UPDATE verbandsmitgliedschaften SET last_logout_at = NOW(), refresh_token = NULL, refresh_token_expires = NULL WHERE id = ?',
      [req.verbandUser.id]
    );
    logger.info('Logout erfolgreich', { userId: req.verbandUser.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Logout-Fehler:', error);
    res.status(500).json({ error: 'Logout fehlgeschlagen' });
  }
});

/**
 * POST /api/verband-auth/refresh
 * Neues Access-Token mit Refresh-Token holen
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh-Token fehlt.' });
    }

    const rows = await queryAsync(
      `SELECT id, typ, mitgliedsnummer, person_email, dojo_email,
              refresh_token_expires, last_logout_at
       FROM verbandsmitgliedschaften
       WHERE refresh_token = ? AND refresh_token_expires > NOW()`,
      [refreshToken]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Ungültiger oder abgelaufener Refresh-Token.' });
    }

    const member = rows[0];

    // Neues Access-Token ausstellen (jwt + JWT_SECRET sind im Scope)
    const newToken = jwt.sign(
      {
        id: member.id,
        typ: member.typ,
        mitgliedsnummer: member.mitgliedsnummer,
        email: member.person_email || member.dojo_email,
        role: 'verbandsmitglied',
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_SECRET,
      { expiresIn: '4h' }
    );

    // Refresh-Token rotieren (neuen generieren)
    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const newExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await queryAsync(
      'UPDATE verbandsmitgliedschaften SET refresh_token = ?, refresh_token_expires = ? WHERE id = ?',
      [newRefreshToken, newExpires, member.id]
    );

    res.json({ success: true, token: newToken, refreshToken: newRefreshToken });
  } catch (error) {
    logger.error('Refresh-Fehler:', error);
    res.status(500).json({ error: 'Token-Refresh fehlgeschlagen' });
  }
});


module.exports = router;
