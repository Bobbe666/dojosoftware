// ============================================================================
// erstattungSync — holt Stripe-Refunds und schreibt sie in `erstattungen`
// ----------------------------------------------------------------------------
// Idempotent über UNIQUE(stripe_refund_id). Ordnet jeden Refund via
// payment_intent der ursprünglichen Lastschrift-Transaktion (und damit
// Mitglied + Posten-Art) zu. Wird für Backfill (historisch) und periodisch
// (Cron) genutzt — deckt damit auch direkt im Stripe-Dashboard ausgelöste
// Erstattungen lückenlos ab.
// ============================================================================
const db = require('../db');
const pool = db.promise();
const PaymentProviderFactory = require('./PaymentProviderFactory');
const logger = require('../utils/logger');

// Erstattungs-Art aus den Posten der Ursprungs-Transaktion ableiten (für USt)
function artAusBeitraege(beitragArten) {
  if (!beitragArten || beitragArten.length === 0) return 'unbekannt';
  if (beitragArten.every(a => a === 'artikel')) return 'verkauf';
  return 'beitrag';
}

/**
 * Synchronisiert die Stripe-Refunds eines Dojos in die erstattungen-Tabelle.
 * @param {number} dojoId
 * @param {object} opts { sinceDays?: number }  — nur Refunds der letzten N Tage (null = alle)
 */
async function syncStripeRefunds(dojoId, { sinceDays = null } = {}) {
  const result = { dojoId, ok: false, grund: null, neu: 0, aktualisiert: 0, gesehen: 0 };

  let provider;
  try {
    provider = await PaymentProviderFactory.getProvider(dojoId);
  } catch (e) {
    result.grund = 'Provider-Fehler: ' + e.message;
    return result;
  }
  if (!provider || !provider.stripe) {
    result.grund = 'Stripe für dieses Dojo nicht konfiguriert';
    return result;
  }
  const stripeOpts = provider.connectedAccountId ? { stripeAccount: provider.connectedAccountId } : undefined;

  // Payment-Intent → Transaktion/Mitglied/Posten-Art (für Zuordnung)
  const [txRows] = await pool.query(
    `SELECT t.id, t.mitglied_id, t.stripe_payment_intent_id, t.beitrag_ids
     FROM stripe_lastschrift_transaktion t JOIN mitglieder m ON t.mitglied_id = m.mitglied_id
     WHERE m.dojo_id = ? AND t.stripe_payment_intent_id IS NOT NULL`, [dojoId]);
  const txByPi = {};
  txRows.forEach(t => { txByPi[t.stripe_payment_intent_id] = t; });

  // Beitrags-Arten je beitrag_id (zur USt-Art-Ableitung)
  const [bRows] = await pool.query(
    `SELECT beitrag_id, art FROM beitraege WHERE mitglied_id IN
       (SELECT mitglied_id FROM mitglieder WHERE dojo_id = ?)`, [dojoId]);
  const artById = {};
  bRows.forEach(b => { artById[b.beitrag_id] = b.art; });

  const listParams = { limit: 100 };
  if (sinceDays) listParams.created = { gte: Math.floor(Date.now() / 1000) - sinceDays * 86400 };

  try {
    for await (const r of provider.stripe.refunds.list(listParams, stripeOpts)) {
      result.gesehen++;
      // Nur tatsächlich erfolgte oder laufende Erstattungen verbuchen
      if (!['succeeded', 'pending'].includes(r.status)) continue;

      const pi = typeof r.payment_intent === 'string' ? r.payment_intent : (r.payment_intent && r.payment_intent.id) || null;
      const chargeId = typeof r.charge === 'string' ? r.charge : (r.charge && r.charge.id) || null;
      const tx = pi ? txByPi[pi] : null;

      let mitgliedId = tx ? tx.mitglied_id : null;
      let txId = tx ? tx.id : null;
      let art = 'unbekannt';
      if (tx) {
        let bIds = []; try { bIds = JSON.parse(tx.beitrag_ids || '[]'); } catch {}
        art = artAusBeitraege(bIds.map(id => artById[id]).filter(Boolean));
      }

      const betrag = (r.amount || 0) / 100;
      const erstattetAm = new Date((r.created || Math.floor(Date.now() / 1000)) * 1000).toISOString().split('T')[0];
      // succeeded = abgeschlossen, pending = veranlasst (SEPA-Gutschrift unterwegs) — beide wirksam
      const status = r.status === 'succeeded' ? 'erstattet' : 'veranlasst';

      const [res] = await pool.query(
        `INSERT INTO erstattungen
           (dojo_id, mitglied_id, quelle, transaktion_id, stripe_payment_intent_id, stripe_charge_id, stripe_refund_id, betrag, quelle_art, erstattet_am, status, bemerkung)
         VALUES (?, ?, 'stripe_sync', ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           betrag = VALUES(betrag), status = VALUES(status), mitglied_id = COALESCE(VALUES(mitglied_id), mitglied_id),
           transaktion_id = COALESCE(VALUES(transaktion_id), transaktion_id), erstattet_am = VALUES(erstattet_am)`,
        [dojoId, mitgliedId, txId, pi, chargeId, r.id, betrag, art, erstattetAm, status, r.reason || null]
      );
      if (res.affectedRows === 1) result.neu++;
      else if (res.affectedRows === 2) result.aktualisiert++;
    }
    result.ok = true;
  } catch (e) {
    result.grund = 'Stripe-Abruf-Fehler: ' + e.message;
    logger.error(`erstattungSync dojo ${dojoId}:`, { error: e.message });
  }

  logger.info(`💸 erstattungSync dojo ${dojoId}: ${result.neu} neu, ${result.aktualisiert} aktualisiert (${result.gesehen} gesehen)`);
  return result;
}

