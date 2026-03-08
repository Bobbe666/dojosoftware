import React, { useState, useEffect } from 'react';
import config from '../../../config/config';
import './MemberFamilyTab.css';

// Vertreter-Typ Optionen
const VERTRETER_TYPEN = [
  { value: '', label: 'Bitte waehlen' },
  { value: 'Vater', label: 'Vater' },
  { value: 'Mutter', label: 'Mutter' },
  { value: 'Opa', label: 'Opa' },
  { value: 'Oma', label: 'Oma' },
  { value: 'sonstiger gesetzl. Vertreter', label: 'Sonstiger gesetzl. Vertreter' }
];

// Rabatt-Grund Optionen
const RABATT_GRUENDE = [
  { value: '', label: 'Kein Rabatt' },
  { value: 'Familie', label: 'Familienrabatt' },
  { value: 'Student', label: 'Studenten-Rabatt' },
  { value: 'Senior', label: 'Senioren-Rabatt' },
  { value: 'Geschwister', label: 'Geschwister-Rabatt' },
  { value: 'Sonstiges', label: 'Sonstiges' }
];

// Inline-Styles fuer Vertreter-Formular (kept for gridRowStyle / inputStyle / labelStyle used in edit form)
const inputStyle = {
  width: '100%',
  padding: '0.6rem',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  fontSize: '0.9rem'
};

const labelStyle = {
  color: 'var(--text-secondary)',
  fontWeight: '500',
  fontSize: '0.9rem'
};

const gridRowStyle = {
  display: 'grid',
  gridTemplateColumns: '200px 1fr 250px 1fr',
  gap: '1rem',
  alignItems: 'center',
  padding: '1rem',
  background: 'rgba(255, 255, 255, 0.02)',
  borderRadius: '8px',
  border: '1px solid rgba(255, 255, 255, 0.1)'
};

/**
 * MemberFamilyTab - Familie & Vertreter Management
 *
 * Props:
 * - mitglied: Das Mitglied-Objekt (fuer Read-Only Ansicht)
 * - updatedData: Aktuelle Bearbeitungsdaten
 * - editMode: Ob Bearbeitung erlaubt ist
 * - handleChange: Callback fuer Feldaenderungen (e, fieldName)
 * - CustomSelect: Die CustomSelect-Komponente
 */
