// =============================================
// BACKUP ADMIN ROUTES – Super-Admin only
// Backup-Konfiguration & Verwaltung für Alfahosting
// =============================================

const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const db = require('../db');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

const pool = db.promise();

// ─── Super-Admin Guard ─────────────────────────────────────────────────────────
const requireSuperAdmin = (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Nicht autorisiert' });
  const ok = user.rolle === 'super_admin' || user.role === 'super_admin' ||
    ((user.rolle === 'admin' || user.role === 'admin') && !user.dojo_id);
  if (!ok) return res.status(403).json({ error: 'Nur Super-Admins erlaubt' });
  next();
};

router.use(authenticateToken, requireSuperAdmin);

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
function execAsync(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      if (err) reject(Object.assign(err, { stderr, stdout }));
      else resolve({ stdout, stderr });
    });
  });
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Passwort für Anzeige maskieren
function maskPassword(pwd) {
  if (!pwd || pwd.length === 0) return '';
  return '••••••••';
}

// Schreibe temporäre .netrc Datei für curl (kein Passwort in Kommandozeile)
function writeTempNetrc(host, user, pass) {
  const tmpFile = path.join(os.tmpdir(), `netrc_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(tmpFile, `machine ${host}\nlogin ${user}\npassword ${pass}\n`, { mode: 0o600 });
  return tmpFile;
}

// ─── GET /settings ─────────────────────────────────────────────────────────────
router.get('/settings', async (req, res) => {
  try {
    const [[settings]] = await pool.query('SELECT * FROM backup_remote_settings LIMIT 1');
    const [dbs] = await pool.query('SELECT * FROM backup_datenbanken ORDER BY reihenfolge, id');
    res.json({
      settings: settings ? {
        ...settings,
        passwort: settings.passwort ? maskPassword(settings.passwort) : '',
        _hasPassword: !!(settings.passwort)
      } : null,
      datenbanken: dbs.map(d => ({ ...d, db_passwort: d.db_passwort ? maskPassword(d.db_passwort) : '', _hasPassword: !!(d.db_passwort) }))
    });
  } catch (err) {
    logger.error('backup-admin GET /settings', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /settings ─────────────────────────────────────────────────────────────
router.put('/settings', async (req, res) => {
  try {
    const { name, protokoll, host, port, benutzername, passwort, remote_pfad, aufbewahrung_tage, aktiv } = req.body;
    const [[existing]] = await pool.query('SELECT id, passwort FROM backup_remote_settings LIMIT 1');

    // Passwort-Platzhalter nicht überschreiben
    const newPass = passwort && passwort !== '••••••••' ? passwort : (existing?.passwort || '');

    if (existing) {
      await pool.query(
        `UPDATE backup_remote_settings SET name=?, protokoll=?, host=?, port=?, benutzername=?,
         passwort=?, remote_pfad=?, aufbewahrung_tage=?, aktiv=?, aktualisiert_am=NOW() WHERE id=?`,
        [name || 'Alfahosting', protokoll || 'ftps', host || '', port || 21, benutzername || '',
         newPass, remote_pfad || '/backup/', aufbewahrung_tage || 30, aktiv ? 1 : 0, existing.id]
      );
    } else {
      await pool.query(
        `INSERT INTO backup_remote_settings (name, protokoll, host, port, benutzername, passwort, remote_pfad, aufbewahrung_tage, aktiv)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [name || 'Alfahosting', protokoll || 'ftps', host || '', port || 21, benutzername || '',
         newPass, remote_pfad || '/backup/', aufbewahrung_tage || 30, aktiv ? 1 : 0]
      );
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('backup-admin PUT /settings', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /datenbank/:id ────────────────────────────────────────────────────────
router.put('/datenbank/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { db_user, db_passwort, aktiv } = req.body;
    const [[existing]] = await pool.query('SELECT * FROM backup_datenbanken WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Nicht gefunden' });
    const newPass = db_passwort && db_passwort !== '••••••••' ? db_passwort : (existing.db_passwort || '');
    await pool.query(
      `UPDATE backup_datenbanken SET db_user=?, db_passwort=?, aktiv=? WHERE id=?`,
      [db_user || existing.db_user, newPass, aktiv !== undefined ? (aktiv ? 1 : 0) : existing.aktiv, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /test-connection ─────────────────────────────────────────────────────
router.post('/test-connection', async (req, res) => {
  try {
    const [[settings]] = await pool.query('SELECT * FROM backup_remote_settings LIMIT 1');
    if (!settings || !settings.host || !settings.benutzername) {
      return res.status(400).json({ error: 'Keine Verbindungseinstellungen konfiguriert' });
    }

    const netrcFile = writeTempNetrc(settings.host, settings.benutzername, settings.passwort);
    try {
      const proto = settings.protokoll === 'sftp' ? 'sftp' : 'ftp';
      const ssl = settings.protokoll === 'ftps' ? ' --ftp-ssl --insecure' : '';
      const url = `${proto}://${settings.host}:${settings.port}${settings.remote_pfad}`;
      const cmd = `curl -v --netrc-file "${netrcFile}" --connect-timeout 10 --max-time 15${ssl} "${url}" 2>&1`;
      const { stdout } = await execAsync(cmd).catch(e => ({ stdout: e.stderr || e.message }));
      const connected = stdout.includes('Connected') || stdout.includes('226') || stdout.includes('150') || stdout.includes('220');
      res.json({ success: connected, output: stdout.slice(0, 500) });
    } finally {
      try { fs.unlinkSync(netrcFile); } catch (_) {}
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Aktiven Backup-Job (in-memory, wird bei Neustart zurückgesetzt) ────────────
let activeJob = null;

// ─── POST /run ─────────────────────────────────────────────────────────────────
router.post('/run', async (req, res) => {
  if (activeJob && activeJob.running) {
    return res.status(409).json({ error: 'Ein Backup läuft bereits', runId: activeJob.runId });
  }

  try {
    const [[settings]] = await pool.query('SELECT * FROM backup_remote_settings WHERE aktiv = 1 LIMIT 1');
    if (!settings || !settings.host) {
      return res.status(400).json({ error: 'Kein aktives Backup-Ziel konfiguriert' });
    }

    const [dbs] = await pool.query('SELECT * FROM backup_datenbanken WHERE aktiv = 1 ORDER BY reihenfolge, id');

    // Backup-Run in DB anlegen
    const [runResult] = await pool.query(
      `INSERT INTO backup_runs (typ, status, gestartet_am) VALUES ('manuell','laeuft',NOW())`
    );
    const runId = runResult.insertId;

    res.json({ success: true, runId, message: 'Backup gestartet' });

    // Asynchron im Hintergrund ausführen
    activeJob = { runId, running: true };
    runBackupJob(runId, settings, dbs).finally(() => { activeJob = null; });

  } catch (err) {
    logger.error('backup-admin POST /run', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

async function runBackupJob(runId, settings, dbs) {
  const tmpDir = path.join(os.tmpdir(), `dojo_backup_${runId}_${Date.now()}`);
  const netrcFile = writeTempNetrc(settings.host, settings.benutzername, settings.passwort);
  const log = [];
  let totalBytes = 0;
  const details = { datenbanken: [] };

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    // ── 1. Datenbanken sichern ──
    for (const db of dbs) {
      const filename = `${db.db_name}_${ts}.sql.gz`;
      const filepath = path.join(tmpDir, filename);
      const user = db.db_user || process.env.DB_USER;
      const pass = db.db_passwort || process.env.DB_PASSWORD;
      const host = db.db_host || 'localhost';

      log.push(`Sichere Datenbank: ${db.db_name}...`);
      try {
        await execAsync(
          `mysqldump --single-transaction --quick --no-tablespaces ` +
          `-h "${host}" -u "${user}" "-p${pass}" "${db.db_name}" | gzip > "${filepath}"`
        );
        const stat = fs.statSync(filepath);
        totalBytes += stat.size;
        log.push(`  ✓ ${db.db_name} (${formatBytes(stat.size)})`);
        details.datenbanken.push({ name: db.db_name, datei: filename, groesse: stat.size, status: 'ok' });
      } catch (dbErr) {
        log.push(`  ✗ ${db.db_name}: ${dbErr.message}`);
        details.datenbanken.push({ name: db.db_name, status: 'fehler', fehler: dbErr.message });
      }
    }

    // ── 2. Dateien auf Alfahosting hochladen ──
    log.push(`\nLade ${details.datenbanken.filter(d => d.status === 'ok').length} Dateien hoch...`);
    const proto = settings.protokoll === 'sftp' ? 'sftp' : 'ftp';
    const ssl = settings.protokoll === 'ftps' ? ' --ftp-ssl --insecure' : '';
    let uploadFehler = 0;

    for (const dbDetail of details.datenbanken.filter(d => d.status === 'ok')) {
      const filepath = path.join(tmpDir, dbDetail.datei);
      const remoteUrl = `${proto}://${settings.host}:${settings.port}${settings.remote_pfad}${dbDetail.datei}`;
      try {
        await execAsync(
          `curl -s --netrc-file "${netrcFile}" --connect-timeout 30 --max-time 300${ssl} -T "${filepath}" "${remoteUrl}"`
        );
        log.push(`  ✓ ${dbDetail.datei} hochgeladen`);
        dbDetail.hochgeladen = true;
      } catch (uploadErr) {
        log.push(`  ✗ Upload ${dbDetail.datei}: ${uploadErr.message}`);
        dbDetail.hochgeladen = false;
        uploadFehler++;
      }
    }

    // ── 3. Alte Backups auf Server aufräumen ──
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (settings.aufbewahrung_tage || 30));
      const cutoffStr = cutoff.toISOString().slice(0, 10).replace(/-/g, '-');
      log.push(`\nAufräumen: Backups älter als ${settings.aufbewahrung_tage} Tage werden gelöscht`);
      // Alte lokale Backups in /var/backups/dojosoftware aufräumen
      await execAsync(`find /var/backups/dojosoftware -name "*.sql.gz" -mtime +${settings.aufbewahrung_tage} -delete 2>/dev/null || true`);
    } catch (_) {}

    const status = uploadFehler === 0 ? 'erfolg' : (uploadFehler < details.datenbanken.length ? 'erfolg' : 'fehler');
    details.log = log.join('\n');
    await pool.query(
      `UPDATE backup_runs SET status=?, beendet_am=NOW(), details=?, groesse_bytes=? WHERE id=?`,
      [status, JSON.stringify(details), totalBytes, runId]
    );
    logger.info(`✅ Backup #${runId} abgeschlossen`, { status, groesse: formatBytes(totalBytes) });

  } catch (err) {
    logger.error(`❌ Backup #${runId} fehlgeschlagen`, { error: err.message });
    await pool.query(
      `UPDATE backup_runs SET status='fehler', beendet_am=NOW(), fehler_text=?, details=? WHERE id=?`,
      [err.message, JSON.stringify({ ...details, log: log.join('\n') }), runId]
    );
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    try { fs.unlinkSync(netrcFile); } catch (_) {}
  }
}

// ─── GET /status ───────────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const [[lastRun]] = await pool.query(
      `SELECT * FROM backup_runs ORDER BY gestartet_am DESC LIMIT 1`
    );
    const [[successRun]] = await pool.query(
      `SELECT * FROM backup_runs WHERE status='erfolg' ORDER BY gestartet_am DESC LIMIT 1`
    );
    const [localFiles] = await pool.query(
      `SELECT COUNT(*) as cnt, SUM(groesse_bytes) as total FROM backup_runs WHERE status='erfolg'`
    ).catch(() => [[{ cnt: 0, total: 0 }]]);

    // Lokale Backup-Größe ermitteln
    let localSize = '–';
    try {
      const { stdout } = await execAsync('du -sh /var/backups/dojosoftware 2>/dev/null || echo "0"');
      localSize = stdout.trim().split('\t')[0] || '–';
    } catch (_) {}

    res.json({
      letzterRun: lastRun || null,
      letzterErfolg: successRun || null,
      aktuellLaufend: activeJob?.running ? activeJob.runId : null,
      lokaleGroesse: localSize
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /history ──────────────────────────────────────────────────────────────
router.get('/history', async (req, res) => {
  try {
    const [runs] = await pool.query(
      `SELECT id, typ, status, gestartet_am, beendet_am, groesse_bytes, fehler_text,
       JSON_EXTRACT(details, '$.datenbanken') as datenbanken_json
       FROM backup_runs ORDER BY gestartet_am DESC LIMIT 20`
    );
    res.json({ runs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /local-files ─────────────────────────────────────────────────────────
router.get('/local-files', async (req, res) => {
  try {
    const { stdout } = await execAsync(
      `ls -lh /var/backups/dojosoftware/full/ 2>/dev/null | tail -20 || echo ""`
    );
    const lines = stdout.trim().split('\n').filter(l => l && !l.startsWith('total'));
    const files = lines.map(l => {
      const parts = l.trim().split(/\s+/);
      return { groesse: parts[4] || '?', datum: parts.slice(5, 8).join(' '), name: parts[8] || '' };
    }).filter(f => f.name);
    res.json({ files });
  } catch (err) {
    res.json({ files: [] });
  }
});

module.exports = router;
