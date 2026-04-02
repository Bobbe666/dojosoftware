// Backend/routes/public-registration.js - Öffentliche Mitglieder-Registrierung
const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');
const { sendVerificationEmail } = require('../services/emailTemplates');
const rateLimit = require('express-rate-limit');
const enc = require('../services/encryptionService');

// Rate-Limiter für Registrierungs-Endpoints (10 Requests / 15 Min pro IP)
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Zu viele Anfragen, bitte in 15 Minuten erneut versuchen.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strikter Limiter für Step1 (Email-Prüfung) — Account Enumeration verhindern
const step1Limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Zu viele Registrierungsversuche, bitte in 15 Minuten erneut versuchen.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// Utility-Funktion: Token generieren
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// =============================================
// REGISTRIERUNG ENDPOINTS
// =============================================

// POST /api/public/register/step1 - Schritt 1: Grundregistrierung mit Email
router.post('/register/step1', step1Limiter, async (req, res) => {
  try {
    const { email, password, promo_code } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email und Passwort sind erforderlich'
      });
    }

    // Passwort-Komplexität prüfen
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Passwort muss mindestens 8 Zeichen lang sein.' });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ success: false, error: 'Passwort muss mindestens einen Großbuchstaben enthalten.' });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ success: false, error: 'Passwort muss mindestens eine Zahl enthalten.' });
    }

    // Prüfen ob Email bereits existiert
    const existingUser = await queryAsync(
      'SELECT email FROM registrierungen WHERE email = ? OR EXISTS (SELECT 1 FROM mitglieder WHERE email = ?)',
      [email, email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Diese Email-Adresse ist bereits registriert'
      });
    }

    // Promo-Code validieren falls angegeben
    let promoCodeId = null;
    let werberId = null;
    if (promo_code && promo_code.trim()) {
      const codeResult = await queryAsync(`
        SELECT rc.id, rc.mitglied_id, rc.dojo_id
        FROM referral_codes rc
        WHERE rc.code = ?
          AND rc.aktiv = 1
          AND (rc.gueltig_bis IS NULL OR rc.gueltig_bis >= CURDATE())
          AND (rc.max_verwendungen IS NULL OR rc.aktuelle_verwendungen < rc.max_verwendungen)
      `, [promo_code.trim().toUpperCase()]);

      if (codeResult.length > 0) {
        promoCodeId = codeResult[0].id;
        werberId = codeResult[0].mitglied_id;
        logger.info('Gültiger Promo-Code verwendet', { code: promo_code, werber_id: werberId });
      }
    }

    // Verification Token generieren
    const verificationToken = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Stunden

    // SECURITY: Passwort hashen (12 Rounds für Sicherheit)
    const passwordHash = await bcrypt.hash(password, 12);

    // In Registrierungs-Tabelle einfügen (mit Promo-Code falls vorhanden)
    await queryAsync(`
      INSERT INTO registrierungen (
        email, password_hash, verification_token, token_expires_at, status, created_at,
        promo_code, promo_code_id, werber_mitglied_id
      ) VALUES (?, ?, ?, ?, 'email_pending', NOW(), ?, ?, ?)
    `, [email, passwordHash, verificationToken, expiresAt, promo_code || null, promoCodeId, werberId]);

    logger.info('Neue Registrierung gestartet', { email, promo_code: promo_code || 'keiner' });

    // Verification-Email senden
    try {
      await sendVerificationEmail(email, {
        verificationToken: verificationToken,
        verificationUrl: `https://dojo.tda-intl.org/verify-registration?token=${verificationToken}`
      });
      logger.info(`Verification-Email gesendet an ${email}`);
    } catch (emailErr) {
      logger.warn(`Verification-Email konnte nicht gesendet werden: ${emailErr.message}`);
    }

    res.json({
      success: true,
      message: 'Registrierung gestartet. Bitte prüfen Sie Ihre E-Mails.',
      data: {
        email,
        nextStep: 'email_verification',
        promoCodeValid: !!promoCodeId
      }
    });

  } catch (err) {
    logger.error('Fehler bei Registrierung Schritt 1:', { error: err });
    res.status(500).json({ success: false, error: 'Serverfehler bei der Registrierung' });
  }
});

// GET /api/public/register/verify/:token - Email-Verifizierung
router.get('/register/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    // Token prüfen und Registrierung finden
    const registration = await queryAsync(`
      SELECT * FROM registrierungen
      WHERE verification_token = ? AND token_expires_at > NOW() AND status = 'email_pending'
    `, [token]);

    if (registration.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ungültiger oder abgelaufener Verifizierungslink'
      });
    }

    // Status auf email_verified setzen
    await queryAsync(`
      UPDATE registrierungen
      SET status = 'email_verified', email_verified_at = NOW()
      WHERE id = ?
    `, [registration[0].id]);
    res.json({
      success: true,
      message: 'Email erfolgreich verifiziert. Sie können nun mit der Registrierung fortfahren.',
      data: {
        email: registration[0].email,
        nextStep: 'personal_data'
      }
    });

  } catch (err) {
    logger.error('Fehler bei Email-Verifizierung:', { error: err });
    res.status(500).json({ success: false, error: 'Serverfehler bei der Verifizierung' });
  }
});

// POST /api/public/register/step2 - Schritt 2: Persönliche Daten
router.post('/register/step2', registerLimiter, async (req, res) => {
  try {
    const {
      email,
      vorname,
      nachname,
      geburtsdatum,
      geschlecht,
      strasse,
      hausnummer,
      plz,
      ort,
      telefon
    } = req.body;
    // Registrierung finden
    const registration = await queryAsync(`
      SELECT * FROM registrierungen
      WHERE email = ? AND status = 'email_verified'
    `, [email]);

    if (registration.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ungültige Registrierung oder Email nicht verifiziert'
      });
    }

    // Persönliche Daten speichern
    await queryAsync(`
      UPDATE registrierungen SET
        vorname = ?, nachname = ?, geburtsdatum = ?, geschlecht = ?,
        strasse = ?, hausnummer = ?, plz = ?, ort = ?, telefon = ?,
        status = 'personal_data_complete'
      WHERE id = ?
    `, [vorname, nachname, geburtsdatum, geschlecht, strasse, hausnummer, plz, ort, telefon, registration[0].id]);

    // Erziehungsberechtigten-Daten speichern falls vorhanden
    if (req.body.is_guardian_registration) {
      const ebVorname = req.body.erziehungsberechtigt_vorname || '';
      const ebNachname = req.body.erziehungsberechtigt_nachname || '';
      const ebEmail = req.body.erziehungsberechtigt_email || email;
      const ebTelefon = req.body.erziehungsberechtigt_telefon || telefon;
      const ebVerhaeltnis = req.body.verhaeltnis || 'erziehungsberechtigter';

      if (ebVorname && ebNachname) {
        await queryAsync(`
          UPDATE registrierungen SET
            vertreter1_typ = ?,
            vertreter1_name = ?,
            vertreter1_telefon = ?,
            vertreter1_email = ?
          WHERE id = ?
        `, [ebVerhaeltnis, `${ebVorname} ${ebNachname}`, ebTelefon, ebEmail, registration[0].id]);
      }
    }

    res.json({
      success: true,
      message: 'Persönliche Daten erfolgreich gespeichert',
      data: {
        email,
        nextStep: 'bank_data'
      }
    });

  } catch (err) {
    logger.error('Fehler bei Schritt 2:', { error: err });
    res.status(500).json({ success: false, error: 'Serverfehler beim Speichern der persönlichen Daten' });
  }
});

// POST /api/public/register/step3 - Schritt 3: Bankdaten
router.post('/register/step3', registerLimiter, async (req, res) => {
  try {
    const {
      email,
      iban,
      bic,
      bank_name,
      kontoinhaber
    } = req.body;
    // Registrierung finden
    const registration = await queryAsync(`
      SELECT * FROM registrierungen
      WHERE email = ? AND status = 'personal_data_complete'
    `, [email]);

    if (registration.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ungültige Registrierung oder vorherige Schritte nicht abgeschlossen'
      });
    }

    // Bankdaten speichern
    await queryAsync(`
      UPDATE registrierungen SET
        iban = ?, bic = ?, bank_name = ?, kontoinhaber = ?,
        status = 'bank_data_complete'
      WHERE id = ?
    `, [iban, bic, bank_name, kontoinhaber, registration[0].id]);
    res.json({
      success: true,
      message: 'Bankdaten erfolgreich gespeichert',
      data: {
        email,
        nextStep: 'tariff_selection'
      }
    });

  } catch (err) {
    logger.error('Fehler bei Schritt 3:', { error: err });
    res.status(500).json({ success: false, error: 'Serverfehler beim Speichern der Bankdaten' });
  }
});

