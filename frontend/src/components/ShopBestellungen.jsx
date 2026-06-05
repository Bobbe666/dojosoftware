import React, { useState, useEffect } from 'react';
import axios from 'axios';

// ============================================================================
// Shop-Bestellungen (Verband-Shop) — ausgelagert aus SuperAdminDashboard.jsx.
// Eigenständig: lädt Bestellungen + Stats selbst, verwaltet Status-Workflow
// (offen → in_bearbeitung → versendet → abgeschlossen / storniert).
// ============================================================================

const ShopBestellungen = ({ token }) => {
  const [bestellungen, setBestellungen] = useState([]);
  const [bestellungenStats, setBestellungenStats] = useState(null);
  const [bestellungenLoading, setBestellungenLoading] = useState(false);
  const [bestellungenFilter, setBestellungenFilter] = useState('alle');
  const [selectedBestellung, setSelectedBestellung] = useState(null);
  const [bestellungUpdating, setBestellungUpdating] = useState(false);

  const loadBestellungen = async (statusFilter = 'alle') => {
    try {
      setBestellungenLoading(true);
      const params = statusFilter !== 'alle' ? `?status=${statusFilter}` : '';
      const response = await axios.get(`/verband-auth/admin/bestellungen${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setBestellungen(response.data.bestellungen);
        setBestellungenStats(response.data.stats);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Bestellungen:', error);
    } finally {
      setBestellungenLoading(false);
    }
  };

  const updateBestellungStatus = async (bestellungId, updates) => {
    try {
      setBestellungUpdating(true);
      const response = await axios.put(`/verband-auth/admin/bestellungen/${bestellungId}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        await loadBestellungen(bestellungenFilter);
        setSelectedBestellung(null);
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Bestellung:', error);
      alert('Fehler beim Aktualisieren');
    } finally {
      setBestellungUpdating(false);
    }
  };

  useEffect(() => {
    loadBestellungen(bestellungenFilter);
  }, [bestellungenFilter]);

  return (
              <section className="bestellungen-section">
                <h2 className="section-title">📦 Shop-Bestellungen</h2>
                {bestellungenStats && (
                  <div className="bestellungen-stats">
                    <div className="stat-card stat-offen" onClick={() => setBestellungenFilter('offen')}><span className="stat-number">{bestellungenStats.offen || 0}</span><span className="stat-label">Offen</span></div>
                    <div className="stat-card stat-bearbeitung" onClick={() => setBestellungenFilter('in_bearbeitung')}><span className="stat-number">{bestellungenStats.in_bearbeitung || 0}</span><span className="stat-label">In Bearbeitung</span></div>
                    <div className="stat-card stat-versendet" onClick={() => setBestellungenFilter('versendet')}><span className="stat-number">{bestellungenStats.versendet || 0}</span><span className="stat-label">Versendet</span></div>
                    <div className="stat-card stat-abgeschlossen" onClick={() => setBestellungenFilter('abgeschlossen')}><span className="stat-number">{bestellungenStats.abgeschlossen || 0}</span><span className="stat-label">Abgeschlossen</span></div>
                    <div className="stat-card stat-alle" onClick={() => setBestellungenFilter('alle')}><span className="stat-number">{bestellungenStats.gesamt || 0}</span><span className="stat-label">Gesamt</span></div>
                  </div>
                )}

            {/* Filter */}
            <div className="bestellungen-filter">
              <label>Status:</label>
              <select value={bestellungenFilter} onChange={(e) => setBestellungenFilter(e.target.value)}>
                <option value="alle">Alle</option>
                <option value="offen">Offen</option>
                <option value="in_bearbeitung">In Bearbeitung</option>
                <option value="versendet">Versendet</option>
                <option value="abgeschlossen">Abgeschlossen</option>
                <option value="storniert">Storniert</option>
              </select>
            </div>

            {/* Bestellungen-Liste */}
            {bestellungenLoading ? (
              <div className="loading-spinner">Lade Bestellungen...</div>
            ) : bestellungen.length === 0 ? (
              <div className="empty-state">
                <p>Keine Bestellungen gefunden.</p>
              </div>
            ) : (
              <div className="bestellungen-liste">
                {bestellungen.map(bestellung => (
                  <div
                    key={bestellung.id}
                    className={`bestellung-card ${selectedBestellung?.id === bestellung.id ? 'selected' : ''}`}
                    onClick={() => setSelectedBestellung(selectedBestellung?.id === bestellung.id ? null : bestellung)}
                  >
                    <div className="bestellung-header">
                      <span className="bestellung-nummer">{bestellung.bestellnummer}</span>
                      <span className={`bestellung-status status-${bestellung.status}`}>
                        {bestellung.status === 'offen' && '🟡 Offen'}
                        {bestellung.status === 'in_bearbeitung' && '🔵 In Bearbeitung'}
                        {bestellung.status === 'versendet' && '📬 Versendet'}
                        {bestellung.status === 'abgeschlossen' && '✅ Abgeschlossen'}
                        {bestellung.status === 'storniert' && '❌ Storniert'}
                      </span>
                    </div>
                    <div className="bestellung-info">
                      <div className="bestellung-kunde">
                        <strong>{bestellung.kunde_name}</strong>
                        <span>{bestellung.kunde_email}</span>
                        {bestellung.mitgliedsnummer && <span className="mitglied-nr">({bestellung.mitgliedsnummer})</span>}
                      </div>
                      <div className="bestellung-betrag">
                        <strong>{bestellung.gesamtbetrag_euro?.toFixed(2)} €</strong>
                        <span>{bestellung.anzahl_positionen} Artikel</span>
                      </div>
                      <div className="bestellung-datum">
                        {new Date(bestellung.bestellt_am).toLocaleDateString('de-DE', {
                          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>

                    {/* Aufgeklappte Details */}
                    {selectedBestellung?.id === bestellung.id && (
                      <div className="bestellung-details">
                        <div className="details-section">
                          <h4>Lieferadresse</h4>
                          <p>
                            {bestellung.lieferadresse_strasse}<br />
                            {bestellung.lieferadresse_plz} {bestellung.lieferadresse_ort}<br />
                            {bestellung.lieferadresse_land}
                          </p>
                        </div>

                        <div className="details-section">
                          <h4>Bestellte Artikel</h4>
                          <table className="positionen-table">
                            <thead>
                              <tr>
                                <th>Artikel</th>
                                <th>Variante</th>
                                <th>Menge</th>
                                <th>Preis</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bestellung.positionen?.map((pos, idx) => (
                                <tr key={idx}>
                                  <td>{pos.artikel_name}</td>
                                  <td>{pos.variante || '-'}</td>
                                  <td>{pos.menge}</td>
                                  <td>{(pos.gesamtpreis_cent / 100).toFixed(2)} €</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {bestellung.kundennotiz && (
                          <div className="details-section">
                            <h4>Kundennotiz</h4>
                            <p className="kundennotiz">{bestellung.kundennotiz}</p>
                          </div>
                        )}

                        <div className="details-section">
                          <h4>Status ändern</h4>
                          <div className="status-actions">
                            {bestellung.status === 'offen' && (
                              <button
                                className="btn btn-primary"
                                onClick={(e) => { e.stopPropagation(); updateBestellungStatus(bestellung.id, { status: 'in_bearbeitung' }); }}
                                disabled={bestellungUpdating}
                              >
                                In Bearbeitung nehmen
                              </button>
                            )}
                            {bestellung.status === 'in_bearbeitung' && (
                              <>
                                <input
                                  type="text"
                                  placeholder="Tracking-Nummer (optional)"
                                  className="tracking-input"
                                  onClick={(e) => e.stopPropagation()}
                                  id={`tracking-${bestellung.id}`}
                                />
                                <button
                                  className="btn btn-success"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const tracking = document.getElementById(`tracking-${bestellung.id}`).value;
                                    updateBestellungStatus(bestellung.id, { status: 'versendet', tracking_nummer: tracking });
                                  }}
                                  disabled={bestellungUpdating}
                                >
                                  Als versendet markieren
                                </button>
                              </>
                            )}
                            {bestellung.status === 'versendet' && (
                              <button
                                className="btn btn-success"
                                onClick={(e) => { e.stopPropagation(); updateBestellungStatus(bestellung.id, { status: 'abgeschlossen' }); }}
                                disabled={bestellungUpdating}
                              >
                                Abschließen
                              </button>
                            )}
                            {['offen', 'in_bearbeitung'].includes(bestellung.status) && (
                              <button
                                className="btn btn-danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm('Bestellung wirklich stornieren?')) {
                                    updateBestellungStatus(bestellung.id, { status: 'storniert' });
                                  }
                                }}
                                disabled={bestellungUpdating}
                              >
                                Stornieren
                              </button>
                            )}
                          </div>
                          {bestellung.tracking_nummer && (
                            <p className="tracking-info">
                              📦 Tracking: {bestellung.tracking_nummer}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
              </section>
  );
};

export default ShopBestellungen;
