// =============================================================================
// MemberShopWidgets — Gutscheine + Marketing-Artikel (aus MemberDashboard
// extrahiert). Hält eigenen State + eigene Fetches → entlastet den
// MemberDashboard-Monolithen: diese Karten rendern nur noch bei eigenen
// Datenänderungen, nicht bei jedem Parent-Re-Render. React.memo.
// =============================================================================
import React, { useState, useEffect } from 'react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';

// Nicht-kritische Arbeit erst nach erstem Paint (iOS-Safari-Fallback).
const deferIdle = (cb) =>
  (typeof window !== 'undefined' && window.requestIdleCallback)
    ? window.requestIdleCallback(cb, { timeout: 1500 })
    : setTimeout(cb, 250);

function MemberShopWidgets({ mitgliedId, dojoId }) {
  const [meineGutscheine, setMeineGutscheine] = useState([]);
  const [marketingArtikel, setMarketingArtikel] = useState([]);
  const [meineArtikelBestellungen, setMeineArtikelBestellungen] = useState([]);
  const [artikelBestellLoading, setArtikelBestellLoading] = useState(null);
  const [artikelBestellSuccess, setArtikelBestellSuccess] = useState('');

  useEffect(() => {
    deferIdle(() => {
      fetchWithAuth(`${config.apiBaseUrl}/gutscheine/meine`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.success) setMeineGutscheine(d.gutscheine); })
        .catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (!dojoId || !mitgliedId) return;
    deferIdle(() => {
      fetchWithAuth(`${config.apiBaseUrl}/marketing-artikel/member?dojo_id=${dojoId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.success) setMarketingArtikel(d.artikel || []); })
        .catch(() => {});
      fetchWithAuth(`${config.apiBaseUrl}/marketing-artikel/member/meine-bestellungen?dojo_id=${dojoId}&mitglied_id=${mitgliedId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setMeineArtikelBestellungen(d.bestellungen || []); })
        .catch(() => {});
    });
  }, [dojoId, mitgliedId]);

  const handleArtikelBestellen = async (artikelId) => {
    if (!dojoId || !mitgliedId) return;
    setArtikelBestellLoading(artikelId);
    setArtikelBestellSuccess('');
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/marketing-artikel/${artikelId}/bestellen?dojo_id=${dojoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitglied_id: mitgliedId, menge: 1 }),
      });
      const data = await res.json();
      if (data.success) {
        setArtikelBestellSuccess('Bestellung erfolgreich übermittelt!');
        fetchWithAuth(`${config.apiBaseUrl}/marketing-artikel/member/meine-bestellungen?dojo_id=${dojoId}&mitglied_id=${mitgliedId}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) setMeineArtikelBestellungen(d.bestellungen || []); })
          .catch(() => {});
      } else {
        setArtikelBestellSuccess('Fehler: ' + (data.error || 'Unbekannt'));
      }
    } catch (e) {
      setArtikelBestellSuccess('Fehler beim Bestellen');
    } finally {
      setArtikelBestellLoading(null);
    }
  };

  const offeneGutscheine = meineGutscheine.filter(g => !g.eingeloest && !g.abgelaufen);

  return (
    <>
      {/* Meine Gutscheine */}
      {offeneGutscheine.length > 0 && (
        <div className="md-info-card" style={{ '--card-accent': '#f59e0b' }}>
          <div className="mb-flex-center-gap" style={{ marginBottom: 12 }}>
            <div className="mb-icon-lg">🎁</div>
            <h4 className="md-section-heading" style={{ margin: 0 }}>Meine Gutscheine</h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {offeneGutscheine.map(g => {
              const rest = g.restbetrag_cent / 100;
              const total = g.wert_cent / 100;
              const pct = Math.round((g.restbetrag_cent / g.wert_cent) * 100);
              return (
                <div key={g.id} style={{
                  background: 'var(--bg-primary, #0f172a)',
                  border: '1px solid var(--border-color, #334155)',
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary, #e2e8f0)' }}>{g.titel}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#f59e0b', marginTop: 2 }}>{g.code}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#22c55e' }}>{rest.toFixed(2)}€</div>
                      {g.verbraucht_cent > 0 && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>von {total.toFixed(2)}€</div>}
                    </div>
                  </div>
                  <div style={{ background: 'var(--border-color, #334155)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#22c55e', borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                  {g.gueltig_bis && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginTop: 5 }}>
                      Gültig bis {new Date(g.gueltig_bis).toLocaleDateString('de-DE')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Marketing-Artikel: Vorverkauf & Bestellung */}
      {marketingArtikel.length > 0 && (
        <div className="md-info-card" style={{ '--card-accent': '#d4af37' }}>
          <div className="mb-flex-center-gap" style={{ marginBottom: 12 }}>
            <div className="mb-icon-lg">🛍️</div>
            <h4 className="md-section-heading" style={{ margin: 0 }}>Aktionen & Bestellungen</h4>
          </div>
          {artikelBestellSuccess && (
            <div style={{
              background: artikelBestellSuccess.startsWith('Fehler') ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)',
              border: `1px solid ${artikelBestellSuccess.startsWith('Fehler') ? '#ef4444' : '#22c55e'}`,
              borderRadius: 8, padding: '0.5rem 0.75rem', marginBottom: 10,
              fontSize: '0.82rem', color: artikelBestellSuccess.startsWith('Fehler') ? '#fca5a5' : '#86efac',
            }}>{artikelBestellSuccess}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {marketingArtikel.map(a => {
              const bereitsbestellt = meineArtikelBestellungen.some(b => b.artikel_name === a.name && b.status !== 'storniert');
              const typLabel = { bestellung: 'Bestellung', vorverkauf: 'Vorverkauf', beides: 'Vorverkauf' }[a.typ] || 'Bestellung';
              const typColor = { bestellung: '#3b82f6', vorverkauf: '#f59e0b', beides: '#f59e0b' }[a.typ] || '#888';
              return (
                <div key={a.id} style={{
                  background: 'var(--bg-primary, #0f172a)',
                  border: '1px solid var(--border-color, #334155)',
                  borderRadius: 10, padding: '12px 14px',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                }}>
                  {a.bild_url && <img src={a.bild_url} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary, #e2e8f0)' }}>{a.name}</span>
                      <span style={{ background: typColor, color: 'var(--ds-text)', borderRadius: 4, padding: '1px 7px', fontSize: '0.68rem', fontWeight: 600 }}>{typLabel}</span>
                    </div>
                    {a.beschreibung && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', margin: '0 0 6px' }}>{a.beschreibung}</p>}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#d4af37' }}>{(a.preis_cent / 100).toFixed(2)} €</span>
                        {a.lieferdatum && (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: 8 }}>
                            Lieferung: {new Date(a.lieferdatum).toLocaleDateString('de-DE')}
                          </span>
                        )}
                        {a.vorverkauf_bis && (
                          <span style={{ fontSize: '0.72rem', color: '#f59e0b', marginLeft: 8 }}>
                            bis {new Date(a.vorverkauf_bis).toLocaleDateString('de-DE')}
                          </span>
                        )}
                      </div>
                      {bereitsbestellt ? (
                        <span style={{ fontSize: '0.78rem', color: '#22c55e', fontWeight: 600 }}>✓ Bestellt</span>
                      ) : (
                        <button
                          onClick={() => handleArtikelBestellen(a.id)}
                          disabled={artikelBestellLoading === a.id}
                          style={{
                            padding: '0.35rem 1rem', borderRadius: 8, border: 'none',
                            background: '#d4af37', color: '#000', fontWeight: 700,
                            cursor: artikelBestellLoading === a.id ? 'wait' : 'pointer',
                            fontSize: '0.82rem', opacity: artikelBestellLoading === a.id ? 0.7 : 1,
                          }}>
                          {artikelBestellLoading === a.id ? 'Wird bestellt…' : 'Jetzt bestellen'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export default React.memo(MemberShopWidgets);
