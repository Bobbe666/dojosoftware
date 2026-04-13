/**
 * Hall of Fame Integration
 * Proxy-Endpunkte für die HOF-API (hof.tda-intl.org)
 * Erlaubt Admins und Trainern, Mitglieder für die HOF zu nominieren.
 */

const express = require('express');
const https = require('https');
const http = require('http');
const { authenticateToken } = require('../middleware/auth');
const { sendPushToMitglied } = require('../utils/pushNotification');
const { sendEmailForDojo } = require('../services/emailService');
const db = require('../db');
const logger = require('../utils/logger');
const router = express.Router();
const pool = db.promise();

const HOF_API_URL = process.env.HOF_API_URL || 'https://hof.tda-intl.org/api';
const HOF_SYSTEM_TOKEN = process.env.HOF_SYSTEM_TOKEN || '';
const HOF_CALLBACK_SECRET = process.env.HOF_CALLBACK_SECRET || '';
const DOJO_BASE_URL = process.env.DOJO_BASE_URL || 'https://dojo.tda-intl.org';

// ─── Helper: HTTP-Request zur HOF-API ────────────────────────────────────────
function hofRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(HOF_API_URL + path);
    const isHttps = url.protocol === 'https:';
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + HOF_SYSTEM_TOKEN,
      },
    };
    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const lib = isHttps ? https : http;
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── Middleware: Admin oder Trainer ──────────────────────────────────────────
function requireAdminOrTrainer(req, res, next) {
  if (!req.user || !['admin', 'trainer', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Nur Admins und Trainer dürfen nominieren.' });
  }
  next();
}

// ─── GET /api/hof/kategorien ─────────────────────────────────────────────────
// Gibt alle HOF-Kategorien zurück (für Dropdown im Nominierungsformular)
router.get('/kategorien', authenticateToken, requireAdminOrTrainer, async (req, res) => {
  try {
    const result = await hofRequest('GET', '/kategorien');
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(502).json({ message: 'HOF-API nicht erreichbar.' });
  }
});

// ─── GET /api/hof/veranstaltungen ────────────────────────────────────────────
router.get('/veranstaltungen', authenticateToken, requireAdminOrTrainer, async (req, res) => {
  try {
    const result = await hofRequest('GET', '/veranstaltungen');
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(502).json({ message: 'HOF-API nicht erreichbar.' });
  }
});

// ─── GET /api/hof/nominierungen ──────────────────────────────────────────────
// Gibt Nominierungen zurück, gefiltert nach dojo_id
router.get('/nominierungen', authenticateToken, requireAdminOrTrainer, async (req, res) => {
  try {
    const { jahr } = req.query;

    // dojo_id: Super-Admin darf beliebige dojo_id übergeben, normaler Admin nur seine eigene
    const jwtDojoId = req.user?.dojo_id;
    const isSuperAdmin = req.user?.role === 'super_admin' || (req.user?.role === 'admin' && !jwtDojoId);
    const requestedDojoId = req.query.dojo_id ? parseInt(req.query.dojo_id, 10) : null;
    const dojoId = isSuperAdmin ? requestedDojoId : (jwtDojoId || null);

    const params = new URLSearchParams();
    if (jahr) params.set('jahr', jahr);
    if (dojoId) params.set('dojo_id', dojoId);
    const qs = params.toString() ? '?' + params.toString() : '';

    const result = await hofRequest('GET', '/nominierungen' + qs);
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(502).json({ message: 'HOF-API nicht erreichbar.' });
  }
});

// ─── POST /api/hof/sportler-suchen ───────────────────────────────────────────
// Sucht ob ein Sportler bereits in HOF existiert (per Name + Geb.)
router.post('/sportler-suchen', authenticateToken, requireAdminOrTrainer, async (req, res) => {
  try {
    const result = await hofRequest('GET', '/sportler');
    if (!Array.isArray(result.body)) return res.json({ gefunden: false });
    const { vorname, nachname, geburtsdatum } = req.body;
    const match = result.body.find(s =>
      s.vorname?.toLowerCase() === vorname?.toLowerCase() &&
      s.nachname?.toLowerCase() === nachname?.toLowerCase() &&
      (!geburtsdatum || s.geburtsdatum === geburtsdatum)
    );
    if (match) {
      res.json({ gefunden: true, sportler: match });
    } else {
      res.json({ gefunden: false });
    }
  } catch (err) {
    res.status(502).json({ message: 'HOF-API nicht erreichbar.' });
  }
});

// ─── GET /api/hof/nominierung/:id/pdf ────────────────────────────────────────
// Proxy: leitet HOF-PDF-Generierung mit System-Token durch
router.get('/nominierung/:id/pdf', authenticateToken, (req, res) => {
  try {
    const url = new URL(`${HOF_API_URL}/pdf/nominierung/${req.params.id}`);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + HOF_SYSTEM_TOKEN },
    };
    const hofReq = lib.request(options, (hofRes) => {
      res.setHeader('Content-Type', hofRes.headers['content-type'] || 'application/pdf');
      const cd = hofRes.headers['content-disposition'];
      if (cd) res.setHeader('Content-Disposition', cd);
      hofRes.pipe(res);
    });
    hofReq.on('error', (e) => { logger.warn('[HOF] PDF-Proxy-Fehler:', { error: e.message }); res.status(502).json({ message: 'PDF nicht verfügbar' }); });
    hofReq.end();
  } catch (err) {
    res.status(502).json({ message: 'PDF-Proxy-Fehler' });
  }
});

