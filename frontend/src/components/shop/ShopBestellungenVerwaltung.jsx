import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const STATUS_LABELS = {
  offen: { label: 'Offen', color: '#F59E0B' },
  in_bearbeitung: { label: 'In Bearbeitung', color: '#3B82F6' },
  versendet: { label: 'Versendet', color: '#8B5CF6' },
  abgeschlossen: { label: 'Abgeschlossen', color: '#22C55E' },
  storniert: { label: 'Storniert', color: '#EF4444' }
};

const STATUS_FLOW = ['offen', 'in_bearbeitung', 'versendet', 'abgeschlossen'];

export default function ShopBestellungenVerwaltung({ dojoParam = '' }) {
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

  const loadBestellungen = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (statusFilter) params.append('status', statusFilter);
      // dojoParam ist z.B. '?dojo_id=2' — muss mit & angehängt werden
      const sep = dojoParam ? (dojoParam.startsWith('?') ? '&' : '?') : '';
      const { data } = await axios.get(`/shop/admin/bestellungen?${params}${dojoParam ? sep + dojoParam.replace('?', '') : ''}`);
      setBestellungen(data.bestellungen);
      setTotal(data.total);
    } catch (err) {
      console.error('Fehler beim Laden:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, dojoParam]);

  useEffect(() => { loadBestellungen(); }, [loadBestellungen]);

  const openDetail = async (b) => {
    setDetailLoading(true);
    setSelectedBestellung(b);
    try {
      const { data } = await axios.get(`/shop/admin/bestellungen/${b.id}${dojoParam}`);
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
      await axios.patch(`/shop/admin/bestellungen/${id}/status${dojoParam}`, { status });
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
      await axios.patch(`/shop/admin/bestellungen/${selectedBestellung.id}/tracking${dojoParam}`, trackingForm);
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

  return (
    <div className="shop-admin-content shop-bestellungen">
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
    </div>
  );
}
