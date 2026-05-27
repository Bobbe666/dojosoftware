import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useDojoContext } from '../../context/DojoContext';
import { useAuth } from '../../context/AuthContext';

const STATUS_LABELS = {
  offen: { label: 'Offen', color: '#F59E0B' },
  in_bearbeitung: { label: 'In Bearbeitung', color: '#3B82F6' },
  versendet: { label: 'Versendet', color: '#8B5CF6' },
  abgeschlossen: { label: 'Abgeschlossen', color: '#22C55E' },
  storniert: { label: 'Storniert', color: '#EF4444' }
};

const SP_STATUS = {
  offen:      { label: 'Offen',      color: '#F59E0B' },
  in_einzug:  { label: 'Im Einzug',  color: '#3B82F6' },
  bezahlt:    { label: 'Bezahlt',    color: '#22C55E' },
  storniert:  { label: 'Storniert',  color: '#EF4444' }
};

const STATUS_FLOW = ['offen', 'in_bearbeitung', 'versendet', 'abgeschlossen'];

export default function ShopBestellungenVerwaltung({ dojoParam = '', dojoId }) {
  const { activeDojo } = useDojoContext();
  const { user } = useAuth();

  // Ermittle die Dojo-ID verlässlich aus Kontext (Fallback: Prop, dann JWT)
  const isSuperAdmin = (user?.role === 'admin' || user?.rolle === 'admin') && !user?.dojo_id;
  const contextDojoId = (activeDojo && typeof activeDojo === 'object') ? activeDojo.id : null;
  const resolvedDojoId = contextDojoId || dojoId || null;
  // Für Super-Admin Query-Param bauen, reguläre Admins nutzen JWT
  const resolvedDojoParam = dojoParam || (isSuperAdmin && resolvedDojoId ? `?dojo_id=${resolvedDojoId}` : '');

  const [activeTab, setActiveTab] = useState('shop');

  // ── Shop-Bestellungen State ────────────────────────────────────────
  const [bestellungen, setBestellungen] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedBestellung, setSelectedBestellung] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [trackingForm, setTrackingForm] = useState({ tracking_nummer: '', versand_dienstleister: '' });
  const [showTracking, setShowTracking] = useState(false);
  const LIMIT = 20;

  // ── Starterpaket-Bestellungen State ───────────────────────────────
  const [spBestellungen, setSpBestellungen] = useState([]);
  const [spTotal, setSpTotal] = useState(0);
  const [spLoading, setSpLoading] = useState(false);
  const [spStatusFilter, setSpStatusFilter] = useState('');
  const [spPage, setSpPage] = useState(1);
  const [selectedSp, setSelectedSp] = useState(null);
  const SP_LIMIT = 20;

  // ── Neue Bestellung Modal State ───────────────────────────────────
  const [showNeueBestellung, setShowNeueBestellung] = useState(false);
  const [nbPakete, setNbPakete] = useState([]);
  const [nbMitglieder, setNbMitglieder] = useState([]);
  const [nbSelectedPaket, setNbSelectedPaket] = useState('');
  const [nbMitgliedSearch, setNbMitgliedSearch] = useState('');
  const [nbSelectedMitglieder, setNbSelectedMitglieder] = useState([]);
  const [nbLoading, setNbLoading] = useState(false);
  const [nbSaving, setNbSaving] = useState(false);
  const [nbError, setNbError] = useState('');
  const [nbSuccess, setNbSuccess] = useState('');

  const loadBestellungen = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (statusFilter) params.append('status', statusFilter);
      // resolvedDojoParam ist z.B. '?dojo_id=2' — muss mit & angehängt werden
      const sep = resolvedDojoParam ? (resolvedDojoParam.startsWith('?') ? '&' : '?') : '';
      const { data } = await axios.get(`/shop/admin/bestellungen?${params}${resolvedDojoParam ? sep + resolvedDojoParam.replace('?', '') : ''}`);
      setBestellungen(data.bestellungen);
      setTotal(data.total);
    } catch (err) {
      console.error('Fehler beim Laden:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, resolvedDojoParam]);

  useEffect(() => { loadBestellungen(); }, [loadBestellungen]);

  // ── Starterpaket-Bestellungen laden ───────────────────────────────
  const loadSpBestellungen = useCallback(async () => {
    setSpLoading(true);
    try {
      const params = new URLSearchParams({ page: spPage, limit: SP_LIMIT });
      if (spStatusFilter) params.append('status', spStatusFilter);
      const sep = resolvedDojoParam ? (resolvedDojoParam.startsWith('?') ? '&' : '?') : '';
      const url = `/starterpakete/bestellungen?${params}${resolvedDojoParam ? sep + resolvedDojoParam.replace('?', '') : ''}`;
      const { data } = await axios.get(url);
      if (data.success) {
        setSpBestellungen(data.bestellungen);
        setSpTotal(data.total);
      }
    } catch (err) {
      console.error('Fehler beim Laden der SP-Bestellungen:', err);
    } finally {
      setSpLoading(false);
    }
  }, [spPage, spStatusFilter, resolvedDojoParam]);

  useEffect(() => {
    if (activeTab === 'starterpakete') loadSpBestellungen();
  }, [activeTab, loadSpBestellungen]);

  const openNeueBestellung = async () => {
    setShowNeueBestellung(true);
    setNbSelectedPaket('');
    setNbSelectedMitglieder([]);
    setNbMitgliedSearch('');
    setNbError('');
    setNbSuccess('');
    setNbLoading(true);
    try {
      const [paketeRes, mitgliederRes] = await Promise.all([
        axios.get(`/starterpakete${resolvedDojoParam}`),
        axios.get(`/mitglieder/all${resolvedDojoParam}`),
      ]);
      setNbPakete((paketeRes.data.pakete || []).filter(p => p.aktiv));
      setNbMitglieder(mitgliederRes.data || []);
    } catch (err) {
      if (err.response?.status === 400) {
        setNbError('Kein Dojo ausgewählt — bitte zuerst ein Dojo im Dashboard aktivieren.');
      } else {
        setNbError('Fehler beim Laden der Daten');
      }
    } finally {
      setNbLoading(false);
    }
  };

  const toggleNbMitglied = (id) => {
    setNbSelectedMitglieder(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const submitNeueBestellung = async () => {
    if (!nbSelectedPaket || nbSelectedMitglieder.length === 0) {
      setNbError('Bitte Paket und mindestens ein Mitglied auswählen');
      return;
    }
    setNbSaving(true);
    setNbError('');
    let erfolge = 0;
    let fehler = 0;
    for (const mitglied_id of nbSelectedMitglieder) {
      try {
        await axios.post(`/starterpakete/${nbSelectedPaket}/bestellen${resolvedDojoParam}`, { mitglied_id });
        erfolge++;
      } catch {
        fehler++;
      }
    }
    setNbSaving(false);
    if (fehler === 0) {
      setNbSuccess(`${erfolge} Bestellung${erfolge !== 1 ? 'en' : ''} erfolgreich angelegt.`);
      setNbSelectedMitglieder([]);
      loadSpBestellungen();
    } else {
      setNbError(`${erfolge} erfolgreich, ${fehler} fehlgeschlagen.`);
      if (erfolge > 0) loadSpBestellungen();
    }
  };

  const updateSpStatus = async (id, status) => {
    try {
      const sep = resolvedDojoParam ? (resolvedDojoParam.startsWith('?') ? '&' : '?') : '';
      await axios.patch(`/starterpakete/bestellungen/${id}/status${resolvedDojoParam ? resolvedDojoParam : ''}`, { status });
      setSpBestellungen(prev => prev.map(b => b.id === id ? { ...b, status } : b));
      if (selectedSp?.id === id) setSelectedSp(prev => ({ ...prev, status }));
    } catch (err) {
      alert('Fehler beim Aktualisieren des Status');
    }
  };

  const openDetail = async (b) => {
    setDetailLoading(true);
    setSelectedBestellung(b);
    try {
      const { data } = await axios.get(`/shop/admin/bestellungen/${b.id}${resolvedDojoParam}`);
      setSelectedBestellung(data);
      setTrackingForm({
        tracking_nummer: data.tracking_nummer || '',
        versand_dienstleister: data.versand_dienstleister || ''
      });
    } catch (err) {
      console.error('Fehler beim Laden:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(`/shop/admin/bestellungen/${id}/status${resolvedDojoParam}`, { status });
      loadBestellungen();
      if (selectedBestellung?.id === id) {
        setSelectedBestellung(prev => ({ ...prev, status }));
      }
    } catch (err) {
      alert('Fehler beim Aktualisieren des Status');
    }
  };

  const saveTracking = async () => {
    if (!selectedBestellung) return;
    try {
      await axios.patch(`/shop/admin/bestellungen/${selectedBestellung.id}/tracking${resolvedDojoParam}`, trackingForm);
      setSelectedBestellung(prev => ({ ...prev, ...trackingForm, status: 'versendet' }));
      setShowTracking(false);
      loadBestellungen();
    } catch (err) {
      alert('Fehler beim Speichern des Trackings');
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const formatEur = (cent) => `${((cent || 0) / 100).toFixed(2)} €`;

  const pages = Math.ceil(total / LIMIT);

  const spPages = Math.ceil(spTotal / SP_LIMIT);

  return (
    <div className="shop-admin-content shop-bestellungen">
      {/* ── Tab-Leiste ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.25rem' }}>
        {[
          { key: 'shop', label: `🛒 Shop-Bestellungen`, count: total },
          { key: 'starterpakete', label: `🎁 Starterpakete`, count: spTotal },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.65rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #d4af37' : '2px solid transparent',
              color: activeTab === tab.key ? '#d4af37' : 'rgba(255,255,255,0.5)',
              fontWeight: activeTab === tab.key ? 700 : 400,
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontFamily: 'inherit',
              marginBottom: '-1px',
              transition: 'color 0.2s',
            }}
          >
            {tab.label}
            {tab.count > 0 && <span style={{ marginLeft: '0.4rem', fontSize: '0.78rem', opacity: 0.7 }}>({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* ── Shop-Tab ── */}
      {activeTab === 'shop' && (<>
      <div className="shop-admin-header">
        <h2>Bestellungen ({total})</h2>
        <div className="shop-filter-bar">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">Alle Status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="shop-bestellungen-layout">
        {/* Liste */}
        <div className="shop-bestellungen-list">
          {loading ? (
            <div className="shop-loading">Lade Bestellungen...</div>
          ) : bestellungen.length === 0 ? (
            <div className="shop-empty">Keine Bestellungen gefunden</div>
          ) : (
            <>
              {bestellungen.map(b => {
                const s = STATUS_LABELS[b.status] || { label: b.status, color: '#6B7280' };
                const isSelected = selectedBestellung?.id === b.id;
                return (
                  <div
                    key={b.id}
                    className={`shop-bestellung-item ${isSelected ? 'active' : ''}`}
                    onClick={() => openDetail(b)}
                  >
                    <div className="shop-bestellung-row">
                      <span className="shop-bestellung-nr">{b.bestellnummer}</span>
                      <span className="shop-bestellung-status" style={{ color: s.color }}>{s.label}</span>
                    </div>
                    <div className="shop-bestellung-row">
                      <span>{b.kunde_name}</span>
                      <strong>{formatEur(b.gesamtbetrag_cent)}</strong>
                    </div>
                    <div className="shop-bestellung-date">{formatDate(b.bestellt_am)}</div>
                    <div className="shop-bestellung-meta">
                      {b.anzahl_positionen} Artikel · {b.zahlungsart} · {b.bezahlt ? '✅ Bezahlt' : '⏳ Ausstehend'}
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {pages > 1 && (
                <div className="shop-pagination">
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Zurück</button>
                  <span>{page} / {pages}</span>
                  <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Weiter →</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail */}
        <div className="shop-bestellung-detail">
          {!selectedBestellung ? (
            <div className="shop-empty">Bestellung auswählen</div>
          ) : detailLoading ? (
            <div className="shop-loading">Lade Details...</div>
          ) : (
            <>
              <div className="shop-detail-header">
                <h3>{selectedBestellung.bestellnummer}</h3>
                <span className="shop-bestellung-status" style={{ color: STATUS_LABELS[selectedBestellung.status]?.color }}>
                  {STATUS_LABELS[selectedBestellung.status]?.label || selectedBestellung.status}
                </span>
              </div>

              {/* Status-Flow */}
              <div className="shop-status-flow">
                {STATUS_FLOW.map(s => (
                  <button
                    key={s}
                    className={`shop-status-btn ${selectedBestellung.status === s ? 'active' : ''}`}
                    style={{ borderColor: STATUS_LABELS[s].color }}
                    onClick={() => updateStatus(selectedBestellung.id, s)}
                  >
                    {STATUS_LABELS[s].label}
                  </button>
                ))}
                <button
                  className={`shop-status-btn ${selectedBestellung.status === 'storniert' ? 'active' : ''}`}
                  style={{ borderColor: STATUS_LABELS.storniert.color }}
                  onClick={() => updateStatus(selectedBestellung.id, 'storniert')}
                >
                  Stornieren
                </button>
              </div>

              {/* Kundeninfo */}
              <div className="shop-detail-section">
                <h4>Kunde</h4>
                <p>{selectedBestellung.kunde_name}</p>
                <p>{selectedBestellung.kunde_email}</p>
              </div>

              <div className="shop-detail-section">
                <h4>Lieferadresse</h4>
                <p>
                  {selectedBestellung.lieferadresse_strasse}<br />
                  {selectedBestellung.lieferadresse_plz} {selectedBestellung.lieferadresse_ort}<br />
                  {selectedBestellung.lieferadresse_land}
                </p>
              </div>

              {/* Positionen */}
              <div className="shop-detail-section">
                <h4>Artikel</h4>
                {selectedBestellung.positionen?.map((p, i) => (
                  <div key={i} className="shop-position-row">
                    <span>{p.menge}× {p.produkt_name}</span>
                    {p.produkt_variante && <span className="shop-variante"> ({p.produkt_variante})</span>}
                    {p.personalisierung && (
                      <div className="shop-personalisierung">
                        {Object.entries(p.personalisierung).map(([k, v]) => (
                          <span key={k}>{k}: {v}</span>
                        ))}
                      </div>
                    )}
                    <span style={{ marginLeft: 'auto' }}>{formatEur(p.gesamtpreis_cent)}</span>
                  </div>
                ))}
                <div className="shop-position-summe">
                  <span>Zwischensumme</span>
                  <span>{formatEur(selectedBestellung.zwischensumme_cent)}</span>
                </div>
                <div className="shop-position-summe">
                  <span>Versandkosten</span>
                  <span>{selectedBestellung.versandkosten_cent === 0 ? 'Kostenlos' : formatEur(selectedBestellung.versandkosten_cent)}</span>
                </div>
                <div className="shop-position-summe shop-position-summe--total">
                  <span>Gesamt</span>
                  <strong>{formatEur(selectedBestellung.gesamtbetrag_cent)}</strong>
                </div>
              </div>

              {/* Zahlungsinfo */}
              <div className="shop-detail-section">
                <h4>Zahlung</h4>
                <p>{selectedBestellung.zahlungsart} · {selectedBestellung.bezahlt ? '✅ Bezahlt' : '⏳ Ausstehend'}</p>
                {selectedBestellung.stripe_payment_intent_id && (
                  <p style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>
                    Stripe: {selectedBestellung.stripe_payment_intent_id}
                  </p>
                )}
              </div>

              {/* Tracking */}
              <div className="shop-detail-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4>Versand-Tracking</h4>
                  <button className="btn-sm btn-secondary" onClick={() => setShowTracking(!showTracking)}>
                    {showTracking ? 'Abbrechen' : 'Tracking eintragen'}
                  </button>
                </div>
                {selectedBestellung.tracking_nummer && (
                  <p>
                    {selectedBestellung.versand_dienstleister && `${selectedBestellung.versand_dienstleister}: `}
                    <strong>{selectedBestellung.tracking_nummer}</strong>
                  </p>
                )}
                {showTracking && (
                  <div className="shop-tracking-form">
                    <input
                      placeholder="Dienstleister (z.B. DHL)"
                      value={trackingForm.versand_dienstleister}
                      onChange={e => setTrackingForm(f => ({ ...f, versand_dienstleister: e.target.value }))}
                    />
                    <input
                      placeholder="Tracking-Nummer"
                      value={trackingForm.tracking_nummer}
                      onChange={e => setTrackingForm(f => ({ ...f, tracking_nummer: e.target.value }))}
                    />
                    <button className="btn-primary btn-sm" onClick={saveTracking}>Speichern</button>
                  </div>
                )}
              </div>

              {/* Bestellt am */}
              <div className="shop-detail-footer">
                Bestellt: {formatDate(selectedBestellung.bestellt_am)}
              </div>
            </>
          )}
        </div>
      </div>
      </>)}

      {/* ── Starterpaket-Tab ── */}
      {activeTab === 'starterpakete' && (
        <div className="shop-bestellungen-layout">
          {/* Liste */}
          <div className="shop-bestellungen-list">
            <div className="shop-admin-header" style={{ marginBottom: '0.875rem' }}>
              <h2 style={{ fontSize: '1rem' }}>Starterpaket-Bestellungen ({spTotal})</h2>
              <div className="shop-filter-bar" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  onClick={openNeueBestellung}
                  style={{
                    padding: '0.45rem 0.9rem',
                    background: 'linear-gradient(135deg, #d4af37, #b8962e)',
                    color: '#1a1a2e',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  + Neue Bestellung
                </button>
                <select value={spStatusFilter} onChange={e => { setSpStatusFilter(e.target.value); setSpPage(1); }}>
                  <option value="">Alle Status</option>
                  {Object.entries(SP_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {spLoading ? (
              <div className="shop-loading">Lade Bestellungen…</div>
            ) : spBestellungen.length === 0 ? (
              <div className="shop-empty">Keine Starterpaket-Bestellungen gefunden</div>
            ) : (
              <>
                {spBestellungen.map(b => {
                  const s = SP_STATUS[b.status] || { label: b.status, color: '#6B7280' };
                  return (
                    <div
                      key={b.id}
                      className={`shop-bestellung-item ${selectedSp?.id === b.id ? 'active' : ''}`}
                      onClick={() => setSelectedSp(b)}
                    >
                      <div className="shop-bestellung-row">
                        <span className="shop-bestellung-nr">#{b.id} · {b.stil_name}</span>
                        <span className="shop-bestellung-status" style={{ color: s.color }}>{s.label}</span>
                      </div>
                      <div className="shop-bestellung-row">
                        <span>{b.mitglied_name}</span>
                        <strong>{formatEur(b.gesamtpreis_cent)}</strong>
                      </div>
                      <div className="shop-bestellung-date">{formatDate(b.erstellt_am)}</div>
                      <div className="shop-bestellung-meta">{b.paket_name} · {b.zahlungsmethode || 'Lastschrift'}</div>
                    </div>
                  );
                })}
                {spPages > 1 && (
                  <div className="shop-pagination">
                    <button disabled={spPage <= 1} onClick={() => setSpPage(p => p - 1)}>← Zurück</button>
                    <span>{spPage} / {spPages}</span>
                    <button disabled={spPage >= spPages} onClick={() => setSpPage(p => p + 1)}>Weiter →</button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Detail */}
          <div className="shop-bestellung-detail">
            {!selectedSp ? (
              <div className="shop-empty">Bestellung auswählen</div>
            ) : (
              <>
                <div className="shop-detail-header">
                  <h3>🎁 {selectedSp.paket_name}</h3>
                  <span className="shop-bestellung-status" style={{ color: SP_STATUS[selectedSp.status]?.color }}>
                    {SP_STATUS[selectedSp.status]?.label || selectedSp.status}
                  </span>
                </div>

                {/* Status-Buttons */}
                <div className="shop-status-flow">
                  {Object.entries(SP_STATUS).map(([k, v]) => (
                    <button
                      key={k}
                      className={`shop-status-btn ${selectedSp.status === k ? 'active' : ''}`}
                      style={{ borderColor: v.color }}
                      onClick={() => updateSpStatus(selectedSp.id, k)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>

                <div className="shop-detail-section">
                  <h4>Mitglied</h4>
                  <p>{selectedSp.mitglied_name}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{selectedSp.mitglied_email}</p>
                </div>

                <div className="shop-detail-section">
                  <h4>Paket</h4>
                  <p>{selectedSp.paket_name}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Stil: {selectedSp.stil_name}</p>
                </div>

                {/* Artikel-Liste */}
                {selectedSp.positionen?.length > 0 && (() => {
                  const variantenMap = (() => {
                    try {
                      return typeof selectedSp.varianten_json === 'string'
                        ? JSON.parse(selectedSp.varianten_json)
                        : (selectedSp.varianten_json || {});
                    } catch { return {}; }
                  })();
                  return (
                    <div className="shop-detail-section">
                      <h4>Artikel</h4>
                      {selectedSp.positionen.map(pos => {
                        const variante = variantenMap[pos.id];
                        return (
                          <div key={pos.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.3rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', gap: '0.75rem' }}>
                            <div>
                              <span style={{ fontSize: '0.88rem' }}>{pos.menge}× <strong>{pos.artikel_name}</strong></span>
                              {variante && <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{variante}</span>}
                            </div>
                            <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{formatEur(pos.einzelpreis_cent * pos.menge)}</span>
                          </div>
                        );
                      })}
                      {selectedSp.rabatt_prozent > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#22c55e', marginTop: '0.4rem' }}>
                          <span>Rabatt ({selectedSp.rabatt_prozent}%)</span>
                          <span>−{formatEur(Math.round(selectedSp.positionen.reduce((s, p) => s + p.einzelpreis_cent * p.menge, 0) * selectedSp.rabatt_prozent / 100))}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="shop-detail-section">
                  <h4>Zahlung</h4>
                  <p>{selectedSp.zahlungsmethode || 'SEPA-Lastschrift'} · {selectedSp.status === 'bezahlt' ? '✅ Bezahlt' : '⏳ Ausstehend'}</p>
                  <div className="shop-position-summe shop-position-summe--total" style={{ marginTop: '0.5rem' }}>
                    <span>Gesamtpreis</span>
                    <strong>{formatEur(selectedSp.gesamtpreis_cent)}</strong>
                  </div>
                </div>

                <div className="shop-detail-footer">
                  Bestellt: {formatDate(selectedSp.erstellt_am)}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Neue Bestellung Modal ── */}
      {showNeueBestellung && (() => {
        const filteredMitglieder = nbMitglieder.filter(m => {
          if (!nbMitgliedSearch) return true;
          const name = `${m.vorname} ${m.nachname}`.toLowerCase();
          return name.includes(nbMitgliedSearch.toLowerCase());
        });
        const selectedPaketObj = nbPakete.find(p => p.paket_id === parseInt(nbSelectedPaket, 10));

        return (
          <div
            onClick={e => { if (e.target === e.currentTarget) setShowNeueBestellung(false); }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '1rem',
            }}
          >
            <div style={{
              background: 'rgba(26,26,46,0.99)',
              border: '1px solid rgba(212,175,55,0.3)',
              borderRadius: '12px',
              padding: '1.5rem',
              width: '100%',
              maxWidth: '540px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#d4af37', fontSize: '1.1rem' }}>🎁 Neue Starterpaket-Bestellung</h3>
                <button
                  onClick={() => setShowNeueBestellung(false)}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '1.3rem', cursor: 'pointer', padding: '0.2rem 0.4rem' }}
                >✕</button>
              </div>

              {nbLoading ? (
                <div style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', padding: '2rem 0' }}>Lade Daten…</div>
              ) : (<>
                {/* Paket auswählen */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>
                    Starterpaket *
                  </label>
                  <select
                    value={nbSelectedPaket}
                    onChange={e => setNbSelectedPaket(e.target.value)}
                    style={{
                      width: '100%', padding: '0.55rem 0.75rem',
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '6px', color: 'inherit',
                      fontSize: '0.9rem', fontFamily: 'inherit',
                    }}
                  >
                    <option value="">— Bitte auswählen —</option>
                    {nbPakete.map(p => (
                      <option key={p.paket_id} value={p.paket_id}>
                        {p.name}{p.stil_name ? ` (${p.stil_name})` : ''} · {formatEur(p.endpreis_cent || 0)}
                      </option>
                    ))}
                  </select>
                  {selectedPaketObj && (
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', margin: '0.3rem 0 0' }}>
                      {selectedPaketObj.beschreibung || ''}
                    </p>
                  )}
                </div>

                {/* Mitglieder auswählen */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>
                    Mitglieder * ({nbSelectedMitglieder.length} ausgewählt)
                  </label>
                  <input
                    type="text"
                    placeholder="Mitglied suchen…"
                    value={nbMitgliedSearch}
                    onChange={e => setNbMitgliedSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '0.5rem 0.75rem',
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '6px', color: 'inherit',
                      fontSize: '0.88rem', fontFamily: 'inherit',
                      marginBottom: '0.4rem', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    maxHeight: '260px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.03)',
                  }}>
                    {nbMitglieder.length === 0 ? (
                      <div style={{ padding: '0.75rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Keine Mitglieder gefunden</div>
                    ) : filteredMitglieder.length === 0 ? (
                      <div style={{ padding: '0.75rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Keine Treffer</div>
                    ) : (
                      filteredMitglieder.map(m => {
                        const checked = nbSelectedMitglieder.includes(m.mitglied_id);
                        return (
                          <div
                            key={m.mitglied_id}
                            onClick={() => toggleNbMitglied(m.mitglied_id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.6rem',
                              padding: '0.45rem 0.75rem',
                              cursor: 'pointer',
                              background: checked ? 'rgba(212,175,55,0.1)' : 'transparent',
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              transition: 'background 0.15s',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleNbMitglied(m.mitglied_id)}
                              onClick={e => e.stopPropagation()}
                              style={{ accentColor: '#d4af37', width: '14px', height: '14px', cursor: 'pointer', flexShrink: 0 }}
                            />
                            <span style={{ fontSize: '0.88rem' }}>
                              <strong>{m.nachname}</strong>, {m.vorname}
                            </span>
                            {m.stile && (
                              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>{m.stile}</span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  {nbMitglieder.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                      <button
                        onClick={() => setNbSelectedMitglieder(filteredMitglieder.map(m => m.mitglied_id))}
                        style={{ background: 'none', border: 'none', color: '#d4af37', fontSize: '0.78rem', cursor: 'pointer', padding: 0 }}
                      >
                        Alle auswählen
                      </button>
                      <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.78rem' }}>·</span>
                      <button
                        onClick={() => setNbSelectedMitglieder([])}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', cursor: 'pointer', padding: 0 }}
                      >
                        Auswahl leeren
                      </button>
                    </div>
                  )}
                </div>

                {nbError && <p style={{ margin: 0, color: '#EF4444', fontSize: '0.85rem' }}>{nbError}</p>}
                {nbSuccess && <p style={{ margin: 0, color: '#22C55E', fontSize: '0.85rem' }}>{nbSuccess}</p>}

                {/* Aktions-Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: 'auto' }}>
                  <button
                    onClick={() => setShowNeueBestellung(false)}
                    style={{
                      padding: '0.55rem 1.1rem',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '6px', color: 'inherit',
                      fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Schließen
                  </button>
                  <button
                    onClick={submitNeueBestellung}
                    disabled={nbSaving || !nbSelectedPaket || nbSelectedMitglieder.length === 0}
                    style={{
                      padding: '0.55rem 1.25rem',
                      background: nbSaving || !nbSelectedPaket || nbSelectedMitglieder.length === 0
                        ? 'rgba(255,255,255,0.1)'
                        : 'linear-gradient(135deg, #d4af37, #b8962e)',
                      border: 'none',
                      borderRadius: '6px',
                      color: nbSaving || !nbSelectedPaket || nbSelectedMitglieder.length === 0
                        ? 'rgba(255,255,255,0.3)'
                        : '#1a1a2e',
                      fontWeight: 700, fontSize: '0.88rem',
                      cursor: nbSaving || !nbSelectedPaket || nbSelectedMitglieder.length === 0 ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {nbSaving
                      ? 'Wird gespeichert…'
                      : `${nbSelectedMitglieder.length > 0 ? nbSelectedMitglieder.length + ' ' : ''}Bestellung${nbSelectedMitglieder.length !== 1 ? 'en' : ''} anlegen`}
                  </button>
                </div>
              </>)}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
