import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import '../styles/OffeneArtikelEinzuege.css';

const fmt = (cent) => (cent / 100).toFixed(2).replace('.', ',') + ' €';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '–';

const OffeneArtikelEinzuege = () => {
  const { activeDojo } = useDojoContext();
  const [einzuege, setEinzuege] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState({}); // { mitglied_id: Set(verkauf_ids) }
  const [processing, setProcessing] = useState({}); // { mitglied_id: true }
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const dojoParam = activeDojo?.id ? `?dojo_id=${activeDojo.id}` : '';
      const res = await axios.get(`/verkaeufe/offene-einzuege${dojoParam}`);
      const parsed = (res.data.einzuege || []).map(e => ({
        ...e,
        verkaeufe: typeof e.verkaeufe === 'string' ? JSON.parse(e.verkaeufe) : (e.verkaeufe || [])
      }));
      setEinzuege(parsed);
    } catch (e) {
      setError(e.response?.data?.error || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [activeDojo]);

  useEffect(() => { load(); }, [load]);

  const toggleVerkauf = (mitglied_id, verkauf_id) => {
    setSelected(prev => {
      const set = new Set(prev[mitglied_id] || []);
      set.has(verkauf_id) ? set.delete(verkauf_id) : set.add(verkauf_id);
      return { ...prev, [mitglied_id]: set };
    });
  };

  const selectAll = (mitglied_id, verkaeufe) => {
    setSelected(prev => ({
      ...prev,
      [mitglied_id]: new Set(verkaeufe.map(v => v.verkauf_id))
    }));
  };

  const getSelectedIds = (mitglied_id) =>
    Array.from(selected[mitglied_id] || []);

  const handleManuellerEinzug = async (mitglied_id) => {
    const ids = getSelectedIds(mitglied_id);
    if (!ids.length) { showToast('Bitte Verkäufe auswählen', 'error'); return; }
    setProcessing(p => ({ ...p, [mitglied_id]: true }));
    try {
      const res = await axios.post('/verkaeufe/manueller-einzug', {
        mitglied_id,
        verkauf_ids: ids
      });
      showToast(`✓ ${res.data.message} (${res.data.betrag_euro} €)`);
      await load();
    } catch (e) {
      showToast(e.response?.data?.error || 'Fehler beim Einzug', 'error');
    } finally {
      setProcessing(p => ({ ...p, [mitglied_id]: false }));
    }
  };

  const handleNaechsterLauf = async (mitglied_id) => {
    const ids = getSelectedIds(mitglied_id);
    if (!ids.length) { showToast('Bitte Verkäufe auswählen', 'error'); return; }
    setProcessing(p => ({ ...p, [mitglied_id]: 'lauf' }));
    try {
      const res = await axios.post('/verkaeufe/naechster-lauf', { verkauf_ids: ids });
      showToast(`✓ ${res.data.message}`);
      await load();
    } catch (e) {
      showToast(e.response?.data?.error || 'Fehler', 'error');
    } finally {
      setProcessing(p => ({ ...p, [mitglied_id]: false }));
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Laden…</div>;

  return (
    <div className="oae-container">
      <div className="oae-header">
        <h2>💳 Offene Artikel-Einzüge</h2>
        <span className="oae-badge">{einzuege.length} Mitglieder</span>
        <button className="oae-refresh" onClick={load} title="Aktualisieren">↻</button>
      </div>

      {error && <div className="oae-error">{error}</div>}

      {einzuege.length === 0 && !error && (
        <div className="oae-empty">
          <div style={{ fontSize: '3rem' }}>✅</div>
          <p>Keine offenen Einzüge vorhanden</p>
        </div>
      )}

      {einzuege.map(e => {
        const sel = selected[e.mitglied_id] || new Set();
        const allSelected = e.verkaeufe?.length > 0 && sel.size === e.verkaeufe.length;
        const selectedCent = (e.verkaeufe || [])
          .filter(v => sel.has(v.verkauf_id))
          .reduce((s, v) => s + v.betrag_cent, 0);
        const isProcessing = processing[e.mitglied_id];
        const hasStripe = !!e.stripe_customer_id;

        return (
          <div key={e.mitglied_id} className="oae-card">
            <div className="oae-card-header">
              <div className="oae-member-info">
                <strong>{e.mitglied_name}</strong>
                <span className="oae-email">{e.email}</span>
                {!hasStripe && <span className="oae-no-stripe">⚠️ Kein Stripe</span>}
              </div>
              <div className="oae-totals">
                <span className="oae-total-amount">{fmt(e.gesamt_cent)}</span>
                <span className="oae-count">{e.anzahl_verkaeufe} Verkauf/Käufe</span>
              </div>
            </div>

            <div className="oae-verkaeufe">
              <div className="oae-select-all-row">
                <label className="oae-check-label">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => allSelected
                      ? setSelected(p => ({ ...p, [e.mitglied_id]: new Set() }))
                      : selectAll(e.mitglied_id, e.verkaeufe || [])
                    }
                  />
                  Alle auswählen
                </label>
                {sel.size > 0 && (
                  <span className="oae-selected-sum">Ausgewählt: {fmt(selectedCent)}</span>
                )}
              </div>

              {(e.verkaeufe || []).map(v => (
                <label key={v.verkauf_id} className="oae-verkauf-row">
                  <input
                    type="checkbox"
                    checked={sel.has(v.verkauf_id)}
                    onChange={() => toggleVerkauf(e.mitglied_id, v.verkauf_id)}
                  />
                  <span className="oae-bon">{v.bon_nummer}</span>
                  <span className="oae-datum">{fmtDate(v.datum)}</span>
                  <span className="oae-betrag">{fmt(v.betrag_cent)}</span>
                  <span className={`oae-status oae-status--${v.zahlungsstatus}`}>
                    {v.zahlungsstatus === 'in_einzug' ? '⏳ In Bearbeitung' : '🔴 Offen'}
                  </span>
                </label>
              ))}
            </div>

            <div className="oae-actions">
              <button
                className="oae-btn oae-btn--stripe"
                onClick={() => handleManuellerEinzug(e.mitglied_id)}
                disabled={!!isProcessing || !sel.size || !hasStripe}
                title={!hasStripe ? 'Kein Stripe-Kunde hinterlegt' : ''}
              >
                {isProcessing === true ? '⏳ Wird eingezogen…' : '⚡ Jetzt per Stripe einziehen'}
              </button>
              <button
                className="oae-btn oae-btn--lauf"
                onClick={() => handleNaechsterLauf(e.mitglied_id)}
                disabled={!!isProcessing || !sel.size}
              >
                {isProcessing === 'lauf' ? '⏳…' : '📅 Im nächsten Lauf einziehen'}
              </button>
            </div>
          </div>
        );
      })}

      {toast && (
        <div className={`oae-toast oae-toast--${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
};

export default OffeneArtikelEinzuege;