// POST /api/public/register/step4 - Schritt 4: Tarifauswahl
router.post('/register/step4', registerLimiter, async (req, res) => {
  try {
    const {
      email,
      tarif_id,
      billing_cycle,
      payment_method,
      vertragsbeginn
    } = req.body;
    // Registrierung finden
    const registration = await queryAsync(`
      SELECT * FROM registrierungen
      WHERE email = ? AND status = 'bank_data_complete'
    `, [email]);

    if (registration.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ungültige Registrierung oder vorherige Schritte nicht abgeschlossen'
      });
    }

    // Tarifauswahl speichern
    await queryAsync(`
      UPDATE registrierungen SET
        tarif_id = ?, billing_cycle = ?, payment_method = ?, vertragsbeginn = ?,
        status = 'tariff_selected'
      WHERE id = ?
    `, [tarif_id, billing_cycle, payment_method, vertragsbeginn, registration[0].id]);
    res.json({
      success: true,
      message: 'Tarifauswahl erfolgreich gespeichert',
      data: {
        email,
        nextStep: 'health_questions'
      }
    });

  } catch (err) {
    logger.error('Fehler bei Schritt 4:', { error: err });
    res.status(500).json({ success: false, error: 'Serverfehler beim Speichern der Tarifauswahl' });
  }
});

// POST /api/public/register/step5 - Schritt 5: Gesundheitsfragen
router.post('/register/step5', registerLimiter, async (req, res) => {
  try {
    const {
      email,
      gesundheitsfragen
    } = req.body;
    // Registrierung finden
    const registration = await queryAsync(`
      SELECT * FROM registrierungen
      WHERE email = ? AND status = 'tariff_selected'
    `, [email]);

    if (registration.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ungültige Registrierung oder vorherige Schritte nicht abgeschlossen'
      });
    }

    // Gesundheitsfragen speichern
    await queryAsync(`
      UPDATE registrierungen SET
        gesundheitsfragen = ?,
        status = 'health_questions_complete'
      WHERE id = ?
    `, [enc.encrypt(gesundheitsfragen), registration[0].id]);
    res.json({
      success: true,
      message: 'Gesundheitsfragen erfolgreich gespeichert',
      data: {
        email,
        nextStep: 'legal_agreements'
      }
    });

  } catch (err) {
    logger.error('Fehler bei Schritt 5:', { error: err });
    res.status(500).json({ success: false, error: 'Serverfehler beim Speichern der Gesundheitsfragen' });
  }
});

// POST /api/public/register/step6 - Schritt 6: Rechtliche Zustimmungen
router.post('/register/step6', registerLimiter, async (req, res) => {
  try {
    const {
      email,
      agb_accepted,
      dsgvo_accepted,
      widerrufsrecht_acknowledged,
      kuendigungshinweise_acknowledged
    } = req.body;
    if (!agb_accepted || !dsgvo_accepted || !widerrufsrecht_acknowledged || !kuendigungshinweise_acknowledged) {
      return res.status(400).json({
        success: false,
        error: 'Alle rechtlichen Zustimmungen sind erforderlich'
      });
    }

    // Registrierung finden
    const registration = await queryAsync(`
      SELECT * FROM registrierungen
      WHERE email = ? AND status = 'health_questions_complete'
    `, [email]);

    if (registration.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ungültige Registrierung oder vorherige Schritte nicht abgeschlossen'
      });
    }

    // Rechtliche Zustimmungen speichern und Registrierung abschließen
    await queryAsync(`
      UPDATE registrierungen SET
        agb_accepted = ?, dsgvo_accepted = ?, widerrufsrecht_acknowledged = ?,
        kuendigungshinweise_acknowledged = ?,
        status = 'registration_complete', completed_at = NOW()
      WHERE id = ?
    `, [true, true, true, true, registration[0].id]);

    // Wenn Promo-Code verwendet wurde, Werbung erfassen
    if (registration[0].promo_code_id && registration[0].werber_mitglied_id) {
      try {
        // Referral-Eintrag erstellen
        await queryAsync(`
          INSERT INTO referrals (
            dojo_id, werber_id, geworbener_name, geworbener_email,
            code_id, status, erstellt_am
          ) VALUES (
            (SELECT dojo_id FROM referral_codes WHERE id = ?),
            ?, ?, ?, ?, 'registriert', NOW()
          )
        `, [
          registration[0].promo_code_id,
          registration[0].werber_mitglied_id,
          `${registration[0].vorname} ${registration[0].nachname}`,
          registration[0].email,
          registration[0].promo_code_id
        ]);

        // Code-Verwendungszähler erhöhen
        await queryAsync(`
          UPDATE referral_codes
          SET aktuelle_verwendungen = aktuelle_verwendungen + 1
          WHERE id = ?
        `, [registration[0].promo_code_id]);

        logger.info('Werbung erfasst', {
          werber_id: registration[0].werber_mitglied_id,
          geworbener: registration[0].email,
          code_id: registration[0].promo_code_id
        });
      } catch (refErr) {
        // Fehler bei Referral-Erfassung nur loggen, Registrierung nicht abbrechen
        logger.error('Fehler bei Referral-Erfassung:', { error: refErr });
      }
    }

    // Hole Tarif-Details für die Benachrichtigung
    let tarifDetails = '';
    if (registration[0].tarif_id) {
      try {
        const tarif = await queryAsync(`
          SELECT name, price_cents, currency, duration_months
          FROM tarife
          WHERE id = ?
        `, [registration[0].tarif_id]);

        if (tarif.length > 0) {
          const priceEuros = (tarif[0].price_cents / 100).toFixed(2);
          tarifDetails = `${tarif[0].name} - ${priceEuros}€ / ${tarif[0].duration_months} Monate`;
        }
      } catch (err) {
        logger.error('Fehler beim Laden der Tarif-Details:', { error: err });
      }
    }

    // Admin-Benachrichtigung erstellen
    const notificationMessage = `
      <strong>Neues Mitglied registriert!</strong><br><br>
      <strong>Name:</strong> ${registration[0].vorname} ${registration[0].nachname}<br>
      <strong>Email:</strong> ${registration[0].email}<br>
      <strong>Geburtsdatum:</strong> ${registration[0].geburtsdatum || 'N/A'}<br>
      <strong>Adresse:</strong> ${registration[0].strasse} ${registration[0].hausnummer}, ${registration[0].plz} ${registration[0].ort}<br>
      <strong>Telefon:</strong> ${registration[0].telefon || 'N/A'}<br>
      <strong>Tarif:</strong> ${tarifDetails || 'N/A'}<br>
      <strong>Zahlungszyklus:</strong> ${registration[0].billing_cycle || 'N/A'}<br>
      <strong>Zahlungsmethode:</strong> ${registration[0].payment_method || 'N/A'}<br>
      <strong>Vertragsbeginn:</strong> ${registration[0].vertragsbeginn || 'N/A'}<br>
      <strong>Registrierungsdatum:</strong> ${new Date().toLocaleString('de-DE')}
    `;

    const notificationMetadata = JSON.stringify({
      email: registration[0].email,
      vorname: registration[0].vorname,
      nachname: registration[0].nachname
    });

    await queryAsync(`
      INSERT INTO notifications (type, recipient, subject, message, metadata, status, created_at)
      VALUES ('admin_alert', 'admin', 'Neue Mitglieder-Registrierung', ?, ?, 'unread', NOW())
    `, [notificationMessage, notificationMetadata]);

    res.json({
      success: true,
      message: 'Registrierung erfolgreich abgeschlossen! Sie erhalten eine Bestätigungs-Email.',
      data: {
        email,
        status: 'awaiting_approval',
        message: 'Ihre Registrierung wird nun manuell geprüft und freigeschaltet.'
      }
    });

  } catch (err) {
    logger.error('Fehler bei Schritt 6:', { error: err });
    res.status(500).json({ success: false, error: 'Serverfehler beim Abschließen der Registrierung' });
  }
});

