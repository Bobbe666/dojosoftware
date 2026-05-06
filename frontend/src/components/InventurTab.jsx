import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/InventurTab.css';

const BEWEGUNGSART_LABEL = { eingang: 'Zugang', ausgang: 'Abgang', korrektur: 'Korrektur', inventur: 'Inventur' };
const BEWEGUNGSART_COLOR = { eingang: '#27ae60', ausgang: '#e74c3c', korrektur: '#f39c12', inventur: '#8e44ad' };
const LAGER_STATUS_COLOR = { verfuegbar: '#27ae60', nachbestellen: '#f39c12', ausverkauft: '#e74c3c', kein_tracking: '#666' };
const LAGER_STATUS_LABEL = { verfuegbar: 'Verfügbar', nachbestellen: 'Nachbestellen', ausverkauft: 'Ausverkauft', kein_tracking: 'Kein Tracking' };

export default function InventurTab() {
  const navigate = useNavigate();
  const [artikel, setArtikel] = useState([]);
  const [bewegungen, setBewegungen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [ansicht, setAnsicht] = useState('lager');
  const [suche, setSuche] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');
  const [bewegungsartFilter, setBewegungsartFilter] = useState('alle');
  const [gruppeFilter, setGruppeFilter] = useState('alle');
  const [sortierung, setSortierung] = useState('status');
  const [layoutModus, setLayoutModus] = useState('grid');
  const [stats, setStats] = useState({ gesamt: 0, verfuegbar: 0, nachbestellen: 0, ausverkauft: 0, lagerwert: 0 });

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedArtikel, setSelectedArtikel] = useState(null);
  const [buchung, setBuchung] = useState({ bewegungsart: 'eingang', menge: '', grund: '' });
  const [variantMengen, setVariantMengen] = useState({});
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

  const kopierenArtikel = async (e, artikelId) => {
    e.stopPropagation();
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/artikel/${artikelId}`);
      const data = await res.json();
      if (data.success && data.data) {
        navigate('/dashboard/artikel/neu', { state: { copyFrom: data.data } });
      }
    } catch (err) {
      alert('Fehler beim Laden des Artikels: ' + err.message);
    }
  };

  const openBuchung = (art) => {
    setSelectedArtikel(art);
    const initMengen = {};
    if (art.hat_varianten && art.varianten_bestand) {
      Object.keys(art.varianten_bestand).forEach(k => { initMengen[k] = ''; });
    }
    setVariantMengen(initMengen);
    setBuchung({ bewegungsart: 'eingang', menge: '', grund: '' });
    setShowModal(true);
  };

  const submitBuchung = async () => {
    setBuchungLoading(true);
    try {
      const hasVarianten = Object.keys(variantMengen).length > 0;
      if (hasVarianten) {
        const toSubmit = Object.entries(variantMengen).filter(([, v]) => v !== '' && parseInt(v) >= 0);
        if (toSubmit.length === 0) {
          alert('Bitte mindestens eine Menge eingeben.');
          setBuchungLoading(false);
          return;
        }
        for (const [varianteKey, mengeStr] of toSubmit) {
          const res = await fetchWithAuth(`${config.apiBaseUrl}/artikel/${selectedArtikel.artikel_id}/lager`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bewegungsart: buchung.bewegungsart,
              menge: parseInt(mengeStr),
              variante_key: varianteKey,
              grund: buchung.grund || undefined,
            }),
          });
          const data = await res.json();
          if (!data.success) {
            alert(`Fehler bei ${varianteKey.split('|')[0]}: ${data.error || 'Unbekannt'}`);
            setBuchungLoading(false);
            return;
          }
        }
      } else {
        if (!buchung.menge || parseInt(buchung.menge) < 0) {
          alert('Bitte eine gültige Menge eingeben.');
          setBuchungLoading(false);
          return;
        }
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
        if (!data.success) {
          alert('Fehler: ' + (data.error || 'Unbekannt'));
          setBuchungLoading(false);
          return;
        }
      }
      setShowModal(false);
      setSuccessMsg(`Buchung für "${selectedArtikel.name}" gespeichert.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      loadArtikel();
      if (ansicht === 'verlauf') loadBewegungen();
    } catch (e) {
      alert('Verbindungsfehler: ' + e.message);
    } finally {
      setBuchungLoading(false);
    }
  };

  const gruppenOptionen = [...new Set(
    artikel.map(a => a.gruppe_name || a.kategorie_name).filter(Boolean)
  )].sort();

  const STATUS_SORT = { ausverkauft: 0, nachbestellen: 1, verfuegbar: 2, kein_tracking: 3 };

  const filteredArtikel = artikel
    .filter(a => {
      const matchSuche = !suche || a.name.toLowerCase().includes(suche.toLowerCase()) ||
        (a.artikel_nummer || '').toLowerCase().includes(suche.toLowerCase()) ||
        (a.ean_code || '').includes(suche);
      const matchStatus = statusFilter === 'alle' || a.lager_status === statusFilter;
      const matchGruppe = gruppeFilter === 'alle' || (a.gruppe_name || a.kategorie_name) === gruppeFilter;
      return matchSuche && matchStatus && matchGruppe;
    })
    .sort((a, b) => {
      switch (sortierung) {
        case 'name_asc':  return a.name.localeCompare(b.name, 'de');
        case 'name_desc': return b.name.localeCompare(a.name, 'de');
        case 'bestand_asc':  return a.lagerbestand - b.lagerbestand;
        case 'bestand_desc': return b.lagerbestand - a.lagerbestand;
        case 'status': return (STATUS_SORT[a.lager_status] ?? 9) - (STATUS_SORT[b.lager_status] ?? 9);
        default: return 0;
      }
    });

  const filteredBewegungen = bewegungen.filter(b =>
    !suche || (b.artikel_name || '').toLowerCase().includes(suche.toLowerCase()) ||
    (b.artikel_nummer || '').toLowerCase().includes(suche.toLowerCase())
  );

  // Modal helpers
  const isKorrektur = buchung.bewegungsart === 'korrektur' || buchung.bewegungsart === 'inventur';
  const variantenEntries = selectedArtikel?.hat_varianten
    ? Object.entries(selectedArtikel.varianten_bestand || {})
    : [];

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
        {ansicht === 'lager' && (
          <div className="inv-layout-toggle">
            <button className={`inv-layout-btn ${layoutModus === 'grid' ? 'active' : ''}`} onClick={() => setLayoutModus('grid')} title="Kachelansicht">⊞</button>
            <button className={`inv-layout-btn ${layoutModus === 'liste' ? 'active' : ''}`} onClick={() => setLayoutModus('liste')} title="Listenansicht">☰</button>
          </div>
        )}
        <div className="inventur-filter">
          <input
            className="inv-search"
            type="text"
            placeholder="Name, Artikelnr., EAN..."
            value={suche}
            onChange={e => setSuche(e.target.value)}
          />
          {ansicht === 'lager' && (<>
            <select className="inv-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="alle">Alle Status</option>
              <option value="verfuegbar">Verfügbar</option>
              <option value="nachbestellen">Nachbestellen</option>
              <option value="ausverkauft">Ausverkauft</option>
              <option value="kein_tracking">Kein Tracking</option>
            </select>
            <select className="inv-select" value={gruppeFilter} onChange={e => setGruppeFilter(e.target.value)}>
              <option value="alle">Alle Gruppen</option>
              {gruppenOptionen.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select className="inv-select" value={sortierung} onChange={e => setSortierung(e.target.value)}>
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
              <option value="bestand_asc">Bestand ↑</option>
              <option value="bestand_desc">Bestand ↓</option>
              <option value="status">Status</option>
            </select>
          </>)}
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

      {/* Lagerbestand */}
      {ansicht === 'lager' && (
        filteredArtikel.length === 0
          ? <div className="inv-empty">Keine Artikel gefunden.</div>
          : layoutModus === 'liste'
          ? (
            <div className="inv-list-wrap">
              {filteredArtikel.map(a => {
                const statusColor = LAGER_STATUS_COLOR[a.lager_status];
                const bestandColor = a.lager_status === 'ausverkauft' ? '#e74c3c' : a.lager_status === 'nachbestellen' ? '#f39c12' : 'inherit';
                const varCount = a.hat_varianten ? Object.keys(a.varianten_bestand || {}).length : 0;
                return (
                  <div key={a.artikel_id} className="inv-list-item" style={{ '--sc': statusColor }} onClick={() => openBuchung(a)}>
                    <div className="inv-list-row">
                      <div className="inv-list-name">
                        <span className="inv-farb-dot" style={{ background: a.farbe_hex || '#555' }} />
                        <span className="inv-name-text" title={a.name}>{a.name}</span>
                        {varCount > 0 && <span className="inv-varianten-hint">{varCount} Gr.</span>}
                      </div>
                      <span className="inv-status-badge" style={{ background: statusColor + '20', color: statusColor, border: `1px solid ${statusColor}` }}>
                        {LAGER_STATUS_LABEL[a.lager_status]}
                      </span>
                      <div className="inv-list-bestand">
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: bestandColor }}>{a.lagerbestand}</span>
                        {a.mindestbestand > 0 && <span className="inv-card-mindest">/ {a.mindestbestand}</span>}
                      </div>
                      <div className="inv-list-actions" onClick={e => e.stopPropagation()}>
                        <button className="inv-copy-btn" title="Kopieren" onClick={e => kopierenArtikel(e, a.artikel_id)}>⎘</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
          : (
            <div className="inv-grid">
              {filteredArtikel.map(a => {
                const statusColor = LAGER_STATUS_COLOR[a.lager_status];
                const bestandColor = a.lager_status === 'ausverkauft' ? '#e74c3c' : a.lager_status === 'nachbestellen' ? '#f39c12' : 'inherit';
                const varCount = a.hat_varianten ? Object.keys(a.varianten_bestand || {}).length : 0;
                return (
                  <div key={a.artikel_id} className={`inv-card ${a.lager_status}`} onClick={() => openBuchung(a)}>
                    <div className="inv-card-top">
                      <div className="inv-card-name-row">
                        <span className="inv-farb-dot" style={{ background: a.farbe_hex || '#555' }} />
                        <span className="inv-card-name" title={a.name}>{a.name}</span>
                      </div>
                      <span className="inv-status-badge" style={{ background: statusColor + '20', color: statusColor, border: `1px solid ${statusColor}` }}>
                        {LAGER_STATUS_LABEL[a.lager_status]}
                      </span>
                    </div>
                    <div className="inv-card-mid">
                      <span className="inv-card-zahl" style={{ color: bestandColor }}>{a.lagerbestand}</span>
                      <div className="inv-card-sub">
                        <span>Stk.</span>
                        {varCount > 0 && <span className="inv-varianten-hint">{varCount}×</span>}
                        {a.mindestbestand > 0 && <span className="inv-card-mindest">min.{a.mindestbestand}</span>}
                      </div>
                    </div>
                    <div className="inv-card-foot" onClick={e => e.stopPropagation()}>
                      <button className="inv-copy-btn" title="Artikel kopieren & neu anlegen" onClick={e => kopierenArtikel(e, a.artikel_id)}>⎘</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
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
                    <span className="inv-status-badge" style={{ background: (BEWEGUNGSART_COLOR[b.bewegungsart] || '#666') + '22', color: BEWEGUNGSART_COLOR[b.bewegungsart] || '#666', border: `1px solid ${BEWEGUNGSART_COLOR[b.bewegungsart] || '#666'}` }}>
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
      {showModal && selectedArtikel && createPortal(
        <div className="inv-modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="inv-modal">

            {/* Header */}
            <div className="inv-modal-header">
              <div className="inv-modal-titel-block">
                <div className="inv-modal-artikel-info">
                  <span className="inv-farb-dot inv-modal-dot" style={{ background: selectedArtikel.farbe_hex || '#555' }} />
                  <h2>{selectedArtikel.name}</h2>
                  <span className="inv-status-badge" style={{
                    background: LAGER_STATUS_COLOR[selectedArtikel.lager_status] + '20',
                    color: LAGER_STATUS_COLOR[selectedArtikel.lager_status],
                    border: `1px solid ${LAGER_STATUS_COLOR[selectedArtikel.lager_status]}`
                  }}>
                    {LAGER_STATUS_LABEL[selectedArtikel.lager_status]}
                  </span>
                </div>
                <p className="inv-modal-subtitle">
                  Gesamt: <strong>{selectedArtikel.lagerbestand} Stk.</strong>
                  {selectedArtikel.mindestbestand > 0 && <span> · Mindest: {selectedArtikel.mindestbestand}</span>}
                  {selectedArtikel.einkaufspreis > 0 && <span> · EK: {selectedArtikel.einkaufspreis.toFixed(2)} €</span>}
                  {(selectedArtikel.gruppe_name || selectedArtikel.kategorie_name) && (
                    <span> · {selectedArtikel.gruppe_name || selectedArtikel.kategorie_name}</span>
                  )}
                </p>
              </div>
              <button className="inv-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="inv-modal-body">

              {/* Bewegungsart */}
              <div className="inv-form-group">
                <label>Bewegungsart</label>
                <div className="inv-bewegungsart-grid">
                  {[
                    { value: 'eingang',   label: 'Zugang',    icon: '↑', desc: 'Lager auffüllen'  },
                    { value: 'ausgang',   label: 'Abgang',    icon: '↓', desc: 'Lager entnehmen'  },
                    { value: 'korrektur', label: 'Korrektur', icon: '✏', desc: 'Wert festlegen'    },
                    { value: 'inventur',  label: 'Inventur',  icon: '▣', desc: 'Zählung erfassen'  },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      className={`inv-bewegungsart-btn ${buchung.bewegungsart === opt.value ? 'active' : ''}`}
                      style={buchung.bewegungsart === opt.value
                        ? { borderColor: BEWEGUNGSART_COLOR[opt.value], background: BEWEGUNGSART_COLOR[opt.value] + '18' }
                        : {}}
                      onClick={() => setBuchung(b => ({ ...b, bewegungsart: opt.value }))}
                    >
                      <span className="inv-bewegungsart-icon">{opt.icon}</span>
                      <span className="inv-bewegungsart-label">{opt.label}</span>
                      <span className="inv-bewegungsart-desc">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Menge — Varianten oder Einzel */}
              {variantenEntries.length > 0 ? (
                <div className="inv-form-group">
                  <label>{isKorrektur ? 'Neuer Bestand je Größe / Variante' : 'Menge je Größe / Variante'}</label>
                  <div className="inv-varianten-eingabe">
                    <div className="inv-varianten-eingabe-header">
                      <span>Größe</span>
                      <span>Aktuell</span>
                      <span>{isKorrektur ? 'Neu' : 'Menge'}</span>
                      <span>Ergebnis</span>
                    </div>
                    {variantenEntries.map(([key, v]) => {
                      const groesse = key.split('|')[0];
                      const bestand = v.bestand ?? 0;
                      const mengeStr = variantMengen[key] ?? '';
                      const mengeInt = parseInt(mengeStr);
                      let neuerBestand = null;
                      if (mengeStr !== '' && !isNaN(mengeInt) && mengeInt >= 0) {
                        if (isKorrektur)                          neuerBestand = mengeInt;
                        else if (buchung.bewegungsart === 'eingang') neuerBestand = bestand + mengeInt;
                        else                                       neuerBestand = Math.max(0, bestand - mengeInt);
                      }
                      const diff = neuerBestand !== null ? neuerBestand - bestand : null;
                      return (
                        <div key={key} className="inv-varianten-eingabe-row">
                          <span className="inv-var-label">{groesse}</span>
                          <span className="inv-var-bestand" style={{ color: bestand === 0 ? '#e74c3c' : 'inherit' }}>{bestand}</span>
                          <input
                            className="inv-input-sm"
                            type="number"
                            min="0"
                            value={mengeStr}
                            onChange={e => setVariantMengen(prev => ({ ...prev, [key]: e.target.value }))}
                            placeholder="—"
                          />
                          <span className={`inv-var-preview ${diff !== null ? (diff > 0 ? 'pos' : diff < 0 ? 'neg' : 'zero') : ''}`}>
                            {neuerBestand !== null ? neuerBestand : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="inv-form-group">
                  <label>{isKorrektur ? 'Neuer Bestand (absolut)' : 'Menge'}</label>
                  <div className="inv-current-stock">
                    <span>Aktueller Bestand</span>
                    <strong>{selectedArtikel.lagerbestand} Stk.</strong>
                  </div>
                  <input
                    className="inv-input"
                    type="number"
                    min="0"
                    value={buchung.menge}
                    onChange={e => setBuchung(b => ({ ...b, menge: e.target.value }))}
                    placeholder={isKorrektur ? `Aktuell: ${selectedArtikel.lagerbestand}` : 'Anzahl eingeben...'}
                    autoFocus
                  />
                  {!isKorrektur && buchung.menge && parseInt(buchung.menge) > 0 && (
                    <div className="inv-preview">
                      Neuer Bestand: <strong>
                        {buchung.bewegungsart === 'eingang'
                          ? selectedArtikel.lagerbestand + parseInt(buchung.menge)
                          : Math.max(0, selectedArtikel.lagerbestand - parseInt(buchung.menge))}
                      </strong> Stk.
                    </div>
                  )}
                  {isKorrektur && buchung.menge !== '' && (
                    <div className="inv-preview">
                      Differenz: <strong style={{ color: parseInt(buchung.menge) >= selectedArtikel.lagerbestand ? '#27ae60' : '#e74c3c' }}>
                        {parseInt(buchung.menge) >= selectedArtikel.lagerbestand ? '+' : ''}{parseInt(buchung.menge) - selectedArtikel.lagerbestand}
                      </strong> Stk.
                    </div>
                  )}
                </div>
              )}

              {/* Bemerkung */}
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
              <button
                className="btn-primary"
                onClick={submitBuchung}
                disabled={buchungLoading || (variantenEntries.length === 0 && buchung.menge === '')}
              >
                {buchungLoading ? 'Wird gebucht...' : 'Buchung speichern'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
