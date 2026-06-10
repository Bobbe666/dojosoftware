import React from 'react';
import { Check, X, Users } from 'lucide-react';

const API_BASE_URL = '/api';

// Ausgelagert aus PruefungsVerwaltung.jsx (Kandidaten-Tab inkl. Filter-Logik).
const PruefungsKandidatenTab = ({
  kandidaten, stile, loading, setError, setSuccess,
  selectedKandidaten, setSelectedKandidaten,
  graduierungenProStil, selectedGraduierungen, setSelectedGraduierungen,
  ausnahmeBatchQueue, setAusnahmeBatchQueue,
  berechtigungsFilter, setBerechtigungsFilter,
  kandidatenStilFilter, setKandidatenStilFilter,
  kandidatenSuchbegriff, setKandidatenSuchbegriff,
  sortConfig, openZugGroups, setOpenZugGroups,
  applySorting, fetchKandidaten, fetchPruefungstermine, fetchZugelassenePruefungen,
  handleKandidatZulassen, handleSort, handleZulassungEntfernen, openTerminAuswahl
}) => {
        // Sortier-Icon-Komponente (nutzt sortConfig)
        const SortIcon = ({ columnKey }) => {
          if (sortConfig.key !== columnKey) {
            return (
              <span className="pv3-sort-icon-inactive">⇅</span>
            );
          }
          return (
            <span className="pv3-sort-icon-active">
              {sortConfig.direction === 'asc' ? '↑' : '↓'}
            </span>
          );
        };

        // Filtere Kandidaten basierend auf Berechtigungs- und Stil-Filter
        let filteredKandidaten = kandidaten;

        // Berechtigungsfilter anwenden
        if (berechtigungsFilter === 'berechtigt') {
          filteredKandidaten = filteredKandidaten.filter(k => k.berechtigt);
        } else if (berechtigungsFilter === 'nicht_berechtigt') {
          filteredKandidaten = filteredKandidaten.filter(k => !k.berechtigt);
        }

        // Stilfilter anwenden
        if (kandidatenStilFilter !== 'all') {
          filteredKandidaten = filteredKandidaten.filter(k => k.stil_id === parseInt(kandidatenStilFilter));
        }

        // Suchfilter anwenden (Name, Vorname, ID)
        if (kandidatenSuchbegriff.trim() !== '') {
          const suchbegriff = kandidatenSuchbegriff.toLowerCase().trim();
          filteredKandidaten = filteredKandidaten.filter(k =>
            (k.vorname && k.vorname.toLowerCase().includes(suchbegriff)) ||
            (k.nachname && k.nachname.toLowerCase().includes(suchbegriff)) ||
            (k.mitglied_id && k.mitglied_id.toString().includes(suchbegriff))
          );
        }

        // Sortierung anwenden — bei aktiver Spalten-Sortierung diese, sonst Standard A–Z (Name)
        if (sortConfig.key) {
          filteredKandidaten = applySorting(filteredKandidaten, sortConfig.key, sortConfig.direction);
        } else {
          filteredKandidaten = [...filteredKandidaten].sort((a, b) =>
            `${a.nachname || ''} ${a.vorname || ''}`.localeCompare(`${b.nachname || ''} ${b.vorname || ''}`, 'de', { sensitivity: 'base' })
          );
        }

        return (
        <div>
          <div className="pv3-kandidaten-header">
            <div className="u-flex-1">
              <h2 className="pv3-kandidaten-title">
                Prüfungskandidaten
                <span className="pv3-kandidaten-count">
                  ({filteredKandidaten.filter(k => k.berechtigt).length} berechtigt / {filteredKandidaten.length} angezeigt
                  {(berechtigungsFilter !== 'all' || kandidatenStilFilter !== 'all') && ` von ${kandidaten.length} gesamt`})
                </span>
              </h2>
              <p className="pv3-kandidaten-subtitle">
                {selectedKandidaten.length > 0
                  ? `${selectedKandidaten.length} Kandidat${selectedKandidaten.length > 1 ? 'en' : ''} ausgewählt`
                  : 'Wählen Sie Kandidaten aus, um sie zur Prüfung zuzulassen'}
              </p>

              {/* Filter Controls */}
              <div className="pv3-filter-row">
                {/* Berechtigungsfilter */}
                <div className="pv-flex-row">
                  <span className="pv-secondary-bold">
                    Berechtigung:
                  </span>
                  <div className="pv3-btn-group">
                    <button
                      onClick={() => setBerechtigungsFilter('all')}
                      className={`pv3-filter-btn${berechtigungsFilter === 'all' ? ' active' : ''}`}
                    >
                      Alle
                    </button>
                    <button
                      onClick={() => setBerechtigungsFilter('berechtigt')}
                      className={`pv3-filter-btn${berechtigungsFilter === 'berechtigt' ? ' active' : ''}`}
                    >
                      Berechtigt
                    </button>
                    <button
                      onClick={() => setBerechtigungsFilter('nicht_berechtigt')}
                      className={`pv3-filter-btn${berechtigungsFilter === 'nicht_berechtigt' ? ' active' : ''}`}
                    >
                      Nicht berechtigt
                    </button>
                  </div>
                </div>

                {/* Stilfilter */}
                <div className="pv-flex-row">
                  <span className="pv-secondary-bold">
                    Stil:
                  </span>
                  <select
                    value={kandidatenStilFilter}
                    onChange={(e) => setKandidatenStilFilter(e.target.value)}
                    className="pv3-dark-select"
                  >
                    <option value="all" className="pv2-dark-input">
                      Alle Stile
                    </option>
                    {stile.map(stil => (
                      <option
                        key={stil.stil_id}
                        value={stil.stil_id}
                        className="pv2-dark-input"
                      >
                        {stil.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Suchfeld */}
                <div className="pv3-search-wrap">
                  <span className="pv-secondary-bold">
                    Suche:
                  </span>
                  <input
                    type="text"
                    placeholder="Name suchen..."
                    value={kandidatenSuchbegriff}
                    onChange={(e) => setKandidatenSuchbegriff(e.target.value)}
                    className="pv3-search-input"
                  />
                  {kandidatenSuchbegriff && (
                    <button
                      onClick={() => setKandidatenSuchbegriff('')}
                      className="pv3-search-clear"
                      title="Suche zurücksetzen"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
            {selectedKandidaten.length > 0 && (() => {
              const berechtigt = selectedKandidaten.filter(k => k.berechtigt);
              const nichtBerechtigt = selectedKandidaten.filter(k => !k.berechtigt);
              return (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {berechtigt.length > 0 && (
                    <button
                      onClick={async () => {
                        for (const k of berechtigt) await handleKandidatZulassen(k);
                        setSelectedKandidaten([]);
                      }}
                      className="btn btn-primary pv3-batch-btn"
                    >
                      <Check size={18} />
                      {berechtigt.length} zulassen
                    </button>
                  )}
                  {nichtBerechtigt.length > 0 && (
                    <button
                      onClick={() => {
                        if (nichtBerechtigt.length === 0) return;
                        const [first, ...rest] = nichtBerechtigt;
                        setSelectedKandidaten([]);
                        setAusnahmeBatchQueue(rest);
                        openTerminAuswahl(first, true);
                      }}
                      className="btn btn-warning pv3-batch-btn"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' }}
                    >
                      ⚠ {nichtBerechtigt.length} Ausnahme zulassen
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedKandidaten([])}
                    style={{ padding: '6px 10px', background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: 'var(--ds-text-muted)', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Auswahl aufheben
                  </button>
                </div>
              );
            })()}
          </div>

          {loading ? (
            <div className="pv3-loading-center">
              <div className="loading-spinner-large"></div>
              <p className="pv-text-secondary">Kandidaten werden geladen...</p>
            </div>
          ) : kandidaten.length === 0 ? (
            <div className="pv3-empty-state-dashed-gold">
              <Users size={48} className="pv2-muted-mb" />
              <h3 className="pv2-secondary-mb">Keine Kandidaten gefunden</h3>
              <p className="pv-muted-sm-row">
                Aktuell gibt es keine Mitglieder, die die Voraussetzungen für eine Prüfung erfüllen.
              </p>
            </div>
          ) : filteredKandidaten.length === 0 ? (
            <div className="pv3-empty-state-dashed-gold">
              <Users size={48} className="pv2-muted-mb" />
              <h3 className="pv2-secondary-mb">Keine Kandidaten mit den aktuellen Filtern</h3>
              <p className="pv-muted-sm-row">
                Passen Sie die Filter an, um andere Kandidaten anzuzeigen.
              </p>
            </div>
          ) : (() => {
            // Gruppieren nach Stil
            const stilGroups = {};
            filteredKandidaten.forEach(k => {
              const key = `${k.stil_id}`;
              if (!stilGroups[key]) stilGroups[key] = { stil_id: k.stil_id, stil_name: k.stil_name, candidates: [] };
              stilGroups[key].candidates.push(k);
            });
            const sortedStilGroups = Object.values(stilGroups).sort((a, b) => a.stil_name.localeCompare(b.stil_name));

            return (
              <div className="pv3-grouped-list">
                {sortedStilGroups.map(group => {
                  const groupKey = `kand_${group.stil_id}`;
                  const isOpen = !!openZugGroups[groupKey];
                  const berechtigtCount = group.candidates.filter(k => k.berechtigt && !k.bereits_zugelassen).length;
                  const zugelassenCount = group.candidates.filter(k => k.bereits_zugelassen).length;
                  // Reihenfolge: 0 = berechtigt (oben), 1 = zugelassen, 2 = nicht berechtigt/nicht zugelassen.
                  // Stabile Sortierung erhält das A–Z (bzw. die Spalten-Sortierung) innerhalb jedes Blocks.
                  const tierOf = (k) => k.bereits_zugelassen ? 1 : (k.berechtigt ? 0 : 2);
                  const groupCandidates = [...group.candidates].sort((a, b) => tierOf(a) - tierOf(b));

                  return (
                    <div key={groupKey} className="pv3-group-section">
                      <div
                        className="pv3-group-header past clickable"
                        onClick={() => setOpenZugGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                      >
                        <div className="pv3-group-header-left">
                          <span className={`pv3-group-chevron ${isOpen ? 'open' : ''}`}>▶</span>
                          <span className="pv3-stil-badge-sm">{group.stil_name}</span>
                          {berechtigtCount > 0 && (
                            <span className="pv3-abg-summary-badge bestanden">{berechtigtCount} berechtigt</span>
                          )}
                          {zugelassenCount > 0 && (
                            <span className="pv3-abg-summary-badge" style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.25)',color:'#f59e0b'}}>{zugelassenCount} zugelassen</span>
                          )}
                        </div>
                        <span className="pv3-group-count">{group.candidates.length} Kandid.</span>
                      </div>

                      {isOpen && (
                        <div className="table-container" style={{borderRadius:0}}>
                          <table className="data-table pv3-table-sm">
                            <thead>
                              <tr>
                                <th className="pv3-th-plain-40-center">
                                  <input
                                    type="checkbox"
                                    className="pv3-checkbox-gold"
                                    onChange={(e) => {
                                      const eligibles = groupCandidates.filter(k => !k.bereits_zugelassen);
                                      if (e.target.checked) {
                                        const toAdd = eligibles.filter(k => !selectedKandidaten.some(s => s.mitglied_id === k.mitglied_id && s.stil_id === k.stil_id));
                                        setSelectedKandidaten([...selectedKandidaten, ...toAdd]);
                                      } else {
                                        setSelectedKandidaten(selectedKandidaten.filter(s => !eligibles.some(k => k.mitglied_id === s.mitglied_id && k.stil_id === s.stil_id)));
                                      }
                                    }}
                                    checked={
                                      groupCandidates.filter(k => !k.bereits_zugelassen).length > 0 &&
                                      groupCandidates.filter(k => !k.bereits_zugelassen).every(k => selectedKandidaten.some(s => s.mitglied_id === k.mitglied_id && s.stil_id === k.stil_id))
                                    }
                                  />
                                </th>
                                <th className="pv3-th-sortable" onClick={() => handleSort('name')}>Name <SortIcon columnKey="name" /></th>
                                <th className="pv3-th-sortable-sm" onClick={() => handleSort('geburtsdatum')}>Geb. <SortIcon columnKey="geburtsdatum" /></th>
                                <th className="pv3-th-sortable-md" onClick={() => handleSort('graduierung_vorher_name')}>Aktuell <SortIcon columnKey="graduierung_vorher_name" /></th>
                                <th className="pv3-th-sortable-md" onClick={() => handleSort('graduierung_nachher_name')}>Ziel <SortIcon columnKey="graduierung_nachher_name" /></th>
                                <th className="pv3-th-plain-110">Stunden</th>
                                <th className="pv3-th-plain-80">Monate</th>
                                <th className="pv3-th-plain-100">Status</th>
                                <th className="pv3-th-plain-100-center">Aktion</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupCandidates.map((kandidat, index) => (
                                <tr
                                  key={`${kandidat.mitglied_id}-${kandidat.stil_id}-${index}`}
                                  className={`hover-row ${kandidat.bereits_zugelassen ? 'pv3-kandidat-row--zugelassen' : kandidat.berechtigt ? 'pv3-kandidat-row--berechtigt' : ''}`}
                                >
                      <td className="pv2-text-center">
                        {!kandidat.bereits_zugelassen ? (
                          <input
                            type="checkbox"
                            className={kandidat.berechtigt ? 'pv3-checkbox-gold' : 'pv3-checkbox-warning'}
                            checked={selectedKandidaten.some(k =>
                              k.mitglied_id === kandidat.mitglied_id && k.stil_id === kandidat.stil_id
                            )}
                            title={kandidat.berechtigt ? 'Zur Prüfung zulassen' : 'Ausnahme-Zulassung'}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedKandidaten([...selectedKandidaten, kandidat]);
                              } else {
                                setSelectedKandidaten(selectedKandidaten.filter(k =>
                                  !(k.mitglied_id === kandidat.mitglied_id && k.stil_id === kandidat.stil_id)
                                ));
                              }
                            }}
                          />
                        ) : (
                          <span className="pv3-dash-muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="pv-flex-col-xs">
                          <strong className="u-text-primary">
                            {kandidat.vorname} {kandidat.nachname}
                          </strong>
                          <span className="pv-muted-sm">
                            ID: {kandidat.mitglied_id}
                          </span>
                        </div>
                      </td>
                      <td className="pv-text-secondary">
                        {new Date(kandidat.geburtsdatum).toLocaleDateString('de-DE')}
                      </td>
                      <td>
                        <span className="pv3-stil-badge-sm">
                          {kandidat.stil_name}
                        </span>
                      </td>
                      <td>
                        <div className="pv3-grad-row">
                          <div
                            className="pv3-gurt-dot-sm"
                            style={{ '--dot-color': kandidat.aktuelle_farbe || 'rgba(255, 255, 255, 0.1)' }}
                            title={kandidat.aktuelle_graduierung || 'Keine'}
                          />
                          <span className="pv3-grad-name">
                            {kandidat.aktuelle_graduierung || 'Keine'}
                          </span>
                        </div>
                      </td>
                      <td>
                        {graduierungenProStil[kandidat.stil_id] && graduierungenProStil[kandidat.stil_id].length > 0 ? (
                          <div className="pv-flex-row">
                            {(() => {
                              const key = `${kandidat.mitglied_id}-${kandidat.stil_id}`;
                              const selectedGradId = selectedGraduierungen[key] || kandidat.angestrebte_graduierung_id || kandidat.naechste_graduierung_id;
                              const selectedGrad = graduierungenProStil[kandidat.stil_id].find(g => g.graduierung_id === selectedGradId);

                              return (
                                <>
                                  <div
                                    className="pv3-gurt-dot-green"
                                    style={{ '--dot-color': selectedGrad?.farbe_hex || 'rgba(255, 255, 255, 0.1)' }}
                                    title={selectedGrad?.name || 'Keine Auswahl'}
                                  />
                                  <select
                                    value={selectedGradId || ''}
                                    onChange={async (e) => {
                                      const newGradId = parseInt(e.target.value);
                                      console.log('🎯 Graduierung geändert:', {
                                        kandidat: kandidat.vorname + ' ' + kandidat.nachname,
                                        newGradId,
                                        pruefung_id: kandidat.pruefung_id,
                                        bereits_zugelassen: kandidat.bereits_zugelassen
                                      });

                                      setSelectedGraduierungen({
                                        ...selectedGraduierungen,
                                        [key]: newGradId
                                      });

                                      // Wenn der Kandidat bereits zugelassen ist, sofort speichern
                                      if (kandidat.pruefung_id) {
                                        console.log('✅ Kandidat hat pruefung_id, speichere...', kandidat.pruefung_id);
                                        try {
                                          const response = await fetch(
                                            `${API_BASE_URL}/pruefungen/${kandidat.pruefung_id}/graduierung`,
                                            {
                                              method: 'PUT',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
                                              },
                                              body: JSON.stringify({ graduierung_nachher_id: newGradId })
                                            }
                                          );

                                          if (response.ok) {
                                            // Alle Listen aktualisieren
                                            fetchKandidaten();
                                            fetchZugelassenePruefungen();
                                            fetchPruefungstermine();
                                            setSuccess('Graduierung erfolgreich aktualisiert!');
                                            setTimeout(() => setSuccess(''), 2000);
                                          } else {
                                            const errorData = await response.json();
                                            setError(errorData.error || 'Fehler beim Speichern der Graduierung');
                                            setTimeout(() => setError(''), 3000);
                                          }
                                        } catch (error) {
                                          console.error('Fehler beim Speichern der Graduierung:', error);
                                          setError('Fehler beim Speichern der Graduierung');
                                          setTimeout(() => setError(''), 3000);
                                        }
                                      }
                                    }}
                                    className="pv3-grad-select-green"
                                    title="Wählen Sie die Ziel-Graduierung"
                                  >
                                    {graduierungenProStil[kandidat.stil_id]
                                      .filter(grad => grad.aktiv === 1)
                                      .sort((a, b) => a.reihenfolge - b.reihenfolge)
                                      .map((grad) => (
                                        <option key={grad.graduierung_id} value={grad.graduierung_id}>
                                          {grad.name}
                                          {grad.graduierung_id === kandidat.naechste_graduierung_id ? ' (Empfohlen)' : ''}
                                        </option>
                                      ))}
                                  </select>
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="pv3-grad-row">
                            <div
                              className="pv3-gurt-dot-green"
                              style={{ '--dot-color': kandidat.naechste_farbe || 'rgba(255, 255, 255, 0.1)' }}
                              title={kandidat.naechste_graduierung}
                            />
                            <span className="pv3-grad-name-primary">
                              {kandidat.naechste_graduierung}
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="pv3-stunden-col">
                          <div className="pv3-stunden-header">
                            <span
                              className={`pv3-stunden-count ${kandidat.absolvierte_stunden >= kandidat.benoetigte_stunden ? 'pv3-value--met' : 'pv3-value--not-met'}`}
                            >
                              {kandidat.absolvierte_stunden}
                            </span>
                            <span className="pv-muted-sm">
                              / {kandidat.benoetigte_stunden}
                            </span>
                          </div>
                          <div className="pv3-bar-wrap-gray-sm">
                            <div
                              className={`pv3-bar-fill${kandidat.fortschritt_prozent >= 100 ? ' pv3-bar-fill--good' : ' pv3-bar-fill--warn'}`}
                              style={{ width: `${Math.min(kandidat.fortschritt_prozent, 100)}%` }}
                            />
                          </div>
                          <span className="pv-muted-xs">
                            {kandidat.fortschritt_prozent}% erreicht
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={`pv3-monate-col ${kandidat.monate_seit_letzter_pruefung >= kandidat.benoetigte_monate ? 'pv3-value--met' : 'pv3-value--not-met'}`}>
                          {kandidat.monate_seit_letzter_pruefung} Mon.
                        </div>
                        <div className="pv-muted-sm">
                          von {kandidat.benoetigte_monate}
                        </div>
                      </td>
                      <td>
                        {(() => {
                          const stufen = kandidat.naechste_reihenfolge && kandidat.aktuelle_reihenfolge
                            ? Math.max(1, kandidat.naechste_reihenfolge - kandidat.aktuelle_reihenfolge)
                            : 1;
                          const gebuehr = stufen * 35;
                          return (
                            <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                              {kandidat.bereits_zugelassen ? (
                                <span className="badge badge-warning pv3-badge-flex">
                                  <Check size={14} />
                                  Zugelassen
                                </span>
                              ) : kandidat.berechtigt ? (
                                <span className="badge badge-success pv3-badge-flex">
                                  <Check size={14} />
                                  Berechtigt
                                </span>
                              ) : (
                                <span className="badge badge-neutral pv3-badge-flex">
                                  <X size={14} />
                                  Noch nicht
                                </span>
                              )}
                              <span style={{ fontSize:'0.68rem', color:'rgba(255,215,0,0.7)', fontWeight:600 }}>
                                {gebuehr.toFixed(2).replace('.',',')} €{stufen > 1 ? ` (${stufen}×35)` : ''}
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="pv2-text-center">
                        {!kandidat.bereits_zugelassen ? (
                          kandidat.berechtigt ? (
                            <button
                              onClick={() => openTerminAuswahl(kandidat)}
                              className="btn btn-sm btn-success pv3-btn-flex"
                            >
                              <Check size={16} />
                              Zulassen
                            </button>
                          ) : (
                            <button
                              onClick={() => openTerminAuswahl(kandidat, true)}
                              className="btn btn-sm btn-warning pv3-btn-flex"
                              title="Ausnahme-Zulassung für Kandidaten ohne zeitliche Voraussetzungen"
                            >
                              <Check size={16} />
                              Ausnahme
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => {
                              if (kandidat.pruefung_id) {
                                handleZulassungEntfernen({
                                  pruefung_id: kandidat.pruefung_id,
                                  mitglied_id: kandidat.mitglied_id,
                                  vorname: kandidat.vorname,
                                  nachname: kandidat.nachname
                                });
                              } else {
                                setError('Keine Prüfung-ID gefunden. Bitte aktualisieren Sie die Seite.');
                              }
                            }}
                            className="btn btn-sm btn-danger pv3-btn-flex"
                            title="Zulassung widerrufen"
                          >
                            <X size={16} />
                            Entfernen
                          </button>
                        )}
                      </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Legende */}
          {kandidaten.length > 0 && (
            <div className="pv3-legende-bar">
              <div className="pv3-legende-row">
                <div className="pv-flex-row">
                  <div className="pv3-legende-line-green" />
                  <span className="pv-text-secondary">Berechtigt zur Prüfung</span>
                </div>
                <div className="pv-flex-row">
                  <div className="pv3-legende-line-gold" />
                  <span className="pv-text-secondary">Bereits zugelassen</span>
                </div>
                <div className="pv-flex-row">
                  <div className="pv3-legende-line-white" />
                  <span className="pv-text-secondary">Noch nicht berechtigt</span>
                </div>
              </div>
            </div>
          )}
        </div>
        );
};

export default PruefungsKandidatenTab;
