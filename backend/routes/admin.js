// =============================================
// SUPER-ADMIN ROUTES - Tiger & Dragon Association International
// =============================================
// Nur für super_admin oder Admin von dojo_id=2 (TDA International)

const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs').promises;
const path = require('path');

// =============================================
// MIDDLEWARE: Super-Admin Access Check
// =============================================
const requireSuperAdmin = (req, res, next) => {
  const { user } = req;

  if (!user) {
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }

  // Zugriff für:
  // 1. super_admin Rolle (explizit)
  // 2. Admin mit dojo_id=NULL (Super-Admin Account)
  // 3. Admin von TDA International (dojo_id=2)
  const isSuperAdmin = user.rolle === 'super_admin' || user.role === 'super_admin';
  const isAdminWithNullDojo = (user.rolle === 'admin' || user.role === 'admin') && user.dojo_id === null;
  const isTDAAdmin = user.dojo_id === 2 && (user.rolle === 'admin' || user.role === 'admin');

  if (isSuperAdmin || isAdminWithNullDojo || isTDAAdmin) {
    console.log('✅ Super-Admin Zugriff gewährt:', {
      username: user.username,
      role: user.role || user.rolle,
      dojo_id: user.dojo_id
    });
    next();
  } else {
    console.log('❌ Super-Admin Zugriff verweigert:', {
      username: user.username,
      role: user.role || user.rolle,
      dojo_id: user.dojo_id
    });
    return res.status(403).json({
      error: 'Zugriff verweigert',
      message: 'Nur für TDA International Administratoren'
    });
  }
};

// =============================================
// HELPER FUNCTIONS
// =============================================

// Berechne Speicherplatz für ein Dojo (in MB)
async function calculateDojoStorageUsage(dojoId) {
  try {
    const docsDir = path.join(__dirname, '..', 'generated_documents');

    // Hole alle Dokumente für dieses Dojo
    const [documents] = await db.promise().query(
      'SELECT dateipfad FROM mitglied_dokumente WHERE dojo_id = ?',
      [dojoId]
    );

    let totalSizeBytes = 0;

    // Summiere Dateigrößen
    for (const doc of documents) {
      try {
        const fullPath = path.join(__dirname, '..', doc.dateipfad);
        const stats = await fs.stat(fullPath);
        totalSizeBytes += stats.size;
      } catch (err) {
        // Datei existiert nicht mehr, ignorieren
        continue;
      }
    }

    // Konvertiere zu MB
    const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);
    return parseFloat(totalSizeMB);
  } catch (error) {
    console.error(`❌ Fehler beim Berechnen des Speicherplatzes für Dojo ${dojoId}:`, error);
    return 0;
  }
}

// =============================================
// DOJO MANAGEMENT
// =============================================

// GET /api/admin/dojos - Alle Dojos auflisten
router.get('/dojos', requireSuperAdmin, async (req, res) => {
  try {
    const query = `
      SELECT
        d.id,
        d.dojoname,
        d.subdomain,
        d.inhaber,
        d.ort,
        d.email,
        d.telefon,
        d.ist_aktiv,
        d.mitgliederzahl_aktuell,
        d.created_at,
        d.onboarding_completed,
        d.subscription_status,
        d.trial_ends_at,
        d.subscription_plan,
        d.subscription_started_at,
        d.subscription_ends_at,
        d.payment_interval,
        d.last_payment_at,
        DATEDIFF(d.trial_ends_at, NOW()) as trial_days_remaining,
        DATEDIFF(d.subscription_ends_at, NOW()) as subscription_days_remaining,
        COUNT(DISTINCT m.mitglied_id) AS mitglieder_count,
        COUNT(DISTINCT k.kurs_id) AS kurse_count,
        COUNT(DISTINCT t.trainer_id) AS trainer_count
      FROM dojo d
      LEFT JOIN mitglieder m ON d.id = m.dojo_id AND m.aktiv = 1
      LEFT JOIN kurse k ON d.id = k.dojo_id
      LEFT JOIN trainer t ON d.id = t.dojo_id
      WHERE d.id NOT IN (
        SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL
      )
      GROUP BY d.id, d.dojoname, d.subdomain, d.inhaber, d.ort, d.email, d.telefon,
               d.ist_aktiv, d.mitgliederzahl_aktuell, d.created_at, d.onboarding_completed,
               d.subscription_status, d.trial_ends_at, d.subscription_plan,
               d.subscription_started_at, d.subscription_ends_at, d.payment_interval, d.last_payment_at
      ORDER BY d.dojoname
    `;

    const [dojos] = await db.promise().query(query);

    // Füge Speicherplatz-Informationen hinzu
    const dojosWithStorage = await Promise.all(
      dojos.map(async (dojo) => {
        const storage_mb = await calculateDojoStorageUsage(dojo.id);
        return {
          ...dojo,
          storage_mb,
          storage_gb: (storage_mb / 1024).toFixed(2)
        };
      })
    );

    console.log(`✅ Admin: ${dojos.length} Dojos abgerufen (mit Speicherplatz)`);
    res.json({
      success: true,
      count: dojosWithStorage.length,
      dojos: dojosWithStorage
    });
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der Dojos:', error);
    res.status(500).json({
      error: 'Fehler beim Abrufen der Dojos',
      details: error.message
    });
  }
});

// GET /api/admin/dojos/:id - Einzelnes Dojo abrufen
router.get('/dojos/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        d.*,
        COUNT(DISTINCT m.mitglied_id) AS mitglieder_count,
        COUNT(DISTINCT k.kurs_id) AS kurse_count,
        COUNT(DISTINCT t.trainer_id) AS trainer_count
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

    res.json({
      success: true,
      dojo: dojos[0]
    });
  } catch (error) {
    console.error('❌ Fehler beim Abrufen des Dojos:', error);
    res.status(500).json({
      error: 'Fehler beim Abrufen des Dojos',
      details: error.message
    });
  }
});