// GET /api/public/register/status/:email - Registrierungsstatus abrufen
router.get('/register/status/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const registration = await queryAsync(`
      SELECT status, created_at, completed_at FROM registrierungen WHERE email = ?
    `, [email]);

    if (registration.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Keine Registrierung für diese Email gefunden'
      });
    }

    res.json({
      success: true,
      data: registration[0]
    });

  } catch (err) {
    logger.error('Fehler beim Abrufen des Registrierungsstatus:', { error: err });
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

// =============================================
// FAMILIEN-REGISTRIERUNG ENDPOINTS
// =============================================

// Hilfsfunktion: Prüfen ob minderjährig
const isMinor = (geburtsdatum) => {
  if (!geburtsdatum) return false;
  const today = new Date();
  const birthDate = new Date(geburtsdatum);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age < 18;
};

// POST /api/public/register/family/member - Familienmitglied hinzufügen
router.post('/register/family/member', async (req, res) => {
  try {
    const {
      hauptmitglied_email,  // Email des Hauptmitglieds
      vorname,
      nachname,
      geburtsdatum,
      geschlecht,
      email,
      password
    } = req.body;

    // Validierung
    if (!hauptmitglied_email || !vorname || !nachname || !geburtsdatum || !geschlecht || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Alle Pflichtfelder müssen ausgefüllt sein'
      });
    }

    // Hauptmitglied-Registrierung finden
    const hauptmitglied = await queryAsync(`
      SELECT * FROM registrierungen
      WHERE email = ? AND status IN ('personal_data_complete', 'bank_data_complete', 'tariff_selected', 'health_questions_complete', 'registration_complete')
    `, [hauptmitglied_email]);

    if (hauptmitglied.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Hauptmitglied nicht gefunden oder Registrierung nicht weit genug fortgeschritten'
      });
    }

    // Prüfen ob Email bereits existiert
    const existingUser = await queryAsync(
      'SELECT email FROM registrierungen WHERE email = ? OR EXISTS (SELECT 1 FROM mitglieder WHERE email = ?)',
      [email, email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Diese Email-Adresse ist bereits registriert'
      });
    }

    // Familien-Session-ID generieren oder übernehmen
    let familienSessionId = hauptmitglied[0].familien_session_id;
    if (!familienSessionId) {
      familienSessionId = crypto.randomUUID();
      // Hauptmitglied als Position 1 in Familie setzen
      await queryAsync(`
        UPDATE registrierungen
        SET familien_session_id = ?, familie_position = 1
        WHERE id = ?
      `, [familienSessionId, hauptmitglied[0].id]);
    }

    // Nächste Familien-Position ermitteln
    const positionResult = await queryAsync(`
      SELECT COALESCE(MAX(familie_position), 0) + 1 as next_position
      FROM registrierungen
      WHERE familien_session_id = ?
    `, [familienSessionId]);
    const familiePosition = positionResult[0].next_position;

    // Passwort hashen
    const passwordHash = await bcrypt.hash(password, 12);

    // Verification Token generieren
    const verificationToken = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Vertreter-Daten für Minderjährige
    let vertreter1Typ = null;
    let vertreter1Name = null;
    let vertreter1Telefon = null;
    let vertreter1Email = null;

    if (isMinor(geburtsdatum)) {
      vertreter1Typ = 'erziehungsberechtigter';
      vertreter1Name = `${hauptmitglied[0].vorname} ${hauptmitglied[0].nachname}`;
      vertreter1Telefon = hauptmitglied[0].telefon;
      vertreter1Email = hauptmitglied[0].email;
    }

    // Familienmitglied in Registrierungen einfügen
    // Adresse wird vom Hauptmitglied übernommen
    await queryAsync(`
      INSERT INTO registrierungen (
        email, password_hash, verification_token, token_expires_at,
        vorname, nachname, geburtsdatum, geschlecht,
        strasse, hausnummer, plz, ort, telefon,
        familien_session_id, familie_position,
        teilt_adresse_mit, teilt_bankdaten_mit,
        vertreter1_typ, vertreter1_name, vertreter1_telefon, vertreter1_email,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'personal_data_complete', NOW())
    `, [
      email, passwordHash, verificationToken, expiresAt,
      vorname, nachname, geburtsdatum, geschlecht,
      hauptmitglied[0].strasse, hauptmitglied[0].hausnummer, hauptmitglied[0].plz, hauptmitglied[0].ort, hauptmitglied[0].telefon,
      familienSessionId, familiePosition,
      hauptmitglied[0].id, hauptmitglied[0].id,
      vertreter1Typ, vertreter1Name, vertreter1Telefon, vertreter1Email
    ]);

    logger.info('Familienmitglied registriert', {
      hauptmitglied: hauptmitglied_email,
      familienmitglied: email,
      position: familiePosition,
      istMinderjaehrig: isMinor(geburtsdatum)
    });

    res.json({
      success: true,
      message: 'Familienmitglied erfolgreich hinzugefügt',
      data: {
        email,
        familiePosition,
        istMinderjaehrig: isMinor(geburtsdatum)
      }
    });

  } catch (err) {
    logger.error('Fehler beim Hinzufügen des Familienmitglieds:', { error: err });
    res.status(500).json({ success: false, error: 'Serverfehler beim Hinzufügen des Familienmitglieds' });
  }
});

// GET /api/public/register/family/:email - Familienmitglieder abrufen
router.get('/register/family/:email', async (req, res) => {
  try {
    const { email } = req.params;

    // Hauptmitglied-Registrierung finden
    const hauptmitglied = await queryAsync(`
      SELECT familien_session_id FROM registrierungen WHERE email = ?
    `, [email]);

    if (hauptmitglied.length === 0 || !hauptmitglied[0].familien_session_id) {
      return res.json({
        success: true,
        data: {
          familyMembers: [],
          hasFamilySession: false
        }
      });
    }

    // Alle Familienmitglieder abrufen
    const familyMembers = await queryAsync(`
      SELECT id, email, vorname, nachname, geburtsdatum, geschlecht, familie_position, status
      FROM registrierungen
      WHERE familien_session_id = ?
      ORDER BY familie_position ASC
    `, [hauptmitglied[0].familien_session_id]);

    res.json({
      success: true,
      data: {
        familyMembers,
        hasFamilySession: true,
        familySessionId: hauptmitglied[0].familien_session_id
      }
    });

  } catch (err) {
    logger.error('Fehler beim Abrufen der Familienmitglieder:', { error: err });
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

// DELETE /api/public/register/family/member/:id - Familienmitglied entfernen
router.delete('/register/family/member/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { hauptmitglied_email } = req.body;

    // Sicherheitsprüfung: Nur Mitglieder derselben Familie können entfernt werden
    const hauptmitglied = await queryAsync(`
      SELECT familien_session_id FROM registrierungen WHERE email = ?
    `, [hauptmitglied_email]);

    if (hauptmitglied.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Hauptmitglied nicht gefunden'
      });
    }

    const member = await queryAsync(`
      SELECT id, familie_position FROM registrierungen
      WHERE id = ? AND familien_session_id = ?
    `, [id, hauptmitglied[0].familien_session_id]);

    if (member.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Familienmitglied nicht gefunden'
      });
    }

    // Hauptmitglied (Position 1) kann nicht entfernt werden
    if (member[0].familie_position === 1) {
      return res.status(400).json({
        success: false,
        error: 'Das Hauptmitglied kann nicht entfernt werden'
      });
    }

    // Mitglied löschen
    await queryAsync('DELETE FROM registrierungen WHERE id = ?', [id]);

    // Positionen neu berechnen
    await queryAsync(`
      SET @pos = 1;
      UPDATE registrierungen
      SET familie_position = (@pos := @pos + 1) - 1
      WHERE familien_session_id = ?
      ORDER BY familie_position ASC;
    `, [hauptmitglied[0].familien_session_id]);

    res.json({
      success: true,
      message: 'Familienmitglied erfolgreich entfernt'
    });

  } catch (err) {
    logger.error('Fehler beim Entfernen des Familienmitglieds:', { error: err });
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

// =============================================
// PUBLIC BANK ENDPOINTS (für Registrierung ohne Auth)
// =============================================

// POST /api/public/banken/validate-iban - IBAN validieren
router.post('/banken/validate-iban', async (req, res) => {
  try {
    const { iban } = req.body;

    if (!iban) {
      return res.status(400).json({ error: "IBAN ist erforderlich" });
    }

    // IBAN bereinigen (Leerzeichen entfernen)
    const cleanIban = iban.replace(/\s/g, '').toUpperCase();

    // IBAN Format-Validierung (international)
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(cleanIban)) {
      return res.status(400).json({
        error: "Ungültiges IBAN-Format"
      });
    }
    // Modulo-97 Prüfsumme (ISO 7064)
    const ibanDigits = (cleanIban.slice(4) + cleanIban.slice(0, 4)).split('').map(c => {
      const code = c.charCodeAt(0);
      return code >= 65 ? (code - 55).toString() : c;
    }).join('');
    let remainder = 0;
    for (const ch of ibanDigits) { remainder = (remainder * 10 + parseInt(ch, 10)) % 97; }
    if (remainder !== 1) {
      return res.status(400).json({ error: 'IBAN-Prüfsumme ungültig. Bitte IBAN prüfen.' });
    }

    // Bankleitzahl aus IBAN extrahieren (Zeichen 4-11)
    const bankleitzahl = cleanIban.substring(4, 12);

    // BIC aus Bankleitzahl suchen
    const results = await queryAsync(
      "SELECT bankname, bic FROM banken WHERE bankleitzahl = ?",
      [bankleitzahl]
    );

    if (results.length === 0) {
      return res.json({
        valid: true,
        iban: cleanIban,
        bankleitzahl: bankleitzahl,
        bankname: "Unbekannte Bank",
        bic: "",
        message: "IBAN ist gültig, aber Bank nicht in der Datenbank gefunden"
      });
    }

    const bank = results[0];
    res.json({
      valid: true,
      iban: cleanIban,
      bankleitzahl: bankleitzahl,
      bankname: bank.bankname,
      bic: bank.bic,
      message: "IBAN ist gültig und Bank wurde gefunden"
    });

  } catch (err) {
    logger.error('Fehler bei IBAN-Validierung:', { error: err });
    res.status(500).json({ error: 'Serverfehler bei IBAN-Validierung' });
  }
});

// GET /api/public/banken/search - Banken suchen
router.get('/banken/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    const searchTerm = `%${q}%`;
    const results = await queryAsync(`
      SELECT bankleitzahl, bankname, bic, ort
      FROM banken
      WHERE bankname LIKE ? OR ort LIKE ?
      ORDER BY bankname
      LIMIT 10
    `, [searchTerm, searchTerm]);

    res.json(results);

  } catch (err) {
    logger.error('Fehler bei Bankensuche:', { error: err });
    res.status(500).json({ error: 'Serverfehler bei Bankensuche' });
  }
});

// POST /api/public/banken/kto-blz-to-iban - Kontonummer + BLZ zu IBAN
router.post('/banken/kto-blz-to-iban', async (req, res) => {
  try {
    const { kontonummer, bankleitzahl } = req.body;

    if (!kontonummer || !bankleitzahl) {
      return res.status(400).json({
        error: "Kontonummer und Bankleitzahl sind erforderlich"
      });
    }

    // Kontonummer auf 10 Stellen auffüllen
    const paddedKto = kontonummer.padStart(10, '0');

    // Bankleitzahl validieren (8 Stellen)
    if (!/^\d{8}$/.test(bankleitzahl)) {
      return res.status(400).json({
        error: "Bankleitzahl muss 8 Ziffern haben"
      });
    }

    // BBAN erstellen (Bankleitzahl + Kontonummer)
    const bban = bankleitzahl + paddedKto;

    // Prüfziffer berechnen
    const checkDigits = calculateIbanCheckDigits(bban);

    // IBAN erstellen
    const iban = `DE${checkDigits}${bban}`;

    // BIC aus Bankleitzahl suchen
    const results = await queryAsync(
      "SELECT bankname, bic FROM banken WHERE bankleitzahl = ?",
      [bankleitzahl]
    );

    const bank = results.length > 0 ? results[0] : { bankname: "Unbekannte Bank", bic: "" };

    res.json({
      iban: iban,
      bankleitzahl: bankleitzahl,
      kontonummer: kontonummer,
      bankname: bank.bankname,
      bic: bank.bic,
      message: "IBAN wurde erfolgreich erstellt"
    });

  } catch (err) {
    logger.error('Fehler bei IBAN-Konvertierung:', { error: err });
    res.status(500).json({ error: 'Serverfehler bei IBAN-Konvertierung' });
  }
});

// POST /api/public/check-duplicate - Duplikatsprüfung (öffentlich)
router.post('/check-duplicate', step1Limiter, async (req, res) => {
  try {
    const { vorname, nachname, geburtsdatum, email } = req.body;

    if (!vorname || !nachname) {
      return res.json({ isDuplicate: false });
    }

    // Einfache Prüfung auf existierende Mitglieder mit gleichem Namen und Geburtsdatum
    let query = `
      SELECT mitglied_id, vorname, nachname, geburtsdatum, email
      FROM mitglieder
      WHERE LOWER(vorname) = LOWER(?) AND LOWER(nachname) = LOWER(?)
    `;
    const params = [vorname, nachname];

    if (geburtsdatum) {
      query += ' AND geburtsdatum = ?';
      params.push(geburtsdatum);
    }

    const results = await queryAsync(query, params);

    if (results.length > 0) {
      return res.json({
        isDuplicate: true,
        message: 'Ein Mitglied mit diesem Namen existiert bereits',
        existingMember: {
          vorname: results[0].vorname,
          nachname: results[0].nachname
        }
      });
    }

    res.json({ isDuplicate: false });

  } catch (err) {
    logger.error('Fehler bei Duplikatsprüfung:', { error: err });
    res.status(500).json({ error: 'Serverfehler bei Duplikatsprüfung' });
  }
});

// Hilfsfunktion für IBAN-Prüfziffer
function calculateIbanCheckDigits(bban) {
  // BBAN + "DE" für Prüfziffer-Berechnung
  const rearranged = bban + "1314"; // DE = 13, 14

  // Modulo 97 berechnen
  let remainder = 0;
  for (let i = 0; i < rearranged.length; i++) {
    remainder = (remainder * 10 + parseInt(rearranged[i])) % 97;
  }

  // Prüfziffer berechnen
  const checkDigits = (98 - remainder).toString().padStart(2, '0');
  return checkDigits;
}

// =============================================
// TARIFE ENDPOINT
// =============================================

// GET /api/public/tarife - Öffentlich verfügbare Tarife (tenant-aware via X-Tenant-Subdomain)
router.get('/tarife', async (req, res) => {
  try {
    const familyContext = req.query.family === '1'; // ?family=1 zeigt Familienmitglied-Tarife

    // Tenant-Erkennung für public (unauthentifizierte) Requests via Subdomain-Header
    let dojoId = null;
    const subdomain = req.headers['x-tenant-subdomain'];
    if (subdomain) {
      const dojos = await queryAsync(
        'SELECT id FROM dojo WHERE subdomain = ? AND ist_aktiv = 1 LIMIT 1',
        [subdomain]
      );
      if (dojos.length > 0) dojoId = dojos[0].id;
    }

    let query;
    let params;
    if (dojoId) {
      query = `
        SELECT id, name, price_cents, currency, duration_months, billing_cycle, payment_method,
               altersgruppe, mindestlaufzeit_monate, aufnahmegebuehr_cents, nur_familienmitglied
        FROM tarife
        WHERE dojo_id = ? AND active = 1 AND (ist_archiviert IS NULL OR ist_archiviert = 0)
          AND nur_familienmitglied = ?
        ORDER BY altersgruppe ASC, price_cents ASC
      `;
      params = [dojoId, familyContext ? 1 : 0];
    } else {
      query = `
        SELECT id, name, price_cents, currency, duration_months, billing_cycle, payment_method,
               altersgruppe, mindestlaufzeit_monate, aufnahmegebuehr_cents, nur_familienmitglied
        FROM tarife
        WHERE active = 1 AND (ist_archiviert IS NULL OR ist_archiviert = 0)
          AND nur_familienmitglied = ?
        ORDER BY altersgruppe ASC, price_cents ASC
      `;
      params = [familyContext ? 1 : 0];
    }

    const tarife = await queryAsync(query, params);

    const tarifeFormatted = tarife.map(tarif => ({
      ...tarif,
      price_euros: (tarif.price_cents / 100).toFixed(2),
      aufnahmegebuehr_euros: ((tarif.aufnahmegebuehr_cents || 0) / 100).toFixed(2),
      beschreibung: tarif.altersgruppe
        ? `${tarif.altersgruppe} - ${tarif.duration_months || tarif.mindestlaufzeit_monate || 12} Monate Laufzeit`
        : `${tarif.duration_months || tarif.mindestlaufzeit_monate || 12} Monate Laufzeit`
    }));

    res.json({ success: true, data: tarifeFormatted });

  } catch (err) {
    logger.error('Fehler beim Abrufen der öffentlichen Tarife:', { error: err });
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

// =============================================
// FAMILIEN-LOGIN ENDPOINT
// =============================================

// POST /api/public/family-login - Login für bestehendes Mitglied (Familien-Anmeldung)
router.post('/family-login', async (req, res) => {
  try {
    const { email, passwort } = req.body;

    if (!email || !passwort) {
      return res.status(400).json({
        success: false,
        message: 'E-Mail und Passwort sind erforderlich'
      });
    }

    // Benutzer anhand der E-Mail finden
    const benutzer = await queryAsync(`
      SELECT b.id, b.email, b.password_hash, b.mitglied_id
      FROM benutzer b
      WHERE b.email = ? AND b.aktiv = 1
      LIMIT 1
    `, [email]);

    if (benutzer.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'E-Mail oder Passwort ist falsch'
      });
    }

    const user = benutzer[0];

    // Passwort prüfen
    const passwordValid = await bcrypt.compare(passwort, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: 'E-Mail oder Passwort ist falsch'
      });
    }

    // Mitgliederdaten abrufen (inkl. Adresse und Bankdaten)
    const mitglieder = await queryAsync(`
      SELECT
        m.mitglied_id,
        m.vorname,
        m.nachname,
        m.email,
        m.strasse,
        m.hausnummer,
        m.plz,
        m.ort,
        m.telefon_mobil,
        m.kontoinhaber,
        m.iban,
        m.bic,
        m.bank_name,
        m.familien_id
      FROM mitglieder m
      WHERE m.mitglied_id = ?
      LIMIT 1
    `, [user.mitglied_id]);

    if (mitglieder.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Mitgliedsdaten nicht gefunden'
      });
    }

    const member = mitglieder[0];

    logger.info('Familien-Login erfolgreich', { email, mitglied_id: member.mitglied_id });

    res.json({
      success: true,
      message: 'Login erfolgreich',
      member: {
        mitglied_id: member.mitglied_id,
        vorname: member.vorname,
        nachname: member.nachname,
        email: member.email,
        // Adressdaten
        strasse: member.strasse,
        hausnummer: member.hausnummer,
        plz: member.plz,
        ort: member.ort,
        telefon_mobil: member.telefon_mobil,
        // Bankdaten
        kontoinhaber: member.kontoinhaber,
        iban: member.iban,
        bic: member.bic,
        bank_name: member.bank_name,
        // Familien-Info
        familien_id: member.familien_id
      }
    });

  } catch (err) {
    logger.error('Fehler beim Familien-Login:', { error: err });
    res.status(500).json({
      success: false,
      message: 'Serverfehler beim Login'
    });
  }
});

// =============================================
// ÖFFENTLICHE MITGLIED-ANMELDUNG (für externe Websites)
// =============================================

// GET /api/public/tarife/:dojo_id - Tarife für ein bestimmtes Dojo
router.get('/tarife/:dojo_id', async (req, res) => {
  try {
    const { dojo_id } = req.params;
    const familyContext = req.query.family === '1'; // ?family=1 zeigt Familienmitglied-Tarife

    const tarife = await queryAsync(`
      SELECT id, name, price_cents, currency, duration_months, billing_cycle, payment_method,
             altersgruppe, mindestlaufzeit_monate, aufnahmegebuehr_cents, nur_familienmitglied
      FROM tarife
      WHERE dojo_id = ? AND active = 1 AND (ist_archiviert IS NULL OR ist_archiviert = 0)
        AND nur_familienmitglied = ?
      ORDER BY altersgruppe ASC, price_cents ASC
    `, [dojo_id, familyContext ? 1 : 0]);

    const tarifeFormatted = tarife.map(tarif => ({
      ...tarif,
      price_euros: (tarif.price_cents / 100).toFixed(2),
      aufnahmegebuehr_euros: ((tarif.aufnahmegebuehr_cents || 0) / 100).toFixed(2)
    }));

    res.json({ success: true, data: tarifeFormatted });
  } catch (err) {
    logger.error('Fehler beim Abrufen der Dojo-Tarife:', { error: err, dojo_id: req.params.dojo_id });
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

// GET /api/public/stundenplan/:dojo_id - Öffentlicher Stundenplan
router.get('/stundenplan/:dojo_id', async (req, res) => {
  try {
    const { dojo_id } = req.params;

    const stundenplan = await queryAsync(`
      SELECT
        s.stundenplan_id,
        k.gruppenname as kursname,
        s.tag,
        s.uhrzeit_start,
        s.uhrzeit_ende,
        k.stil,
        CONCAT(t.vorname, ' ', t.nachname) as trainer
      FROM stundenplan s
      LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
      LEFT JOIN trainer t ON s.trainer_id = t.trainer_id
      WHERE k.dojo_id = ?
      ORDER BY FIELD(s.tag, 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'), s.uhrzeit_start
    `, [dojo_id]);

    res.json({ success: true, data: stundenplan });
  } catch (err) {
    logger.error('Fehler beim Abrufen des Stundenplans:', { error: err, dojo_id: req.params.dojo_id });
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

// GET /api/public/dojo/:subdomain - Dojo-Info anhand Subdomain
router.get('/dojo/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;

    const dojos = await queryAsync(`
      SELECT id, dojoname, subdomain, inhaber, ort, ist_aktiv
      FROM dojo
      WHERE subdomain = ? AND ist_aktiv = 1
      LIMIT 1
    `, [subdomain]);

    if (dojos.length === 0) {
      return res.status(404).json({ success: false, error: 'Dojo nicht gefunden' });
    }

    res.json({ success: true, data: dojos[0] });
  } catch (err) {
    logger.error('Fehler beim Abrufen des Dojos:', { error: err });
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

// POST /api/public/mitglied-anlegen - Neues Mitglied öffentlich anlegen
router.post('/mitglied-anlegen', async (req, res) => {
  try {
    const {
      dojo_id,
      vorname, nachname, geburtsdatum, geschlecht,
      strasse, hausnummer, plz, ort, telefon, email,
      iban, bic, bank_name, kontoinhaber,
      tarif_id, vertragsbeginn,
      // Optional: Gesundheitsfragen
      gesundheitsfragen,
      // Optional: Familien-Verknüpfung
      familien_id, hauptmitglied_id,
      // Einverständnisse
      agb_accepted, dsgvo_accepted, widerrufsrecht_acknowledged, dojoregeln_accepted,
      // Empfehlungscode
      referral_code
    } = req.body;

    // Pflichtfeld-Validierung
    if (!dojo_id || !vorname || !nachname || !geburtsdatum || !geschlecht) {
      return res.status(400).json({
        success: false,
        error: 'Pflichtfelder fehlen: dojo_id, vorname, nachname, geburtsdatum, geschlecht'
      });
    }

    // Dojo prüfen
    const dojoCheck = await queryAsync('SELECT id, dojoname FROM dojo WHERE id = ? AND ist_aktiv = 1', [dojo_id]);
    if (dojoCheck.length === 0) {
      return res.status(400).json({ success: false, error: 'Ungültiges Dojo' });
    }

    // E-Mail Duplikat prüfen (falls angegeben)
    if (email) {
      const emailCheck = await queryAsync('SELECT mitglied_id FROM mitglieder WHERE email = ? AND dojo_id = ?', [email, dojo_id]);
      if (emailCheck.length > 0) {
        return res.status(400).json({ success: false, error: 'Diese E-Mail-Adresse ist bereits registriert' });
      }
    }

    // Name + Geburtsdatum Duplikat prüfen (verhindert Doppelregistrierung)
    const nameCheck = await queryAsync(
      'SELECT mitglied_id FROM mitglieder WHERE LOWER(vorname) = LOWER(?) AND LOWER(nachname) = LOWER(?) AND geburtsdatum = ? AND dojo_id = ?',
      [vorname, nachname, geburtsdatum, dojo_id]
    );
    if (nameCheck.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Ein Mitglied mit diesem Namen und Geburtsdatum ist bereits registriert. Bitte kontaktiere uns direkt falls du Fragen hast.'
      });
    }

    // Alle vorhandenen Spalten der mitglieder-Tabelle abrufen
    const allColumns = await queryAsync('SHOW COLUMNS FROM mitglieder');
    const existingColumns = new Set(allColumns.map(c => c.Field));

    // Geschlecht-Format anpassen (manche DBs haben ENUM mit m/w/d)
    const geschlechtCol = allColumns.find(c => c.Field === 'geschlecht');
    let geschlechtValue = geschlecht;
    if (geschlechtCol && geschlechtCol.Type.includes('enum')) {
      // Prüfen ob kurze Werte erwartet werden
      if (geschlechtCol.Type.includes("'m'") || geschlechtCol.Type.includes("'w'")) {
        const mapping = {
          'männlich': 'm', 'maennlich': 'm', 'male': 'm', 'm': 'm',
          'weiblich': 'w', 'female': 'w', 'w': 'w',
          'divers': 'd', 'diverse': 'd', 'd': 'd'
        };
        geschlechtValue = mapping[(geschlecht || '').toLowerCase()] || geschlecht;
      }
    }

    // Mitgliedsnummer generieren falls Spalte existiert
    let mitgliedsnummer = null;
    if (existingColumns.has('mitgliedsnummer')) {
      const lastMember = await queryAsync(
        'SELECT mitgliedsnummer FROM mitglieder WHERE dojo_id = ? ORDER BY mitglied_id DESC LIMIT 1',
        [dojo_id]
      );
      let nextNumber = 1;
      if (lastMember.length > 0 && lastMember[0].mitgliedsnummer) {
        const match = lastMember[0].mitgliedsnummer.match(/(\d+)$/);
        if (match) nextNumber = parseInt(match[1]) + 1;
      }
      mitgliedsnummer = `M-${String(nextNumber).padStart(5, '0')}`;
    }

    // Familien-ID generieren falls Spalte existiert
    let finalFamilienId = familien_id;
    if (existingColumns.has('familien_id') && !finalFamilienId && !hauptmitglied_id) {
      const familyResult = await queryAsync(
        'SELECT COALESCE(MAX(familien_id), 0) + 1 as next_id FROM mitglieder WHERE dojo_id = ?',
        [dojo_id]
      );
      finalFamilienId = familyResult[0].next_id;
    }

    // Alle möglichen Felder mit Werten definieren
    const allFields = {
      dojo_id: dojo_id,
      vorname: vorname,
      nachname: nachname,
      geburtsdatum: geburtsdatum,
      geschlecht: geschlechtValue,
      strasse: strasse || '',
      hausnummer: hausnummer || '',
      plz: plz || '',
      ort: ort || '',
      telefon: telefon || '',
      telefon_mobil: telefon || '',
      email: email || '',
      iban: iban || '',
      bic: bic || '',
      bankname: bank_name || '',
      kontoinhaber: kontoinhaber || `${vorname} ${nachname}`,
      aktiv: 1,
      eintrittsdatum: vertragsbeginn || new Date().toISOString().split('T')[0],
      created_at: new Date(),
      mitgliedsnummer: mitgliedsnummer,
      familien_id: finalFamilienId,
      hauptmitglied_id: hauptmitglied_id || null,
      registration_source: 'public_website',
      // Erziehungsberechtigte als Vertreter
      vertreter1_typ: req.body.verhaeltnis || null,
      vertreter1_name: req.body.erziehungsberechtigt_vorname && req.body.erziehungsberechtigt_nachname
        ? `${req.body.erziehungsberechtigt_vorname} ${req.body.erziehungsberechtigt_nachname}`
        : null,
      vertreter1_email: req.body.erziehungsberechtigt_email || null,
      vertreter1_telefon: req.body.erziehungsberechtigt_telefon || null,
      // Weitere optionale Felder
      schueler_student: req.body.schueler_student ? 1 : 0,
      notfallkontakt_name: gesundheitsfragen?.notfallkontakt_name || null,
      notfallkontakt_telefon: gesundheitsfragen?.notfallkontakt_telefon || null,
      notfallkontakt_verhaeltnis: req.body.notfallkontakt_verhaeltnis || null,
      allergien: req.body.allergien || null,
      medizinische_hinweise: req.body.medizinische_hinweise || null,
      foto_einverstaendnis: req.body.foto_einverstaendnis ? 1 : 0,
      gesundheitserklaerung: req.body.gesundheitserklaerung ? 1 : 0,
      agb_akzeptiert: agb_accepted ? 1 : 0,
      agb_akzeptiert_am: agb_accepted ? new Date() : null,
      datenschutz_akzeptiert: dsgvo_accepted ? 1 : 0,
      datenschutz_akzeptiert_am: dsgvo_accepted ? new Date() : null,
      zahlungsmethode: 'Lastschrift'
    };

    // Nur Felder einfügen die in der Tabelle existieren
    const insertFields = [];
    const insertValues = [];
    for (const [field, value] of Object.entries(allFields)) {
      if (existingColumns.has(field) && value !== null) {
        insertFields.push(field);
        insertValues.push(value);
      }
    }

    const placeholders = insertValues.map(() => '?').join(', ');
    const insertResult = await queryAsync(
      `INSERT INTO mitglieder (${insertFields.join(', ')}) VALUES (${placeholders})`,
      insertValues
    );

    const newMitgliedId = insertResult.insertId;

    // Vertrag anlegen falls tarif_id angegeben
    let vertragId = null;
    let sepaMandatId = null;
    if (tarif_id) {
      const tarif = await queryAsync('SELECT * FROM tarife WHERE id = ?', [tarif_id]);
      if (tarif.length > 0) {
        const t = tarif[0];
        const startDate = vertragsbeginn || new Date().toISOString().split('T')[0];

        // Monatsbeitrag in Euro umrechnen (aus Cents)
        const monatsBeitrag = (t.price_cents || 0) / 100;

        // Vertragsnummer generieren
        const lastVertrag = await queryAsync(
          'SELECT id FROM vertraege WHERE dojo_id = ? ORDER BY id DESC LIMIT 1',
          [dojo_id]
        );
        const nextVertragNum = lastVertrag.length > 0 ? lastVertrag[0].id + 1 : 1;
        const vertragsnummer = `V-${String(nextVertragNum).padStart(6, '0')}`;

        // Vertragsende berechnen (Vertragsbeginn + Mindestlaufzeit)
        const mindestlaufzeit = t.mindestlaufzeit_monate || 12;

        const vertragResult = await queryAsync(`
          INSERT INTO vertraege (
            mitglied_id, dojo_id, tarif_id, vertragsbeginn, vertragsende, status,
            monatlicher_beitrag, monatsbeitrag, aufnahmegebuehr_cents, billing_cycle,
            vertragsnummer, mindestlaufzeit_monate
          ) VALUES (?, ?, ?, ?, DATE_ADD(?, INTERVAL ? MONTH), 'aktiv', ?, ?, ?, ?, ?, ?)
        `, [
          newMitgliedId, dojo_id, tarif_id, startDate, startDate, mindestlaufzeit,
          monatsBeitrag, monatsBeitrag, t.aufnahmegebuehr_cents || 0,
          t.billing_cycle || 'MONTHLY', vertragsnummer, mindestlaufzeit
        ]);
        vertragId = vertragResult.insertId;

        // SEPA-Mandat erstellen falls Bankdaten vorhanden
        if (iban && kontoinhaber) {
          const timestamp = Date.now();
          const mandatsreferenz = `DOJO${dojo_id}-${newMitgliedId}-${timestamp}`;

          const mandatResult = await queryAsync(`
            INSERT INTO sepa_mandate (
              mitglied_id, iban, bic, bankname, kontoinhaber, mandatsreferenz,
              glaeubiger_id, status, erstellungsdatum, provider, mandat_typ
            ) VALUES (?, ?, ?, ?, ?, ?, 'DE98ZZZ09999999999', 'aktiv', NOW(), 'manual_sepa', 'CORE')
          `, [newMitgliedId, iban, bic || '', bank_name || '', kontoinhaber, mandatsreferenz]);
          sepaMandatId = mandatResult.insertId;

          // Vertrag mit SEPA-Mandat verknüpfen
          await queryAsync('UPDATE vertraege SET sepa_mandat_id = ? WHERE id = ?', [sepaMandatId, vertragId]);

          // Auto Stripe-Setup: Prüfe ob Dojo automatisches Stripe-Setup aktiviert hat
          try {
            const dojoSettings = await queryAsync(
              'SELECT auto_stripe_setup, stripe_secret_key FROM dojo WHERE id = ?',
              [dojo_id]
            );

            if (dojoSettings.length > 0 && dojoSettings[0].auto_stripe_setup && dojoSettings[0].stripe_secret_key) {
              const PaymentProviderFactory = require('../services/PaymentProviderFactory');
              const provider = await PaymentProviderFactory.getProvider(dojo_id);

              if (provider && provider.createSepaCustomer) {
                const mitgliedData = {
                  mitglied_id: newMitgliedId,
                  vorname: vorname,
                  nachname: nachname,
                  email: email
                };

                await provider.createSepaCustomer(mitgliedData, iban, kontoinhaber);
                logger.info('Auto Stripe-Setup erfolgreich für neues Mitglied', {
                  mitglied_id: newMitgliedId,
                  dojo_id
                });
              }
            }
          } catch (stripeError) {
            // Stripe-Fehler nur loggen, Registrierung nicht abbrechen
            logger.warn('Auto Stripe-Setup fehlgeschlagen (Registrierung wird fortgesetzt)', {
              mitglied_id: newMitgliedId,
              error: stripeError.message
            });
          }
        }

        // Beiträge für gesamte Vertragslaufzeit generieren
        const startDateObj = new Date(startDate);
        const startDay = startDateObj.getDate();
        const startMonth = startDateObj.getMonth();
        const startYear = startDateObj.getFullYear();
        const daysInStartMonth = new Date(startYear, startMonth + 1, 0).getDate();
        const remainingDays = daysInStartMonth - startDay + 1;
        const proratedAmount = Math.round((monatsBeitrag / daysInStartMonth * remainingDays) * 100) / 100;

        const monthNames = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
        const startMonthStr = monthNames[startMonth];
        const startDayStr = String(startDay).padStart(2, '0');

        // Erster Monat (anteilig oder voll)
        if (startDay > 1) {
          await queryAsync(`
            INSERT INTO beitraege (mitglied_id, betrag, zahlungsdatum, zahlungsart, bezahlt, dojo_id, magicline_description)
            VALUES (?, ?, ?, 'Lastschrift', 0, ?, ?)
          `, [newMitgliedId, proratedAmount, startDate, dojo_id, `Beitrag ${startMonthStr}/${startYear} (anteilig ab ${startDayStr}.${startMonthStr}.)`]);
        } else {
          await queryAsync(`
            INSERT INTO beitraege (mitglied_id, betrag, zahlungsdatum, zahlungsart, bezahlt, dojo_id, magicline_description)
            VALUES (?, ?, ?, 'Lastschrift', 0, ?, ?)
          `, [newMitgliedId, monatsBeitrag, startDate, dojo_id, `Beitrag ${startMonthStr}/${startYear}`]);
        }

        // Restliche Monate der Vertragslaufzeit (Monat 2 bis mindestlaufzeit)
        for (let i = 1; i < mindestlaufzeit; i++) {
          const beitragMonth = (startMonth + i) % 12;
          const beitragYear = startYear + Math.floor((startMonth + i) / 12);
          const beitragMonthStr = monthNames[beitragMonth];
          const beitragDate = `${beitragYear}-${beitragMonthStr}-01`;

          await queryAsync(`
            INSERT INTO beitraege (mitglied_id, betrag, zahlungsdatum, zahlungsart, bezahlt, dojo_id, magicline_description)
            VALUES (?, ?, ?, 'Lastschrift', 0, ?, ?)
          `, [newMitgliedId, monatsBeitrag, beitragDate, dojo_id, `Beitrag ${beitragMonthStr}/${beitragYear}`]);
        }

        // Aufnahmegebühr falls vorhanden
        if (t.aufnahmegebuehr_cents && t.aufnahmegebuehr_cents > 0) {
          const aufnahmegebuehr = t.aufnahmegebuehr_cents / 100;
          await queryAsync(`
            INSERT INTO beitraege (mitglied_id, betrag, zahlungsdatum, zahlungsart, bezahlt, dojo_id, magicline_description)
            VALUES (?, ?, ?, 'Lastschrift', 0, ?, 'Aufnahmegebühr')
          `, [newMitgliedId, aufnahmegebuehr, startDate, dojo_id]);
        }
      }
    }

    // Gesundheitsfragen speichern falls vorhanden
    if (gesundheitsfragen && Object.keys(gesundheitsfragen).length > 0) {
      try {
        await queryAsync(`
          INSERT INTO mitglieder_gesundheit (
            mitglied_id, vorerkrankungen, medikamente, herzprobleme,
            rueckenprobleme, gelenkprobleme, sonstige_einschraenkungen,
            notfallkontakt_name, notfallkontakt_telefon, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
          newMitgliedId,
          gesundheitsfragen.vorerkrankungen || 'nein',
          gesundheitsfragen.medikamente || 'nein',
          gesundheitsfragen.herzprobleme || 'nein',
          gesundheitsfragen.rueckenprobleme || 'nein',
          gesundheitsfragen.gelenkprobleme || 'nein',
          gesundheitsfragen.sonstige_einschraenkungen || '',
          gesundheitsfragen.notfallkontakt_name || '',
          gesundheitsfragen.notfallkontakt_telefon || ''
        ]);
      } catch (gesundheitErr) {
        logger.warn('Gesundheitsfragen konnten nicht gespeichert werden (Tabelle fehlt?)', { error: gesundheitErr.message, mitglied_id: newMitgliedId });
      }
    }

    // Login-Account erstellen (automatisch mit vorname.nachname / Geburtsdatum dd/mm/yyyy)
    try {
      const cleanName = s => (s || '').trim().toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/\s+/g, '');
      const autoUsername = req.body.benutzername
        ? req.body.benutzername.trim()
        : cleanName(vorname) + '.' + cleanName(nachname);
      const [gy, gm, gd] = (geburtsdatum || '').split('-');
      const autoPassword = req.body.passwort
        ? req.body.passwort
        : (gd && gm && gy ? gd + '/' + gm + '/' + gy : null);

      if (autoUsername && autoPassword && autoUsername.toLowerCase() !== 'admin') {
        const existing = await queryAsync('SELECT id FROM users WHERE username = ?', [autoUsername]);
        const usernameToUse = existing.length > 0 ? autoUsername + '.' + newMitgliedId : autoUsername;
        const hash = await bcrypt.hash(autoPassword, 10);
        await queryAsync(
          'INSERT IGNORE INTO users (username, email, password, role, mitglied_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [usernameToUse, email || null, hash, 'member', newMitgliedId]
        );
        logger.info('Account automatisch erstellt', { username: usernameToUse, mitglied_id: newMitgliedId });
      }
    } catch (accountErr) {
      logger.warn('Account-Erstellung fehlgeschlagen (Mitglied angelegt)', { error: accountErr.message });
    }

    // Familienmitglieder anlegen (wenn angegeben)
    const familyMembers = Array.isArray(req.body.family_members) ? req.body.family_members : [];
    for (const fm of familyMembers) {
      if (!fm.vorname || !fm.nachname || !fm.geburtsdatum || !fm.geschlecht) continue;
      try {
        const fmGeschlechtMap = { 'männlich': 'm', 'maennlich': 'm', 'male': 'm', 'm': 'm', 'weiblich': 'w', 'female': 'w', 'w': 'w', 'divers': 'd', 'd': 'd' };
        const fmGeschlecht = fmGeschlechtMap[(fm.geschlecht || '').toLowerCase()] || fm.geschlecht;

        const fmFields = {
          dojo_id, vorname: fm.vorname, nachname: fm.nachname,
          geburtsdatum: fm.geburtsdatum, geschlecht: fmGeschlecht,
          strasse: strasse || '', hausnummer: hausnummer || '',
          plz: plz || '', ort: ort || '',
          telefon: fm.telefon || telefon || '',
          email: fm.email || '',
          iban: iban || '', bic: bic || '',
          bankname: bank_name || '',
          kontoinhaber: kontoinhaber || `${vorname} ${nachname}`,
          aktiv: 1,
          eintrittsdatum: vertragsbeginn || new Date().toISOString().split('T')[0],
          created_at: new Date(),
          familien_id: finalFamilienId,
          hauptmitglied_id: newMitgliedId,
          registration_source: 'public_website_family',
          schueler_student: fm.schueler_student ? 1 : 0,
          agb_akzeptiert: agb_accepted ? 1 : 0,
          datenschutz_akzeptiert: dsgvo_accepted ? 1 : 0,
          zahlungsmethode: 'Lastschrift'
        };

        const fmInsertFields = [];
        const fmInsertValues = [];
        for (const [field, value] of Object.entries(fmFields)) {
          if (existingColumns.has(field) && value !== null) {
            fmInsertFields.push(field);
            fmInsertValues.push(value);
          }
        }
        const fmResult = await queryAsync(
          `INSERT INTO mitglieder (${fmInsertFields.join(', ')}) VALUES (${fmInsertValues.map(() => '?').join(', ')})`,
          fmInsertValues
        );
        const fmMitgliedId = fmResult.insertId;

        // Vertrag für Familienmitglied
        if (fm.tarif_id) {
          const fmTarif = await queryAsync('SELECT * FROM tarife WHERE id = ?', [fm.tarif_id]);
          if (fmTarif.length > 0) {
            const t = fmTarif[0];
            const startDate = vertragsbeginn || new Date().toISOString().split('T')[0];
            const monatsBeitrag = (t.price_cents || 0) / 100;
            const mindestlaufzeit = t.mindestlaufzeit_monate || 12;
            const fmLastVertrag = await queryAsync('SELECT id FROM vertraege WHERE dojo_id = ? ORDER BY id DESC LIMIT 1', [dojo_id]);
            const fmNextNum = fmLastVertrag.length > 0 ? fmLastVertrag[0].id + 1 : 1;
            const fmVertragsnummer = `V-${String(fmNextNum).padStart(6, '0')}`;
            await queryAsync(
              `INSERT INTO vertraege (mitglied_id, dojo_id, tarif_id, vertragsbeginn, vertragsende, status, monatlicher_beitrag, monatsbeitrag, billing_cycle, vertragsnummer, mindestlaufzeit_monate)
               VALUES (?, ?, ?, ?, DATE_ADD(?, INTERVAL ? MONTH), 'aktiv', ?, ?, ?, ?, ?)`,
              [fmMitgliedId, dojo_id, fm.tarif_id, startDate, startDate, mindestlaufzeit, monatsBeitrag, monatsBeitrag, t.billing_cycle || 'MONTHLY', fmVertragsnummer, mindestlaufzeit]
            );
            if (iban && kontoinhaber) {
              const fmMandatsref = `DOJO${dojo_id}-${fmMitgliedId}-${Date.now()}`;
              await queryAsync(
                `INSERT INTO sepa_mandate (mitglied_id, iban, bic, bankname, kontoinhaber, mandatsreferenz, glaeubiger_id, status, erstellungsdatum, provider, mandat_typ)
                 VALUES (?, ?, ?, ?, ?, ?, 'DE98ZZZ09999999999', 'aktiv', NOW(), 'manual_sepa', 'CORE')`,
                [fmMitgliedId, iban, bic || '', bank_name || '', kontoinhaber, fmMandatsref]
              );
            }
          }
        }

        // Account für Familienmitglied
        if (fm.benutzername && fm.passwort && fm.benutzername.trim().toLowerCase() !== 'admin') {
          try {
            const bcrypt = require('bcryptjs');
            const fmBenutzername = fm.benutzername.trim();
            const fmExisting = await queryAsync('SELECT id FROM users WHERE username = ?', [fmBenutzername]);
            if (fmExisting.length === 0) {
              const hash = await bcrypt.hash(fm.passwort, 10);
              await queryAsync(
                'INSERT INTO users (username, email, password, role, mitglied_id, created_at) VALUES (?, ?, ?, "member", ?, NOW())',
                [fmBenutzername, fm.email || null, hash, fmMitgliedId]
              );
            }
          } catch (fmAccountErr) {
            logger.warn('FM-Account fehlgeschlagen', { error: fmAccountErr.message });
          }
        }
      } catch (fmErr) {
        logger.warn('Familienmitglied konnte nicht angelegt werden', { error: fmErr.message, fm: fm.vorname });
      }
    }

    // ── Referral-Code verarbeiten ────────────────────────────────────────────
    if (referral_code && referral_code.trim()) {
      try {
        const code = referral_code.trim().toUpperCase();
        const [rcRows] = await db.promise().query(`
          SELECT rc.id, rc.mitglied_id,
                 COALESCE(rs.standard_praemie, 50.00) AS praemie_betrag
          FROM referral_codes rc
          LEFT JOIN referral_settings rs ON rs.dojo_id = rc.dojo_id
          WHERE rc.code = ? AND rc.aktiv = 1
            AND (rc.gueltig_bis IS NULL OR rc.gueltig_bis >= CURDATE())
            AND (rc.max_verwendungen IS NULL OR rc.aktuelle_verwendungen < rc.max_verwendungen)
        `, [code]);

        if (rcRows.length > 0) {
          const rc = rcRows[0];
          const refLaufzeit = vertragId ? (await db.promise().query(
            'SELECT mindestlaufzeit_monate FROM vertraege WHERE id = ?', [vertragId]
          ))[0][0]?.mindestlaufzeit_monate || 12 : 12;

          const [refResult] = await db.promise().query(`
            INSERT INTO referrals
              (dojo_id, werber_mitglied_id, geworbenes_mitglied_id, referral_code_id,
               status, vertrag_id, vertrag_laufzeit_monate)
            VALUES (?, ?, ?, ?, 'vertrag_abgeschlossen', ?, ?)
          `, [dojo_id, rc.mitglied_id, newMitgliedId, rc.id, vertragId, refLaufzeit]);

          const referralId = refResult.insertId;

          await db.promise().query(`
            INSERT INTO referral_praemien
              (dojo_id, referral_id, mitglied_id, betrag, typ, status)
            VALUES (?, ?, ?, ?, 'gutschrift', 'ausstehend')
          `, [dojo_id, referralId, rc.mitglied_id, rc.praemie_betrag]);

          await db.promise().query(
            'UPDATE referral_codes SET aktuelle_verwendungen = aktuelle_verwendungen + 1 WHERE id = ?',
            [rc.id]
          );

          logger.info('Referral-Code verarbeitet', { code, werber_id: rc.mitglied_id, geworbener_id: newMitgliedId });
        } else {
          logger.warn('Ungültiger oder abgelaufener Referral-Code', { code, mitglied_id: newMitgliedId });
        }
      } catch (refErr) {
        logger.warn('Fehler bei Referral-Code-Verarbeitung', { error: refErr.message });
      }
    }

    logger.info('Neues Mitglied über öffentliche Website angelegt', {
      mitglied_id: newMitgliedId,
      dojo_id,
      name: `${vorname} ${nachname}`,
      source: 'public_website'
    });

    res.json({
      success: true,
      message: 'Mitglied erfolgreich angelegt',
      data: {
        mitglied_id: newMitgliedId,
        mitgliedsnummer: mitgliedsnummer || `ID-${newMitgliedId}`,
        vorname,
        nachname
      }
    });

  } catch (err) {
    logger.error('Fehler beim öffentlichen Mitglied-Anlegen:', { error: err });
    res.status(500).json({ success: false, error: 'Serverfehler beim Anlegen des Mitglieds' });
  }
});

