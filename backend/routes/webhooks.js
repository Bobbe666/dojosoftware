// ============================================================================
// WEBHOOK SYSTEM - Zapier & externe Integrationen
// Backend/routes/webhooks.js
// ============================================================================

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');

// ============================================================================
// WEBHOOK EVENTS - Verfügbare Trigger
// ============================================================================

const WEBHOOK_EVENTS = {
  // Mitglieder
  'member.created': 'Neues Mitglied angelegt',
  'member.updated': 'Mitglied aktualisiert',
  'member.deleted': 'Mitglied gelöscht',
  'member.status_changed': 'Mitgliedsstatus geändert',

  // Zahlungen
  'payment.received': 'Zahlung eingegangen',
  'payment.failed': 'Zahlung fehlgeschlagen',
  'invoice.created': 'Rechnung erstellt',
  'invoice.paid': 'Rechnung bezahlt',

  // Verträge
  'contract.created': 'Vertrag erstellt',
  'contract.signed': 'Vertrag unterschrieben',
  'contract.cancelled': 'Vertrag gekündigt',

  // Events
  'event.created': 'Event erstellt',
  'event.registration': 'Event-Anmeldung',
  'event.cancellation': 'Event-Abmeldung',

  // Anwesenheit
  'attendance.checkin': 'Check-in erfolgt',
  'attendance.checkout': 'Check-out erfolgt',

  // Prüfungen
  'exam.passed': 'Prüfung bestanden',
  'exam.scheduled': 'Prüfung geplant',

  // Badges
  'badge.awarded': 'Badge verliehen'
};

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

/**
 * Generiert einen sicheren Webhook-Secret
 */
function generateWebhookSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generiert eine Signatur für Webhook-Payload
 */
function generateSignature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}

/**
 * Sendet einen Webhook an eine URL
 */
async function sendWebhook(webhook, eventType, payload) {
  const timestamp = Date.now();
  const fullPayload = {
    event: eventType,
    timestamp,
    data: payload
  };

  const signature = generateSignature(fullPayload, webhook.secret);

  try {
    const response = await axios.post(webhook.url, fullPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp,
        'X-Webhook-Event': eventType,
        'User-Agent': 'DojoSoftware-Webhook/1.0'
      },
      timeout: 10000 // 10 Sekunden Timeout
    });

    // Erfolg loggen
    await logWebhookDelivery(webhook.id, eventType, 'success', response.status, null);
    return { success: true, status: response.status };

  } catch (error) {
    const errorMessage = error.response?.data || error.message;
    const statusCode = error.response?.status || 0;

    // Fehler loggen
    await logWebhookDelivery(webhook.id, eventType, 'failed', statusCode, errorMessage);

    return { success: false, status: statusCode, error: errorMessage };
  }
}

/**
 * Loggt eine Webhook-Zustellung
 */
