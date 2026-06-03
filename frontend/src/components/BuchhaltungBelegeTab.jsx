import React from 'react';
import { FileText, Receipt, Upload, Plus, Edit, Trash2, Lock, Camera } from 'lucide-react';

// Ausgelagert aus BuchhaltungTab.jsx (Belege-Tab). Quick-Capture-Modal bleibt im Parent.
const BuchhaltungBelegeTab = ({
  belege, belegeTotal, belegePage, setBelegePage,
  showBelegModal, setShowBelegModal, editingBeleg, setEditingBeleg,
  showUploadModal, setShowUploadModal, uploadBelegId, setUploadBelegId,
  openQuickCapture, stornoBeleg, festschreibenBeleg, resetBelegForm, editBeleg,
  formatCurrency, formatDate, getKategorieName
}) => {
  return (
          <div className="belege-content">
            <div className="belege-header">
              <h3>
                <Receipt size={18} />
                Manuelle Belege
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" onClick={openQuickCapture} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Camera size={16} />
                  Foto aufnehmen
                </button>
                <button className="btn-primary" onClick={() => { resetBelegForm(); setEditingBeleg(null); setShowBelegModal(true); }}>
                  <Plus size={16} />
                  Neuer Beleg
                </button>
              </div>
            </div>

            {/* Belege Tabelle */}
            <div className="belege-table-container">
              <table className="belege-table">
                <thead>
                  <tr>
                    <th>Beleg-Nr.</th>
                    <th>Datum</th>
                    <th>Organisation</th>
                    <th>Typ</th>
                    <th>Kategorie</th>
                    <th>Beschreibung</th>
                    <th className="right">Betrag</th>
                    <th>Status</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {belege.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="no-data">Keine Belege vorhanden</td>
                    </tr>
                  ) : (
                    belege.map(beleg => (
                      <tr key={beleg.beleg_id} className={beleg.storniert ? 'storniert' : ''}>
                        <td>{beleg.beleg_nummer}</td>
                        <td>{formatDate(beleg.beleg_datum)}</td>
                        <td>{beleg.organisation_name}</td>
                        <td>
                          <span className={`typ-badge ${beleg.buchungsart}`}>
                            {beleg.buchungsart === 'einnahme' ? 'Einnahme' : 'Ausgabe'}
                          </span>
                        </td>
                        <td>{getKategorieName(beleg.kategorie)}</td>
                        <td className="beschreibung-cell">{beleg.beschreibung}</td>
                        <td className="right">{formatCurrency(beleg.betrag_brutto)}</td>
                        <td>
                          {beleg.festgeschrieben && (
                            <span className="status-badge festgeschrieben">
                              <Lock size={12} /> Fest
                            </span>
                          )}
                          {beleg.datei_name && (
                            <span className="status-badge datei">
                              <FileText size={12} />
                            </span>
                          )}
                        </td>
                        <td className="actions">
                          {!beleg.festgeschrieben && (
                            <>
                              <button className="btn-icon" title="Bearbeiten" onClick={() => editBeleg(beleg)}>
                                <Edit size={14} />
                              </button>
                              <button className="btn-icon" title="Datei hochladen" onClick={() => { setUploadBelegId(beleg.beleg_id); setShowUploadModal(true); }}>
                                <Upload size={14} />
                              </button>
                              <button className="btn-icon" title="Festschreiben" onClick={() => festschreibenBeleg(beleg.beleg_id)}>
                                <Lock size={14} />
                              </button>
                              <button className="btn-icon danger" title="Stornieren" onClick={() => stornoBeleg(beleg.beleg_id)}>
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                          {beleg.datei_name && (
                            <a
                              href={`/api/buchhaltung/belege/${beleg.beleg_id}/datei`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-icon"
                              title="Datei anzeigen"
                            >
                              <FileText size={14} />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {belegeTotal > belegeLimit && (
              <div className="pagination">
                <button
                  disabled={belegePage === 1}
                  onClick={() => setBelegePage(p => Math.max(1, p - 1))}
                >
                  Zurück
                </button>
                <span>Seite {belegePage} von {Math.ceil(belegeTotal / belegeLimit)}</span>
                <button
                  disabled={belegePage >= Math.ceil(belegeTotal / belegeLimit)}
                  onClick={() => setBelegePage(p => p + 1)}
                >
                  Weiter
                </button>
              </div>
            )}
          </div>
  );
};

export default BuchhaltungBelegeTab;