// ─── POST /api/hof/nomination-approved ───────────────────────────────────────
// Webhook: HOF-Backend ruft dies auf wenn eine Nominierung genehmigt wurde
router.post('/nomination-approved', async (req, res) => {
  const { secret, nominierung_id, nominierungsnummer, mitglied_id } = req.body;
  if (!HOF_CALLBACK_SECRET || secret !== HOF_CALLBACK_SECRET) {
    return res.status(403).json({ message: 'Unauthorized' });
  }
  res.json({ ok: true }); // sofort antworten

  if (!mitglied_id) return;

  try {
    const pdfUrl = `${DOJO_BASE_URL}/api/hof/nominierung/${nominierung_id}/pdf`;
    const titel = '🏆 Hall of Fame — Nominierung genehmigt!';
    const text = `Deine Nominierung ${nominierungsnummer} wurde offiziell genehmigt. Deine Nominierungsurkunde steht bereit.`;

    // 1. Mitglied-E-Mail holen (für In-App-Notification)
    const [members] = await pool.query(
      'SELECT email FROM mitglieder WHERE mitglied_id = ? LIMIT 1',
      [mitglied_id]
    );
    const email = members[0]?.email;

    // 2. In-App-Notification schreiben (immer, unabhängig von Push)
    if (email) {
      await pool.query(
        `INSERT INTO notifications (type, recipient, subject, message, status, metadata, created_at)
         VALUES ('push', ?, ?, ?, 'unread', ?, NOW())`,
        [
          email,
          titel,
          text,
          JSON.stringify({ type: 'hof_approved', nominierung_id, nominierungsnummer, pdf_url: pdfUrl }),
        ]
      );
    }

    // 3. Push-Notification (zusätzlich, falls Subscriptions vorhanden)
    await sendPushToMitglied(
      mitglied_id,
      titel,
      text,
      '/member/dashboard',
      { type: 'hof_approved', nominierung_id, pdf_url: pdfUrl }
    );

    // 4. E-Mail ans Mitglied
    if (email) {
      const [[mitglied]] = await pool.query(
        'SELECT dojo_id FROM mitglieder WHERE mitglied_id = ? LIMIT 1', [mitglied_id]
      ).catch(() => [[null]]);
      await sendEmailForDojo({
        to: email,
        subject: titel,
        html: `
          <h2 style="color:#b8860b;">🏆 TDA Hall of Fame — Nominierung genehmigt!</h2>
          <p>Herzlichen Glückwunsch!</p>
          <p>Deine Nominierung für die <strong>TDA Hall of Fame</strong> wurde offiziell genehmigt.</p>
          <table style="margin:1rem 0;border-collapse:collapse;">
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Nominierungsnummer:</td><td><strong>${nominierungsnummer}</strong></td></tr>
          </table>
          <p>Deine Nominierungsurkunde steht jetzt in der Mitglieder-App bereit:</p>
          <p><a href="${pdfUrl}" style="color:#b8860b;">📄 Urkunde herunterladen</a></p>
          <p style="margin-top:1.5rem;font-size:0.9em;color:#999;">Diese Nachricht wurde automatisch durch das Dojosoftware-System versendet.</p>
        `
      }, mitglied?.dojo_id || null).catch(mailErr =>
        logger.warn('[HOF] E-Mail Genehmigung fehlgeschlagen:', { error: mailErr.message })
      );
    }
  } catch (err) {
    logger.error('[HOF] Approved-Notification-Fehler:', { error: err.message });
  }
});

