import React from 'react';
import { FileText, TrendingUp, TrendingDown, Filter, AlertCircle, CheckCircle, Euro, Check, XCircle, BarChart3, Star, ArrowUpRight } from 'lucide-react';

// Ausgelagert aus BuchhaltungTab.jsx (Steuerauswertung-Tab, inkl. Enterprise-Lock + Abgleich).
const BuchhaltungSteuerauswertungTab = ({
  hasKontoauszug, selectedJahr, loading,
  steuerauswertung, steuerLoading, steuerUebertragenLoading, cashflow,
  abgleichBericht, abgleichFilter, setAbgleichFilter, dojoEinstellungen,
  euerUebertragen, formatCurrency
}) => {
  if (!hasKontoauszug) {
    return (
          <div className="enterprise-locked-view">
            <div className="enterprise-locked-icon"><BarChart3 size={48} /></div>
            <h3>Steuerauswertung</h3>
            <p>Analysiert automatisch Ihre importierten Kontoauszüge und bereitet die Daten für EÜR und Bilanz auf.</p>
            <ul className="enterprise-feature-list">
              <li><Check size={14} /> Betriebseinnahmen & -ausgaben automatisch erkannt</li>
              <li><Check size={14} /> Gewinn-/Verlust-Vorschau</li>
              <li><Check size={14} /> Ein-Klick-Übertragung in EÜR</li>
              <li><Check size={14} /> Nicht kategorisierte Buchungen im Blick</li>
            </ul>
            <div className="enterprise-badge-large">
              <Star size={16} /> Enterprise-Feature — Upgrade erforderlich
            </div>
          </div>
    );
  }
  return (
          <div className="steuerauswertung-content">
            <div className="steuer-header">
              <div>
                <h3><BarChart3 size={18} /> Steuerauswertung {selectedJahr}</h3>
                <p className="steuer-subtitle">Auswertung aller importierten Kontoauszüge</p>
              </div>
              <div className="steuer-actions">
                <button
                  className="btn-secondary"
                  onClick={() => euerUebertragen(true)}
                  disabled={steuerUebertragenLoading}
                >
                  <AlertCircle size={14} /> Vorschau
                </button>
                <button
                  className="btn-primary"
                  onClick={() => euerUebertragen(false)}
                  disabled={steuerUebertragenLoading}
                >
                  {steuerUebertragenLoading ? 'Übertrage...' : <><ArrowUpRight size={14} /> In EÜR übertragen</>}
                </button>
              </div>
            </div>

            {steuerLoading && <div className="loading-spinner">Lade Auswertung...</div>}

            {steuerauswertung && !steuerLoading && (
              <>
                {/* EÜR Kennzahlen */}
                {(() => {
                  const isKlein = steuerauswertung.auswertung?.kleinunternehmer ?? dojoEinstellungen.kleinunternehmer;
                  const sumEin  = isKlein ? steuerauswertung.auswertung.summe_einnahmen : steuerauswertung.auswertung.summe_brutto_einnahmen;
                  const sumAus  = isKlein ? steuerauswertung.auswertung.summe_ausgaben  : steuerauswertung.auswertung.summe_brutto_ausgaben;
                  const gewinn  = isKlein ? steuerauswertung.auswertung.gewinn          : steuerauswertung.auswertung.gewinn_brutto;
                  return (
                <div className="steuer-kpi-grid">
                  {isKlein && (
                    <div className="steuer-kpi steuer-kpi--info">
                      <div className="kpi-label">§ 19 UStG</div>
                      <div className="kpi-value" style={{fontSize:'0.9rem'}}>Kleinunternehmer</div>
                      <div className="kpi-sub">Keine Umsatzsteuer</div>
                    </div>
                  )}
                  <div className="steuer-kpi steuer-kpi--einnahmen">
                    <div className="kpi-label">Betriebseinnahmen {isKlein ? '(Netto)' : '(Brutto)'}</div>
                    <div className="kpi-value">{formatCurrency(sumEin)}</div>
                    <div className="kpi-sub">{steuerauswertung.auswertung.betriebseinnahmen?.length || 0} Kategorien</div>
                  </div>
                  <div className="steuer-kpi steuer-kpi--ausgaben">
                    <div className="kpi-label">Betriebsausgaben {isKlein ? '(Netto)' : '(Brutto)'}</div>
                    <div className="kpi-value">{formatCurrency(sumAus)}</div>
                    <div className="kpi-sub">{steuerauswertung.auswertung.betriebsausgaben?.length || 0} Kategorien</div>
                  </div>
                  <div className={`steuer-kpi ${gewinn >= 0 ? 'steuer-kpi--gewinn' : 'steuer-kpi--verlust'}`}>
                    <div className="kpi-label">{gewinn >= 0 ? 'Gewinn (EÜR)' : 'Verlust (EÜR)'}</div>
                    <div className="kpi-value">{formatCurrency(Math.abs(gewinn))}</div>
                    <div className="kpi-sub">{isKlein ? 'Vor Einkommensteuer' : 'Brutto vor Steuern'}</div>
                  </div>
                  {steuerauswertung.auswertung.nicht_kategorisiert?.anzahl > 0 && (
                    <div className="steuer-kpi steuer-kpi--warnung">
                      <div className="kpi-label">Nicht kategorisiert</div>
                      <div className="kpi-value">{steuerauswertung.auswertung.nicht_kategorisiert.anzahl}</div>
                      <div className="kpi-sub">{formatCurrency(steuerauswertung.auswertung.nicht_kategorisiert.summe)}</div>
                    </div>
                  )}
                </div>
                  );
                })()}

                {/* USt-Auswertung — nur für Regelbesteuerung */}
                {steuerauswertung.auswertung.ust && !(steuerauswertung.auswertung?.kleinunternehmer ?? dojoEinstellungen.kleinunternehmer) && (
                  <div className="steuer-section ust-section">
                    <h4><Euro size={16} /> Umsatzsteuer-Auswertung {selectedJahr}</h4>
                    <div className="ust-kpi-grid">
                      <div className="ust-kpi ust-kpi--ust">
                        <div className="ust-kpi-label">Umsatzsteuer (vereinnahmt)</div>
                        <div className="ust-kpi-value">{formatCurrency(steuerauswertung.auswertung.ust.umsatzsteuer)}</div>
                        <div className="ust-kpi-sub">USt auf Einnahmen</div>
                      </div>
                      <div className="ust-kpi ust-kpi--vorsteuer">
                        <div className="ust-kpi-label">Vorsteuer (abzugsfähig)</div>
                        <div className="ust-kpi-value">{formatCurrency(steuerauswertung.auswertung.ust.vorsteuer)}</div>
                        <div className="ust-kpi-sub">aus Eingangsrechnungen</div>
                      </div>
                      <div className={`ust-kpi ${steuerauswertung.auswertung.ust.zahllast >= 0 ? 'ust-kpi--zahllast' : 'ust-kpi--guthaben'}`}>
                        <div className="ust-kpi-label">{steuerauswertung.auswertung.ust.zahllast >= 0 ? 'USt-Zahllast' : 'Vorsteuer-Guthaben'}</div>
                        <div className="ust-kpi-value">{formatCurrency(Math.abs(steuerauswertung.auswertung.ust.zahllast))}</div>
                        <div className="ust-kpi-sub">{steuerauswertung.auswertung.ust.zahllast >= 0 ? '→ an Finanzamt abzuführen' : '→ vom Finanzamt erstattbar'}</div>
                      </div>
                      {steuerauswertung.auswertung.ust.steuerzahlungen > 0 && (
                        <div className="ust-kpi ust-kpi--gezahlt">
                          <div className="ust-kpi-label">Bereits bezahlt</div>
                          <div className="ust-kpi-value">{formatCurrency(steuerauswertung.auswertung.ust.steuerzahlungen)}</div>
                          <div className="ust-kpi-sub">Steuerzahlungen gebucht</div>
                        </div>
                      )}
                    </div>

                    {/* Quartalsweise UStVA-Vorschau */}
                    {steuerauswertung.auswertung.ust.quartale?.length > 0 && (
                      <div className="ust-quartale">
                        <h5>Quartalsweise Vorschau (UStVA)</h5>
                        <table className="steuer-table ust-quartal-table">
                          <thead>
                            <tr>
                              <th>Zeitraum</th>
                              <th className="right">Einnahmen (netto)</th>
                              <th className="right">Ausgaben (netto)</th>
                              <th className="right">USt (KZ 81)</th>
                              <th className="right">Vorsteuer (KZ 66)</th>
                              <th className="right">Zahllast</th>
                            </tr>
                          </thead>
                          <tbody>
                            {steuerauswertung.auswertung.ust.quartale.map((q, i) => (
                              <tr key={i} className={q.zahllast < 0 ? 'ust-row--guthaben' : ''}>
                                <td><strong>{q.label}</strong></td>
                                <td className="right einnahme-betrag">{formatCurrency(q.einnahmen_brutto ?? q.einnahmen_netto)}</td>
                                <td className="right ausgabe-betrag">{formatCurrency(q.ausgaben_brutto ?? q.ausgaben_netto)}</td>
                                <td className="right">{formatCurrency(q.umsatzsteuer)}</td>
                                <td className="right">{formatCurrency(q.vorsteuer)}</td>
                                <td className={`right ${q.zahllast >= 0 ? 'ust-zahllast' : 'ust-guthaben'}`}>
                                  <strong>{q.zahllast >= 0 ? '+' : ''}{formatCurrency(q.zahllast)}</strong>
                                </td>
                              </tr>
                            ))}
                            <tr className="summen-zeile">
                              <td><strong>Gesamt {selectedJahr}</strong></td>
                              <td className="right"><strong>{formatCurrency(steuerauswertung.auswertung.summe_brutto_einnahmen ?? steuerauswertung.auswertung.summe_einnahmen)}</strong></td>
                              <td className="right"><strong>{formatCurrency(steuerauswertung.auswertung.summe_brutto_ausgaben ?? steuerauswertung.auswertung.summe_ausgaben)}</strong></td>
                              <td className="right"><strong>{formatCurrency(steuerauswertung.auswertung.ust.umsatzsteuer)}</strong></td>
                              <td className="right"><strong>{formatCurrency(steuerauswertung.auswertung.ust.vorsteuer)}</strong></td>
                              <td className={`right ${steuerauswertung.auswertung.ust.zahllast >= 0 ? 'ust-zahllast' : 'ust-guthaben'}`}>
                                <strong>{formatCurrency(steuerauswertung.auswertung.ust.zahllast)}</strong>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p className="ust-hinweis">
                          <AlertCircle size={12} /> KZ 81 = Umsatzsteuer 19% · KZ 66 = Abziehbare Vorsteuer · Zahllast = ans Finanzamt abzuführen
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Einnahmen nach Kategorien */}
                {steuerauswertung.auswertung.betriebseinnahmen.length > 0 && (() => {
                  const isKlein = steuerauswertung.auswertung?.kleinunternehmer ?? dojoEinstellungen.kleinunternehmer;
                  const sumLabel = isKlein ? 'Summe (Netto)' : 'Summe (Brutto)';
                  return (
                  <div className="steuer-section">
                    <h4><TrendingUp size={16} /> Betriebseinnahmen nach Kategorie</h4>
                    <table className="steuer-table">
                      <thead>
                        <tr><th>Kategorie</th><th>Anzahl</th><th className="right">{sumLabel}</th></tr>
                      </thead>
                      <tbody>
                        {steuerauswertung.auswertung.betriebseinnahmen.map((e, i) => (
                          <tr key={i}>
                            <td>{e.kategorie}</td>
                            <td>{e.anzahl}</td>
                            <td className="right einnahme-betrag">{formatCurrency(isKlein ? e.summe : (e.summe_brutto ?? e.summe))}</td>
                          </tr>
                        ))}
                        <tr className="summen-zeile">
                          <td><strong>Gesamt</strong></td>
                          <td></td>
                          <td className="right"><strong>{formatCurrency(isKlein ? steuerauswertung.auswertung.summe_einnahmen : (steuerauswertung.auswertung.summe_brutto_einnahmen ?? steuerauswertung.auswertung.summe_einnahmen))}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  );
                })()}

                {/* Ausgaben nach Kategorien */}
                {steuerauswertung.auswertung.betriebsausgaben.length > 0 && (() => {
                  const isKlein = steuerauswertung.auswertung?.kleinunternehmer ?? dojoEinstellungen.kleinunternehmer;
                  const sumLabel = isKlein ? 'Summe (Netto)' : 'Summe (Brutto)';
                  return (
                  <div className="steuer-section">
                    <h4><TrendingDown size={16} /> Betriebsausgaben nach Kategorie</h4>
                    <table className="steuer-table">
                      <thead>
                        <tr><th>Kategorie</th><th>EÜR-Typ</th><th>Anzahl</th><th className="right">{sumLabel}</th></tr>
                      </thead>
                      <tbody>
                        {steuerauswertung.auswertung.betriebsausgaben.map((a, i) => (
                          <tr key={i}>
                            <td>{a.kategorie}</td>
                            <td><span className="euer-typ-badge">{a.euer_typ || '—'}</span></td>
                            <td>{a.anzahl}</td>
                            <td className="right ausgabe-betrag">{formatCurrency(isKlein ? a.summe : (a.summe_brutto ?? a.summe))}</td>
                          </tr>
                        ))}
                        <tr className="summen-zeile">
                          <td><strong>Gesamt</strong></td>
                          <td></td>
                          <td></td>
                          <td className="right"><strong>{formatCurrency(isKlein ? steuerauswertung.auswertung.summe_ausgaben : (steuerauswertung.auswertung.summe_brutto_ausgaben ?? steuerauswertung.auswertung.summe_ausgaben))}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  );
                })()}

                {/* Cashflow-Chart (CSS-Balkendiagramm) */}
                {cashflow && cashflow.monate.length > 0 && (
                  <div className="steuer-section">
                    <h4><TrendingUp size={16} /> Monatlicher Cashflow {selectedJahr}</h4>
                    <div className="cashflow-chart">
                      {(() => {
                        const maxVal = Math.max(...cashflow.monate.map(m => Math.max(m.einnahmen, m.ausgaben)), 1);
                        return cashflow.monate.map((m, i) => (
                          <div key={i} className="cashflow-month">
                            <div className="cashflow-bars">
                              <div className="cashflow-bar cashflow-bar--ein"
                                style={{ height: `${(m.einnahmen / maxVal) * 100}%` }}
                                title={`Einnahmen: ${formatCurrency(m.einnahmen)}`} />
                              <div className="cashflow-bar cashflow-bar--aus"
                                style={{ height: `${(m.ausgaben / maxVal) * 100}%` }}
                                title={`Ausgaben: ${formatCurrency(m.ausgaben)}`} />
                            </div>
                            <div className="cashflow-label">{m.label}</div>
                          </div>
                        ));
                      })()}
                    </div>
                    <div className="cashflow-legend">
                      <span className="legend-ein">■ Einnahmen</span>
                      <span className="legend-aus">■ Ausgaben</span>
                    </div>
                  </div>
                )}

                {/* Abgleich-Status: Was ist neu, was ist schon in EÜR */}
                {cashflow && cashflow.abgleich_status.length > 0 && (
                  <div className="steuer-section">
                    <h4><CheckCircle size={16} /> Abgleich-Status — Doppelzählung vermeiden</h4>
                    <div className="abgleich-status-grid">
                      {cashflow.abgleich_status.map((s, i) => (
                        <div key={i} className={`abgleich-kpi abgleich-kpi--${s.gruppe === 'Bereits in EÜR' ? 'ok' : s.gruppe === 'Ignoriert' ? 'grau' : s.gruppe === 'Nicht zugeordnet' ? 'warn' : 'info'}`}>
                          <div className="kpi-label">{s.gruppe}</div>
                          <div className="kpi-value">{s.anzahl}</div>
                          <div className="kpi-sub">{formatCurrency(s.summe)}</div>
                        </div>
                      ))}
                    </div>
                    <p className="abgleich-hinweis">
                      <AlertCircle size={12} /> Transaktionen die auf <strong>Rechnung, Beitrag oder Verkauf</strong> gemappt sind, werden bei der EÜR-Übertragung automatisch übersprungen — sie sind bereits via ihre Quelltabelle in der EÜR enthalten.
                    </p>
                  </div>
                )}

                {/* Abgleich-Detailtabelle */}
                {abgleichBericht && (
                  <div className="steuer-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0 }}><FileText size={16} /> Transaktionsdetails</h4>
                      <div className="abgleich-filter-row">
                        {['alle', 'neu_kategorisiert', 'bereits_erfasst', 'offen'].map(f => (
                          <button key={f}
                            className={`filter-chip ${abgleichFilter === f ? 'active' : ''}`}
                            onClick={() => setAbgleichFilter(f)}>
                            {f === 'alle' ? 'Alle' : f === 'neu_kategorisiert' ? 'Neu' : f === 'bereits_erfasst' ? 'Bereits in EÜR' : 'Offen'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="abgleich-table-wrap">
                      <table className="steuer-table">
                        <thead>
                          <tr>
                            <th>Datum</th>
                            <th>Auftraggeber / Empfänger</th>
                            <th>Verwendungszweck</th>
                            <th>Kategorie</th>
                            <th>EÜR-Status</th>
                            <th className="right">Betrag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {abgleichBericht.transaktionen
                            .filter(t => abgleichFilter === 'alle' || t.abgleich_typ === abgleichFilter)
                            .slice(0, 50)
                            .map((t, i) => (
                            <tr key={i} className={`abgleich-row abgleich-row--${t.abgleich_typ}`}>
                              <td>{t.buchungsdatum?.substring(0, 10)}</td>
                              <td className="abgleich-auftraggeber">{t.auftraggeber_empfaenger}</td>
                              <td className="abgleich-zweck">{t.verwendungszweck?.substring(0, 60)}</td>
                              <td>{t.kategorie || '—'}</td>
                              <td>
                                <span className={`abgleich-badge abgleich-badge--${t.abgleich_typ}`}>
                                  {t.abgleich_typ === 'bereits_erfasst' ? <CheckCircle size={10} /> : t.abgleich_typ === 'ignoriert' ? <XCircle size={10} /> : t.abgleich_typ === 'neu_kategorisiert' ? <Check size={10} /> : <AlertCircle size={10} />}
                                  {t.abgleich_typ === 'bereits_erfasst' ? 'In EÜR' : t.abgleich_typ === 'ignoriert' ? 'Ignoriert' : t.abgleich_typ === 'neu_kategorisiert' ? 'Neu' : 'Offen'}
                                </span>
                              </td>
                              <td className={`right ${parseFloat(t.betrag) >= 0 ? 'einnahme-betrag' : 'ausgabe-betrag'}`}>
                                {formatCurrency(Math.abs(parseFloat(t.betrag)))}
                              </td>
                            </tr>
                          ))}
                          {abgleichBericht.transaktionen.filter(t => abgleichFilter === 'alle' || t.abgleich_typ === abgleichFilter).length === 0 && (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Keine Transaktionen in diesem Filter</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {steuerauswertung.transaktionen_gesamt === 0 && (
                  <div className="steuer-empty">
                    <BarChart3 size={32} />
                    <p>Noch keine kategorisierten Transaktionen für {selectedJahr}.</p>
                    <p>Importieren Sie zuerst Kontoauszüge im Tab <strong>Kontoauszüge</strong>.</p>
                  </div>
                )}
              </>
            )}
          </div>
  );
};

export default BuchhaltungSteuerauswertungTab;
