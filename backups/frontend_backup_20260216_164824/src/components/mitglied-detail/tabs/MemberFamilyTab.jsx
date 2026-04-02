import React, { useState, useEffect } from 'react';
import config from '../../../config/config';

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

// Inline-Styles fuer Vertreter-Formular
const inputStyle = {
  width: '100%',
  padding: '0.6rem',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '0.9rem'
};

const labelStyle = {
  color: 'rgba(255, 255, 255, 0.7)',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Familienmitglieder-Liste - immer anzeigen */}
      <div className="field-group card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Familienmitglieder</span>
            {familienId && (
              <span style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.5rem',
                background: 'rgba(255, 215, 0, 0.15)',
                borderRadius: '4px',
                color: '#FFD700'
              }}>
                Familie #{familienId}
              </span>
            )}
          </h3>

          {loadingFamilie ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'rgba(255,255,255,0.5)' }}>
              Lade Familienmitglieder...
            </div>
          ) : familienmitglieder.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {familienmitglieder.map((fm) => (
                <div
                  key={fm.mitglied_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.75rem 1rem',
                    background: fm.mitglied_id === mitglied?.mitglied_id
                      ? 'rgba(255, 215, 0, 0.1)'
                      : 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '8px',
                    border: fm.mitglied_id === mitglied?.mitglied_id
                      ? '1px solid rgba(255, 215, 0, 0.3)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: fm.mitglied_id !== mitglied?.mitglied_id ? 'pointer' : 'default',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => {
                    if (fm.mitglied_id !== mitglied?.mitglied_id) {
                      window.location.href = `/dashboard/mitglieder/${fm.mitglied_id}`;
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (fm.mitglied_id !== mitglied?.mitglied_id) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (fm.mitglied_id !== mitglied?.mitglied_id) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    }
                  }}
                >
                  {/* Avatar/Icon */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: fm.ist_minderjaehrig ? 'rgba(100, 149, 237, 0.2)' : 'rgba(255, 215, 0, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    flexShrink: 0
                  }}>
                    {fm.ist_minderjaehrig ? '👶' : '👤'}
                  </div>

                  {/* Name und Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: '500',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      {fm.vorname} {fm.nachname}
                      {fm.mitglied_id === mitglied?.mitglied_id && (
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.4rem',
                          background: 'rgba(255, 215, 0, 0.2)',
                          borderRadius: '3px',
                          color: '#FFD700'
                        }}>
                          aktuell
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: 'rgba(255, 255, 255, 0.5)',
                      display: 'flex',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                      alignItems: 'center'
                    }}>
                      {fm.alter_jahre !== null && (
                        <span>{fm.alter_jahre} Jahre</span>
                      )}
                      {fm.tarif_name && (
                        <span style={{ color: 'rgba(255, 215, 0, 0.7)' }}>{fm.tarif_name}</span>
                      )}
                      {fm.rabatt_prozent && parseFloat(fm.rabatt_prozent) > 0 && (
                        <span style={{
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          background: 'rgba(76, 175, 80, 0.2)',
                          color: '#4CAF50',
                          fontWeight: '500'
                        }}>
                          -{fm.rabatt_prozent}% {fm.rabatt_grund || 'Rabatt'}
                        </span>
                      )}
                      {fm.vertrag_status && (
                        <span style={{
                          padding: '0.1rem 0.3rem',
                          borderRadius: '3px',
                          fontSize: '0.75rem',
                          background: fm.vertrag_status === 'aktiv' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)',
                          color: fm.vertrag_status === 'aktiv' ? '#4CAF50' : '#FF9800'
                        }}>
                          {fm.vertrag_status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Link-Icon */}
                  {fm.mitglied_id !== mitglied?.mitglied_id && (
                    <div style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '1.2rem' }}>
                      →
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '1.5rem',
              color: 'rgba(255, 255, 255, 0.5)',
              fontStyle: 'italic'
            }}>
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
      <div className="field-group card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Gesetzliche Vertreter</h3>
        {editMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.9rem',
              minWidth: '600px'
            }}>
              <thead>
                <tr style={{
                  borderBottom: '2px solid rgba(255, 215, 0, 0.3)',
                  background: 'rgba(255, 215, 0, 0.05)'
                }}>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'left',
                    color: '#FFD700',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    minWidth: '200px'
                  }}>Vertreter</th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'left',
                    color: '#FFD700',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    minWidth: '200px'
                  }}>Name</th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'left',
                    color: '#FFD700',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    minWidth: '180px'
                  }}>Telefon</th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'left',
                    color: '#FFD700',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    minWidth: '250px'
                  }}>E-Mail</th>
                </tr>
              </thead>
              <tbody>
                {(mitglied.vertreter1_name || mitglied.vertreter1_typ) && (
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                      {mitglied.vertreter1_typ || 'Nicht angegeben'}
                    </td>
                    <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                      {mitglied.vertreter1_name || 'Nicht angegeben'}
                    </td>
                    <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                      {mitglied.vertreter1_telefon || 'Nicht angegeben'}
                    </td>
                    <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                      {mitglied.vertreter1_email || 'Nicht angegeben'}
                    </td>
                  </tr>
                )}
                {(mitglied.vertreter2_name || mitglied.vertreter2_typ) && (
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                      {mitglied.vertreter2_typ || 'Nicht angegeben'}
                    </td>
                    <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                      {mitglied.vertreter2_name || 'Nicht angegeben'}
                    </td>
                    <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                      {mitglied.vertreter2_telefon || 'Nicht angegeben'}
                    </td>
                    <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                      {mitglied.vertreter2_email || 'Nicht angegeben'}
                    </td>
                  </tr>
                )}
                {(!mitglied.vertreter1_name && !mitglied.vertreter1_typ && !mitglied.vertreter2_name && !mitglied.vertreter2_typ) && (
                  <tr>
                    <td colSpan="4" style={{
                      padding: '2rem',
                      textAlign: 'center',
                      color: 'rgba(255, 255, 255, 0.5)',
                      fontStyle: 'italic'
                    }}>
                      Keine Vertreter eingetragen
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="info-box" style={{ marginTop: '1rem' }}>
          <p><strong>Hinweis:</strong> Vertreter-Informationen sind nur fuer minderjaehrige Mitglieder erforderlich oder wenn eine gesetzliche Vertretung vorliegt.</p>
        </div>
      </div>
    </div>
  );
};

export default MemberFamilyTab;
