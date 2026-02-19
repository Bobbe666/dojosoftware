// ============================================================================
// TDA TURNIERE API - Webhook & Frontend API
// Backend/routes/tda-turniere.js
// Datum: 2026-01-14
// ============================================================================

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// ============================================================================
// HELPER FUNKTIONEN
// ============================================================================

/**
 * Konvertiert ISO-Datum oder beliebiges Datumsformat zu MySQL DATE (YYYY-MM-DD)
 * @param {string|Date} dateValue - Das zu konvertierende Datum
 * @returns {string|null} - MySQL-kompatibles Datum oder null
 */
function toMySQLDate(dateValue) {
  if (!dateValue) return null;

  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return null;

    // Format: YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    logger.warn('Datumskonvertierung fehlgeschlagen', { dateValue, error: error.message });
    return null;
  }
}

// ============================================================================
// WEBHOOK AUTHENTIFIZIERUNG
// ============================================================================

/**
 * Validiert den API-Key für Webhook-Aufrufe von TDA
 */
const validateWebhookKey = (req, res, next) => {
  const webhookKey = req.headers['x-webhook-key'];
  const expectedKey = process.env.TDA_WEBHOOK_KEY;

  if (!expectedKey) {
    logger.error('TDA_WEBHOOK_KEY nicht in .env konfiguriert!');
    return res.status(500).json({ error: 'Webhook nicht konfiguriert' });
  }

  if (!webhookKey || webhookKey !== expectedKey) {
    logger.warn('Ungültiger Webhook-Key:', webhookKey);
    return res.status(401).json({ error: 'Ungültiger API-Key' });
  }

  next();
};

// ============================================================================
// WEBHOOK ENDPOINT - Empfängt Turnier-Daten von TDA
// ============================================================================

/**
 * POST /api/tda-turniere/webhook
 * Empfängt Turnier-Daten von TDA Software
 * Authentifizierung: X-Webhook-Key Header
 */
router.post('/webhook', validateWebhookKey, async (req, res) => {
  try {
    const { action, turnier } = req.body;

    logger.debug(`📨 TDA Webhook empfangen: action=${action}`, turnier);

    if (!action || !turnier) {
      return res.status(400).json({ error: 'action und turnier sind erforderlich' });
    }

    if (!turnier.tda_turnier_id) {
      return res.status(400).json({ error: 'tda_turnier_id ist erforderlich' });
    }

    switch (action) {
      case 'turnier_created':
        await handleTurnierCreated(turnier);
        break;
      case 'turnier_updated':
        await handleTurnierUpdated(turnier);
        break;
      case 'turnier_deleted':
        await handleTurnierDeleted(turnier.tda_turnier_id);
        break;
      default:
        logger.warn('Unbekannte Webhook-Action: ${action}');
        return res.status(400).json({ error: `Unbekannte Action: ${action}` });
    }

    res.json({ success: true, message: `Action ${action} erfolgreich verarbeitet` });
  } catch (error) {
    logger.error('Webhook-Fehler:', error);
    res.status(500).json({ error: 'Interner Fehler beim Verarbeiten des Webhooks' });
  }
});

/**
 * Verarbeitet ein neu erstelltes Turnier
 */