// POST /api/public/iban-validate - IBAN validieren (öffentlich)
router.post('/iban-validate', async (req, res) => {
  try {
    const { iban } = req.body;

    if (!iban) {
      return res.json({ valid: false, error: 'IBAN fehlt' });
    }

    // IBAN Format prüfen (DE + 20 Zeichen)
    const cleanIban = iban.replace(/\s/g, '').toUpperCase();
    if (!/^DE\d{20}$/.test(cleanIban)) {
      return res.json({ valid: false, error: 'Ungültiges IBAN-Format' });
    }

    // IBAN Prüfziffer validieren
    const rearranged = cleanIban.slice(4) + cleanIban.slice(0, 4);
    const numericIban = rearranged.split('').map(char => {
      const code = char.charCodeAt(0);
      return code >= 65 ? (code - 55).toString() : char;
    }).join('');

    let remainder = 0;
    for (let i = 0; i < numericIban.length; i++) {
      remainder = (remainder * 10 + parseInt(numericIban[i])) % 97;
    }

    if (remainder !== 1) {
      return res.json({ valid: false, error: 'Ungültige IBAN-Prüfziffer' });
    }

    // BIC aus BLZ ermitteln (erste 8 Ziffern nach DE + Prüfziffer)
    const blz = cleanIban.substring(4, 12);

    res.json({
      valid: true,
      iban: cleanIban,
      blz,
      formatted: cleanIban.replace(/(.{4})/g, '$1 ').trim()
    });

  } catch (err) {
    logger.error('Fehler bei IBAN-Validierung:', { error: err });
    res.status(500).json({ valid: false, error: 'Serverfehler' });
  }
});

module.exports = router;