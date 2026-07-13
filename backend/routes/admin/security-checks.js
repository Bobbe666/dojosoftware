/**
 * Admin Security & Integrity Checks
 * Read-only Selbst-Diagnose für das Lizenzen-Dashboard (Super-Admin).
 * Prüft Mandanten-Trennung, Subdomain-Integrität, Modul-/Endpoint-Health
 * und Config-Vollständigkeit. Wird von der Route UND vom täglichen Cron genutzt.
 *
 * WICHTIG: ALLES läuft SEQUENZIELL (nie parallel), damit der DB-Connection-Pool
 * nicht erschöpft wird (sonst „Queue limit reached" → Kaskade von 500ern).
 */
const express = require('express');
const http = require('http');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');
const { requireSuperAdmin } = require('./shared');

const q = (sql, params = []) => new Promise((resolve, reject) => {
  db.query(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

// Eine COUNT-Prüfung ausführen → einheitliches Result-Objekt.
// statusFn(count) → 'ok' | 'warn' | 'fail'. Query-Fehler → 'error' (z.B. Schema-Drift).
async function countCheck({ id, label, sql, statusFn, detailFn }) {
  try {
    const rows = await q(sql);
    const n = Number(rows[0]?.n ?? 0);
    return { id, label, status: statusFn(n), value: n, detail: detailFn ? detailFn(n) : null };
  } catch (e) {
    return { id, label, status: 'error', value: null, detail: `Query-Fehler: ${e.code || e.message}` };
  }
}

// Definitions-Array sequenziell abarbeiten (kein Promise.all → schont den Pool).
async function runSeq(defs) {
  const out = [];
  for (const d of defs) out.push(await countCheck(d));
  return out;
}

const failIfNonZero = (n) => (n > 0 ? 'fail' : 'ok');
const warnIfNonZero = (n) => (n > 0 ? 'warn' : 'ok');

// ── 1) MANDANTEN-TRENNUNG ─────────────────────────────────────────────────
async function runTenantChecks() {
  const checks = await runSeq([
    { id: 'xt_mitglied_stil', label: 'Mitglied-Stil-Zuordnungen bei fremdem Dojo',
      sql: `SELECT COUNT(*) n FROM mitglied_stil_data msd
            JOIN mitglieder m ON m.mitglied_id = msd.mitglied_id
            JOIN stile s ON s.stil_id = msd.stil_id
            WHERE m.dojo_id <> s.dojo_id`,
      statusFn: failIfNonZero,
      detailFn: (n) => n > 0 ? `${n} Zuordnung(en) zeigen auf einen Stil eines anderen Dojos` : 'Sauber getrennt' },
    { id: 'xt_pruefungen', label: 'Prüfungen bei fremdem Dojo (via Graduierung/Stil)',
      sql: `SELECT COUNT(*) n FROM pruefungen p
            JOIN mitglieder m ON m.mitglied_id = p.mitglied_id
            JOIN graduierungen g ON g.graduierung_id = p.graduierung_nachher_id
            JOIN stile s ON s.stil_id = g.stil_id
            WHERE m.dojo_id <> s.dojo_id`,
      statusFn: failIfNonZero },
    { id: 'graduierung_orphan', label: 'Verwaiste Graduierungen (Stil fehlt / ohne dojo_id)',
      sql: `SELECT COUNT(*) n FROM graduierungen g
            LEFT JOIN stile s ON s.stil_id = g.stil_id
            WHERE s.stil_id IS NULL OR s.dojo_id IS NULL`,
      statusFn: failIfNonZero },
    { id: 'xt_vertraege', label: 'Verträge: Vertrag-Dojo ≠ Mitglied-Dojo',
      sql: `SELECT COUNT(*) n FROM vertraege v JOIN mitglieder m ON m.mitglied_id = v.mitglied_id
            WHERE v.dojo_id IS NOT NULL AND v.dojo_id <> m.dojo_id`,
      statusFn: warnIfNonZero },
    { id: 'xt_rechnungen', label: 'Rechnungen: Rechnung-Dojo ≠ Mitglied-Dojo',
      sql: `SELECT COUNT(*) n FROM rechnungen r JOIN mitglieder m ON m.mitglied_id = r.mitglied_id
            WHERE r.dojo_id IS NOT NULL AND r.dojo_id <> m.dojo_id`,
      statusFn: warnIfNonZero },
    { id: 'xt_beitraege', label: 'Beiträge: Beitrag-Dojo ≠ Mitglied-Dojo',
      sql: `SELECT COUNT(*) n FROM beitraege b JOIN mitglieder m ON m.mitglied_id = b.mitglied_id
            WHERE b.dojo_id IS NOT NULL AND b.dojo_id <> m.dojo_id`,
      statusFn: warnIfNonZero },
    { id: 'null_stile', label: 'Stile ohne dojo_id (unzugeordnet)',
      sql: `SELECT COUNT(*) n FROM stile WHERE dojo_id IS NULL`, statusFn: warnIfNonZero },
    { id: 'null_kurse', label: 'Kurse ohne dojo_id',
      sql: `SELECT COUNT(*) n FROM kurse WHERE dojo_id IS NULL`, statusFn: warnIfNonZero },
    { id: 'null_tarife', label: 'Tarife ohne dojo_id',
      sql: `SELECT COUNT(*) n FROM tarife WHERE dojo_id IS NULL`, statusFn: warnIfNonZero },
  ]);
  return { key: 'tenant', title: 'Mandanten-Trennung', checks };
}

// ── 2) SUBDOMAIN-INTEGRITÄT ───────────────────────────────────────────────
async function runSubdomainChecks() {
  const checks = await runSeq([
    { id: 'sub_duplicate', label: 'Doppelte Subdomains',
      sql: `SELECT COUNT(*) n FROM (
              SELECT subdomain FROM dojo WHERE subdomain IS NOT NULL AND subdomain <> ''
              GROUP BY subdomain HAVING COUNT(*) > 1) x`,
      statusFn: failIfNonZero,
      detailFn: (n) => n > 0 ? `${n} Subdomain(s) mehrfach vergeben — führt zu falscher Zuordnung!` : 'Alle Subdomains eindeutig' },
    { id: 'sub_missing', label: 'Aktive Dojos ohne Subdomain',
      sql: `SELECT COUNT(*) n FROM dojo WHERE ist_aktiv = 1 AND (subdomain IS NULL OR subdomain = '')`,
      statusFn: warnIfNonZero },
  ]);
  return { key: 'subdomain', title: 'Subdomain-Integrität', checks };
}

// ── 3) CONFIG-VOLLSTÄNDIGKEIT (pro Dojo) ──────────────────────────────────
async function runConfigChecks() {
  const checks = [];
  try {
    const dojos = await q(
      `SELECT id, dojoname, sepa_glaeubiger_id, steuernummer, ust_id,
              lastschrift_aktiv, bank_iban, iban
       FROM dojo WHERE ist_aktiv = 1 ORDER BY id`
    );
    const clean = (v) => (v === null || v === undefined || String(v).trim() === '');
    const issues = [];
    for (const d of dojos) {
      const missing = [];
      const lsAktiv = Number(d.lastschrift_aktiv) === 1;
      if (lsAktiv && clean(d.sepa_glaeubiger_id)) missing.push('SEPA-Gläubiger-ID');
      if (lsAktiv && clean(d.bank_iban) && clean(d.iban)) missing.push('Bank-IBAN');
      if (clean(d.steuernummer) && clean(d.ust_id)) missing.push('Steuernummer/USt-IdNr');
      if (missing.length) issues.push(`${d.dojoname} (#${d.id}): ${missing.join(', ')}`);
    }
    checks.push({
      id: 'cfg_completeness', label: 'Dojos mit unvollständiger Finanz-/Steuer-Config',
      status: issues.length > 0 ? 'warn' : 'ok', value: issues.length,
      detail: issues.length > 0 ? issues.join(' · ') : 'Alle aktiven Dojos vollständig konfiguriert',
    });
  } catch (e) {
    checks.push({ id: 'cfg_completeness', label: 'Config-Vollständigkeit', status: 'error', value: null, detail: `Query-Fehler: ${e.code || e.message}` });
  }
  return { key: 'config', title: 'Config-Vollständigkeit', checks };
}

// ── 4) MODUL-/ENDPOINT-HEALTH (interner Selbst-Ping, SEQUENZIELL) ──────────
// NUR leichtgewichtige Endpunkte pingen. Schwere Aggregat-Endpunkte (auswertungen/complete,
// buchhaltung/offene-posten, dashboard/batch) sind bewusst NICHT dabei: sie halten eine
// DB-Verbindung lange und würden bei jedem Health-Check unnötig Last erzeugen (Pool-Risiko).
const HEALTH_ENDPOINTS = [
  ['Mitglieder', '/api/mitglieder?limit=1'],
  ['Kurse', '/api/kurse'],
  ['Stile', '/api/stile'],
  ['Tarife', '/api/tarife'],
  ['Verträge', '/api/vertraege'],
  ['Rechnungen', '/api/rechnungen'],
  ['Mahnwesen', '/api/mahnwesen/mahnungen'],
  ['Verkäufe', '/api/verkaeufe'],
  ['Notifications', '/api/notifications/dashboard'],
];

function pingInternal(path, authHeader) {
  return new Promise((resolve) => {
    const port = process.env.PORT || 5001;
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'GET', headers: authHeader ? { Authorization: authHeader } : {}, timeout: 6000 },
      (res) => { res.on('data', () => {}); res.on('end', () => resolve(res.statusCode)); }
    );
    req.on('error', () => resolve(0));
    req.on('timeout', () => { req.destroy(); resolve(-1); });
    req.end();
  });
}

async function runHealthChecks(authHeader) {
  const checks = [];
  // SEQUENZIELL — nie mehr als 1 interner Request gleichzeitig (schont den DB-Pool!)
  for (const [label, path] of HEALTH_ENDPOINTS) {
    const code = await pingInternal(path, authHeader);
    const status = (code >= 500 || code === 0 || code === -1) ? 'fail' : 'ok';
    checks.push({ id: 'health_' + path.replace(/[^a-z0-9]/gi, '_'), label, status, value: code, detail: `HTTP ${code === -1 ? 'Timeout' : code} · ${path}` });
  }
  return { key: 'health', title: 'Modul-/Endpoint-Health', checks };
}

// ── Orchestrator (SEQUENZIELL über die Kategorien) ────────────────────────
async function runSecurityChecks(authHeader) {
  const categories = [];
  categories.push(await runTenantChecks());
  categories.push(await runSubdomainChecks());
  categories.push(await runHealthChecks(authHeader));
  categories.push(await runConfigChecks());

  const all = categories.flatMap(c => c.checks);
  const summary = {
    total: all.length,
    ok: all.filter(c => c.status === 'ok').length,
    warn: all.filter(c => c.status === 'warn').length,
    fail: all.filter(c => c.status === 'fail').length,
    error: all.filter(c => c.status === 'error').length,
  };
  summary.overall = (summary.fail > 0 || summary.error > 0) ? 'fail'
    : (summary.warn > 0 ? 'warn' : 'ok');
  return { generated_at: new Date().toISOString(), summary, categories };
}

// GET /api/admin/security-checks — on-demand (Super-Admin)
router.get('/security-checks', requireSuperAdmin, async (req, res) => {
  try {
    const result = await runSecurityChecks(req.headers.authorization);
    res.json({ success: true, ...result });
  } catch (e) {
    logger.error('Security-Checks fehlgeschlagen:', { error: e.message });
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
module.exports.runSecurityChecks = runSecurityChecks;
