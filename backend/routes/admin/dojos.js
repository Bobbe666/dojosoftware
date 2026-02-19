/**
 * Admin Dojo Routes
 * CRUD-Operationen für Dojo-Management
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();
const { requireSuperAdmin, calculateDojoStorageUsage } = require('./shared');

// GET /features - Verfügbare Features auflisten
router.get('/features', requireSuperAdmin, async (req, res) => {
  try {
    const features = [
      { id: 'mitgliederverwaltung', name: 'Mitgliederverwaltung', description: 'Basis-Mitgliederverwaltung' },
      { id: 'sepa', name: 'SEPA-Lastschrift', description: 'Automatische Lastschriften' },
      { id: 'checkin', name: 'Check-In System', description: 'Anwesenheitserfassung' },
      { id: 'pruefungen', name: 'Prüfungsverwaltung', description: 'Gürtelprüfungen verwalten' },
      { id: 'verkauf', name: 'Verkauf/Kasse', description: 'Kassensystem und Artikelverkauf' },
      { id: 'events', name: 'Events/Turniere', description: 'Event- und Turnierverwaltung' },
      { id: 'buchfuehrung', name: 'Buchhaltung', description: 'Erweiterte Finanzverwaltung' },
      { id: 'api', name: 'API-Zugang', description: 'REST-API für Integrationen' },
      { id: 'multidojo', name: 'Multi-Dojo', description: 'Mehrere Standorte verwalten' }
    ];
    res.json({ success: true, features });
  } catch (error) {
    logger.error('Fehler beim Abrufen der Features:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Features', details: error.message });
  }
});

// GET /dojos/statistics - Statistiken für Dojo-Übersicht
router.get('/dojos/statistics', requireSuperAdmin, async (req, res) => {
  try {
    // Dojo-Statistiken
    const [stats] = await db.promise().query(`
      SELECT
        COUNT(*) as total_dojos,
        SUM(CASE WHEN ist_aktiv = 1 THEN 1 ELSE 0 END) as active_dojos,
        SUM(CASE WHEN subscription_status = 'trial' OR trial_ends_at > NOW() THEN 1 ELSE 0 END) as trial_dojos,
        SUM(CASE WHEN subscription_status = 'active' AND (trial_ends_at IS NULL OR trial_ends_at <= NOW()) THEN 1 ELSE 0 END) as paid_dojos
      FROM dojo
    `);

    // Mitglieder gesamt
    const [memberStats] = await db.promise().query(`
      SELECT COUNT(*) as total_members FROM mitglieder WHERE aktiv = 1
    `);

    // Revenue-Berechnung aus dojo_subscriptions
    const [revenueStats] = await db.promise().query(`
      SELECT
        SUM(CASE WHEN status = 'active' AND billing_interval = 'monthly' THEN monthly_price ELSE 0 END) as monthly_revenue,
        SUM(CASE WHEN status = 'active' AND billing_interval = 'yearly' THEN monthly_price ELSE 0 END) as yearly_revenue
      FROM dojo_subscriptions
    `);

    // Neueste Dojos
    const [recentDojos] = await db.promise().query(`
      SELECT id, dojoname, subdomain, created_at, subscription_status
      FROM dojo
      ORDER BY created_at DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      statistics: {
        dojos: {
          total: stats[0]?.total_dojos || 0,
          active: stats[0]?.active_dojos || 0,
          trial: stats[0]?.trial_dojos || 0,
          paid: stats[0]?.paid_dojos || 0
        },
        members: {
          total: memberStats[0]?.total_members || 0
        },
        revenue: {
          monthly: parseFloat(revenueStats[0]?.monthly_revenue || 0),
          yearly: parseFloat(revenueStats[0]?.yearly_revenue || 0)
        },
        recent_dojos: recentDojos
      }
    });
  } catch (error) {
    logger.error('Fehler beim Abrufen der Statistiken:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken', details: error.message });
  }
});

// GET /dojos - Alle Dojos auflisten
router.get('/dojos', requireSuperAdmin, async (req, res) => {
  try {
    const { filter } = req.query;

    logger.info(`[DOJOS-DEBUG] Request filter: "${filter}"`);

    const whereClause = filter === 'managed'
      ? `WHERE d.ist_aktiv = TRUE AND (d.id = 2 OR d.id NOT IN (
          SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL AND dojo_id != 2
        ))`
      : '';

    logger.info(`[DOJOS-DEBUG] WHERE clause: ${whereClause || '(none)'}`);

    const query = `
      SELECT
        d.id, d.dojoname, d.subdomain, d.inhaber, d.ort, d.plz, d.land, d.strasse, d.hausnummer,
        d.email, d.telefon, d.ist_aktiv, d.mitgliederzahl_aktuell, d.created_at, d.onboarding_completed,
        d.subscription_status, d.trial_ends_at, d.subscription_plan,
        d.subscription_started_at, d.subscription_ends_at, d.payment_interval, d.last_payment_at,
        DATEDIFF(d.trial_ends_at, NOW()) as trial_days_remaining,
        DATEDIFF(d.subscription_ends_at, NOW()) as subscription_days_remaining,
        ds.plan_type as ds_plan_type, ds.status as ds_status, ds.monthly_price,
        ds.trial_ends_at as ds_trial_ends_at,
        COUNT(DISTINCT m.mitglied_id) AS mitglieder_count,
        COUNT(DISTINCT k.kurs_id) AS kurse_count,
        COUNT(DISTINCT t.trainer_id) AS trainer_count
      FROM dojo d
      LEFT JOIN dojo_subscriptions ds ON d.id = ds.dojo_id
      LEFT JOIN mitglieder m ON d.id = m.dojo_id AND m.aktiv = 1
      LEFT JOIN kurse k ON d.id = k.dojo_id
      LEFT JOIN trainer t ON d.id = t.dojo_id
      ${whereClause}
      GROUP BY d.id
      ORDER BY d.dojoname
    `;

    const [dojos] = await db.promise().query(query);

    logger.info(`[DOJOS-DEBUG] SQL returned ${dojos.length} dojos: ${dojos.map(d => `${d.id}:${d.dojoname}`).join(', ')}`);

    const dojosWithStorage = await Promise.all(
      dojos.map(async (dojo) => {
        const storageData = await calculateDojoStorageUsage(dojo.id);
        logger.debug(`[DOJOS] Dojo ${dojo.id} (${dojo.dojoname}): storage_mb=${storageData.total_mb}, storage_kb=${storageData.total_kb}`);
        return {
          ...dojo,
          storage_mb: storageData.total_mb,
          storage_kb: storageData.total_kb,
          storage_details: storageData.details
        };
      })
    );

    logger.info(`[DOJOS-DEBUG] Returning ${dojosWithStorage.length} dojos with storage`);

    res.json({ success: true, count: dojosWithStorage.length, dojos: dojosWithStorage });
  } catch (error) {
    logger.error('Fehler beim Abrufen der Dojos:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Dojos', details: error.message });
  }
});

// GET /dojos/:id - Einzelnes Dojo abrufen
router.get('/dojos/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT d.*, COUNT(DISTINCT m.mitglied_id) AS mitglieder_count,
        COUNT(DISTINCT k.kurs_id) AS kurse_count, COUNT(DISTINCT t.trainer_id) AS trainer_count
      FROM dojo d
      LEFT JOIN mitglieder m ON d.id = m.dojo_id AND m.aktiv = 1
      LEFT JOIN kurse k ON d.id = k.dojo_id
      LEFT JOIN trainer t ON d.id = t.dojo_id
      WHERE d.id = ?
      GROUP BY d.id
    `;
    const [dojos] = await db.promise().query(query, [id]);

    if (dojos.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }
    res.json({ success: true, dojo: dojos[0] });
  } catch (error) {
    logger.error('Fehler beim Abrufen des Dojos:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Dojos', details: error.message });
  }
});

// POST /dojos - Neues Dojo anlegen
router.post('/dojos', requireSuperAdmin, async (req, res) => {
  try {
    const { dojoname, subdomain, inhaber, email, telefon, strasse, hausnummer, plz, ort, land = 'Deutschland' } = req.body;

    if (!dojoname || !inhaber) {
      return res.status(400).json({ error: 'Pflichtfelder fehlen', required: ['dojoname', 'inhaber'] });
    }

    if (subdomain) {
      const [existing] = await db.promise().query('SELECT id FROM dojo WHERE subdomain = ?', [subdomain]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Subdomain bereits vergeben', subdomain });
      }
    }

    const [result] = await db.promise().query(`
      INSERT INTO dojo (dojoname, subdomain, inhaber, email, telefon, strasse, hausnummer, plz, ort, land, ist_aktiv, onboarding_completed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW())`,
      [dojoname, subdomain, inhaber, email, telefon, strasse, hausnummer, plz, ort, land]
    );

    logger.info('Neues Dojo angelegt:', { dojoname, id: result.insertId });
    res.status(201).json({ success: true, message: 'Dojo erfolgreich angelegt', dojo_id: result.insertId, dojoname, subdomain });
  } catch (error) {
    logger.error('Fehler beim Anlegen des Dojos:', error);
    res.status(500).json({ error: 'Fehler beim Anlegen des Dojos', details: error.message });
  }
});

// PUT /dojos/:id - Dojo bearbeiten
router.put('/dojos/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    delete updates.id;
    delete updates.created_at;
    delete updates.updated_at;

    const [existing] = await db.promise().query('SELECT id FROM dojo WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    if (updates.subdomain) {
      const [subdomainCheck] = await db.promise().query('SELECT id FROM dojo WHERE subdomain = ? AND id != ?', [updates.subdomain, id]);
      if (subdomainCheck.length > 0) {
        return res.status(400).json({ error: 'Subdomain bereits vergeben', subdomain: updates.subdomain });
      }
    }

    const fields = Object.keys(updates);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'Keine Änderungen übergeben' });
    }

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field]);
    values.push(id);

    await db.promise().query(`UPDATE dojo SET ${setClause}, updated_at = NOW() WHERE id = ?`, values);

    logger.info('Dojo aktualisiert:', { id });
    res.json({ success: true, message: 'Dojo erfolgreich aktualisiert', dojo_id: id });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren des Dojos:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Dojos', details: error.message });
  }
});

// DELETE /dojos/:id - Dojo löschen (Soft-Delete)
router.delete('/dojos/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.promise().query('SELECT id, dojoname FROM dojo WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    if (parseInt(id) === 2) {
      return res.status(403).json({ error: 'TDA International kann nicht gelöscht werden' });
    }

    await db.promise().query('UPDATE dojo SET ist_aktiv = 0, updated_at = NOW() WHERE id = ?', [id]);

    logger.info('Dojo deaktiviert:', { dojoname: existing[0].dojoname, id });
    res.json({ success: true, message: 'Dojo erfolgreich deaktiviert', dojo_id: id, dojoname: existing[0].dojoname });
  } catch (error) {
    logger.error('Fehler beim Löschen des Dojos:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Dojos', details: error.message });
  }
});

// PUT /dojos/:id/features - Feature-Overrides für ein Dojo setzen
router.put('/dojos/:id/features', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      feature_mitgliederverwaltung,
      feature_sepa,
      feature_checkin,
      feature_pruefungen,
      feature_verkauf,
      feature_events,
      feature_buchfuehrung,
      feature_api,
      feature_multidojo
    } = req.body;

    // Prüfe ob Dojo existiert
    const [existing] = await db.promise().query('SELECT id FROM dojo WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    // Prüfe ob Subscription existiert
    const [subscription] = await db.promise().query(
      'SELECT subscription_id FROM dojo_subscriptions WHERE dojo_id = ?',
      [id]
    );

    if (subscription.length === 0) {
      return res.status(404).json({ error: 'Keine Subscription für dieses Dojo gefunden' });
    }

    // Update Features in dojo_subscriptions
    await db.promise().query(
      `UPDATE dojo_subscriptions SET
         feature_verkauf = ?,
         feature_buchfuehrung = ?,
         feature_events = ?,
         feature_multidojo = ?,
         feature_api = ?
       WHERE dojo_id = ?`,
      [
        feature_verkauf ?? false,
        feature_buchfuehrung ?? false,
        feature_events ?? false,
        feature_multidojo ?? false,
        feature_api ?? false,
        id
      ]
    );

    logger.info('Features für Dojo aktualisiert:', { dojo_id: id, features: req.body });
    res.json({
      success: true,
      message: 'Features erfolgreich aktualisiert',
      dojo_id: id
    });

  } catch (error) {
    logger.error('Fehler beim Aktualisieren der Features:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Features', details: error.message });
  }
});

// PUT /dojos/:id/extend-trial - Trial-Zeitraum verlängern
router.put('/dojos/:id/extend-trial', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { days } = req.body;

    if (!days || days <= 0) {
      return res.status(400).json({ error: 'Ungültige Anzahl Tage' });
    }

    // Prüfe ob Dojo existiert
    const [existing] = await db.promise().query('SELECT id, dojoname FROM dojo WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    // Update trial_ends_at in dojo_subscriptions
    const [result] = await db.promise().query(
      `UPDATE dojo_subscriptions SET
         trial_ends_at = DATE_ADD(COALESCE(trial_ends_at, NOW()), INTERVAL ? DAY)
       WHERE dojo_id = ?`,
      [days, id]
    );

    // Auch in dojo Tabelle aktualisieren falls dort vorhanden
    await db.promise().query(
      `UPDATE dojo SET
         trial_ends_at = DATE_ADD(COALESCE(trial_ends_at, NOW()), INTERVAL ? DAY)
       WHERE id = ?`,
      [days, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Keine Subscription für dieses Dojo gefunden' });
    }

    logger.info('Trial für Dojo verlängert:', { dojo_id: id, days, dojoname: existing[0].dojoname });
    res.json({
      success: true,
      message: `Trial um ${days} Tage verlängert`,
      dojo_id: id,
      dojoname: existing[0].dojoname
    });

  } catch (error) {
    logger.error('Fehler beim Verlängern des Trials:', error);
    res.status(500).json({ error: 'Fehler beim Verlängern des Trials', details: error.message });
  }
});

// PUT /dojos/:id/activate-subscription - Subscription manuell aktivieren/Plan ändern
router.put('/dojos/:id/activate-subscription', requireSuperAdmin, async (req, res) => {
  const connection = await db.promise().getConnection();

  try {
    const { id } = req.params;
    const { plan_type, billing_interval = 'monthly' } = req.body;

    if (!plan_type) {
      connection.release();
      return res.status(400).json({ error: 'Plan-Typ fehlt' });
    }

    // Plan-Hierarchie für Upgrade-Prüfung (alle 7 Pläne)
    const planOrder = { trial: 0, basic: 1, free: 2, starter: 3, professional: 4, premium: 5, enterprise: 6 };
    if (!(plan_type in planOrder)) {
      connection.release();
      return res.status(400).json({ error: 'Ungültiger Plan-Typ', valid: Object.keys(planOrder) });
    }

    await connection.beginTransaction();

    // Prüfe ob Dojo existiert
    const [existing] = await connection.query('SELECT id, dojoname FROM dojo WHERE id = ?', [id]);
    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    // Hole aktuelle Subscription
    const [currentSub] = await connection.query(
      'SELECT * FROM dojo_subscriptions WHERE dojo_id = ?',
      [id]
    );

    // Lade Plan-Details
    const [planDetails] = await connection.query(
      'SELECT * FROM subscription_plans WHERE plan_name = ?',
      [plan_type]
    );

    if (planDetails.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'Plan nicht in subscription_plans gefunden' });
    }

    const plan = planDetails[0];
    const newPrice = billing_interval === 'yearly' ? plan.price_yearly : plan.price_monthly;

    if (currentSub.length === 0) {
      // Neue Subscription erstellen
      await connection.query(
        `INSERT INTO dojo_subscriptions
         (dojo_id, plan_type, status, feature_verkauf, feature_buchfuehrung,
          feature_events, feature_multidojo, feature_api, max_members, max_dojos,
          storage_limit_mb, monthly_price, billing_interval, subscription_starts_at)
         VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          id, plan_type,
          plan.feature_verkauf, plan.feature_buchfuehrung,
          plan.feature_events, plan.feature_multidojo, plan.feature_api,
          plan.max_members, plan.max_dojos, plan.storage_limit_mb,
          newPrice, billing_interval
        ]
      );
    } else {
      // Existierende Subscription aktualisieren
      const oldPlan = currentSub[0].plan_type;

      await connection.query(
        `UPDATE dojo_subscriptions SET
           plan_type = ?,
           status = 'active',
           feature_verkauf = ?,
           feature_buchfuehrung = ?,
           feature_events = ?,
           feature_multidojo = ?,
           feature_api = ?,
           max_members = ?,
           max_dojos = ?,
           storage_limit_mb = ?,
           monthly_price = ?,
           billing_interval = ?,
           subscription_starts_at = NOW(),
           trial_ends_at = NULL,
           cancelled_at = NULL
         WHERE dojo_id = ?`,
        [
          plan_type,
          plan.feature_verkauf, plan.feature_buchfuehrung,
          plan.feature_events, plan.feature_multidojo, plan.feature_api,
          plan.max_members, plan.max_dojos, plan.storage_limit_mb,
          newPrice, billing_interval,
          id
        ]
      );

      // Audit-Log
      await connection.query(
        `INSERT INTO subscription_audit_log
         (subscription_id, dojo_id, action, old_plan, new_plan, changed_by_admin_id, reason)
         VALUES (?, ?, 'admin_activated', ?, ?, ?, ?)`,
        [
          currentSub[0].subscription_id,
          id,
          oldPlan,
          plan_type,
          req.user?.id || null,
          `Plan von Admin aktiviert: ${oldPlan} -> ${plan_type}`
        ]
      );
    }

    // Update auch dojo Tabelle
    await connection.query(
      `UPDATE dojo SET
         subscription_plan = ?,
         subscription_status = 'active',
         subscription_started_at = NOW(),
         payment_interval = ?
       WHERE id = ?`,
      [plan_type, billing_interval, id]
    );

    await connection.commit();

    logger.info('Subscription für Dojo aktiviert:', {
      dojo_id: id,
      dojoname: existing[0].dojoname,
      plan_type,
      billing_interval
    });

    res.json({
      success: true,
      message: `Plan "${plan_type}" erfolgreich aktiviert`,
      dojo_id: id,
      dojoname: existing[0].dojoname,
      plan_type,
      billing_interval,
      monthly_price: newPrice
    });

  } catch (error) {
    await connection.rollback();
    logger.error('Fehler beim Aktivieren der Subscription:', error);
    res.status(500).json({ error: 'Fehler beim Aktivieren der Subscription', details: error.message });
  } finally {
    connection.release();
  }
});

// PUT /dojos/:id/toggle-active - Dojo aktivieren/deaktivieren
router.put('/dojos/:id/toggle-active', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { ist_aktiv } = req.body;

    if (typeof ist_aktiv !== 'boolean') {
      return res.status(400).json({ error: 'ist_aktiv muss ein boolean sein' });
    }

    // Prüfe ob Dojo existiert
    const [existing] = await db.promise().query('SELECT id, dojoname, ist_aktiv FROM dojo WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    // Update Status
    await db.promise().query(
      'UPDATE dojo SET ist_aktiv = ? WHERE id = ?',
      [ist_aktiv, id]
    );

    // Audit-Log eintragen (falls Tabelle existiert)
    try {
      await db.promise().query(
        `INSERT INTO subscription_audit_log
         (dojo_id, action, old_plan, new_plan, changed_by_admin_id, reason)
         VALUES (?, ?, NULL, NULL, ?, ?)`,
        [
          id,
          ist_aktiv ? 'dojo_reactivated' : 'dojo_deactivated',
          req.user?.id || null,
          ist_aktiv ? 'Dojo von Admin reaktiviert' : 'Dojo von Admin deaktiviert'
        ]
      );
    } catch (auditError) {
      logger.debug('Audit-Log nicht geschrieben (Tabelle fehlt?):', auditError.message);
    }

    const action = ist_aktiv ? 'reaktiviert' : 'deaktiviert';
    logger.info(`Dojo ${action}:`, {
      dojo_id: id,
      dojoname: existing[0].dojoname,
      ist_aktiv,
      admin: req.user?.username
    });

    res.json({
      success: true,
      message: `Dojo "${existing[0].dojoname}" erfolgreich ${action}`,
      dojo_id: id,
      dojoname: existing[0].dojoname,
      ist_aktiv
    });

  } catch (error) {
    logger.error('Fehler beim Toggle Dojo-Status:', error);
    res.status(500).json({ error: 'Fehler beim Ändern des Dojo-Status', details: error.message });
  }
});

// DELETE /dojos/:id/permanent - Dojo DAUERHAFT löschen mit allen Daten
router.delete('/dojos/:id/permanent', requireSuperAdmin, async (req, res) => {
  const connection = await db.promise().getConnection();

  try {
    const { id } = req.params;
    const dojoId = parseInt(id);

    // Prüfe ob Dojo existiert
    const [existing] = await connection.query('SELECT id, dojoname, ist_hauptdojo FROM dojo WHERE id = ?', [dojoId]);
    if (existing.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    const dojo = existing[0];

    // Haupt-Dojo und TDA International können nicht gelöscht werden
    if (dojo.ist_hauptdojo || dojoId === 2) {
      connection.release();
      return res.status(403).json({ error: 'Dieses Dojo kann nicht gelöscht werden (Haupt-Dojo oder TDA International)' });
    }

    await connection.beginTransaction();

    logger.info('Starte dauerhafte Löschung von Dojo:', { id: dojoId, dojoname: dojo.dojoname });

    // Lösche alle verknüpften Daten in der richtigen Reihenfolge (wegen Foreign Keys)

    // 1. Verkäufe und Verkaufsartikel
    await connection.query('DELETE va FROM verkauf_artikel va INNER JOIN verkaeufe v ON va.verkauf_id = v.verkauf_id WHERE v.dojo_id = ?', [dojoId]);
    await connection.query('DELETE FROM verkaeufe WHERE dojo_id = ?', [dojoId]);

    // 2. Produkte
    await connection.query('DELETE FROM produkte WHERE dojo_id = ?', [dojoId]);

    // 3. Kurs-Teilnehmer und Kurse
    await connection.query('DELETE kt FROM kurs_teilnehmer kt INNER JOIN kurse k ON kt.kurs_id = k.kurs_id WHERE k.dojo_id = ?', [dojoId]);
    await connection.query('DELETE FROM kurse WHERE dojo_id = ?', [dojoId]);

    // 4. Mitglieder-bezogene Daten
    await connection.query('DELETE ma FROM mitglied_ausweise ma INNER JOIN mitglieder m ON ma.mitglied_id = m.mitglied_id WHERE m.dojo_id = ?', [dojoId]);
    await connection.query('DELETE mp FROM mitglied_pruefungen mp INNER JOIN mitglieder m ON mp.mitglied_id = m.mitglied_id WHERE m.dojo_id = ?', [dojoId]);
    await connection.query('DELETE mz FROM mitglied_zahlungen mz INNER JOIN mitglieder m ON mz.mitglied_id = m.mitglied_id WHERE m.dojo_id = ?', [dojoId]);
    await connection.query('DELETE mv FROM mitglied_vertraege mv INNER JOIN mitglieder m ON mv.mitglied_id = m.mitglied_id WHERE m.dojo_id = ?', [dojoId]);
    await connection.query('DELETE FROM mitglieder WHERE dojo_id = ?', [dojoId]);

    // 5. Trainer
    await connection.query('DELETE FROM trainer WHERE dojo_id = ?', [dojoId]);

    // 6. Vertragsvorlagen
    await connection.query('DELETE FROM vertragsvorlagen WHERE dojo_id = ?', [dojoId]);

    // 7. Events und Event-Teilnehmer
    await connection.query('DELETE et FROM event_teilnehmer et INNER JOIN events e ON et.event_id = e.id WHERE e.dojo_id = ?', [dojoId]);
    await connection.query('DELETE FROM events WHERE dojo_id = ?', [dojoId]);

    // 8. Rechnungen und Rechnungspositionen
    await connection.query('DELETE rp FROM rechnungspositionen rp INNER JOIN rechnungen r ON rp.rechnung_id = r.id WHERE r.dojo_id = ?', [dojoId]);
    await connection.query('DELETE FROM rechnungen WHERE dojo_id = ?', [dojoId]);

    // 9. SEPA-Mandate
    await connection.query('DELETE FROM sepa_mandate WHERE dojo_id = ?', [dojoId]);

    // 10. Admin-Benutzer (NICHT den Super-Admin löschen)
    await connection.query('DELETE FROM admin_users WHERE dojo_id = ? AND rolle != ?', [dojoId, 'superadmin']);

    // 11. Subscriptions
    await connection.query('DELETE FROM subscriptions WHERE dojo_id = ?', [dojoId]);

    // 12. Einstellungen
    await connection.query('DELETE FROM dojo_einstellungen WHERE dojo_id = ?', [dojoId]);

    // 13. Schließlich das Dojo selbst
    await connection.query('DELETE FROM dojo WHERE id = ?', [dojoId]);

    await connection.commit();
    connection.release();

    logger.info('Dojo dauerhaft gelöscht:', { id: dojoId, dojoname: dojo.dojoname });
    res.json({
      success: true,
      message: `Dojo "${dojo.dojoname}" wurde dauerhaft gelöscht`,
      dojo_id: dojoId,
      dojoname: dojo.dojoname
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    logger.error('Fehler beim dauerhaften Löschen des Dojos:', error);
    res.status(500).json({ error: 'Fehler beim dauerhaften Löschen des Dojos', details: error.message });
  }
});

// GET /subscription-audit-log - Subscription-Änderungen abrufen
router.get('/subscription-audit-log', requireSuperAdmin, async (req, res) => {
  try {
    const { dojo_id, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT
        sal.*,
        d.dojoname,
        au.username as admin_username
      FROM subscription_audit_log sal
      LEFT JOIN dojo d ON sal.dojo_id = d.id
      LEFT JOIN admin_users au ON sal.changed_by_admin_id = au.id
    `;
    const params = [];

    if (dojo_id) {
      query += ' WHERE sal.dojo_id = ?';
      params.push(dojo_id);
    }

    query += ' ORDER BY sal.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [logs] = await db.promise().query(query, params);

    // Gesamtzahl für Pagination
    let countQuery = 'SELECT COUNT(*) as total FROM subscription_audit_log';
    const countParams = [];
    if (dojo_id) {
      countQuery += ' WHERE dojo_id = ?';
      countParams.push(dojo_id);
    }
    const [countResult] = await db.promise().query(countQuery, countParams);

    res.json({
      success: true,
      logs,
      pagination: {
        total: countResult[0]?.total || 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error('Fehler beim Abrufen des Subscription-Audit-Logs:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Audit-Logs', details: error.message });
  }
});

module.exports = router;