/**
 * Erfasst ein einzelnes Refund-Objekt aus einem Webhook-Event in `erstattungen`.
 * @param {object} r        Stripe Refund-Objekt
 * @param {object} charge   optional: zugehöriges Charge-Objekt (für payment_intent/charge-Fallback)
 * @param {string} quelle   'stripe_extern' (Webhook) — Default
 */
async function erfasseRefundEvent(r, charge = null, quelle = 'stripe_extern') {
  if (!r || !r.id) return { ok: false, grund: 'kein Refund-Objekt' };
  if (r.status && !['succeeded', 'pending'].includes(r.status)) return { ok: false, grund: `status ${r.status}` };

  const pi = (typeof r.payment_intent === 'string' ? r.payment_intent : (r.payment_intent && r.payment_intent.id))
    || (charge && (typeof charge.payment_intent === 'string' ? charge.payment_intent : (charge.payment_intent && charge.payment_intent.id))) || null;
  const chargeId = (typeof r.charge === 'string' ? r.charge : (r.charge && r.charge.id)) || (charge && charge.id) || null;

  let tx = null;
  if (pi) {
    const [[row]] = await pool.query(
      `SELECT t.id, t.mitglied_id, t.beitrag_ids, m.dojo_id
       FROM stripe_lastschrift_transaktion t JOIN mitglieder m ON t.mitglied_id = m.mitglied_id
       WHERE t.stripe_payment_intent_id = ?`, [pi]);
    tx = row || null;
  }
  if (!tx && chargeId) {
    const [[row]] = await pool.query(
      `SELECT t.id, t.mitglied_id, t.beitrag_ids, m.dojo_id
       FROM stripe_lastschrift_transaktion t JOIN mitglieder m ON t.mitglied_id = m.mitglied_id
       WHERE t.stripe_charge_id = ?`, [chargeId]);
    tx = row || null;
  }
  if (!tx) { logger.warn(`Refund ${r.id}: keine zugehörige Transaktion gefunden (pi=${pi})`); return { ok: false, grund: 'keine Transaktion' }; }

  let art = 'unbekannt';
  let bIds = []; try { bIds = JSON.parse(tx.beitrag_ids || '[]'); } catch {}
  if (bIds.length > 0) {
    const ph = bIds.map(() => '?').join(',');
    const [arts] = await pool.query(`SELECT art FROM beitraege WHERE beitrag_id IN (${ph})`, bIds);
    if (arts.length > 0) art = arts.every(a => a.art === 'artikel') ? 'verkauf' : 'beitrag';
  }
  const erstattetAm = new Date((r.created || Math.floor(Date.now() / 1000)) * 1000).toISOString().split('T')[0];

  await pool.query(
    `INSERT INTO erstattungen
       (dojo_id, mitglied_id, quelle, transaktion_id, stripe_payment_intent_id, stripe_charge_id, stripe_refund_id, betrag, quelle_art, erstattet_am, status, bemerkung)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE betrag = VALUES(betrag), status = VALUES(status), mitglied_id = COALESCE(VALUES(mitglied_id), mitglied_id)`,
    [tx.dojo_id, tx.mitglied_id, quelle, tx.id, pi, chargeId, r.id, (r.amount || 0) / 100, art, erstattetAm, r.status === 'succeeded' ? 'erstattet' : 'veranlasst', r.reason || null]
  );
  logger.info(`💸 Webhook-Erstattung erfasst: ${r.id} (${(r.amount || 0) / 100} €, dojo ${tx.dojo_id})`);
  return { ok: true, dojoId: tx.dojo_id };
}

module.exports = { syncStripeRefunds, erfasseRefundEvent };
