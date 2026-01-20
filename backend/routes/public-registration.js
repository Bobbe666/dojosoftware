// Backend/routes/public-registration.js - Öffentliche Mitglieder-Registrierung
const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

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
router.post('/register/step1', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email und Passwort sind erforderlich'
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

    // Verification Token generieren
    const verificationToken = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Stunden

    // SECURITY: Passwort hashen (12 Rounds für Sicherheit)
    const passwordHash = await bcrypt.hash(password, 12);

    // In Registrierungs-Tabelle einfügen
    await queryAsync(`
      INSERT INTO registrierungen (
        email, password_hash, verification_token, token_expires_at, status, created_at
      ) VALUES (?, ?, ?, ?, 'email_pending', NOW())
    `, [email, passwordHash, verificationToken, expiresAt]);

    logger.info('Neue Registrierung gestartet', { email });

    // TODO: Email mit Verifizierungslink senden
    res.json({
      success: true,
      message: 'Registrierung gestartet. Bitte prüfen Sie Ihre E-Mails.',
      data: {
        email,
        nextStep: 'email_verification'
      }
    });

  } catch (err) {
    console.error('Fehler bei Registrierung Schritt 1:', err);
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
    console.error('Fehler bei Email-Verifizierung:', err);
    res.status(500).json({ success: false, error: 'Serverfehler bei der Verifizierung' });
  }
});

// POST /api/public/register/step2 - Schritt 2: Persönliche Daten
router.post('/register/step2', async (req, res) => {
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
    res.json({
      success: true,
      message: 'Persönliche Daten erfolgreich gespeichert',
      data: {
        email,
        nextStep: 'bank_data'
      }
    });

  } catch (err) {
    console.error('Fehler bei Schritt 2:', err);
    res.status(500).json({ success: false, error: 'Serverfehler beim Speichern der persönlichen Daten' });
  }
});

// POST /api/public/register/step3 - Schritt 3: Bankdaten
router.post('/register/step3', async (req, res) => {
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
    console.error('Fehler bei Schritt 3:', err);
    res.status(500).json({ success: false, error: 'Serverfehler beim Speichern der Bankdaten' });
  }
});

// POST /api/public/register/step4 - Schritt 4: Tarifauswahl
router.post('/register/step4', async (req, res) => {
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
    console.error('Fehler bei Schritt 4:', err);
    res.status(500).json({ success: false, error: 'Serverfehler beim Speichern der Tarifauswahl' });
  }
});

// POST /api/public/register/step5 - Schritt 5: Gesundheitsfragen
router.post('/register/step5', async (req, res) => {
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
    `, [JSON.stringify(gesundheitsfragen), registration[0].id]);
    res.json({
      success: true,
      message: 'Gesundheitsfragen erfolgreich gespeichert',
      data: {
        email,
        nextStep: 'legal_agreements'
      }
    });

  } catch (err) {
    console.error('Fehler bei Schritt 5:', err);
    res.status(500).json({ success: false, error: 'Serverfehler beim Speichern der Gesundheitsfragen' });
  }
});

// POST /api/public/register/step6 - Schritt 6: Rechtliche Zustimmungen
router.post('/register/step6', async (req, res) => {
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
        console.error('Fehler beim Laden der Tarif-Details:', err);
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

    await queryAsync(`
      INSERT INTO notifications (type, recipient, subject, message, status, created_at)
      VALUES ('admin_alert', 'admin', 'Neue Mitglieder-Registrierung', ?, 'unread', NOW())
    `, [notificationMessage]);

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
    console.error('Fehler bei Schritt 6:', err);
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
    console.error('Fehler beim Abrufen des Registrierungsstatus:', err);
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
    console.error('Fehler beim Hinzufügen des Familienmitglieds:', err);
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
    console.error('Fehler beim Abrufen der Familienmitglieder:', err);
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
    console.error('Fehler beim Entfernen des Familienmitglieds:', err);
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

// GET /api/public/tarife - Öffentlich verfügbare Tarife
router.get('/tarife', async (req, res) => {
  try {
    const tarife = await queryAsync(`
      SELECT id, name, price_cents, currency, duration_months, billing_cycle, payment_method,
             altersgruppe, mindestlaufzeit_monate
      FROM tarife
      WHERE active = 1 AND (ist_archiviert IS NULL OR ist_archiviert = 0)
      ORDER BY altersgruppe ASC, price_cents ASC
    `);

    const tarifeFormatted = tarife.map(tarif => ({
      ...tarif,
      price_euros: (tarif.price_cents / 100).toFixed(2),
      beschreibung: tarif.altersgruppe
        ? `${tarif.altersgruppe} - ${tarif.duration_months || tarif.mindestlaufzeit_monate || 12} Monate Laufzeit`
        : `${tarif.duration_months || tarif.mindestlaufzeit_monate || 12} Monate Laufzeit`
    }));

    res.json({ success: true, data: tarifeFormatted });

  } catch (err) {
    console.error('Fehler beim Abrufen der öffentlichen Tarife:', err);
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

module.exports = router;