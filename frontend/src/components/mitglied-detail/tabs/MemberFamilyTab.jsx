import React from 'react';

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
