import React, { useState, useEffect, useCallback } from 'react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/InventurTab.css';

const BEWEGUNGSART_LABEL = {
  eingang: 'Zugang',
  ausgang: 'Abgang',
  korrektur: 'Korrektur',
  inventur: 'Inventur',
};

const BEWEGUNGSART_COLOR = {
  eingang: '#27ae60',
  ausgang: '#e74c3c',
  korrektur: '#f39c12',
  inventur: '#8e44ad',
};

const LAGER_STATUS_COLOR = {
  verfuegbar: '#27ae60',
  nachbestellen: '#f39c12',
  ausverkauft: '#e74c3c',
  kein_tracking: '#666',
};

const LAGER_STATUS_LABEL = {
  verfuegbar: 'Verfügbar',
  nachbestellen: 'Nachbestellen',
  ausverkauft: 'Ausverkauft',
  kein_tracking: 'Kein Tracking',
};

export default function InventurTab() {
  const [artikel, setArtikel] = useState([]);
  const [bewegungen, setBewegungen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Ansicht
  const [ansicht, setAnsicht] = useState('lager'); // 'lager' | 'verlauf'

  // Filter
  const [suche, setSuche] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');
  const [bewegungsartFilter, setBewegungsartFilter] = useState('alle');

  // Buchungs-Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedArtikel, setSelectedArtikel] = useState(null);
  const [buchung, setBuchung] = useState({
    bewegungsart: 'eingang',
    menge: '',
    grund: '',
  });
  const [buchungLoading, setBuchungLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState({ gesamt: 0, verfuegbar: 0, nachbestellen: 0, ausverkauft: 0, lagerwert: 0 });

  const loadArtikel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/artikel/inventur/uebersicht`);
      const data = await res.json();
      if (data.success) {
        setArtikel(data.data || []);
        const list = data.data || [];
        setStats({
          gesamt: list.length,
          verfuegbar: list.filter(a => a.lager_status === 'verfuegbar').length,
          nachbestellen: list.filter(a => a.lager_status === 'nachbestellen').length,
          ausverkauft: list.filter(a => a.lager_status === 'ausverkauft').length,
          lagerwert: list.reduce((s, a) => s + (a.lagerwert || 0), 0),
        });
      } else {
        setError(data.error || 'Fehler beim Laden');
      }
    } catch (e) {
      setError('Verbindungsfehler: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBewegungen = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: 200 });
      if (bewegungsartFilter !== 'alle') params.append('bewegungsart', bewegungsartFilter);
      const res = await fetchWithAuth(`${config.apiBaseUrl}/artikel/inventur/bewegungen?${params}`);
      const data = await res.json();
      if (data.success) setBewegungen(data.data || []);
    } catch (e) {
      console.error('Bewegungen laden:', e);
    }
  }, [bewegungsartFilter]);

  useEffect(() => { loadArtikel(); }, [loadArtikel]);
  useEffect(() => { if (ansicht === 'verlauf') loadBewegungen(); }, [ansicht, loadBewegungen]);

  const openBuchung = (art) => {
    setSelectedArtikel(art);
    setBuchung({ bewegungsart: 'eingang', menge: '', grund: '' });
    setShowModal(true);
  };

  const submitBuchung = async () => {
    if (!buchung.menge || parseInt(buchung.menge) <= 0) {
      alert('Bitte eine gültige Menge eingeben.');
      return;
    }
    setBuchungLoading(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/artikel/${selectedArtikel.artikel_id}/lager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bewegungsart: buchung.bewegungsart,
          menge: parseInt(buchung.menge),
          grund: buchung.grund || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setSuccessMsg(`Buchung für "${selectedArtikel.name}" erfolgreich gespeichert.`);
        setTimeout(() => setSuccessMsg(''), 4000);
        loadArtikel();
        if (ansicht === 'verlauf') loadBewegungen();
      } else {
        alert('Fehler: ' + (data.error || 'Unbekannt'));
      }
    } catch (e) {
      alert('Verbindungsfehler: ' + e.message);
    } finally {
      setBuchungLoading(false);
    }
  };

  const filteredArtikel = artikel.filter(a => {
    const matchSuche = !suche || a.name.toLowerCase().includes(suche.toLowerCase()) ||
      (a.artikel_nummer || '').toLowerCase().includes(suche.toLowerCase()) ||
      (a.ean_code || '').includes(suche);
    const matchStatus = statusFilter === 'alle' || a.lager_status === statusFilter;
    return matchSuche && matchStatus;
  });

  const filteredBewegungen = bewegungen.filter(b => {
    const matchSuche = !suche || (b.artikel_name || '').toLowerCase().includes(suche.toLowerCase()) ||
      (b.artikel_nummer || '').toLowerCase().includes(suche.toLowerCase());
    return matchSuche;
  });

  if (loading) {
    return (
      <div className="inventur-loading">
        <div className="loading-spinner"></div>
        <p>Inventur wird geladen...</p>
      </div>
    );
  }

  return (
    <div className="inventur-tab">
      {error && <div className="inventur-error">{error}</div>}
      {successMsg && <div className="inventur-success">{successMsg}</div>}

      {/* Statistik-Kacheln */}
      <div className="inventur-stats">
        <div className="inv-stat-card">
          <span className="inv-stat-value">{stats.gesamt}</span>
          <span className="inv-stat-label">Artikel gesamt</span>
        </div>
        <div className="inv-stat-card verfuegbar">
          <span className="inv-stat-value">{stats.verfuegbar}</span>
          <span className="inv-stat-label">Verfügbar</span>
        </div>
        <div className="inv-stat-card nachbestellen">
          <span className="inv-stat-value">{stats.nachbestellen}</span>
          <span className="inv-stat-label">Nachbestellen</span>
        </div>
        <div className="inv-stat-card ausverkauft">
          <span className="inv-stat-value">{stats.ausverkauft}</span>
          <span className="inv-stat-label">Ausverkauft</span>
        </div>
        <div className="inv-stat-card lagerwert">
          <span className="inv-stat-value">
            {stats.lagerwert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </span>
          <span className="inv-stat-label">Lagerwert (EK)</span>
        </div>
      </div>

      {/* Ansicht-Umschalter + Filter */}
      <div className="inventur-toolbar">
        <div className="inventur-ansicht-tabs">
          <button
            className={`inv-ansicht-btn ${ansicht === 'lager' ? 'active' : ''}`}
            onClick={() => setAnsicht('lager')}
          >
            Lagerbestand
          </button>
          <button
            className={`inv-ansicht-btn ${ansicht === 'verlauf' ? 'active' : ''}`}
            onClick={() => setAnsicht('verlauf')}
          >
            Bewegungsverlauf
          </button>
        </div>

        <div className="inventur-filter">
          <input
            className="inv-search"
            type="text"
            placeholder="Suche nach Name, Artikelnr., EAN..."
            value={suche}
            onChange={e => setSuche(e.target.value)}
          />
          {ansicht === 'lager' && (
            <select
              className="inv-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="alle">Alle Status</option>
              <option value="verfuegbar">Verfügbar</option>
              <option value="nachbestellen">Nachbestellen</option>
              <option value="ausverkauft">Ausverkauft</option>
              <option value="kein_tracking">Kein Tracking</option>
            </select>
          )}
          {ansicht === 'verlauf' && (
            <select
              className="inv-select"
              value={bewegungsartFilter}
              onChange={e => setBewegungsartFilter(e.target.value)}
            >
              <option value="alle">Alle Bewegungsarten</option>
              <option value="eingang">Zugänge</option>
              <option value="ausgang">Abgänge</option>
              <option value="korrektur">Korrekturen</option>
              <option value="inventur">Inventur</option>
            </select>
          )}
        </div>
      </div>

      {/* Lagerbestand-Tabelle */}
      {ansicht === 'lager' && (
        <div className="inventur-table-wrap">
          <table className="inventur-table">
            <thead>
              <tr>
                <th>Artikel</th>
                <th>Artikelnr.</th>
                <th>Gruppe</th>
                <th>Status</th>
                <th className="text-right">Bestand</th>
                <th className="text-right">Mindest</th>
                <th className="text-right">EK-Preis</th>
                <th className="text-right">Lagerwert</th>
                <th>Letzte Bewegung</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {filteredArtikel.length === 0 ? (
                <tr>
                  <td colSpan={10} className="inv-empty">Keine Artikel gefunden.</td>
                </tr>
              ) : filteredArtikel.map(a => (
                <tr key={a.artikel_id} className={`inv-row ${a.lager_status}`}>
                  <td>
                    <div className="inv-artikel-name">
                      <span
                        className="inv-farb-dot"
                        style={{ background: a.farbe_hex || '#666' }}
                      />
                      {a.name}
                    </div>
                    {a.hat_varianten && (
                      <div className="inv-varianten-info">
                        {Object.entries(a.varianten_bestand).map(([key, v]) => (
                          <span key={key} className="inv-variante-chip">
                            {key.split('|')[0]} ({v.bestand ?? 0})
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="inv-mono">{a.artikel_nummer || '—'}</td>
                  <td>{a.gruppe_name || a.kategorie_name || '—'}</td>
                  <td>
                    <span
                      className="inv-status-badge"
                      style={{ background: LAGER_STATUS_COLOR[a.lager_status] + '22', color: LAGER_STATUS_COLOR[a.lager_status], border: `1px solid ${LAGER_STATUS_COLOR[a.lager_status]}` }}
                    >
                      {LAGER_STATUS_LABEL[a.lager_status]}
                    </span>
                  </td>
                  <td className="text-right inv-bestand-cell">
                    <strong style={{ color: a.lager_status === 'ausverkauft' ? '#e74c3c' : a.lager_status === 'nachbestellen' ? '#f39c12' : 'inherit' }}>
                      {a.lagerbestand}
                    </strong>
                  </td>
                  <td className="text-right">{a.mindestbestand}</td>
                  <td className="text-right">{a.einkaufspreis.toFixed(2)} €</td>
                  <td className="text-right">{a.lagerwert.toFixed(2)} €</td>
                  <td className="inv-datum">
                    {a.letzte_bewegung
                      ? new Date(a.letzte_bewegung).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : '—'}
                  </td>
                  <td>
                    <button
                      className="btn-buchung"
                      onClick={() => openBuchung(a)}
                      title="Zu-/Abgang buchen"
                    >
                      Buchen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bewegungsverlauf */}
      {ansicht === 'verlauf' && (
        <div className="inventur-table-wrap">
          <table className="inventur-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Artikel</th>
                <th>Art</th>
                <th className="text-right">Menge</th>
                <th className="text-right">Alt</th>
                <th className="text-right">Neu</th>
                <th>Grund / Bemerkung</th>
                <th>Durchgeführt von</th>
              </tr>
            </thead>
            <tbody>
              {filteredBewegungen.length === 0 ? (
                <tr>
                  <td colSpan={8} className="inv-empty">Keine Bewegungen gefunden.</td>
                </tr>
              ) : filteredBewegungen.map(b => (
                <tr key={b.bewegung_id} className="inv-row">
                  <td className="inv-datum">
                    {new Date(b.bewegung_timestamp).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    <div className="inv-artikel-name">{b.artikel_name}</div>
                    {b.artikel_nummer && <div className="inv-mono" style={{ fontSize: '0.78rem', opacity: 0.6 }}>{b.artikel_nummer}</div>}
                  </td>
                  <td>
                    <span
                      className="inv-status-badge"
                      style={{ background: (BEWEGUNGSART_COLOR[b.bewegungsart] || '#666') + '22', color: BEWEGUNGSART_COLOR[b.bewegungsart] || '#666', border: `1px solid ${BEWEGUNGSART_COLOR[b.bewegungsart] || '#666'}` }}
                    >
                      {BEWEGUNGSART_LABEL[b.bewegungsart] || b.bewegungsart}
                    </span>
                  </td>
                  <td className="text-right">
                    <span style={{ color: b.menge >= 0 ? '#27ae60' : '#e74c3c', fontWeight: 600 }}>
                      {b.menge > 0 ? '+' : ''}{b.menge}
                    </span>
                  </td>
                  <td className="text-right">{b.alter_bestand}</td>
                  <td className="text-right">{b.neuer_bestand}</td>
                  <td className="inv-grund">{b.grund || '—'}</td>
                  <td>{b.durchgefuehrt_von_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Buchungs-Modal */}
      {showModal && selectedArtikel && (
        <div className="inv-modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="inv-modal">
            <div className="inv-modal-header">
              <div>
                <h2>Lagerbewegung buchen</h2>
                <p className="inv-modal-subtitle">{selectedArtikel.name}</p>
              </div>
              <button className="inv-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="inv-modal-body">
              <div className="inv-current-stock">
                <span>Aktueller Bestand</span>
                <strong>{selectedArtikel.lagerbestand} Stk.</strong>
              </div>

              <div className="inv-form-group">
                <label>Bewegungsart</label>
                <div className="inv-bewegungsart-grid">
                  {[
                    { value: 'eingang', label: 'Zugang', icon: '↑', desc: 'Waren kommen ins Lager' },
                    { value: 'ausgang', label: 'Abgang', icon: '↓', desc: 'Waren verlassen das Lager' },
                    { value: 'korrektur', label: 'Korrektur', icon: '✏️', desc: 'Bestand auf festen Wert setzen' },
                    { value: 'inventur', label: 'Inventur', icon: '📋', desc: 'Inventur-Zählung' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      className={`inv-bewegungsart-btn ${buchung.bewegungsart === opt.value ? 'active' : ''}`}
                      style={buchung.bewegungsart === opt.value ? { borderColor: BEWEGUNGSART_COLOR[opt.value], background: BEWEGUNGSART_COLOR[opt.value] + '18' } : {}}
                      onClick={() => setBuchung(b => ({ ...b, bewegungsart: opt.value }))}
                    >
                      <span className="inv-bewegungsart-icon">{opt.icon}</span>
                      <span className="inv-bewegungsart-label">{opt.label}</span>
                      <span className="inv-bewegungsart-desc">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="inv-form-group">
                <label>
                  {buchung.bewegungsart === 'korrektur' || buchung.bewegungsart === 'inventur'
                    ? 'Neuer Bestand (absolut)'
                    : 'Menge'}
                </label>
                <input
                  className="inv-input"
                  type="number"
                  min="0"
                  value={buchung.menge}
                  onChange={e => setBuchung(b => ({ ...b, menge: e.target.value }))}
                  placeholder={buchung.bewegungsart === 'korrektur' || buchung.bewegungsart === 'inventur'
                    ? `Aktuell: ${selectedArtikel.lagerbestand}`
                    : 'Anzahl eingeben...'}
                />
                {(buchung.bewegungsart === 'eingang' || buchung.bewegungsart === 'ausgang') && buchung.menge && parseInt(buchung.menge) > 0 && (
                  <div className="inv-preview">
                    Neuer Bestand: <strong>
                      {buchung.bewegungsart === 'eingang'
                        ? selectedArtikel.lagerbestand + parseInt(buchung.menge)
                        : Math.max(0, selectedArtikel.lagerbestand - parseInt(buchung.menge))}
                    </strong> Stk.
                  </div>
                )}
                {(buchung.bewegungsart === 'korrektur' || buchung.bewegungsart === 'inventur') && buchung.menge !== '' && (
                  <div className="inv-preview">
                    Differenz: <strong style={{ color: parseInt(buchung.menge) >= selectedArtikel.lagerbestand ? '#27ae60' : '#e74c3c' }}>
                      {parseInt(buchung.menge) >= selectedArtikel.lagerbestand ? '+' : ''}{parseInt(buchung.menge) - selectedArtikel.lagerbestand}
                    </strong> Stk.
                  </div>
                )}
              </div>

              <div className="inv-form-group">
                <label>Bemerkung / Grund <span className="inv-optional">(optional)</span></label>
                <input
                  className="inv-input"
                  type="text"
                  value={buchung.grund}
                  onChange={e => setBuchung(b => ({ ...b, grund: e.target.value }))}
                  placeholder="z.B. Lieferung, Schwund, Inventur Ergebnis..."
                />
              </div>
            </div>

            <div className="inv-modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>
                Abbrechen
              </button>
              <button
                className="btn-primary"
                onClick={submitBuchung}
                disabled={buchungLoading || !buchung.menge}
              >
                {buchungLoading ? 'Wird gebucht...' : 'Buchung speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