// POST /api/admin/dojos - Neues Dojo anlegen
router.post('/dojos', requireSuperAdmin, async (req, res) => {
  try {
    const {
      dojoname,
      subdomain,
      inhaber,
      email,
      telefon,
      strasse,
      hausnummer,
      plz,
      ort,
      land = 'Deutschland'
    } = req.body;

    // Validierung
    if (!dojoname || !subdomain || !inhaber) {
      return res.status(400).json({
        error: 'Pflichtfelder fehlen',
        required: ['dojoname', 'subdomain', 'inhaber']
      });
    }

    // Prüfe ob Subdomain bereits existiert
    const [existing] = await db.promise().query(
      'SELECT id FROM dojo WHERE subdomain = ?',
      [subdomain]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        error: 'Subdomain bereits vergeben',
        subdomain
      });
    }

    // Dojo erstellen
    const insertQuery = `
      INSERT INTO dojo (
        dojoname, subdomain, inhaber, email, telefon,
        strasse, hausnummer, plz, ort, land,
        ist_aktiv, onboarding_completed, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW())
    `;

    const [result] = await db.promise().query(insertQuery, [
      dojoname, subdomain, inhaber, email, telefon,
      strasse, hausnummer, plz, ort, land
    ]);

    console.log(`✅ Neues Dojo angelegt: ${dojoname} (ID: ${result.insertId})`);

    res.status(201).json({
      success: true,
      message: 'Dojo erfolgreich angelegt',
      dojo_id: result.insertId,
      dojoname,
      subdomain
    });
  } catch (error) {
    console.error('❌ Fehler beim Anlegen des Dojos:', error);
    res.status(500).json({
      error: 'Fehler beim Anlegen des Dojos',
      details: error.message
    });
  }
});

// PUT /api/admin/dojos/:id - Dojo bearbeiten
router.put('/dojos/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Entferne nicht-editierbare Felder
    delete updates.id;
    delete updates.created_at;
    delete updates.updated_at;

    // Prüfe ob Dojo existiert
    const [existing] = await db.promise().query(
      'SELECT id FROM dojo WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    // Prüfe Subdomain-Eindeutigkeit (falls geändert)
    if (updates.subdomain) {
      const [subdomainCheck] = await db.promise().query(
        'SELECT id FROM dojo WHERE subdomain = ? AND id != ?',
        [updates.subdomain, id]
      );

      if (subdomainCheck.length > 0) {
        return res.status(400).json({
          error: 'Subdomain bereits vergeben',
          subdomain: updates.subdomain
        });
      }
    }

    // Baue UPDATE Query dynamisch
    const fields = Object.keys(updates);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'Keine Änderungen übergeben' });
    }

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field]);
    values.push(id);

    const updateQuery = `UPDATE dojo SET ${setClause}, updated_at = NOW() WHERE id = ?`;

    await db.promise().query(updateQuery, values);

    console.log(`✅ Dojo aktualisiert: ID ${id}`);

    res.json({
      success: true,
      message: 'Dojo erfolgreich aktualisiert',
      dojo_id: id
    });
  } catch (error) {
    console.error('❌ Fehler beim Aktualisieren des Dojos:', error);
    res.status(500).json({
      error: 'Fehler beim Aktualisieren des Dojos',
      details: error.message
    });
  }
});

// DELETE /api/admin/dojos/:id - Dojo löschen (Soft-Delete)
router.delete('/dojos/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prüfe ob Dojo existiert
    const [existing] = await db.promise().query(
      'SELECT id, dojoname FROM dojo WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    // Verhindere Löschen von TDA International
    if (parseInt(id) === 2) {
      return res.status(403).json({
        error: 'TDA International kann nicht gelöscht werden'
      });
    }

    // Soft-Delete: Setze ist_aktiv = 0
    await db.promise().query(
      'UPDATE dojo SET ist_aktiv = 0, updated_at = NOW() WHERE id = ?',
      [id]
    );

    console.log(`✅ Dojo deaktiviert: ${existing[0].dojoname} (ID: ${id})`);

    res.json({
      success: true,
      message: 'Dojo erfolgreich deaktiviert',
      dojo_id: id,
      dojoname: existing[0].dojoname
    });
  } catch (error) {
    console.error('❌ Fehler beim Löschen des Dojos:', error);
    res.status(500).json({
      error: 'Fehler beim Löschen des Dojos',
      details: error.message
    });
  }
});

// =============================================
// STATISTIKEN
// =============================================

// GET /api/admin/global-stats - Aggregierte Statistiken über alle Dojos
router.get('/global-stats', requireSuperAdmin, async (req, res) => {
  try {
    const stats = {};

    // 1. Dojo-Übersicht
    const [dojoStats] = await db.promise().query(`
      SELECT
        COUNT(*) as total_dojos,
        SUM(ist_aktiv) as active_dojos,
        SUM(mitgliederzahl_aktuell) as total_members_declared
      FROM dojo
    `);
    stats.dojos = dojoStats[0];

    // 2. Mitglieder (alle Dojos)
    const [memberStats] = await db.promise().query(`
      SELECT
        COUNT(*) as total_members,
        SUM(CASE WHEN aktiv = 1 THEN 1 ELSE 0 END) as active_members,
        COUNT(DISTINCT dojo_id) as dojos_with_members
      FROM mitglieder
    `);
    stats.members = memberStats[0];

    // 3. Kurse (alle Dojos)
    const [courseStats] = await db.promise().query(`
      SELECT
        COUNT(*) as total_courses,
        COUNT(DISTINCT dojo_id) as dojos_with_courses
      FROM kurse
    `);
    stats.courses = courseStats[0];

    // 4. Trainer (alle Dojos)
    const [trainerStats] = await db.promise().query(`
      SELECT
        COUNT(*) as total_trainers,
        COUNT(DISTINCT dojo_id) as dojos_with_trainers
      FROM trainer
    `);
    stats.trainers = trainerStats[0];

    // 5. Aktive Check-ins heute (alle Dojos)
    const [checkinStats] = await db.promise().query(`
      SELECT
        COUNT(*) as active_checkins_today
      FROM checkins
      WHERE DATE(checkin_time) = CURDATE() AND status = 'active'
    `);
    stats.checkins = checkinStats[0];

    // 6. Offene Beiträge (alle Dojos)
    const [beitraegeStats] = await db.promise().query(`
      SELECT
        COUNT(*) as open_payments,
        SUM(betrag) as open_amount
      FROM beitraege
      WHERE bezahlt = 0
    `);
    stats.payments = beitraegeStats[0];

    // 7. Dojos nach Aktivitäts-Ranking
    const [topDojos] = await db.promise().query(`
      SELECT
        d.id,
        d.dojoname,
        d.subdomain,
        COUNT(DISTINCT m.mitglied_id) as member_count,
        COUNT(DISTINCT k.kurs_id) as course_count,
        COUNT(DISTINCT t.trainer_id) as trainer_count
      FROM dojo d
      LEFT JOIN mitglieder m ON d.id = m.dojo_id AND m.aktiv = 1
      LEFT JOIN kurse k ON d.id = k.dojo_id
      LEFT JOIN trainer t ON d.id = t.dojo_id
      WHERE d.ist_aktiv = 1
      GROUP BY d.id
      ORDER BY member_count DESC
      LIMIT 10
    `);
    stats.top_dojos = topDojos;

    // 8. Speicherplatz-Statistiken (alle Dojos)
    const [allDojos] = await db.promise().query('SELECT id FROM dojo');
    let totalStorageMB = 0;

    for (const dojo of allDojos) {
      const storageMB = await calculateDojoStorageUsage(dojo.id);
      totalStorageMB += storageMB;
    }

    stats.storage = {
      total_storage_mb: totalStorageMB.toFixed(2),
      total_storage_gb: (totalStorageMB / 1024).toFixed(2),
      dojos_count: allDojos.length
    };

    console.log('✅ Admin: Globale Statistiken abgerufen (mit Speicherplatz)');
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der globalen Statistiken:', error);
    res.status(500).json({
      error: 'Fehler beim Abrufen der Statistiken',
      details: error.message
    });
  }
});

