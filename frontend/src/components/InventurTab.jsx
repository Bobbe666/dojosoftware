import React, { useState, useEffect, useCallback } from 'react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/InventurTab.css';

const BEWEGUNGSART_LABEL = { eingang: 'Zugang', ausgang: 'Abgang', korrektur: 'Korrektur', inventur: 'Inventur' };
const BEWEGUNGSART_COLOR = { eingang: '#27ae60', ausgang: '#e74c3c', korrektur: '#f39c12', inventur: '#8e44ad' };
const LAGER_STATUS_COLOR = { verfuegbar: '#27ae60', nachbestellen: '#f39c12', ausverkauft: '#e74c3c', kein_tracking: '#666' };
const LAGER_STATUS_LABEL = { verfuegbar: 'Verfügbar', nachbestellen: 'Nachbestellen', ausverkauft: 'Ausverkauft', kein_tracking: 'Kein Tracking' };

export default function InventurTab() {
  const [artikel, setArtikel] = useState([]);
  const [bewegungen, setBewegungen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [ansicht, setAnsicht] = useState('lager');
  const [suche, setSuche] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');
  const [bewegungsartFilter, setBewegungsartFilter] = useState('alle');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [stats, setStats] = useState({ gesamt: 0, verfuegbar: 0, nachbestellen: 0, ausverkauft: 0, lagerwert: 0 });

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedArtikel, setSelectedArtikel] = useState(null);
  const [selectedVarianteKey, setSelectedVarianteKey] = useState(null);
  const [selectedVarianteBestand, setSelectedVarianteBestand] = useState(null);
  const [buchung, setBuchung] = useState({ bewegungsart: 'eingang', menge: '', grund: '' });
  const [buchungLoading, setBuchungLoading] = useState(false);

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

  const toggleRow = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openBuchung = (art, varianteKey = null, varianteBestand = null) => {
    setSelectedArtikel(art);
    setSelectedVarianteKey(varianteKey);
    setSelectedVarianteBestand(varianteBestand);
    setBuchung({ bewegungsart: 'eingang', menge: '', grund: '' });
    setShowModal(true);
  };

  const aktuellerBestand = selectedVarianteBestand !== null ? selectedVarianteBestand : selectedArtikel?.lagerbestand;

  const submitBuchung = async () => {
    if (!buchung.menge || parseInt(buchung.menge) < 0) {
      alert('Bitte eine gültige Menge eingeben.');
      return;
    }
    setBuchungLoading(true);
    try {
      const body = {
        bewegungsart: buchung.bewegungsart,
        menge: parseInt(buchung.menge),
        grund: buchung.grund || undefined,
      };
      if (selectedVarianteKey) body.variante_key = selectedVarianteKey;

      const res = await fetchWithAuth(`${config.apiBaseUrl}/artikel/${selectedArtikel.artikel_id}/lager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        const label = selectedVarianteKey
          ? `${selectedArtikel.name} (${selectedVarianteKey.split('|')[0]})`
          : selectedArtikel.name;
        setSuccessMsg(`Buchung für "${label}" gespeichert.`);
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
    return !suche || (b.artikel_name || '').toLowerCase().includes(suche.toLowerCase()) ||
      (b.artikel_nummer || '').toLowerCase().includes(suche.toLowerCase());
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
        <div className={`inv-stat-card verfuegbar ${stats.verfuegbar === 0 ? 'dim' : ''}`}>
          <span className="inv-stat-value">{stats.verfuegbar}</span>
          <span className="inv-stat-label">Verfügbar</span>
        </div>
        <div className={`inv-stat-card nachbestellen ${stats.nachbestellen === 0 ? 'dim' : ''}`}>
          <span className="inv-stat-value">{stats.nachbestellen}</span>
          <span className="inv-stat-label">Nachbestellen</span>
        </div>
        <div className={`inv-stat-card ausverkauft ${stats.ausverkauft === 0 ? 'dim' : ''}`}>
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

      {/* Toolbar */}
      <div className="inventur-toolbar">
        <div className="inventur-ansicht-tabs">
          <button className={`inv-ansicht-btn ${ansicht === 'lager' ? 'active' : ''}`} onClick={() => setAnsicht('lager')}>
            Lagerbestand
          </button>
          <button className={`inv-ansicht-btn ${ansicht === 'verlauf' ? 'active' : ''}`} onClick={() => setAnsicht('verlauf')}>
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
            <select className="inv-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="alle">Alle Status</option>
              <option value="verfuegbar">Verfügbar</option>
              <option value="nachbestellen">Nachbestellen</option>
              <option value="ausverkauft">Ausverkauft</option>
              <option value="kein_tracking">Kein Tracking</option>
            </select>
          )}
          {ansicht === 'verlauf' && (
            <select className="inv-select" value={bewegungsartFilter} onChange={e => setBewegungsartFilter(e.target.value)}>
              <option value="alle">Alle Bewegungsarten</option>
              <option value="eingang">Zugänge</option>
              <option value="ausgang">Abgänge</option>
              <option value="korrektur">Korrekturen</option>
              <option value="inventur">Inventur</option>
            </select>
          )}
        </div>
      </div>

      {/* Lagerbestand-Tabelle — schlank */}
      {ansicht === 'lager' && (
        <div className="inventur-table-wrap">
          <table className="inventur-table">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Artikel</th>
                <th>Status</th>
                <th className="text-right">Bestand</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredArtikel.length === 0 ? (
                <tr><td colSpan={4} className="inv-empty">Keine Artikel gefunden.</td></tr>
              ) : filteredArtikel.map(a => {
                const expanded = expandedRows.has(a.artikel_id);
                const variantenEntries = a.hat_varianten ? Object.entries(a.varianten_bestand) : [];
                return (
                  <React.Fragment key={a.artikel_id}>
                    {/* Hauptzeile */}
                    <tr
                      className={`inv-row ${a.lager_status} ${expanded ? 'expanded' : ''}`}
                      onClick={() => toggleRow(a.artikel_id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className="inv-artikel-name">
                          <span className="inv-farb-dot" style={{ background: a.farbe_hex || '#666' }} />
                          <span>{a.name}</span>
                          {a.hat_varianten && (
                            <span className="inv-varianten-hint">{variantenEntries.length} Größen</span>
                          )}
                        </div>
                      </td>
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
                        {a.mindestbestand > 0 && (
                          <span className="inv-mindest-hint"> / min. {a.mindestbestand}</span>
                        )}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="inv-row-actions">
                          <button
                            className="btn-buchung"
                            onClick={() => openBuchung(a)}
                            title="Zu-/Abgang buchen"
                          >
                            Buchen
                          </button>
                          <span className={`inv-chevron ${expanded ? 'open' : ''}`}>›</span>
                        </div>
                      </td>
                    </tr>

                    {/* Aufgeklappte Details */}
                    {expanded && (
                      <tr className="inv-detail-row">
                        <td colSpan={4}>
                          <div className="inv-detail-body">
                            {/* Meta-Infos */}
                            <div className="inv-detail-meta">
                              {a.artikel_nummer && (
                                <span className="inv-detail-item">
                                  <span className="inv-detail-label">Artikelnr.</span>
                                  <span className="inv-mono">{a.artikel_nummer}</span>
                                </span>
                              )}
                              {(a.gruppe_name || a.kategorie_name) && (
                                <span className="inv-detail-item">
                                  <span className="inv-detail-label">Gruppe</span>
                                  {a.gruppe_name || a.kategorie_name}
                                </span>
                              )}
                              <span className="inv-detail-item">
                                <span className="inv-detail-label">EK-Preis</span>
                                {a.einkaufspreis.toFixed(2)} €
                              </span>
                              <span className="inv-detail-item">
                                <span className="inv-detail-label">Lagerwert</span>
                                {a.lagerwert.toFixed(2)} €
                              </span>
                              {a.letzte_bewegung && (
                                <span className="inv-detail-item">
                                  <span className="inv-detail-label">Letzte Buchung</span>
                                  {new Date(a.letzte_bewegung).toLocaleDateString('de-DE')}
                                </span>
                              )}
                            </div>

                            {/* Varianten-Grid */}
                            {a.hat_varianten && variantenEntries.length > 0 && (
                              <div className="inv-varianten-grid">
                                <div className="inv-detail-label" style={{ marginBottom: '0.5rem' }}>Größen / Varianten</div>
                                <div className="inv-varianten-row">
                                  {variantenEntries.map(([key, v]) => {
                                    const groesse = key.split('|')[0];
                                    const bestand = v.bestand ?? 0;
                                    return (
                                      <div key={key} className={`inv-variante-card ${bestand === 0 ? 'ausverkauft' : ''}`}>
                                        <span className="inv-variante-groesse">{groesse}</span>
                                        <span className="inv-variante-bestand" style={{ color: bestand === 0 ? '#e74c3c' : 'inherit' }}>
                                          {bestand} Stk.
                                        </span>
                                        <button
                                          className="btn-buchung-sm"
                                          onClick={() => openBuchung(a, key, bestand)}
                                        >
                                          Buchen
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
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
                <th className="text-right">Alt → Neu</th>
                <th>Bemerkung</th>
              </tr>
            </thead>
            <tbody>
              {filteredBewegungen.length === 0 ? (
                <tr><td colSpan={6} className="inv-empty">Keine Bewegungen gefunden.</td></tr>
              ) : filteredBewegungen.map(b => (
                <tr key={b.bewegung_id} className="inv-row">
                  <td className="inv-datum">
                    {new Date(b.bewegung_timestamp).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="inv-artikel-name">{b.artikel_name}</td>
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
                  <td className="text-right inv-datum">{b.alter_bestand} → {b.neuer_bestand}</td>
                  <td className="inv-grund">{b.grund || '—'}</td>
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
                <p className="inv-modal-subtitle">
                  {selectedArtikel.name}
                  {selectedVarianteKey && <span className="inv-modal-variante"> · {selectedVarianteKey.split('|')[0]}</span>}
                </p>
              </div>
              <button className="inv-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="inv-modal-body">
              <div className="inv-current-stock">
                <span>Aktueller Bestand{selectedVarianteKey ? ` (${selectedVarianteKey.split('|')[0]})` : ''}</span>
                <strong>{aktuellerBestand} Stk.</strong>
              </div>

              <div className="inv-form-group">
                <label>Bewegungsart</label>
                <div className="inv-bewegungsart-grid">
                  {[
                    { value: 'eingang', label: 'Zugang', icon: '↑', desc: 'Waren kommen ins Lager' },
                    { value: 'ausgang', label: 'Abgang', icon: '↓', desc: 'Waren verlassen das Lager' },
                    { value: 'korrektur', label: 'Korrektur', icon: '✏', desc: 'Bestand auf festen Wert setzen' },
                    { value: 'inventur', label: 'Inventur', icon: '▣', desc: 'Inventur-Zählung' },
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
                    ? `Aktuell: ${aktuellerBestand}`
                    : 'Anzahl eingeben...'}
                  autoFocus
                />
                {(buchung.bewegungsart === 'eingang' || buchung.bewegungsart === 'ausgang') && buchung.menge && parseInt(buchung.menge) > 0 && (
                  <div className="inv-preview">
                    Neuer Bestand: <strong>
                      {buchung.bewegungsart === 'eingang'
                        ? aktuellerBestand + parseInt(buchung.menge)
                        : Math.max(0, aktuellerBestand - parseInt(buchung.menge))}
                    </strong> Stk.
                  </div>
                )}
                {(buchung.bewegungsart === 'korrektur' || buchung.bewegungsart === 'inventur') && buchung.menge !== '' && (
                  <div className="inv-preview">
                    Differenz: <strong style={{ color: parseInt(buchung.menge) >= aktuellerBestand ? '#27ae60' : '#e74c3c' }}>
                      {parseInt(buchung.menge) >= aktuellerBestand ? '+' : ''}{parseInt(buchung.menge) - aktuellerBestand}
                    </strong> Stk.
                  </div>
                )}
              </div>

              <div className="inv-form-group">
                <label>Bemerkung <span className="inv-optional">(optional)</span></label>
                <input
                  className="inv-input"
                  type="text"
                  value={buchung.grund}
                  onChange={e => setBuchung(b => ({ ...b, grund: e.target.value }))}
                  placeholder="z.B. Lieferung, Schwund, Inventur-Ergebnis..."
                />
              </div>
            </div>

            <div className="inv-modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Abbrechen</button>
              <button className="btn-primary" onClick={submitBuchung} disabled={buchungLoading || buchung.menge === ''}>
                {buchungLoading ? 'Wird gebucht...' : 'Buchung speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