// ─── POST /api/hof/nominieren ─────────────────────────────────────────────────
// Legt ggf. Sportler an und erstellt Nominierung
router.post('/nominieren', authenticateToken, requireAdminOrTrainer, async (req, res) => {
  try {
    const {
      // Person
      sportler_id,        // wenn bereits in HOF
      vorname, nachname, geschlecht, geburtsdatum, email, verein, telefon, adresse,
      // Nominierung
      kategorie_id, veranstaltung_id, jahr, zahler, nominiert_durch: nominiert_durch_input,
      // Dojo-Mitglied (für Push-Notification)
      mitglied_id,
    } = req.body;

    if (!kategorie_id) {
      return res.status(400).json({ message: 'Kategorie ist Pflichtfeld.' });
    }
    if (!vorname && !nachname && !sportler_id) {
      return res.status(400).json({ message: 'Person (Name oder Sportler-ID) ist Pflichtfeld.' });
    }

    // 1. Sportler anlegen falls noch kein sportler_id
    let finalSportlerId = sportler_id;
    if (!finalSportlerId) {
      const sportlerResult = await hofRequest('POST', '/sportler', {
        vorname, nachname,
        geschlecht: geschlecht || 'unbekannt',
        geburtsdatum: geburtsdatum || null,
        email: email || null,
        verein: verein || null,
        telefon: telefon || null,
        adresse: adresse || null,
      });
      if (sportlerResult.status !== 201 && sportlerResult.status !== 200) {
        return res.status(sportlerResult.status).json({
          message: 'Sportler konnte nicht angelegt werden.',
          detail: sportlerResult.body,
        });
      }
      finalSportlerId = sportlerResult.body.id;
    }

    // 2. Nominiert-durch + dojo_id
    const jwtDojoId = req.user?.dojo_id || null;
    const isSuperAdmin = req.user?.role === 'super_admin' || (req.user?.role === 'admin' && !jwtDojoId);
    const requestedDojoId = req.body.dojo_id ? parseInt(req.body.dojo_id, 10) : null;
    const dojoId = isSuperAdmin ? requestedDojoId : (jwtDojoId || null);
    const userName = req.user?.vorname || req.user?.username || 'Admin';
    const nominiert_durch = nominiert_durch_input
      ? nominiert_durch_input
      : `${userName}${dojoId ? ` (dojo:${dojoId})` : ''}`;

    // 2b. Bestehenden Sportler mit E-Mail aktualisieren falls leer
    if (finalSportlerId && email) {
      try {
        const existing = await hofRequest('GET', `/sportler/${finalSportlerId}`);
        if (existing.status === 200 && !existing.body?.email) {
          await hofRequest('PUT', `/sportler/${finalSportlerId}`, { email });
          logger.info(`[HOF] E-Mail für Sportler ${finalSportlerId} nachgetragen`);
        }
      } catch (e) {
        logger.warn('[HOF] Sportler E-Mail Update fehlgeschlagen:', { error: e.message });
      }
    }

    // 3. Nominierung erstellen
    const callbackUrl = HOF_CALLBACK_SECRET
      ? `${DOJO_BASE_URL}/api/hof/nomination-approved`
      : null;

    const nomResult = await hofRequest('POST', '/nominierungen', {
      sportler_id: finalSportlerId,
      kategorie_id,
      veranstaltung_id: veranstaltung_id || null,
      jahr: jahr || new Date().getFullYear(),
      dojo_id: dojoId || null,
      bezahlt: 0,
      zahler: zahler || null,
      nominiert_durch,
      mitglied_id: mitglied_id || null,
      callback_url: callbackUrl,
    });

    res.status(nomResult.status).json(nomResult.body);

    // 4. In-App-Notification + Push ans Mitglied (fire and forget)
    if (nomResult.status === 201 && mitglied_id) {
      try {
        const nomId = nomResult.body.id;
        const nomNr = nomResult.body.nominierungsnummer;
        const pdfUrl = `${DOJO_BASE_URL}/api/hof/nominierung/${nomId}/pdf`;
        const titel = '🏛️ Hall of Fame — Nominierung eingegangen';
        const text = `Du wurdest für die TDA Hall of Fame nominiert! Nominierung: ${nomNr}`;

        // E-Mail holen für In-App-Notification
        const [members] = await pool.query(
          'SELECT email FROM mitglieder WHERE mitglied_id = ? LIMIT 1', [mitglied_id]
        );
        if (members[0]?.email) {
          await pool.query(
            `INSERT INTO notifications (type, recipient, subject, message, status, metadata, created_at)
             VALUES ('push', ?, ?, ?, 'unread', ?, NOW())`,
            [members[0].email, titel, text,
             JSON.stringify({ type: 'hof_nominiert', nominierung_id: nomId, nominierungsnummer: nomNr, pdf_url: pdfUrl })]
          );
        }

        // Push (falls Subscription vorhanden)
        await sendPushToMitglied(mitglied_id, titel, text, '/member/dashboard',
          { type: 'hof_nominiert', nominierung_id: nomId, pdf_url: pdfUrl });

        // E-Mail ans Mitglied
        if (members[0]?.email) {
          const mitgliedEmail = members[0].email;
          await sendEmailForDojo({
            to: mitgliedEmail,
            subject: titel,
            html: `
              <h2 style="color:#b8860b;">🏛️ TDA Hall of Fame — Du wurdest nominiert!</h2>
              <p>Herzlichen Glückwunsch!</p>
              <p>Du wurdest offiziell für die <strong>TDA Hall of Fame</strong> nominiert.</p>
              <table style="margin:1rem 0;border-collapse:collapse;">
                <tr><td style="padding:4px 12px 4px 0;color:#666;">Nominierungsnummer:</td><td><strong>${nomNr}</strong></td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#666;">Jahr:</td><td>${nomResult.body.jahr || new Date().getFullYear()}</td></tr>
              </table>
              <p>Deine Nominierungsurkunde steht nach Genehmigung in der App bereit.</p>
              <p style="margin-top:1.5rem;font-size:0.9em;color:#999;">Diese Nachricht wurde automatisch durch das Dojosoftware-System versendet.</p>
            `
          }, dojoId).catch(mailErr =>
            logger.warn('[HOF] E-Mail Nominierung fehlgeschlagen:', { error: mailErr.message })
          );
        }
      } catch (pushErr) {
        logger.error('[HOF] Notification-Fehler:', { error: pushErr.message });
      }
    }
  } catch (err) {
    logger.error('[HOF] Fehler bei Nominierung:', { error: err.message });
    res.status(502).json({ message: 'HOF-API nicht erreichbar.' });
  }
});

// ─── POST /api/hof/sync-sportler ─────────────────────────────────────────────
// Synchronisiert aktive Dojo-Mitglieder in die HOF-Sportler-Datenbank
router.post('/sync-sportler', authenticateToken, async (req, res) => {
  try {
    const result = await hofRequest('POST', '/sportler/sync', {});
    if (result.status >= 400) {
      return res.status(result.status).json(result.body);
    }
    res.json(result.body);
  } catch (err) {
    logger.error('[HOF] Sync-Fehler:', { error: err.message });
    res.status(502).json({ message: 'HOF-API nicht erreichbar.' });
  }
});

module.exports = router;