async function handleTurnierCreated(turnier) {
  // Konvertiere alle Datumsfelder zu MySQL-Format (YYYY-MM-DD)
  const datum = toMySQLDate(turnier.datum);
  const datumEnde = toMySQLDate(turnier.datum_ende);
  const anmeldeschluss = toMySQLDate(turnier.anmeldeschluss);

  if (!datum) {
    logger.error('Ungültiges Datum für Turnier:', turnier.name, turnier.datum);
    throw new Error('Ungültiges Turnierdatum');
  }

  // 1. Turnier in Datenbank speichern
  const [result] = await db.promise().query(`
    INSERT INTO tda_turniere (
      tda_turnier_id, name, datum, datum_ende, ort, adresse, disziplin,
      anmeldeschluss, status, veroeffentlicht, beschreibung, max_teilnehmer, teilnahmegebuehr,
      tda_registration_url, veranstalter, kontakt_email, kontakt_telefon,
      altersklassen, gewichtsklassen, bild_url, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      datum = VALUES(datum),
      datum_ende = VALUES(datum_ende),
      ort = VALUES(ort),
      adresse = VALUES(adresse),
      disziplin = VALUES(disziplin),
      anmeldeschluss = VALUES(anmeldeschluss),
      status = VALUES(status),
      veroeffentlicht = VALUES(veroeffentlicht),
      beschreibung = VALUES(beschreibung),
      max_teilnehmer = VALUES(max_teilnehmer),
      teilnahmegebuehr = VALUES(teilnahmegebuehr),
      tda_registration_url = VALUES(tda_registration_url),
      veranstalter = VALUES(veranstalter),
      kontakt_email = VALUES(kontakt_email),
      kontakt_telefon = VALUES(kontakt_telefon),
      altersklassen = VALUES(altersklassen),
      gewichtsklassen = VALUES(gewichtsklassen),
      bild_url = VALUES(bild_url),
      synced_at = NOW()
  `, [
    turnier.tda_turnier_id,
    turnier.name,
    datum,
    datumEnde,
    turnier.ort || null,
    turnier.adresse || null,
    turnier.disziplin || null,
    anmeldeschluss,
    turnier.status || 'Aktiv',
    turnier.veroeffentlicht !== undefined ? turnier.veroeffentlicht : 1,
    turnier.beschreibung || null,
    turnier.max_teilnehmer || null,
    turnier.teilnahmegebuehr || null,
    turnier.registration_url || turnier.tda_registration_url || null,
    turnier.veranstalter || null,
    turnier.kontakt_email || null,
    turnier.kontakt_telefon || null,
    turnier.altersklassen || null,
    turnier.gewichtsklassen || null,
    turnier.bild_url || null
  ]);

  logger.info('Turnier ${turnier.name} (ID: ${turnier.tda_turnier_id}) gespeichert');

  // 2. Push-Benachrichtigung an alle Mitglieder senden (deaktiviert für Bulk-Sync)
  // await sendTurnierNotificationToAll(turnier);
}

/**
 * Verarbeitet ein aktualisiertes Turnier
 */
async function handleTurnierUpdated(turnier) {
  // Konvertiere alle Datumsfelder zu MySQL-Format (YYYY-MM-DD)
  const datum = toMySQLDate(turnier.datum);
  const datumEnde = toMySQLDate(turnier.datum_ende);
  const anmeldeschluss = toMySQLDate(turnier.anmeldeschluss);

  const [result] = await db.promise().query(`
    UPDATE tda_turniere SET
      name = ?,
      datum = ?,
      datum_ende = ?,
      ort = ?,
      adresse = ?,
      disziplin = ?,
      anmeldeschluss = ?,
      status = ?,
      veroeffentlicht = ?,
      beschreibung = ?,
      max_teilnehmer = ?,
      teilnahmegebuehr = ?,
      tda_registration_url = ?,
      veranstalter = ?,
      kontakt_email = ?,
      kontakt_telefon = ?,
      altersklassen = ?,
      gewichtsklassen = ?,
      bild_url = ?,
      synced_at = NOW()
    WHERE tda_turnier_id = ?
  `, [
    turnier.name,
    datum,
    datumEnde,
    turnier.ort || null,
    turnier.adresse || null,
    turnier.disziplin || null,
    anmeldeschluss,
    turnier.status || 'Aktiv',
    turnier.veroeffentlicht !== undefined ? turnier.veroeffentlicht : 1,
    turnier.beschreibung || null,
    turnier.max_teilnehmer || null,
    turnier.teilnahmegebuehr || null,
    turnier.registration_url || turnier.tda_registration_url || null,
    turnier.veranstalter || null,
    turnier.kontakt_email || null,
    turnier.kontakt_telefon || null,
    turnier.altersklassen || null,
    turnier.gewichtsklassen || null,
    turnier.bild_url || null,
    turnier.tda_turnier_id
  ]);

  logger.info('Turnier ${turnier.name} (ID: ${turnier.tda_turnier_id}) aktualisiert');
}

/**
 * Verarbeitet ein gelöschtes Turnier
 */
async function handleTurnierDeleted(tdaTurnierId) {
  // 1. Hole Turnierdaten vor dem Löschen für Benachrichtigung
  const [turnierData] = await db.promise().query(
    'SELECT name, datum, ort FROM tda_turniere WHERE tda_turnier_id = ?',
    [tdaTurnierId]
  );

  const turnierName = turnierData.length > 0 ? turnierData[0].name : `Turnier #${tdaTurnierId}`;
  const turnierDatum = turnierData.length > 0 ? turnierData[0].datum : null;
  const turnierOrt = turnierData.length > 0 ? turnierData[0].ort : null;

  // 2. Turnier aus Datenbank löschen
  const [result] = await db.promise().query(
    'DELETE FROM tda_turniere WHERE tda_turnier_id = ?',
    [tdaTurnierId]
  );

  if (result.affectedRows > 0) {
    logger.info('Turnier gelöscht', { name: turnierName, tdaTurnierId });

    // 3. Benachrichtigung an alle Mitglieder senden
    await sendTurnierDeletedNotification(turnierName, turnierDatum, turnierOrt);
  } else {
    logger.debug('⚠️ Turnier mit TDA-ID ${tdaTurnierId} war nicht in der Datenbank');
  }
}