// GET /api/admin/tda-stats - Statistiken für TDA International (dojo_id=2)
router.get('/tda-stats', requireSuperAdmin, async (req, res) => {
  try {
    const TDA_DOJO_ID = 2;
    const stats = {};

    // 1. TDA Mitglieder
    const [memberStats] = await db.promise().query(`
      SELECT
        COUNT(*) as total_members,
        SUM(CASE WHEN aktiv = 1 THEN 1 ELSE 0 END) as active_members
      FROM mitglieder
      WHERE dojo_id = ?
    `, [TDA_DOJO_ID]);
    stats.members = memberStats[0];

    // 2. TDA Kurse
    const [courseStats] = await db.promise().query(`
      SELECT COUNT(*) as total_courses
      FROM kurse
      WHERE dojo_id = ?
    `, [TDA_DOJO_ID]);
    stats.courses = courseStats[0];

    // 3. TDA Trainer
    const [trainerStats] = await db.promise().query(`
      SELECT COUNT(*) as total_trainers
      FROM trainer
      WHERE dojo_id = ?
    `, [TDA_DOJO_ID]);
    stats.trainers = trainerStats[0];

    // 4. TDA Check-ins heute
    const [checkinStats] = await db.promise().query(`
      SELECT COUNT(*) as active_checkins_today
      FROM checkins c
      JOIN mitglieder m ON c.mitglied_id = m.mitglied_id
      WHERE m.dojo_id = ?
        AND DATE(c.checkin_time) = CURDATE()
        AND c.status = 'active'
    `, [TDA_DOJO_ID]);
    stats.checkins = checkinStats[0];

    // 5. TDA Offene Beiträge
    const [beitraegeStats] = await db.promise().query(`
      SELECT
        COUNT(*) as open_payments,
        SUM(betrag) as open_amount
      FROM beitraege
      WHERE dojo_id = ? AND bezahlt = 0
    `, [TDA_DOJO_ID]);
    stats.payments = beitraegeStats[0];

    console.log('✅ Admin: TDA International Statistiken abgerufen');
    res.json({
      success: true,
      dojo_id: TDA_DOJO_ID,
      dojo_name: 'Tiger & Dragon Association - International',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der TDA Statistiken:', error);
    res.status(500).json({
      error: 'Fehler beim Abrufen der TDA Statistiken',
      details: error.message
    });
  }
});

// =============================================
// TRIAL & SUBSCRIPTION MANAGEMENT
// =============================================

// PUT /api/admin/dojos/:id/extend-trial - Trial verlängern
router.put('/dojos/:id/extend-trial', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { days } = req.body; // Anzahl Tage zum Verlängern

    if (!days || days < 1 || days > 365) {
      return res.status(400).json({
        error: 'Ungültige Anzahl Tage',
        message: 'Tage müssen zwischen 1 und 365 liegen'
      });
    }

    // Hole aktuelles Dojo
    const [dojos] = await db.promise().query(
      'SELECT id, dojoname, subscription_status, trial_ends_at FROM dojo WHERE id = ?',
      [id]
    );

    if (dojos.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    const dojo = dojos[0];

    // Trial verlängern
    const newTrialEndDate = new Date(dojo.trial_ends_at || new Date());
    newTrialEndDate.setDate(newTrialEndDate.getDate() + parseInt(days));

    await db.promise().query(
      `UPDATE dojo
      SET trial_ends_at = ?,
          subscription_status = 'trial'
      WHERE id = ?`,
      [newTrialEndDate, id]
    );

    console.log(`✅ Admin: Trial verlängert für Dojo ${dojo.dojoname} um ${days} Tage`);

    res.json({
      success: true,
      message: `Trial erfolgreich um ${days} Tage verlängert`,
      dojo_id: id,
      dojoname: dojo.dojoname,
      new_trial_ends_at: newTrialEndDate,
      days_added: days
    });

  } catch (error) {
    console.error('❌ Fehler beim Verlängern des Trials:', error);
    res.status(500).json({
      error: 'Fehler beim Verlängern des Trials',
      details: error.message
    });
  }
});

// PUT /api/admin/dojos/:id/activate-subscription - Abo aktivieren
router.put('/dojos/:id/activate-subscription', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, interval, duration_months, is_free, custom_price, custom_notes } = req.body;

    // Validierung
    const validPlans = ['basic', 'premium', 'enterprise', 'free', 'custom'];
    const validIntervals = ['monthly', 'quarterly', 'yearly'];

    if (!plan || !validPlans.includes(plan)) {
      return res.status(400).json({
        error: 'Ungültiger Plan',
        message: 'Plan muss basic, premium, enterprise, free oder custom sein'
      });
    }

    // Free Account - unbegrenzt
    if (plan === 'free' || is_free) {
      const [dojos] = await db.promise().query(
        'SELECT id, dojoname FROM dojo WHERE id = ?',
        [id]
      );

      if (dojos.length === 0) {
        return res.status(404).json({ error: 'Dojo nicht gefunden' });
      }

      const dojo = dojos[0];

      await db.promise().query(
        `UPDATE dojo
        SET subscription_status = 'active',
            subscription_plan = 'free',
            payment_interval = NULL,
            subscription_started_at = NOW(),
            subscription_ends_at = NULL,
            last_payment_at = NOW()
        WHERE id = ?`,
        [id]
      );

      console.log(`✅ Admin: KOSTENLOSER Account aktiviert für Dojo ${dojo.dojoname}`);

      return res.json({
        success: true,
        message: `Kostenloser Account aktiviert`,
        dojo_id: id,
        dojoname: dojo.dojoname,
        subscription_plan: 'free',
        is_lifetime: true
      });
    }

    // Custom oder Standard Plan
    if (!interval || !validIntervals.includes(interval)) {
      return res.status(400).json({
        error: 'Ungültiges Intervall',
        message: 'Intervall muss monthly, quarterly oder yearly sein'
      });
    }

    const months = parseInt(duration_months) || 1;
    if (months < 1 || months > 60) {
      return res.status(400).json({
        error: 'Ungültige Dauer',
        message: 'Dauer muss zwischen 1 und 60 Monaten liegen'
      });
    }

    // Hole aktuelles Dojo
    const [dojos] = await db.promise().query(
      'SELECT id, dojoname FROM dojo WHERE id = ?',
      [id]
    );

    if (dojos.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    const dojo = dojos[0];

    // Berechne Abo-Ende
    const subscriptionStartDate = new Date();
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + months);

    // Aktiviere Abo
    await db.promise().query(
      `UPDATE dojo
      SET subscription_status = 'active',
          subscription_plan = ?,
          payment_interval = ?,
          subscription_started_at = ?,
          subscription_ends_at = ?,
          last_payment_at = NOW()
      WHERE id = ?`,
      [plan, interval, subscriptionStartDate, subscriptionEndDate, id]
    );

    // Log mit Custom-Info wenn vorhanden
    const logMessage = plan === 'custom'
      ? `✅ Admin: CUSTOM Abonnement aktiviert für Dojo ${dojo.dojoname} - Preis: ${custom_price}€, ${months} Monate, Notizen: ${custom_notes || 'keine'}`
      : `✅ Admin: Abonnement aktiviert für Dojo ${dojo.dojoname} - Plan: ${plan}, ${months} Monate`;

    console.log(logMessage);

    res.json({
      success: true,
      message: `Abonnement erfolgreich aktiviert`,
      dojo_id: id,
      dojoname: dojo.dojoname,
      subscription_plan: plan,
      payment_interval: interval,
      subscription_started_at: subscriptionStartDate,
      subscription_ends_at: subscriptionEndDate,
      duration_months: months,
      ...(plan === 'custom' && { custom_price, custom_notes })
    });

  } catch (error) {
    console.error('❌ Fehler beim Aktivieren des Abonnements:', error);
    res.status(500).json({
      error: 'Fehler beim Aktivieren des Abonnements',
      details: error.message
    });
  }
});

