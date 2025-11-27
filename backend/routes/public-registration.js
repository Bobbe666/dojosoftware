// Backend/routes/public-registration.js - Öffentliche Mitglieder-Registrierung
const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

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

    // In Registrierungs-Tabelle einfügen
    await queryAsync(`
      INSERT INTO registrierungen (
        email, password_hash, verification_token, token_expires_at, status, created_at
      ) VALUES (?, ?, ?, ?, 'email_pending', NOW())
    `, [email, password, verificationToken, expiresAt]);

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

// GET /api/public/tarife - Öffentlich verfügbare Tarife
router.get('/tarife', async (req, res) => {
  try {
    const tarife = await queryAsync(`
      SELECT id, name, price_cents, currency, duration_months, billing_cycle, payment_method
      FROM tarife
      WHERE active = 1
      ORDER BY price_cents ASC
    `);

    const tarifeFormatted = tarife.map(tarif => ({
      ...tarif,
      price_euros: (tarif.price_cents / 100).toFixed(2)
    }));

    res.json({ success: true, data: tarifeFormatted });

  } catch (err) {
    console.error('Fehler beim Abrufen der öffentlichen Tarife:', err);
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

module.exports = router;