/**
 * Sendet Benachrichtigung über gelöschtes Turnier an alle Mitglieder
 */
async function sendTurnierDeletedNotification(turnierName, turnierDatum, turnierOrt) {
  try {
    // Hole alle aktiven Mitglieder
    const [mitglieder] = await db.promise().query(`
      SELECT mitglied_id, email
      FROM mitglieder
      WHERE aktiv = 1
    `);

    if (mitglieder.length === 0) {
      logger.debug('ℹ️ Keine aktiven Mitglieder für Benachrichtigung gefunden');
      return;
    }

    logger.debug('📧 Sende Turnier-Absage-Benachrichtigung an ${mitglieder.length} Mitglieder...');

    // Formatiere Datum falls vorhanden
    let datumText = '';
    if (turnierDatum) {
      datumText = new Date(turnierDatum).toLocaleDateString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    const notificationSubject = `Turnier abgesagt: ${turnierName}`;
    const notificationMessage = `Das Turnier "${turnierName}"${datumText ? ` am ${datumText}` : ''}${turnierOrt ? ` in ${turnierOrt}` : ''} wurde abgesagt bzw. aus dem Programm genommen.`;

    // Erstelle Notifications in Batches
    const batchSize = 100;
    for (let i = 0; i < mitglieder.length; i += batchSize) {
      const batch = mitglieder.slice(i, i + batchSize);

      const values = batch.map(m => [
        m.mitglied_id,
        m.email,
        'info',
        notificationSubject,
        notificationMessage,
        '/member/events?tab=turniere',
        'sent',
        new Date()
      ]);

      if (values.length > 0) {
        await db.promise().query(`
          INSERT INTO notifications (mitglied_id, recipient, type, subject, message, link, status, created_at)
          VALUES ?
        `, [values]);
      }
    }

    logger.info('${mitglieder.length} Absage-Benachrichtigungen erstellt');
  } catch (error) {
    logger.error('Fehler beim Senden der Absage-Benachrichtigungen:', error);
    // Fehler bei Benachrichtigungen sollte nicht den Löschvorgang verhindern
  }
}

/**
 * Sendet Push-Benachrichtigung an alle Mitglieder (alle Dojos)
 */
async function sendTurnierNotificationToAll(turnier) {
  try {
    // Hole alle aktiven Mitglieder aus allen Dojos
    const [mitglieder] = await db.promise().query(`
      SELECT mitglied_id, email, vorname, nachname
      FROM mitglieder
      WHERE aktiv = 1
    `);

    logger.debug('📧 Sende Turnier-Benachrichtigung an ${mitglieder.length} Mitglieder...');

    // Formatiere Datum für deutsche Anzeige
    const datumFormatiert = new Date(turnier.datum).toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const notificationMessage = `Neues TDA Turnier: ${turnier.name} am ${datumFormatiert}`;
    const notificationDetails = `${turnier.beschreibung || 'Jetzt anmelden!'} ${turnier.ort ? `Ort: ${turnier.ort}` : ''}`;

    // Erstelle Notifications in Batches (für Performance)
    const batchSize = 100;
    for (let i = 0; i < mitglieder.length; i += batchSize) {
      const batch = mitglieder.slice(i, i + batchSize);

      const values = batch.map(m => [
        m.mitglied_id,
        m.email,
        'push',
        notificationMessage,
        notificationDetails,
        '/member/events?tab=turniere',
        'sent'
      ]);

      if (values.length > 0) {
        await db.promise().query(`
          INSERT INTO notifications (mitglied_id, recipient, type, subject, message, link, status, created_at)
          VALUES ?
        `, [values.map(v => [...v, new Date()])]);
      }
    }

    logger.info('${mitglieder.length} Turnier-Benachrichtigungen erstellt');
  } catch (error) {
    logger.error('Fehler beim Senden der Turnier-Benachrichtigungen:', error);
    // Fehler bei Benachrichtigungen sollte nicht den Webhook-Erfolg verhindern
  }
}

// ============================================================================
// FRONTEND API ENDPOINTS
// ============================================================================

/**
 * GET /api/tda-turniere
 * Holt alle TDA-Turniere für das Frontend
 * Authentifizierung: JWT Token erforderlich
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { upcoming, status, disziplin, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        id,
        tda_turnier_id,
        name,
        datum,
        datum_ende,
        ort,
        adresse,
        disziplin,
        anmeldeschluss,
        status,
        veroeffentlicht,
        beschreibung,
        max_teilnehmer,
        teilnahmegebuehr,
        tda_registration_url,
        veranstalter,
        kontakt_email,
        kontakt_telefon,
        altersklassen,
        gewichtsklassen,
        bild_url,
        synced_at,
        created_at
      FROM tda_turniere
      WHERE (veroeffentlicht = 1 OR veroeffentlicht IS NULL)
    `;

    const params = [];

    // Filter: Nur kommende Turniere
    if (upcoming === 'true') {
      query += ' AND datum >= CURDATE()';
    }

    // Filter: Nach Status
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    // Filter: Nach Disziplin
    if (disziplin) {
      query += ' AND disziplin LIKE ?';
      params.push(`%${disziplin}%`);
    }

    // Sortierung und Pagination
    query += ' ORDER BY datum ASC, name ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [turniere] = await db.promise().query(query, params);

    // Berechne ob Anmeldung noch möglich ist
    const turniereWithStatus = turniere.map(turnier => ({
      ...turnier,
      anmeldung_moeglich: turnier.anmeldeschluss
        ? new Date(turnier.anmeldeschluss) >= new Date()
        : true,
      ist_vergangen: new Date(turnier.datum) < new Date()
    }));

    res.json({
      success: true,
      turniere: turniereWithStatus,
      total: turniereWithStatus.length
    });
  } catch (error) {
    logger.error('Fehler beim Abrufen der TDA-Turniere:', error);
    res.status(500).json({
      error: 'Fehler beim Abrufen der Turniere',
      details: error.message
    });
  }
});

/**
 * GET /api/tda-turniere/:id
 * Holt ein einzelnes Turnier mit Details
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const turnierId = req.params.id;

    const [turniere] = await db.promise().query(`
      SELECT * FROM tda_turniere WHERE id = ? OR tda_turnier_id = ?
    `, [turnierId, turnierId]);

    if (turniere.length === 0) {
      return res.status(404).json({ error: 'Turnier nicht gefunden' });
    }

    const turnier = turniere[0];
    turnier.anmeldung_moeglich = turnier.anmeldeschluss
      ? new Date(turnier.anmeldeschluss) >= new Date()
      : true;
    turnier.ist_vergangen = new Date(turnier.datum) < new Date();

    res.json({
      success: true,
      turnier
    });
  } catch (error) {
    logger.error('Fehler beim Abrufen des Turniers:', error);
    res.status(500).json({
      error: 'Fehler beim Abrufen des Turniers',
      details: error.message
    });
  }
});

/**
 * GET /api/tda-turniere/stats/overview
 * Statistiken über TDA-Turniere
 */
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const [stats] = await db.promise().query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN datum >= CURDATE() THEN 1 END) as upcoming,
        COUNT(CASE WHEN datum < CURDATE() THEN 1 END) as past,
        COUNT(CASE WHEN status = 'Aktiv' AND datum >= CURDATE() THEN 1 END) as active
      FROM tda_turniere
    `);

    res.json({
      success: true,
      stats: stats[0]
    });
  } catch (error) {
    logger.error('Fehler beim Abrufen der Turnier-Statistiken:', error);
    res.status(500).json({
      error: 'Fehler beim Abrufen der Statistiken',
      details: error.message
    });
  }
});

// ============================================================================
// ADMIN ENDPOINTS (für manuelles Sync/Testing)
// ============================================================================

/**
 * POST /api/tda-turniere/sync
 * Manueller Sync-Trigger (für Admin-Bereich)
 * Aktualisiert synced_at für alle Turniere
 */
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    // Prüfe Admin-Berechtigung
    const userRole = req.user?.role || req.user?.rolle;
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Nur für Administratoren' });
    }

    await db.promise().query(`
      UPDATE tda_turniere SET synced_at = NOW()
    `);

    res.json({
      success: true,
      message: 'Sync-Zeitstempel aktualisiert'
    });
  } catch (error) {
    logger.error('Fehler beim Sync:', error);
    res.status(500).json({ error: 'Fehler beim Synchronisieren' });
  }
});

/**
 * DELETE /api/tda-turniere/:id
 * Löscht ein Turnier (nur Admin)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Prüfe Admin-Berechtigung
    const userRole = req.user?.role || req.user?.rolle;
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Nur für Administratoren' });
    }

    const turnierId = req.params.id;

    const [result] = await db.promise().query(
      'DELETE FROM tda_turniere WHERE id = ?',
      [turnierId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Turnier nicht gefunden' });
    }

    res.json({
      success: true,
      message: 'Turnier erfolgreich gelöscht'
    });
  } catch (error) {
    logger.error('Fehler beim Löschen des Turniers:', error);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

module.exports = router;
