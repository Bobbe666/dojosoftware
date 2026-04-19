const { authenticateToken } = require("../middleware/auth");
const express = require("express");
const logger = require('../utils/logger');
const db = require("../db"); // Verbindung zur DB importieren
const SepaPdfGenerator = require("../utils/sepaPdfGenerator");
const MitgliedsausweisGenerator = require("../utils/mitgliedsausweisGenerator");
const bcrypt = require("bcryptjs"); // Für Passwort-Hashing
const auditLog = require("../services/auditLogService");
const { requireFields, validateEmail, validateDate, validateId, sanitizeStrings } = require('../middleware/validation');
const { sendEmail, sendEmailForDojo } = require('../services/emailService');
const webpush = require('web-push');
const router = express.Router();

// IBAN maskieren: erste 4 + letzte 4 Zeichen sichtbar, Rest mit *
const maskIBAN = (iban) => {
  if (!iban) return iban;
  const clean = iban.replace(/\s/g, "");
  if (clean.length <= 8) return iban;
  return clean.slice(0, 4) + "*".repeat(clean.length - 8) + clean.slice(-4);
};

// VAPID für Push-Benachrichtigungen konfigurieren
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@dojo.tda-intl.org',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * 🔒 SICHERHEIT: Extrahiert die gültige dojo_id aus dem Request
 * - Für normale User: Erzwingt req.user.dojo_id (ignoriert Query-Parameter)
 * - Für Super-Admins: Erlaubt alle Dojos
 * @returns {number|null} dojo_id oder null für Super-Admin
 */
function getSecureDojoId(req) {
  const userDojoId = req.user?.dojo_id;
  const userRole = req.user?.rolle;

  // Super-Admin (role=super_admin ODER admin mit dojo_id=null) darf alles
  const isSuperAdmin = userRole === 'super_admin' || (userRole === 'admin' && !userDojoId);

  if (isSuperAdmin) {
    // Super-Admin darf optional ein Dojo aus Query wählen, oder alle sehen
    const queryDojoId = req.query.dojo_id;
    if (queryDojoId && queryDojoId !== 'all') {
      return parseInt(queryDojoId, 10);
    }
    return null; // null = alle Dojos
  }

  // Normale User: IMMER ihr eigenes Dojo
  return userDojoId ? parseInt(userDojoId, 10) : null;
}

/**
 * 🔒 SICHERHEIT: Prüft ob User auf ein bestimmtes Dojo zugreifen darf
 */
function canAccessDojo(req, targetDojoId) {
  const userDojoId = req.user?.dojo_id;
  const userRole = req.user?.rolle;
  const isSuperAdmin = userRole === 'super_admin' || (userRole === 'admin' && !userDojoId);

  return isSuperAdmin || userDojoId === targetDojoId;
}

// Mock-Daten wurden entfernt - verwende immer echte Datenbank

// ✅ NEU: API für Anwesenheit – aktive Mitglieder nach Stil filtern + DOJO-FILTER
router.get("/", (req, res) => {
    const { stil, search, limit } = req.query;

    // 🔒 SICHERHEIT: Hole sichere dojo_id aus Token (nicht aus Query!)
    const secureDojoId = getSecureDojoId(req);

    // 🔒 DOJO-FILTER: Baue WHERE-Bedingungen
    let whereConditions = ['m.aktiv = 1'];
    let queryParams = [];

    // Stil-Filter
    if (stil) {
        whereConditions.push('ms.stil = ?');
        queryParams.push(stil);
    }

    // 🔒 Dojo-Filter (erzwungen für normale User)
    if (secureDojoId) {
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(secureDojoId);
    } else if (req.query.dojo_ids) {
        const dojoIds = req.query.dojo_ids.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (dojoIds.length > 0) {
            whereConditions.push(`m.dojo_id IN (${dojoIds.map(() => '?').join(',')})`);
            queryParams.push(...dojoIds);
        }
    }

    // Suchfilter (Name, Mitgliedsnummer)
    if (search) {
        const s = '%' + search + '%';
        whereConditions.push('(m.vorname LIKE ? OR m.nachname LIKE ? OR m.magicline_customer_number LIKE ? OR CONCAT(m.vorname, \' \', m.nachname) LIKE ?)');
        queryParams.push(s, s, s, s);
    }
    const limitClause = limit ? `LIMIT ${parseInt(limit, 10) || 20}` : '';
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    if (stil) {
        const query = `
            SELECT DISTINCT m.mitglied_id, m.vorname, m.nachname, m.geschlecht, DATE_FORMAT(m.geburtsdatum, '%Y-%m-%d') AS geburtsdatum, m.strasse as adresse, m.hausnummer, m.plz, m.ort, m.email, m.telefon_mobil, m.foto_pfad
            FROM mitglieder m
            JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
            ${whereClause}
            ORDER BY m.nachname, m.vorname
        `;

        db.query(query, queryParams, (err, results) => {
            if (err) {
                logger.error('Fehler beim Filtern der Mitglieder:', err);
                return res.status(500).json({ error: "Fehler beim Filtern der Mitglieder" });
            }

            res.json(results);
        });
    } else {
        // Standard: Alle aktiven Mitglieder
        const query = `
            SELECT mitglied_id, vorname, nachname, magicline_customer_number AS mitgliedsnummer, geschlecht, DATE_FORMAT(geburtsdatum, '%Y-%m-%d') AS geburtsdatum, strasse as adresse, hausnummer, plz, ort, email, telefon_mobil, foto_pfad
            FROM mitglieder m
            ${whereClause}
            ORDER BY nachname, vorname
            ${limitClause}
        `;

        db.query(query, queryParams, (err, results) => {
            if (err) {
                logger.error('Fehler beim Laden der Mitglieder:', err);
                return res.status(500).json({ error: "Fehler beim Laden der Mitglieder" });
            }

            res.json(results);
        });
    }
});

// ✅ API: Alle Mitglieder abrufen (inkl. Stile) - ERWEITERT + DOJO-FILTER
router.get("/all", (req, res) => {
    // 🔒 SICHERHEIT: Hole sichere dojo_id aus Token
    const secureDojoId = getSecureDojoId(req);

    // 🔒 DOJO-FILTER: Baue WHERE-Clause
    let whereClause = '';
    let queryParams = [];

    if (secureDojoId) {
        whereClause = 'WHERE m.dojo_id = ?';
        queryParams.push(secureDojoId);
    } else if (req.query.dojo_ids) {
        // Super-Admin mit mehreren Dojos (z.B. "2,3")
        const dojoIds = req.query.dojo_ids.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (dojoIds.length > 0) {
            whereClause = `WHERE m.dojo_id IN (${dojoIds.map(() => '?').join(',')})`;
            queryParams.push(...dojoIds);
        }
    }

    const query = `
        SELECT
            m.mitglied_id,
            m.vorname,
            m.nachname,
            m.geburtsdatum,
            m.gurtfarbe,
            m.graduierung_id,
            COALESCE(
                GROUP_CONCAT(DISTINCT g_stil.name ORDER BY g_stil.name SEPARATOR ', '),
                g.name
            ) AS aktuelle_graduierung,
            m.email,
            m.telefon_mobil,
            m.aktiv,
            m.eintrittsdatum,
            m.dojo_id,
            -- 🆕 Medizinische Informationen
            m.allergien,
            m.notfallkontakt_name,
            m.notfallkontakt_telefon,
            -- 🆕 Prüfungsmanagement
            m.naechste_pruefung_datum,
            m.pruefungsgebuehr_bezahlt,
            -- 🆕 Compliance
            m.hausordnung_akzeptiert,
            m.datenschutz_akzeptiert,
            m.foto_einverstaendnis,
            -- 🆕 Familie
            m.familien_id,
            m.rabatt_prozent,
            m.trainingsstunden,
            COALESCE(GROUP_CONCAT(DISTINCT ms.stil ORDER BY ms.stil SEPARATOR ', '), '') AS stile,
            -- Foto
            m.foto_pfad
        FROM mitglieder m
        LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
        LEFT JOIN graduierungen g ON m.graduierung_id = g.graduierung_id
        LEFT JOIN mitglied_stil_data msd ON m.mitglied_id = msd.mitglied_id
        LEFT JOIN graduierungen g_stil ON msd.current_graduierung_id = g_stil.graduierung_id
        ${whereClause}
        GROUP BY m.mitglied_id
        ORDER BY m.nachname, m.vorname
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen der Mitglieder:', err);
            return res.status(500).json({ error: "Fehler beim Laden der Mitglieder" });
        }

        if (!results || results.length === 0) {
            // ✅ Bei 0 Mitgliedern: 200 OK mit leerem Array (kein 404!)
            return res.status(200).json([]);
        }

        res.json(results);
    });
});

// ✅ API: Mitglied über Email abrufen (für MemberDashboard)
router.get("/by-email/:email", (req, res) => {
    const { email } = req.params;

    const query = `
        SELECT
            -- Stammdaten
            m.mitglied_id,
            m.vorname,
            m.nachname,
            m.geburtsdatum,
            m.geschlecht,
            m.gewicht,
            m.gurtfarbe,
            m.dojo_id,
            m.trainingsstunden,

            -- Kontaktdaten
            m.email,
            m.telefon,
            m.telefon_mobil,
            m.strasse,
            m.hausnummer,
            m.plz,
            m.ort,

            -- Zahlungsdaten
            m.iban,
            m.bic,
            m.bankname,
            m.zahlungsmethode,
            m.zahllaufgruppe,

            -- Status
            m.eintrittsdatum,
            m.gekuendigt_am,
            m.aktiv,

            -- Medizinische Informationen
            m.allergien,
            m.medizinische_hinweise,
            m.notfallkontakt_name,
            m.notfallkontakt_telefon,
            m.notfallkontakt_verhaeltnis,

            -- Prüfungsmanagement
            m.naechste_pruefung_datum,
            m.pruefungsgebuehr_bezahlt,
            m.trainer_empfehlung,

            -- Dokumente/Compliance
            m.hausordnung_akzeptiert,
            m.datenschutz_akzeptiert,
            m.foto_einverstaendnis,
            m.vereinsordnung_datum,

            -- Familienmanagement
            m.familien_id,
            m.rabatt_prozent,
            m.rabatt_grund,

            -- Stile
            COALESCE(GROUP_CONCAT(DISTINCT ms.stil ORDER BY ms.stil SEPARATOR ', '), '') AS stile,
            -- Foto
            m.foto_pfad
        FROM mitglieder m
        LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
        WHERE m.email = ?
        GROUP BY m.mitglied_id
    `;

    db.query(query, [email], (err, result) => {
        if (err) {
            logger.error('Fehler beim Abrufen des Mitglieds über Email:', err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Mitgliedsdaten" });
        }

        if (!result || result.length === 0) {

            return res.status(404).json({ error: `Mitglied mit Email ${email} nicht gefunden.` });
        }

        res.json(result[0]);
    });
});

// ✅ API: Alle verfügbaren Stile abrufen (MUSS VOR /:id Route stehen!)
router.get("/filter-options/stile", (req, res) => {
  const query = `
    SELECT name
    FROM stile
    WHERE aktiv = 1
    ORDER BY name
  `;

  db.query(query, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Stile:', err);
      return res.status(500).json({ error: "Fehler beim Laden der Stile" });
    }

    const stile = results.map(r => r.name);
    res.json({ success: true, stile });
  });
});

// ✅ API: Alle verfügbaren Gurte/Graduierungen abrufen (MUSS VOR /:id Route stehen!)
router.get("/filter-options/gurte", (req, res) => {
  const query = `
    SELECT DISTINCT g.name, g.reihenfolge
    FROM graduierungen g
    INNER JOIN mitglied_stil_data msd ON g.graduierung_id = msd.current_graduierung_id
    INNER JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id
    WHERE m.aktiv = 1
    ORDER BY g.reihenfolge
  `;

  db.query(query, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Gurte:', err);
      return res.status(500).json({ error: "Fehler beim Laden der Gurte" });
    }

    const gurte = results.map(r => r.name);
    res.json({ success: true, gurte });
  });
});

// ✅ API: Mitglieder ohne SEPA-Mandat (MUSS VOR /:id Route stehen!)
router.get("/filter/ohne-sepa", (req, res) => {
  // 🔒 SICHERHEIT: Hole sichere dojo_id aus Token
  const secureDojoId = getSecureDojoId(req);

  // 🔒 DOJO-FILTER: Baue WHERE-Clause
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
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.email,
      m.zahlungsmethode,
      m.aktiv,
      v.monatsbeitrag
    FROM mitglieder m
    LEFT JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
    LEFT JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv'
    ${whereClause}
    ORDER BY m.nachname, m.vorname
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Mitglieder ohne SEPA:', err);
      return res.status(500).json({ error: "Fehler beim Laden der Mitglieder" });
    }

    res.json({ success: true, data: results });
  });
});

// ✅ API: Mitglieder ohne Vertrag (MUSS VOR /:id Route stehen!)
router.get("/filter/ohne-vertrag", (req, res) => {
  // 🔒 SICHERHEIT: Hole sichere dojo_id aus Token
  const secureDojoId = getSecureDojoId(req);

  // 🔒 DOJO-FILTER: Baue WHERE-Clause
  let whereConditions = [
    "m.aktiv = 1",
    "v.vertrag_id IS NULL"
  ];
  let queryParams = [];

  if (secureDojoId) {
    whereConditions.push('m.dojo_id = ?');
    queryParams.push(secureDojoId);
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

  const query = `
    SELECT DISTINCT
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.email,
      m.zahlungsmethode,
      m.aktiv,
      NULL as monatsbeitrag
    FROM mitglieder m
    LEFT JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv'
    ${whereClause}
    ORDER BY m.nachname, m.vorname
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Mitglieder ohne Vertrag:', err);
      return res.status(500).json({ error: "Fehler beim Laden der Mitglieder" });
    }

    res.json({ success: true, data: results });
  });
});