// PUT /api/admin/dojos/:id/subscription-status - Status ändern
router.put('/dojos/:id/subscription-status', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['trial', 'active', 'expired', 'cancelled', 'suspended'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Ungültiger Status',
        message: 'Status muss trial, active, expired, cancelled oder suspended sein'
      });
    }

    // Hole aktuelles Dojo
    const [dojos] = await db.promise().query(
      'SELECT id, dojoname, subscription_status FROM dojo WHERE id = ?',
      [id]
    );

    if (dojos.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    const dojo = dojos[0];

    // Status ändern
    await db.promise().query(
      'UPDATE dojo SET subscription_status = ? WHERE id = ?',
      [status, id]
    );

    console.log(`✅ Admin: Status geändert für Dojo ${dojo.dojoname}: ${dojo.subscription_status} → ${status}`);

    res.json({
      success: true,
      message: `Status erfolgreich geändert`,
      dojo_id: id,
      dojoname: dojo.dojoname,
      old_status: dojo.subscription_status,
      new_status: status
    });

  } catch (error) {
    console.error('❌ Fehler beim Ändern des Status:', error);
    res.status(500).json({
      error: 'Fehler beim Ändern des Status',
      details: error.message
    });
  }
});

// =============================================
// GET /api/admin/statistics - Erweiterte Statistiken für Charts
// =============================================
router.get('/statistics', requireSuperAdmin, async (req, res) => {
  try {
    console.log('📊 Lade erweiterte Statistiken...');

    // 1. Mitglieder-Entwicklung (letzte 12 Monate)
    const [memberTrend] = await db.promise().query(`
      SELECT
        DATE_FORMAT(beigetreten_am, '%Y-%m') as monat,
        COUNT(*) as neue_mitglieder
      FROM mitglieder
      WHERE beigetreten_am >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(beigetreten_am, '%Y-%m')
      ORDER BY monat ASC
    `);

    // 2. Umsatz pro Dojo (aktuelles Jahr)
    const [revenuePerDojo] = await db.promise().query(`
      SELECT
        d.id,
        d.dojoname,
        d.jahresumsatz_aktuell as umsatz,
        d.steuer_status,
        COUNT(DISTINCT m.mitglied_id) as mitglieder_anzahl
      FROM dojo d
      LEFT JOIN mitglieder m ON d.id = m.dojo_id
      GROUP BY d.id, d.dojoname, d.jahresumsatz_aktuell, d.steuer_status
      ORDER BY d.jahresumsatz_aktuell DESC
    `);

    // 3. Subscription Status Verteilung
    const [subscriptionDistribution] = await db.promise().query(`
      SELECT
        subscription_status,
        COUNT(*) as anzahl
      FROM dojo
      GROUP BY subscription_status
    `);

    // 4. Umsatz-Entwicklung (letzte 12 Monate) - Aggregiert aus allen Dojos
    const currentYear = new Date().getFullYear();
    const [revenueTrend] = await db.promise().query(`
      SELECT
        MONTH(r.rechnungsdatum) as monat,
        SUM(r.gesamtsumme) as umsatz
      FROM rechnungen r
      WHERE YEAR(r.rechnungsdatum) = ?
      GROUP BY MONTH(r.rechnungsdatum)
      ORDER BY monat ASC
    `, [currentYear]);

    // 5. Top Dojos nach Mitgliedern
    const [topDojosByMembers] = await db.promise().query(`
      SELECT
        d.dojoname,
        COUNT(m.mitglied_id) as mitglieder_anzahl,
        d.jahresumsatz_aktuell as umsatz
      FROM dojo d
      LEFT JOIN mitglieder m ON d.id = m.dojo_id AND m.aktiv = 1
      GROUP BY d.id, d.dojoname, d.jahresumsatz_aktuell
      ORDER BY mitglieder_anzahl DESC
      LIMIT 10
    `);

    // 6. Aktiv vs. Inaktiv Mitglieder (Gesamt)
    const [memberStatus] = await db.promise().query(`
      SELECT
        aktiv,
        COUNT(*) as anzahl
      FROM mitglieder
      GROUP BY aktiv
    `);

    // 7. Trial Conversion Rate
    const [trialStats] = await db.promise().query(`
      SELECT
        COUNT(CASE WHEN subscription_status = 'trial' THEN 1 END) as trial_count,
        COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN subscription_status = 'expired' THEN 1 END) as expired_count,
        COUNT(*) as total_count
      FROM dojo
    `);

    const stats = trialStats[0];
    const conversionRate = stats.total_count > 0
      ? ((stats.active_count / (stats.active_count + stats.expired_count)) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      statistics: {
        memberTrend: memberTrend.map(row => ({
          monat: row.monat,
          neue_mitglieder: parseInt(row.neue_mitglieder)
        })),
        revenuePerDojo: revenuePerDojo.map(row => ({
          dojoname: row.dojoname,
          umsatz: parseFloat(row.umsatz || 0),
          mitglieder: parseInt(row.mitglieder_anzahl || 0),
          steuer_status: row.steuer_status
        })),
        subscriptionDistribution: subscriptionDistribution.map(row => ({
          status: row.subscription_status,
          anzahl: parseInt(row.anzahl)
        })),
        revenueTrend: revenueTrend.map(row => ({
          monat: parseInt(row.monat),
          umsatz: parseFloat(row.umsatz || 0)
        })),
        topDojos: topDojosByMembers.map(row => ({
          dojoname: row.dojoname,
          mitglieder: parseInt(row.mitglieder_anzahl),
          umsatz: parseFloat(row.umsatz || 0)
        })),
        memberStatus: {
          aktiv: memberStatus.find(s => s.aktiv === 1)?.anzahl || 0,
          inaktiv: memberStatus.find(s => s.aktiv === 0)?.anzahl || 0
        },
        conversionRate: parseFloat(conversionRate),
        trialStats: {
          trial: stats.trial_count,
          active: stats.active_count,
          expired: stats.expired_count
        }
      }
    });

    console.log('✅ Statistiken erfolgreich geladen');

  } catch (error) {
    console.error('❌ Fehler beim Laden der Statistiken:', error);
    res.status(500).json({
      error: 'Fehler beim Laden der Statistiken',
      details: error.message
    });
  }
});