async function logWebhookDelivery(webhookId, eventType, status, httpStatus, errorMessage) {
  try {
    await db.promise().query(`
      INSERT INTO webhook_deliveries (webhook_id, event_type, status, http_status, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [webhookId, eventType, status, httpStatus, errorMessage ? JSON.stringify(errorMessage) : null]);
  } catch (err) {
    logger.error('Fehler beim Loggen der Webhook-Zustellung:', { error: err });
  }
}

/**
 * Triggert alle Webhooks für ein Event
 */
async function triggerWebhooks(eventType, dojoId, payload) {
  try {
    // Alle aktiven Webhooks für dieses Event und Dojo laden
    const [webhooks] = await db.promise().query(`
      SELECT * FROM webhooks
      WHERE dojo_id = ? AND active = 1 AND JSON_CONTAINS(events, ?)
    `, [dojoId, JSON.stringify(eventType)]);

    if (webhooks.length === 0) {
      return { triggered: 0 };
    }

    const results = [];
    for (const webhook of webhooks) {
      const result = await sendWebhook(webhook, eventType, payload);
      results.push({ webhook_id: webhook.id, ...result });
    }

    return { triggered: webhooks.length, results };

  } catch (error) {
    logger.error('Fehler beim Triggern der Webhooks:', { error: error });
    return { triggered: 0, error: error.message };
  }
}

// Exportiere die Trigger-Funktion für andere Module
module.exports.triggerWebhooks = triggerWebhooks;

// ============================================================================
// API ROUTEN
// ============================================================================

router.use(authenticateToken);

/**
 * GET /api/webhooks/events
 * Liste aller verfügbaren Webhook-Events
 */
router.get('/events', (req, res) => {
  res.json({
    events: Object.entries(WEBHOOK_EVENTS).map(([key, description]) => ({
      event: key,
      description
    }))
  });
});

/**
 * GET /api/webhooks
 * Liste aller Webhooks des Dojos
 */
router.get('/', async (req, res) => {
  try {
    const dojoId = req.query.dojo_id || req.user.dojo_id;

    const [webhooks] = await db.promise().query(`
      SELECT
        w.*,
        (SELECT COUNT(*) FROM webhook_deliveries wd WHERE wd.webhook_id = w.id AND wd.status = 'success') as success_count,
        (SELECT COUNT(*) FROM webhook_deliveries wd WHERE wd.webhook_id = w.id AND wd.status = 'failed') as failed_count,
        (SELECT created_at FROM webhook_deliveries wd WHERE wd.webhook_id = w.id ORDER BY created_at DESC LIMIT 1) as last_triggered
      FROM webhooks w
      WHERE w.dojo_id = ?
      ORDER BY w.created_at DESC
    `, [dojoId]);

    // Secret maskieren
    const sanitizedWebhooks = webhooks.map(w => ({
      ...w,
      secret: w.secret ? `${w.secret.substring(0, 8)}...` : null,
      events: JSON.parse(w.events || '[]')
    }));

    res.json(sanitizedWebhooks);

  } catch (error) {
    logger.error('Fehler beim Laden der Webhooks:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Webhooks' });
  }
});

/**
 * POST /api/webhooks
 * Neuen Webhook erstellen
 */
router.post('/', async (req, res) => {
  try {
    const { name, url, events, active = true, dojo_id } = req.body;
    const dojoId = dojo_id || req.user.dojo_id;

    // Validierung
    if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Name, URL und mindestens ein Event sind erforderlich' });
    }

    // URL validieren
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Ungültige URL' });
    }

    // Events validieren
    const invalidEvents = events.filter(e => !WEBHOOK_EVENTS[e]);
    if (invalidEvents.length > 0) {
      return res.status(400).json({ error: `Ungültige Events: ${invalidEvents.join(', ')}` });
    }

    // Secret generieren
    const secret = generateWebhookSecret();

    const [result] = await db.promise().query(`
      INSERT INTO webhooks (name, url, secret, events, active, dojo_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [name, url, secret, JSON.stringify(events), active ? 1 : 0, dojoId]);

    res.status(201).json({
      success: true,
      webhook: {
        id: result.insertId,
        name,
        url,
        secret, // Nur bei Erstellung vollständig anzeigen!
        events,
        active
      },
      message: 'Webhook erstellt. Speichern Sie das Secret sicher - es wird nur einmal angezeigt!'
    });

  } catch (error) {
    logger.error('Fehler beim Erstellen des Webhooks:', { error: error });
    res.status(500).json({ error: 'Fehler beim Erstellen des Webhooks' });
  }
});

