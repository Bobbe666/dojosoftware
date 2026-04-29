import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, XCircle, RefreshCw, Search } from 'lucide-react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import '../styles/StripeStornoVerwaltung.css';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatEuro(betrag) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(betrag || 0);
}

export default function StripeStornoVerwaltung() {
  const { activeDojo } = useDojoContext();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stornoModal, setStornoModal] = useState(null); // { trans }
  const [stornoGrund, setStornoGrund] = useState('');
  const [stornoLoading, setStornoLoading] = useState(false);
  const [stornoResult, setStornoResult] = useState(null); // { success, error }

  const dojoParam = activeDojo?.id ? `?dojo_id=${activeDojo.id}` : '';

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/lastschriftlauf/stripe/processing-transactions${dojoParam}`);
      setTransactions(res.data?.transactions || []);
    } catch {
      setTransactions([]);
    }
    setLoading(false);
  }, [dojoParam]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const filtered = transactions.filter(t =>
    !search || `${t.vorname} ${t.nachname} ${t.email} ${t.stripe_payment_intent_id}`.toLowerCase().includes(search.toLowerCase())
  );

  const openStorno = (trans) => {
    setStornoModal(trans);
    setStornoGrund('');
    setStornoResult(null);
  };

  const handleStorno = async () => {
    if (!stornoModal) return;
    setStornoLoading(true);
    setStornoResult(null);
    try {
      const res = await axios.post(`/api/lastschriftlauf/stripe/storno/${stornoModal.id}`, { grund: stornoGrund });
      setStornoResult({ success: true, message: res.data.message, beitraege: res.data.beitraege_zurueckgesetzt });
      await loadTransactions();
    } catch (err) {
      setStornoResult({ success: false, error: err.response?.data?.error || 'Fehler beim Stornieren' });
    }
    setStornoLoading(false);
  };

  const closeModal = () => {
    setStornoModal(null);
    setStornoGrund('');
    setStornoResult(null);
  };

  return (
    <div className="storno-verwaltung">
      <div className="storno-header">
        <div>
          <h2 className="storno-title">Storno-Verwaltung</h2>
          <p className="storno-subtitle">Laufende Stripe-Transaktionen (Status: Processing) stornieren</p>
        </div>
        <button className="btn btn-secondary btn-icon" onClick={loadTransactions} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          Aktualisieren
        </button>
      </div>

      {transactions.length > 0 && (
        <div className="storno-warning-banner">
          <AlertTriangle size={18} />
          <span><strong>{transactions.length} laufende Abbuchung{transactions.length !== 1 ? 'en' : ''}</strong> — SEPA-Transaktionen können nur storniert werden solange sie noch nicht eingezogen wurden.</span>
        </div>
      )}

      <div className="storno-search-bar">
        <Search size={16} />
        <input
          type="text"
          placeholder="Mitglied, E-Mail oder Payment Intent ID suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="storno-search-input"
        />
      </div>

      {loading ? (
        <div className="storno-loading">Lade Transaktionen…</div>
      ) : filtered.length === 0 ? (
        <div className="storno-empty">
          {transactions.length === 0
            ? '✅ Keine laufenden Stripe-Transaktionen — alles in Ordnung.'
            : 'Keine Ergebnisse für die Suche.'
          }
        </div>
      ) : (
        <div className="storno-table-wrap">
          <table className="storno-table">
            <thead>
              <tr>
                <th>Mitglied</th>
                <th>Betrag</th>
                <th>Monat</th>
                <th>Erstellt am</th>
                <th>Payment Intent</th>
                <th>Batch</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td>
                    <div className="storno-member-name">{t.vorname} {t.nachname}</div>
                    <div className="storno-member-email">{t.email}</div>
                  </td>
                  <td><strong className="storno-amount">{formatEuro(t.betrag)}</strong></td>
                  <td>{String(t.monat).padStart(2, '0')}/{t.jahr}</td>
                  <td>{formatDate(t.created_at)}</td>
                  <td>
                    <code className="storno-pi-id" title={t.stripe_payment_intent_id}>
                      {t.stripe_payment_intent_id ? t.stripe_payment_intent_id.substring(0, 20) + '…' : '—'}
                    </code>
                  </td>
                  <td><code className="storno-batch-id">{t.batch_id}</code></td>
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => openStorno(t)}>
                      <XCircle size={14} />
                      Stornieren
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Storno-Bestätigungs-Modal */}
      {stornoModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-container storno-modal">
            <div className="modal-header">
              <h3>Transaktion stornieren</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              {!stornoResult ? (
                <>
                  <div className="storno-modal-info">
                    <div className="storno-modal-row">
                      <span>Mitglied:</span>
                      <strong>{stornoModal.vorname} {stornoModal.nachname}</strong>
                    </div>
                    <div className="storno-modal-row">
                      <span>Betrag:</span>
                      <strong className="storno-modal-amount">{formatEuro(stornoModal.betrag)}</strong>
                    </div>
                    <div className="storno-modal-row">
                      <span>Payment Intent:</span>
                      <code>{stornoModal.stripe_payment_intent_id || '—'}</code>
                    </div>
                    <div className="storno-modal-row">
                      <span>Erstellt:</span>
                      <span>{formatDate(stornoModal.created_at)}</span>
                    </div>
                  </div>

                  <div className="storno-modal-warning">
                    <AlertTriangle size={16} />
                    <span>Diese Aktion storniert die Abbuchung bei Stripe und setzt die Beiträge wieder auf <em>unbezahlt</em>. SEPA-Abbuchungen können nur storniert werden, solange sie noch nicht eingezogen wurden (typisch 5–7 Werktage nach Erstellung).</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Storno-Grund (optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="z.B. Doppelabbuchung, Fehler im Batch…"
                      value={stornoGrund}
                      onChange={e => setStornoGrund(e.target.value)}
                    />
                  </div>
                </>
              ) : stornoResult.success ? (
                <div className="storno-success">
                  <div className="storno-success-icon">✅</div>
                  <p>{stornoResult.message}</p>
                  {stornoResult.beitraege > 0 && (
                    <p className="storno-success-detail">{stornoResult.beitraege} Beitrag/Beiträge wieder auf "offen" gesetzt.</p>
                  )}
                </div>
              ) : (
                <div className="storno-error">
                  <div className="storno-error-icon">❌</div>
                  <p>{stornoResult.error}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {!stornoResult ? (
                <>
                  <button className="btn btn-secondary" onClick={closeModal}>Abbrechen</button>
                  <button
                    className="btn btn-danger"
                    onClick={handleStorno}
                    disabled={stornoLoading}
                  >
                    {stornoLoading ? 'Storniere…' : '🚫 Jetzt stornieren'}
                  </button>
                </>
              ) : (
                <button className="btn btn-primary" onClick={closeModal}>Schließen</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