// =============================================
// GET /api/admin/finance - Finanz-Übersicht und Analysen
// =============================================
router.get('/finance', requireSuperAdmin, async (req, res) => {
  try {
    console.log('💰 Lade Finanzdaten...');

    const currentYear = new Date().getFullYear();

    // 1. Gesamt-Umsatz und KPIs
    const [overallStats] = await db.promise().query(`
      SELECT
        SUM(gesamtsumme) as gesamt_umsatz,
        COUNT(*) as anzahl_rechnungen,
        AVG(gesamtsumme) as durchschnitt_rechnung,
        SUM(CASE WHEN status = 'bezahlt' THEN gesamtsumme ELSE 0 END) as bezahlt_summe,
        SUM(CASE WHEN status = 'offen' THEN gesamtsumme ELSE 0 END) as offen_summe,
        COUNT(CASE WHEN status = 'bezahlt' THEN 1 END) as bezahlt_anzahl,
        COUNT(CASE WHEN status = 'offen' THEN 1 END) as offen_anzahl
      FROM rechnungen
      WHERE YEAR(rechnungsdatum) = ?
    `, [currentYear]);

    // 2. Monatliche Einnahmen (aktuelles Jahr)
    const [monthlyRevenue] = await db.promise().query(`
      SELECT
        MONTH(rechnungsdatum) as monat,
        SUM(gesamtsumme) as umsatz,
        COUNT(*) as anzahl_rechnungen,
        SUM(CASE WHEN status = 'bezahlt' THEN gesamtsumme ELSE 0 END) as bezahlt,
        SUM(CASE WHEN status = 'offen' THEN gesamtsumme ELSE 0 END) as offen
      FROM rechnungen
      WHERE YEAR(rechnungsdatum) = ?
      GROUP BY MONTH(rechnungsdatum)
      ORDER BY monat ASC
    `, [currentYear]);

    // 3. Umsatz pro Dojo (aktuelles Jahr)
    const [revenuePerDojo] = await db.promise().query(`
      SELECT
        d.id,
        d.dojoname,
        COALESCE(SUM(r.gesamtsumme), 0) as umsatz,
        COUNT(r.rechnung_id) as anzahl_rechnungen,
        COALESCE(SUM(CASE WHEN r.status = 'bezahlt' THEN r.gesamtsumme ELSE 0 END), 0) as bezahlt,
        COALESCE(SUM(CASE WHEN r.status = 'offen' THEN r.gesamtsumme ELSE 0 END), 0) as offen
      FROM dojo d
      LEFT JOIN rechnungen r ON d.id = r.dojo_id AND YEAR(r.rechnungsdatum) = ?
      GROUP BY d.id, d.dojoname
      ORDER BY umsatz DESC
    `, [currentYear]);

    // 4. Subscription Einnahmen (monatlich)
    const [subscriptionRevenue] = await db.promise().query(`
      SELECT
        d.subscription_plan,
        d.payment_interval,
        COUNT(*) as anzahl,
        CASE
          WHEN d.subscription_plan = 'free' THEN 0
          WHEN d.subscription_plan = 'basic' THEN 29
          WHEN d.subscription_plan = 'premium' THEN 49
          WHEN d.subscription_plan = 'enterprise' THEN 99
          ELSE 0
        END as preis_monatlich
      FROM dojo d
      WHERE subscription_status = 'active'
      GROUP BY d.subscription_plan, d.payment_interval
    `);

    // Berechne monatliche und jährliche Recurring Revenue
    let monthlyRecurringRevenue = 0;
    subscriptionRevenue.forEach(row => {
      const preis = parseFloat(row.preis_monatlich);
      const anzahl = parseInt(row.anzahl);
      monthlyRecurringRevenue += preis * anzahl;
    });
    const annualRecurringRevenue = monthlyRecurringRevenue * 12;

    // 5. Aktuelle offene Rechnungen (Top 10)
    const [openInvoices] = await db.promise().query(`
      SELECT
        r.rechnung_id,
        r.rechnungsnummer,
        r.rechnungsdatum,
        r.faelligkeitsdatum,
        r.gesamtsumme,
        d.dojoname,
        m.vorname,
        m.nachname,
        DATEDIFF(NOW(), r.faelligkeitsdatum) as tage_ueberfaellig
      FROM rechnungen r
      JOIN dojo d ON r.dojo_id = d.id
      LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
      WHERE r.status = 'offen'
      ORDER BY r.faelligkeitsdatum ASC
      LIMIT 10
    `);

    // 6. Zahlungsmoral (% pünktliche Zahlungen)
    const [paymentBehavior] = await db.promise().query(`
      SELECT
        COUNT(*) as gesamt,
        COUNT(CASE WHEN status = 'bezahlt' AND bezahlt_am <= faelligkeitsdatum THEN 1 END) as puenktlich,
        COUNT(CASE WHEN status = 'bezahlt' AND bezahlt_am > faelligkeitsdatum THEN 1 END) as verspaetet,
        COUNT(CASE WHEN status = 'offen' AND faelligkeitsdatum < NOW() THEN 1 END) as ueberfaellig
      FROM rechnungen
      WHERE YEAR(rechnungsdatum) = ?
    `, [currentYear]);

    const paymentStats = paymentBehavior[0];
    const puenktlichRate = paymentStats.gesamt > 0
      ? ((paymentStats.puenktlich / paymentStats.gesamt) * 100).toFixed(1)
      : 0;

    // 7. Durchschnittlicher Umsatz pro Mitglied (Gesamt)
    const [avgRevenuePerMemberTotal] = await db.promise().query(`
      SELECT
        COUNT(DISTINCT m.mitglied_id) as anzahl_mitglieder,
        COALESCE(SUM(r.gesamtsumme), 0) as gesamt_umsatz
      FROM mitglieder m
      LEFT JOIN rechnungen r ON m.mitglied_id = r.mitglied_id AND YEAR(r.rechnungsdatum) = ?
      WHERE m.aktiv = 1
    `, [currentYear]);

    const avgPerMemberTotal = avgRevenuePerMemberTotal[0].anzahl_mitglieder > 0
      ? (avgRevenuePerMemberTotal[0].gesamt_umsatz / avgRevenuePerMemberTotal[0].anzahl_mitglieder).toFixed(2)
      : 0;

    // 8. Durchschnittlicher Umsatz pro Mitglied (pro Dojo)
    const [avgRevenuePerMember] = await db.promise().query(`
      SELECT
        d.id,
        d.dojoname,
        COUNT(DISTINCT m.mitglied_id) as anzahl_mitglieder,
        COALESCE(SUM(r.gesamtsumme), 0) as gesamt_umsatz,
        CASE
          WHEN COUNT(DISTINCT m.mitglied_id) > 0
          THEN COALESCE(SUM(r.gesamtsumme), 0) / COUNT(DISTINCT m.mitglied_id)
          ELSE 0
        END as avg_umsatz_pro_mitglied
      FROM dojo d
      LEFT JOIN mitglieder m ON d.id = m.dojo_id AND m.aktiv = 1
      LEFT JOIN rechnungen r ON m.mitglied_id = r.mitglied_id AND YEAR(r.rechnungsdatum) = ?
      GROUP BY d.id, d.dojoname
      ORDER BY avg_umsatz_pro_mitglied DESC
    `, [currentYear]);

    res.json({
      success: true,
      finance: {
        overview: {
          gesamt_umsatz: parseFloat(overallStats[0].gesamt_umsatz || 0),
          anzahl_rechnungen: parseInt(overallStats[0].anzahl_rechnungen || 0),
          durchschnitt_rechnung: parseFloat(overallStats[0].durchschnitt_rechnung || 0),
          bezahlt_summe: parseFloat(overallStats[0].bezahlt_summe || 0),
          offen_summe: parseFloat(overallStats[0].offen_summe || 0),
          bezahlt_anzahl: parseInt(overallStats[0].bezahlt_anzahl || 0),
          offen_anzahl: parseInt(overallStats[0].offen_anzahl || 0)
        },
        monthlyRevenue: monthlyRevenue.map(row => ({
          monat: parseInt(row.monat),
          umsatz: parseFloat(row.umsatz || 0),
          anzahl: parseInt(row.anzahl_rechnungen || 0),
          bezahlt: parseFloat(row.bezahlt || 0),
          offen: parseFloat(row.offen || 0)
        })),
        revenuePerDojo: revenuePerDojo.map(row => ({
          dojoname: row.dojoname,
          umsatz: parseFloat(row.umsatz || 0),
          anzahl: parseInt(row.anzahl_rechnungen || 0),
          bezahlt: parseFloat(row.bezahlt || 0),
          offen: parseFloat(row.offen || 0)
        })),
        subscriptionRevenue: {
          mrr: parseFloat(monthlyRecurringRevenue.toFixed(2)),
          arr: parseFloat(annualRecurringRevenue.toFixed(2)),
          breakdown: subscriptionRevenue.map(row => ({
            plan: row.subscription_plan,
            interval: row.payment_interval,
            anzahl: parseInt(row.anzahl),
            preis: parseFloat(row.preis_monatlich)
          }))
        },
        openInvoices: openInvoices.map(row => ({
          rechnung_id: row.rechnung_id,
          rechnungsnummer: row.rechnungsnummer,
          datum: row.rechnungsdatum,
          faelligkeit: row.faelligkeitsdatum,
          betrag: parseFloat(row.gesamtsumme),
          dojo: row.dojoname,
          kunde: row.vorname && row.nachname ? `${row.vorname} ${row.nachname}` : 'N/A',
          tage_ueberfaellig: parseInt(row.tage_ueberfaellig || 0)
        })),
        paymentBehavior: {
          gesamt: parseInt(paymentStats.gesamt),
          puenktlich: parseInt(paymentStats.puenktlich),
          verspaetet: parseInt(paymentStats.verspaetet),
          ueberfaellig: parseInt(paymentStats.ueberfaellig),
          puenktlich_rate: parseFloat(puenktlichRate)
        },
        avgRevenuePerMemberTotal: parseFloat(avgPerMemberTotal),
        avgRevenuePerMember: avgRevenuePerMember.map(row => ({
          dojoname: row.dojoname,
          anzahl_mitglieder: parseInt(row.anzahl_mitglieder),
          gesamt_umsatz: parseFloat(row.gesamt_umsatz),
          avg_umsatz_pro_mitglied: parseFloat(row.avg_umsatz_pro_mitglied)
        }))
      }
    });

    console.log('✅ Finanzdaten erfolgreich geladen');

  } catch (error) {
    console.error('❌ Fehler beim Laden der Finanzdaten:', error);
    res.status(500).json({
      error: 'Fehler beim Laden der Finanzdaten',
      details: error.message
    });
  }
});