const MemberFamilyTab = ({
  mitglied,
  updatedData,
  editMode,
  handleChange,
  CustomSelect
}) => {
  // State fuer Familienmitglieder
  const [familienmitglieder, setFamilienmitglieder] = useState([]);
  const [familienId, setFamilienId] = useState(null);
  const [loadingFamilie, setLoadingFamilie] = useState(false);

  // Familienmitglieder laden
  useEffect(() => {
    const fetchFamilienmitglieder = async () => {
      console.log('👨‍👩‍👧 Familie useEffect triggered', { mitglied_id: mitglied?.mitglied_id, familien_id: mitglied?.familien_id });

      if (!mitglied?.mitglied_id) {
        console.log('👨‍👩‍👧 Kein mitglied_id, skip fetch');
        return;
      }

      setLoadingFamilie(true);
      try {
        const token = localStorage.getItem('dojo_auth_token');
        const url = `${config.apiBaseUrl}/mitglieddetail/${mitglied.mitglied_id}/familie`;
        console.log('👨‍👩‍👧 Fetching Familie von:', url);

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('👨‍👩‍👧 Response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('👨‍👩‍👧 Familie data:', data);
          setFamilienId(data.familien_id);
          setFamilienmitglieder(data.familienmitglieder || []);
        } else {
          console.error('👨‍👩‍👧 API Fehler:', response.status, await response.text());
        }
      } catch (error) {
        console.error('👨‍👩‍👧 Fehler beim Laden der Familienmitglieder:', error);
      } finally {
        setLoadingFamilie(false);
      }
    };

    fetchFamilienmitglieder();
  }, [mitglied?.mitglied_id, mitglied?.familien_id]);

  // Fallback Select-Komponente
  const SelectComponent = CustomSelect || (({ value, onChange, options }) => (
    <select value={value} onChange={onChange} style={inputStyle}>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  ));

  return (
    <div className="mft-root">
      {/* Familienmitglieder-Liste - immer anzeigen */}
      <div className="field-group card u-mb-15">
          <h3 className="mft-h3-familie">
            <span>Familienmitglieder</span>
            {familienId && (
              <span className="mft-familie-badge">
                Familie #{familienId}
              </span>
            )}
          </h3>

          {loadingFamilie ? (
            <div className="mft-loading">
              Lade Familienmitglieder...
            </div>
          ) : familienmitglieder.length > 0 ? (
            <div className="u-flex-col-md">
              {familienmitglieder.map((fm) => (
                <div
                  key={fm.mitglied_id}
                  className={`mft-member-row ${fm.mitglied_id === mitglied?.mitglied_id ? 'mft-member-row--current' : 'mft-member-row--other'}`}
                  onClick={() => {
                    if (fm.mitglied_id !== mitglied?.mitglied_id) {
                      window.location.href = `/dashboard/mitglieder/${fm.mitglied_id}`;
                    }
                  }}
                >
                  {/* Avatar/Icon */}
                  <div className={`mft-avatar ${fm.ist_minderjaehrig ? 'mft-avatar--minor' : 'mft-avatar--adult'}`}>
                    {fm.ist_minderjaehrig ? '👶' : '👤'}
                  </div>

                  {/* Name und Details */}
                  <div className="u-flex-1-min0">
                    <div className="mft-member-name">
                      {fm.vorname} {fm.nachname}
                      {fm.mitglied_id === mitglied?.mitglied_id && (
                        <span className="mft-current-badge">
                          aktuell
                        </span>
                      )}
                    </div>
                    <div className="mft-member-meta">
                      {fm.alter_jahre !== null && (
                        <span>{fm.alter_jahre} Jahre</span>
                      )}
                      {fm.tarif_name && (
                        <span className="mft-tarif-name">{fm.tarif_name}</span>
                      )}
                      {fm.rabatt_prozent && parseFloat(fm.rabatt_prozent) > 0 && (
                        <span className="mft-rabatt-badge">
                          -{fm.rabatt_prozent}% {fm.rabatt_grund || 'Rabatt'}
                        </span>
                      )}
                      {fm.vertrag_status && (
                        <span className={fm.vertrag_status === 'aktiv' ? 'mft-vertrag-aktiv' : 'mft-vertrag-inaktiv'}>
                          {fm.vertrag_status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Link-Icon */}
                  {fm.mitglied_id !== mitglied?.mitglied_id && (
                    <div className="mft-link-arrow">
                      →
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mft-empty">
              Keine Familienmitglieder vorhanden
            </div>
          )}
        </div>

      {/* Familienmanagement */}
      <div className="field-group card">
        <h3>Familienmanagement</h3>
        <div>
          <label>Familien-ID:</label>
          {editMode ? (
            <input
              type="number"
              value={updatedData.familien_id || ""}
              onChange={(e) => handleChange(e, "familien_id")}
              placeholder="z.B. 1001 (fuer Familienzuordnung)"
            />
          ) : (
            <span>{mitglied.familien_id || "Keine Familienzuordnung"}</span>
          )}
        </div>
        <div>
          <label>Rabatt (%):</label>
          {editMode ? (
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={updatedData.rabatt_prozent || ""}
              onChange={(e) => handleChange(e, "rabatt_prozent")}
              placeholder="z.B. 15.50"
            />
          ) : (
            <span>
              {mitglied.rabatt_prozent && parseFloat(mitglied.rabatt_prozent) > 0
                ? `${mitglied.rabatt_prozent}%`
                : "Kein Rabatt"
              }
            </span>
          )}
        </div>
        <div>
          <label>Rabatt-Grund:</label>
          {editMode ? (
            <SelectComponent
              value={updatedData.rabatt_grund || ""}
              onChange={(e) => handleChange(e, "rabatt_grund")}
              options={RABATT_GRUENDE}
            />
          ) : (
            <span>{mitglied.rabatt_grund || "Kein Rabatt"}</span>
          )}
        </div>
        {mitglied.familien_id && (
          <div className="info-box">
            <p><strong>Hinweis:</strong> Dieses Mitglied ist der Familie {mitglied.familien_id} zugeordnet.</p>
          </div>
        )}
      </div>

      {/* Gesetzliche Vertreter */}
      <div className="field-group card u-mb-15">
        <h3 className="mft-h3-vertreter">Gesetzliche Vertreter</h3>
        {editMode ? (
          <div className="mft-edit-col">
            {/* Vertreter 1 */}
            <div style={gridRowStyle}>
              <label style={labelStyle}>Vertreter:</label>
              <select
                value={updatedData.vertreter1_typ || ""}
                onChange={(e) => handleChange(e, "vertreter1_typ")}
                style={inputStyle}
              >
                {VERTRETER_TYPEN.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <label style={labelStyle}>Telefon:</label>
              <input
                type="tel"
                value={updatedData.vertreter1_telefon || ""}
                onChange={(e) => handleChange(e, "vertreter1_telefon")}
                placeholder="+49 123 456789"
                style={inputStyle}
              />
              <label style={labelStyle}>Name:</label>
              <input
                type="text"
                value={updatedData.vertreter1_name || ""}
                onChange={(e) => handleChange(e, "vertreter1_name")}
                placeholder="Vor- und Nachname"
                style={inputStyle}
              />
              <label style={labelStyle}>E-Mail:</label>
              <input
                type="email"
                value={updatedData.vertreter1_email || ""}
                onChange={(e) => handleChange(e, "vertreter1_email")}
                placeholder="vertreter@example.com"
                style={inputStyle}
              />
            </div>

            {/* Vertreter 2 */}
            <div style={gridRowStyle}>
              <label style={labelStyle}>Vertreter:</label>
              <select
                value={updatedData.vertreter2_typ || ""}
                onChange={(e) => handleChange(e, "vertreter2_typ")}
                style={inputStyle}
              >
                {VERTRETER_TYPEN.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <label style={labelStyle}>Telefon:</label>
              <input
                type="tel"
                value={updatedData.vertreter2_telefon || ""}
                onChange={(e) => handleChange(e, "vertreter2_telefon")}
                placeholder="+49 123 456789"
                style={inputStyle}
              />
              <label style={labelStyle}>Name:</label>
              <input
                type="text"
                value={updatedData.vertreter2_name || ""}
                onChange={(e) => handleChange(e, "vertreter2_name")}
                placeholder="Vor- und Nachname (optional)"
                style={inputStyle}
              />
              <label style={labelStyle}>E-Mail:</label>
              <input
                type="email"
                value={updatedData.vertreter2_email || ""}
                onChange={(e) => handleChange(e, "vertreter2_email")}
                placeholder="vertreter2@example.com"
                style={inputStyle}
              />
            </div>
          </div>
        ) : (
          /* Read-Only Tabelle */
          <div className="mft-table-wrap">
            <table className="mft-table">
              <thead>
                <tr className="mft-thead-row">
                  <th className="mft-th">Vertreter</th>
                  <th className="mft-th">Name</th>
                  <th className="mft-th mft-th--telefon">Telefon</th>
                  <th className="mft-th mft-th--email">E-Mail</th>
                </tr>
              </thead>
              <tbody>
                {(mitglied.vertreter1_name || mitglied.vertreter1_typ) && (
                  <tr className="mft-tbody-row">
                    <td className="mft-td">
                      {mitglied.vertreter1_typ || 'Nicht angegeben'}
                    </td>
                    <td className="mft-td">
                      {mitglied.vertreter1_name || 'Nicht angegeben'}
                    </td>
                    <td className="mft-td">
                      {mitglied.vertreter1_telefon || 'Nicht angegeben'}
                    </td>
                    <td className="mft-td">
                      {mitglied.vertreter1_email || 'Nicht angegeben'}
                    </td>
                  </tr>
                )}
                {(mitglied.vertreter2_name || mitglied.vertreter2_typ) && (
                  <tr className="mft-tbody-row">
                    <td className="mft-td">
                      {mitglied.vertreter2_typ || 'Nicht angegeben'}
                    </td>
                    <td className="mft-td">
                      {mitglied.vertreter2_name || 'Nicht angegeben'}
                    </td>
                    <td className="mft-td">
                      {mitglied.vertreter2_telefon || 'Nicht angegeben'}
                    </td>
                    <td className="mft-td">
                      {mitglied.vertreter2_email || 'Nicht angegeben'}
                    </td>
                  </tr>
                )}
                {(!mitglied.vertreter1_name && !mitglied.vertreter1_typ && !mitglied.vertreter2_name && !mitglied.vertreter2_typ) && (
                  <tr>
                    <td colSpan="4" className="mft-td-empty">
                      Keine Vertreter eingetragen
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="info-box mft-infobox-mt">
          <p><strong>Hinweis:</strong> Vertreter-Informationen sind nur fuer minderjaehrige Mitglieder erforderlich oder wenn eine gesetzliche Vertretung vorliegt.</p>
        </div>
      </div>
    </div>
  );
};

export default MemberFamilyTab;
