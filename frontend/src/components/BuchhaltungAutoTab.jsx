import React from 'react';
import { RefreshCw } from 'lucide-react';

// Ausgelagert aus BuchhaltungTab.jsx (Automatische-Buchungen-Tab).
const BuchhaltungAutoTab = ({ autoEinnahmen, formatCurrency, formatDate }) => {
  return (
          <div className="auto-content">
            <div className="auto-header">
              <h3>
                <RefreshCw size={18} />
                Automatisch erfasste Einnahmen
              </h3>
              <p className="auto-info">
                Diese Einnahmen werden automatisch aus Rechnungen, Verkäufen, Mitgliedsbeiträgen
                und Verbandsbeiträgen übernommen.
              </p>
            </div>

            <div className="auto-table-container">
              <table className="auto-table">
                <thead>
                  <tr>
                    <th>Quelle</th>
                    <th>Datum</th>
                    <th>Organisation</th>
                    <th>Beschreibung</th>
                    <th className="right">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {autoEinnahmen.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="no-data">Keine automatischen Einnahmen gefunden</td>
                    </tr>
                  ) : (
                    autoEinnahmen.map((e, idx) => (
                      <tr key={idx}>
                        <td>
                          <span className={`quelle-badge ${e.quelle}`}>
                            {e.quelle === 'rechnung' && 'Rechnung'}
                            {e.quelle === 'verkauf' && 'Verkauf'}
                            {e.quelle === 'beitrag' && 'Mitgliedsbeitrag'}
                            {e.quelle === 'verbandsbeitrag' && 'Verbandsbeitrag'}
                            {e.quelle === 'beleg' && 'Beleg'}
                          </span>
                        </td>
                        <td>{formatDate(e.datum)}</td>
                        <td>{e.organisation_name}</td>
                        <td>{e.beschreibung}</td>
                        <td className="right">{formatCurrency(e.betrag_brutto)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
  );
};

export default BuchhaltungAutoTab;
