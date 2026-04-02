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

  logger.info(`Turnier ${turnier.name} (ID: ${turnier.tda_turnier_id}) gespeichert`);

  // 2. In-App-Benachrichtigung an alle Mitglieder senden
  await sendTurnierNotificationToAll(turnier);
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

  logger.info(`Turnier ${turnier.name} (ID: ${turnier.tda_turnier_id}) aktualisiert`);
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
 * Sendet In-App-Benachrichtigung über gelöschtes Turnier an alle Mitglieder
 */
async function sendTurnierDeletedNotification(turnierName, turnierDatum, turnierOrt) {
  try {
    const [mitglieder] = await db.promise().query(
      'SELECT mitglied_id, dojo_id FROM mitglieder WHERE aktiv = 1'
    );

    if (mitglieder.length === 0) return;

    let datumText = '';
    if (turnierDatum) {
      datumText = new Date(turnierDatum).toLocaleDateString('de-DE', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }

    const titel = `Turnier abgesagt: ${turnierName}`;
    const nachricht = `Das Turnier "${turnierName}"${datumText ? ` am ${datumText}` : ''}${turnierOrt ? ` in ${turnierOrt}` : ''} wurde abgesagt.`;

    const batchSize = 100;
    for (let i = 0; i < mitglieder.length; i += batchSize) {
      const batch = mitglieder.slice(i, i + batchSize);
      const values = batch.map(m => [m.mitglied_id, m.dojo_id, 'info', titel, nachricht, null]);
      await db.promise().query(
        'INSERT INTO mitglied_nachrichten (mitglied_id, dojo_id, typ, titel, nachricht, referenz_id) VALUES ?',
        [values]
      );
    }

    logger.info(`${mitglieder.length} Absage-Benachrichtigungen erstellt`);
  } catch (error) {
    logger.error('Fehler beim Senden der Absage-Benachrichtigungen:', error);
  }
}

/**
 * Sendet In-App-Benachrichtigung über neues Turnier an alle Mitglieder
 */
async function sendTurnierNotificationToAll(turnier) {
  try {
    const [mitglieder] = await db.promise().query(
      'SELECT mitglied_id, dojo_id FROM mitglieder WHERE aktiv = 1'
    );

    if (mitglieder.length === 0) return;

    logger.debug(`📬 Sende Turnier-Benachrichtigung an ${mitglieder.length} Mitglieder...`);

    const datumFormatiert = new Date(turnier.datum).toLocaleDateString('de-DE', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const titel = `Neues Turnier: ${turnier.name}`;
    const nachricht = `${turnier.name} findet am ${datumFormatiert}${turnier.ort ? ` in ${turnier.ort}` : ''} statt. Jetzt unter Events anmelden!`;

    const batchSize = 100;
    for (let i = 0; i < mitglieder.length; i += batchSize) {
      const batch = mitglieder.slice(i, i + batchSize);
      const values = batch.map(m => [m.mitglied_id, m.dojo_id, 'info', titel, nachricht, turnier.tda_turnier_id]);
      await db.promise().query(
        'INSERT INTO mitglied_nachrichten (mitglied_id, dojo_id, typ, titel, nachricht, referenz_id) VALUES ?',
        [values]
      );
    }

    logger.info(`${mitglieder.length} Turnier-Benachrichtigungen erstellt`);
  } catch (error) {
    logger.error('Fehler beim Senden der Turnier-Benachrichtigungen:', error);
  }
}

// ============================================================================
// FRONTEND API ENDPOINTS
// ============================================================================

// ============================================================================
// ANMELDUNGEN ENDPOINTS
// ============================================================================

/**
 * POST /api/tda-turniere/:tdaTurnierId/anmelden
 * Mitglied meldet sich für ein TDA-Turnier an (intern tracken)
 */
router.post('/:tdaTurnierId/anmelden', authenticateToken, async (req, res) => {
  try {
    const tdaTurnierId = parseInt(req.params.tdaTurnierId);
    const mitgliedId = req.user?.mitglied_id;

    if (!mitgliedId) {
      return res.status(400).json({ error: 'Nur Mitglieder können sich anmelden' });
    }

    // Turnier prüfen
    const [turniere] = await db.promise().query(
      'SELECT tda_turnier_id, name, dojo_id FROM tda_turniere WHERE tda_turnier_id = ?',
      [tdaTurnierId]
    );
    if (turniere.length === 0) {
      return res.status(404).json({ error: 'Turnier nicht gefunden' });
    }

    // dojo_id des Mitglieds ermitteln
    const [mitglied] = await db.promise().query(
      'SELECT dojo_id FROM mitglieder WHERE mitglied_id = ?',
      [mitgliedId]
    );
    if (mitglied.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    // Anmeldung erstellen (DUPLICATE KEY = bereits angemeldet → ignorieren)
    await db.promise().query(
      `INSERT INTO tda_turnier_anmeldungen (mitglied_id, dojo_id, tda_turnier_id, status)
       VALUES (?, ?, ?, 'angemeldet')
       ON DUPLICATE KEY UPDATE aktualisiert_am = NOW()`,
      [mitgliedId, mitglied[0].dojo_id, tdaTurnierId]
    );

    res.json({ success: true, message: 'Anmeldung erfolgreich registriert', status: 'angemeldet' });
  } catch (error) {
    logger.error('Fehler bei TDA-Turnier-Anmeldung:', error);
    res.status(500).json({ error: 'Fehler bei der Anmeldung' });
  }
});

/**
 * GET /api/tda-turniere/meine-anmeldungen
 * Gibt die TDA-Turnier-Anmeldungen des aktuellen Mitglieds zurück
 */
router.get('/meine-anmeldungen', authenticateToken, async (req, res) => {
  try {
    const mitgliedId = req.user?.mitglied_id;
    if (!mitgliedId) {
      return res.json({ success: true, anmeldungen: [] });
    }

    const [anmeldungen] = await db.promise().query(
      `SELECT tta.id, tta.tda_turnier_id, tta.status, tta.erstellt_am,
              t.name, t.datum, t.ort
       FROM tda_turnier_anmeldungen tta
       JOIN tda_turniere t ON tta.tda_turnier_id = t.tda_turnier_id
       WHERE tta.mitglied_id = ?
       ORDER BY t.datum ASC`,
      [mitgliedId]
    );

    res.json({ success: true, anmeldungen });
  } catch (error) {
    logger.error('Fehler beim Laden der eigenen TDA-Anmeldungen:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Anmeldungen' });
  }
});

/**
 * GET /api/tda-turniere/alle-anmeldungen
 * Admin: Alle TDA-Turnier-Anmeldungen mit Mitglied- und Turnierinfo
 */
router.get('/alle-anmeldungen', authenticateToken, async (req, res) => {
  try {
    const { getSecureDojoId } = require('../utils/dojo-filter-helper');
    const secureDojoId = getSecureDojoId(req);

    let whereClause = '';
    const params = [];
    if (secureDojoId) {
      whereClause = 'WHERE tta.dojo_id = ?';
      params.push(secureDojoId);
    }

    const [anmeldungen] = await db.promise().query(
      `SELECT tta.id, tta.mitglied_id, tta.tda_turnier_id, tta.status, tta.bemerkung, tta.erstellt_am,
              m.vorname, m.nachname, m.email,
              t.name as turnier_name, t.datum, t.ort
       FROM tda_turnier_anmeldungen tta
       JOIN mitglieder m ON tta.mitglied_id = m.mitglied_id
       JOIN tda_turniere t ON tta.tda_turnier_id = t.tda_turnier_id
       ${whereClause}
       ORDER BY t.datum ASC, m.nachname ASC, m.vorname ASC`,
      params
    );

    res.json({ success: true, anmeldungen });
  } catch (error) {
    logger.error('Fehler beim Laden aller TDA-Anmeldungen:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Anmeldungen' });
  }
});

/**
 * PATCH /api/tda-turniere/anmeldungen/:id/status
 * Admin: Anmeldestatus ändern (angemeldet / bestaetigt / abgelehnt)
 */
router.patch('/anmeldungen/:id/status', authenticateToken, async (req, res) => {
  try {
    const anmeldungId = parseInt(req.params.id);
    const { status, bemerkung } = req.body;
    const erlaubteStatus = ['angemeldet', 'bestaetigt', 'abgelehnt'];

    if (!erlaubteStatus.includes(status)) {
      return res.status(400).json({ error: 'Ungültiger Status' });
    }

    const { getSecureDojoId } = require('../utils/dojo-filter-helper');
    const secureDojoId = getSecureDojoId(req);

    const dojoFilter = secureDojoId ? 'AND dojo_id = ?' : '';
    const params = [status, bemerkung || null, anmeldungId];
    if (secureDojoId) params.push(secureDojoId);

    const [result] = await db.promise().query(
      `UPDATE tda_turnier_anmeldungen SET status = ?, bemerkung = ? WHERE id = ? ${dojoFilter}`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Anmeldung nicht gefunden' });
    }

    // Mitglied bei Ablehnung benachrichtigen
    if (status === 'abgelehnt') {
      const [anm] = await db.promise().query(
        `SELECT tta.mitglied_id, tta.dojo_id, t.name as turnier_name
         FROM tda_turnier_anmeldungen tta
         JOIN tda_turniere t ON tta.tda_turnier_id = t.tda_turnier_id
         WHERE tta.id = ?`,
        [anmeldungId]
      );
      if (anm.length > 0) {
        await db.promise().query(
          `INSERT INTO mitglied_nachrichten (mitglied_id, dojo_id, typ, titel, nachricht)
           VALUES (?, ?, 'info', ?, ?)`,
          [
            anm[0].mitglied_id,
            anm[0].dojo_id,
            `Turnier-Anmeldung abgelehnt`,
            `Deine Anmeldung für "${anm[0].turnier_name}" wurde leider abgelehnt.${bemerkung ? ` Hinweis: ${bemerkung}` : ''}`
          ]
        );
      }
    }

    res.json({ success: true, message: 'Status aktualisiert' });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren des Anmeldestatus:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

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
      WHERE 1=1
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
