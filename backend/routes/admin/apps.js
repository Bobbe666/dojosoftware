/**
 * Admin Apps Route
 * Übersicht und Status-Monitoring aller TDA-Apps und Dienste
 */
const express = require('express');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const bcrypt = require('bcrypt');
const router = express.Router();
const { requireSuperAdmin } = require('./shared');
const db = require('../../db');

// Registry aller TDA-Apps — statisch gepflegt
const APP_REGISTRY = [
  {
    id: 'dojo',
    name: 'DojoSoftware',
    short: 'Kampfkunstschule-Management',
    url: 'https://dojo.tda-intl.org',
    adminUrl: 'https://dojo.tda-intl.org',
    icon: '🥋',
    category: 'saas',
    tech: { frontend: 'React/Vite', backend: 'Node.js', db: 'MySQL' },
    pm2: 'dojosoftware-backend',
    port: 5001,
    localPath: '/Users/schreinersascha/dojosoftware',
    serverPath: '/var/www/dojosoftware-source',
    deploy: './deploy.sh',
    notes: 'Multi-Tenant SaaS für Kampfkunstschulen',
  },
  {
    id: 'events',
    name: 'TDA Tournament Center',
    short: 'Turnierverwaltung & Live-Scoring',
    url: 'https://events.tda-intl.org',
    adminUrl: 'https://events.tda-intl.org/dashboard',
    icon: '🏆',
    category: 'platform',
    tech: { frontend: 'React/CRA', backend: 'Node.js', db: 'MySQL' },
    pm2: 'tdasoftware-backend',
    port: 5002,
    localPath: '/Users/schreinersascha/tda-events',
    serverPath: '/var/www/tda-events-source',
    deploy: './deploy.sh',
    notes: 'TDA Events-Plattform — Turniere, Anmeldungen, Scoring, Ranglisten',
  },
  {
    id: 'live',
    name: 'TDA Live',
    short: 'Live-Turnieransicht (öffentlich)',
    url: 'https://live.tda-intl.org',
    icon: '📺',
    category: 'pwa',
    tech: { frontend: 'React/Vite PWA', backend: '— (nutzt events API)' },
    pm2: null,
    port: null,
    localPath: '/Users/schreinersascha/live-tda',
    serverPath: '/var/www/live-tda',
    deploy: './deploy.sh',
    notes: 'Öffentliche PWA — Matten, Startliste, Suche — kein Login',
  },
  {
    id: 'my',
    name: 'Mein TDA',
    short: 'Trainer & Athleten Portal',
    url: 'https://my.tda-intl.org',
    icon: '👤',
    category: 'pwa',
    tech: { frontend: 'React/Vite PWA', backend: '— (nutzt events API)' },
    pm2: null,
    port: null,
    localPath: '/Users/schreinersascha/my-tda',
    serverPath: '/var/www/my-tda',
    deploy: './deploy.sh',
    notes: 'PWA für Trainer (Login) und Athleten (PIN/QR) — Live-Kämpfe, PIN-Verwaltung',
  },
  {
    id: 'hof',
    name: 'Hall of Fame',
    short: 'TDA Ehrungen & Ranglisten',
    url: 'https://hof.tda-intl.org',
    adminUrl: 'https://hof.tda-intl.org/admin',
    icon: '🏅',
    category: 'platform',
    tech: { frontend: 'React/Vite', backend: 'Node.js', db: 'MySQL' },
    pm2: 'hofsoftware-backend',
    port: 5003,
    localPath: '/var/www/hofsoftware',
    serverPath: '/var/www/hofsoftware',
    deploy: 'Direkt auf Server bauen + PM2 restart',
    notes: 'HOF-Datenbank — Athleten, Ranglisten, Auszeichnungen',
  },
  {
    id: 'kids',
    name: 'Familien Sternchen',
    short: 'Kinder-Fortschritts-App',
    url: 'https://kids.tda-intl.org',
    icon: '⭐',
    category: 'platform',
    tech: { frontend: 'React/CRA', backend: 'Node.js', db: 'MySQL' },
    pm2: 'kids-backend',
    port: 5005,
    localPath: '/Users/schreinersascha/kids-app',
    serverPath: '/var/www/kids-app',
    deploy: './deploy.sh',
    notes: 'Kinder-App — Gürtelprüfungen, Avatare, Eltern-Portal, PIN-Login',
  },
  {
    id: 'checkin',
    name: 'Check-in App',
    short: 'Turnier-Eincheck-System',
    url: 'https://checkin.tda-intl.org',
    icon: '✅',
    category: 'platform',
    tech: { frontend: 'React', backend: '—' },
    pm2: null,
    port: null,
    localPath: '/Users/schreinersascha/checkin-app',
    serverPath: '/var/www/checkin-app',
    deploy: './deploy.sh',
    notes: 'Eigenständige App — NIEMALS mit DojoSoftware-Build überschreiben',
  },
  {
    id: 'tda-intl-com',
    name: 'TDA International',
    short: 'Hauptwebsite für Mitglieder & Athleten',
    url: 'https://www.tda-intl.com',
    icon: '🌍',
    category: 'website',
    tech: { frontend: 'React/Vite', backend: '— (nutzt Dojo API)' },
    pm2: null,
    port: null,
    localPath: '/Users/schreinersascha/tda-websites/tda-intl/frontend',
    serverPath: '/var/www/tda-intl',
    deploy: './deploy.sh frontend',
    notes: 'Mitglieder-Portal, News, Events, Hall of Fame, Prüfungen',
  },
  {
    id: 'tda-intl-org',
    name: 'TDA Systems',
    short: 'B2B Landingpage',
    url: 'https://www.tda-intl.org',
    icon: '🏢',
    category: 'website',
    tech: { frontend: 'Static HTML/CSS/JS' },
    pm2: null,
    port: null,
    localPath: '/Users/schreinersascha/tda-websites/tda-intl-landing',
    serverPath: '/var/www/tda-intl.org',
    deploy: 'rsync direkt',
    notes: 'Statische Landingpage für DojoSoftware & Tournament-Center SaaS',
  },
  {
    id: 'academy',
    name: 'TDA Academy',
    short: 'Online-Lernplattform',
    url: 'https://academy.tda-intl.org',
    icon: '🎓',
    category: 'website',
    tech: { frontend: 'Extern/LMS' },
    pm2: null,
    port: null,
    localPath: null,
    serverPath: null,
    deploy: null,
    notes: 'Externe Lernplattform — nicht in diesem Repo',
  },
  {
    id: 'msg',
    name: 'Dojo MSG',
    short: 'Team-Chat & Messenger für Mitglieder',
    url: 'https://msg.dojo.tda-intl.org',
    icon: '💬',
    category: 'pwa',
    tech: { frontend: 'React/Vite PWA', backend: '— (nutzt Dojo API)' },
    pm2: null,
    port: null,
    localPath: '/Users/schreinersascha/msg-app',
    serverPath: '/var/www/msg-app',
    deploy: './deploy.sh',
    notes: 'WhatsApp-Style Messaging für Admin, Trainer & Mitglieder — Token-basierter Login',
  },
  {
    id: 'todo',
    name: 'TDA To Do',
    short: 'Aufgaben für Trainer, Büro & Team',
    url: 'https://todo.tda-intl.org',
    icon: '✅',
    category: 'pwa',
    tech: { frontend: 'React/Vite PWA', backend: '— (nutzt Dojo API)' },
    pm2: null,
    port: null,
    localPath: '/Users/schreinersascha/todo-app',
    serverPath: '/var/www/todo-app',
    deploy: './deploy.sh',
    notes: 'Standalone PWA — Apple Notes Integration via Web Share Target. Zugriffsrechte pro Nutzer verwaltbar.',
    hasAccessManagement: true,
  },
];