/**
 * PUT /api/webhooks/:id
 * Webhook aktualisieren
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, events, active } = req.body;
    const dojoId = req.query.dojo_id || req.user.dojo_id;

    // Prüfen ob Webhook existiert und zum Dojo gehört
    const [existing] = await db.promise().query(
      'SELECT * FROM webhooks WHERE id = ? AND dojo_id = ?',
      [id, dojoId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Webhook nicht gefunden' });
    }

    // URL validieren falls angegeben
    if (url) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: 'Ungültige URL' });
      }
    }

    // Events validieren falls angegeben
    if (events) {
      const invalidEvents = events.filter(e => !WEBHOOK_EVENTS[e]);
      if (invalidEvents.length > 0) {
        return res.status(400).json({ error: `Ungültige Events: ${invalidEvents.join(', ')}` });
      }
    }

    await db.promise().query(`
      UPDATE webhooks SET
        name = COALESCE(?, name),
        url = COALESCE(?, url),
        events = COALESCE(?, events),
        active = COALESCE(?, active),
        updated_at = NOW()
      WHERE id = ?
    `, [name, url, events ? JSON.stringify(events) : null, active !== undefined ? (active ? 1 : 0) : null, id]);

    res.json({ success: true, message: 'Webhook aktualisiert' });

  } catch (error) {
    logger.error('Fehler beim Aktualisieren des Webhooks:', { error: error });
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Webhooks' });
  }
});

/**
 * DELETE /api/webhooks/:id
 * Webhook löschen
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const dojoId = req.query.dojo_id || req.user.dojo_id;

    const [result] = await db.promise().query(
      'DELETE FROM webhooks WHERE id = ? AND dojo_id = ?',
      [id, dojoId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Webhook nicht gefunden' });
    }

    // Auch Delivery-Logs löschen
    await db.promise().query('DELETE FROM webhook_deliveries WHERE webhook_id = ?', [id]);

    res.json({ success: true, message: 'Webhook gelöscht' });

  } catch (error) {
    logger.error('Fehler beim Löschen des Webhooks:', { error: error });
    res.status(500).json({ error: 'Fehler beim Löschen des Webhooks' });
  }
});

/**
 * POST /api/webhooks/:id/regenerate-secret
 * Neues Secret generieren
 */
router.post('/:id/regenerate-secret', async (req, res) => {
  try {
    const { id } = req.params;
    const dojoId = req.query.dojo_id || req.user.dojo_id;

    const newSecret = generateWebhookSecret();

    const [result] = await db.promise().query(
      'UPDATE webhooks SET secret = ?, updated_at = NOW() WHERE id = ? AND dojo_id = ?',
      [newSecret, id, dojoId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Webhook nicht gefunden' });
    }

    res.json({
      success: true,
      secret: newSecret,
      message: 'Neues Secret generiert. Speichern Sie es sicher!'
    });

  } catch (error) {
    logger.error('Fehler:', { error: error });
    res.status(500).json({ error: 'Fehler beim Generieren des Secrets' });
  }
});

/**
 * POST /api/webhooks/:id/test
 * Test-Webhook senden
 */
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const dojoId = req.query.dojo_id || req.user.dojo_id;

    const [webhooks] = await db.promise().query(
      'SELECT * FROM webhooks WHERE id = ? AND dojo_id = ?',
      [id, dojoId]
    );

    if (webhooks.length === 0) {
      return res.status(404).json({ error: 'Webhook nicht gefunden' });
    }

    const webhook = webhooks[0];
    const testPayload = {
      test: true,
      message: 'Dies ist ein Test-Webhook von Dojo Software',
      timestamp: new Date().toISOString(),
      webhook_name: webhook.name
    };

    const result = await sendWebhook(webhook, 'test', testPayload);

    res.json({
      success: result.success,
      status: result.status,
      error: result.error,
      message: result.success ? 'Test-Webhook erfolgreich gesendet' : 'Test-Webhook fehlgeschlagen'
    });

  } catch (error) {
    logger.error('Fehler beim Testen des Webhooks:', { error: error });
    res.status(500).json({ error: 'Fehler beim Testen des Webhooks' });
  }
});

/**
 * GET /api/webhooks/:id/deliveries
 * Webhook-Zustellungs-Log
 */