// ==============================================
// GET /api/admin/contracts
// Vertrags-Übersicht für Super-Admin
// ==============================================
router.get('/contracts', requireSuperAdmin, async (req, res) => {
  const currentYear = new Date().getFullYear();
  const currentDate = new Date().toISOString().split('T')[0];

  try {
    // 1. Aktive Verträge
    const [activeContracts] = await db.promise().query(`
      SELECT
        d.id,
        d.dojoname,
        d.subscription_status,
        d.subscription_plan,
        d.subscription_started_at as subscription_start,
        d.subscription_ends_at as subscription_end,
        d.trial_ends_at as trial_end,
        NULL as custom_pricing,
        NULL as custom_notes,
        DATEDIFF(d.subscription_ends_at, CURDATE()) as tage_bis_ende,
        COUNT(DISTINCT m.mitglied_id) as mitglied_count
      FROM dojo d
      LEFT JOIN mitglieder m ON d.id = m.dojo_id AND m.aktiv = 1
      WHERE d.subscription_status IN ('trial', 'active')
      GROUP BY d.id
      ORDER BY d.subscription_ends_at ASC
    `);

    // 2. Bald ablaufende Verträge (nächste 30, 60, 90 Tage)
    const [upcomingRenewals30] = await db.promise().query(`
      SELECT
        d.id,
        d.dojoname,
        d.subscription_plan,
        d.subscription_ends_at as subscription_end,
        NULL as custom_pricing,
        DATEDIFF(d.subscription_ends_at, CURDATE()) as tage_bis_ende
      FROM dojo d
      WHERE d.subscription_status = 'active'
        AND d.subscription_ends_at BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      ORDER BY d.subscription_ends_at ASC
    `);

    const [upcomingRenewals60] = await db.promise().query(`
      SELECT COUNT(*) as count
      FROM dojo
      WHERE subscription_status = 'active'
        AND subscription_ends_at BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
    `);

    const [upcomingRenewals90] = await db.promise().query(`
      SELECT COUNT(*) as count
      FROM dojo
      WHERE subscription_status = 'active'
        AND subscription_ends_at BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)
    `);

    // 3. Abgelaufene Verträge (letzten 90 Tage)
    const [expiredContracts] = await db.promise().query(`
      SELECT
        d.id,
        d.dojoname,
        d.subscription_plan,
        d.subscription_ends_at as subscription_end,
        d.subscription_status,
        ABS(DATEDIFF(CURDATE(), d.subscription_ends_at)) as tage_abgelaufen
      FROM dojo d
      WHERE d.subscription_status = 'expired'
        AND d.subscription_ends_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      ORDER BY d.subscription_ends_at DESC
    `);

    // 4. Custom Pricing Verträge (keine custom_pricing Spalte in lokaler DB)
    const [customContracts] = await db.promise().query(`
      SELECT
        d.id,
        d.dojoname,
        d.subscription_plan,
        d.subscription_status,
        NULL as custom_pricing,
        NULL as custom_notes,
        d.subscription_started_at as subscription_start,
        d.subscription_ends_at as subscription_end
      FROM dojo d
      WHERE 1=0
      ORDER BY d.dojoname ASC
    `);

    // 5. Vertrags-Statistiken
    const [contractStats] = await db.promise().query(`
      SELECT
        subscription_status,
        COUNT(*) as anzahl,
        0 as custom_count
      FROM dojo
      GROUP BY subscription_status
    `);

    // 6. Trial Conversions (letzten 90 Tage)
    const [trialConversions] = await db.promise().query(`
      SELECT
        d.id,
        d.dojoname,
        d.subscription_started_at as subscription_start,
        d.trial_ends_at as trial_end,
        DATEDIFF(d.subscription_started_at, d.created_at) as trial_dauer_tage
      FROM dojo d
      WHERE d.subscription_status = 'active'
        AND d.trial_ends_at IS NOT NULL
        AND d.subscription_started_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      ORDER BY d.subscription_started_at DESC
    `);

    // 7. Durchschnittliche Vertragslaufzeit
    const [avgContractDuration] = await db.promise().query(`
      SELECT
        AVG(DATEDIFF(subscription_ends_at, subscription_started_at)) as avg_tage,
        MIN(DATEDIFF(subscription_ends_at, subscription_started_at)) as min_tage,
        MAX(DATEDIFF(subscription_ends_at, subscription_started_at)) as max_tage
      FROM dojo
      WHERE subscription_status IN ('active', 'expired')
        AND subscription_started_at IS NOT NULL
        AND subscription_ends_at IS NOT NULL
    `);

    // 8. Monatliche Vertragsabschlüsse (aktuelles Jahr)
    const [monthlyContracts] = await db.promise().query(`
      SELECT
        MONTH(subscription_started_at) as monat,
        COUNT(*) as anzahl_vertraege,
        COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as aktiv,
        COUNT(CASE WHEN subscription_status = 'expired' THEN 1 END) as abgelaufen
      FROM dojo
      WHERE YEAR(subscription_started_at) = ?
        AND subscription_started_at IS NOT NULL
      GROUP BY MONTH(subscription_started_at)
      ORDER BY monat ASC
    `, [currentYear]);

    // 9. Vertragsverlängerungs-Rate
    const [renewalStats] = await db.promise().query(`
      SELECT
        COUNT(*) as total_expired,
        SUM(CASE
          WHEN subscription_status = 'active'
            AND subscription_ends_at < CURDATE()
          THEN 1
          ELSE 0
        END) as renewed
      FROM dojo
      WHERE subscription_ends_at IS NOT NULL
    `);

    const renewalRate = renewalStats[0].total_expired > 0
      ? Math.round((renewalStats[0].renewed / renewalStats[0].total_expired) * 100)
      : 0;

    // Response zusammenstellen
    const contracts = {
      activeContracts: activeContracts.map(c => ({
        ...c,
        subscription_start: c.subscription_start,
        subscription_end: c.subscription_end,
        trial_end: c.trial_end,
        custom_pricing: c.custom_pricing ? parseFloat(c.custom_pricing) : null
      })),
      upcomingRenewals: {
        next30Days: upcomingRenewals30.map(r => ({
          ...r,
          subscription_end: r.subscription_end,
          custom_pricing: r.custom_pricing ? parseFloat(r.custom_pricing) : null
        })),
        count60Days: parseInt(upcomingRenewals60[0].count),
        count90Days: parseInt(upcomingRenewals90[0].count)
      },
      expiredContracts: expiredContracts.map(e => ({
        ...e,
        subscription_end: e.subscription_end
      })),
      customContracts: customContracts.map(c => ({
        ...c,
        custom_pricing: parseFloat(c.custom_pricing),
        subscription_start: c.subscription_start,
        subscription_end: c.subscription_end
      })),
      contractStats: contractStats.reduce((acc, stat) => {
        acc[stat.subscription_status] = {
          anzahl: parseInt(stat.anzahl),
          custom_count: parseInt(stat.custom_count)
        };
        return acc;
      }, {}),
      trialConversions: trialConversions.map(t => ({
        ...t,
        subscription_start: t.subscription_start,
        trial_end: t.trial_end
      })),
      avgContractDuration: {
        avg_tage: avgContractDuration[0].avg_tage ? Math.round(avgContractDuration[0].avg_tage) : 0,
        min_tage: avgContractDuration[0].min_tage || 0,
        max_tage: avgContractDuration[0].max_tage || 0
      },
      monthlyContracts: monthlyContracts.map(m => ({
        monat: parseInt(m.monat),
        anzahl_vertraege: parseInt(m.anzahl_vertraege),
        aktiv: parseInt(m.aktiv),
        abgelaufen: parseInt(m.abgelaufen)
      })),
      renewalRate: renewalRate
    };

    console.log('✅ Vertragsdaten geladen', {
      activeContracts: contracts.activeContracts.length,
      upcomingRenewals: contracts.upcomingRenewals.next30Days.length,
      expiredContracts: contracts.expiredContracts.length
    });

    res.json({
      success: true,
      contracts: contracts
    });
  } catch (err) {
    console.error('❌ Fehler beim Laden der Vertragsdaten', err.message);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Vertragsdaten',
      error: err.message
    });
  }
});