// Hilfsfunktion: HTTP/HTTPS HEAD-Request mit Timeout
function pingUrl(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'HEAD', timeout: timeoutMs }, (res) => {
      resolve({ status: res.statusCode, ms: Date.now() - start });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, ms: timeoutMs, error: 'timeout' });
    });
    req.on('error', (err) => {
      resolve({ status: 0, ms: Date.now() - start, error: err.message });
    });
    req.end();
  });
}

// Hilfsfunktion: PM2 Prozessliste holen
function getPm2List() {
  return new Promise((resolve) => {
    exec('pm2 jlist', { timeout: 8000 }, (err, stdout) => {
      if (err) return resolve([]);
      try {
        const list = JSON.parse(stdout);
        resolve(list);
      } catch {
        resolve([]);
      }
    });
  });
}

// GET /api/admin/apps — Alle Apps mit Live-Status
router.get('/apps', requireSuperAdmin, async (req, res) => {
  try {
    // Alle Apps parallel pingen
    const pingResults = await Promise.all(
      APP_REGISTRY.map(app => pingUrl(app.url))
    );

    // PM2-Prozessliste holen
    const pm2List = await getPm2List();
    const pm2Map = {};
    for (const proc of pm2List) {
      pm2Map[proc.name] = {
        pid: proc.pid,
        status: proc.pm2_env?.status,
        uptime: proc.pm2_env?.pm_uptime,
        restarts: proc.pm2_env?.restart_time,
        memory: proc.monit?.memory,
        cpu: proc.monit?.cpu,
        id: proc.pm_id,
      };
    }

    const apps = APP_REGISTRY.map((app, i) => {
      const ping = pingResults[i];
      const pm2 = app.pm2 ? (pm2Map[app.pm2] || null) : null;
      return {
        ...app,
        httpStatus: ping.status,
        responseMs: ping.ms,
        online: ping.status >= 200 && ping.status < 400,
        pm2: pm2,
      };
    });

    res.json({ success: true, apps });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/apps/pm2 — Nur PM2 Liste (für Refresh ohne Pings)
router.get('/apps/pm2', requireSuperAdmin, async (req, res) => {
  try {
    const pm2List = await getPm2List();
    res.json({ success: true, pm2: pm2List });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/app-access — Alle Nutzer mit allen App-Zugriffsflags
router.get('/app-access', requireSuperAdmin, async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT au.id, au.vorname, au.nachname, au.email, au.username, au.rolle, au.dojo_id,
             COALESCE(au.todo_app_access, 1)   AS todo_app_access,
             COALESCE(au.events_app_access, 1) AS events_app_access,
             COALESCE(au.kids_app_access, 1)   AS kids_app_access,
             COALESCE(au.hof_app_access, 1)    AS hof_app_access,
             d.dojoname
      FROM admin_users au
      LEFT JOIN dojo d ON d.id = au.dojo_id
      WHERE au.aktiv = 1
      ORDER BY d.dojoname, au.nachname, au.vorname
    `);
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backward-compat alias
router.get('/todo-access', requireSuperAdmin, async (req, res) => {
  res.redirect(307, '/api/admin/app-access');
});

// PATCH /api/admin/app-access/:id — App-Zugriff für einen Nutzer setzen
// Body: { app: 'todo'|'events'|'kids'|'hof', access: 0|1 }
const ALLOWED_APP_COLS = {
  todo:   'todo_app_access',
  events: 'events_app_access',
  kids:   'kids_app_access',
  hof:    'hof_app_access',
};
router.patch('/app-access/:id', requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { app, access } = req.body;
  const col = ALLOWED_APP_COLS[app];
  if (!col) return res.status(400).json({ error: 'Unbekannte App.' });
  try {
    await db.promise().query(`UPDATE admin_users SET ${col} = ? WHERE id = ?`, [access ? 1 : 0, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backward-compat alias
router.patch('/todo-access/:id', requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { access } = req.body;
  try {
    await db.promise().query('UPDATE admin_users SET todo_app_access = ? WHERE id = ?', [access ? 1 : 0, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/todo-access/:id — Nutzer deaktivieren
router.delete('/todo-access/:id', requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.promise().query(
      'UPDATE admin_users SET aktiv = 0 WHERE id = ?',
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/todo-dojos — Alle aktiven Dojos (für Nutzer-Erstellung)
router.get('/todo-dojos', requireSuperAdmin, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      'SELECT id, dojoname FROM dojo WHERE ist_aktiv = 1 ORDER BY dojoname'
    );
    res.json({ dojos: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/todo-access — Neuen Nutzer für To Do anlegen
router.post('/todo-access', requireSuperAdmin, async (req, res) => {
  const { vorname, nachname, username, email, password, rolle, dojo_id } = req.body;
  if (!username || !password || !vorname || !nachname) {
    return res.status(400).json({ error: 'Vorname, Nachname, Benutzername und Passwort sind Pflichtfelder.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben.' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.promise().query(
      `INSERT INTO admin_users (username, email, vorname, nachname, rolle, password, password_algorithm, dojo_id, aktiv, todo_app_access)
       VALUES (?, ?, ?, ?, ?, ?, 'bcrypt', ?, 1, 1)`,
      [username, email || null, vorname, nachname, rolle || 'eingeschraenkt', hashedPassword, dojo_id || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Benutzername oder E-Mail bereits vergeben.' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
