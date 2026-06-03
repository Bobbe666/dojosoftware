import React from 'react';
import { FileText, Upload, Plus, Edit, Trash2, X, Calendar, Filter, Search, ChevronDown, ChevronUp, Landmark, Check, XCircle, Lightbulb, FileUp, History, Star } from 'lucide-react';

// Ausgelagert aus BuchhaltungTab.jsx (Bank-Import / Kontoauszug-Abgleich).
// Modals (Upload/Kategorie/Review/Umbuchung/Rechnung) bleiben im Parent; hier nur Trigger via setShow…-Props.
const BuchhaltungBankImportTab = ({
  hasKontoauszug, kategorien, success, bankTransaktionenTotal, bankStatistik, bankImportHistorie, autoVorschlagRunning, alleAnnehmenRunning, bankSortField, bankSortDirection, showTxUploadModal, setShowTxUploadModal, txUploadId, setTxUploadId, bankStatusFilter, setBankStatusFilter, bankPage, setBankPage, showBankUploadModal, setShowBankUploadModal, showKategorieModal, setShowKategorieModal, kategorieModalMwst, setKategorieModalMwst, selectedBankTx, setSelectedBankTx, selectedBankTxIds, setSelectedBankTxIds, bankSearchTerm, setBankSearchTerm, bankLimit, setBankLimit, bankBetragFilter, setBankBetragFilter, bankKategorieFilter, setBankKategorieFilter, bankDatumVon, setBankDatumVon, bankDatumBis, setBankDatumBis, showUmbuchungModal, setShowUmbuchungModal, umbuchungTx, setUmbuchungTx, showRechnungModal, setShowRechnungModal, rechnungTx, setRechnungTx, aehnlicheAnzahl, setAehnlicheAnzahl, autoAlleVorschlagen, alleVorschlaegeAnnehmen, openReviewModal, ladeAehnliche, ignorierenTransaktion, vorschlagAnnehmen, toggleBankTxSelection, toggleAllBankTx, toggleBankSort, getFilteredSortedTransaktionen, deleteTransaktion, loadOffeneRechnungen, deleteImport, formatCurrency, formatDate, getKategorieName
}) => {
  if (!hasKontoauszug) {
    return (
          <div className="enterprise-locked-view">
            <div className="enterprise-locked-icon"><Landmark size={48} /></div>
            <h3>Kontoauszug-Import</h3>
            <p>Importieren Sie Kontoauszüge direkt aus Ihrem Online-Banking und ordnen Sie Transaktionen automatisch zu.</p>
            <ul className="enterprise-feature-list">
              <li><Check size={14} /> Alle deutschen Banken (Sparkasse, Volksbank, DKB, ING, Comdirect, N26, Deutsche Bank, Postbank)</li>
              <li><Check size={14} /> Formate: CSV, XLSX, MT940/STA, XML (camt.052/053 — Holvi, Sparkasse)</li>
              <li><Check size={14} /> Auto-Kategorisierung per Keyword-Erkennung</li>
              <li><Check size={14} /> Duplikaterkennung & Rechnungsabgleich</li>
              <li><Check size={14} /> Direkte EÜR-Übertragung</li>
            </ul>
            <div className="enterprise-badge-large">
              <Star size={16} /> Enterprise-Feature — Upgrade erforderlich
            </div>
          </div>
    );
  }
  return (
          <div className="bankimport-content">
            {/* Statistik-Karten */}
            {bankStatistik && (
              <div className="bank-stats-cards">
                <div className="bank-stat-card">
                  <span className="stat-value">{bankStatistik.unzugeordnet || 0}</span>
                  <span className="stat-label">Unzugeordnet</span>
                </div>
                <div className="bank-stat-card vorschlag">
                  <span className="stat-value">{bankStatistik.vorgeschlagen || 0}</span>
                  <span className="stat-label">Mit Vorschlag</span>
                </div>
                <div className="bank-stat-card zugeordnet">
                  <span className="stat-value">{bankStatistik.zugeordnet || 0}</span>
                  <span className="stat-label">Zugeordnet</span>
                </div>
                <div className="bank-stat-card ignoriert">
                  <span className="stat-value">{bankStatistik.ignoriert || 0}</span>
                  <span className="stat-label">Ignoriert</span>
                </div>
              </div>
            )}

            {/* Auto-Aktionen */}
            {bankStatistik && (bankStatistik.unzugeordnet > 0 || bankStatistik.vorgeschlagen > 0) && (
              <div className="bank-auto-actions">
                {bankStatistik.unzugeordnet > 0 && (
                  <button
                    className="btn-auto-vorschlag"
                    onClick={autoAlleVorschlagen}
                    disabled={autoVorschlagRunning}
                    title="Keyword-Regeln und gelernte Zuordnungen auf alle offenen Transaktionen anwenden"
                  >
                    {autoVorschlagRunning ? (
                      <><span className="spinner-xs" /> Analysiere...</>
                    ) : (
                      <>🤖 {bankStatistik.unzugeordnet} automatisch vorschlagen</>
                    )}
                  </button>
                )}
                {bankStatistik.vorgeschlagen > 0 && (
                  <>
                    <button
                      className="btn-vorschlaege-pruefen"
                      onClick={openReviewModal}
                      title="Vorschläge einzeln prüfen — eine Transaktion nach der anderen"
                    >
                      📋 {bankStatistik.vorgeschlagen} Vorschläge einzeln prüfen
                    </button>
                    <button
                      className="btn-alle-annehmen"
                      onClick={alleVorschlaegeAnnehmen}
                      disabled={alleAnnehmenRunning}
                      title="Alle Vorschläge bestätigen und in EÜR übertragen"
                    >
                      {alleAnnehmenRunning ? (
                        <><span className="spinner-xs" /> Übertrage...</>
                      ) : (
                        <>✅ {bankStatistik.vorgeschlagen} Vorschläge annehmen → EÜR</>
                      )}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Header mit Upload-Button */}
            <div className="bank-header">
              <div className="bank-header-left">
                <h3>
                  <Landmark size={18} />
                  Bank-Transaktionen
                </h3>
                <div className="bank-filter">
                  <select
                    value={bankStatusFilter}
                    onChange={(e) => { setBankStatusFilter(e.target.value); setBankPage(1); }}
                  >
                    <option value="">Alle Status</option>
                    <option value="unzugeordnet">Unzugeordnet</option>
                    <option value="vorgeschlagen">Mit Vorschlag</option>
                    <option value="zugeordnet">Zugeordnet</option>
                    <option value="ignoriert">Ignoriert</option>
                  </select>
                  <select
                    value={bankBetragFilter}
                    onChange={(e) => setBankBetragFilter(e.target.value)}
                  >
                    <option value="">Alle Buchungen</option>
                    <option value="einnahmen">Nur Einnahmen</option>
                    <option value="ausgaben">Nur Ausgaben</option>
                  </select>
                  <select
                    value={bankKategorieFilter}
                    onChange={(e) => setBankKategorieFilter(e.target.value)}
                  >
                    <option value="">Alle Kategorien</option>
                    {kategorien.map(k => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                  {bankKategorieFilter && (
                    <button
                      className="btn-small"
                      onClick={() => setBankKategorieFilter('')}
                      title="Filter zurücksetzen"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="bank-datum-filter">
                  <Calendar size={14} />
                  <input
                    type="date"
                    title="Von Datum"
                    value={bankDatumVon}
                    onChange={(e) => setBankDatumVon(e.target.value)}
                  />
                  <span className="datum-separator">–</span>
                  <input
                    type="date"
                    title="Bis Datum"
                    value={bankDatumBis}
                    onChange={(e) => setBankDatumBis(e.target.value)}
                  />
                  {(bankDatumVon || bankDatumBis) && (
                    <button className="search-clear" onClick={() => { setBankDatumVon(''); setBankDatumBis(''); }} title="Datumsfilter zurücksetzen">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="bank-search">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Suchen..."
                    value={bankSearchTerm}
                    onChange={(e) => setBankSearchTerm(e.target.value)}
                  />
                  {bankSearchTerm && (
                    <button className="search-clear" onClick={() => setBankSearchTerm('')}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <button className="btn-primary" onClick={() => setShowBankUploadModal(true)}>
                <FileUp size={16} />
                Kontoauszug importieren
              </button>
            </div>

            {/* Batch-Aktionen */}
            {selectedBankTxIds.length > 0 && (
              <div className="bank-batch-actions">
                <span>{selectedBankTxIds.length} ausgewählt</span>
                <div className="batch-buttons">
                  <button
                    className="btn-primary"
                    onClick={() => { setAehnlicheAnzahl(0); setKategorieModalMwst('19'); setShowKategorieModal(true); }}
                  >
                    Kategorie zuordnen
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setSelectedBankTxIds([])}
                  >
                    Auswahl aufheben
                  </button>
                </div>
              </div>
            )}

            {/* Transaktions-Tabelle */}
            <div className="bank-table-container">
              <table className="bank-table">
                <thead>
                  <tr>
                    <th className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={selectedBankTxIds.length > 0 &&
                          selectedBankTxIds.length === getFilteredSortedTransaktionen().filter(tx =>
                            tx.status !== 'zugeordnet' && tx.status !== 'ignoriert'
                          ).length}
                        onChange={toggleAllBankTx}
                      />
                    </th>
                    <th className="sortable" onClick={() => toggleBankSort('buchungsdatum')}>
                      Datum
                      {bankSortField === 'buchungsdatum' && (
                        bankSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </th>
                    <th className="sortable" onClick={() => toggleBankSort('organisation_name')}>
                      Organisation
                      {bankSortField === 'organisation_name' && (
                        bankSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </th>
                    <th className="betrag-col sortable" onClick={() => toggleBankSort('betrag')}>
                      Betrag
                      {bankSortField === 'betrag' && (
                        bankSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </th>
                    <th className="sortable" onClick={() => toggleBankSort('auftraggeber_empfaenger')}>
                      Auftraggeber/Empfänger
                      {bankSortField === 'auftraggeber_empfaenger' && (
                        bankSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </th>
                    <th className="sortable" onClick={() => toggleBankSort('verwendungszweck')}>
                      Verwendungszweck
                      {bankSortField === 'verwendungszweck' && (
                        bankSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </th>
                    <th className="sortable" onClick={() => toggleBankSort('status')}>
                      Status
                      {bankSortField === 'status' && (
                        bankSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredSortedTransaktionen().length === 0 ? (
                    <tr>
                      <td colSpan="8" className="no-data">
                        {bankSearchTerm ? 'Keine Treffer für die Suche.' : 'Keine Transaktionen gefunden. Importieren Sie einen Kontoauszug.'}
                      </td>
                    </tr>
                  ) : (
                    getFilteredSortedTransaktionen().map(tx => (
                      <React.Fragment key={tx.transaktion_id}>
                        <tr
                          className={`bank-row ${tx.status}${tx.status !== 'zugeordnet' ? ' bank-row--clickable' : ''}`}
                          onClick={(e) => {
                            if (e.target.closest('input,button')) return;
                            if (tx.status === 'unzugeordnet' || tx.status === 'vorgeschlagen') {
                              setSelectedBankTx(tx);
                              setKategorieModalMwst('19');
                              setShowKategorieModal(true);
                              ladeAehnliche(tx.transaktion_id);
                            }
                          }}
                        >
                          <td className="checkbox-col">
                            {tx.status !== 'zugeordnet' && tx.status !== 'ignoriert' && (
                              <input
                                type="checkbox"
                                checked={selectedBankTxIds.includes(tx.transaktion_id)}
                                onChange={() => toggleBankTxSelection(tx.transaktion_id)}
                              />
                            )}
                          </td>
                          <td>{formatDate(tx.buchungsdatum)}</td>
                          <td className="organisation-col">{tx.organisation_name || '-'}</td>
                          <td className={`betrag-col ${tx.betrag >= 0 ? 'einnahme' : 'ausgabe'}`}>
                            {formatCurrency(tx.betrag)}
                          </td>
                          <td className="auftraggeber-col">{tx.auftraggeber_empfaenger}</td>
                          <td className="verwendungszweck-col">{tx.verwendungszweck}</td>
                          <td>
                            <span className={`bank-status-badge ${tx.status}`}>
                              {tx.status === 'unzugeordnet' && 'Offen'}
                              {tx.status === 'vorgeschlagen' && (() => {
                                let md = tx.match_details;
                                if (typeof md === 'string') { try { md = JSON.parse(md); } catch(e) { md = null; } }
                                const kat = md?.kategorie || (tx.betrag > 0 ? 'Einnahme' : 'Ausgabe');
                                const isFallback = md?.quelle === 'fallback';
                                return <span title={isFallback ? 'Fallback-Vorschlag — bitte prüfen' : 'Klicken zum Ändern'}>{isFallback ? '❓' : '💡'} {kat}</span>;
                              })()}
                              {tx.status === 'zugeordnet' && 'Zugeordnet'}
                              {tx.status === 'ignoriert' && 'Ignoriert'}
                            </span>
                          </td>
                          <td className="actions">
                            {tx.status === 'vorgeschlagen' && (
                              <>
                                <button
                                  className="btn-icon success"
                                  title="Vorschlag annehmen"
                                  onClick={() => vorschlagAnnehmen(tx.transaktion_id)}
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  className="btn-icon"
                                  title="Andere Kategorie wählen"
                                  onClick={() => { setSelectedBankTx(tx); setKategorieModalMwst('19'); setShowKategorieModal(true); ladeAehnliche(tx.transaktion_id); }}
                                >
                                  <Edit size={14} />
                                </button>
                              </>
                            )}
                            {tx.status === 'unzugeordnet' && (
                              <button
                                className="btn-icon"
                                title="Kategorie zuordnen"
                                onClick={() => { setSelectedBankTx(tx); setShowKategorieModal(true); ladeAehnliche(tx.transaktion_id); }}
                              >
                                <Plus size={14} />
                              </button>
                            )}
                            {tx.status === 'unzugeordnet' && tx.betrag > 0 && (
                              <button
                                className="btn-icon rechnung"
                                title="Mit Rechnung verknüpfen"
                                onClick={() => { setRechnungTx(tx); loadOffeneRechnungen(); setShowRechnungModal(true); }}
                              >
                                <FileText size={14} />
                              </button>
                            )}
                            {(tx.status === 'unzugeordnet' || tx.status === 'vorgeschlagen') && (
                              <button
                                className="btn-icon danger"
                                title="Ignorieren"
                                onClick={() => ignorierenTransaktion(tx.transaktion_id)}
                              >
                                <XCircle size={14} />
                              </button>
                            )}
                            {tx.status !== 'zugeordnet' && (
                              <button
                                className="btn-icon danger"
                                title="Transaktion löschen"
                                onClick={() => deleteTransaktion(tx.transaktion_id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                            {tx.status === 'zugeordnet' && (
                              <button
                                className="btn-icon"
                                title="Kategorie ändern (Umbuchung)"
                                onClick={() => { setUmbuchungTx(tx); setShowUmbuchungModal(true); }}
                              >
                                <Edit size={14} />
                              </button>
                            )}
                            {/* Beleg-Anhang */}
                            {tx.datei_name ? (
                              <a
                                href={`/api/buchhaltung/bank-import/transaktion/${tx.transaktion_id}/datei`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-icon success"
                                title={`Anhang: ${tx.datei_name}`}
                              >
                                <FileText size={14} />
                              </a>
                            ) : (
                              <button
                                className="btn-icon"
                                title="Beleg / Quittung anhängen"
                                onClick={() => { setTxUploadId(tx.transaktion_id); setShowTxUploadModal(true); }}
                              >
                                <Upload size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                        {/* Vorschlag-Zeile */}
                        {tx.status === 'vorgeschlagen' && tx.match_details && (
                          <tr className="vorschlag-row">
                            <td></td>
                            <td colSpan="6" className="vorschlag-info">
                              <Lightbulb size={14} />
                              <span>
                                {tx.match_typ === 'beitrag' && `Beitrag: ${tx.match_details.name} (${tx.match_details.monat}/${tx.match_details.jahr})`}
                                {tx.match_typ === 'rechnung' && `Rechnung: ${tx.match_details.rechnungsnummer} - ${tx.match_details.name}`}
                                {tx.match_typ === 'manuell' && `Kategorie: ${getKategorieName(tx.match_details.kategorie)}`}
                              </span>
                              <span className="confidence">
                                ({Math.round((tx.match_confidence || 0) * 100)}% Sicherheit)
                              </span>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {bankTransaktionenTotal > 30 && (
              <div className="pagination">
                {bankLimit !== 0 && (
                  <>
                    <button
                      disabled={bankPage === 1}
                      onClick={() => setBankPage(p => Math.max(1, p - 1))}
                    >
                      Zurück
                    </button>
                    <span>Seite {bankPage} von {Math.ceil(bankTransaktionenTotal / bankLimit)}</span>
                    <button
                      disabled={bankPage >= Math.ceil(bankTransaktionenTotal / bankLimit)}
                      onClick={() => setBankPage(p => p + 1)}
                    >
                      Weiter
                    </button>
                  </>
                )}
                <button
                  className={bankLimit === 0 ? 'btn-active' : ''}
                  onClick={() => {
                    if (bankLimit === 0) {
                      setBankLimit(30);
                      setBankPage(1);
                    } else {
                      setBankLimit(0);
                    }
                  }}
                >
                  {bankLimit === 0 ? 'Seiten anzeigen' : 'Alle anzeigen'}
                </button>
                {bankLimit === 0 && (
                  <span>{bankTransaktionenTotal} Transaktionen</span>
                )}
              </div>
            )}

            {/* Import-Historie */}
            {bankImportHistorie.length > 0 && (
              <div className="bank-historie">
                <h4>
                  <History size={16} />
                  Letzte Imports
                </h4>
                <table className="historie-table">
                  <thead>
                    <tr>
                      <th>Datei</th>
                      <th>Organisation</th>
                      <th>Bank</th>
                      <th>Transaktionen</th>
                      <th>Importiert am</th>
                      <th>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankImportHistorie.map((h, idx) => (
                      <tr key={idx}>
                        <td>{h.datei_name}</td>
                        <td>{h.organisation_name || '-'}</td>
                        <td>{h.bank_name}</td>
                        <td>{h.anzahl_transaktionen}</td>
                        <td>{formatDate(h.importiert_am)}</td>
                        <td>
                          <button
                            className="btn-icon danger"
                            title="Import löschen"
                            onClick={() => deleteImport(h.import_id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
    );
};

export default BuchhaltungBankImportTab;
