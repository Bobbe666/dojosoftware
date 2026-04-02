/**
 * Filter-Routes für Mitglieder
 * Extrahiert aus mitglieder.js - enthält alle /filter/* und /filter-options/* Endpoints
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const { getSecureDojoId } = require('../../middleware/tenantSecurity');
const router = express.Router();

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

  let whereConditions = ['m.aktiv = 1', 'v.vertrag_id IS NULL'];
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
    LEFT JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv'
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
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);

  let whereConditions = [
    "v.status = 'aktiv'",
    `(
      v.tarif_id IS NULL
      OR t.altersgruppe IS NULL
      OR (
        t.id IS NOT NULL
        AND v.monatsbeitrag != ROUND(
          CASE
            WHEN t.billing_cycle = 'MONTHLY' THEN t.price_cents / 100
            WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
            WHEN t.billing_cycle = 'YEARLY' THEN (t.price_cents / 100) / 12
            ELSE t.price_cents / 100
          END,
          2
        )
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
    SELECT DISTINCT
      m.mitglied_id, m.vorname, m.nachname, m.email,
      m.zahlungsmethode, m.aktiv, m.geburtsdatum,
      v.monatsbeitrag, v.tarif_id, v.billing_cycle as vertrag_billing_cycle,
      t.name as tarif_name, t.price_cents, t.billing_cycle as tarif_billing_cycle, t.altersgruppe,
      ROUND(
        CASE
          WHEN t.billing_cycle = 'MONTHLY' THEN t.price_cents / 100
          WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
          WHEN t.billing_cycle = 'YEARLY' THEN (t.price_cents / 100) / 12
          ELSE t.price_cents / 100
        END,
        2
      ) as erwarteter_monatsbeitrag,
      CASE
        WHEN v.tarif_id IS NULL THEN
          CONCAT('Alter Vertrag ohne Tarif-Zuordnung (€', COALESCE(v.monatsbeitrag, 0), '/Monat)')
        WHEN t.altersgruppe IS NULL THEN
          CONCAT('Tarif ohne Altersgruppen-Zuordnung (€', COALESCE(v.monatsbeitrag, 0), '/Monat - ', t.name, ')')
        ELSE
          CONCAT(
            'Zahlt €', COALESCE(v.monatsbeitrag, 0),
            ' statt €',
            ROUND(
              CASE
                WHEN t.billing_cycle = 'MONTHLY' THEN t.price_cents / 100
                WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
                WHEN t.billing_cycle = 'YEARLY' THEN (t.price_cents / 100) / 12
                ELSE t.price_cents / 100
              END,
              2
            ),
            '/Monat (',
            t.name,
            CASE WHEN t.billing_cycle = 'MONTHLY' THEN ' - Monatlich'
                 WHEN t.billing_cycle = 'QUARTERLY' THEN ' - Vierteljährlich'
                 WHEN t.billing_cycle = 'YEARLY' THEN ' - Jährlich'
                 ELSE ''
            END,
            ', ', t.altersgruppe,
            ')'
          )
      END as abweichung_grund
    FROM mitglieder m
    JOIN vertraege v ON m.mitglied_id = v.mitglied_id
    LEFT JOIN tarife t ON v.tarif_id = t.id
    ${whereClause}
    ORDER BY m.nachname, m.vorname
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Mitglieder mit Tarif-Abweichung:', err);
      return res.status(500).json({ error: 'Fehler beim Laden der Mitglieder' });
    }
    res.json({ success: true, data: results });
  });
});

// Mitglieder nach Zahlungsweise filtern
router.get('/filter/zahlungsweisen', (req, res) => {
  const { payment_method, dojo_id } = req.query;

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

module.exports = router;
