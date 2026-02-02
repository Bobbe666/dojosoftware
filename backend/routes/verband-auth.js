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
const {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  MEMBERSHIP_TYPE_VALUES,
  LIMITS
} = require('../utils/constants');

const JWT_SECRET = process.env.JWT_SECRET || 'dojo-secret-key-2024';

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
router.post('/register', async (req, res) => {
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

    // TODO: Verification-E-Mail senden
    logger.debug('📧 Verification-Token für ${email}: ${verification_token}');

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
 * Login für Verbandsmitglieder
 */
router.post('/login', async (req, res) => {
  console.log('>>> LOGIN AUFGERUFEN <<<', req.body?.email);
  try {
    const { email, passwort } = req.body;

    if (!email || !passwort) {
      return res.status(400).json({ error: ERROR_MESSAGES.AUTH.EMAIL_PASSWORD_REQUIRED });
    }

    // Mitglied suchen - COALESCE für verknüpfte Dojos
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
        vm.passwort_hash, vm.email_verified, vm.last_login, vm.notizen,
        vm.created_at, vm.updated_at, vm.dojo_mitglieder_anzahl,
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
      WHERE vm.person_email = ? OR vm.dojo_email = ? OR d.email = ?`,
      [email, email, email]
    );

    // DEBUG
    logger.info('Login Query Result:', {
      email,
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

    // Last login aktualisieren
    await queryAsync(
      `UPDATE verbandsmitgliedschaften SET last_login = NOW() WHERE id = ?`,
      [member.id]
    );

    // JWT Token erstellen
    const token = jwt.sign(
      {
        id: member.id,
        typ: member.typ,
        mitgliedsnummer: member.mitgliedsnummer,
        email: member.person_email || member.dojo_email,
        role: 'verbandsmitglied'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Sensible Daten entfernen
    delete member.passwort_hash;
    delete member.verification_token;
    delete member.reset_token;
    delete member.reset_token_expires;

    // DEBUG: Log member data
    logger.info('Login erfolgreich - Member Daten:', {
      id: member.id,
      typ: member.typ,
      dojo_name: member.dojo_name,
      dojo_id: member.dojo_id,
      person_vorname: member.person_vorname
    });

    res.json({
      success: true,
      token,
      member
    });

  } catch (error) {
    logger.error('Login-Fehler:', error);
    res.status(500).json({ error: 'Login fehlgeschlagen', details: error.message });
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
router.post('/forgot-password', async (req, res) => {
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
    reset_expires.setHours(reset_expires.getHours() + 24);

    await queryAsync(
      `UPDATE verbandsmitgliedschaften
       SET reset_token = ?, reset_token_expires = ?
       WHERE id = ?`,
      [reset_token, reset_expires, members[0].id]
    );

    // TODO: Reset-E-Mail senden
    logger.debug('📧 Reset-Token für ${email}: ${reset_token}');

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
const verifyVerbandToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

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
        vm.created_at, vm.updated_at, vm.dojo_mitglieder_anzahl,
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
 * Eigene Rechnungen abrufen
 */
router.get('/invoices', verifyVerbandToken, async (req, res) => {
  try {
    const invoices = await queryAsync(
      `SELECT * FROM verbandsmitgliedschaft_zahlungen
       WHERE verbandsmitgliedschaft_id = ?
       ORDER BY rechnungsdatum DESC`,
      [req.verbandUser.id]
    );

    res.json({ success: true, invoices });

  } catch (error) {
    logger.error('Invoices-Fehler:', error);
    res.status(500).json({ error: ERROR_MESSAGES.GENERAL.LOADING_ERROR });
  }
});

/**
 * GET /api/verband-auth/invoices/:id/pdf
 * Rechnungs-PDF herunterladen (mit Besitzprüfung)
 */
router.get('/invoices/:id/pdf', verifyVerbandToken, async (req, res) => {
  try {
    // Prüfen ob die Rechnung zum eingeloggten Nutzer gehört
    const invoice = await queryAsync(
      `SELECT * FROM verbandsmitgliedschaft_zahlungen
       WHERE id = ? AND verbandsmitgliedschaft_id = ?`,
      [req.params.id, req.verbandUser.id]
    );

    if (invoice.length === 0) {
      return res.status(404).json({ error: 'Rechnung nicht gefunden oder kein Zugriff' });
    }

    // PDF generieren
    const { generateVerbandRechnungPdf } = require('../utils/verbandVertragPdfGenerator');
    await generateVerbandRechnungPdf(req.params.id, res);

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
 */
router.get('/shop/artikel', verifyVerbandToken, async (req, res) => {
  try {
    // TDA Verband Dojo-ID = 2
    const TDA_DOJO_ID = 2;

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

      return {
        artikel_id: art.artikel_id,
        name: art.name,
        beschreibung: art.beschreibung,
        verkaufspreis_cent: art.verkaufspreis_cent,
        verkaufspreis_euro: art.verkaufspreis_cent / 100,
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
      kategorien: Object.values(kategorien)
    });

  } catch (error) {
    logger.error('Shop-Artikel-Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Artikel' });
  }
});

/**
 * POST /api/verband-auth/shop/bestellung
 * Erstellt eine neue Bestellung
 */
router.post('/shop/bestellung', verifyVerbandToken, async (req, res) => {
  try {
    const { positionen, lieferadresse, kundennotiz } = req.body;

    if (!positionen || positionen.length === 0) {
      return res.status(400).json({ error: 'Keine Artikel im Warenkorb' });
    }

    // Mitgliedsdaten holen
    const members = await queryAsync(
      `SELECT id, typ, person_vorname, person_nachname, person_email, person_telefon,
              dojo_name, dojo_email, dojo_strasse, dojo_plz, dojo_ort, dojo_land,
              person_strasse, person_plz, person_ort, person_land
       FROM verbandsmitgliedschaften WHERE id = ?`,
      [req.verbandUser.id]
    );

    if (members.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const member = members[0];

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

    // Artikel validieren und Preise berechnen
    let zwischensumme = 0;
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

      const einzelpreis = artikel.verkaufspreis_cent;
      const gesamtpreis = einzelpreis * pos.menge;
      zwischensumme += gesamtpreis;

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
  // SuperAdmin prüfen (vereinfacht - ID 1 oder spezielle Flag)
  // In diesem Fall: Verbandsmitglieder mit bestimmter Rolle
  // Für jetzt: Alle authentifizierten Verbandsmitglieder mit Mitglied ID 1-5
  // TODO: Echte Admin-Rolle implementieren
  if (req.verbandUser.id <= 5) {
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

module.exports = router;