// ==============================================
// GET /api/admin/users
// Benutzer-Übersicht für Super-Admin
// ==============================================
router.get('/users', requireSuperAdmin, async (req, res) => {
  try {
    // 1. Alle Admin-Benutzer laden (falls admin_users Tabelle existiert)
    let adminUsers = [];
    let userStats = {
      total: 0,
      active: 0,
      inactive: 0,
      byRole: {}
    };

    try {
      const [users] = await db.promise().query(`
        SELECT
          id,
          username,
          email,
          vorname,
          nachname,
          rolle,
          aktiv,
          email_verifiziert,
          letzter_login,
          login_versuche,
          gesperrt_bis,
          erstellt_am
        FROM admin_users
        ORDER BY erstellt_am DESC
      `);

      adminUsers = users.map(u => ({
        ...u,
        aktiv: Boolean(u.aktiv),
        email_verifiziert: Boolean(u.email_verifiziert),
        letzter_login: u.letzter_login,
        gesperrt_bis: u.gesperrt_bis,
        erstellt_am: u.erstellt_am
      }));

      // User Statistics
      userStats.total = users.length;
      userStats.active = users.filter(u => u.aktiv).length;
      userStats.inactive = users.filter(u => !u.aktiv).length;

      // By Role
      users.forEach(u => {
        if (!userStats.byRole[u.rolle]) {
          userStats.byRole[u.rolle] = 0;
        }
        userStats.byRole[u.rolle]++;
      });
    } catch (err) {
      console.log('⚠️ admin_users Tabelle nicht gefunden, nutze Fallback');
    }

    // 2. Dojo-Admin Benutzer (aus users Tabelle)
    const [dojoUsers] = await db.promise().query(`
      SELECT
        u.id as benutzer_id,
        u.username as benutzername,
        u.email,
        m.dojo_id,
        d.dojoname,
        u.created_at,
        0 as activity_last_30_days
      FROM users u
      LEFT JOIN mitglieder m ON u.mitglied_id = m.mitglied_id
      LEFT JOIN dojo d ON m.dojo_id = d.id
      WHERE u.role = 'admin'
      ORDER BY d.dojoname, u.username
    `);

    // 3. Recent Activity Log (falls vorhanden)
    let recentActivity = [];
    try {
      const [activity] = await db.promise().query(`
        SELECT
          al.id,
          al.admin_id,
          al.aktion,
          al.bereich,
          al.beschreibung,
          al.erstellt_am,
          au.username,
          au.vorname,
          au.nachname
        FROM admin_activity_log al
        JOIN admin_users au ON al.admin_id = au.id
        ORDER BY al.erstellt_am DESC
        LIMIT 50
      `);

      recentActivity = activity.map(a => ({
        ...a,
        erstellt_am: a.erstellt_am
      }));
    } catch (err) {
      console.log('⚠️ admin_activity_log Tabelle nicht gefunden');
    }

    // 4. Login-Statistiken (letzte 30 Tage)
    let loginStats = {
      total_logins: 0,
      unique_users: 0,
      avg_per_day: 0
    };

    try {
      const [logins] = await db.promise().query(`
        SELECT
          COUNT(*) as total_logins,
          COUNT(DISTINCT admin_id) as unique_users
        FROM admin_activity_log
        WHERE aktion = 'login'
          AND erstellt_am >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `);

      if (logins[0]) {
        loginStats.total_logins = parseInt(logins[0].total_logins);
        loginStats.unique_users = parseInt(logins[0].unique_users);
        loginStats.avg_per_day = Math.round(loginStats.total_logins / 30);
      }
    } catch (err) {
      console.log('⚠️ Keine Login-Statistiken verfügbar');
    }

    // 5. Benutzer nach Dojo (Gruppierung)
    const usersByDojo = {};
    dojoUsers.forEach(user => {
      const dojoName = user.dojoname || 'Unzugeordnet';
      if (!usersByDojo[dojoName]) {
        usersByDojo[dojoName] = [];
      }
      usersByDojo[dojoName].push(user);
    });

    // 6. Aktive Benutzer (letzte 7 Tage Login)
    let activeUsers = [];
    try {
      const [active] = await db.promise().query(`
        SELECT
          au.id,
          au.username,
          au.vorname,
          au.nachname,
          au.letzter_login,
          DATEDIFF(CURDATE(), DATE(au.letzter_login)) as tage_seit_login
        FROM admin_users au
        WHERE au.letzter_login >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        ORDER BY au.letzter_login DESC
      `);

      activeUsers = active.map(u => ({
        ...u,
        letzter_login: u.letzter_login
      }));
    } catch (err) {
      console.log('⚠️ Keine aktiven Benutzer-Daten verfügbar');
    }

    // Response zusammenstellen
    const users = {
      adminUsers: adminUsers,
      dojoUsers: dojoUsers,
      usersByDojo: usersByDojo,
      userStats: userStats,
      recentActivity: recentActivity,
      loginStats: loginStats,
      activeUsers: activeUsers
    };

    console.log('✅ Benutzerdaten geladen', {
      adminUsers: users.adminUsers.length,
      dojoUsers: users.dojoUsers.length,
      recentActivity: users.recentActivity.length
    });

    res.json({
      success: true,
      users: users
    });
  } catch (err) {
    console.error('❌ Fehler beim Laden der Benutzerdaten', err.message);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Benutzerdaten',
      error: err.message
    });
  }
});

module.exports = router;