// ✅ API: Mitglieder mit Tarif-Abweichungen (MUSS VOR /:id Route stehen!)
router.get("/filter/tarif-abweichung", (req, res) => {
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

  // nt = Nachfolger-Tarif (falls archivierter Tarif einen Nachfolger hat)
  const query = `
    SELECT
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.email,
      m.zahlungsmethode,
      m.geburtsdatum,
      m.aktiv,
      v.id            AS vertrag_id,
      v.monatsbeitrag,
      v.tarif_id,
      v.billing_cycle AS vertrag_billing_cycle,
      t.name          AS tarif_name,
      t.price_cents,
      t.billing_cycle AS tarif_billing_cycle,
      t.altersgruppe,
      t.ist_archiviert,
      t.nachfolger_tarif_id,
      nt.name         AS nachfolger_tarif_name,
      nt.price_cents  AS nachfolger_price_cents,

      -- Erwarteter Monatsbeitrag:
      --   kein Tarif         → NULL
      --   archiviert + Nachfolger → Nachfolger-Preis
      --   archiviert ohne Nachfolger → Archiv-Preis (Hinweis ohne echte Vergleichsbasis)
      --   aktiv              → Tarif-Preis
      CASE
        WHEN v.tarif_id IS NULL THEN NULL
        WHEN t.ist_archiviert = 1 AND nt.id IS NOT NULL
          THEN ROUND(nt.price_cents / 100, 2)
        ELSE ROUND(
          CASE
            WHEN t.billing_cycle = 'MONTHLY'   THEN t.price_cents / 100
            WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
            WHEN t.billing_cycle = 'YEARLY'    THEN (t.price_cents / 100) / 12
            ELSE t.price_cents / 100
          END, 2)
      END AS erwarteter_monatsbeitrag,

      -- Differenz: Ist − Soll. NULL wenn kein Soll-Vergleich möglich.
      CASE
        WHEN v.tarif_id IS NULL THEN NULL
        WHEN t.ist_archiviert = 1 AND nt.id IS NULL THEN NULL
        WHEN t.ist_archiviert = 1 AND nt.id IS NOT NULL
          THEN ROUND(v.monatsbeitrag - (nt.price_cents / 100), 2)
        ELSE ROUND(
          v.monatsbeitrag -
          CASE
            WHEN t.billing_cycle = 'MONTHLY'   THEN t.price_cents / 100
            WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
            WHEN t.billing_cycle = 'YEARLY'    THEN (t.price_cents / 100) / 12
            ELSE t.price_cents / 100
          END, 2)
      END AS differenz,

      -- Lesbarer Abweichungsgrund
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
        ELSE
          CONCAT(
            'Zahlt ', FORMAT(v.monatsbeitrag, 2),
            ' € statt ',
            FORMAT(ROUND(CASE
              WHEN t.billing_cycle = 'MONTHLY'   THEN t.price_cents / 100
              WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
              WHEN t.billing_cycle = 'YEARLY'    THEN (t.price_cents / 100) / 12
              ELSE t.price_cents / 100
            END, 2), 2),
            ' €/Monat (', t.name, ')'
          )
      END AS abweichung_grund

    FROM mitglieder m
    JOIN vertraege v  ON m.mitglied_id = v.mitglied_id
    JOIN dojo d       ON m.dojo_id = d.id
    LEFT JOIN tarife t  ON v.tarif_id = t.id
    LEFT JOIN tarife nt ON t.nachfolger_tarif_id = nt.id
    ${whereClause}
    ORDER BY
      CASE WHEN t.ist_archiviert = 1 THEN 0
           WHEN v.tarif_id IS NULL THEN 1
           ELSE 2 END,
      m.nachname, m.vorname
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Mitglieder mit Tarif-Abweichung:', err);
      return res.status(500).json({ error: "Fehler beim Laden der Mitglieder" });
    }

    const statistik = {
      gesamt: results.length,
      archivierterTarif: 0,
      archivierterTarifMitNachfolger: 0,
      zuViel: 0,
      zuWenig: 0,
      keinTarif: 0,
      summeArchiviert: 0,
      summeZuViel: 0,
      summeZuWenig: 0,
      potenzialBeiMigration: 0  // möglicher Mehrumsatz wenn alle auf Nachfolger-Tarif
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
          // Potenzial = was Nachfolger kosten würde minus was der Mitglieder zahlt
          if (diff !== null && diff < 0) {
            statistik.potenzialBeiMigration += Math.abs(diff);
          }
        }
      } else if (diff !== null && diff > 0) {
        statistik.zuViel++;
        statistik.summeZuViel += diff;
      } else if (diff !== null && diff < 0) {
        statistik.zuWenig++;
        statistik.summeZuWenig += Math.abs(diff);
      }
    });

    res.json({ success: true, data: results, statistik });
  });
});

// ✅ API: Vorschau der Beitragserhöhung (welche Mitglieder, alte/neue Beträge)
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
  // Aktiver Tarif → Cap am Tarif-Preis. Archivierter Tarif → kein Cap (999999), kann immer erhöht werden.
  const tarifCapExpr = `CASE WHEN t.id IS NOT NULL AND t.ist_archiviert = 0 THEN ${tarifPreisExpr} ELSE 999999 END`;

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
      d.dojoname,
      t.name AS tarif_name,
      t.ist_archiviert AS tarif_archiviert,
      v.mindestlaufzeit_monate,
      v.vertragsbeginn,
      v.vertragsende,
      v.billing_cycle AS vertrag_billing_cycle
    FROM mitglieder m
    JOIN vertraege v ON v.mitglied_id = m.mitglied_id AND v.status = 'aktiv'
    JOIN dojo d ON m.dojo_id = d.id AND d.ist_aktiv = 1 AND d.dojoname NOT LIKE '%demo%'
    LEFT JOIN tarife t ON v.tarif_id = t.id
    WHERE m.aktiv = 1
    AND v.tarif_id IS NOT NULL
    AND (
      t.ist_archiviert = 1
      OR ROUND(v.monatsbeitrag, 2) < ${tarifPreisExpr}
    )
    AND NOT (
      t.ist_archiviert = 1
      AND EXISTS (
        SELECT 1 FROM tarife t2
        WHERE t2.ist_archiviert = 0 AND t2.active = 1
        AND t2.dojo_id = m.dojo_id
        AND ROUND(CASE
          WHEN t2.billing_cycle = 'MONTHLY'   THEN t2.price_cents / 100
          WHEN t2.billing_cycle = 'QUARTERLY' THEN (t2.price_cents / 100) / 3
          WHEN t2.billing_cycle = 'YEARLY'    THEN (t2.price_cents / 100) / 12
          ELSE t2.price_cents / 100
        END, 2) = ROUND(v.monatsbeitrag, 2)
      )
    )
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
  const tarifCapExpr = `CASE WHEN t.id IS NOT NULL AND t.ist_archiviert = 0 THEN ${tarifPreisExpr} ELSE 999999 END`;

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
    UPDATE vertraege v
    LEFT JOIN tarife t ON v.tarif_id = t.id
    JOIN mitglieder m ON v.mitglied_id = m.mitglied_id AND m.aktiv = 1
    JOIN dojo d ON m.dojo_id = d.id AND d.ist_aktiv = 1 AND d.dojoname NOT LIKE '%demo%'
    SET v.monatsbeitrag = ${neuerBetragExpr}
    WHERE v.status = 'aktiv'
    AND v.tarif_id IS NOT NULL
    AND (
      t.ist_archiviert = 1
      OR ROUND(v.monatsbeitrag, 2) < ${tarifPreisExpr}
    )
    AND NOT (
      t.ist_archiviert = 1
      AND EXISTS (
        SELECT 1 FROM tarife t2
        WHERE t2.ist_archiviert = 0 AND t2.active = 1
        AND t2.dojo_id = m.dojo_id
        AND ROUND(CASE
          WHEN t2.billing_cycle = 'MONTHLY'   THEN t2.price_cents / 100
          WHEN t2.billing_cycle = 'QUARTERLY' THEN (t2.price_cents / 100) / 3
          WHEN t2.billing_cycle = 'YEARLY'    THEN (t2.price_cents / 100) / 12
          ELSE t2.price_cents / 100
        END, 2) = ROUND(v.monatsbeitrag, 2)
      )
    )
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

  const { erhoehung, erhoehungProzent, typ, vorlage, gueltigAb, grund, ausschluss, schritte: schritteRaw } = req.body;
  const betrag  = parseFloat(erhoehung) || 0;
  const prozent = parseFloat(erhoehungProzent) || 0;
  const grundText = typeof grund === 'string' ? grund.trim().slice(0, 800) : '';
  const ausschlussIds = Array.isArray(ausschluss) ? ausschluss.map(Number).filter(n => n > 0) : [];
  const validSchritte = Array.isArray(schritteRaw)
    ? schritteRaw.filter(s => s && s.datum && s.betrag && parseFloat(s.betrag) > 0)
    : [];

  if (!['formell', 'freundlich', 'kurz'].includes(vorlage)) return res.status(400).json({ error: 'Ungültige Vorlage' });
  if (!gueltigAb) return res.status(400).json({ error: 'Gültigkeitsdatum fehlt' });

  const secureDojoId = getSecureDojoId(req);

  const tarifPreisExpr = `ROUND(CASE
    WHEN t.billing_cycle = 'MONTHLY'   THEN t.price_cents / 100
    WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
    WHEN t.billing_cycle = 'YEARLY'    THEN (t.price_cents / 100) / 12
    ELSE t.price_cents / 100
  END, 2)`;
  const tarifCapExpr = `CASE WHEN t.id IS NOT NULL AND t.ist_archiviert = 0 THEN ${tarifPreisExpr} ELSE 999999 END`;

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
      ${tarifCapExpr} AS tarif_cap,
      d.dojoname
    FROM mitglieder m
    JOIN vertraege v ON v.mitglied_id = m.mitglied_id AND v.status = 'aktiv'
    JOIN dojo d      ON m.dojo_id = d.id AND d.ist_aktiv = 1 AND d.dojoname NOT LIKE '%demo%'
    LEFT JOIN tarife t ON v.tarif_id = t.id
    WHERE m.aktiv = 1
    AND v.tarif_id IS NOT NULL
    AND (
      t.ist_archiviert = 1
      OR ROUND(v.monatsbeitrag, 2) < ${tarifPreisExpr}
    )
    AND NOT (
      t.ist_archiviert = 1
      AND EXISTS (
        SELECT 1 FROM tarife t2
        WHERE t2.ist_archiviert = 0 AND t2.active = 1
        AND t2.dojo_id = m.dojo_id
        AND ROUND(CASE
          WHEN t2.billing_cycle = 'MONTHLY'   THEN t2.price_cents / 100
          WHEN t2.billing_cycle = 'QUARTERLY' THEN (t2.price_cents / 100) / 3
          WHEN t2.billing_cycle = 'YEARLY'    THEN (t2.price_cents / 100) / 12
          ELSE t2.price_cents / 100
        END, 2) = ROUND(v.monatsbeitrag, 2)
      )
    )
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
        if (validSchritte.length > 0) {
          // Schrittweise: Schritt 1 → vertraege, Schritte 2..n → vertrag_beitrag_schritte
          const tarifCap = parseFloat(m.tarif_cap) || 999999;
          let kumulativ = 0;

          // Schritt 1 in vertraege
          kumulativ += parseFloat(validSchritte[0].betrag);
          const betrag0 = Math.round(Math.min(m.alter_betrag + kumulativ, tarifCap) * 100) / 100;

          const conn = await db.promise().getConnection();
          try {
            await conn.beginTransaction();
            await conn.query(
              `UPDATE vertraege SET neuer_monatsbeitrag = ?, neuer_beitrag_ab = ?
               WHERE mitglied_id = ? AND status = 'aktiv'`,
              [betrag0, validSchritte[0].datum, m.mitglied_id]
            );

            // Schritte 2..n in vertrag_beitrag_schritte
            for (let si = 1; si < validSchritte.length; si++) {
              kumulativ += parseFloat(validSchritte[si].betrag);
              const betragN = Math.round(Math.min(m.alter_betrag + kumulativ, tarifCap) * 100) / 100;
              await conn.query(
                `INSERT INTO vertrag_beitrag_schritte (mitglied_id, schritt_nr, gueltig_ab, neuer_betrag)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE neuer_betrag = VALUES(neuer_betrag)`,
                [m.mitglied_id, si + 1, validSchritte[si].datum, betragN]
              );
            }
            await conn.commit();
          } catch (txErr) {
            await conn.rollback();
            throw txErr;
          } finally {
            conn.release();
          }
        } else {
          // Einfache Erhöhung (bisheriges Verhalten)
          await db.promise().query(
            `UPDATE vertraege SET neuer_monatsbeitrag = ?, neuer_beitrag_ab = ?
             WHERE mitglied_id = ? AND status = 'aktiv'`,
            [m.neuer_betrag, gueltigAb, m.mitglied_id]
          );
        }
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
            'SELECT ps.endpoint, ps.p256dh_key, ps.auth_key FROM push_subscriptions ps JOIN users u ON u.id = ps.user_id WHERE u.mitglied_id = ? AND ps.is_active = TRUE',
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

    // Audit-Log: Beitragserhöhung terminiert
    await auditLog.log({
      req,
      aktion: auditLog.AKTION.TARIFERHOEHUNG,
      kategorie: auditLog.KATEGORIE.FINANZEN,
      entityType: 'vertraege',
      beschreibung: `Beitragserhöhung terminiert: ${terminiert} Verträge ab ${gueltigAb} · Typ: ${typ||'absolut'} · ${typ==='prozent' ? prozent+'%' : '+'+betrag+'€'} · ${sent} E-Mails gesendet${failed>0?' · '+failed+' fehlgeschlagen':''}${validSchritte.length>0?' · '+validSchritte.length+' Schritte':''}`,
      dojoId: secureDojoId,
      neueWerte: {
        gueltig_ab: gueltigAb,
        typ: typ || 'absolut',
        erhoehung_betrag: betrag,
        erhoehung_prozent: prozent,
        betroffene_vertraege: terminiert,
        emails_gesendet: sent,
        emails_fehlgeschlagen: failed,
        push_gesendet: pushSent,
        schritte: validSchritte.length > 0 ? validSchritte : undefined,
        ausschluss_anzahl: ausschlussIds.length
      }
    });

    res.json({ success: true, terminiert, sent, failed, noEmail, pushSent, gesamt: members.length, emailWarning: failed > 0 });
  });
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

  const tarifCapExpr = `CASE WHEN t.id IS NOT NULL AND t.ist_archiviert = 0 THEN ${tarifPreisExpr} ELSE 999999 END`;

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
    WHERE m.aktiv = 1
    AND v.tarif_id IS NOT NULL
    AND (
      t.ist_archiviert = 1
      OR ROUND(v.monatsbeitrag, 2) < ${tarifPreisExpr}
    )
    AND NOT (
      t.ist_archiviert = 1
      AND EXISTS (
        SELECT 1 FROM tarife t2
        WHERE t2.ist_archiviert = 0 AND t2.active = 1
        AND t2.dojo_id = m.dojo_id
        AND ROUND(CASE
          WHEN t2.billing_cycle = 'MONTHLY'   THEN t2.price_cents / 100
          WHEN t2.billing_cycle = 'QUARTERLY' THEN (t2.price_cents / 100) / 3
          WHEN t2.billing_cycle = 'YEARLY'    THEN (t2.price_cents / 100) / 12
          ELSE t2.price_cents / 100
        END, 2) = ROUND(v.monatsbeitrag, 2)
      )
    )
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

      // Push-Benachrichtigung (immer senden wenn VAPID konfiguriert)
      if (process.env.VAPID_PUBLIC_KEY) {
        try {
          const [subs] = await db.promise().query(
            'SELECT ps.endpoint, ps.p256dh_key, ps.auth_key FROM push_subscriptions ps JOIN users u ON u.id = ps.user_id WHERE u.mitglied_id = ? AND ps.is_active = TRUE',
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

    res.json({ success: true, sent, failed, noEmail, pushSent, gesamt: members.length, emailWarning: failed > 0 });
  });
});

// ✅ API: Mitglieder nach Zahlungsweise filtern (MUSS VOR /:id Route stehen!)
router.get("/filter/zahlungsweisen", (req, res) => {
  const { payment_method } = req.query;
  // 🔒 SICHERHEIT: Hole sichere dojo_id aus Token
  const secureDojoId = getSecureDojoId(req);

  // 🔒 DOJO-FILTER: Baue WHERE-Clause
  let whereConditions = [];
  let queryParams = [];

  if (payment_method && payment_method !== 'all') {
    // Lastschrift umfasst sowohl "SEPA-Lastschrift" als auch "Lastschrift"
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
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.email,
      m.zahlungsmethode,
      m.aktiv,
      v.monatsbeitrag
    FROM mitglieder m
    LEFT JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv'
    ${whereClause}
    ORDER BY m.nachname, m.vorname
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Mitglieder nach Zahlungsweise:', err);
      return res.status(500).json({ error: "Fehler beim Laden der Mitglieder" });
    }

    res.json({ success: true, data: results });
  });
});

/**
 * GET /mitglieder/print
 * Generiert eine PDF-Liste aller Mitglieder mit Name, Geburtsdatum, Stil und Vertrag
 */
router.get("/print", async (req, res) => {
  const PDFDocument = require('pdfkit');
  // 🔒 SICHERHEIT: Hole sichere dojo_id aus Token
  const secureDojoId = getSecureDojoId(req);

  try {
    // Mitglieder mit Stil und Vertrag abrufen
    let query = `
      SELECT
        m.mitglied_id,
        m.vorname,
        m.nachname,
        m.geburtsdatum,
        m.dojo_id,
        GROUP_CONCAT(DISTINCT ms.stil SEPARATOR ', ') as stile,
        v.status as vertrag_status,
        t.name as tarif_name
      FROM mitglieder m
      LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
      LEFT JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv'
      LEFT JOIN tarife t ON v.tarif_id = t.id
      WHERE m.aktiv = 1
    `;

    const params = [];
    if (secureDojoId) {
      query += ` AND m.dojo_id = ?`;
      params.push(secureDojoId);
    }

    query += ` GROUP BY m.mitglied_id ORDER BY m.nachname, m.vorname`;

    db.query(query, params, (err, mitglieder) => {
      if (err) {
        logger.error('Fehler beim Abrufen der Mitglieder:', err);
        return res.status(500).json({ error: "Fehler beim Abrufen der Mitglieder" });
      }

      // PDF erstellen
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      // PDF direkt zum Client streamen
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="mitgliederliste.pdf"');
      doc.pipe(res);

      // Header
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .text('Mitgliederliste', { align: 'center' })
         .moveDown();

      doc.fontSize(10)
         .font('Helvetica')
         .text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, { align: 'center' })
         .text(`Anzahl Mitglieder: ${mitglieder.length}`, { align: 'center' })
         .moveDown(2);

      // Tabellen-Header
      const startY = doc.y;
      const col1X = 50;
      const col2X = 200;
      const col3X = 300;
      const col4X = 380;
      const rowHeight = 20;

      doc.fontSize(10)
         .font('Helvetica-Bold');

      doc.text('Name', col1X, startY, { width: 140, continued: false })
         .text('Geburtsdatum', col2X, startY, { width: 90, continued: false })
         .text('Stil', col3X, startY, { width: 70, continued: false })
         .text('Vertrag', col4X, startY, { width: 150, continued: false });

      // Linie unter Header
      doc.moveTo(col1X, startY + 15)
         .lineTo(530, startY + 15)
         .stroke();

      let currentY = startY + rowHeight;

      // Mitglieder-Daten
      doc.font('Helvetica')
         .fontSize(9);

      // Seitenzähler für Footer
      let currentPageNum = 1;
      const pageNumbers = []; // Speichert Y-Positionen und Page-Objekte

      // Erste Seite registrieren
      pageNumbers.push({ pageNum: currentPageNum, pageRef: doc.page });

      mitglieder.forEach((mitglied, index) => {
        // Neue Seite wenn nötig
        if (currentY > 750) {
          currentPageNum++;
          doc.addPage();
          currentY = 50;

          // Header wiederholen
          doc.fontSize(10)
             .font('Helvetica-Bold')
             .text('Name', col1X, currentY, { width: 140, continued: false })
             .text('Geburtsdatum', col2X, currentY, { width: 90, continued: false })
             .text('Stil', col3X, currentY, { width: 70, continued: false })
             .text('Vertrag', col4X, currentY, { width: 150, continued: false });

          doc.moveTo(col1X, currentY + 15)
             .lineTo(530, currentY + 15)
             .stroke();

          currentY += rowHeight;
          doc.font('Helvetica')
             .fontSize(9);
        }

        // Zebra-Streifen
        if (index % 2 === 0) {
          doc.rect(col1X - 5, currentY - 5, 490, rowHeight - 2)
             .fill('#f5f5f5');
          doc.fillColor('#000000');
        }

        // Name
        const name = `${mitglied.nachname}, ${mitglied.vorname}`;
        doc.text(name, col1X, currentY, { width: 140, continued: false });

        // Geburtsdatum
        const geburtsdatum = mitglied.geburtsdatum
          ? new Date(mitglied.geburtsdatum).toLocaleDateString('de-DE')
          : '-';
        doc.text(geburtsdatum, col2X, currentY, { width: 90, continued: false });

        // Stil
        const stil = mitglied.stile || 'Kein Stil';
        doc.text(stil, col3X, currentY, { width: 70, continued: false });

        // Vertrag
        const vertrag = mitglied.tarif_name || 'Kein Vertrag';
        doc.text(vertrag, col4X, currentY, { width: 150, continued: false });

        currentY += rowHeight;
      });

      // Footer auf letzter Seite hinzufügen
      const totalPages = currentPageNum;
      doc.fontSize(8)
         .fillColor('#666666')
         .text(`Seite ${currentPageNum} von ${totalPages}`, 50, doc.page.height - 50, {
           align: 'center',
           width: doc.page.width - 100,
           lineBreak: false
         });

      // PDF abschließen
      doc.end();
    });
  } catch (error) {
    logger.error('Fehler beim Erstellen der PDF:', error);
    res.status(500).json({ error: "Fehler beim Erstellen der PDF" });
  }
});

// ✅ API: Einzelnes Mitglied VOLLPROFIL abrufen - SICHERHEITSFIX: Dojo-Isolation
router.get("/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);

    // 🔒 SICHERHEIT: Hole dojo_id aus Token, NICHT aus Query!
    const userDojoId = req.user?.dojo_id;
    const userRole = req.user?.rolle;
    const isSuperAdmin = userRole === 'super_admin' || (userRole === 'admin' && !userDojoId);

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    // 🔒 DOJO-FILTER: Erzwinge Dojo-Isolation außer für Super-Admin
    let whereConditions = ['m.mitglied_id = ?'];
    let queryParams = [id];

    if (!isSuperAdmin && userDojoId) {
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(userDojoId);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const query = `
        SELECT
            -- Stammdaten
            m.mitglied_id,
            m.vorname,
            m.nachname,
            m.geburtsdatum,
            m.geschlecht,
            m.gewicht,
            m.gurtfarbe,
            m.dojo_id,

            -- Kontaktdaten
            m.email,
            m.telefon,
            m.telefon_mobil,
            m.strasse,
            m.hausnummer,
            m.plz,
            m.ort,

            -- Zahlungsdaten
            m.iban,
            m.bic,
            m.bankname,
            m.zahlungsmethode,
            m.zahllaufgruppe,

            -- Status
            m.eintrittsdatum,
            m.gekuendigt_am,
            m.aktiv,

            -- 🆕 Medizinische Informationen
            m.allergien,
            m.medizinische_hinweise,
            m.notfallkontakt_name,
            m.notfallkontakt_telefon,
            m.notfallkontakt_verhaeltnis,

            -- 🆕 Prüfungsmanagement
            m.naechste_pruefung_datum,
            m.pruefungsgebuehr_bezahlt,
            m.trainer_empfehlung,

            -- 🆕 Dokumente/Compliance
            m.hausordnung_akzeptiert,
            m.datenschutz_akzeptiert,
            m.foto_einverstaendnis,
            m.vereinsordnung_datum,

            -- 🆕 Familienmanagement
            m.familien_id,
            m.rabatt_prozent,
            m.rabatt_grund,

            -- Stile
            COALESCE(GROUP_CONCAT(DISTINCT ms.stil ORDER BY ms.stil SEPARATOR ', '), '') AS stile
        FROM mitglieder m
        LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
        ${whereClause}
        GROUP BY m.mitglied_id
    `;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            logger.error('Fehler beim Abrufen des Vollprofils:', err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Mitgliedsdaten" });
        }

        if (!result || result.length === 0) {

            return res.status(404).json({ error: `Mitglied mit ID ${id} nicht gefunden oder keine Berechtigung.` });
        }

        const m = result[0];
        if (m && m.iban) m.iban = maskIBAN(m.iban);
        res.json(m);
    });
});

// 🆕 API: Medizinische Informationen abrufen + DOJO-FILTER
router.get("/:id/medizinisch", (req, res) => {
    const id = parseInt(req.params.id, 10);
    // 🔒 SICHERHEIT: Hole sichere dojo_id aus Token
    const secureDojoId = getSecureDojoId(req);

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    // 🔒 DOJO-FILTER: Baue WHERE-Clause
    let whereConditions = ['mitglied_id = ?'];
    let queryParams = [id];

    if (secureDojoId) {
        whereConditions.push('dojo_id = ?');
        queryParams.push(secureDojoId);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const query = `
        SELECT
            mitglied_id,
            vorname,
            nachname,
            dojo_id,
            allergien,
            medizinische_hinweise,
            notfallkontakt_name,
            notfallkontakt_telefon,
            notfallkontakt_verhaeltnis
        FROM mitglieder
        ${whereClause}
    `;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            logger.error('Fehler beim Abrufen medizinischer Daten:', err);
            return res.status(500).json({ error: "Fehler beim Abrufen medizinischer Daten" });
        }

        if (!result || result.length === 0) {
            return res.status(404).json({ error: "Mitglied nicht gefunden oder keine Berechtigung" });
        }

        res.json(result[0]);
    });
});

// 🆕 API: Prüfungsstatus abrufen + DOJO-FILTER
router.get("/:id/pruefung", (req, res) => {
    const id = parseInt(req.params.id, 10);
    // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
    const secureDojoId = getSecureDojoId(req);

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    // 🔒 DOJO-FILTER (Multi-Tenancy)
    let whereConditions = ['mitglied_id = ?'];
    let queryParams = [id];

    if (secureDojoId) {
        whereConditions.push('dojo_id = ?');
        queryParams.push(secureDojoId);
    }

    const query = `
        SELECT
            mitglied_id,
            vorname,
            nachname,
            dojo_id,
            gurtfarbe,
            naechste_pruefung_datum,
            pruefungsgebuehr_bezahlt,
            trainer_empfehlung,
            eintrittsdatum
        FROM mitglieder
        WHERE ${whereConditions.join(' AND ')}
    `;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            logger.error('Fehler beim Abrufen der Prüfungsdaten:', err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Prüfungsdaten" });
        }

        if (!result || result.length === 0) {
            return res.status(404).json({ error: "Mitglied nicht gefunden oder keine Berechtigung" });
        }

        res.json(result[0]);
    });
});

// 🆕 API: Compliance-Status abrufen + DOJO-FILTER
router.get("/:id/compliance", (req, res) => {
    const id = parseInt(req.params.id, 10);
    // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
    const secureDojoId = getSecureDojoId(req);

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    // 🔒 DOJO-FILTER (Multi-Tenancy)
    let whereConditions = ['mitglied_id = ?'];
    let queryParams = [id];

    if (secureDojoId) {
        whereConditions.push('dojo_id = ?');
        queryParams.push(secureDojoId);
    }

    const query = `
        SELECT
            mitglied_id,
            vorname,
            nachname,
            dojo_id,
            hausordnung_akzeptiert,
            datenschutz_akzeptiert,
            foto_einverstaendnis,
            vereinsordnung_datum
        FROM mitglieder
        WHERE ${whereConditions.join(' AND ')}
    `;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            logger.error('Fehler beim Abrufen der Compliance-Daten:', err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Compliance-Daten" });
        }

        if (!result || result.length === 0) {
            return res.status(404).json({ error: "Mitglied nicht gefunden oder keine Berechtigung" });
        }

        res.json(result[0]);
    });
});

// 🆕 API: Medizinische Daten aktualisieren + DOJO-FILTER (KRITISCH!)
router.put("/:id/medizinisch", (req, res) => {
    const id = parseInt(req.params.id, 10);
    // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
    const secureDojoId = getSecureDojoId(req);

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    const {
        allergien,
        medizinische_hinweise,
        notfallkontakt_name,
        notfallkontakt_telefon,
        notfallkontakt_verhaeltnis
    } = req.body;

    // 🔒 KRITISCHER DOJO-FILTER: Multi-Tenancy Isolation
    let whereConditions = ['mitglied_id = ?'];
    let queryParams = [
        allergien || null,
        medizinische_hinweise || null,
        notfallkontakt_name || null,
        notfallkontakt_telefon || null,
        notfallkontakt_verhaeltnis || null,
        id
    ];

    if (secureDojoId) {
        whereConditions.push('dojo_id = ?');
        queryParams.push(secureDojoId);
    }

    const query = `
        UPDATE mitglieder
        SET
            allergien = ?,
            medizinische_hinweise = ?,
            notfallkontakt_name = ?,
            notfallkontakt_telefon = ?,
            notfallkontakt_verhaeltnis = ?
        WHERE ${whereConditions.join(' AND ')}
    `;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            logger.error('Fehler beim Update medizinischer Daten:', err);
            return res.status(500).json({ error: "Fehler beim Aktualisieren medizinischer Daten" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Mitglied nicht gefunden oder keine Berechtigung" });
        }

        res.json({
            success: true,
            message: "Medizinische Daten erfolgreich aktualisiert",
            updated_fields: { allergien, medizinische_hinweise, notfallkontakt_name, notfallkontakt_telefon, notfallkontakt_verhaeltnis }
        });
    });
});

// 🆕 API: Prüfungsdaten aktualisieren + DOJO-FILTER (KRITISCH!)
router.put("/:id/pruefung", (req, res) => {
    const id = parseInt(req.params.id, 10);
    // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
    const secureDojoId = getSecureDojoId(req);

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    const {
        naechste_pruefung_datum,
        pruefungsgebuehr_bezahlt,
        trainer_empfehlung
    } = req.body;

    // 🔒 KRITISCHER DOJO-FILTER: Multi-Tenancy Isolation
    let whereConditions = ['mitglied_id = ?'];
    let queryParams = [
        naechste_pruefung_datum || null,
        pruefungsgebuehr_bezahlt || false,
        trainer_empfehlung || null,
        id
    ];

    if (secureDojoId) {
        whereConditions.push('dojo_id = ?');
        queryParams.push(secureDojoId);
    }

    const query = `
        UPDATE mitglieder
        SET
            naechste_pruefung_datum = ?,
            pruefungsgebuehr_bezahlt = ?,
            trainer_empfehlung = ?
        WHERE ${whereConditions.join(' AND ')}
    `;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            logger.error('Fehler beim Update der Prüfungsdaten:', err);
            return res.status(500).json({ error: "Fehler beim Aktualisieren der Prüfungsdaten" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Mitglied nicht gefunden oder keine Berechtigung" });
        }

        res.json({
            success: true,
            message: "Prüfungsdaten erfolgreich aktualisiert",
            updated_fields: { naechste_pruefung_datum, pruefungsgebuehr_bezahlt, trainer_empfehlung }
        });
    });
});

// 🆕 API: Compliance-Status aktualisieren + DOJO-FILTER (KRITISCH!)
router.put("/:id/compliance", (req, res) => {
    const id = parseInt(req.params.id, 10);
    // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
    const secureDojoId = getSecureDojoId(req);

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    const {
        hausordnung_akzeptiert,
        datenschutz_akzeptiert,
        foto_einverstaendnis,
        vereinsordnung_datum
    } = req.body;

    // 🔒 KRITISCHER DOJO-FILTER: Multi-Tenancy Isolation
    let whereConditions = ['mitglied_id = ?'];
    let queryParams = [
        hausordnung_akzeptiert || false,
        datenschutz_akzeptiert || false,
        foto_einverstaendnis || false,
        vereinsordnung_datum || null,
        id
    ];

    if (secureDojoId) {
        whereConditions.push('dojo_id = ?');
        queryParams.push(secureDojoId);
    }

    const query = `
        UPDATE mitglieder
        SET
            hausordnung_akzeptiert = ?,
            datenschutz_akzeptiert = ?,
            foto_einverstaendnis = ?,
            vereinsordnung_datum = ?
        WHERE ${whereConditions.join(' AND ')}
    `;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            logger.error('Fehler beim Update des Compliance-Status:', err);
            return res.status(500).json({ error: "Fehler beim Aktualisieren des Compliance-Status" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Mitglied nicht gefunden oder keine Berechtigung" });
        }

        res.json({
            success: true,
            message: "Compliance-Status erfolgreich aktualisiert",
            updated_fields: { hausordnung_akzeptiert, datenschutz_akzeptiert, foto_einverstaendnis, vereinsordnung_datum }
        });
    });
});

// 🆕 API: Alle Mitglieder mit ausstehenden Dokumenten + DOJO-FILTER
router.get("/compliance/missing", (req, res) => {
    // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
    const secureDojoId = getSecureDojoId(req);

    // 🔒 DOJO-FILTER: Multi-Tenancy Isolation
    let whereConditions = [
        'aktiv = 1',
        '(hausordnung_akzeptiert = FALSE OR datenschutz_akzeptiert = FALSE OR foto_einverstaendnis = FALSE OR vereinsordnung_datum IS NULL)'
    ];
    let queryParams = [];

    if (secureDojoId) {
        whereConditions.push('dojo_id = ?');
        queryParams.push(secureDojoId);
    }

    const query = `
        SELECT
            mitglied_id,
            vorname,
            nachname,
            email,
            dojo_id,
            hausordnung_akzeptiert,
            datenschutz_akzeptiert,
            foto_einverstaendnis,
            vereinsordnung_datum,
            eintrittsdatum
        FROM mitglieder
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY eintrittsdatum DESC
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen fehlender Compliance-Daten:', err);
            return res.status(500).json({ error: "Fehler beim Abrufen fehlender Compliance-Daten" });
        }

        res.json({
            success: true,
            count: results.length,
            missing_compliance: results
        });
    });
});

