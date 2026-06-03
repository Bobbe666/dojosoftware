import React from "react";
import { motion } from "framer-motion";

// Ausgelagert aus Stilverwaltung.jsx (StilMitgliederTab-Tab).
const StilMitgliederTab = ({ currentStil, stilMitglieder, stilMitgliederLoading, stilMitgliederSearch, setStilMitgliederSearch, showMemberPicker, setShowMemberPicker, memberPickerSearch, setMemberPickerSearch, bulkGradMode, setBulkGradMode, bulkSelectedIds, setBulkSelectedIds, bulkTargetGradId, setBulkTargetGradId, bulkSaving, removeMemberFromStil, handleBulkGraduierung }) => {
  return (
                  <motion.div
                    className="stilmitglieder-tab"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Header-Zeile */}
                    <div className="sv-sm-header">
                      <h3 className="sv-sm-title">
                        👥 Mitglieder in diesem Stil
                        <span className="sv-sm-count">{stilMitglieder.length}</span>
                      </h3>
                      <div className="sv-sm-header-actions">
                        {stilMitglieder.length > 0 && (
                          <button
                            className={`btn btn-sm${bulkGradMode ? ' btn-neutral' : ''}`}
                            style={!bulkGradMode ? { background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' } : {}}
                            onClick={() => {
                              setBulkGradMode(v => !v);
                              setBulkSelectedIds([]);
                              setBulkTargetGradId('');
                            }}
                          >
                            {bulkGradMode ? '✕ Abbrechen' : '🎖️ Gürtel zuweisen'}
                          </button>
                        )}
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setShowMemberPicker(true);
                            setMemberPickerSearch('');
                            setTimeout(() => memberPickerSearchRef.current?.focus(), 80);
                          }}
                        >
                          + Mitglied hinzufügen
                        </button>
                      </div>
                    </div>

                    {/* Bulk-Gürtelzuweisung Panel */}
                    {bulkGradMode && (
                      <div className="sv-sm-bulk-panel">
                        <label className="sv-sm-bulk-label">
                          <input
                            type="checkbox"
                            checked={bulkSelectedIds.length === stilMitglieder.length && stilMitglieder.length > 0}
                            onChange={e => setBulkSelectedIds(e.target.checked ? stilMitglieder.map(m => m.mitglied_id) : [])}
                          />
                          Alle auswählen ({bulkSelectedIds.length} gewählt)
                        </label>
                        <select
                          className="sv-sm-bulk-select"
                          value={bulkTargetGradId}
                          onChange={e => setBulkTargetGradId(e.target.value)}
                        >
                          <option value="">Gürtel wählen…</option>
                          {(currentStil?.graduierungen || [])
                            .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0))
                            .map(g => (
                              <option key={g.graduierung_id} value={g.graduierung_id}>{g.name}</option>
                            ))}
                        </select>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={handleBulkGraduierung}
                          disabled={bulkSaving || !bulkTargetGradId || bulkSelectedIds.length === 0}
                        >
                          {bulkSaving ? 'Wird gespeichert…' : `✓ Zuweisen (${bulkSelectedIds.length})`}
                        </button>
                      </div>
                    )}

                    {/* Suchfeld für aktuelle Mitglieder */}
                    <input
                      className="sv-sm-search"
                      type="text"
                      placeholder="Mitglieder filtern…"
                      value={stilMitgliederSearch}
                      onChange={e => setStilMitgliederSearch(e.target.value)}
                    />

                    {/* Mitgliederliste */}
                    {stilMitgliederLoading ? (
                      <div className="no-data-message"><p>Mitglieder werden geladen…</p></div>
                    ) : stilMitglieder.length === 0 ? (
                      <div className="no-data-message">
                        <p>Noch keine Mitglieder in diesem Stil. Klicke auf „Mitglied hinzufügen".</p>
                      </div>
                    ) : (
                      <div className="sv-sm-list">
                        {stilMitglieder
                          .filter(m => {
                            const q = stilMitgliederSearch.toLowerCase();
                            return !q || `${m.vorname} ${m.nachname}`.toLowerCase().includes(q);
                          })
                          .map(m => (
                            <div
                              key={m.mitglied_id}
                              className={`sv-sm-item${bulkGradMode && bulkSelectedIds.includes(m.mitglied_id) ? ' sv-sm-item--selected' : ''}`}
                              onClick={bulkGradMode ? () => setBulkSelectedIds(prev =>
                                prev.includes(m.mitglied_id)
                                  ? prev.filter(id => id !== m.mitglied_id)
                                  : [...prev, m.mitglied_id]
                              ) : undefined}
                              style={bulkGradMode ? { cursor: 'pointer' } : {}}
                            >
                              {bulkGradMode && (
                                <input
                                  type="checkbox"
                                  className="sv-sm-checkbox"
                                  checked={bulkSelectedIds.includes(m.mitglied_id)}
                                  onChange={() => {}}
                                  onClick={e => e.stopPropagation()}
                                />
                              )}
                              <div
                                className="sv-sm-belt-dot"
                                style={{ background: m.farbe_hex || '#888' }}
                                title={m.graduierung_name || 'Kein Gürtel'}
                              />
                              <div className="sv-sm-info">
                                <span className="sv-sm-name">{m.vorname} {m.nachname}</span>
                                {m.graduierung_name && (
                                  <span className="sv-sm-grad">{m.graduierung_name}</span>
                                )}
                              </div>
                              {!bulkGradMode && (
                                <button
                                  className="sv-sm-remove-btn"
                                  title="Aus Stil entfernen"
                                  onClick={() => removeMemberFromStil(m.mitglied_id, `${m.vorname} ${m.nachname}`)}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </motion.div>
  );
};

export default StilMitgliederTab;
