/**
 * Admin Users Routes
 * Benutzer-Übersicht für Super-Admin
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();
const { requireSuperAdmin } = require('./shared');

// GET /users - Benutzer-Übersicht
router.get('/users', requireSuperAdmin, async (req, res) => {
  try {
    let adminUsers = [];
    let userStats = { total: 0, active: 0, inactive: 0, byRole: {} };

    // 1. Admin-Benutzer laden
    try {
      const [users] = await db.promise().query(`
        SELECT id, username, email, vorname, nachname, rolle, aktiv, email_verifiziert,
          letzter_login, login_versuche, gesperrt_bis, erstellt_am
        FROM admin_users ORDER BY erstellt_am DESC
      `);

      adminUsers = users.map(u => ({
        ...u, aktiv: Boolean(u.aktiv), email_verifiziert: Boolean(u.email_verifiziert)
      }));

      userStats.total = users.length;
      userStats.active = users.filter(u => u.aktiv).length;
      userStats.inactive = users.filter(u => !u.aktiv).length;

      users.forEach(u => {
        if (!userStats.byRole[u.rolle]) userStats.byRole[u.rolle] = 0;
        userStats.byRole[u.rolle]++;
      });
    } catch (err) {
      logger.debug('admin_users Tabelle nicht gefunden, nutze Fallback');
    }

    // 2. Dojo-Admin Benutzer
    const [dojoUsers] = await db.promise().query(`
      SELECT u.id as benutzer_id, u.username as benutzername, u.email, m.dojo_id, d.dojoname, u.created_at, 0 as activity_last_30_days
      FROM users u
      LEFT JOIN mitglieder m ON u.mitglied_id = m.mitglied_id
      LEFT JOIN dojo d ON m.dojo_id = d.id
      WHERE u.role = 'admin' ORDER BY d.dojoname, u.username
    `);

    // 3. Recent Activity Log
    let recentActivity = [];
    try {
      const [activity] = await db.promise().query(`
        SELECT al.id, al.admin_id, al.aktion, al.bereich, al.beschreibung, al.erstellt_am,
          au.username, au.vorname, au.nachname
        FROM admin_activity_log al JOIN admin_users au ON al.admin_id = au.id
        ORDER BY al.erstellt_am DESC LIMIT 50
      `);
      recentActivity = activity;
    } catch (err) {}

    // 4. Login-Statistiken
    let loginStats = { total_logins: 0, unique_users: 0, avg_per_day: 0 };
    try {
      const [logins] = await db.promise().query(`
        SELECT COUNT(*) as total_logins, COUNT(DISTINCT admin_id) as unique_users
        FROM admin_activity_log WHERE aktion = 'login' AND erstellt_am >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `);
      if (logins[0]) {
        loginStats.total_logins = parseInt(logins[0].total_logins);
        loginStats.unique_users = parseInt(logins[0].unique_users);
        loginStats.avg_per_day = Math.round(loginStats.total_logins / 30);
      }
    } catch (err) {}

    // 5. Benutzer nach Dojo
    const usersByDojo = {};
    dojoUsers.forEach(user => {
      const dojoName = user.dojoname || 'Unzugeordnet';
      if (!usersByDojo[dojoName]) usersByDojo[dojoName] = [];
      usersByDojo[dojoName].push(user);
    });

    // 6. Aktive Benutzer (letzte 7 Tage)
    let activeUsers = [];
    try {
      const [active] = await db.promise().query(`
        SELECT au.id, au.username, au.vorname, au.nachname, au.letzter_login,
          DATEDIFF(CURDATE(), DATE(au.letzter_login)) as tage_seit_login
        FROM admin_users au WHERE au.letzter_login >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        ORDER BY au.letzter_login DESC
      `);
      activeUsers = active;
    } catch (err) {}

    res.json({
      success: true,
      users: { adminUsers, dojoUsers, usersByDojo, userStats, recentActivity, loginStats, activeUsers }
    });
  } catch (err) {
    logger.error('Fehler beim Laden der Benutzerdaten:', err.message);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Benutzerdaten', error: err.message });
  }
});

module.exports = router;