// 🆕 API: Prüfungskandidaten (nächste 30 Tage) + DOJO-FILTER
router.get("/pruefung/kandidaten", (req, res) => {
    // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
    const secureDojoId = getSecureDojoId(req);

    // 🔒 DOJO-FILTER: Multi-Tenancy Isolation
    let whereConditions = [
        'aktiv = 1',
        'naechste_pruefung_datum IS NOT NULL',
        'naechste_pruefung_datum <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)'
    ];
    let queryParams = [];

    if (secureDojoId) {
        whereConditions.push('dojo_id = ?');
        queryParams.push(secureDojoId);
    }

    const query = `
        SELECT
            mitglied_id,
            vorname,
            nachname,
            dojo_id,
            gurtfarbe,
            naechste_pruefung_datum,
            pruefungsgebuehr_bezahlt,
            trainer_empfehlung,
            eintrittsdatum,
            DATEDIFF(naechste_pruefung_datum, CURDATE()) as tage_bis_pruefung
        FROM mitglieder
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY naechste_pruefung_datum ASC
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen der Prüfungskandidaten:', err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Prüfungskandidaten" });
        }

        res.json({
            success: true,
            count: results.length,
            pruefungskandidaten: results
        });
    });
});

// ✅ NEU: PUT Allgemeine Mitgliederdaten Update (für Stil & Gurt) + DOJO-FILTER (KRITISCH!)
router.put("/:id",
    validateId('id'),
    sanitizeStrings(['vorname', 'nachname', 'email', 'strasse', 'ort', 'bemerkungen']),
    (req, res) => {
    const id = parseInt(req.params.id, 10);
    // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
    const secureDojoId = getSecureDojoId(req);

    const updateFields = req.body;

    // Dynamisch SQL Query bauen basierend auf den gesendeten Feldern
    const allowedFields = ['stil_id', 'gurtfarbe', 'letzte_pruefung', 'vorname', 'nachname', 'email', 'telefon', 'telefon_mobil', 'strasse', 'hausnummer', 'plz', 'ort', 'gewicht', 'vertreter1_typ', 'vertreter1_name', 'vertreter1_telefon', 'vertreter1_email', 'vertreter2_typ', 'vertreter2_name', 'vertreter2_telefon', 'vertreter2_email'];
    const setClause = [];
    const values = [];

    Object.keys(updateFields).forEach(field => {
        if (allowedFields.includes(field)) {
            setClause.push(`${field} = ?`);
            values.push(updateFields[field]);
        }
    });

    if (setClause.length === 0) {
        return res.status(400).json({ error: "Keine gültigen Felder zum Update gefunden" });
    }

    // 🔒 KRITISCHER DOJO-FILTER: Multi-Tenancy Isolation
    let whereConditions = ['mitglied_id = ?'];
    values.push(id);

    if (secureDojoId) {
        whereConditions.push('dojo_id = ?');
        values.push(secureDojoId);
    }

    const query = `
        UPDATE mitglieder
        SET ${setClause.join(', ')}
        WHERE ${whereConditions.join(' AND ')}
    `;

    db.query(query, values, (error, results) => {
        if (error) {
            logger.error('Datenbankfehler beim Update:', error);
            return res.status(500).json({
                error: 'Datenbankfehler beim Aktualisieren',
                details: error.message
            });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Mitglied nicht gefunden oder keine Berechtigung' });
        }

        // Audit-Log schreiben
        auditLog.log({
            req,
            aktion: auditLog.AKTION.MITGLIED_AKTUALISIERT,
            kategorie: auditLog.KATEGORIE.MITGLIED,
            entityType: 'mitglieder',
            entityId: id,
            neueWerte: updateFields,
            beschreibung: `Mitglied #${id} aktualisiert: ${Object.keys(updateFields).join(', ')}`
        });

        res.json({
            success: true,
            message: 'Mitglied erfolgreich aktualisiert',
            updated_fields: updateFields
        });
    });
});