router.get('/:id/deliveries', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const dojoId = req.query.dojo_id || req.user.dojo_id;

    // Prüfen ob Webhook zum Dojo gehört
    const [webhooks] = await db.promise().query(
      'SELECT id FROM webhooks WHERE id = ? AND dojo_id = ?',
      [id, dojoId]
    );

    if (webhooks.length === 0) {
      return res.status(404).json({ error: 'Webhook nicht gefunden' });
    }

    const [deliveries] = await db.promise().query(`
      SELECT * FROM webhook_deliveries
      WHERE webhook_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [id, parseInt(limit), parseInt(offset)]);

    const [countResult] = await db.promise().query(
      'SELECT COUNT(*) as total FROM webhook_deliveries WHERE webhook_id = ?',
      [id]
    );

    res.json({
      deliveries,
      total: countResult[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error('Fehler beim Laden der Zustellungen:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Zustellungen' });
  }
});

// ============================================================================
// ZAPIER SPEZIFISCHE ENDPUNKTE
// ============================================================================

/**
 * GET /api/webhooks/zapier/subscribe
 * Zapier Subscribe Hook (für Instant Triggers)
 */
router.post('/zapier/subscribe', async (req, res) => {
  try {
    const { hookUrl, event } = req.body;
    const dojoId = req.user.dojo_id;

    if (!hookUrl || !event) {
      return res.status(400).json({ error: 'hookUrl und event sind erforderlich' });
    }

    // Webhook für Zapier erstellen
    const secret = generateWebhookSecret();

    const [result] = await db.promise().query(`
      INSERT INTO webhooks (name, url, secret, events, active, dojo_id, is_zapier, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, 1, NOW(), NOW())
    `, [`Zapier: ${event}`, hookUrl, secret, JSON.stringify([event]), dojoId]);

    res.json({
      id: result.insertId,
      message: 'Zapier webhook subscribed'
    });

  } catch (error) {
    logger.error('Zapier subscribe error:', { error: error });
    res.status(500).json({ error: 'Subscription failed' });
  }
});

/**
 * DELETE /api/webhooks/zapier/subscribe/:id
 * Zapier Unsubscribe Hook
 */
router.delete('/zapier/subscribe/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const dojoId = req.user.dojo_id;

    await db.promise().query(
      'DELETE FROM webhooks WHERE id = ? AND dojo_id = ? AND is_zapier = 1',
      [id, dojoId]
    );

    res.json({ message: 'Zapier webhook unsubscribed' });

  } catch (error) {
    logger.error('Zapier unsubscribe error:', { error: error });
    res.status(500).json({ error: 'Unsubscription failed' });
  }
});

/**
 * GET /api/webhooks/zapier/sample/:event
 * Sample Data für Zapier
 */
router.get('/zapier/sample/:event', (req, res) => {
  const { event } = req.params;

  const samples = {
    'member.created': {
      mitglied_id: 123,
      vorname: 'Max',
      nachname: 'Mustermann',
      email: 'max@example.com',
      telefon: '0123456789',
      geburtsdatum: '1990-01-15',
      eintrittsdatum: '2024-01-01',
      status: 'aktiv'
    },
    'payment.received': {
      zahlung_id: 456,
      mitglied_id: 123,
      betrag: 49.90,
      zahlungsart: 'SEPA',
      datum: '2024-01-15',
      verwendungszweck: 'Mitgliedsbeitrag Januar 2024'
    },
    'attendance.checkin': {
      mitglied_id: 123,
      vorname: 'Max',
      nachname: 'Mustermann',
      kurs: 'Taekwondo Anfänger',
      checkin_zeit: '2024-01-15T18:00:00',
      standort: 'Hauptdojo'
    },
    'badge.awarded': {
      mitglied_id: 123,
      vorname: 'Max',
      nachname: 'Mustermann',
      badge_name: '100 Trainings',
      badge_beschreibung: 'Für 100 absolvierte Trainingseinheiten',
      verliehen_am: '2024-01-15'
    }
  };

  res.json(samples[event] || { message: 'Sample data for ' + event });
});

module.exports = router;
module.exports.triggerWebhooks = triggerWebhooks;
module.exports.WEBHOOK_EVENTS = WEBHOOK_EVENTS;
