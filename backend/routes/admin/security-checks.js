/**
 * Admin Security & Integrity Checks
 * Read-only Selbst-Diagnose für das Lizenzen-Dashboard (Super-Admin).
 * Prüft Mandanten-Trennung, Subdomain-Integrität, Modul-/Endpoint-Health
 * und Config-Vollständigkeit. Wird von der Route UND vom täglichen Cron genutzt.
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

// Ein Check ausführen und in ein einheitliches Result-Objekt verpacken.
// statusFn(count) → 'ok' | 'warn' | 'fail'. Query-Fehler → status 'error' (z.B. Schema-Drift).
async function countCheck({ id, label, sql, statusFn, detailFn }) {
  try {
    const rows = await q(sql);
    const n = Number(rows[0]?.n ?? 0);
    return { id, label, status: statusFn(n), value: n, detail: detailFn ? detailFn(n) : null };
  } catch (e) {
    return { id, label, status: 'error', value: null, detail: `Query-Fehler: ${e.code || e.message}` };
  }
}

// ── 1) MANDANTEN-TRENNUNG ─────────────────────────────────────────────────
async function runTenantChecks() {
  const failIfNonZero = (n) => (n > 0 ? 'fail' : 'ok');
  const warnIfNonZero = (n) => (n > 0 ? 'warn' : 'ok');

  const checks = await Promise.all([
    // Kern-Trennung (muss 0 sein) — die aktiv gebaute Isolation
    countCheck({
      id: 'xt_mitglied_stil', label: 'Mitglied-Stil-Zuordnungen bei fremdem Dojo',
      sql: `SELECT COUNT(*) n FROM mitglied_stil_data msd
            JOIN mitglieder m ON m.mitglied_id = msd.mitglied_id
            JOIN stile s ON s.stil_id = msd.stil_id
            WHERE m.dojo_id <> s.dojo_id`,
      statusFn: failIfNonZero,
      detailFn: (n) => n > 0 ? `${n} Zuordnung(en) zeigen auf einen Stil eines anderen Dojos` : 'Sauber getrennt',
    }),
    countCheck({
      id: 'xt_pruefungen', label: 'Prüfungen bei fremdem Dojo (via Graduierung/Stil)',
      sql: `SELECT COUNT(*) n FROM pruefungen p
            JOIN mitglieder m ON m.mitglied_id = p.mitglied_id
            JOIN graduierungen g ON g.graduierung_id = p.graduierung_nachher_id
            JOIN stile s ON s.stil_id = g.stil_id
            WHERE m.dojo_id <> s.dojo_id`,
      statusFn: failIfNonZero,
    }),
    countCheck({
      id: 'graduierung_orphan', label: 'Verwaiste Graduierungen (Stil fehlt / ohne dojo_id)',
      sql: `SELECT COUNT(*) n FROM graduierungen g
            LEFT JOIN stile s ON s.stil_id = g.stil_id
            WHERE s.stil_id IS NULL OR s.dojo_id IS NULL`,
      statusFn: failIfNonZero,
    }),
    // Finanz-/Vertrags-Zuordnungen (warn: meist interne Fehlablage, prüfen)
    countCheck({
      id: 'xt_vertraege', label: 'Verträge: Vertrag-Dojo ≠ Mitglied-Dojo',
      sql: `SELECT COUNT(*) n FROM vertraege v JOIN mitglieder m ON m.mitglied_id = v.mitglied_id
            WHERE v.dojo_id IS NOT NULL AND v.dojo_id <> m.dojo_id`,
      statusFn: warnIfNonZero,
    }),
    countCheck({
      id: 'xt_rechnungen', label: 'Rechnungen: Rechnung-Dojo ≠ Mitglied-Dojo',
      sql: `SELECT COUNT(*) n FROM rechnungen r JOIN mitglieder m ON m.mitglied_id = r.mitglied_id
            WHERE r.dojo_id IS NOT NULL AND r.dojo_id <> m.dojo_id`,
      statusFn: warnIfNonZero,
    }),
    countCheck({
      id: 'xt_beitraege', label: 'Beiträge: Beitrag-Dojo ≠ Mitglied-Dojo',
      sql: `SELECT COUNT(*) n FROM beitraege b JOIN mitglieder m ON m.mitglied_id = b.mitglied_id
            WHERE b.dojo_id IS NOT NULL AND b.dojo_id <> m.dojo_id`,
      statusFn: warnIfNonZero,
    }),
    // Unzugeordnete Zeilen (warn) auf getrennten Tabellen
    countCheck({
      id: 'null_stile', label: 'Stile ohne dojo_id (unzugeordnet)',
      sql: `SELECT COUNT(*) n FROM stile WHERE dojo_id IS NULL`, statusFn: warnIfNonZero,
    }),
    countCheck({
      id: 'null_kurse', label: 'Kurse ohne dojo_id',
      sql: `SELECT COUNT(*) n FROM kurse WHERE dojo_id IS NULL`, statusFn: warnIfNonZero,
    }),
    countCheck({
      id: 'null_tarife', label: 'Tarife ohne dojo_id',
      sql: `SELECT COUNT(*) n FROM tarife WHERE dojo_id IS NULL`, statusFn: warnIfNonZero,
    }),
  ]);

  return { key: 'tenant', title: 'Mandanten-Trennung', checks };
}

// ── 2) SUBDOMAIN-INTEGRITÄT ───────────────────────────────────────────────
async function runSubdomainChecks() {
  const checks = await Promise.all([
    countCheck({
      id: 'sub_duplicate', label: 'Doppelte Subdomains',
      sql: `SELECT COUNT(*) n FROM (
              SELECT subdomain FROM dojo WHERE subdomain IS NOT NULL AND subdomain <> ''
              GROUP BY subdomain HAVING COUNT(*) > 1) x`,
      statusFn: (n) => (n > 0 ? 'fail' : 'ok'),
      detailFn: (n) => n > 0 ? `${n} Subdomain(s) mehrfach vergeben — führt zu falscher Zuordnung!` : 'Alle Subdomains eindeutig',
    }),
    countCheck({
      id: 'sub_missing', label: 'Aktive Dojos ohne Subdomain',
      sql: `SELECT COUNT(*) n FROM dojo WHERE ist_aktiv = 1 AND (subdomain IS NULL OR subdomain = '')`,
      statusFn: (n) => (n > 0 ? 'warn' : 'ok'),
    }),
  ]);
  return { key: 'subdomain', title: 'Subdomain-Integrität', checks };
}

// ── 3) CONFIG-VOLLSTÄNDIGKEIT (pro Dojo) ──────────────────────────────────
async function runConfigChecks() {
  let checks = [];
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
      if (missing.length) issues.push({ id: d.id, dojoname: d.dojoname, missing });
    }
    checks.push({
      id: 'cfg_completeness',
      label: 'Dojos mit unvollständiger Finanz-/Steuer-Config',
      status: issues.length > 0 ? 'warn' : 'ok',
      value: issues.length,
      detail: issues.length > 0
        ? issues.map(i => `${i.dojoname} (#${i.id}): ${i.missing.join(', ')}`).join(' · ')
        : 'Alle aktiven Dojos vollständig konfiguriert',
    });
  } catch (e) {
    checks.push({ id: 'cfg_completeness', label: 'Config-Vollständigkeit', status: 'error', value: null, detail: `Query-Fehler: ${e.code || e.message}` });
  }
  return { key: 'config', title: 'Config-Vollständigkeit', checks };
}

// ── 4) MODUL-/ENDPOINT-HEALTH (interner Selbst-Ping) ──────────────────────
const HEALTH_ENDPOINTS = [
  ['Mitglieder', '/api/mitglieder?limit=1'],
  ['Kurse', '/api/kurse'],
  ['Stile', '/api/stile'],
  ['Tarife', '/api/tarife'],
  ['Verträge', '/api/vertraege'],
  ['Rechnungen', '/api/rechnungen'],
  ['Mahnwesen', '/api/mahnwesen/mahnungen'],
  ['Offene Beiträge', '/api/mahnwesen/offene-beitraege'],
  ['Buchhaltung', '/api/buchhaltung/offene-posten'],
  ['Auswertungen', '/api/auswertungen/complete'],
  ['Dashboard', '/api/dashboard/batch'],
  ['Verkäufe', '/api/verkaeufe'],
  ['Notifications', '/api/notifications/dashboard'],
];

function pingInternal(path, authHeader) {
  return new Promise((resolve) => {
    const port = process.env.PORT || 5001;
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'GET', headers: authHeader ? { Authorization: authHeader } : {}, timeout: 9000 },
      (res) => { res.on('data', () => {}); res.on('end', () => resolve(res.statusCode)); }
    );
    req.on('error', () => resolve(0));
    req.on('timeout', () => { req.destroy(); resolve(-1); });
    req.end();
  });
}

async function runHealthChecks(authHeader) {
  const checks = await Promise.all(HEALTH_ENDPOINTS.map(async ([label, path]) => {
    const code = await pingInternal(path, authHeader);
    // 5xx / 0 (Verbindungsfehler) / -1 (Timeout) = fail; alles andere (200/400/401/403/404) = Modul antwortet
    const status = (code >= 500 || code === 0 || code === -1) ? 'fail' : 'ok';
    return { id: 'health_' + path.replace(/[^a-z0-9]/gi, '_'), label, status, value: code, detail: `HTTP ${code === -1 ? 'Timeout' : code}${path}` };
  }));
  return { key: 'health', title: 'Modul-/Endpoint-Health', checks };
}

// ── Orchestrator ──────────────────────────────────────────────────────────
async function runSecurityChecks(authHeader) {
  const categories = await Promise.all([
    runTenantChecks(),
    runSubdomainChecks(),
    runHealthChecks(authHeader),
    runConfigChecks(),
  ]);
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