// POST /bulk-graduierung – Massenweise Gürtel zuweisen
router.post('/bulk-graduierung', async (req, res) => {
  const { stil_id, assignments } = req.body;
  if (!stil_id || !Array.isArray(assignments) || assignments.length === 0) {
    return res.status(400).json({ error: 'stil_id und assignments Array erforderlich' });
  }
  const secureDojoId = getSecureDojoId(req);
  const pool = db.promise();
  let updated = 0, inserted = 0;
  try {
    for (const { mitglied_id, graduierung_id } of assignments) {
      if (!mitglied_id || !graduierung_id) continue;
      if (secureDojoId) {
        const [check] = await pool.query(
          'SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ? AND aktiv = 1',
          [mitglied_id, secureDojoId]
        );
        if (check.length === 0) continue;
      }
      const [existing] = await pool.query(
        'SELECT id FROM mitglied_stil_data WHERE mitglied_id = ? AND stil_id = ?',
        [mitglied_id, stil_id]
      );
      if (existing.length > 0) {
        await pool.query(
          'UPDATE mitglied_stil_data SET current_graduierung_id = ?, aktualisiert_am = NOW() WHERE mitglied_id = ? AND stil_id = ?',
          [graduierung_id, mitglied_id, stil_id]
        );
        updated++;
      } else {
        await pool.query(
          'INSERT INTO mitglied_stil_data (mitglied_id, stil_id, current_graduierung_id, erstellt_am) VALUES (?, ?, ?, NOW())',
          [mitglied_id, stil_id, graduierung_id]
        );
        inserted++;
      }
    }
    res.json({ success: true, updated, inserted, total: updated + inserted });
  } catch (err) {
    logger.error('Fehler bei Bulk-Graduierung:', err);
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// GET /zuweisung/stil/:stil_id – Alle aktiven Mitglieder eines Stils mit Gürtel
// Prüft BEIDE Tabellen: mitglied_stil_data (direkte Zuordnung) + mitglied_stile (Text-Fallback)
router.get('/zuweisung/stil/:stil_id', (req, res) => {
  const stil_id = parseInt(req.params.stil_id, 10);
  if (isNaN(stil_id)) return res.status(400).json({ error: 'Ungültige Stil-ID' });

  const secureDojoId = getSecureDojoId(req);
  const dojoCondition = secureDojoId ? ' AND m.dojo_id = ?' : '';
  const params = secureDojoId ? [stil_id, stil_id, stil_id, secureDojoId] : [stil_id, stil_id, stil_id];

  const query = `
    SELECT
      m.mitglied_id, m.vorname, m.nachname,
      combined.current_graduierung_id,
      combined.letzte_pruefung,
      g.name as graduierung_name,
      g.farbe_hex,
      g.reihenfolge as graduierung_reihenfolge,
      g.kategorie, g.dan_grad
    FROM mitglieder m
    INNER JOIN (
      SELECT mitglied_id, current_graduierung_id, letzte_pruefung
        FROM mitglied_stil_data WHERE stil_id = ?
      UNION
      SELECT ms.mitglied_id, NULL, NULL
        FROM mitglied_stile ms
        JOIN stile s ON s.stil_id = ? AND ms.stil = s.name
        WHERE ms.mitglied_id NOT IN (
          SELECT mitglied_id FROM mitglied_stil_data WHERE stil_id = ?
        )
    ) AS combined ON m.mitglied_id = combined.mitglied_id
    LEFT JOIN graduierungen g ON combined.current_graduierung_id = g.graduierung_id
    WHERE m.aktiv = 1${dojoCondition}
    ORDER BY COALESCE(g.reihenfolge, 9999) ASC, m.nachname ASC, m.vorname ASC
  `;

  db.query(query, params, (err, results) => {
    if (err) {
      logger.error('Fehler bei Stil-Zuweisung:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    res.json({ success: true, mitglieder: results });
  });
});

// POST /stil/:stil_id/assign – Mitglied einem Stil zuweisen (Stilmitglieder-Tab)
router.post('/stil/:stil_id/assign', async (req, res) => {
  const stil_id = parseInt(req.params.stil_id, 10);
  const { mitglied_id } = req.body;
  if (isNaN(stil_id) || !mitglied_id) return res.status(400).json({ error: 'Ungültige Parameter' });

  const secureDojoId = getSecureDojoId(req);
  const pool = db.promise();
  try {
    if (secureDojoId) {
      const [m] = await pool.query(
        'SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ? AND aktiv = 1',
        [mitglied_id, secureDojoId]
      );
      if (m.length === 0) return res.status(403).json({ error: 'Mitglied nicht gefunden' });
    }
    const [existing] = await pool.query(
      'SELECT id FROM mitglied_stil_data WHERE mitglied_id = ? AND stil_id = ?',
      [mitglied_id, stil_id]
    );
    if (existing.length > 0) return res.json({ success: true, message: 'Bereits zugewiesen' });

    const [grads] = await pool.query(
      'SELECT graduierung_id FROM graduierungen WHERE stil_id = ? AND aktiv = 1 ORDER BY reihenfolge ASC LIMIT 1',
      [stil_id]
    );
    const firstGradId = grads.length > 0 ? grads[0].graduierung_id : null;
    await pool.query(
      'INSERT INTO mitglied_stil_data (mitglied_id, stil_id, current_graduierung_id, erstellt_am) VALUES (?, ?, ?, NOW())',
      [mitglied_id, stil_id, firstGradId]
    );
    const [stilRow] = await pool.query('SELECT name FROM stile WHERE stil_id = ?', [stil_id]);
    if (stilRow.length > 0) {
      await pool.query(
        'INSERT IGNORE INTO mitglied_stile (mitglied_id, stil) VALUES (?, ?)',
        [mitglied_id, stilRow[0].name]
      );
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('Fehler beim Zuweisen des Stils:', err);
    res.status(500).json({ error: 'Fehler beim Zuweisen' });
  }
});

// DELETE /stil/:stil_id/remove/:mitglied_id – Mitglied aus Stil entfernen
router.delete('/stil/:stil_id/remove/:mitglied_id', async (req, res) => {
  const stil_id = parseInt(req.params.stil_id, 10);
  const mitglied_id = parseInt(req.params.mitglied_id, 10);
  if (isNaN(stil_id) || isNaN(mitglied_id)) return res.status(400).json({ error: 'Ungültige Parameter' });

  const secureDojoId = getSecureDojoId(req);
  const pool = db.promise();
  try {
    if (secureDojoId) {
      const [m] = await pool.query(
        'SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?',
        [mitglied_id, secureDojoId]
      );
      if (m.length === 0) return res.status(403).json({ error: 'Nicht berechtigt' });
    }
    await pool.query('DELETE FROM mitglied_stil_data WHERE mitglied_id = ? AND stil_id = ?', [mitglied_id, stil_id]);
    const [stilRow] = await pool.query('SELECT name FROM stile WHERE stil_id = ?', [stil_id]);
    if (stilRow.length > 0) {
      await pool.query(
        'DELETE FROM mitglied_stile WHERE mitglied_id = ? AND stil = ?',
        [mitglied_id, stilRow[0].name]
      );
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('Fehler beim Entfernen aus Stil:', err);
    res.status(500).json({ error: 'Fehler beim Entfernen' });
  }
});

// 🆕 API: Mitglied-Stile verwalten (Multiple Stile pro Person)
router.post("/:id/stile", (req, res) => {
    const mitglied_id = parseInt(req.params.id, 10);
    const { stile } = req.body; // Array von Stil-IDs
    
    if (isNaN(mitglied_id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    if (!Array.isArray(stile)) {
        return res.status(400).json({ error: "Stile müssen als Array übergeben werden" });
    }

    // Vereinfache ohne Transaction für jetzt

    // Zuerst alle bestehenden Stile für dieses Mitglied löschen (beide Tabellen)
    const deleteMitgliedStileQuery = "DELETE FROM mitglied_stile WHERE mitglied_id = ?";
    const deleteMitgliedStilDataQuery = "DELETE FROM mitglied_stil_data WHERE mitglied_id = ?";

    // Lösche aus mitglied_stile
    db.query(deleteMitgliedStileQuery, [mitglied_id], (deleteErr) => {
        if (deleteErr) {
            logger.error('Fehler beim Löschen bestehender Stile:', deleteErr);
            return res.status(500).json({ error: "Fehler beim Löschen bestehender Stile" });
        }

        // Lösche auch aus mitglied_stil_data
        db.query(deleteMitgliedStilDataQuery, [mitglied_id], (deleteDataErr) => {
            if (deleteDataErr) {
                logger.error('Fehler beim Löschen von mitglied_stil_data:', deleteDataErr);
                // Nicht abbrechen, da mitglied_stile bereits gelöscht wurde
            }

            // Wenn keine neuen Stile hinzugefügt werden sollen
            if (stile.length === 0) {
                return res.json({ success: true, message: "Stile erfolgreich aktualisiert", stile: [] });
            }

            // Zuordnung von Stil-IDs zu ENUM-Werten (basiert auf tatsächlichen DB-Daten)
            const stilMapping = {
                2: 'ShieldX',      // ShieldX
                3: 'BJJ',          // BJJ
                4: 'Kickboxen',    // Kickboxen
                5: 'Karate',       // Enso Karate → wird als 'Karate' in ENUM gespeichert
                7: 'Taekwon-Do',   // Taekwon-Do
                8: 'BJJ',          // Brazilian Jiu-Jitsu → auch als BJJ
                20: 'MMA',         // MMA
                21: 'Grappling',   // Grappling
                22: 'Open Mat'     // Open Mat
            };

            // Filter ungültige Stil-IDs und konvertiere zu ENUM-Werten
            const validValues = stile
                .filter(stil_id => stilMapping[stil_id]) // Nur bekannte IDs
                .map(stil_id => [mitglied_id, stilMapping[stil_id]]);

            if (validValues.length === 0) {
                return res.json({ success: true, message: "Keine gültigen Stile zum Hinzufügen", stile: [] });
            }

            const insertQuery = "INSERT INTO mitglied_stile (mitglied_id, stil) VALUES ?";
            const insertValues = validValues;

            db.query(insertQuery, [insertValues], (insertErr) => {
                if (insertErr) {
                    logger.error('Fehler beim Hinzufügen neuer Stile:', insertErr);
                    return res.status(500).json({ error: "Fehler beim Hinzufügen neuer Stile" });
                }

                // WICHTIG: Auch Einträge in mitglied_stil_data erstellen für Statistiken
                // Erstelle für jeden Stil einen Eintrag (falls noch nicht vorhanden)
                const stilDataPromises = stile.map(stil_id => {
                    return new Promise((resolve, reject) => {
                        // Prüfe ob bereits vorhanden
                        const checkQuery = 'SELECT id FROM mitglied_stil_data WHERE mitglied_id = ? AND stil_id = ?';
                        db.query(checkQuery, [mitglied_id, stil_id], (checkErr, checkResults) => {
                            if (checkErr) {
                                logger.error('Fehler beim Prüfen mitglied_stil_data:', { error: checkErr });
                                return reject(checkErr);
                            }

                            if (checkResults.length > 0) {
                                // Bereits vorhanden
                                return resolve();
                            }

                            // Hole die erste Graduierung für diesen Stil (niedrigste reihenfolge)
                            const getFirstGraduierungQuery = `
                                SELECT graduierung_id
                                FROM graduierungen
                                WHERE stil_id = ? AND aktiv = 1
                                ORDER BY reihenfolge ASC
                                LIMIT 1
                            `;
                            db.query(getFirstGraduierungQuery, [stil_id], (gradErr, gradResults) => {
                                if (gradErr) {
                                    logger.error('Fehler beim Abrufen der ersten Graduierung:', { error: gradErr });
                                    return reject(gradErr);
                                }

                                const firstGraduierungId = gradResults.length > 0 ? gradResults[0].graduierung_id : null;

                                // Neu erstellen mit erster Graduierung
                                const insertDataQuery = `
                                    INSERT INTO mitglied_stil_data
                                    (mitglied_id, stil_id, current_graduierung_id, erstellt_am)
                                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                                `;
                                db.query(insertDataQuery, [mitglied_id, stil_id, firstGraduierungId], (insertDataErr) => {
                                    if (insertDataErr) {
                                        logger.error('Fehler beim Erstellen mitglied_stil_data:', { error: insertDataErr });
                                        return reject(insertDataErr);
                                    }
                                    logger.info('mitglied_stil_data erstellt für Mitglied ${mitglied_id}, Stil ${stil_id}, Graduierung ${firstGraduierungId}');
                                    resolve();
                                });
                            });
                        });
                    });
                });

                // Warte auf alle Inserts
                Promise.all(stilDataPromises)
                    .then(() => {
                        res.json({
                            success: true,
                            message: "Stile erfolgreich aktualisiert",
                            mitglied_id: mitglied_id,
                            stile: stile
                        });
                    })
                    .catch(err => {
                        logger.error('Fehler beim Aktualisieren mitglied_stil_data:', { error: err });
                        // Trotzdem Success zurückgeben, da mitglied_stile erfolgreich war
                        res.json({
                            success: true,
                            message: "Stile aktualisiert, aber Warnung bei Stil-Daten",
                            mitglied_id: mitglied_id,
                            stile: stile
                        });
                    });
            });
        });
    });
});

// 🆕 API: Mitglied-Stile abrufen
router.get("/:id/stile", (req, res) => {
    const mitglied_id = parseInt(req.params.id, 10);
    
    if (isNaN(mitglied_id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    // Zuordnung von ENUM-Werten zu Stil-IDs und Namen (basiert auf tatsächlichen DB-Daten)
    const stilMapping = {
        'ShieldX': { stil_id: 2, stil_name: 'ShieldX', beschreibung: 'Moderne Selbstverteidigung mit realistischen Szenarien' },
        'BJJ': { stil_id: 3, stil_name: 'BJJ', beschreibung: 'Brazilian Jiu-Jitsu - Bodenkampf und Grappling-Techniken' },
        'Brazilian Jiu Jitsu': { stil_id: 3, stil_name: 'Brazilian Jiu Jitsu', beschreibung: 'Brazilian Jiu-Jitsu - Bodenkampf und Grappling-Techniken' },
        'Kickboxen': { stil_id: 4, stil_name: 'Kickboxen', beschreibung: 'Moderne Kampfsportart kombiniert Boxing mit Fußtechniken' },
        'Karate': { stil_id: 5, stil_name: 'Enso Karate', beschreibung: 'Traditionelle japanische Kampfkunst mit Fokus auf Schlag- und Tritttechniken' },
        'Enso Karate': { stil_id: 5, stil_name: 'Enso Karate', beschreibung: 'Traditionelle japanische Kampfkunst mit Fokus auf Schlag- und Tritttechniken' },
        'Taekwon-Do': { stil_id: 7, stil_name: 'Taekwon-Do', beschreibung: 'Koreanische Kampfkunst mit Betonung auf Fußtechniken und hohe Tritte' },
        'MMA': { stil_id: 20, stil_name: 'MMA', beschreibung: 'Mixed Martial Arts' },
        'Grappling': { stil_id: 21, stil_name: 'Grappling', beschreibung: 'Grappling' },
        'Open Mat': { stil_id: 22, stil_name: 'Open Mat', beschreibung: 'Open Mat' }
    };

    const query = `
        SELECT ms.stil, ms.ist_hauptstil
        FROM mitglied_stile ms
        WHERE ms.mitglied_id = ?
        ORDER BY ms.ist_hauptstil DESC, ms.stil
    `;

    db.query(query, [mitglied_id], (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen der Mitglied-Stile:', err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Stile" });
        }

        // Transformiere die ENUM-Werte zurück zu den erwarteten Objekten
        const transformedResults = results.map(row => {
            const stilInfo = stilMapping[row.stil];
            if (!stilInfo) {
                logger.warn('Stil nicht im Mapping gefunden', { stil: row.stil });
                return null;
            }
            return {
                stil_id: stilInfo.stil_id,
                name: stilInfo.stil_name,
                stil_name: stilInfo.stil_name,
                beschreibung: stilInfo.beschreibung,
                ist_hauptstil: row.ist_hauptstil === 1,
                stil_enum: row.stil
            };
        }).filter(Boolean);

        if (transformedResults.length === 0) {
            return res.json({
                success: true,
                mitglied_id: mitglied_id,
                stile: []
            });
        }

        // Lade Graduierungen für jeden Stil
        const stilIds = transformedResults.map(s => s.stil_id);
        const graduierungenQuery = `
            SELECT
                graduierung_id,
                stil_id,
                name,
                reihenfolge,
                trainingsstunden_min,
                mindestzeit_monate,
                farbe_hex,
                kategorie,
                dan_grad
            FROM graduierungen
            WHERE stil_id IN (?)
            ORDER BY stil_id, reihenfolge
        `;

        db.query(graduierungenQuery, [stilIds], (gradErr, gradResults) => {
            if (gradErr) {
                logger.error('Fehler beim Laden der Graduierungen:', gradErr);
                // Trotzdem Stile ohne Graduierungen zurückgeben
                return res.json({
                    success: true,
                    mitglied_id: mitglied_id,
                    stile: transformedResults
                });
            }

            // Gruppiere Graduierungen nach stil_id
            const graduierungenByStil = {};
            gradResults.forEach(grad => {
                if (!graduierungenByStil[grad.stil_id]) {
                    graduierungenByStil[grad.stil_id] = [];
                }
                graduierungenByStil[grad.stil_id].push(grad);
            });

            // Füge Graduierungen zu den Stilen hinzu
            const stileWithGraduierungen = transformedResults.map(stil => ({
                ...stil,
                graduierungen: graduierungenByStil[stil.stil_id] || []
            }));

            res.json({
                success: true,
                mitglied_id: mitglied_id,
                stile: stileWithGraduierungen
            });
        });
    });
});

// POST /:id/stile/hauptstil — Setzt einen Stil als Hauptstil (alle anderen werden zurückgesetzt)
router.post("/:id/stile/hauptstil", async (req, res) => {
    const mitglied_id = parseInt(req.params.id, 10);
    const { stil } = req.body; // ENUM-Wert, z.B. 'Kickboxen'
    if (isNaN(mitglied_id) || !stil) {
        return res.status(400).json({ error: 'mitglied_id und stil erforderlich' });
    }
    const pool = db.promise();
    try {
        await pool.query(
            'UPDATE mitglied_stile SET ist_hauptstil = 0 WHERE mitglied_id = ?',
            [mitglied_id]
        );
        await pool.query(
            'UPDATE mitglied_stile SET ist_hauptstil = 1 WHERE mitglied_id = ? AND stil = ?',
            [mitglied_id, stil]
        );
        res.json({ success: true });
    } catch (err) {
        logger.error('Hauptstil setzen Fehler', { error: err.message });
        res.status(500).json({ error: err.message });
    }
});

// 🆕 API: Stilspezifische Daten für ein Mitglied verwalten (Graduierung, letzte Prüfung, etc.)
router.post("/:id/stil/:stil_id/data", (req, res) => {
    const mitglied_id = parseInt(req.params.id, 10);
    const stil_id = parseInt(req.params.stil_id, 10);
    const { current_graduierung_id, letzte_pruefung, naechste_pruefung, anmerkungen } = req.body;

    if (isNaN(mitglied_id) || isNaN(stil_id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds- oder Stil-ID" });
    }

    // ISO-Datetime-Strings auf YYYY-MM-DD kürzen (MySQL DATE-Spalten akzeptieren kein 'T...')
    const formatDate = (val) => {
        if (!val) return null;
        const s = String(val);
        return s.includes('T') ? s.split('T')[0] : s;
    };
    const safeLetzePruefung = formatDate(letzte_pruefung);
    const safeNaechstePruefung = formatDate(naechste_pruefung);

    // Erst prüfen, ob bereits ein Eintrag existiert
    const checkQuery = `
        SELECT id FROM mitglied_stil_data
        WHERE mitglied_id = ? AND stil_id = ?
    `;

    db.query(checkQuery, [mitglied_id, stil_id], (checkErr, checkResult) => {
        if (checkErr) {
            logger.error('Fehler beim Prüfen vorhandener Daten:', checkErr);
            return res.status(500).json({ error: "Datenbankfehler beim Prüfen" });
        }

        let query, params;
        if (checkResult.length > 0) {
            // UPDATE existierende Daten
            query = `
                UPDATE mitglied_stil_data
                SET current_graduierung_id = ?, letzte_pruefung = ?, naechste_pruefung = ?, anmerkungen = ?,
                    aktualisiert_am = CURRENT_TIMESTAMP
                WHERE mitglied_id = ? AND stil_id = ?
            `;
            params = [current_graduierung_id || null, safeLetzePruefung, safeNaechstePruefung, anmerkungen || null, mitglied_id, stil_id];
        } else {
            // INSERT neue Daten
            query = `
                INSERT INTO mitglied_stil_data 
                (mitglied_id, stil_id, current_graduierung_id, letzte_pruefung, naechste_pruefung, anmerkungen, erstellt_am)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            params = [mitglied_id, stil_id, current_graduierung_id || null, safeLetzePruefung, safeNaechstePruefung, anmerkungen || null];
        }

        db.query(query, params, (err) => {
            if (err) {
                logger.error('Fehler beim Speichern stilspezifischer Daten:', err);
                return res.status(500).json({ error: "Fehler beim Speichern" });
            }

            res.json({ 
                success: true, 
                message: "Stilspezifische Daten erfolgreich gespeichert",
                mitglied_id,
                stil_id
            });
        });
    });
});

// 🆕 API: Stilspezifische Daten für ein Mitglied abrufen
router.get("/:id/stil/:stil_id/data", (req, res) => {
    const mitglied_id = parseInt(req.params.id, 10);
    const stil_id = parseInt(req.params.stil_id, 10);
    
    if (isNaN(mitglied_id) || isNaN(stil_id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds- oder Stil-ID" });
    }

    const query = `
        SELECT 
            msd.*,
            g.name as graduierung_name,
            g.farbe_hex,
            g.farbe_sekundaer,
            g.trainingsstunden_min,
            g.mindestzeit_monate,
            g.reihenfolge
        FROM mitglied_stil_data msd
        LEFT JOIN graduierungen g ON msd.current_graduierung_id = g.graduierung_id
        WHERE msd.mitglied_id = ? AND msd.stil_id = ?
    `;

    db.query(query, [mitglied_id, stil_id], (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen stilspezifischer Daten:', err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Daten" });
        }

        // Prüfe automatisch ob es einen kommenden Prüfungstermin für diesen Stil gibt
        const pruefungsterminQuery = `
            SELECT pruefungsdatum
            FROM pruefungstermin_vorlagen
            WHERE stil_id = ?
            AND pruefungsdatum >= CURDATE()
            ORDER BY pruefungsdatum ASC
            LIMIT 1
        `;

        db.query(pruefungsterminQuery, [stil_id], (pruefErr, pruefResults) => {
            if (pruefErr) {
                logger.error('⚠️ Fehler beim Abrufen des Prüfungstermins:', { error: pruefErr });
                // Fahre trotzdem fort, gebe nur stilData zurück
            }

            let stilData = results.length > 0 ? results[0] : {
                mitglied_id,
                stil_id,
                current_graduierung_id: null,
                letzte_pruefung: null,
                naechste_pruefung: null,
                anmerkungen: null
            };

            // Wenn Prüfungstermin gefunden und neuer/aktueller als gespeicherte naechste_pruefung
            if (pruefResults && pruefResults.length > 0) {
                const kommenderTermin = pruefResults[0].pruefungsdatum;

                if (!stilData.naechste_pruefung || new Date(kommenderTermin) > new Date(stilData.naechste_pruefung)) {
                    stilData.naechste_pruefung = kommenderTermin;
                    stilData.auto_gefuellt = true; // Markierung dass automatisch gefüllt

                    logger.info('Auto-Befüllung: Nächster Prüfungstermin für Stil ${stil_id}: ${kommenderTermin}');
                }
            }

            res.json({
                success: true,
                data: stilData
            });
        });
    });
});

// 🆕 API: Trainingsstunden-Analyse für ein Mitglied und Stil
router.get("/:id/stil/:stil_id/training-analysis", (req, res) => {
    const mitglied_id = parseInt(req.params.id, 10);
    const stil_id = parseInt(req.params.stil_id, 10);
    
    if (isNaN(mitglied_id) || isNaN(stil_id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds- oder Stil-ID" });
    }

    // Multi-Query für komplexe Analyse
    const queries = {
        // 1. Aktuelle Graduierung und letzte Prüfung
        currentData: `
            SELECT 
                msd.current_graduierung_id,
                msd.letzte_pruefung,
                g.name as graduierung_name,
                g.trainingsstunden_min,
                g.mindestzeit_monate,
                g.reihenfolge
            FROM mitglied_stil_data msd
            LEFT JOIN graduierungen g ON msd.current_graduierung_id = g.graduierung_id
            WHERE msd.mitglied_id = ? AND msd.stil_id = ?
        `,
        
        // 2. Nächste Graduierung
        nextGraduation: `
            SELECT 
                g.graduierung_id,
                g.name,
                g.trainingsstunden_min,
                g.mindestzeit_monate,
                g.reihenfolge
            FROM graduierungen g
            WHERE g.stil_id = ? AND g.reihenfolge = (
                SELECT MIN(g2.reihenfolge) 
                FROM graduierungen g2 
                JOIN mitglied_stil_data msd ON msd.current_graduierung_id IS NOT NULL
                WHERE g2.stil_id = ? AND g2.reihenfolge > (
                    SELECT g3.reihenfolge 
                    FROM graduierungen g3 
                    WHERE g3.graduierung_id = msd.current_graduierung_id 
                    AND msd.mitglied_id = ?
                )
            )
        `,
        
        // 3. Anwesenheiten seit letzter Prüfung
        attendanceCount: `
            SELECT COUNT(*) as training_sessions
            FROM anwesenheit a
            WHERE a.mitglied_id = ? 
            AND a.anwesend = 1
            AND a.datum >= COALESCE(
                (SELECT msd.letzte_pruefung FROM mitglied_stil_data msd 
                 WHERE msd.mitglied_id = ? AND msd.stil_id = ?), 
                '2020-01-01'
            )
        `
    };

    // Führe alle Queries aus
    Promise.all([
        new Promise((resolve, reject) => {
            db.query(queries.currentData, [mitglied_id, stil_id], (err, results) => {
                if (err) reject(err);
                else resolve(results[0] || null);
            });
        }),
        new Promise((resolve, reject) => {
            db.query(queries.nextGraduation, [stil_id, stil_id, mitglied_id], (err, results) => {
                if (err) reject(err);
                else resolve(results[0] || null);
            });
        }),
        new Promise((resolve, reject) => {
            db.query(queries.attendanceCount, [mitglied_id, mitglied_id, stil_id], (err, results) => {
                if (err) reject(err);
                else resolve(results[0].training_sessions || 0);
            });
        })
    ])
    .then(([currentData, nextGraduation, trainingSessions]) => {
        const analysis = {
            current_graduation: currentData,
            next_graduation: nextGraduation,
            training_sessions_completed: trainingSessions,
            training_sessions_required: nextGraduation?.trainingsstunden_min || 0,
            training_sessions_remaining: Math.max(0, (nextGraduation?.trainingsstunden_min || 0) - trainingSessions),
            is_ready_for_exam: nextGraduation ? trainingSessions >= nextGraduation.trainingsstunden_min : false,
            last_exam_date: currentData?.letzte_pruefung || null
        };

        res.json({
            success: true,
            analysis
        });
    })
    .catch(err => {
        logger.error('Fehler bei der Trainingsstunden-Analyse:', err);
        res.status(500).json({ error: "Fehler bei der Analyse" });
    });
});

// PUT /:id/stil/:stil_id/guertellaenge – Gürtellänge eines Mitglieds für einen Stil setzen
router.put("/:id/stil/:stil_id/guertellaenge", async (req, res) => {
    const mitglied_id = parseInt(req.params.id, 10);
    const stil_id = parseInt(req.params.stil_id, 10);
    const { guertellaenge_cm } = req.body;

    if (isNaN(mitglied_id) || isNaN(stil_id)) {
        return res.status(400).json({ error: 'Ungültige Mitglieds- oder Stil-ID' });
    }

    const laenge = guertellaenge_cm ? parseInt(guertellaenge_cm, 10) : null;
    if (laenge !== null && (laenge < 100 || laenge > 500)) {
        return res.status(400).json({ error: 'Gürtellänge muss zwischen 100 und 500 cm liegen' });
    }

    const pool = db.promise();
    try {
        const [existing] = await pool.query(
            'SELECT 1 FROM mitglied_stil_data WHERE mitglied_id = ? AND stil_id = ?',
            [mitglied_id, stil_id]
        );
        if (existing.length > 0) {
            await pool.query(
                'UPDATE mitglied_stil_data SET guertellaenge_cm = ?, aktualisiert_am = CURRENT_TIMESTAMP WHERE mitglied_id = ? AND stil_id = ?',
                [laenge, mitglied_id, stil_id]
            );
        } else {
            await pool.query(
                'INSERT INTO mitglied_stil_data (mitglied_id, stil_id, guertellaenge_cm) VALUES (?, ?, ?)',
                [mitglied_id, stil_id, laenge]
            );
        }
        res.json({ success: true, guertellaenge_cm: laenge });
    } catch (err) {
        logger.error('Fehler beim Speichern der Gürtellänge:', err);
        res.status(500).json({ error: 'Datenbankfehler' });
    }
});

// ✅ SEPA-Mandat abrufen + DOJO-FILTER (KRITISCH - Bankdaten!)
router.get("/:id/sepa-mandate", (req, res) => {
    const { id } = req.params;
    // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
    const secureDojoId = getSecureDojoId(req);

    // 🔒 KRITISCHER DOJO-FILTER: Multi-Tenancy Isolation
    let whereConditions = ['sm.mitglied_id = ?', 'sm.status = \'aktiv\''];
    let queryParams = [id];

    // Dojo-Filter: Super-Admin (secureDojoId === null) kann alle sehen
    if (secureDojoId === null) {
        // Super-Admin: Nur zentral verwaltete Dojos (ohne separate Tenants)
        whereConditions.push(`m.dojo_id NOT IN (
            SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL AND rolle NOT IN ('eingeschraenkt', 'trainer', 'checkin')
        )`);
    } else {
        // Normaler Admin: Nur eigenes Dojo
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(secureDojoId);
    }

    const query = `
        SELECT sm.*
        FROM sepa_mandate sm
        JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY sm.erstellungsdatum DESC
        LIMIT 1
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen des SEPA-Mandats:', err);
            return res.status(500).json({ error: "Fehler beim Abrufen des SEPA-Mandats" });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: "Kein aktives SEPA-Mandat gefunden oder keine Berechtigung" });
        }

        const sm = results[0];
        // Audit-Log: Bankdaten gelesen
        auditLog.log({
          req,
          aktion: auditLog.AKTION.SEPA_MANDAT_ABGERUFEN,
          kategorie: auditLog.KATEGORIE.SEPA,
          entity_type: 'mitglied',
          entity_id: parseInt(id),
          beschreibung: 'SEPA-Mandat abgerufen',
        }).catch(() => {});
        if (sm && sm.iban) sm.iban = maskIBAN(sm.iban);
        res.json(sm);
    });
});

// ✅ SEPA-Mandat erstellen + DOJO-FILTER (KRITISCH - Bankdaten!)
router.post("/:id/sepa-mandate",
    validateId('id'),
    requireFields(['iban', 'bic', 'kontoinhaber']),
    (req, res) => {
    const { id } = req.params;
    // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
    const secureDojoId = getSecureDojoId(req);
    let { iban, bic, kontoinhaber, bankname } = req.body;

    // IBAN normalisieren (Leerzeichen entfernen, Großbuchstaben)
    iban = iban.replace(/\s/g, '').toUpperCase();
    bic = bic.replace(/\s/g, '').toUpperCase();

    // IBAN Format-Validierung + Modulo-97-Checksumme
    const ibanRegex = /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/;
    if (!ibanRegex.test(iban)) {
        return res.status(400).json({
            success: false,
            error: { message: "Ungültiges IBAN-Format", code: 400 }
        });
    }
    // Modulo-97 Prüfsumme (ISO 7064)
    const ibanDigits = (iban.slice(4) + iban.slice(0, 4)).split('').map(c => {
        const code = c.charCodeAt(0);
        return code >= 65 ? (code - 55).toString() : c;
    }).join('');
    let remainder = 0;
    for (const ch of ibanDigits) { remainder = (remainder * 10 + parseInt(ch, 10)) % 97; }
    if (remainder !== 1) {
        return res.status(400).json({
            success: false,
            error: { message: "IBAN-Prüfsumme ungültig. Bitte IBAN prüfen.", code: 400 }
        });
    }

    // 🔒 KRITISCH: Zuerst prüfen ob Mitglied zum richtigen Dojo gehört!
    let checkConditions = ['mitglied_id = ?'];
    let checkParams = [id];

    if (secureDojoId) {
        checkConditions.push('dojo_id = ?');
        checkParams.push(secureDojoId);
    }

    const checkQuery = `SELECT mitglied_id, dojo_id FROM mitglieder WHERE ${checkConditions.join(' AND ')}`;

    db.query(checkQuery, checkParams, (checkErr, checkResults) => {
        if (checkErr) {
            logger.error('Fehler bei Berechtigungsprüfung:', checkErr);
            return res.status(500).json({ error: "Fehler bei Berechtigungsprüfung" });
        }

        if (checkResults.length === 0) {
            logger.error('SICHERHEITSVERLETZUNG: Versuch SEPA-Mandat für fremdes Mitglied ${id} zu erstellen!');
            return res.status(403).json({ error: "Keine Berechtigung - Mitglied gehört nicht zum ausgewählten Dojo" });
        }

        const memberDojoId = checkResults[0].dojo_id;

        // Erst Gläubiger-ID aus dem RICHTIGEN Dojo-Einstellungen abrufen
        const dojoQuery = `SELECT id, sepa_glaeubiger_id FROM dojo WHERE id = ? LIMIT 1`;

        db.query(dojoQuery, [memberDojoId], (dojoErr, dojoResults) => {
            if (dojoErr) {
                logger.error('Fehler beim Abrufen der Dojo-Einstellungen:', dojoErr);
                return res.status(500).json({ error: "Fehler beim Abrufen der Dojo-Einstellungen" });
            }

            // Gläubiger-ID aus DB oder Fallback
            const glaeubiger_id = (dojoResults.length > 0 && dojoResults[0].sepa_glaeubiger_id)
                ? dojoResults[0].sepa_glaeubiger_id
                : "DE98ZZZ09999999999"; // Fallback

            // Generiere eindeutige Mandatsreferenz
            const timestamp = Date.now();
            const mandatsreferenz = `DOJO${memberDojoId}-${id}-${timestamp}`;

            const query = `
                INSERT INTO sepa_mandate (
                    mitglied_id, mandatsreferenz, glaeubiger_id,
                    iban, bic, kontoinhaber, bankname
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(query, [id, mandatsreferenz, glaeubiger_id, iban, bic, kontoinhaber, bankname], (err, result) => {
                if (err) {
                    logger.error('Fehler beim Erstellen des SEPA-Mandats:', err);
                    return res.status(500).json({ error: "Fehler beim Erstellen des SEPA-Mandats" });
                }

                // Mandate-Details für Response
                const newMandate = {
                    mandat_id: result.insertId,
                    mitglied_id: id,
                    dojo_id: memberDojoId,
                    mandatsreferenz,
                    glaeubiger_id,
                    erstellungsdatum: new Date(),
                    status: 'aktiv',
                    iban,
                    bic,
                    kontoinhaber,
                    bankname
                };

                // Aktualisiere auch die Bankdaten im Mitglieder-Datensatz (nur für dieses Dojo!)
                const updateMemberQuery = `
                    UPDATE mitglieder
                    SET iban = ?, bic = ?, kontoinhaber = ?, bankname = ?, zahlungsmethode = 'SEPA-Lastschrift'
                    WHERE mitglied_id = ? AND dojo_id = ?
                `;

                db.query(updateMemberQuery, [iban, bic, kontoinhaber, bankname, id, memberDojoId], (updateErr) => {
                    if (updateErr) {

                    }
                });

                const maskedMandate = { ...newMandate, iban: maskIBAN(newMandate.iban) };
                // Audit-Log: Bankdaten-Eintrag
                auditLog.log({
                  req,
                  aktion: auditLog.AKTION.SEPA_MANDAT_ERSTELLT,
                  kategorie: auditLog.KATEGORIE.SEPA,
                  entity_type: 'mitglied',
                  entity_id: parseInt(id),
                  beschreibung: 'SEPA-Mandat erstellt (IBAN: ' + maskIBAN(iban) + ')',
                }).catch(() => {});
                res.status(201).json(maskedMandate);
            });
        });
    });
});

// ✅ SEPA-Mandat widerrufen + DOJO-FILTER (KRITISCH!)
router.delete("/:id/sepa-mandate", (req, res) => {
    const { id } = req.params;
    // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
    const secureDojoId = getSecureDojoId(req);
    const { grund } = req.body; // Optional: Grund für Archivierung

    // 🔒 KRITISCHER DOJO-FILTER: Multi-Tenancy Isolation
    let whereConditions = ['sm.mitglied_id = ?', 'sm.status = \'aktiv\''];
    let queryParams = [grund || 'Widerrufen durch Benutzer', id];

    let joinClause = '';
    if (secureDojoId) {
        joinClause = 'JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id';
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(secureDojoId);
    }

    const query = `
        UPDATE sepa_mandate sm
        ${joinClause}
        SET sm.status = 'widerrufen',
            sm.widerruf_datum = NOW(),
            sm.archiviert = 1,
            sm.archiviert_am = NOW(),
            sm.archiviert_grund = ?
        WHERE ${whereConditions.join(' AND ')}
    `;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            logger.error('Fehler beim Archivieren des SEPA-Mandats:', err);
            return res.status(500).json({ error: "Fehler beim Archivieren des SEPA-Mandats" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Kein aktives SEPA-Mandat gefunden oder keine Berechtigung" });
        }

        // Audit-Log: Mandat widerrufen
        auditLog.log({
          req,
          aktion: auditLog.AKTION.SEPA_MANDAT_WIDERRUFEN,
          kategorie: auditLog.KATEGORIE.SEPA,
          entity_type: 'mitglied',
          entity_id: parseInt(id),
          beschreibung: 'SEPA-Mandat widerrufen. Grund: ' + (grund || 'k.A.'),
        }).catch(() => {});
        res.json({ success: true, message: "SEPA-Mandat wurde archiviert" });
    });
});

// ✅ Archivierte SEPA-Mandate abrufen + DOJO-FILTER (KRITISCH!)
router.get("/:id/sepa-mandate/archiv", (req, res) => {
    const { id } = req.params;
    // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
    const secureDojoId = getSecureDojoId(req);

    // 🔒 KRITISCHER DOJO-FILTER: Multi-Tenancy Isolation
    let whereConditions = ['sm.mitglied_id = ?', '(sm.archiviert = 1 OR sm.status = \'widerrufen\')'];
    let queryParams = [id];

    if (secureDojoId) {
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(secureDojoId);
    }

    const query = `
        SELECT sm.*, m.vorname, m.nachname, m.email, m.dojo_id
        FROM sepa_mandate sm
        JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY COALESCE(sm.archiviert_am, sm.widerruf_datum) DESC
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen archivierter SEPA-Mandate:', err);
            return res.status(500).json({ error: "Fehler beim Abrufen archivierter Mandate" });
        }

        res.json(results.map(r => { if (r.iban) r.iban = maskIBAN(r.iban); return r; }));
    });
});

// ✅ SEPA-Mandat als PDF herunterladen + DOJO-FILTER (KRITISCH!)
router.get("/:id/sepa-mandate/download", async (req, res) => {
    const { id } = req.params;
    const { mandate_id, dojo_id } = req.query;

    try {
        let query;
        let queryParams;

        // 🔒 KRITISCHER DOJO-FILTER: Richtiges Dojo-JOIN statt CROSS JOIN!
        let whereConditions = [];

        if (mandate_id) {
            // Download eines spezifischen archivierten Mandats
            whereConditions = ['sm.mandat_id = ?', 'sm.mitglied_id = ?'];
            queryParams = [mandate_id, id];

            if (dojo_id && dojo_id !== 'all') {
                whereConditions.push('m.dojo_id = ?');
                queryParams.push(parseInt(dojo_id));
            }

            query = `
                SELECT sm.*, m.vorname, m.nachname, m.strasse, m.hausnummer, m.plz, m.ort, m.dojo_id,
                       d.dojoname, d.inhaber, d.strasse as dojo_strasse, d.hausnummer as dojo_hausnummer,
                       d.plz as dojo_plz, d.ort as dojo_ort, d.sepa_glaeubiger_id
                FROM sepa_mandate sm
                JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
                JOIN dojo d ON m.dojo_id = d.id
                WHERE ${whereConditions.join(' AND ')}
            `;
        } else {
            // Download des aktuellen aktiven Mandats
            whereConditions = ['sm.mitglied_id = ?', 'sm.status = \'aktiv\''];
            queryParams = [id];

            if (dojo_id && dojo_id !== 'all') {
                whereConditions.push('m.dojo_id = ?');
                queryParams.push(parseInt(dojo_id));
            }

            query = `
                SELECT sm.*, m.vorname, m.nachname, m.strasse, m.hausnummer, m.plz, m.ort, m.dojo_id,
                       d.dojoname, d.inhaber, d.strasse as dojo_strasse, d.hausnummer as dojo_hausnummer,
                       d.plz as dojo_plz, d.ort as dojo_ort, d.sepa_glaeubiger_id
                FROM sepa_mandate sm
                JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
                JOIN dojo d ON m.dojo_id = d.id
                WHERE ${whereConditions.join(' AND ')}
                ORDER BY sm.erstellungsdatum DESC
                LIMIT 1
            `;
        }

        db.query(query, queryParams, async (err, results) => {
            if (err) {
                logger.error('Fehler beim Abrufen der Mandate-Daten:', err);
                return res.status(500).json({ error: "Fehler beim Generieren des PDFs" });
            }

            if (results.length === 0) {
                return res.status(404).json({ error: "Kein aktives SEPA-Mandat gefunden" });
            }

            const mandate = results[0];
            
            try {
                // PDF generieren
                const pdfGenerator = new SepaPdfGenerator();
                const pdfBuffer = await pdfGenerator.generateSepaMandatePDF(mandate);
                
                // HTTP-Headers für PDF-Download setzen
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="SEPA-Mandat_${mandate.nachname}_${mandate.vorname}.pdf"`);
                res.setHeader('Content-Length', pdfBuffer.length);
                
                // PDF-Buffer senden
                res.send(pdfBuffer);

            } catch (pdfError) {
                logger.error('Fehler bei der PDF-Generierung:', pdfError);
                res.status(500).json({ error: "Fehler bei der PDF-Generierung" });
            }
        });
        
    } catch (error) {
        logger.error('Allgemeiner Fehler beim PDF-Download:', error);
        res.status(500).json({ error: "Fehler beim PDF-Download" });
    }
});

// 🆕 API: Duplikatsprüfung für neue Mitglieder
router.post("/check-duplicate", (req, res) => {
    const { vorname, nachname, geburtsdatum, geschlecht } = req.body;

    if (!vorname || !nachname || !geburtsdatum) {
        return res.status(400).json({ error: "Vorname, Nachname und Geburtsdatum sind erforderlich" });
    }

    const query = `
        SELECT 
            mitglied_id,
            vorname,
            nachname,
            geburtsdatum,
            geschlecht,
            email,
            aktiv,
            eintrittsdatum
        FROM mitglieder 
        WHERE LOWER(vorname) = LOWER(?) 
        AND LOWER(nachname) = LOWER(?) 
        AND geburtsdatum = ?
        ${geschlecht ? 'AND geschlecht = ?' : ''}
        ORDER BY eintrittsdatum DESC
    `;

    const params = geschlecht ? [vorname, nachname, geburtsdatum, geschlecht] : [vorname, nachname, geburtsdatum];

    db.query(query, params, (err, results) => {
        if (err) {
            logger.error('Fehler bei der Duplikatsprüfung:', err);
            return res.status(500).json({ error: "Fehler bei der Duplikatsprüfung" });
        }

        const isDuplicate = results.length > 0;

        res.json({
            isDuplicate,
            matches: results,
            count: results.length,
            message: isDuplicate ? 
                `Gefunden: ${results[0].vorname} ${results[0].nachname} (${results[0].geburtsdatum})` : 
                "Kein Duplikat gefunden"
        });
    });
});

// 🆕 API: Neues Mitglied erstellen (erweitert) + DOJO-ID PFLICHTFELD! (KRITISCH!)
router.post("/",
    requireFields(['vorname', 'nachname', 'geburtsdatum', 'dojo_id']),
    sanitizeStrings(['vorname', 'nachname', 'email', 'strasse', 'ort', 'bemerkungen']),
    (req, res) => {

    const memberData = req.body;

    // 🔄 DOKUMENTAKZEPTANZEN: Kopiere Daten vom Vertrag auch in mitglieder-Tabelle (für Auswertungen!)
    // Frontend sendet: vertrag_agb_akzeptiert, Backend braucht: agb_akzeptiert + agb_akzeptiert_am
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19); // MySQL-Format

    if (memberData.vertrag_agb_akzeptiert) {
        memberData.agb_akzeptiert = true;
        memberData.agb_akzeptiert_am = now;
    }
    if (memberData.vertrag_datenschutz_akzeptiert) {
        memberData.datenschutz_akzeptiert = true;
        memberData.datenschutz_akzeptiert_am = now;
    }
    if (memberData.vertrag_hausordnung_akzeptiert) {
        memberData.hausordnung_akzeptiert = true;
        memberData.hausordnung_akzeptiert_am = now;
    }
    if (memberData.vertrag_haftungsausschluss_akzeptiert) {
        memberData.haftungsausschluss_akzeptiert = true;
        memberData.haftungsausschluss_datum = now;
    }
    if (memberData.vertrag_gesundheitserklaerung) {
        memberData.gesundheitserklaerung = true;
        memberData.gesundheitserklaerung_datum = now;
    }
    if (memberData.vertrag_foto_einverstaendnis) {
        memberData.foto_einverstaendnis = true;
        memberData.foto_einverstaendnis_datum = now;
    }

    // 👨‍👩‍👧 SPEZIALFALL: existing_member_mode - Nur Familienmitglieder hinzufügen (kein neues Hauptmitglied)
    if (memberData.existing_member_mode && memberData.family_members && memberData.family_members.length > 0) {
        logger.info(`👨‍👩‍👧 Existing Member Mode: Füge ${memberData.family_members.length} Familienmitglieder zu bestehendem Mitglied hinzu`);

        // dojo_id vom bestehenden Mitglied holen wenn nicht vorhanden
        const dojoId = memberData.dojo_id || memberData.existing_member_dojo_id;
        if (!dojoId) {
            return res.status(400).json({ error: "dojo_id ist erforderlich für Familienmitglieder" });
        }

        const existingMemberId = memberData.existing_member_id;
        if (!existingMemberId) {
            return res.status(400).json({ error: "existing_member_id ist erforderlich für Familienmitglieder" });
        }

        // 1. Bestehende Mitgliederdaten holen (für familien_id und Vertreter-Info)
        db.query(
            'SELECT mitglied_id, familien_id, vorname, nachname, email, telefon FROM mitglieder WHERE mitglied_id = ?',
            [existingMemberId],
            (err, existingMemberRows) => {
                if (err || existingMemberRows.length === 0) {
                    logger.error('Fehler beim Abrufen des bestehenden Mitglieds:', err);
                    return res.status(404).json({ error: "Bestehendes Mitglied nicht gefunden" });
                }

                const existingMember = existingMemberRows[0];
                let familienId = existingMember.familien_id;

                // 2. Falls kein familien_id vorhanden, verwende mitglied_id als familien_id
                const ensureFamilienIdAndContinue = () => {
                    // Familienmitglieder erstellen mit familien_id und Vertreter-Info
                    const enrichedMainData = {
                        ...memberData,
                        familien_id: familienId,
                        vertreter_vorname: existingMember.vorname,
                        vertreter_nachname: existingMember.nachname,
                        vertreter_email: existingMember.email || memberData.email,
                        vertreter_telefon: existingMember.telefon || memberData.telefon
                    };

                    createFamilyMembers(memberData.family_members, enrichedMainData, dojoId, (famErr, createdFamilyMembers) => {
                        if (famErr) {
                            logger.error('Fehler beim Erstellen der Familienmitglieder:', famErr);
                            return res.status(500).json({ error: "Fehler beim Erstellen der Familienmitglieder" });
                        }

                        res.status(201).json({
                            success: true,
                            message: `${createdFamilyMembers.length} Familienmitglieder erfolgreich erstellt`,
                            family_members_created: createdFamilyMembers,
                            existing_member_id: existingMemberId,
                            familien_id: familienId
                        });
                    });
                };

                if (!familienId) {
                    // Setze mitglied_id als familien_id für das bestehende Mitglied
                    familienId = existingMemberId;
                    db.query(
                        'UPDATE mitglieder SET familien_id = ? WHERE mitglied_id = ?',
                        [familienId, existingMemberId],
                        (updateErr) => {
                            if (updateErr) {
                                logger.error('Fehler beim Setzen der familien_id:', updateErr);
                            } else {
                                logger.info(`✅ familien_id ${familienId} für bestehendes Mitglied ${existingMemberId} gesetzt`);
                            }
                            ensureFamilienIdAndContinue();
                        }
                    );
                } else {
                    ensureFamilienIdAndContinue();
                }
            }
        );
        return; // Wichtig: Hier aufhören, nicht weiter zum normalen Flow
    }

    // 🔒 KRITISCH: dojo_id ist PFLICHTFELD für Tax Compliance!
    if (!memberData.dojo_id) {
        logger.error('KRITISCHER FEHLER: Neues Mitglied ohne dojo_id!');
        return res.status(400).json({
            error: "dojo_id ist erforderlich - jedes Mitglied MUSS einem Dojo zugeordnet sein (Tax Compliance!)",
            required: ['vorname', 'nachname', 'geburtsdatum', 'dojo_id']
        });
    }

    // Erforderliche Felder prüfen
    const requiredFields = ['vorname', 'nachname', 'geburtsdatum', 'dojo_id'];
    const missingFields = requiredFields.filter(field => !memberData[field]);

    if (missingFields.length > 0) {
        return res.status(400).json({
            error: "Fehlende erforderliche Felder",
            missingFields
        });
    }

    // SQL Query für INSERT mit allen möglichen Feldern (inkl. dojo_id!)
    const fields = [
        'dojo_id',  // 🔒 KRITISCH: dojo_id MUSS als erstes kommen!
        'vorname', 'nachname', 'geburtsdatum', 'geschlecht', 'schueler_student', 'gewicht',
        'email', 'telefon', 'telefon_mobil', 'strasse', 'hausnummer',
        'plz', 'ort', 'iban', 'bic', 'bankname', 'kontoinhaber',
        'allergien', 'medizinische_hinweise', 'notfallkontakt_name',
        'notfallkontakt_telefon', 'notfallkontakt_verhaeltnis',
        'hausordnung_akzeptiert', 'hausordnung_akzeptiert_am',
        'datenschutz_akzeptiert', 'datenschutz_akzeptiert_am',
        'foto_einverstaendnis', 'foto_einverstaendnis_datum',
        'agb_akzeptiert', 'agb_akzeptiert_am',
        'haftungsausschluss_akzeptiert', 'haftungsausschluss_datum',
        'gesundheitserklaerung', 'gesundheitserklaerung_datum',
        'eintrittsdatum'
    ];

    const insertFields = fields.filter(field => memberData[field] !== undefined);
    const placeholders = insertFields.map(() => '?').join(', ');
    const values = insertFields.map(field => memberData[field]);

    const query = `
        INSERT INTO mitglieder (${insertFields.join(', ')})
        VALUES (${placeholders})
    `;

    db.query(query, values, (err, result) => {
        if (err) {
            logger.error('Fehler beim Erstellen des Mitglieds:', err);
            return res.status(500).json({
                error: "Fehler beim Erstellen des Mitglieds",
                details: err.message
            });
        }

        const newMemberId = result.insertId;

        // Audit-Log: Neues Mitglied erstellt
        auditLog.log({
            req,
            aktion: auditLog.AKTION.MITGLIED_ERSTELLT,
            kategorie: auditLog.KATEGORIE.MITGLIED,
            entityType: 'mitglieder',
            entityId: newMemberId,
            entityName: `${memberData.vorname} ${memberData.nachname}`,
            neueWerte: { vorname: memberData.vorname, nachname: memberData.nachname, dojo_id: memberData.dojo_id },
            beschreibung: `Neues Mitglied erstellt: ${memberData.vorname} ${memberData.nachname}`
        });

        // 🆕 VERTRAG AUTOMATISCH ERSTELLEN (wenn Vertragsdaten vorhanden)
        if (memberData.vertrag_tarif_id) {

            // Tarif zuerst laden, um billing_cycle und monatsbeitrag zu bestimmen
            db.query('SELECT price_cents, billing_cycle, mindestlaufzeit_monate, kuendigungsfrist_monate FROM tarife WHERE id = ?', [memberData.vertrag_tarif_id], (tarifFetchErr, tarifFetchRows) => {
            const fetchedTarif = tarifFetchRows?.[0] || {};
            const tarifPreis = fetchedTarif.price_cents ? fetchedTarif.price_cents / 100 : null;
            const billing_cycle = (memberData.vertrag_billing_cycle || fetchedTarif.billing_cycle || 'monthly').toUpperCase();
            const vertragsbeginn = memberData.vertrag_vertragsbeginn || new Date().toISOString().split('T')[0];
            const mindestlaufzeit = memberData.vertrag_mindestlaufzeit_monate || fetchedTarif.mindestlaufzeit_monate || 12;
            const startDate = new Date(vertragsbeginn);
            const endeDate = new Date(startDate.getFullYear(), startDate.getMonth() + mindestlaufzeit, 0);
            const vertragsende = endeDate.toISOString().split('T')[0];

            const vertragData = {
                mitglied_id: newMemberId,
                dojo_id: memberData.dojo_id,  // 🔒 KRITISCH: Tax Compliance!
                tarif_id: memberData.vertrag_tarif_id,
                vertragsbeginn,
                vertragsende,
                billing_cycle,
                monatsbeitrag: tarifPreis,
                payment_method: memberData.vertrag_payment_method || 'direct_debit',
                kuendigungsfrist_monate: memberData.vertrag_kuendigungsfrist_monate || fetchedTarif.kuendigungsfrist_monate || 3,
                mindestlaufzeit_monate: mindestlaufzeit,
                automatische_verlaengerung: memberData.vertrag_automatische_verlaengerung !== undefined ? memberData.vertrag_automatische_verlaengerung : true,
                verlaengerung_monate: memberData.vertrag_verlaengerung_monate || 12,
                faelligkeit_tag: memberData.vertrag_faelligkeit_tag || 1,
                agb_akzeptiert_am: memberData.vertrag_agb_akzeptiert ? new Date() : null,
                agb_version: memberData.vertrag_agb_version || '1.0',
                datenschutz_akzeptiert_am: memberData.vertrag_datenschutz_akzeptiert ? new Date() : null,
                datenschutz_version: memberData.vertrag_datenschutz_version || '1.0',
                hausordnung_akzeptiert_am: memberData.vertrag_hausordnung_akzeptiert ? new Date() : null,
                haftungsausschluss_akzeptiert: memberData.vertrag_haftungsausschluss_akzeptiert ? 1 : 0,
                haftungsausschluss_datum: memberData.vertrag_haftungsausschluss_akzeptiert ? new Date() : null,
                gesundheitserklaerung: memberData.vertrag_gesundheitserklaerung ? 1 : 0,
                gesundheitserklaerung_datum: memberData.vertrag_gesundheitserklaerung ? new Date() : null,
                foto_einverstaendnis: memberData.vertrag_foto_einverstaendnis ? 1 : 0,
                foto_einverstaendnis_datum: memberData.vertrag_foto_einverstaendnis ? new Date() : null,
                status: 'aktiv',
                unterschrift_datum: new Date()
            };

            const vertragFields = Object.keys(vertragData);
            const vertragPlaceholders = vertragFields.map(() => '?').join(', ');
            const vertragValues = vertragFields.map(field => vertragData[field]);

            const vertragQuery = `
                INSERT INTO vertraege (${vertragFields.join(', ')})
                VALUES (${vertragPlaceholders})
            `;

            db.query(vertragQuery, vertragValues, (vertragErr, vertragResult) => {
                if (vertragErr) {
                    logger.error('Fehler beim Erstellen des Vertrags:', vertragErr);
                    // Mitglied wurde erstellt, aber Vertrag fehlgeschlagen
                    return res.status(201).json({
                        success: true,
                        mitglied_id: newMemberId,
                        dojo_id: memberData.dojo_id,
                        warning: "Mitglied erstellt, aber Vertrag konnte nicht angelegt werden",
                        vertrag_error: vertragErr.message,
                        data: {
                            ...memberData,
                            mitglied_id: newMemberId
                        }
                    });
                }

                const vertragId = vertragResult.insertId;

                // 💰 Ersten Beitrag automatisch erstellen (Tarif-Preis bereits bekannt)
                const createFirstBeitrag = (callback) => {
                        if (!tarifPreis) {
                            logger.warn('Tarif nicht gefunden für Beitragserstellung');
                            return callback();
                        }

                        const beitragQuery = `
                            INSERT INTO beitraege (mitglied_id, betrag, zahlungsdatum, zahlungsart, bezahlt, dojo_id)
                            VALUES (?, ?, DATE_FORMAT(NOW(), '%Y-%m-01'), 'Lastschrift', 0, ?)
                        `;
                        db.query(beitragQuery, [newMemberId, tarifPreis, memberData.dojo_id], (beitragErr) => {
                            if (beitragErr) {
                                logger.error('Fehler beim Erstellen des ersten Beitrags:', beitragErr);
                            } else {
                                logger.info(`💰 Erster Beitrag erstellt: ${tarifPreis}€ für Mitglied ${newMemberId}`);
                            }
                            callback();
                        });
                };

                // Beitrag erstellen, dann User-Account und Familienmitglieder
                createFirstBeitrag(() => {
                    // 🏦 SEPA-Mandat automatisch erstellen (fire-and-forget)
                    autoCreateSepaMandate(newMemberId, memberData, memberData.dojo_id);
                    // 🔐 User-Account erstellen (nur bei öffentlicher Registrierung mit Benutzername/Passwort)
                    createUserAccountIfNeeded(memberData, newMemberId, (userErr, userResult) => {
                        // 👨‍👩‍👧 Familienmitglieder erstellen (wenn vorhanden)
                        createFamilyMembers(memberData.family_members, memberData, memberData.dojo_id, (famErr, createdFamilyMembers) => {
                            const response = {
                                success: true,
                                mitglied_id: newMemberId,
                                vertrag_id: vertragId,
                                dojo_id: memberData.dojo_id,
                                message: "Mitglied und Vertrag erfolgreich erstellt",
                                family_members_created: createdFamilyMembers || [],
                                data: {
                                    ...memberData,
                                    mitglied_id: newMemberId,
                                    vertrag_id: vertragId
                                }
                            };
                            // User-Account Info hinzufügen (falls vorhanden)
                            if (userResult) {
                                response.user_account = userResult;
                            }
                            res.status(201).json(response);
                        });
                    });
                });
            });
            }); // closes tarif-fetch db.query
        } else {
            // Kein Vertrag, nur Mitglied erstellt
            // 🏦 SEPA-Mandat automatisch erstellen (fire-and-forget)
            autoCreateSepaMandate(newMemberId, memberData, memberData.dojo_id);
            // 🔐 User-Account erstellen (nur bei öffentlicher Registrierung mit Benutzername/Passwort)
            createUserAccountIfNeeded(memberData, newMemberId, (userErr, userResult) => {
                // 👨‍👩‍👧 Familienmitglieder erstellen (wenn vorhanden)
                createFamilyMembers(memberData.family_members, memberData, memberData.dojo_id, (famErr, createdFamilyMembers) => {
                    const response = {
                        success: true,
                        mitglied_id: newMemberId,
                        dojo_id: memberData.dojo_id,
                        message: "Mitglied erfolgreich erstellt",
                        family_members_created: createdFamilyMembers || [],
                        data: {
                            ...memberData,
                            mitglied_id: newMemberId
                        }
                    };
                    // User-Account Info hinzufügen (falls vorhanden)
                    if (userResult) {
                        response.user_account = userResult;
                    }
                    res.status(201).json(response);
                });
            });
        }
    });
});

// 🏦 HILFSFUNKTION: SEPA-Mandat automatisch anlegen (wenn IBAN + Lastschrift vorhanden)
function autoCreateSepaMandate(mitgliedId, memberData, dojoId) {
    // Prüfe Zahlungsmethode aus verschiedenen möglichen Feldern
    const zahlungsart = (memberData.zahlungsmethode || memberData.vertrag_payment_method || memberData.payment_method || '').toLowerCase();
    const iban = memberData.iban;
    // Erstelle Mandat bei SEPA/Lastschrift ODER wenn IBAN vorhanden und kein Stripe
    const isSepa = zahlungsart.includes('lastschrift') || zahlungsart.includes('sepa') || zahlungsart.includes('direct_debit');
    if (!iban || (!isSepa && zahlungsart !== '')) {
        return; // Kein SEPA nötig
    }
    // Prüfen ob bereits ein Mandat existiert
    db.query('SELECT mandat_id FROM sepa_mandate WHERE mitglied_id = ? AND status = ? LIMIT 1', [mitgliedId, 'aktiv'], (checkErr, checkRows) => {
        if (checkErr || (checkRows && checkRows.length > 0)) return; // Fehler oder bereits vorhanden
        // Gläubiger-ID aus Dojo holen, Fallback auf Test-ID
        db.query('SELECT sepa_glaeubiger_id FROM dojo WHERE id = ?', [dojoId], (dojoErr, dojoRows) => {
            const glaeubigerRaw = dojoRows?.[0]?.sepa_glaeubiger_id || '';
            const glaeubigerId = glaeubigerRaw.length >= 13 ? glaeubigerRaw : 'DE98ZZZ09999999999';
            const mandatsreferenz = `DOJO${dojoId}-${mitgliedId}-${Date.now()}`;
            const kontoinhaber = memberData.kontoinhaber || `${memberData.vorname} ${memberData.nachname}`;
            const bic = (memberData.bic || '').length >= 8 ? memberData.bic : '';
            db.query(
                `INSERT INTO sepa_mandate (mitglied_id, mandatsreferenz, glaeubiger_id, iban, bic, kontoinhaber, status, mandat_typ, sequenz, provider)
                 VALUES (?, ?, ?, ?, ?, ?, 'aktiv', 'CORE', 'FRST', 'manual_sepa')`,
                [mitgliedId, mandatsreferenz, glaeubigerId, iban, bic, kontoinhaber],
                (insertErr) => {
                    if (insertErr) {
                        logger.error('⚠️ Auto-SEPA-Mandat konnte nicht erstellt werden:', insertErr.message);
                    } else {
                        logger.info(`✅ SEPA-Mandat automatisch erstellt für Mitglied ${mitgliedId}: ${mandatsreferenz}`);
                    }
                }
            );
        });
    });
}

// 👨‍👩‍👧 HILFSFUNKTION: Familienmitglieder erstellen
async function createFamilyMembers(familyMembers, mainMemberData, dojoId, callback) {
    if (!familyMembers || familyMembers.length === 0) {
        return callback(null, []);
    }

    logger.info(`👨‍👩‍👧 Erstelle ${familyMembers.length} Familienmitglieder...`);
    const createdMembers = [];
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Hilfsfunktion: Prüfe ob Person minderjährig ist
    const isMinor = (geburtsdatum) => {
        if (!geburtsdatum) return false;
        const birthDate = new Date(geburtsdatum);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age < 18;
    };

    const createMember = async (index) => {
        if (index >= familyMembers.length) {
            return callback(null, createdMembers);
        }

        const fm = familyMembers[index];
        logger.info(`👤 Erstelle Familienmitglied ${index + 1}: ${fm.vorname} ${fm.nachname}`);

        // Prüfe ob das Familienmitglied minderjährig ist
        const isFamilyMemberMinor = isMinor(fm.geburtsdatum);

        // Familienmitglied-Daten vorbereiten
        const memberFields = {
            dojo_id: dojoId,
            vorname: fm.vorname,
            nachname: fm.nachname,
            geburtsdatum: fm.geburtsdatum,
            geschlecht: fm.geschlecht || 'divers',
            email: fm.email || null,
            // 👨‍👩‍👧 FAMILIEN-VERKNÜPFUNG
            familien_id: mainMemberData.familien_id || null,
            rabatt_grund: 'Familie',
            // Adresse vom Hauptmitglied übernehmen
            strasse: mainMemberData.strasse || null,
            hausnummer: mainMemberData.hausnummer || null,
            plz: mainMemberData.plz || null,
            ort: mainMemberData.ort || null,
            telefon: mainMemberData.telefon || null,
            // 💳 BANKDATEN vom Hauptmitglied übernehmen
            kontoinhaber: mainMemberData.kontoinhaber || null,
            iban: mainMemberData.iban || null,
            bic: mainMemberData.bic || null,
            bankname: mainMemberData.bankname || mainMemberData.bank_name || null,
            // 👨‍👩‍👧 VERTRETER für Minderjährige
            vertreter1_typ: isFamilyMemberMinor ? 'sonstiger gesetzl. Vertreter' : null,
            vertreter1_name: isFamilyMemberMinor ? `${mainMemberData.vertreter_vorname || mainMemberData.vorname} ${mainMemberData.vertreter_nachname || mainMemberData.nachname}` : null,
            vertreter1_email: isFamilyMemberMinor ? (mainMemberData.vertreter_email || mainMemberData.email) : null,
            vertreter1_telefon: isFamilyMemberMinor ? (mainMemberData.vertreter_telefon || mainMemberData.telefon) : null,
            // Dokumentakzeptanzen (gelten für alle Familienmitglieder)
            agb_akzeptiert: mainMemberData.vertrag_agb_akzeptiert ? 1 : 0,
            agb_akzeptiert_am: mainMemberData.vertrag_agb_akzeptiert ? now : null,
            datenschutz_akzeptiert: mainMemberData.vertrag_datenschutz_akzeptiert ? 1 : 0,
            datenschutz_akzeptiert_am: mainMemberData.vertrag_datenschutz_akzeptiert ? now : null,
            hausordnung_akzeptiert: mainMemberData.vertrag_hausordnung_akzeptiert ? 1 : 0,
            hausordnung_akzeptiert_am: mainMemberData.vertrag_hausordnung_akzeptiert ? now : null,
            eintrittsdatum: now.split(' ')[0]
        };

        logger.info(`📎 Familien-Verknüpfung: familien_id=${memberFields.familien_id}, minderjährig=${isFamilyMemberMinor}`);

        const insertFields = Object.keys(memberFields).filter(k => memberFields[k] !== undefined && memberFields[k] !== null);
        const placeholders = insertFields.map(() => '?').join(', ');
        const values = insertFields.map(k => memberFields[k]);

        const memberQuery = `INSERT INTO mitglieder (${insertFields.join(', ')}) VALUES (${placeholders})`;

        db.query(memberQuery, values, (err, result) => {
            if (err) {
                logger.error(`❌ Fehler beim Erstellen von Familienmitglied ${fm.vorname}:`, err);
                return createMember(index + 1); // Weitermachen mit nächstem
            }

            const newMemberId = result.insertId;
            logger.info(`✅ Familienmitglied erstellt: ID ${newMemberId}`);

            // Vertrag für Familienmitglied erstellen (wenn tarif_id vorhanden)
            if (fm.tarif_id) {
                // Erst Tarif-Details holen für korrekten Preis
                db.query('SELECT * FROM tarife WHERE id = ?', [fm.tarif_id], (tarifErr, tarifResults) => {
                    if (tarifErr || tarifResults.length === 0) {
                        logger.error(`❌ Tarif ${fm.tarif_id} nicht gefunden`);
                        createdMembers.push({ mitglied_id: newMemberId, vorname: fm.vorname, nachname: fm.nachname });
                        return createMember(index + 1);
                    }

                    const tarif = tarifResults[0];
                    const tarifPreis = tarif.price_cents / 100; // Preis in Euro

                    // Rabatt berechnen (aus fm oder mainMemberData)
                    let rabattProzent = fm.custom_discount_value || fm.rabatt_prozent || 0;
                    let rabattGrund = 'Familienrabatt';
                    let monatsbeitrag = tarifPreis;

                    if (rabattProzent > 0) {
                        monatsbeitrag = Math.round((tarifPreis * (100 - rabattProzent)) * 100) / 100;
                    }

                    const vertragData = {
                        mitglied_id: newMemberId,
                        dojo_id: dojoId,
                        tarif_id: fm.tarif_id,
                        status: 'aktiv',
                        vertragsbeginn: mainMemberData.vertragsbeginn || new Date().toISOString().split('T')[0],
                        monatsbeitrag: monatsbeitrag,
                        monatlicher_beitrag: monatsbeitrag,
                        rabatt_prozent: rabattProzent,
                        rabatt_grund: rabattProzent > 0 ? rabattGrund : null,
                        mindestlaufzeit_monate: tarif.mindestlaufzeit_monate || 12,
                        kuendigungsfrist_monate: tarif.kuendigungsfrist_monate || 3,
                        aufnahmegebuehr_cents: tarif.aufnahmegebuehr_cents || 0,
                        agb_akzeptiert_am: mainMemberData.vertrag_agb_akzeptiert ? new Date() : null,
                        datenschutz_akzeptiert_am: mainMemberData.vertrag_datenschutz_akzeptiert ? new Date() : null,
                        hausordnung_akzeptiert_am: mainMemberData.vertrag_hausordnung_akzeptiert ? new Date() : null,
                        unterschrift_datum: new Date()
                    };

                    logger.info(`📝 Vertrag für ${fm.vorname}: Tarif=${tarif.name}, Preis=${tarifPreis}€, Rabatt=${rabattProzent}%, Final=${monatsbeitrag}€`);

                    const vFields = Object.keys(vertragData).filter(k => vertragData[k] !== null && vertragData[k] !== undefined);
                    const vPlaceholders = vFields.map(() => '?').join(', ');
                    const vValues = vFields.map(k => vertragData[k]);

                    const vertragQuery = `INSERT INTO vertraege (${vFields.join(', ')}) VALUES (${vPlaceholders})`;

                    db.query(vertragQuery, vValues, (vertragErr, vertragResult) => {
                        if (vertragErr) {
                            logger.error(`❌ Fehler beim Erstellen des Vertrags für Familienmitglied:`, vertragErr);
                            createdMembers.push({ mitglied_id: newMemberId, vorname: fm.vorname, nachname: fm.nachname });
                            return createMember(index + 1);
                        }

                        logger.info(`✅ Vertrag für Familienmitglied erstellt: ID ${vertragResult.insertId}`);

                        // 💰 Ersten Beitrag automatisch erstellen
                        const beitragQuery = `
                            INSERT INTO beitraege (mitglied_id, betrag, zahlungsdatum, zahlungsart, bezahlt, dojo_id)
                            VALUES (?, ?, DATE_FORMAT(NOW(), '%Y-%m-01'), 'Lastschrift', 0, ?)
                        `;
                        db.query(beitragQuery, [newMemberId, monatsbeitrag, dojoId], (beitragErr, beitragResult) => {
                            if (beitragErr) {
                                logger.error(`❌ Fehler beim Erstellen des ersten Beitrags:`, beitragErr);
                            } else {
                                logger.info(`💰 Erster Beitrag erstellt: ${monatsbeitrag}€ für Mitglied ${newMemberId}`);
                            }

                            createdMembers.push({
                                mitglied_id: newMemberId,
                                vorname: fm.vorname,
                                nachname: fm.nachname,
                                vertrag_id: vertragResult?.insertId,
                                beitrag_id: beitragResult?.insertId
                            });
                            createMember(index + 1);
                        });
                    });
                });
            } else {
                createdMembers.push({ mitglied_id: newMemberId, vorname: fm.vorname, nachname: fm.nachname });
                createMember(index + 1);
            }
        });
    };

    createMember(0);
}

// 🔐 HILFSFUNKTION: Benutzernamen aus Vor-/Nachname generieren
function generateUsername(vorname, nachname) {
    const clean = s => (s || '').trim().toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/\s+/g, '');
    return clean(vorname) + '.' + clean(nachname);
}

// 🔐 HILFSFUNKTION: Passwort aus Geburtsdatum generieren (dd/mm/yyyy)
function generatePasswordFromBirthdate(geburtsdatum) {
    if (!geburtsdatum) return null;
    const [y, m, d] = String(geburtsdatum).split('-');
    if (!y || !m || !d) return null;
    return d + '/' + m + '/' + y;
}

// 🔐 HILFSFUNKTION: User-Account erstellen (automatisch bei jeder Mitgliederanlage)
async function createUserAccountIfNeeded(memberData, mitgliedId, callback) {
    // Benutzername und Passwort: explizit angegeben ODER automatisch generieren
    const username = memberData.benutzername
        ? memberData.benutzername.trim()
        : generateUsername(memberData.vorname, memberData.nachname);
    const password = memberData.passwort
        ? memberData.passwort
        : generatePasswordFromBirthdate(memberData.geburtsdatum);

    if (!username || !password) {
        logger.warn('Kein Benutzername oder Passwort generierbar – kein Account erstellt', { mitgliedId });
        return callback();
    }

    if (username.toLowerCase() === 'admin') {
        logger.warn('Reservierter Benutzername "admin" – kein Account erstellt');
        return callback(null, { warning: 'Benutzername "admin" ist reserviert' });
    }

    const email = memberData.email || null;

    try {
        // Existiert Benutzername bereits?
        db.query(
            'SELECT id, mitglied_id FROM users WHERE username = ?',
            [username],
            async (checkErr, existingUsers) => {
                if (checkErr) {
                    logger.error('Fehler bei User-Prüfung:', checkErr);
                    return callback(null, { warning: 'Fehler bei User-Prüfung' });
                }

                if (existingUsers.length > 0) {
                    const existing = existingUsers[0];
                    if (existing.mitglied_id === mitgliedId) {
                        return callback(null, { userId: existing.id, message: 'User existiert bereits' });
                    }
                    // Benutzername vergeben → Suffix anhängen
                    const usernameFallback = username + '.' + mitgliedId;
                    logger.warn(`Benutzername ${username} vergeben, nutze ${usernameFallback}`);
                    const hash2 = await bcrypt.hash(password, 10);
                    db.query(
                        'INSERT IGNORE INTO users (username, email, password, role, mitglied_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                        [usernameFallback, email, hash2, 'member', mitgliedId],
                        (err2, res2) => {
                            if (err2) return callback(null, { warning: 'Fallback-Account fehlgeschlagen' });
                            logger.info(`✅ Fallback-Account erstellt: ${usernameFallback}`);
                            callback(null, { userId: res2.insertId, username: usernameFallback });
                        }
                    );
                    return;
                }

                // Neu erstellen
                const hashedPassword = await bcrypt.hash(password, 10);
                db.query(
                    'INSERT INTO users (username, email, password, role, mitglied_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                    [username, email, hashedPassword, 'member', mitgliedId],
                    (userErr, userResult) => {
                        if (userErr) {
                            logger.error('Fehler beim Erstellen des User-Accounts:', userErr);
                            return callback(null, { warning: 'User-Account konnte nicht erstellt werden' });
                        }
                        logger.info(`✅ User-Account automatisch erstellt: ${username} für Mitglied ${mitgliedId}`);
                        callback(null, { userId: userResult.insertId, username, message: 'User-Account erstellt' });
                    }
                );
            }
        );
    } catch (hashError) {
        logger.error('Fehler beim Hashen des Passworts:', hashError);
        callback(null, { warning: 'Passwort-Verarbeitung fehlgeschlagen' });
    }
}

// ===================================================================
// 📧 NOTIFICATION RECIPIENTS (TEMP)
// ===================================================================

router.get('/notification-recipients', async (req, res) => {
  try {

    const db = require('../db');
    let memberEmails = [];
    let trainerEmails = [];
    let personalEmails = [];

    // Hole Mitglieder mit Email
    try {
      memberEmails = await new Promise((resolve, reject) => {
        db.query(`
          SELECT DISTINCT 
            COALESCE(email, '') as email, 
            CONCAT(COALESCE(vorname, ''), ' ', COALESCE(nachname, '')) as name, 
            'mitglied' as type
          FROM mitglieder 
          WHERE email IS NOT NULL 
            AND email != '' 
            AND email != 'NULL'
            AND email LIKE '%@%'
          ORDER BY name
        `, (err, results) => {
          if (err) {

            resolve([]);
          } else {

            resolve(results);
          }
        });
      });
    } catch (error) {

      memberEmails = [];
    }

    // Hole Trainer mit Email
    try {
      trainerEmails = await new Promise((resolve, reject) => {
        db.query(`
          SELECT DISTINCT 
            COALESCE(email, '') as email, 
            CONCAT(COALESCE(vorname, ''), ' ', COALESCE(nachname, '')) as name, 
            'trainer' as type
          FROM trainer 
          WHERE email IS NOT NULL 
            AND email != '' 
            AND email != 'NULL'
            AND email LIKE '%@%'
          ORDER BY name
        `, (err, results) => {
          if (err) {

            resolve([]);
          } else {

            resolve(results);
          }
        });
      });
    } catch (error) {

      trainerEmails = [];
    }

    // Hole Personal mit Email
    try {
      personalEmails = await new Promise((resolve, reject) => {
        db.query(`
          SELECT DISTINCT 
            COALESCE(email, '') as email, 
            CONCAT(COALESCE(vorname, ''), ' ', COALESCE(nachname, '')) as name, 
            'personal' as type
          FROM personal 
          WHERE email IS NOT NULL 
            AND email != '' 
            AND email != 'NULL'
            AND email LIKE '%@%'
          ORDER BY name
        `, (err, results) => {
          if (err) {

            resolve([]);
          } else {

            resolve(results);
          }
        });
      });
    } catch (error) {

      personalEmails = [];
    }

    res.json({
      success: true,
      recipients: {
        mitglieder: memberEmails,
        trainer: trainerEmails,
        personal: personalEmails,
        alle: [...memberEmails, ...trainerEmails, ...personalEmails]
      }
    });
  } catch (error) {
    logger.error('Notification recipients error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Empfänger' });
  }
});

// ============================================================================
// PUT /:id/graduierung - Graduierung eines Mitglieds aktualisieren
// ============================================================================
router.put("/:id/graduierung", (req, res) => {
  const mitglied_id = parseInt(req.params.id);
  let { stil_id, graduierung_id, pruefungsdatum } = req.body;

  if (!mitglied_id || !stil_id || !graduierung_id) {
    return res.status(400).json({
      error: "Fehlende Parameter: mitglied_id, stil_id und graduierung_id sind erforderlich"
    });
  }

  // Konvertiere ISO-Timestamp zu MySQL DATE Format (YYYY-MM-DD)
  if (pruefungsdatum) {
    const date = new Date(pruefungsdatum);
    pruefungsdatum = date.toISOString().split('T')[0];
  }

  logger.debug('🎖️ Aktualisiere Graduierung:', { mitglied_id, stil_id, graduierung_id, pruefungsdatum });

  // Prüfe, ob Eintrag in mitglied_stil_data existiert
  const checkQuery = `
    SELECT * FROM mitglied_stil_data
    WHERE mitglied_id = ? AND stil_id = ?
  `;

  db.query(checkQuery, [mitglied_id, stil_id], (checkErr, checkResults) => {
    if (checkErr) {
      logger.error('Fehler beim Prüfen der Stildaten:', checkErr);
      return res.status(500).json({ error: 'Fehler beim Prüfen der Stildaten' });
    }

    let query, params;

    if (checkResults.length > 0) {
      // UPDATE: Eintrag existiert bereits
      query = `
        UPDATE mitglied_stil_data
        SET current_graduierung_id = ?,
            letzte_pruefung = ?
        WHERE mitglied_id = ? AND stil_id = ?
      `;
      params = [graduierung_id, pruefungsdatum || null, mitglied_id, stil_id];
    } else {
      // INSERT: Neuer Eintrag
      query = `
        INSERT INTO mitglied_stil_data
        (mitglied_id, stil_id, current_graduierung_id, letzte_pruefung)
        VALUES (?, ?, ?, ?)
      `;
      params = [mitglied_id, stil_id, graduierung_id, pruefungsdatum || null];
    }

    db.query(query, params, (err, result) => {
      if (err) {
        logger.error('Fehler beim Aktualisieren der Graduierung:', err);
        return res.status(500).json({
          error: 'Fehler beim Aktualisieren der Graduierung',
          details: err.message
        });
      }

      logger.info('Graduierung erfolgreich aktualisiert:', { details: result });

      res.json({
        success: true,
        message: 'Graduierung erfolgreich aktualisiert',
        mitglied_id,
        stil_id,
        graduierung_id
      });
    });
  });
});

// ============================================
// GET /api/mitglieder/:id/birthday-check
// Prüft ob das Mitglied heute Geburtstag hat
// ============================================
router.get('/:id/birthday-check', (req, res) => {
  const mitgliedId = req.params.id;

  const query = `
    SELECT
      mitglied_id,
      vorname,
      nachname,
      geburtsdatum,
      DAYOFMONTH(geburtsdatum) as geburtstag_tag,
      MONTH(geburtsdatum) as geburtstag_monat,
      DAYOFMONTH(CURDATE()) as heute_tag,
      MONTH(CURDATE()) as heute_monat,
      YEAR(CURDATE()) - YEAR(geburtsdatum) as \`alter\`,
      CASE
        WHEN DAYOFMONTH(geburtsdatum) = DAYOFMONTH(CURDATE())
         AND MONTH(geburtsdatum) = MONTH(CURDATE())
        THEN 1
        ELSE 0
      END as hat_heute_geburtstag
    FROM mitglieder
    WHERE mitglied_id = ?
  `;

  db.query(query, [mitgliedId], (err, results) => {
    if (err) {
      logger.error('Fehler beim Geburtstags-Check:', { error: err });
      return res.status(500).json({
        error: 'Datenbankfehler',
        hasBirthday: false
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        error: 'Mitglied nicht gefunden',
        hasBirthday: false
      });
    }

    const mitglied = results[0];
    const hasBirthday = mitglied.hat_heute_geburtstag === 1;

    res.json({
      success: true,
      hasBirthday: hasBirthday,
      mitglied: {
        id: mitglied.mitglied_id,
        vorname: mitglied.vorname,
        nachname: mitglied.nachname,
        geburtsdatum: mitglied.geburtsdatum,
        alter: hasBirthday ? mitglied.alter : null
      }
    });
  });
});

// ==============================
// ARCHIVIERUNG
// ==============================

/**
 * POST /mitglieder/:id/archivieren
 * Archiviert ein Mitglied (verschiebt in archiv_mitglieder Tabelle)
 */
router.post("/:id/archivieren", async (req, res) => {
  const mitgliedId = parseInt(req.params.id);
  const { grund, archiviert_von } = req.body;

  logger.debug('📦 Archivierung von Mitglied ${mitgliedId} gestartet...');

  try {
    // Starte Transaction
    await db.promise().query('START TRANSACTION');

    // 1. Hole alle Mitgliedsdaten
    const [mitgliedRows] = await db.promise().query(
      'SELECT * FROM mitglieder WHERE mitglied_id = ?',
      [mitgliedId]
    );

    if (mitgliedRows.length === 0) {
      await db.promise().query('ROLLBACK');
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const mitglied = mitgliedRows[0];

    // 2. Hole Stil-Daten
    const [stilData] = await db.promise().query(
      `SELECT msd.*, s.name as stil_name, g.name as graduierung_name
       FROM mitglied_stil_data msd
       LEFT JOIN stile s ON msd.stil_id = s.stil_id
       LEFT JOIN graduierungen g ON msd.current_graduierung_id = g.graduierung_id
       WHERE msd.mitglied_id = ?`,
      [mitgliedId]
    );

    // 3. Hole SEPA-Mandate
    const [sepaMandate] = await db.promise().query(
      'SELECT * FROM sepa_mandate WHERE mitglied_id = ? ORDER BY created_at DESC',
      [mitgliedId]
    );

    // 4. Hole Prüfungshistorie
    const [pruefungen] = await db.promise().query(
      `SELECT p.*, g.name as graduierung_name
       FROM pruefungen p
       LEFT JOIN graduierungen g ON p.graduierung_nachher_id = g.graduierung_id
       WHERE p.mitglied_id = ?
       ORDER BY p.pruefungsdatum DESC`,
      [mitgliedId]
    );

    // 5. Hole User/Login-Daten falls vorhanden
    const [userData] = await db.promise().query(
      'SELECT * FROM users WHERE mitglied_id = ?',
      [mitgliedId]
    );

    // 6. Bereite User-Daten für Archiv vor (ohne Passwort!)
    let userDataForArchive = null;
    if (userData.length > 0) {
      const user = { ...userData[0] };
      delete user.password; // WICHTIG: Passwort nicht archivieren
      userDataForArchive = user;
    }

    // 7. Erstelle Archiv-Eintrag
    const insertArchivQuery = `
      INSERT INTO archiv_mitglieder (
        mitglied_id, dojo_id, vorname, nachname, geburtsdatum,
        strasse, plz, ort, land, telefon, email, eintrittsdatum,
        status, notizen, foto_pfad,
        tarif_id, zahlungszyklus_id, gekuendigt, gekuendigt_am, kuendigungsgrund,
        vereinsordnung_akzeptiert, vereinsordnung_datum,
        security_question, security_answer,
        stil_daten, sepa_mandate, pruefungen, user_daten,
        archiviert_am, archiviert_von, archivierungsgrund
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
    `;

    const archivValues = [
      mitglied.mitglied_id,
      mitglied.dojo_id,
      mitglied.vorname,
      mitglied.nachname,
      mitglied.geburtsdatum,
      mitglied.strasse,
      mitglied.plz,
      mitglied.ort,
      mitglied.land || 'Deutschland',
      mitglied.telefon,
      mitglied.email,
      mitglied.eintrittsdatum,
      mitglied.status,
      mitglied.notizen,
      mitglied.foto_pfad,
      mitglied.tarif_id,
      mitglied.zahlungszyklus_id,
      mitglied.gekuendigt || false,
      mitglied.gekuendigt_am,
      mitglied.kuendigungsgrund,
      mitglied.vereinsordnung_akzeptiert || false,
      mitglied.vereinsordnung_datum,
      mitglied.security_question,
      mitglied.security_answer,
      JSON.stringify(stilData),
      JSON.stringify(sepaMandate),
      JSON.stringify(pruefungen),
      userDataForArchive ? JSON.stringify(userDataForArchive) : null,
      archiviert_von || null,
      grund || 'Mitglied archiviert'
    ];

    const [archivResult] = await db.promise().query(insertArchivQuery, archivValues);
    const archivId = archivResult.insertId;

    logger.info('Archiv-Eintrag erstellt mit ID: ${archivId}');

    // 8. Kopiere Stil-Daten ins Archiv (Batch-Insert statt N+1 Loop)
    if (stilData.length > 0) {
      const stilValues = stilData.map(stil => [archivId, mitgliedId, stil.stil_id, stil.current_graduierung_id, stil.aktiv_seit]);
      await db.promise().query(
        `INSERT INTO archiv_mitglied_stil_data
         (archiv_id, mitglied_id, stil_id, current_graduierung_id, aktiv_seit)
         VALUES ?`,
        [stilValues]
      );
    }

    // 9. Lösche User/Login-Zugang (Login wird gesperrt!)
    if (userData.length > 0) {
      await db.promise().query('DELETE FROM users WHERE mitglied_id = ?', [mitgliedId]);
      logger.debug('🔒 Login-Zugang für Mitglied ${mitgliedId} gelöscht');
    }

    // 10. Lösche alle abhängigen Daten (Foreign Key Constraints)
    logger.debug('🗑️ Lösche abhängige Daten für Mitglied ${mitgliedId}...');

    // Reihenfolge wichtig: Von abhängigsten zu unabhängigen Tabellen
    await db.promise().query('DELETE FROM fortschritt_updates WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM mitglieder_meilensteine WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM trainings_notizen WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM pruefung_teilnehmer WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM event_anmeldungen WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM gruppen_mitglieder WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM verkaeufe WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM gesetzlicher_vertreter WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM beitraege WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM anwesenheit WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM anwesenheit_protokoll WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM checkins WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM pruefungen WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM mitglieder_fortschritt WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM stripe_payment_intents WHERE mitglied_id = ?', [mitgliedId]);
    // WICHTIG: Rechnungen werden NICHT gelöscht (gesetzliche Aufbewahrungspflicht 10 Jahre § 147 AO)
    // await db.promise().query('DELETE FROM rechnungen WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM mitglied_stil_data WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM mitglied_stile WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM mitglieder_ziele WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM kurs_bewertungen WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM payment_provider_logs WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM mitglieder_dokumente WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM mitglied_dokumente WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM sepa_mandate WHERE mitglied_id = ?', [mitgliedId]);

    logger.info('Abhängige Daten gelöscht');

    // 11. Markiere Mitglied als inaktiv (NICHT löschen wegen Rechnungen!)
    // Mitglied bleibt in DB erhalten, da Rechnungen die mitglied_id referenzieren müssen
    await db.promise().query(
      'UPDATE mitglieder SET aktiv = 0, gekuendigt_am = NOW() WHERE mitglied_id = ?',
      [mitgliedId]
    );

    // 11.5 Eintrag in ehemalige-Tabelle erstellen (für EhemaligenListe)
    const letzterStil = stilData.length > 0 ? stilData[0] : null;
    await db.promise().query(
      `INSERT INTO ehemalige
         (urspruengliches_mitglied_id, dojo_id, vorname, nachname, geburtsdatum,
          geschlecht, email, telefon, telefon_mobil,
          strasse, hausnummer, plz, ort,
          urspruengliches_eintrittsdatum, austrittsdatum, austrittsgrund,
          letzter_stil, letzter_guertel, wiederaufnahme_moeglich)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         austrittsdatum = NOW(),
         austrittsgrund = VALUES(austrittsgrund)`,
      [
        mitglied.mitglied_id,
        mitglied.dojo_id,
        mitglied.vorname,
        mitglied.nachname,
        mitglied.geburtsdatum || null,
        mitglied.geschlecht || null,
        mitglied.email || null,
        mitglied.telefon || null,
        mitglied.telefon_mobil || null,
        mitglied.strasse || null,
        mitglied.hausnummer || null,
        mitglied.plz || null,
        mitglied.ort || null,
        mitglied.eintrittsdatum || null,
        grund || null,
        letzterStil?.stil_name || null,
        letzterStil?.graduierung_name || null,
      ]
    );

    // 12. Commit Transaction
    await db.promise().query('COMMIT');

    logger.info('Mitglied ${mitgliedId} erfolgreich archiviert (aktiv=0) und Login gesperrt');

    res.json({
      success: true,
      message: 'Mitglied erfolgreich archiviert',
      archivId: archivId,
      mitglied: {
        id: mitglied.mitglied_id,
        name: `${mitglied.vorname} ${mitglied.nachname}`
      }
    });

  } catch (error) {
    // Rollback bei Fehler
    await db.promise().query('ROLLBACK');
    logger.error('Fehler beim Archivieren:', error);
    res.status(500).json({
      error: 'Fehler beim Archivieren des Mitglieds',
      details: error.message
    });
  }
});

/**
 * POST /mitglieder/bulk-archivieren
 * Archiviert mehrere Mitglieder gleichzeitig
 */
router.post("/bulk-archivieren", async (req, res) => {
  const { mitglied_ids, grund, archiviert_von } = req.body;

  // Validierung
  if (!mitglied_ids || !Array.isArray(mitglied_ids) || mitglied_ids.length === 0) {
    return res.status(400).json({
      error: 'Keine Mitglieds-IDs angegeben',
      details: 'mitglied_ids muss ein Array mit mindestens einem Element sein'
    });
  }

  logger.debug('📦 Bulk-Archivierung von ${mitglied_ids.length} Mitgliedern gestartet...');

  const results = {
    success: [],
    failed: []
  };

  // Archiviere jedes Mitglied einzeln
  for (const mitgliedId of mitglied_ids) {
    try {
      // Starte Transaction für dieses Mitglied
      await db.promise().query('START TRANSACTION');

      // 1. Hole alle Mitgliedsdaten
      const [mitgliedRows] = await db.promise().query(
        'SELECT * FROM mitglieder WHERE mitglied_id = ?',
        [mitgliedId]
      );

      if (mitgliedRows.length === 0) {
        await db.promise().query('ROLLBACK');
        results.failed.push({
          mitglied_id: mitgliedId,
          error: 'Mitglied nicht gefunden'
        });
        continue;
      }

      const mitglied = mitgliedRows[0];

      // 2. Hole Stil-Daten
      const [stilData] = await db.promise().query(
        `SELECT msd.*, s.name as stil_name, g.name as graduierung_name
         FROM mitglied_stil_data msd
         LEFT JOIN stile s ON msd.stil_id = s.stil_id
         LEFT JOIN graduierungen g ON msd.current_graduierung_id = g.graduierung_id
         WHERE msd.mitglied_id = ?`,
        [mitgliedId]
      );

      // 3. Hole SEPA-Mandate
      const [sepaMandate] = await db.promise().query(
        'SELECT * FROM sepa_mandate WHERE mitglied_id = ? ORDER BY created_at DESC',
        [mitgliedId]
      );

      // 4. Hole Prüfungshistorie
      const [pruefungen] = await db.promise().query(
        `SELECT p.*, g.name as graduierung_name
         FROM pruefungen p
         LEFT JOIN graduierungen g ON p.graduierung_nachher_id = g.graduierung_id
         WHERE p.mitglied_id = ?
         ORDER BY p.pruefungsdatum DESC`,
        [mitgliedId]
      );

      // 5. Hole User/Login-Daten falls vorhanden
      const [userData] = await db.promise().query(
        'SELECT * FROM users WHERE mitglied_id = ?',
        [mitgliedId]
      );

      // 6. Bereite User-Daten für Archiv vor (ohne Passwort!)
      let userDataForArchive = null;
      if (userData.length > 0) {
        const user = { ...userData[0] };
        delete user.password; // WICHTIG: Passwort nicht archivieren
        userDataForArchive = user;
      }

      // 7. Erstelle Archiv-Eintrag
      const insertArchivQuery = `
        INSERT INTO archiv_mitglieder (
          mitglied_id, dojo_id, vorname, nachname, geburtsdatum,
          strasse, plz, ort, land, telefon, email, eintrittsdatum,
          status, notizen, foto_pfad,
          tarif_id, zahlungszyklus_id, gekuendigt, gekuendigt_am, kuendigungsgrund,
          vereinsordnung_akzeptiert, vereinsordnung_datum,
          security_question, security_answer,
          stil_daten, sepa_mandate, pruefungen, user_daten,
          archiviert_am, archiviert_von, archivierungsgrund
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
      `;

      const archivValues = [
        mitglied.mitglied_id,
        mitglied.dojo_id,
        mitglied.vorname,
        mitglied.nachname,
        mitglied.geburtsdatum,
        mitglied.strasse,
        mitglied.plz,
        mitglied.ort,
        mitglied.land || 'Deutschland',
        mitglied.telefon,
        mitglied.email,
        mitglied.eintrittsdatum,
        mitglied.status,
        mitglied.notizen,
        mitglied.foto_pfad,
        mitglied.tarif_id,
        mitglied.zahlungszyklus_id,
        mitglied.gekuendigt || false,
        mitglied.gekuendigt_am,
        mitglied.kuendigungsgrund,
        mitglied.vereinsordnung_akzeptiert || false,
        mitglied.vereinsordnung_datum,
        mitglied.security_question,
        mitglied.security_answer,
        JSON.stringify(stilData),
        JSON.stringify(sepaMandate),
        JSON.stringify(pruefungen),
        userDataForArchive ? JSON.stringify(userDataForArchive) : null,
        archiviert_von || null,
        grund || 'Mitglieder bulk-archiviert'
      ];

      const [archivResult] = await db.promise().query(insertArchivQuery, archivValues);
      const archivId = archivResult.insertId;

      // 8. Kopiere Stil-Daten ins Archiv (Batch-Insert statt N+1 Loop)
      if (stilData.length > 0) {
        const stilValues = stilData.map(stil => [archivId, mitgliedId, stil.stil_id, stil.current_graduierung_id, stil.aktiv_seit]);
        await db.promise().query(
          `INSERT INTO archiv_mitglied_stil_data
           (archiv_id, mitglied_id, stil_id, current_graduierung_id, aktiv_seit)
           VALUES ?`,
          [stilValues]
        );
      }

      // 9. Lösche User/Login-Zugang (Login wird gesperrt!)
      if (userData.length > 0) {
        await db.promise().query('DELETE FROM users WHERE mitglied_id = ?', [mitgliedId]);
      }

      // 10. Lösche alle abhängigen Daten (Foreign Key Constraints)
      await db.promise().query('DELETE FROM fortschritt_updates WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM mitglieder_meilensteine WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM trainings_notizen WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM pruefung_teilnehmer WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM event_anmeldungen WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM gruppen_mitglieder WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM verkaeufe WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM gesetzlicher_vertreter WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM beitraege WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM anwesenheit WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM anwesenheit_protokoll WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM checkins WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM pruefungen WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM mitglieder_fortschritt WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM stripe_payment_intents WHERE mitglied_id = ?', [mitgliedId]);
      // WICHTIG: Rechnungen werden NICHT gelöscht (gesetzliche Aufbewahrungspflicht 10 Jahre § 147 AO)
      // await db.promise().query('DELETE FROM rechnungen WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM mitglied_stil_data WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM mitglied_stile WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM mitglieder_ziele WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM kurs_bewertungen WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM payment_provider_logs WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM mitglieder_dokumente WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM mitglied_dokumente WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM sepa_mandate WHERE mitglied_id = ?', [mitgliedId]);

      // 11. Markiere Mitglied als inaktiv (NICHT löschen wegen Rechnungen!)
      // Mitglied bleibt in DB erhalten, da Rechnungen die mitglied_id referenzieren müssen
      await db.promise().query(
        'UPDATE mitglieder SET aktiv = 0, gekuendigt_am = NOW() WHERE mitglied_id = ?',
        [mitgliedId]
      );

      // 11.5 Eintrag in ehemalige-Tabelle erstellen (für EhemaligenListe)
      const letzterStil = stilData.length > 0 ? stilData[0] : null;
      await db.promise().query(
        `INSERT INTO ehemalige
           (urspruengliches_mitglied_id, dojo_id, vorname, nachname, geburtsdatum,
            geschlecht, email, telefon, telefon_mobil,
            strasse, hausnummer, plz, ort,
            urspruengliches_eintrittsdatum, austrittsdatum, austrittsgrund,
            letzter_stil, letzter_guertel, wiederaufnahme_moeglich)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE austrittsdatum = NOW()`,
        [
          mitglied.mitglied_id,
          mitglied.dojo_id,
          mitglied.vorname,
          mitglied.nachname,
          mitglied.geburtsdatum || null,
          mitglied.geschlecht || null,
          mitglied.email || null,
          mitglied.telefon || null,
          mitglied.telefon_mobil || null,
          mitglied.strasse || null,
          mitglied.hausnummer || null,
          mitglied.plz || null,
          mitglied.ort || null,
          mitglied.eintrittsdatum || null,
          grund || null,
          letzterStil?.stil_name || null,
          letzterStil?.graduierung_name || null,
        ]
      );

      // 12. Commit Transaction
      await db.promise().query('COMMIT');

      results.success.push({
        mitglied_id: mitgliedId,
        name: `${mitglied.vorname} ${mitglied.nachname}`,
        archiv_id: archivId
      });

      logger.info('Mitglied ${mitgliedId} erfolgreich archiviert');

    } catch (error) {
      // Rollback bei Fehler für dieses Mitglied
      await db.promise().query('ROLLBACK');
      logger.error('Fehler beim Archivieren von Mitglied ${mitgliedId}:', error);
      results.failed.push({
        mitglied_id: mitgliedId,
        error: error.message
      });
    }
  }

  logger.debug('📊 Bulk-Archivierung abgeschlossen: ${results.success.length} erfolgreich, ${results.failed.length} fehlgeschlagen');

  res.json({
    success: true,
    message: `${results.success.length} von ${mitglied_ids.length} Mitgliedern erfolgreich archiviert`,
    results: results
  });
});

/**
 * GET /archiv
 * Ruft alle archivierten Mitglieder ab
 */
router.get("/archiv", (req, res) => {
  const { dojo_id, limit = 100, offset = 0 } = req.query;

  let whereClause = '';
  let queryParams = [];

  if (dojo_id && dojo_id !== 'all') {
    whereClause = 'WHERE dojo_id = ?';
    queryParams.push(parseInt(dojo_id));
  }

  const query = `
    SELECT * FROM v_archiv_mitglieder_uebersicht
    ${whereClause}
    LIMIT ? OFFSET ?
  `;

  queryParams.push(parseInt(limit), parseInt(offset));

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen archivierter Mitglieder:', err);
      return res.status(500).json({ error: "Fehler beim Abrufen des Archivs" });
    }

    res.json({
      success: true,
      count: results.length,
      archivierte_mitglieder: results
    });
  });
});

/**
 * GET /archiv/:archivId
 * Ruft Details eines archivierten Mitglieds ab
 */
router.get("/archiv/:archivId", (req, res) => {
  const archivId = parseInt(req.params.archivId);

  const query = 'SELECT * FROM archiv_mitglieder WHERE archiv_id = ?';

  db.query(query, [archivId], (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen des Archiv-Eintrags:', err);
      return res.status(500).json({ error: "Fehler beim Abrufen des Archiv-Eintrags" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Archiv-Eintrag nicht gefunden' });
    }

    const archiv = results[0];

    // Parse JSON-Felder
    if (archiv.stil_daten && typeof archiv.stil_daten === 'string') {
      archiv.stil_daten = JSON.parse(archiv.stil_daten);
    }
    if (archiv.sepa_mandate && typeof archiv.sepa_mandate === 'string') {
      archiv.sepa_mandate = JSON.parse(archiv.sepa_mandate);
    }
    if (archiv.pruefungen && typeof archiv.pruefungen === 'string') {
      archiv.pruefungen = JSON.parse(archiv.pruefungen);
    }

    res.json({
      success: true,
      archiv: archiv
    });
  });
});

/**
 * POST /mitglieder/:id/mitgliedsausweis
 * Generiert einen Mitgliedsausweis als PDF
 */
router.post("/:id/mitgliedsausweis", async (req, res) => {
  const mitglied_id = parseInt(req.params.id, 10);

  if (isNaN(mitglied_id)) {
    logger.error('[Mitgliedsausweis] Ungültige Mitglieds-ID:', { error: req.params.id });
    return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
  }

  logger.debug('[Mitgliedsausweis] Generiere PDF für Mitglied ${mitglied_id}');

  try {
    // 1. Mitgliedsdaten abrufen
    const mitgliedQuery = `
      SELECT
        m.mitglied_id,
        m.vorname,
        m.nachname,
        m.geburtsdatum,
        m.dojo_id,
        GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', ') AS stil,
        g.name AS graduierung
      FROM mitglieder m
      LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
      LEFT JOIN stile s ON ms.stil = s.name
      LEFT JOIN graduierungen g ON m.graduierung_id = g.id
      WHERE m.mitglied_id = ?
      GROUP BY m.mitglied_id
    `;

    db.query(mitgliedQuery, [mitglied_id], async (err, results) => {
      if (err) {
        logger.error('[Mitgliedsausweis] Datenbankfehler beim Laden des Mitglieds:', { error: err });
        return res.status(500).json({ error: "Fehler beim Laden der Mitgliedsdaten" });
      }

      if (results.length === 0) {
        logger.error('[Mitgliedsausweis] Mitglied nicht gefunden:', { error: mitglied_id });
        return res.status(404).json({ error: "Mitglied nicht gefunden" });
      }

      const mitglied = results[0];
      logger.debug("[Mitgliedsausweis] Mitglied gefunden:", mitglied);

      // 2. Dojo-Daten abrufen
      const dojoQuery = `SELECT dojoname as name, strasse, hausnummer, plz, ort FROM dojo WHERE id = ?`;

      db.query(dojoQuery, [mitglied.dojo_id], async (dojoErr, dojoResults) => {
        if (dojoErr) {
          logger.error('[Mitgliedsausweis] Fehler beim Laden der Dojo-Daten:', { error: dojoErr });
          return res.status(500).json({ error: "Fehler beim Laden der Dojo-Daten" });
        }

        const dojo = dojoResults.length > 0 ? dojoResults[0] : { name: "Dojo" };
        if (dojo.strasse && dojo.hausnummer && dojo.plz && dojo.ort) {
          dojo.adresse = `${dojo.strasse} ${dojo.hausnummer}, ${dojo.plz} ${dojo.ort}`;
        }
        logger.debug("[Mitgliedsausweis] Dojo gefunden:", dojo);

        // 3. PDF generieren
        try {
          const generator = new MitgliedsausweisGenerator();
          const pdfDoc = await generator.generateMitgliedsausweis(mitglied, dojo);

          logger.debug('[Mitgliedsausweis] PDF erfolgreich generiert');

          // 4. PDF an Client senden
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename=mitgliedsausweis_${mitglied_id}.pdf`);

          pdfDoc.pipe(res);
        } catch (pdfError) {
          logger.error('[Mitgliedsausweis] Fehler bei der PDF-Generierung:', { error: pdfError });
          return res.status(500).json({ error: "Fehler bei der PDF-Generierung", details: pdfError.message });
        }
      });
    });
  } catch (error) {
    logger.error('[Mitgliedsausweis] Unerwarteter Fehler:', { error: error });
    return res.status(500).json({ error: "Interner Serverfehler", details: error.message });
  }
});

/**
 * GET /mitglieder/:id/kurse
 * Gibt alle Kurse zurück, an denen ein Mitglied teilnimmt (basierend auf Stil-Zuordnung)
 */
router.get("/:id/kurse", (req, res) => {
  const mitgliedId = req.params.id;

  logger.debug('📅 Lade Kurse für Mitglied ID ${mitgliedId}');

  // Stil ENUM zu ID Mapping
  const stilMapping = {
    'ShieldX': { stil_id: 2, stil_name: 'ShieldX' },
    'BJJ': { stil_id: 3, stil_name: 'BJJ' },
    'Brazilian Jiu Jitsu': { stil_id: 3, stil_name: 'Brazilian Jiu Jitsu' },
    'Kickboxen': { stil_id: 4, stil_name: 'Kickboxen' },
    'Karate': { stil_id: 5, stil_name: 'Enso Karate' },
    'Enso Karate': { stil_id: 5, stil_name: 'Enso Karate' },
    'Taekwon-Do': { stil_id: 7, stil_name: 'Taekwon-Do' }
  };

  // Lade zuerst die Stile des Mitglieds
  const stileQuery = `
    SELECT DISTINCT ms.stil
    FROM mitglied_stile ms
    WHERE ms.mitglied_id = ?
  `;

  db.query(stileQuery, [mitgliedId], (err, stileResults) => {
    if (err) {
      logger.error('Fehler beim Laden der Mitglieds-Stile:', err);
      return res.status(500).json({ error: "Fehler beim Laden der Stile" });
    }

    if (!stileResults || stileResults.length === 0) {
      logger.debug('⚠️ Mitglied hat keine Stile - keine Kurse vorhanden');
      return res.json([]);
    }

    // Map ENUM stil values to stil_ids
    const stilIds = stileResults
      .map(s => {
        const stilInfo = stilMapping[s.stil];
        if (!stilInfo) {
          logger.warn('Stil nicht im Mapping gefunden', { stil: s.stil });
          return null;
        }
        return stilInfo.stil_id;
      })
      .filter(Boolean);

    logger.info('Mitglied hat Stile', { enums: stileResults.map(s => s.stil), ids: stilIds });

    if (stilIds.length === 0) {
      logger.debug('⚠️ Keine Stil-IDs gefunden - keine Kurse vorhanden');
      return res.json([]);
    }

    // Lade Kurse die zu den Stilen passen
    // WICHTIG: kurse.stil ist VARCHAR, nicht stil_id
    const stilEnums = stileResults.map(s => s.stil);
    logger.info('Mitglied hat Stil-ENUMs für Kurse:', { details: stilEnums });

    const kurseQuery = `
      SELECT DISTINCT
        k.kurs_id,
        k.gruppenname as name,
        sp.tag as wochentag,
        sp.uhrzeit_start as uhrzeit,
        TIMESTAMPDIFF(MINUTE, sp.uhrzeit_start, sp.uhrzeit_ende) as dauer,
        r.name as raum,
        k.stil as stil_name,
        k.trainer_ids,
        k.trainer_id
      FROM kurse k
      LEFT JOIN stundenplan sp ON k.kurs_id = sp.kurs_id
      LEFT JOIN raeume r ON sp.raum_id = r.id
      WHERE k.stil IN (?)
      ORDER BY
        FIELD(sp.tag, 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'),
        sp.uhrzeit_start,
        k.gruppenname
    `;

    db.query(kurseQuery, [stilEnums], async (err, kurseResults) => {
      if (err) {
        logger.error('Fehler beim Laden der Kurse:', err);
        return res.status(500).json({ error: "Fehler beim Laden der Kurse" });
      }

      logger.info('${kurseResults.length} Kurs-Einträge für Mitglied ${mitgliedId} gefunden');

      if (kurseResults.length === 0) {
        return res.json([]);
      }

      // Sammle alle Trainer-IDs aus allen Kursen
      const allTrainerIds = new Set();
      kurseResults.forEach(kurs => {
        // Parse trainer_ids JSON array
        let trainerIds = [];
        if (kurs.trainer_ids && typeof kurs.trainer_ids === 'string') {
          try {
            trainerIds = JSON.parse(kurs.trainer_ids);
          } catch (e) {
            logger.warn('Konnte trainer_ids nicht parsen für Kurs ${kurs.kurs_id}:', e);
          }
        } else if (Array.isArray(kurs.trainer_ids)) {
          trainerIds = kurs.trainer_ids;
        } else if (kurs.trainer_id) {
          // Fallback auf altes trainer_id Feld
          trainerIds = [kurs.trainer_id];
        }

        trainerIds.forEach(id => allTrainerIds.add(id));
      });

      if (allTrainerIds.size === 0) {
        // Keine Trainer zugeordnet - gebe Kurse ohne Trainer-Namen zurück
        logger.debug('⚠️ Keine Trainer-IDs gefunden');
        return res.json(kurseResults.map(k => ({
          ...k,
          trainer_vorname: null,
          trainer_nachname: null,
          trainer_name: 'TBA'
        })));
      }

      // Lade alle Trainer auf einmal
      const trainerQuery = `
        SELECT trainer_id, vorname, nachname
        FROM trainer
        WHERE trainer_id IN (?)
      `;

      db.query(trainerQuery, [Array.from(allTrainerIds)], (err, trainerResults) => {
        if (err) {
          logger.error('Fehler beim Laden der Trainer:', err);
          return res.status(500).json({ error: "Fehler beim Laden der Trainer" });
        }

        // Erstelle Trainer-Lookup-Map
        const trainerMap = {};
        trainerResults.forEach(trainer => {
          trainerMap[trainer.trainer_id] = trainer;
        });

        // Füge Trainer-Namen zu jedem Kurs hinzu
        const enrichedKurse = kurseResults.map(kurs => {
          // Parse trainer_ids
          let trainerIds = [];
          if (kurs.trainer_ids && typeof kurs.trainer_ids === 'string') {
            try {
              trainerIds = JSON.parse(kurs.trainer_ids);
            } catch (e) {
              logger.warn('Konnte trainer_ids nicht parsen für Kurs ${kurs.kurs_id}');
            }
          } else if (Array.isArray(kurs.trainer_ids)) {
            trainerIds = kurs.trainer_ids;
          } else if (kurs.trainer_id) {
            trainerIds = [kurs.trainer_id];
          }

          // Hole ersten Trainer (für Kompatibilität)
          const firstTrainerId = trainerIds[0];
          const firstTrainer = trainerMap[firstTrainerId];

          return {
            kurs_id: kurs.kurs_id,
            name: kurs.name,
            wochentag: kurs.wochentag,
            uhrzeit: kurs.uhrzeit,
            dauer: kurs.dauer,
            raum: kurs.raum,
            stil_name: kurs.stil_name,
            trainer_vorname: firstTrainer?.vorname || null,
            trainer_nachname: firstTrainer?.nachname || null,
            trainer_name: firstTrainer ? `${firstTrainer.vorname} ${firstTrainer.nachname}` : 'TBA'
          };
        });

        logger.info('${enrichedKurse.length} Kurse mit Trainer-Namen angereichert');
        res.json(enrichedKurse);
      });
    });
  });
});

/**
 * PUT /mitglieder/:id/beitrag
 * Aktualisiert den Monatsbeitrag eines Mitglieds
 */
router.put("/:id/beitrag", validateId('id'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { monatsbeitrag } = req.body;
  const secureDojoId = getSecureDojoId(req);

  // Validierung
  if (monatsbeitrag == null || isNaN(parseFloat(monatsbeitrag))) {
    return res.status(400).json({ error: "Ungültiger Monatsbeitrag" });
  }

  const beitrag = parseFloat(monatsbeitrag);

  // SQL Query mit Multi-Tenancy
  let whereConditions = ['mitglied_id = ?'];
  const values = [beitrag, id];

  if (secureDojoId) {
    whereConditions.push('dojo_id = ?');
    values.push(secureDojoId);
  }

  const query = `
    UPDATE mitglieder
    SET monatsbeitrag = ?
    WHERE ${whereConditions.join(' AND ')}
  `;

  db.query(query, values, (error, results) => {
    if (error) {
      logger.error('Datenbankfehler beim Beitrag-Update:', error);
      return res.status(500).json({
        error: 'Datenbankfehler beim Aktualisieren des Beitrags',
        details: error.message
      });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden oder keine Berechtigung' });
    }

    logger.info(`Monatsbeitrag aktualisiert für Mitglied ${id} auf ${beitrag}€`);
    res.json({ message: 'Beitrag erfolgreich aktualisiert', monatsbeitrag: beitrag });
  });
});

/**
 * GET /mitglieder/print
 * Generiert eine PDF-Liste aller Mitglieder mit Name, Geburtsdatum, Stil und Vertrag
 */

/**
 * GET /mitglieder/:id/ruecklastschriften-stats
 * Returns Rücklastschriften count and amount for a specific member
 */
router.get('/:id/ruecklastschriften-stats', authenticateToken, (req, res) => {
  const { id } = req.params;
  const secureDojoId = getSecureDojoId(req);

  const dojoFilter = secureDojoId ? 'AND m.dojo_id = ?' : '';
  const query = `
    SELECT
      COUNT(*) as anzahl,
      COALESCE(SUM(r.original_betrag), 0) as gesamt_betrag,
      SUM(CASE WHEN r.status IN ('neu','bearbeitet','mahnverfahren') THEN 1 ELSE 0 END) as offen_anzahl,
      COALESCE(SUM(CASE WHEN r.status IN ('neu','bearbeitet','mahnverfahren') THEN r.original_betrag ELSE 0 END), 0) as offen_betrag
    FROM sepa_ruecklastschriften r
    JOIN sepa_mandate sm ON r.mandat_id = sm.mandat_id
    JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
    WHERE sm.mitglied_id = ?
    ${dojoFilter}
  `;

  const params = secureDojoId ? [id, secureDojoId] : [id];

  db.query(query, params, (error, results) => {
    if (error) {
      logger.error('Fehler beim Laden der Ruecklastschriften-Stats:', error);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    res.json({ success: true, stats: results[0] || { anzahl: 0, gesamt_betrag: 0, offen_anzahl: 0, offen_betrag: 0 } });
  });
});

module.exports = router;
