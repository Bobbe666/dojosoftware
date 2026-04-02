/**
 * Filter-Routes für Mitglieder
 * Extrahiert aus mitglieder.js - enthält alle /filter/* und /filter-options/* Endpoints
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const { getSecureDojoId } = require('../../middleware/tenantSecurity');
const auditLog = require('../../services/auditLogService');
const { sendEmail, sendEmailForDojo } = require('../../services/emailService');
const webpush = require('web-push');
const router = express.Router();

// VAPID für Push-Benachrichtigungen konfigurieren
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@dojo.tda-intl.org',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Alle verfügbaren Stile abrufen
router.get('/filter-options/stile', (req, res) => {
  const query = `
    SELECT name
    FROM stile
    WHERE aktiv = 1
    ORDER BY name
  `;

  db.query(query, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Stile:', err);
      return res.status(500).json({ error: 'Fehler beim Laden der Stile' });
    }
    const stile = results.map(r => r.name);
    res.json({ success: true, stile });
  });
});

// Alle verfügbaren Gurte/Graduierungen abrufen
router.get('/filter-options/gurte', (req, res) => {
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);

  let whereClause = 'WHERE m.aktiv = 1';
  const params = [];

  if (secureDojoId) {
    whereClause += ' AND m.dojo_id = ?';
    params.push(secureDojoId);
  }

  const query = `
    SELECT DISTINCT g.name, g.reihenfolge
    FROM graduierungen g
    INNER JOIN mitglied_stil_data msd ON g.graduierung_id = msd.current_graduierung_id
    INNER JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id
    ${whereClause}
    ORDER BY g.reihenfolge
  `;

  db.query(query, params, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Gurte:', err);
      return res.status(500).json({ error: 'Fehler beim Laden der Gurte' });
    }
    const gurte = results.map(r => r.name);
    res.json({ success: true, gurte });
  });
});

// Mitglieder ohne SEPA-Mandat
router.get('/filter/ohne-sepa', (req, res) => {
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);

  let whereConditions = [
    "m.zahlungsmethode IN ('SEPA-Lastschrift', 'Lastschrift')",
    "(sm.mandatsreferenz IS NULL OR sm.status != 'aktiv')",
    "(m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)"
  ];
  let queryParams = [];

  if (secureDojoId) {
    whereConditions.push('m.dojo_id = ?');
    queryParams.push(secureDojoId);
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

  const query = `
    SELECT DISTINCT
      m.mitglied_id, m.vorname, m.nachname, m.email,
      m.zahlungsmethode, m.aktiv, v.monatsbeitrag
    FROM mitglieder m
    LEFT JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
    LEFT JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv'
    ${whereClause}
    ORDER BY m.nachname, m.vorname
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Mitglieder ohne SEPA:', err);
      return res.status(500).json({ error: 'Fehler beim Laden der Mitglieder' });
    }
    res.json({ success: true, data: results });
  });
});

// Mitglieder ohne Vertrag
router.get('/filter/ohne-vertrag', (req, res) => {
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);

  let whereConditions = ['m.aktiv = 1', 'v.id IS NULL'];
  let queryParams = [];

  if (secureDojoId) {
    whereConditions.push('m.dojo_id = ?');
    queryParams.push(secureDojoId);
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

  const query = `
    SELECT DISTINCT
      m.mitglied_id, m.vorname, m.nachname, m.email,
      m.zahlungsmethode, m.aktiv, NULL as monatsbeitrag
    FROM mitglieder m
    LEFT JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv' AND v.dojo_id = m.dojo_id
    ${whereClause}
    ORDER BY m.nachname, m.vorname
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Mitglieder ohne Vertrag:', err);
      return res.status(500).json({ error: 'Fehler beim Laden der Mitglieder' });
    }
    res.json({ success: true, data: results });
  });
});

// Mitglieder mit Tarif-Abweichungen
router.get('/filter/tarif-abweichung', (req, res) => {
  const secureDojoId = getSecureDojoId(req);

  let whereConditions = [
    "v.status = 'aktiv'",
    "m.aktiv = 1",
    "d.ist_aktiv = 1",
    "d.dojoname NOT LIKE '%demo%'",
    `(
      v.tarif_id IS NULL
      OR t.ist_archiviert = 1
      OR (
        t.id IS NOT NULL AND t.ist_archiviert = 0
        AND v.monatsbeitrag != ROUND(
          CASE
            WHEN t.billing_cycle = 'MONTHLY'   THEN t.price_cents / 100
            WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
            WHEN t.billing_cycle = 'YEARLY'    THEN (t.price_cents / 100) / 12
            ELSE t.price_cents / 100
          END, 2)
      )
    )`
  ];
  let queryParams = [];

  if (secureDojoId) {
    whereConditions.push('m.dojo_id = ?');
    queryParams.push(secureDojoId);
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

  const query = `
    SELECT
      m.mitglied_id, m.vorname, m.nachname, m.email,
      m.zahlungsmethode, m.geburtsdatum, m.aktiv,
      v.id AS vertrag_id, v.monatsbeitrag, v.tarif_id, v.billing_cycle AS vertrag_billing_cycle,
      v.mindestlaufzeit_monate,
      t.name AS tarif_name, t.price_cents, t.billing_cycle AS tarif_billing_cycle,
      t.altersgruppe, t.ist_archiviert, t.nachfolger_tarif_id,
      nt.name AS nachfolger_tarif_name, nt.price_cents AS nachfolger_price_cents,
      CASE
        WHEN v.tarif_id IS NULL THEN NULL
        WHEN t.ist_archiviert = 1 AND nt.id IS NOT NULL THEN ROUND(nt.price_cents / 100, 2)
        ELSE ROUND(CASE
          WHEN t.billing_cycle = 'MONTHLY'   THEN t.price_cents / 100
          WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
          WHEN t.billing_cycle = 'YEARLY'    THEN (t.price_cents / 100) / 12
          ELSE t.price_cents / 100
        END, 2)
      END AS erwarteter_monatsbeitrag,
      CASE
        WHEN v.tarif_id IS NULL THEN NULL
        WHEN t.ist_archiviert = 1 AND nt.id IS NULL THEN NULL
        WHEN t.ist_archiviert = 1 AND nt.id IS NOT NULL
          THEN ROUND(v.monatsbeitrag - (nt.price_cents / 100), 2)
        ELSE ROUND(v.monatsbeitrag - CASE
          WHEN t.billing_cycle = 'MONTHLY'   THEN t.price_cents / 100
          WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
          WHEN t.billing_cycle = 'YEARLY'    THEN (t.price_cents / 100) / 12
          ELSE t.price_cents / 100
        END, 2)
      END AS differenz,
      CASE
        WHEN v.tarif_id IS NULL THEN
          CONCAT('Alter Vertrag ohne Tarif-Zuordnung (zahlt ', FORMAT(v.monatsbeitrag, 2), ' €/Monat)')
        WHEN t.ist_archiviert = 1 AND nt.id IS NOT NULL THEN
          CONCAT('Archivierter Tarif "', t.name, '" → Nachfolger: "', nt.name,
                 '" (Soll: ', FORMAT(nt.price_cents / 100, 2),
                 ' €/Monat | Zahlt: ', FORMAT(v.monatsbeitrag, 2), ' €)')
        WHEN t.ist_archiviert = 1 AND nt.id IS NULL THEN
          CONCAT('Archivierter Tarif "', t.name, '" (zahlt ', FORMAT(v.monatsbeitrag, 2),
                 ' €/Monat, kein Nachfolger definiert)')
        ELSE CONCAT('Zahlt ', FORMAT(v.monatsbeitrag, 2), ' € statt ',
            FORMAT(ROUND(CASE
              WHEN t.billing_cycle = 'MONTHLY'   THEN t.price_cents / 100
              WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
              WHEN t.billing_cycle = 'YEARLY'    THEN (t.price_cents / 100) / 12
              ELSE t.price_cents / 100
            END, 2), 2), ' €/Monat (', t.name, ')')
      END AS abweichung_grund
    FROM mitglieder m
    JOIN vertraege v  ON m.mitglied_id = v.mitglied_id
    JOIN dojo d       ON m.dojo_id = d.id
    LEFT JOIN tarife t  ON v.tarif_id = t.id
    LEFT JOIN tarife nt ON t.nachfolger_tarif_id = nt.id
    ${whereClause}
    ORDER BY
      CASE WHEN t.ist_archiviert = 1 THEN 0 WHEN v.tarif_id IS NULL THEN 1 ELSE 2 END,
      m.nachname, m.vorname
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Mitglieder mit Tarif-Abweichung:', err);
      return res.status(500).json({ error: 'Fehler beim Laden der Mitglieder' });
    }

    const statistik = {
      gesamt: results.length,
      archivierterTarif: 0, archivierterTarifMitNachfolger: 0,
      zuViel: 0, zuWenig: 0, keinTarif: 0,
      summeArchiviert: 0, summeZuViel: 0, summeZuWenig: 0, potenzialBeiMigration: 0
    };
    results.forEach(m => {
      const diff = m.differenz !== null ? parseFloat(m.differenz) : null;
      if (!m.tarif_id) {
        statistik.keinTarif++;
      } else if (m.ist_archiviert === 1) {
        statistik.archivierterTarif++;
        statistik.summeArchiviert += parseFloat(m.monatsbeitrag || 0);
        if (m.nachfolger_tarif_id) {
          statistik.archivierterTarifMitNachfolger++;
          if (diff !== null && diff < 0) statistik.potenzialBeiMigration += Math.abs(diff);
        }
      } else if (diff !== null && diff > 0) {
        statistik.zuViel++; statistik.summeZuViel += diff;
      } else if (diff !== null && diff < 0) {
        statistik.zuWenig++; statistik.summeZuWenig += Math.abs(diff);
      }
    });

    res.json({ success: true, data: results, statistik });
  });
});

// Mitglieder nach Zahlungsweise filtern
router.get('/filter/zahlungsweisen', (req, res) => {
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);

  const { payment_method } = req.query;

  let whereConditions = [];
  let queryParams = [];

  if (payment_method && payment_method !== 'all') {
    if (payment_method === 'Lastschrift') {
      whereConditions.push("(m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')");
    } else {
      whereConditions.push('m.zahlungsmethode = ?');
      queryParams.push(payment_method);
    }
  }

  if (secureDojoId) {
    whereConditions.push('m.dojo_id = ?');
    queryParams.push(secureDojoId);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const query = `
    SELECT DISTINCT
      m.mitglied_id, m.vorname, m.nachname, m.email,
      m.zahlungsmethode, m.aktiv, v.monatsbeitrag
    FROM mitglieder m
    LEFT JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv'
    ${whereClause}
    ORDER BY m.nachname, m.vorname
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Mitglieder nach Zahlungsweise:', err);
      return res.status(500).json({ error: 'Fehler beim Laden der Mitglieder' });
    }
    res.json({ success: true, data: results });
  });
});

router.get("/filter/tarif-abweichung/vorschau", (req, res) => {
  const role = req.user?.rolle;
  if (role !== 'admin' && role !== 'super_admin') return res.status(403).json({ error: 'Nur für Admins' });

  const { typ, erhoehung, erhoehungProzent } = req.query;
  const betrag  = parseFloat(erhoehung) || 0;
  const prozent = parseFloat(erhoehungProzent) || 0;

  const secureDojoId = getSecureDojoId(req);

  const tarifPreisExpr = `ROUND(CASE
    WHEN t.billing_cycle = 'MONTHLY'   THEN t.price_cents / 100
    WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
    WHEN t.billing_cycle = 'YEARLY'    THEN (t.price_cents / 100) / 12
    ELSE t.price_cents / 100
  END, 2)`;
  const nachfolgerPreisExpr = `ROUND(CASE
    WHEN nt.billing_cycle = 'MONTHLY'   THEN nt.price_cents / 100
    WHEN nt.billing_cycle = 'QUARTERLY' THEN (nt.price_cents / 100) / 3
    WHEN nt.billing_cycle = 'YEARLY'    THEN (nt.price_cents / 100) / 12
    ELSE nt.price_cents / 100
  END, 2)`;
  // Cap: aktiver Tarif → Tarif-Preis. Archivierter Tarif mit Nachfolger → Nachfolger-Preis. Sonst kein Cap.
  const tarifCapExpr = `CASE
    WHEN t.id IS NOT NULL AND t.ist_archiviert = 0 THEN ${tarifPreisExpr}
    WHEN t.ist_archiviert = 1 AND nt.id IS NOT NULL THEN ${nachfolgerPreisExpr}
    ELSE 999999 END`;

  let neuerBetragExpr, params;
  if (typ === 'prozent') {
    neuerBetragExpr = `LEAST(ROUND(v.monatsbeitrag * (1 + ? / 100), 2), ${tarifCapExpr})`;
    params = [prozent];
  } else if (typ === 'kombination') {
    neuerBetragExpr = `LEAST(ROUND(v.monatsbeitrag + LEAST(?, ROUND(v.monatsbeitrag * ? / 100, 2)), 2), ${tarifCapExpr})`;
    params = [betrag, prozent];
  } else {
    neuerBetragExpr = `LEAST(ROUND(v.monatsbeitrag + ?, 2), ${tarifCapExpr})`;
    params = [betrag];
  }

  if (secureDojoId) params.push(secureDojoId);

  const query = `
    SELECT
      m.mitglied_id, m.vorname, m.nachname, m.email, m.dojo_id,
      ROUND(v.monatsbeitrag, 2) AS alter_betrag,
      ${neuerBetragExpr} AS neuer_betrag,
      d.dojoname
    FROM mitglieder m
    JOIN vertraege v ON v.mitglied_id = m.mitglied_id AND v.status = 'aktiv'
    JOIN dojo d ON m.dojo_id = d.id AND d.ist_aktiv = 1 AND d.dojoname NOT LIKE '%demo%'
    LEFT JOIN tarife t ON v.tarif_id = t.id
    LEFT JOIN tarife nt ON t.nachfolger_tarif_id = nt.id
    WHERE m.aktiv = 1
    AND v.tarif_id IS NOT NULL
    ${secureDojoId ? 'AND m.dojo_id = ?' : ''}
    HAVING neuer_betrag > alter_betrag
    ORDER BY m.nachname, m.vorname
  `;

  db.query(query, params, (err, results) => {
    if (err) {
      logger.error('Fehler bei Vorschau-Abfrage:', { error: err });
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    res.json(results.map(m => ({
      ...m,
      differenz: Math.round((m.neuer_betrag - m.alter_betrag) * 100) / 100
    })));
  });
});

// ✅ API: Beiträge massenweise erhöhen (absolut, prozentual oder kombiniert, gedeckelt am Tarif-Preis)
router.put("/filter/tarif-abweichung/massenerhohung", (req, res) => {
  const role = req.user?.rolle;
  if (role !== 'admin' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Nur für Admins' });
  }

  const { erhoehung, erhoehungProzent, typ, ausschluss } = req.body;
  const betrag  = parseFloat(erhoehung) || 0;
  const prozent = parseFloat(erhoehungProzent) || 0;
  const ausschlussIds = Array.isArray(ausschluss) ? ausschluss.map(Number).filter(n => n > 0) : [];

  if (typ === 'prozent') {
    if (!prozent || prozent <= 0 || prozent > 100) return res.status(400).json({ error: 'Ungültiger Prozentwert' });
  } else if (typ === 'kombination') {
    if (!betrag || betrag <= 0 || !prozent || prozent <= 0) return res.status(400).json({ error: 'Ungültige Kombinations-Parameter' });
  } else {
    if (!betrag || betrag <= 0 || betrag > 500) return res.status(400).json({ error: 'Ungültiger Erhöhungsbetrag (max. 500 €)' });
  }

  const secureDojoId = getSecureDojoId(req);

  const tarifPreisExpr = `ROUND(CASE
    WHEN t.billing_cycle = 'MONTHLY'   THEN t.price_cents / 100
    WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
    WHEN t.billing_cycle = 'YEARLY'    THEN (t.price_cents / 100) / 12
    ELSE t.price_cents / 100
  END, 2)`;
  const nachfolgerPreisExpr = `ROUND(CASE
    WHEN nt.billing_cycle = 'MONTHLY'   THEN nt.price_cents / 100
    WHEN nt.billing_cycle = 'QUARTERLY' THEN (nt.price_cents / 100) / 3
    WHEN nt.billing_cycle = 'YEARLY'    THEN (nt.price_cents / 100) / 12
    ELSE nt.price_cents / 100
  END, 2)`;
  const tarifCapExpr = `CASE
    WHEN t.id IS NOT NULL AND t.ist_archiviert = 0 THEN ${tarifPreisExpr}
    WHEN t.ist_archiviert = 1 AND nt.id IS NOT NULL THEN ${nachfolgerPreisExpr}
    ELSE 999999 END`;

  // neuerBetragExpr erscheint im UPDATE zweimal (SET + WHERE) → betragParams doppelt übergeben
  let neuerBetragExpr, betragParams;
  if (typ === 'prozent') {
    neuerBetragExpr = `LEAST(ROUND(v.monatsbeitrag * (1 + ? / 100), 2), ${tarifCapExpr})`;
    betragParams = [prozent];
  } else if (typ === 'kombination') {
    neuerBetragExpr = `LEAST(ROUND(v.monatsbeitrag + LEAST(?, ROUND(v.monatsbeitrag * ? / 100, 2)), 2), ${tarifCapExpr})`;
    betragParams = [betrag, prozent];
  } else {
    neuerBetragExpr = `LEAST(ROUND(v.monatsbeitrag + ?, 2), ${tarifCapExpr})`;
    betragParams = [betrag];
  }

  // SET braucht betragParams, WHERE-Bedingung auch → doppelt
  const params = [...betragParams, ...betragParams];
  let dojoFilter = '';
  if (secureDojoId) { dojoFilter = 'AND m.dojo_id = ?'; params.push(secureDojoId); }

  let ausschlussFilter = '';
  if (ausschlussIds.length > 0) {
    ausschlussFilter = `AND m.mitglied_id NOT IN (${ausschlussIds.map(() => '?').join(',')})`;
    params.push(...ausschlussIds);
  }

  const query = `
    UPDATE vertraege v
    LEFT JOIN tarife t ON v.tarif_id = t.id
    LEFT JOIN tarife nt ON t.nachfolger_tarif_id = nt.id
    JOIN mitglieder m ON v.mitglied_id = m.mitglied_id AND m.aktiv = 1
    JOIN dojo d ON m.dojo_id = d.id AND d.ist_aktiv = 1 AND d.dojoname NOT LIKE '%demo%'
    SET v.monatsbeitrag = ${neuerBetragExpr}
    WHERE v.status = 'aktiv'
    AND v.tarif_id IS NOT NULL
    AND ${neuerBetragExpr} > v.monatsbeitrag
    ${dojoFilter}
    ${ausschlussFilter}
  `;

  db.query(query, params, (err, result) => {
    if (err) {
      logger.error('Fehler bei Massenerhöhung:', { error: err });
      return res.status(500).json({ error: 'Fehler bei der Massenerhöhung' });
    }
    logger.info(`Massenerhöhung (${typ||'absolut'}): ${result.affectedRows} Verträge erhöht`, {
      user: req.user?.id, dojo_id: secureDojoId
    });
    res.json({ success: true, aktualisiert: result.affectedRows });
  });
});

// ✅ API: Beitragserhöhung terminieren + Mitglieder per E-Mail & Push informieren
router.post("/filter/tarif-abweichung/terminierung", async (req, res) => {
  const role = req.user?.rolle;
  if (role !== 'admin' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Nur für Admins' });
  }

  const { erhoehung, erhoehungProzent, typ, vorlage, gueltigAb, grund, ausschluss } = req.body;
  const betrag  = parseFloat(erhoehung) || 0;
  const prozent = parseFloat(erhoehungProzent) || 0;
  const grundText = typeof grund === 'string' ? grund.trim().slice(0, 800) : '';
  const ausschlussIds = Array.isArray(ausschluss) ? ausschluss.map(Number).filter(n => n > 0) : [];

  if (!['formell', 'freundlich', 'kurz'].includes(vorlage)) return res.status(400).json({ error: 'Ungültige Vorlage' });
  if (!gueltigAb) return res.status(400).json({ error: 'Gültigkeitsdatum fehlt' });

  const secureDojoId = getSecureDojoId(req);

  const tarifPreisExpr = `ROUND(CASE
    WHEN t.billing_cycle = 'MONTHLY'   THEN t.price_cents / 100
    WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
    WHEN t.billing_cycle = 'YEARLY'    THEN (t.price_cents / 100) / 12
    ELSE t.price_cents / 100
  END, 2)`;
  const nachfolgerPreisExpr = `ROUND(CASE
    WHEN nt.billing_cycle = 'MONTHLY'   THEN nt.price_cents / 100
    WHEN nt.billing_cycle = 'QUARTERLY' THEN (nt.price_cents / 100) / 3
    WHEN nt.billing_cycle = 'YEARLY'    THEN (nt.price_cents / 100) / 12
    ELSE nt.price_cents / 100
  END, 2)`;
  const tarifCapExpr = `CASE
    WHEN t.id IS NOT NULL AND t.ist_archiviert = 0 THEN ${tarifPreisExpr}
    WHEN t.ist_archiviert = 1 AND nt.id IS NOT NULL THEN ${nachfolgerPreisExpr}
    ELSE 999999 END`;

  let neuerBetragExpr, params;
  if (typ === 'prozent') {
    neuerBetragExpr = `LEAST(ROUND(v.monatsbeitrag * (1 + ? / 100), 2), ${tarifCapExpr})`;
    params = [prozent];
  } else if (typ === 'kombination') {
    neuerBetragExpr = `LEAST(ROUND(v.monatsbeitrag + LEAST(?, ROUND(v.monatsbeitrag * ? / 100, 2)), 2), ${tarifCapExpr})`;
    params = [betrag, prozent];
  } else {
    neuerBetragExpr = `LEAST(ROUND(v.monatsbeitrag + ?, 2), ${tarifCapExpr})`;
    params = [betrag];
  }

  let dojoFilter = '';
  if (secureDojoId) { dojoFilter = 'AND m.dojo_id = ?'; params.push(secureDojoId); }

  let ausschlussFilter = '';
  if (ausschlussIds.length > 0) {
    ausschlussFilter = `AND m.mitglied_id NOT IN (${ausschlussIds.map(() => '?').join(',')})`;
    params.push(...ausschlussIds);
  }

  const query = `
    SELECT
      m.mitglied_id, m.vorname, m.nachname, m.email, m.dojo_id,
      ROUND(v.monatsbeitrag, 2) AS alter_betrag,
      ${neuerBetragExpr} AS neuer_betrag,
      d.dojoname
    FROM mitglieder m
    JOIN vertraege v ON v.mitglied_id = m.mitglied_id AND v.status = 'aktiv'
    JOIN dojo d      ON m.dojo_id = d.id AND d.ist_aktiv = 1 AND d.dojoname NOT LIKE '%demo%'
    LEFT JOIN tarife t ON v.tarif_id = t.id
    LEFT JOIN tarife nt ON t.nachfolger_tarif_id = nt.id
    WHERE m.aktiv = 1
    AND v.tarif_id IS NOT NULL
    ${dojoFilter}
    ${ausschlussFilter}
    HAVING neuer_betrag > alter_betrag
  `;

  db.query(query, params, async (err, members) => {
    if (err) {
      logger.error('Fehler bei Terminierungs-Abfrage:', { error: err });
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    // 1. Erhöhung für jeden Vertrag terminieren
    let terminiert = 0;
    for (const m of members) {
      try {
        await db.promise().query(
          `UPDATE vertraege SET neuer_monatsbeitrag = ?, neuer_beitrag_ab = ?
           WHERE mitglied_id = ? AND status = 'aktiv'`,
          [m.neuer_betrag, gueltigAb, m.mitglied_id]
        );
        terminiert++;
      } catch (upErr) {
        logger.error(`Terminierung fehlgeschlagen für Mitglied ${m.mitglied_id}:`, { error: upErr });
      }
    }

    // 2. E-Mail + Push an alle Betroffenen
    const datumFormatiert = new Date(gueltigAb).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const fmt = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
    let sent = 0, failed = 0, noEmail = 0, pushSent = 0;

    for (const m of members) {
      if (!m.email) { noEmail++; }

      const alt = fmt(m.alter_betrag);
      const neu = fmt(m.neuer_betrag);
      let subject, html, text;

      const grundAbsatz = grundText
        ? `\n\n${grundText}`
        : '\n\nDiese Anpassung ist notwendig, um die langfristige Qualität unserer Angebote und Trainings sicherzustellen.';
      const grundHtml = grundText
        ? `<p>${grundText.replace(/\n/g, '<br>')}</p>`
        : '<p>Diese Anpassung ist notwendig, um die langfristige Qualität unserer Angebote und Trainings sicherzustellen.</p>';

      if (vorlage === 'formell') {
        subject = `Ankündigung Beitragsanpassung ab ${datumFormatiert}`;
        text = `Sehr geehrte/r ${m.vorname} ${m.nachname},\n\nwir möchten Sie hiermit über eine Anpassung Ihres monatlichen Mitgliedsbeitrags informieren.\n\nAb dem ${datumFormatiert} beträgt Ihr monatlicher Beitrag ${neu} (bisher: ${alt}).${grundAbsatz}\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen\n${m.dojoname}`;
        html = `<p>Sehr geehrte/r <strong>${m.vorname} ${m.nachname}</strong>,</p><p>wir möchten Sie hiermit über eine Anpassung Ihres monatlichen Mitgliedsbeitrags informieren.</p><p>Ab dem <strong>${datumFormatiert}</strong> beträgt Ihr monatlicher Beitrag <strong>${neu}</strong> (bisher: ${alt}).</p>${grundHtml}<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p><p>Mit freundlichen Grüßen<br><strong>${m.dojoname}</strong></p>`;
      } else if (vorlage === 'freundlich') {
        subject = `Dein Beitrag ändert sich ab ${datumFormatiert}`;
        text = `Hallo ${m.vorname},\n\nwir möchten dich über eine Anpassung deines monatlichen Mitgliedsbeitrags informieren.\n\nAb dem ${datumFormatiert} beträgt dein monatlicher Beitrag ${neu} (bisher: ${alt}).${grundAbsatz}\n\nWir danken dir für deine Mitgliedschaft und freuen uns, dich weiterhin bei uns im Dojo willkommen zu heißen!\n\nHerzliche Grüße\n${m.dojoname}`;
        html = `<p>Hallo <strong>${m.vorname}</strong>,</p><p>wir möchten dich über eine Anpassung deines monatlichen Mitgliedsbeitrags informieren.</p><p>Ab dem <strong>${datumFormatiert}</strong> beträgt dein monatlicher Beitrag <strong>${neu}</strong> (bisher: ${alt}).</p>${grundHtml}<p>Wir danken dir für deine Mitgliedschaft und freuen uns, dich weiterhin bei uns im Dojo willkommen zu heißen!</p><p>Herzliche Grüße<br><strong>${m.dojoname}</strong></p>`;
      } else {
        subject = `Beitragsänderung ab ${datumFormatiert}`;
        text = `${m.vorname} ${m.nachname},\n\nab dem ${datumFormatiert} wird dein monatlicher Mitgliedsbeitrag von ${alt} auf ${neu} angepasst.${grundText ? '\n\n' + grundText : ''}\n\n${m.dojoname}`;
        html = `<p>${m.vorname} ${m.nachname},</p><p>ab dem <strong>${datumFormatiert}</strong> wird dein monatlicher Mitgliedsbeitrag von ${alt} auf <strong>${neu}</strong> angepasst.</p>${grundText ? `<p>${grundText.replace(/\n/g, '<br>')}</p>` : ''}<p>${m.dojoname}</p>`;
      }

      if (m.email) {
        try {
          const dojoIdForEmail = secureDojoId || m.dojo_id;
          if (dojoIdForEmail) {
            await sendEmailForDojo({ to: m.email, subject, html, text }, dojoIdForEmail);
          } else {
            await sendEmail({ to: m.email, subject, html, text });
          }
          sent++;
        } catch (emailErr) {
          logger.error(`E-Mail an ${m.email} fehlgeschlagen:`, { error: emailErr });
          failed++;
        }
      }

      // Push immer senden (kein Toggle — alle betroffenen Mitglieder werden informiert)
      if (process.env.VAPID_PUBLIC_KEY) {
        try {
          const [subs] = await db.promise().query(
            'SELECT endpoint, p256dh_key, auth_key FROM push_subscriptions WHERE user_id = ? AND is_active = TRUE',
            [m.mitglied_id]
          );
          const pushBody = vorlage === 'formell'
            ? `Ab dem ${datumFormatiert} beträgt Ihr monatlicher Beitrag ${fmt(m.neuer_betrag)} (bisher: ${fmt(m.alter_betrag)}).`
            : `Ab dem ${datumFormatiert} beträgt dein monatlicher Beitrag ${fmt(m.neuer_betrag)} (bisher: ${fmt(m.alter_betrag)}).`;
          const pushPayload = JSON.stringify({
            title: subject,
            body: pushBody,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
            data: { url: '/member/dashboard' }
          });
          for (const sub of subs) {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
                pushPayload
              );
              pushSent++;
            } catch (pe) {
              if (pe.statusCode === 410 || pe.statusCode === 404) {
                db.query('UPDATE push_subscriptions SET is_active = FALSE WHERE endpoint = ?', [sub.endpoint]);
              }
            }
          }
        } catch (pushErr) {
          logger.error(`Push-Fehler für Mitglied ${m.mitglied_id}:`, { error: pushErr });
        }
      }
    }

    logger.info(`Beitragserhöhung terminiert: ${terminiert} Verträge ab ${gueltigAb}, ${sent} E-Mails, ${pushSent} Push`, {
      user: req.user?.id
    });
    res.json({ success: true, terminiert, sent, failed, noEmail, pushSent, gesamt: members.length });
  });
});

// ✅ API: Mitglieder über Beitragserhöhung per E-Mail informieren
router.post("/filter/tarif-abweichung/benachrichtigung", async (req, res) => {
  const role = req.user?.rolle;
  if (role !== 'admin' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Nur für Admins' });
  }

  const { erhoehung, erhoehungProzent, typ, vorlage, gueltigAb, grund, ausschluss, sendPush } = req.body;
  const betrag  = parseFloat(erhoehung) || 0;
  const prozent = parseFloat(erhoehungProzent) || 0;
  // Begründungstext bereinigen (max 800 Zeichen, kein HTML)
  const grundText = typeof grund === 'string' ? grund.trim().slice(0, 800) : '';
  const ausschlussIds = Array.isArray(ausschluss) ? ausschluss.map(Number).filter(n => n > 0) : [];

  if (!['formell', 'freundlich', 'kurz'].includes(vorlage)) return res.status(400).json({ error: 'Ungültige Vorlage' });
  if (!gueltigAb) return res.status(400).json({ error: 'Gültigkeitsdatum fehlt' });

  const secureDojoId = getSecureDojoId(req);

  const tarifPreisExpr = `ROUND(CASE
    WHEN t.billing_cycle = 'MONTHLY'   THEN t.price_cents / 100
    WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
    WHEN t.billing_cycle = 'YEARLY'    THEN (t.price_cents / 100) / 12
    ELSE t.price_cents / 100
  END, 2)`;
  const nachfolgerPreisExpr = `ROUND(CASE
    WHEN nt.billing_cycle = 'MONTHLY'   THEN nt.price_cents / 100
    WHEN nt.billing_cycle = 'QUARTERLY' THEN (nt.price_cents / 100) / 3
    WHEN nt.billing_cycle = 'YEARLY'    THEN (nt.price_cents / 100) / 12
    ELSE nt.price_cents / 100
  END, 2)`;
  const tarifCapExpr = `CASE
    WHEN t.id IS NOT NULL AND t.ist_archiviert = 0 THEN ${tarifPreisExpr}
    WHEN t.ist_archiviert = 1 AND nt.id IS NOT NULL THEN ${nachfolgerPreisExpr}
    ELSE 999999 END`;

  let neuerBetragExpr, params;
  if (typ === 'prozent') {
    neuerBetragExpr = `LEAST(ROUND(v.monatsbeitrag * (1 + ? / 100), 2), ${tarifCapExpr})`;
    params = [prozent];
  } else if (typ === 'kombination') {
    neuerBetragExpr = `LEAST(ROUND(v.monatsbeitrag + LEAST(?, ROUND(v.monatsbeitrag * ? / 100, 2)), 2), ${tarifCapExpr})`;
    params = [betrag, prozent];
  } else {
    neuerBetragExpr = `LEAST(ROUND(v.monatsbeitrag + ?, 2), ${tarifCapExpr})`;
    params = [betrag];
  }

  let dojoFilter = '';
  if (secureDojoId) { dojoFilter = 'AND m.dojo_id = ?'; params.push(secureDojoId); }

  let ausschlussFilter = '';
  if (ausschlussIds.length > 0) {
    ausschlussFilter = `AND m.mitglied_id NOT IN (${ausschlussIds.map(() => '?').join(',')})`;
    params.push(...ausschlussIds);
  }

  const query = `
    SELECT
      m.mitglied_id, m.vorname, m.nachname, m.email, m.dojo_id,
      ROUND(v.monatsbeitrag, 2) AS alter_betrag,
      ${neuerBetragExpr} AS neuer_betrag,
      d.dojoname
    FROM mitglieder m
    JOIN vertraege v ON v.mitglied_id = m.mitglied_id AND v.status = 'aktiv'
    JOIN dojo d      ON m.dojo_id = d.id AND d.ist_aktiv = 1 AND d.dojoname NOT LIKE '%demo%'
    LEFT JOIN tarife t ON v.tarif_id = t.id
    LEFT JOIN tarife nt ON t.nachfolger_tarif_id = nt.id
    WHERE m.aktiv = 1
    AND v.tarif_id IS NOT NULL
    ${dojoFilter}
    ${ausschlussFilter}
    HAVING neuer_betrag > alter_betrag
  `;

  db.query(query, params, async (err, members) => {
    if (err) {
      logger.error('Fehler bei Benachrichtigungsabfrage:', { error: err });
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    const datumFormatiert = new Date(gueltigAb).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const fmt = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);

    let sent = 0, failed = 0, noEmail = 0, pushSent = 0;

    for (const m of members) {
      if (!m.email) { noEmail++; }

      const alt = fmt(m.alter_betrag);
      const neu = fmt(m.neuer_betrag);

      let subject, html, text;

      const grundAbsatz = grundText
        ? `\n\n${grundText}`
        : '\n\nDiese Anpassung ist notwendig, um die langfristige Qualität unserer Angebote und Trainings sicherzustellen.';
      const grundHtml = grundText
        ? `<p>${grundText.replace(/\n/g, '<br>')}</p>`
        : '<p>Diese Anpassung ist notwendig, um die langfristige Qualität unserer Angebote und Trainings sicherzustellen.</p>';

      if (vorlage === 'formell') {
        subject = `Ankündigung Beitragsanpassung ab ${datumFormatiert}`;
        text = `Sehr geehrte/r ${m.vorname} ${m.nachname},\n\nwir möchten Sie hiermit über eine Anpassung Ihres monatlichen Mitgliedsbeitrags informieren.\n\nAb dem ${datumFormatiert} beträgt Ihr monatlicher Beitrag ${neu} (bisher: ${alt}).${grundAbsatz}\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen\n${m.dojoname}`;
        html = `<p>Sehr geehrte/r <strong>${m.vorname} ${m.nachname}</strong>,</p><p>wir möchten Sie hiermit über eine Anpassung Ihres monatlichen Mitgliedsbeitrags informieren.</p><p>Ab dem <strong>${datumFormatiert}</strong> beträgt Ihr monatlicher Beitrag <strong>${neu}</strong> (bisher: ${alt}).</p>${grundHtml}<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p><p>Mit freundlichen Grüßen<br><strong>${m.dojoname}</strong></p>`;
      } else if (vorlage === 'freundlich') {
        subject = `Dein Beitrag ändert sich ab ${datumFormatiert}`;
        text = `Hallo ${m.vorname},\n\nwir möchten dich über eine Anpassung deines monatlichen Mitgliedsbeitrags informieren.\n\nAb dem ${datumFormatiert} beträgt dein monatlicher Beitrag ${neu} (bisher: ${alt}).${grundAbsatz}\n\nWir danken dir für deine Mitgliedschaft und freuen uns, dich weiterhin bei uns im Dojo willkommen zu heißen!\n\nHerzliche Grüße\n${m.dojoname}`;
        html = `<p>Hallo <strong>${m.vorname}</strong>,</p><p>wir möchten dich über eine Anpassung deines monatlichen Mitgliedsbeitrags informieren.</p><p>Ab dem <strong>${datumFormatiert}</strong> beträgt dein monatlicher Beitrag <strong>${neu}</strong> (bisher: ${alt}).</p>${grundHtml}<p>Wir danken dir für deine Mitgliedschaft und freuen uns, dich weiterhin bei uns im Dojo willkommen zu heißen!</p><p>Herzliche Grüße<br><strong>${m.dojoname}</strong></p>`;
      } else {
        subject = `Beitragsänderung ab ${datumFormatiert}`;
        text = `${m.vorname} ${m.nachname},\n\nab dem ${datumFormatiert} wird dein monatlicher Mitgliedsbeitrag von ${alt} auf ${neu} angepasst.${grundText ? '\n\n' + grundText : ''}\n\n${m.dojoname}`;
        html = `<p>${m.vorname} ${m.nachname},</p><p>ab dem <strong>${datumFormatiert}</strong> wird dein monatlicher Mitgliedsbeitrag von ${alt} auf <strong>${neu}</strong> angepasst.</p>${grundText ? `<p>${grundText.replace(/\n/g, '<br>')}</p>` : ''}<p>${m.dojoname}</p>`;
      }

      // E-Mail
      if (m.email) {
        try {
          const dojoIdForEmail = secureDojoId || m.dojo_id;
          if (dojoIdForEmail) {
            await sendEmailForDojo({ to: m.email, subject, html, text }, dojoIdForEmail);
          } else {
            await sendEmail({ to: m.email, subject, html, text });
          }
          sent++;
        } catch (emailErr) {
          logger.error(`E-Mail an ${m.email} fehlgeschlagen:`, { error: emailErr });
          failed++;
        }
      }

      // Push-Benachrichtigung (immer senden, nicht optional)
      if (process.env.VAPID_PUBLIC_KEY) {
        try {
          const [subs] = await db.promise().query(
            'SELECT endpoint, p256dh_key, auth_key FROM push_subscriptions WHERE user_id = ? AND is_active = TRUE',
            [m.mitglied_id]
          );
          const pushBody = vorlage === 'formell'
            ? `Ab dem ${datumFormatiert} beträgt Ihr monatlicher Beitrag ${fmt(m.neuer_betrag)} (bisher: ${fmt(m.alter_betrag)}).`
            : `Ab dem ${datumFormatiert} beträgt dein monatlicher Beitrag ${fmt(m.neuer_betrag)} (bisher: ${fmt(m.alter_betrag)}).`;
          const pushPayload = JSON.stringify({
            title: subject,
            body: pushBody,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
            data: { url: '/member/dashboard' }
          });
          for (const sub of subs) {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
                pushPayload
              );
              pushSent++;
            } catch (pe) {
              if (pe.statusCode === 410 || pe.statusCode === 404) {
                db.query('UPDATE push_subscriptions SET is_active = FALSE WHERE endpoint = ?', [sub.endpoint]);
              }
            }
          }
        } catch (pushErr) {
          logger.error(`Push-Fehler für Mitglied ${m.mitglied_id}:`, { error: pushErr });
        }
      }
    }

    logger.info(`Beitragserhöhung Benachrichtigung: ${sent} E-Mails, ${pushSent} Push, ${failed} fehlgeschlagen`, {
      user: req.user?.id, gueltigAb
    });

    res.json({ success: true, sent, failed, noEmail, pushSent, gesamt: members.length });
  });
});

// ✅ API: Aktive Tarife für Dropdown (Tarif-Migration)
router.get('/filter-options/tarife', (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  let where = 'WHERE ist_archiviert = 0';
  const params = [];
  if (secureDojoId) { where += ' AND dojo_id = ?'; params.push(secureDojoId); }
  db.query(
    `SELECT id, name, price_cents, billing_cycle, altersgruppe FROM tarife ${where} ORDER BY altersgruppe, name`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// ✅ API: Tarif-Migration — nur tarif_id aktualisieren, monatsbeitrag bleibt unverändert
router.patch('/filter/tarif-migration', async (req, res) => {
  const role = req.user?.rolle;
  if (role !== 'admin' && role !== 'super_admin') return res.status(403).json({ error: 'Nur für Admins' });

  const secureDojoId = getSecureDojoId(req);
  const { migrationen } = req.body; // [{vertrag_id, neuer_tarif_id}]

  if (!Array.isArray(migrationen) || migrationen.length === 0) {
    return res.status(400).json({ error: 'Keine Migrationen angegeben' });
  }

  const pool = db.promise();
  let migriert = 0, fehler = 0;

  for (const { vertrag_id, neuer_tarif_id } of migrationen) {
    if (!vertrag_id || !neuer_tarif_id) { fehler++; continue; }
    try {
      let sql = `UPDATE vertraege v
        JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
        SET v.tarif_id = ?
        WHERE v.id = ? AND v.status = 'aktiv'`;
      const params = [neuer_tarif_id, vertrag_id];
      if (secureDojoId) { sql += ' AND m.dojo_id = ?'; params.push(secureDojoId); }
      const [result] = await pool.query(sql, params);
      if (result.affectedRows > 0) migriert++; else fehler++;
    } catch (e) {
      logger.error('Tarif-Migration Fehler:', { error: e, vertrag_id, neuer_tarif_id });
      fehler++;
    }
  }

  logger.info(`Tarif-Migration: ${migriert} migriert, ${fehler} Fehler`, { user: req.user?.id });
  res.json({ success: true, migriert, fehler });
});

// ✅ API: Terminierte Beitragserhöhung stornieren (pending Terminierungen zurücksetzen)
router.delete("/filter/tarif-abweichung/terminierung", async (req, res) => {
  const role = req.user?.rolle;
  if (role !== 'admin' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Nur für Admins' });
  }

  const secureDojoId = getSecureDojoId(req);

  const conn = await db.promise().getConnection();
  try {
    await conn.beginTransaction();

    // 1. Vertraege: neuer_monatsbeitrag + neuer_beitrag_ab zurücksetzen
    let vertraegeQuery = `
      UPDATE vertraege v
      JOIN mitglieder m ON m.mitglied_id = v.mitglied_id
      SET v.neuer_monatsbeitrag = NULL,
          v.neuer_beitrag_ab = NULL
      WHERE v.neuer_beitrag_ab IS NOT NULL
        AND v.neuer_monatsbeitrag IS NOT NULL
        AND v.status = 'aktiv'
        AND m.aktiv = 1
    `;
    const vertraegeParams = [];
    if (secureDojoId) {
      vertraegeQuery += ' AND m.dojo_id = ?';
      vertraegeParams.push(secureDojoId);
    }

    const [vertraegeResult] = await conn.query(vertraegeQuery, vertraegeParams);

    // 2. Schrittweise Erhöhungen löschen (nur noch nicht angewendete)
    let schritteQuery = `
      DELETE s FROM vertrag_beitrag_schritte s
      JOIN mitglieder m ON m.mitglied_id = s.mitglied_id
      WHERE s.angewendet_am IS NULL
        AND m.aktiv = 1
    `;
    const schritteParams = [];
    if (secureDojoId) {
      schritteQuery += ' AND m.dojo_id = ?';
      schritteParams.push(secureDojoId);
    }

    const [schritteResult] = await conn.query(schritteQuery, schritteParams);
    await conn.commit();

    // 3. Audit-Log
    await auditLog.log({
      req,
      aktion: auditLog.AKTION.TARIFERHOEHUNG,
      kategorie: auditLog.KATEGORIE.FINANZEN,
      entityType: 'vertraege',
      beschreibung: `Beitragserhöhung storniert: ${vertraegeResult.affectedRows} Terminierungen zurückgesetzt, ${schritteResult.affectedRows} Schritte gelöscht`,
      dojoId: secureDojoId,
      neueWerte: { storniert: vertraegeResult.affectedRows, schritte_geloescht: schritteResult.affectedRows }
    });

    logger.info(`Beitragserhöhung storniert: ${vertraegeResult.affectedRows} Verträge zurückgesetzt`, { user: req.user?.id });
    res.json({ success: true, storniert: vertraegeResult.affectedRows, schritteGeloescht: schritteResult.affectedRows });
  } catch (err) {
    await conn.rollback();
    logger.error('Fehler bei Stornierung:', { error: err });
    res.status(500).json({ error: 'Fehler bei der Stornierung' });
  } finally {
    conn.release();
  }
});

// ✅ API: Test-Mail an Admin senden (Vorschau der Beitragserhöhungs-E-Mail)
router.post("/filter/tarif-abweichung/test-mail", async (req, res) => {
  const role = req.user?.rolle;
  if (role !== 'admin' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Nur für Admins' });
  }

  const { erhoehung, erhoehungProzent, typ, vorlage, gueltigAb, grund } = req.body;
  const betrag  = parseFloat(erhoehung) || 0;
  const prozent = parseFloat(erhoehungProzent) || 0;
  const grundText = typeof grund === 'string' ? grund.trim().slice(0, 800) : '';

  if (!['formell', 'freundlich', 'kurz'].includes(vorlage)) return res.status(400).json({ error: 'Ungültige Vorlage' });
  if (!gueltigAb) return res.status(400).json({ error: 'Gültigkeitsdatum fehlt' });

  try {
    // Admin-Email aus DB holen
    const [userRows] = await db.promise().query('SELECT email, username FROM users WHERE id = ?', [req.user.id]);
    const adminEmail = userRows[0]?.email;
    if (!adminEmail) return res.status(400).json({ error: 'Keine E-Mail-Adresse für Admin hinterlegt' });

    // Beispiel-Beträge für die Test-Mail
    const alterBetrag = 45.00;
    const neuerBetrag = typ === 'prozent'
      ? Math.round(alterBetrag * (1 + prozent / 100) * 100) / 100
      : Math.round((alterBetrag + betrag) * 100) / 100;

    const datumFormatiert = new Date(gueltigAb).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const fmt = v => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
    const alt = fmt(alterBetrag);
    const neu = fmt(neuerBetrag);

    const grundAbsatz = grundText
      ? `\n\n${grundText}`
      : '\n\nDiese Anpassung ist notwendig, um die langfristige Qualität unserer Angebote und Trainings sicherzustellen.';
    const grundHtml = grundText
      ? `<p>${grundText.replace(/\n/g, '<br>')}</p>`
      : '<p>Diese Anpassung ist notwendig, um die langfristige Qualität unserer Angebote und Trainings sicherzustellen.</p>';

    let subject, html, text;
    if (vorlage === 'formell') {
      subject = `[TEST] Ankündigung Beitragsanpassung ab ${datumFormatiert}`;
      text = `Sehr geehrte/r Mustermann,\n\nwir möchten Sie hiermit über eine Anpassung Ihres monatlichen Mitgliedsbeitrags informieren.\n\nAb dem ${datumFormatiert} beträgt Ihr monatlicher Beitrag ${neu} (bisher: ${alt}).${grundAbsatz}\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen\nIhr Dojo`;
      html = `<p><strong>[TEST-MAIL]</strong></p><p>Sehr geehrte/r <strong>Mustermann</strong>,</p><p>wir möchten Sie hiermit über eine Anpassung Ihres monatlichen Mitgliedsbeitrags informieren.</p><p>Ab dem <strong>${datumFormatiert}</strong> beträgt Ihr monatlicher Beitrag <strong>${neu}</strong> (bisher: ${alt}).</p>${grundHtml}<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p><p>Mit freundlichen Grüßen<br><strong>Ihr Dojo</strong></p>`;
    } else if (vorlage === 'freundlich') {
      subject = `[TEST] Dein Beitrag ändert sich ab ${datumFormatiert}`;
      text = `Hallo Max,\n\nwir möchten dich über eine Anpassung deines monatlichen Mitgliedsbeitrags informieren.\n\nAb dem ${datumFormatiert} beträgt dein monatlicher Beitrag ${neu} (bisher: ${alt}).${grundAbsatz}\n\nWir danken dir für deine Mitgliedschaft!\n\nHerzliche Grüße\nIhr Dojo`;
      html = `<p><strong>[TEST-MAIL]</strong></p><p>Hallo <strong>Max</strong>,</p><p>wir möchten dich über eine Anpassung deines monatlichen Mitgliedsbeitrags informieren.</p><p>Ab dem <strong>${datumFormatiert}</strong> beträgt dein monatlicher Beitrag <strong>${neu}</strong> (bisher: ${alt}).</p>${grundHtml}<p>Wir danken dir für deine Mitgliedschaft!</p><p>Herzliche Grüße<br><strong>Ihr Dojo</strong></p>`;
    } else {
      subject = `[TEST] Beitragsänderung ab ${datumFormatiert}`;
      text = `Max Mustermann,\n\nab dem ${datumFormatiert} wird dein monatlicher Mitgliedsbeitrag von ${alt} auf ${neu} angepasst.${grundText ? '\n\n' + grundText : ''}\n\nIhr Dojo`;
      html = `<p><strong>[TEST-MAIL]</strong></p><p>Max Mustermann,</p><p>ab dem <strong>${datumFormatiert}</strong> wird dein monatlicher Mitgliedsbeitrag von ${alt} auf <strong>${neu}</strong> angepasst.</p>${grundText ? `<p>${grundText.replace(/\n/g, '<br>')}</p>` : ''}<p>Ihr Dojo</p>`;
    }

    const secureDojoId = getSecureDojoId(req);
    if (secureDojoId) {
      await sendEmailForDojo({ to: adminEmail, subject, html, text }, secureDojoId);
    } else {
      await sendEmail({ to: adminEmail, subject, html, text });
    }

    logger.info(`Test-Mail gesendet an ${adminEmail}`, { user: req.user?.id });
    res.json({ success: true, to: adminEmail });
  } catch (err) {
    logger.error('Test-Mail fehlgeschlagen:', { error: err });
    res.status(500).json({ error: 'Test-Mail konnte nicht gesendet werden: ' + err.message });
  }
});

// ✅ API: Terminierte Beitragserhöhung stornieren (pending Terminierungen zurücksetzen)
router.delete("/filter/tarif-abweichung/terminierung", async (req, res) => {
  const role = req.user?.rolle;
  if (role !== 'admin' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Nur für Admins' });
  }

  const secureDojoId = getSecureDojoId(req);

  const conn = await db.promise().getConnection();
  try {
    await conn.beginTransaction();

    // 1. Vertraege: neuer_monatsbeitrag + neuer_beitrag_ab zurücksetzen
    let vertraegeQuery = `
      UPDATE vertraege v
      JOIN mitglieder m ON m.mitglied_id = v.mitglied_id
      SET v.neuer_monatsbeitrag = NULL,
          v.neuer_beitrag_ab = NULL
      WHERE v.neuer_beitrag_ab IS NOT NULL
        AND v.neuer_monatsbeitrag IS NOT NULL
        AND v.status = 'aktiv'
        AND m.aktiv = 1
    `;
    const vertraegeParams = [];
    if (secureDojoId) {
      vertraegeQuery += ' AND m.dojo_id = ?';
      vertraegeParams.push(secureDojoId);
    }

    const [vertraegeResult] = await conn.query(vertraegeQuery, vertraegeParams);

    // 2. Schrittweise Erhöhungen löschen (nur noch nicht angewendete)
    let schritteQuery = `
      DELETE s FROM vertrag_beitrag_schritte s
      JOIN mitglieder m ON m.mitglied_id = s.mitglied_id
      WHERE s.angewendet_am IS NULL
        AND m.aktiv = 1
    `;
    const schritteParams = [];
    if (secureDojoId) {
      schritteQuery += ' AND m.dojo_id = ?';
      schritteParams.push(secureDojoId);
    }

    const [schritteResult] = await conn.query(schritteQuery, schritteParams);
    await conn.commit();

    // 3. Audit-Log
    await auditLog.log({
      req,
      aktion: auditLog.AKTION.TARIFERHOEHUNG,
      kategorie: auditLog.KATEGORIE.FINANZEN,
      entityType: 'vertraege',
      beschreibung: `Beitragserhöhung storniert: ${vertraegeResult.affectedRows} Terminierungen zurückgesetzt, ${schritteResult.affectedRows} Schritte gelöscht`,
      dojoId: secureDojoId,
      neueWerte: { storniert: vertraegeResult.affectedRows, schritte_geloescht: schritteResult.affectedRows }
    });

    logger.info(`Beitragserhöhung storniert: ${vertraegeResult.affectedRows} Verträge zurückgesetzt`, { user: req.user?.id });
    res.json({ success: true, storniert: vertraegeResult.affectedRows, schritteGeloescht: schritteResult.affectedRows });
  } catch (err) {
    await conn.rollback();
    logger.error('Fehler bei Stornierung:', { error: err });
    res.status(500).json({ error: 'Fehler bei der Stornierung' });
  } finally {
    conn.release();
  }
});

// ✅ API: Test-Mail an Admin senden (Vorschau der Beitragserhöhungs-E-Mail)
router.post("/filter/tarif-abweichung/test-mail", async (req, res) => {
  const role = req.user?.rolle;
  if (role !== 'admin' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Nur für Admins' });
  }

  const { erhoehung, erhoehungProzent, typ, vorlage, gueltigAb, grund } = req.body;
  const betrag  = parseFloat(erhoehung) || 0;
  const prozent = parseFloat(erhoehungProzent) || 0;
  const grundText = typeof grund === 'string' ? grund.trim().slice(0, 800) : '';

  if (!['formell', 'freundlich', 'kurz'].includes(vorlage)) return res.status(400).json({ error: 'Ungültige Vorlage' });
  if (!gueltigAb) return res.status(400).json({ error: 'Gültigkeitsdatum fehlt' });

  try {
    const [userRows] = await db.promise().query('SELECT email, username FROM users WHERE id = ?', [req.user.id]);
    const adminEmail = userRows[0]?.email;
    if (!adminEmail) return res.status(400).json({ error: 'Keine E-Mail-Adresse für Admin hinterlegt' });

    const alterBetrag = 45.00;
    const neuerBetrag = typ === 'prozent'
      ? Math.round(alterBetrag * (1 + prozent / 100) * 100) / 100
      : Math.round((alterBetrag + betrag) * 100) / 100;

    const datumFormatiert = new Date(gueltigAb).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const fmt = v => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
    const alt = fmt(alterBetrag);
    const neu = fmt(neuerBetrag);

    const grundAbsatz = grundText
      ? `\n\n${grundText}`
      : '\n\nDiese Anpassung ist notwendig, um die langfristige Qualität unserer Angebote und Trainings sicherzustellen.';
    const grundHtml = grundText
      ? `<p>${grundText.replace(/\n/g, '<br>')}</p>`
      : '<p>Diese Anpassung ist notwendig, um die langfristige Qualität unserer Angebote und Trainings sicherzustellen.</p>';

    let subject, html, text;
    if (vorlage === 'formell') {
      subject = `[TEST] Ankündigung Beitragsanpassung ab ${datumFormatiert}`;
      text = `Sehr geehrte/r Mustermann,\n\nwir möchten Sie hiermit über eine Anpassung Ihres monatlichen Mitgliedsbeitrags informieren.\n\nAb dem ${datumFormatiert} beträgt Ihr monatlicher Beitrag ${neu} (bisher: ${alt}).${grundAbsatz}\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen\nIhr Dojo`;
      html = `<p><strong>[TEST-MAIL]</strong></p><p>Sehr geehrte/r <strong>Mustermann</strong>,</p><p>wir möchten Sie hiermit über eine Anpassung Ihres monatlichen Mitgliedsbeitrags informieren.</p><p>Ab dem <strong>${datumFormatiert}</strong> beträgt Ihr monatlicher Beitrag <strong>${neu}</strong> (bisher: ${alt}).</p>${grundHtml}<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p><p>Mit freundlichen Grüßen<br><strong>Ihr Dojo</strong></p>`;
    } else if (vorlage === 'freundlich') {
      subject = `[TEST] Dein Beitrag ändert sich ab ${datumFormatiert}`;
      text = `Hallo Max,\n\nwir möchten dich über eine Anpassung deines monatlichen Mitgliedsbeitrags informieren.\n\nAb dem ${datumFormatiert} beträgt dein monatlicher Beitrag ${neu} (bisher: ${alt}).${grundAbsatz}\n\nWir danken dir für deine Mitgliedschaft!\n\nHerzliche Grüße\nIhr Dojo`;
      html = `<p><strong>[TEST-MAIL]</strong></p><p>Hallo <strong>Max</strong>,</p><p>wir möchten dich über eine Anpassung deines monatlichen Mitgliedsbeitrags informieren.</p><p>Ab dem <strong>${datumFormatiert}</strong> beträgt dein monatlicher Beitrag <strong>${neu}</strong> (bisher: ${alt}).</p>${grundHtml}<p>Wir danken dir für deine Mitgliedschaft!</p><p>Herzliche Grüße<br><strong>Ihr Dojo</strong></p>`;
    } else {
      subject = `[TEST] Beitragsänderung ab ${datumFormatiert}`;
      text = `Max Mustermann,\n\nab dem ${datumFormatiert} wird dein monatlicher Mitgliedsbeitrag von ${alt} auf ${neu} angepasst.${grundText ? '\n\n' + grundText : ''}\n\nIhr Dojo`;
      html = `<p><strong>[TEST-MAIL]</strong></p><p>Max Mustermann,</p><p>ab dem <strong>${datumFormatiert}</strong> wird dein monatlicher Mitgliedsbeitrag von ${alt} auf <strong>${neu}</strong> angepasst.</p>${grundText ? `<p>${grundText.replace(/\n/g, '<br>')}</p>` : ''}<p>Ihr Dojo</p>`;
    }

    const secureDojoId = getSecureDojoId(req);
    if (secureDojoId) {
      await sendEmailForDojo({ to: adminEmail, subject, html, text }, secureDojoId);
    } else {
      await sendEmail({ to: adminEmail, subject, html, text });
    }

    logger.info(`Test-Mail gesendet an ${adminEmail}`, { user: req.user?.id });
    res.json({ success: true, to: adminEmail });
  } catch (err) {
    logger.error('Test-Mail fehlgeschlagen:', { error: err });
    res.status(500).json({ error: 'Test-Mail konnte nicht gesendet werden: ' + err.message });
  }
});

// ✅ API: Mitglieder nach Zahlungsweise filtern (MUSS VOR /:id Route stehen!)

module.exports = router;

