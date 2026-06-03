import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Calendar, Award, ChevronUp, ChevronDown, Edit, Trash2, Play, FileText, Printer } from 'lucide-react';

const API_BASE_URL = '/api';

// Ausgelagert aus PruefungsVerwaltung.jsx (Termine-Tab).
const PruefungsTermineTab = ({
  loading, pruefungstermine, graduierungenProStil,
  selectedGraduierungen, setSelectedGraduierungen,
  externeAnmeldungen, expandedTermine,
  vergangeneExpanded, setVergangeneExpanded,
  openZwischenPruefId, setOpenZwischenPruefId,
  showNeuerTerminModal, setShowNeuerTerminModal,
  showExternModal, setShowExternModal,
  externModalTermin, setExternModalTermin,
  externForm, setExternForm,
  druckAuswahlModal, setDruckAuswahlModal,
  setError, setSuccess,
  fetchPruefungstermine, handleEditAnmeldungOpen, handlePruefungslistePDF,
  handleTerminBearbeiten, handleTerminLoeschen, openBatchErgebnisModal,
  saveZwischengurt, toggleTerminExpanded, druckeErgebnis
}) => {
  const navigate = useNavigate();
  return (
        <div>
          <div className="pv3-section-header">
            <div>
              <h2 className="pv3-section-title">
                Geplante Prüfungstermine
                <span className="pv3-section-count">
                  ({(() => {
                    const heute = new Date();
                    heute.setHours(0, 0, 0, 0);
                    const geplante = pruefungstermine.filter(termin => {
                      const terminDatum = new Date(termin.datum);
                      terminDatum.setHours(0, 0, 0, 0);
                      return terminDatum >= heute;
                    });
                    return geplante.length;
                  })()} {(() => {
                    const heute = new Date();
                    heute.setHours(0, 0, 0, 0);
                    const geplante = pruefungstermine.filter(termin => {
                      const terminDatum = new Date(termin.datum);
                      terminDatum.setHours(0, 0, 0, 0);
                      return terminDatum >= heute;
                    });
                    return geplante.length === 1 ? 'Termin' : 'Termine';
                  })()})
                </span>
              </h2>
              <p className="pv3-section-subtitle">
                Übersicht aller geplanten Prüfungen gruppiert nach Datum
              </p>
            </div>
            <button
              onClick={() => setShowNeuerTerminModal(true)}
              className="pv3-btn-new-termin"
            >
              <Calendar size={18} />
              Neuer Termin
            </button>
          </div>

          {loading ? (
            <div className="pv3-loading-center">
              <div className="loading-spinner-large"></div>
              <p className="pv-text-muted">Termine werden geladen...</p>
            </div>
          ) : pruefungstermine.length === 0 ? (
            <div className="pv3-empty-state">
              <Calendar size={48} className="pv2-muted-mb" />
              <h3 className="pv2-secondary-mb">Keine Prüfungstermine geplant</h3>
              <p className="pv-muted-sm-row">
                Aktuell gibt es keine geplanten Prüfungstermine. Lassen Sie Kandidaten zur Prüfung zu, um Termine zu erstellen.
              </p>
            </div>
          ) : (
            <div className="pv3-termine-list">
              {/* Geplante Termine */}
              {(() => {
                const heute = new Date();
                heute.setHours(0, 0, 0, 0);
                const geplanteTermine = pruefungstermine.filter(termin => {
                  const terminDatum = new Date(termin.datum);
                  terminDatum.setHours(0, 0, 0, 0);
                  return terminDatum >= heute;
                });

                if (geplanteTermine.length === 0) {
                  return null;
                }

                return (
                  <div>
                    <div className="pv3-termin-group-list">
                      {geplanteTermine.map((termin, index) => {
                        const datum = new Date(termin.datum);
                        const isToday = termin.datum === new Date().toISOString().split('T')[0];
                        const isPast = false; // Geplante Termine sind nie vergangen

                return (
                  <div
                    key={index}
                    className={isToday ? 'pv3-termin-card--today' : 'pv3-termin-card'}
                  >
                    {/* Termin-Header */}
                    <div className="pv3-termin-header">
                      {/* Obere Zeile: Info + Chevron */}
                      <div
                        className="pv2-flex-cursor pv3-termin-top"
                        onClick={() => toggleTerminExpanded(`${termin.datum}_${termin.stil_id}`, termin)}
                      >
                        <div className="pv3-termin-info">
                          <div className="pv3-termin-title-row">
                            <Calendar size={15} className={isToday ? 'pv3-calendar-today' : 'pv3-calendar-upcoming'} />
                            <h3 className={isToday ? 'pv3-termin-heading-today' : 'pv3-termin-heading-warning'}>
                              {datum.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </h3>
                          </div>
                          {(isToday || (isPast && !isToday) || termin.oeffentlich) && (
                            <div className="pv3-termin-badges-row">
                              {isToday && <span className="pv3-badge-today">Heute</span>}
                              {isPast && !isToday && <span className="pv3-badge-past">Vergangen</span>}
                              {termin.oeffentlich && <span className="pv3-badge-public">Öffentlich</span>}
                            </div>
                          )}
                          <div className="pv3-termin-meta-row">
                            <div className="pv-flex-row">
                              <span>Uhrzeit:</span>
                              <span>{termin.zeit}</span>
                            </div>
                            <span className="pv3-meta-dot">·</span>
                            <div className="pv-flex-row">
                              <span>Stil:</span>
                              <span className="pv3-badge-stil">{termin.stil_name}</span>
                            </div>
                            <span className="pv3-meta-dot">·</span>
                            <div className="pv-flex-row">
                              <span>Ort:</span>
                              <span>{termin.ort}</span>
                            </div>
                            <span className="pv3-meta-dot">·</span>
                            <div className="pv-flex-row">
                              <span>Teilnehmer:</span>
                              <span className="pv3-badge-teilnehmer">{termin.anzahl}</span>
                            </div>
                          </div>
                        </div>
                        <div className="pv3-termin-chevron">
                          {expandedTermine[`${termin.datum}_${termin.stil_id}`]
                            ? <ChevronUp size={16} className="pv-warning" />
                            : <ChevronDown size={16} className="pv-text-muted" />}
                        </div>
                      </div>
                      {/* Aktionsleiste: unten, volle Breite */}
                      <div className="pv3-termin-action-bar">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/pruefung-durchfuehren?datum=${termin.datum}`); }}
                          className="pv3-ab-btn pv3-ab-btn--primary"
                          title="Zur Live-Prüfungsansicht wechseln"
                        >
                          <Play size={12} />
                          Prüfung starten
                        </button>
                        {termin.anzahl > 0 && !termin.isVorlage && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openBatchErgebnisModal(termin); }}
                            className="pv3-ab-btn pv3-ab-btn--green"
                            title="Ergebnisse für alle Teilnehmer eintragen"
                          >
                            <Award size={12} />
                            Ergebnisse
                          </button>
                        )}
                        <div className="pv3-ab-spacer" />
                        {termin.anzahl > 0 && !termin.isVorlage && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDruckAuswahlModal({ open: true, termin, selected: termin.pruefungen.map(p => p.pruefung_id), vorlage: 'pruefungsurkunde' }); }}
                            className="pv3-ab-btn pv3-ab-btn--print"
                            title="Urkunden drucken – Vorlage wählen"
                          >
                            <Printer size={12} />
                            Urkunden
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePruefungslistePDF(termin); }}
                          className="pv3-ab-icon"
                          title="Teilnehmerliste als PDF"
                        >
                          <FileText size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTerminBearbeiten(termin); }}
                          className="pv3-ab-btn"
                          title="Termin bearbeiten (Datum, Ort, Verlegungsgrund)"
                          style={{ color: 'rgba(255,215,0,0.65)', borderColor: 'rgba(255,215,0,0.15)' }}
                        >
                          <Edit size={12} />
                          Bearbeiten
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTerminLoeschen(termin); }}
                          className="pv3-ab-icon pv3-ab-icon--red"
                          title="Termin löschen"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Prüflinge-Liste */}
                    {expandedTermine[`${termin.datum}_${termin.stil_id}`] && (
                      <>
                        {termin.isVorlage ? (
                        <div className="pv3-vorlage-empty">
                          <Calendar size={48} className="pv3-icon-warning-large" />
                          <h4 className="pv3-vorlage-empty-title">
                            Termin ohne Teilnehmer
                          </h4>
                          <p className="pv3-vorlage-empty-text">
                            Dieser Termin wurde angelegt, hat aber noch keine zugelassenen Kandidaten.
                            <br />
                            Teilnehmer koennen ueber das Mitgliederprofil zu diesem Termin angemeldet werden.
                          </p>
                        </div>
                      ) : (
                        <div className="table-container pv2-mt-1">
                          <table className="data-table pv2-fs-0875">
                            <thead>
                              <tr>
                                <th className="pv3-th-180">Name</th>
                                <th className="pv3-th-110">Geburtsdatum</th>
                                <th className="pv3-th-100">Stil</th>
                                <th className="pv3-th-150">Aktueller Gurt</th>
                                <th className="pv3-th-150">Angestrebter Gurt</th>
                                <th className="pv3-th-140">Trainingsstunden</th>
                                <th className="pv3-th-100">Wartezeit</th>
                                <th className="pv3-th-130">Status</th>
                                <th className="pv3-th-80"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {termin.pruefungen.map((pruefung, pIndex) => (
                                <tr
                                  key={pIndex}
                                  className="pv3-table-row-gold hover-row"
                                >
                                  <td>
                                    <div className="pv-flex-col-xs">
                                      <span className="pv2-fw700-primary">
                                        {pruefung.vorname} {pruefung.nachname}
                                        {pruefung.is_extern ? <span style={{marginLeft:'6px',fontSize:'11px',background:'rgba(245,158,11,0.2)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.4)',borderRadius:'4px',padding:'1px 6px',fontWeight:600,letterSpacing:'0.03em'}}>EXTERN</span> : null}
                                      </span>
                                      <span className="pv-muted-sm">
                                        {pruefung.is_extern
                                          ? (pruefung.extern_verein || 'Externer Teilnehmer')
                                          : `ID: ${pruefung.mitglied_id}`}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="pv-text-secondary">
                                      {pruefung.geburtsdatum ? new Date(pruefung.geburtsdatum).toLocaleDateString('de-DE') : '—'}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="pv3-tag-stil-purple">
                                      {pruefung.stil_name}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="pv-flex-row">
                                      <div
                                        className="pv3-gurt-dot"
                                        style={{ '--dot-color': pruefung.farbe_vorher || '#6b7280' }}
                                      />
                                      <div className="pv2-flex-col">
                                        <span className="pv-bold-primary-sm">
                                          {pruefung.graduierung_vorher || 'Keine'}
                                        </span>
                                        <span className="pv-muted-xs">
                                          Ziel-Gurt
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    {graduierungenProStil[pruefung.stil_id] && graduierungenProStil[pruefung.stil_id].length > 0 ? (
                                      <div className="pv-flex-row">
                                        {(() => {
                                          const key = `${pruefung.mitglied_id}-${pruefung.stil_id}`;
                                          const selectedGradId = selectedGraduierungen[key] || pruefung.graduierung_nachher_id;
                                          const selectedGrad = graduierungenProStil[pruefung.stil_id].find(g => g.graduierung_id === selectedGradId);

                                          return (
                                            <>
                                              <div
                                                className="pv3-gurt-dot pv3-gurt-dot--selected"
                                                style={{ '--dot-color': selectedGrad?.farbe_hex || pruefung.farbe_nachher || '#EAB308' }}
                                                title={selectedGrad?.name || pruefung.graduierung_nachher || 'Keine Auswahl'}
                                              />
                                              <select
                                                value={selectedGradId || ''}
                                                onChange={async (e) => {
                                                  const newGradId = parseInt(e.target.value);
                                                  setSelectedGraduierungen({
                                                    ...selectedGraduierungen,
                                                    [key]: newGradId
                                                  });

                                                  try {
                                                    const response = await fetch(
                                                      `${API_BASE_URL}/pruefungen/${pruefung.pruefung_id}/graduierung`,
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
                                                      fetchPruefungstermine();
                                                      setSuccess('Graduierung erfolgreich aktualisiert!');
                                                      setTimeout(() => setSuccess(''), 2000);
                                                    } else {
                                                      const errorData = await response.json();
                                                      setError(errorData.error || 'Fehler beim Speichern der Graduierung');
                                                      setTimeout(() => setError(''), 3000);
                                                    }
                                                  } catch (err) {
                                                    console.error('Fehler beim Speichern der Graduierung:', err);
                                                    setError('Fehler beim Speichern der Graduierung');
                                                    setTimeout(() => setError(''), 3000);
                                                  }
                                                }}
                                                className="pv3-grad-select"
                                                title="Ziel-Graduierung ändern"
                                              >
                                                {graduierungenProStil[pruefung.stil_id]
                                                  .filter(grad => grad.aktiv === 1)
                                                  .sort((a, b) => a.reihenfolge - b.reihenfolge)
                                                  .map((grad) => (
                                                    <option key={grad.graduierung_id} value={grad.graduierung_id}>
                                                      {grad.name}
                                                    </option>
                                                  ))}
                                              </select>
                                            </>
                                          );
                                        })()}
                                      </div>
                                    ) : (
                                      <div className="pv-flex-row">
                                        <div
                                          className="pv3-gurt-dot"
                                          style={{ '--dot-color': pruefung.farbe_nachher || '#EAB308' }}
                                        />
                                        <span className="pv-bold-primary-sm">
                                          {pruefung.graduierung_nachher}
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    <div className="pv-flex-col-sm">
                                      <div className="pv-flex-row">
                                        <span className="pv2-fw700-success">
                                          {pruefung.anwesenheiten_aktuell || 0}
                                        </span>
                                        <span className="pv-muted-xs">
                                          / {pruefung.min_trainingseinheiten || 0}
                                        </span>
                                      </div>
                                      <div className="pv3-progress-wrap">
                                        <div
                                          className={`pv3-bar-fill${((pruefung.anwesenheiten_aktuell || 0) >= (pruefung.min_trainingseinheiten || 0)) ? ' pv3-bar-fill--good' : ' pv3-bar-fill--warn'}`}
                                          style={{ width: `${Math.min(100, ((pruefung.anwesenheiten_aktuell || 0) / (pruefung.min_trainingseinheiten || 1)) * 100)}%` }}
                                        />
                                      </div>
                                      <span className="pv-muted-xs">
                                        {((pruefung.anwesenheiten_aktuell || 0) >= (pruefung.min_trainingseinheiten || 0)) ? '100%' : Math.round(((pruefung.anwesenheiten_aktuell || 0) / (pruefung.min_trainingseinheiten || 1)) * 100) + '%'} erreicht
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="pv-flex-col-sm">
                                      <span className="pv3-wartezeit-value">
                                        {pruefung.monate_seit_letzter_pruefung || 0} Mon.
                                      </span>
                                      <span className="pv-muted-xs">
                                        von {pruefung.min_wartezeit_monate || 0}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="pv3-badge-zugelassen">
                                      <Check size={14} />
                                      Zugelassen
                                    </span>
                                  </td>
                                  <td>
                                    <div style={{display:'flex',gap:'4px',alignItems:'center'}}>
                                      <button
                                        onClick={() => druckeErgebnis(pruefung, termin)}
                                        title="Prüfungsprotokoll drucken"
                                        style={{background:'none',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'5px',color:'var(--text-muted,#aaa)',cursor:'pointer',padding:'4px 8px',fontSize:'14px',lineHeight:1,display:'flex',alignItems:'center',gap:'4px',whiteSpace:'nowrap'}}
                                      >
                                        🖨️
                                      </button>
                                      <button
                                        onClick={() => setDruckAuswahlModal({ open: true, termin, selected: [pruefung.pruefung_id], vorlage: 'pruefungsurkunde' })}
                                        title="Urkunde drucken (Name + Gurt)"
                                        style={{background:'none',border:'1px solid rgba(99,102,241,0.4)',borderRadius:'5px',color:'#818cf8',cursor:'pointer',padding:'4px 8px',fontSize:'13px',lineHeight:1,display:'flex',alignItems:'center',gap:'3px',whiteSpace:'nowrap'}}
                                      >
                                        🎖️
                                      </button>
                                      {/* Doppelprüfung */}
                                      {pruefung.graduierung_zwischen ? (
                                        <span style={{display:'flex',alignItems:'center',gap:'3px',background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.4)',borderRadius:'5px',padding:'3px 7px',fontSize:'11px',color:'#22c55e',whiteSpace:'nowrap'}}>
                                          2× {pruefung.graduierung_zwischen}
                                          <button
                                            onClick={() => saveZwischengurt(pruefung, null)}
                                            title="Doppelprüfung entfernen"
                                            style={{background:'none',border:'none',color:'#22c55e',cursor:'pointer',fontSize:'13px',lineHeight:1,padding:'0 0 0 2px'}}
                                          >×</button>
                                        </span>
                                      ) : (
                                        <div style={{position:'relative'}}>
                                          <button
                                            onClick={() => setOpenZwischenPruefId(openZwischenPruefId === pruefung.pruefung_id ? null : pruefung.pruefung_id)}
                                            title="Doppelprüfung (Gurt überspringen): Zwischengurt wählen → 2 Urkunden werden gedruckt"
                                            style={{background:'none',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'5px',color:'var(--text-muted,#aaa)',cursor:'pointer',padding:'4px 7px',fontSize:'11px',lineHeight:1,whiteSpace:'nowrap'}}
                                          >2×</button>
                                          {openZwischenPruefId === pruefung.pruefung_id && graduierungenProStil[pruefung.stil_id] && (
                                            <div style={{position:'absolute',right:0,top:'110%',background:'var(--surface,#1e252c)',border:'1px solid var(--border,#2a3038)',borderRadius:'8px',padding:'6px',zIndex:50,minWidth:'160px',boxShadow:'0 4px 16px rgba(0,0,0,0.5)'}}>
                                              <p style={{fontSize:'10px',color:'var(--text-muted,#aaa)',marginBottom:'5px',paddingLeft:'2px'}}>Zwischengurt wählen:</p>
                                              {(() => {
                                                const grads = graduierungenProStil[pruefung.stil_id] || [];
                                                const vorherGrad = grads.find(g => g.graduierung_id === pruefung.graduierung_vorher_id);
                                                const nachherGrad = grads.find(g => g.graduierung_id === pruefung.graduierung_nachher_id);
                                                const filtered = grads.filter(g =>
                                                  g.aktiv === 1 &&
                                                  (!vorherGrad || g.reihenfolge > vorherGrad.reihenfolge) &&
                                                  (!nachherGrad || g.reihenfolge < nachherGrad.reihenfolge)
                                                );
                                                if (filtered.length === 0) return <p style={{fontSize:'11px',color:'var(--text-muted,#aaa)',padding:'2px'}}>Kein Zwischengurt möglich</p>;
                                                return filtered.map(g => (
                                                  <button key={g.graduierung_id}
                                                    onClick={() => saveZwischengurt(pruefung, g.graduierung_id)}
                                                    style={{display:'flex',alignItems:'center',gap:'7px',width:'100%',background:'none',border:'none',color:'var(--text,#e8eaed)',cursor:'pointer',padding:'5px 6px',borderRadius:'5px',fontSize:'12px',textAlign:'left'}}
                                                    onMouseEnter={e => e.currentTarget.style.background='var(--surface2,#2a3038)'}
                                                    onMouseLeave={e => e.currentTarget.style.background='none'}
                                                  >
                                                    <span style={{width:'10px',height:'10px',borderRadius:'50%',background:g.farbe_hex||'#555',flexShrink:0,display:'inline-block'}}/>
                                                    {g.name}
                                                  </button>
                                                ));
                                              })()}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                        {/* Externe Anmeldungen */}
                        {termin.oeffentlich && termin.vorlageData?.termin_id && (
                          <div className="pv2-mt-15">
                            <h4 className="pv3-extern-heading">
                              🌐 Externe Anmeldungen
                            </h4>
                            {(() => {
                              const anmeldungen = externeAnmeldungen[termin.vorlageData.termin_id];
                              if (!anmeldungen) {
                                return (
                                  <p className="pv-muted-sm-row">
                                    Lade externe Anmeldungen...
                                  </p>
                                );
                              }
                              if (anmeldungen.length === 0) {
                                return (
                                  <p className="pv-muted-sm-row">
                                    Keine externen Anmeldungen vorhanden.
                                  </p>
                                );
                              }
                              return (
                                <div className="table-container">
                                  <table className="data-table pv3-extern-table">
                                    <thead>
                                      <tr>
                                        <th className="pv-sky">Name</th>
                                        <th className="pv-sky">E-Mail</th>
                                        <th className="pv-sky">Verein</th>
                                        <th className="pv-sky">Aktueller Gurt</th>
                                        <th className="pv-sky">Angestrebter Gurt</th>
                                        <th className="pv-sky">Status</th>
                                        <th className="pv-sky">Datum</th>
                                        <th className="pv-sky"></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {anmeldungen.map(a => (
                                        <tr key={a.id}>
                                          <td>{a.vorname} {a.nachname}</td>
                                          <td>{a.email}</td>
                                          <td>{a.verein || '—'}</td>
                                          <td>{a.aktueller_gurt || '—'}</td>
                                          <td>{a.angestrebter_gurt || '—'}</td>
                                          <td>
                                            <span className={`pv3-extern-status pv3-extern-status--${a.status}`}>
                                              {a.status}
                                            </span>
                                          </td>
                                          <td className="pv3-extern-date">
                                            {new Date(a.erstellt_am).toLocaleDateString('de-DE')}
                                          </td>
                                          <td>
                                            <div style={{display:'flex',gap:'4px',alignItems:'center'}}>
                                            <button
                                              onClick={() => handleEditAnmeldungOpen(a, termin.vorlageData?.termin_id)}
                                              title="Anmeldung bearbeiten"
                                              style={{background:'none',border:'1px solid rgba(99,102,241,0.4)',borderRadius:'5px',color:'#818cf8',cursor:'pointer',padding:'4px 8px',fontSize:'14px',lineHeight:1}}
                                            >
                                              ✏️
                                            </button>
                                            <button
                                              onClick={() => druckeErgebnis({
                                                pruefung_id: a.pruefung_id || null,
                                                vorname: a.vorname,
                                                nachname: a.nachname,
                                                geburtsdatum: a.geburtsdatum || null,
                                                graduierung_vorher: a.aktueller_gurt || '—',
                                                farbe_vorher: null,
                                                graduierung_nachher: a.angestrebter_gurt || '—',
                                                farbe_nachher: a.farbe_nachher || null,
                                                graduierung_nachher_id: a.graduierung_nachher_id || null,
                                                bestanden: a.bestanden != null ? a.bestanden : null,
                                                prueferkommentar: a.prueferkommentar || null,
                                                punktzahl: a.punktzahl || null,
                                                max_punktzahl: a.max_punktzahl || null,
                                                is_extern: true,
                                                extern_verein: a.verein || null,
                                                mitglied_id: null,
                                                stil_id: a.stil_id || null
                                              }, {
                                                datum: a.termin_datum || termin.datum,
                                                stil_name: a.stil_name || termin.stil_name,
                                                ort: termin.ort || '',
                                                zeit: termin.zeit || '',
                                                pruefer_name: termin.pruefer_name || ''
                                              })}
                                              title="Prüfungsprotokoll drucken"
                                              style={{background:'none',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'5px',color:'var(--text-muted,#aaa)',cursor:'pointer',padding:'4px 8px',fontSize:'14px',lineHeight:1}}
                                            >
                                              🖨️
                                            </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Manuell externen Teilnehmer hinzufügen */}
                        {!termin.isVorlage && (
                          <div style={{padding:'8px 0 4px',display:'flex',justifyContent:'flex-end'}}>
                            <button
                              className="logout-button pv3-btn-action-sm"
                              onClick={() => {
                                setExternModalTermin(termin);
                                setExternForm({ vorname: '', nachname: '', verein: '', graduierung_nachher_id: '' });
                                setShowExternModal(true);
                              }}
                            >
                              + Externen Teilnehmer
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Vergangene Termine */}
              {(() => {
                const heute = new Date();
                heute.setHours(0, 0, 0, 0);
                const vergangeneTermine = pruefungstermine.filter(termin => {
                  const terminDatum = new Date(termin.datum);
                  terminDatum.setHours(0, 0, 0, 0);
                  return terminDatum < heute;
                });

                if (vergangeneTermine.length === 0) {
                  return null;
                }

                return (
                  <div>
                    <button
                      className="pv3-vergangene-toggle"
                      onClick={() => setVergangeneExpanded(prev => !prev)}
                    >
                      {vergangeneExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      Vergangene Prüfungstermine ({vergangeneTermine.length})
                    </button>
                    {vergangeneExpanded && (
                    <div className="pv3-termin-group-list">
                      {vergangeneTermine.map((termin, index) => {
                        const datum = new Date(termin.datum);
                        const isToday = false; // Vergangene Termine sind nie heute
                        const isPast = true; // Vergangene Termine sind immer vergangen

                        return (
                          <div
                            key={index}
                            className="pv3-termin-card--past"
                          >
                            {/* Termin-Header */}
                            <div className="pv3-termin-header">
                              <div
                                className="pv2-flex-cursor"
                                onClick={() => toggleTerminExpanded(`${termin.datum}_${termin.stil_id}`, termin)}
                              >
                                <div className="pv3-termin-title-row">
                                  <Calendar size={24} className="pv3-icon-purple" />
                                  <h3 className="pv3-termin-heading-warning">
                                    {datum.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                  </h3>
                                  {expandedTermine[`${termin.datum}_${termin.stil_id}`] ? (
                                    <ChevronUp size={24} className="pv3-icon-chevron-warning" />
                                  ) : (
                                    <ChevronDown size={24} className="pv3-icon-chevron-muted" />
                                  )}
                                  <span className="pv3-badge-past">
                                    Vergangen
                                  </span>
                                </div>
                                <div className="pv3-termin-meta-row">
                                  <div className="pv-flex-row">
                                    <span className="pv2-fw600">⏰ Uhrzeit:</span>
                                    <span>{termin.zeit}</span>
                                  </div>
                                  <div className="pv-flex-row">
                                    <span className="pv2-fw600">🥋 Stil:</span>
                                    <span className="pv3-badge-stil">
                                      {termin.stil_name}
                                    </span>
                                  </div>
                                  <div className="pv-flex-row">
                                    <span className="pv2-fw600">📍 Ort:</span>
                                    <span>{termin.ort}</span>
                                  </div>
                                  <div className="pv-flex-row">
                                    <span className="pv2-fw600">👥 Teilnehmer:</span>
                                    <span className="pv3-badge-teilnehmer">
                                      {termin.anzahl}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="u-flex-gap-sm">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/dashboard/pruefung-durchfuehren?datum=${termin.datum}`);
                                  }}
                                  className="logout-button pv3-btn-results"
                                  title="Zur Live-Prüfungsansicht wechseln"
                                >
                                  🎯 Prüfung öffnen
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePruefungslistePDF(termin);
                                  }}
                                  className="logout-button pv3-btn-action-sm"
                                  title="Teilnehmerliste als PDF drucken"
                                >
                                  PDF
                                </button>
                                {termin.anzahl > 0 && !termin.isVorlage && (
                                  <span className="pv-tooltip-wrap" data-tip="Schnelle Gesamtergebnis-Eingabe: Bestanden/Nicht bestanden + Punkte für alle Teilnehmer auf einmal – ohne Detailbewertung. Für Einzelbewertungen pro Technik → 'Prüfung öffnen' nutzen.">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openBatchErgebnisModal(termin);
                                      }}
                                      className="logout-button pv3-btn-results"
                                    >
                                      <Award size={16} />
                                      Ergebnisse eintragen
                                    </button>
                                  </span>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTerminBearbeiten(termin);
                                  }}
                                  className="logout-button pv3-btn-action-sm"
                                  title="Termin bearbeiten"
                                >
                                  <Edit size={18} />
                                  Bearbeiten
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTerminLoeschen(termin);
                                  }}
                                  className="logout-button pv3-btn-delete"
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(220, 53, 69, 0.4) 0%, rgba(220, 53, 69, 0.2) 50%, transparent 100%)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.3)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(220, 53, 69, 0.3) 0%, rgba(220, 53, 69, 0.1) 50%, transparent 100%)';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(220, 53, 69, 0.2)';
                                  }}
                                  title="Termin löschen"
                                >
                                  <Trash2 size={18} />
                                  Löschen
                                </button>
                              </div>
                            </div>

                            {/* Prüflinge-Liste */}
                            {expandedTermine[`${termin.datum}_${termin.stil_id}`] && (
                              <>
                                {termin.isVorlage ? (
                                <div className="pv3-vorlage-empty">
                                  <Calendar size={48} className="pv3-icon-warning-large" />
                                  <h4 className="pv3-vorlage-empty-title">
                                    Termin ohne Teilnehmer
                                  </h4>
                                  <p className="pv3-vorlage-empty-text">
                                    Dieser Termin wurde angelegt, hat aber noch keine zugelassenen Kandidaten.
                                    <br />
                                    Teilnehmer koennen ueber das Mitgliederprofil zu diesem Termin angemeldet werden.
                                  </p>
                                </div>
                              ) : (
                                <div className="table-container pv2-mt-1">
                                  <table className="data-table pv2-fs-0875">
                                    <thead>
                                      <tr>
                                        <th className="pv3-th-180">Name</th>
                                        <th className="pv3-th-110">Geburtsdatum</th>
                                        <th className="pv3-th-100">Stil</th>
                                        <th className="pv3-th-150">Aktueller Gurt</th>
                                        <th className="pv3-th-150">Angestrebter Gurt</th>
                                        <th className="pv3-th-140">Trainingsstunden</th>
                                        <th className="pv3-th-100">Wartezeit</th>
                                        <th className="pv3-th-130">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {termin.pruefungen.map((pruefung, pIndex) => (
                                        <tr
                                          key={pIndex}
                                          className="hover-row pv3-table-row-gold"
                                        >
                                          <td>
                                            <div className="pv-flex-col-xs">
                                              <span className="pv2-fw700-primary">
                                                {pruefung.vorname} {pruefung.nachname}
                                              </span>
                                              <span className="pv-muted-sm">
                                                ID: {pruefung.mitglied_id}
                                              </span>
                                            </div>
                                          </td>
                                          <td>
                                            <span className="pv-text-secondary">
                                              {pruefung.geburtsdatum ? new Date(pruefung.geburtsdatum).toLocaleDateString('de-DE') : '—'}
                                            </span>
                                          </td>
                                          <td>
                                            <span className="pv3-tag-stil-purple">
                                              {pruefung.stil_name}
                                            </span>
                                          </td>
                                          <td>
                                            <div className="pv-flex-row">
                                              <div
                                                className="pv3-gurt-dot"
                                                style={{ '--dot-color': pruefung.farbe_vorher || '#6b7280' }}
                                              />
                                              <div className="pv2-flex-col">
                                                <span className="pv-bold-primary-sm">
                                                  {pruefung.graduierung_vorher || 'Keine'}
                                                </span>
                                                <span className="pv-muted-xs">
                                                  Ziel-Gurt
                                                </span>
                                              </div>
                                            </div>
                                          </td>
                                          <td>
                                            <div className="pv-flex-row">
                                              <div
                                                className="pv3-gurt-dot"
                                                style={{ '--dot-color': pruefung.farbe_nachher || '#EAB308' }}
                                              />
                                              <div className="pv2-flex-col">
                                                <span className="pv-bold-primary-sm">
                                                  {pruefung.graduierung_nachher}
                                                </span>
                                                <span className="pv-muted-xs">
                                                  Ziel-Gurt
                                                </span>
                                              </div>
                                            </div>
                                          </td>
                                          <td>
                                            <div className="pv-flex-col-sm">
                                              <div className="pv-flex-row">
                                                <span className="pv2-fw700-success">
                                                  {pruefung.anwesenheiten_aktuell || 0}
                                                </span>
                                                <span className="pv-muted-xs">
                                                  / {pruefung.min_trainingseinheiten || 0}
                                                </span>
                                              </div>
                                              <div className="pv3-progress-wrap">
                                                <div
                                                  className={`pv3-bar-fill${((pruefung.anwesenheiten_aktuell || 0) >= (pruefung.min_trainingseinheiten || 0)) ? ' pv3-bar-fill--good' : ' pv3-bar-fill--warn'}`}
                                                  style={{ width: `${Math.min(100, ((pruefung.anwesenheiten_aktuell || 0) / (pruefung.min_trainingseinheiten || 1)) * 100)}%` }}
                                                />
                                              </div>
                                              <span className="pv-muted-xs">
                                                {((pruefung.anwesenheiten_aktuell || 0) >= (pruefung.min_trainingseinheiten || 0)) ? '100%' : Math.round(((pruefung.anwesenheiten_aktuell || 0) / (pruefung.min_trainingseinheiten || 1)) * 100) + '%'} erreicht
                                              </span>
                                            </div>
                                          </td>
                                          <td>
                                            <div className="pv-flex-col-sm">
                                              <span className="pv3-wartezeit-value">
                                                {pruefung.monate_seit_letzter_pruefung || 0} Mon.
                                              </span>
                                              <span className="pv-muted-xs">
                                                von {pruefung.min_wartezeit_monate || 0}
                                              </span>
                                            </div>
                                          </td>
                                          <td>
                                            <span className="pv3-badge-zugelassen">
                                              <Check size={14} />
                                              Zugelassen
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

        </div>
  );
};

export default PruefungsTermineTab;
