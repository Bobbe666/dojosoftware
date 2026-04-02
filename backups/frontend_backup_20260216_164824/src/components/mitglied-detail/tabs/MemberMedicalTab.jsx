import React from 'react';

// Standard-Allergien zur Auswahl
const COMMON_ALLERGIES = [
  'Nüsse/Erdnüsse',
  'Milch/Laktose',
  'Gluten/Weizen',
  'Eier',
  'Fisch/Meeresfrüchte',
  'Soja',
  'Insektenstiche (Bienen/Wespen)',
  'Medikamente (Penicillin etc.)',
  'Latex',
  'Pollen/Heuschnupfen',
  'Hausstaub/Milben',
  'Tierhaare',
  'Sonstiges'
];

// Beziehungs-Optionen für Notfallkontakte
const RELATIONSHIP_OPTIONS = [
  { value: '', label: 'Bitte wählen' },
  { value: 'Elternteil', label: 'Elternteil' },
  { value: 'Partner/in', label: 'Partner/in' },
  { value: 'Geschwister', label: 'Geschwister' },
  { value: 'Freund/in', label: 'Freund/in' },
  { value: 'Arzt', label: 'Hausarzt' },
  { value: 'Sonstiges', label: 'Sonstiges' }
];

/**
 * MemberMedicalTab - Medizinische Informationen und Notfallkontakte
 *
 * Props:
 * - mitglied: Das Mitglied-Objekt (für Read-Only Ansicht)
 * - updatedData: Aktuelle Bearbeitungsdaten
 * - editMode: Ob Bearbeitung erlaubt ist
 * - handleChange: Callback für Feldänderungen (e, fieldName)
 * - CustomSelect: Die CustomSelect-Komponente
 * - allergien: Array der aktiven Allergien [{id, value}]
 * - allergienArchiv: Array der archivierten Allergien
 * - newAllergie: State für neue Allergie {type, custom}
 * - setNewAllergie: Setter für newAllergie
 * - addAllergie: Funktion zum Hinzufügen einer Allergie
 * - removeAllergie: Funktion zum Entfernen einer Allergie (id)
 */
const MemberMedicalTab = ({
  mitglied,
  updatedData,
  editMode,
  handleChange,
  CustomSelect,
  allergien = [],
  allergienArchiv = [],
  newAllergie = { type: '', custom: '' },
  setNewAllergie,
  addAllergie,
  removeAllergie
}) => {
  // Fallback Select-Komponente
  const SelectComponent = CustomSelect || (({ value, onChange, options, className }) => (
    <select className={className} value={value} onChange={onChange}>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  ));

  return (
    <div className="medizinisch-container">
      {/* Medizinische Informationen */}
      <div className="field-group card">
        <h3>Medizinische Informationen</h3>

        {/* Allergien-Management */}
        <div className="allergie-management">
          <label>Allergien:</label>
          {editMode ? (
            <div className="allergien-editor">
              {/* Bestehende Allergien anzeigen */}
              <div className="allergien-liste">
                {allergien.length === 0 ? (
                  <p className="no-allergien">Keine Allergien erfasst</p>
                ) : (
                  allergien.map((allergie) => (
                    <div key={allergie.id} className="allergie-tag">
                      <span className="allergie-name">{allergie.value}</span>
                      <button
                        type="button"
                        className="allergie-remove"
                        onClick={() => removeAllergie(allergie.id)}
                        title="Allergie archivieren"
                      >
                        x
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Neue Allergie hinzufügen */}
              <div className="allergie-add-form">
                <div className="add-form-controls">
                  <SelectComponent
                    value={newAllergie.type}
                    onChange={(e) => setNewAllergie({ ...newAllergie, type: e.target.value })}
                    className="allergie-select"
                    options={[
                      { value: '', label: 'Allergie auswählen...' },
                      ...COMMON_ALLERGIES.map(allergy => ({ value: allergy, label: allergy }))
                    ]}
                  />

                  {newAllergie.type === 'Sonstiges' && (
                    <input
                      type="text"
                      value={newAllergie.custom}
                      onChange={(e) => setNewAllergie({ ...newAllergie, custom: e.target.value })}
                      placeholder="Eigene Allergie eingeben..."
                      className="allergie-custom-input"
                    />
                  )}

                  <button
                    type="button"
                    onClick={addAllergie}
                    className="allergie-add-btn"
                    disabled={!newAllergie.type || (newAllergie.type === 'Sonstiges' && !newAllergie.custom.trim())}
                    title="Allergie hinzufügen"
                  >
                    + Hinzufuegen
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="allergien-anzeige">
              {allergien.length === 0 ? (
                <span className="no-allergien-display">Keine Allergien bekannt</span>
              ) : (
                <div className="allergien-tags-readonly">
                  {allergien.map((allergie) => (
                    <span key={allergie.id} className="allergie-tag-readonly">
                      {allergie.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Archivierte Allergien */}
        {allergienArchiv && allergienArchiv.length > 0 && (
          <div className="allergie-archiv" style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'rgba(255, 165, 0, 0.05)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 165, 0, 0.2)'
          }}>
            <label style={{
              fontSize: '0.85rem',
              color: 'rgba(255, 165, 0, 0.8)',
              fontWeight: '600',
              display: 'block',
              marginBottom: '0.5rem'
            }}>
              Archivierte Allergien (geloescht):
            </label>
            <div className="allergien-archiv-liste" style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              {allergienArchiv.map((allergie, index) => (
                <div key={index} style={{
                  background: 'rgba(255, 165, 0, 0.1)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(255, 165, 0, 0.3)',
                  fontSize: '0.85rem'
                }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    {allergie.value}
                  </span>
                  {allergie.geloescht_am_readable && (
                    <span style={{
                      marginLeft: '0.5rem',
                      fontSize: '0.75rem',
                      color: 'rgba(255, 165, 0, 0.6)',
                      fontStyle: 'italic'
                    }}>
                      (geloescht: {allergie.geloescht_am_readable})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Medizinische Hinweise */}
        <div>
          <label>Medizinische Hinweise:</label>
          {editMode ? (
            <textarea
              rows="3"
              value={updatedData.medizinische_hinweise || ""}
              onChange={(e) => handleChange(e, "medizinische_hinweise")}
              placeholder="z.B. Asthma, Herzprobleme, Medikamente..."
            />
          ) : (
            <span>{mitglied.medizinische_hinweise || "Keine"}</span>
          )}
        </div>
      </div>

      {/* Notfallkontakte */}
      <div className="field-group card">
        <h3>Notfallkontakte</h3>

        {/* Notfallkontakt 1 - Primär */}
        <div className="emergency-contact-section">
          <div className="contact-grid">
            <div className="contact-header">
              <h4>Notfallkontakt 1 <span className="primary-badge">Primaer</span></h4>
            </div>
            <div>
              <label>Name:</label>
              {editMode ? (
                <input
                  type="text"
                  value={updatedData.notfallkontakt_name || ""}
                  onChange={(e) => handleChange(e, "notfallkontakt_name")}
                  placeholder="Max Mustermann"
                />
              ) : (
                <span>{mitglied.notfallkontakt_name || "Nicht angegeben"}</span>
              )}
            </div>
            <div>
              <label>Telefon:</label>
              {editMode ? (
                <input
                  type="tel"
                  value={updatedData.notfallkontakt_telefon || ""}
                  onChange={(e) => handleChange(e, "notfallkontakt_telefon")}
                  placeholder="+49 123 456789"
                />
              ) : (
                <span>{mitglied.notfallkontakt_telefon || "Nicht angegeben"}</span>
              )}
            </div>
            <div>
              <label>Verhaeltnis:</label>
              {editMode ? (
                <SelectComponent
                  value={updatedData.notfallkontakt_verhaeltnis || ""}
                  onChange={(e) => handleChange(e, "notfallkontakt_verhaeltnis")}
                  options={RELATIONSHIP_OPTIONS}
                />
              ) : (
                <span>{mitglied.notfallkontakt_verhaeltnis || "Nicht angegeben"}</span>
              )}
            </div>
          </div>
        </div>

        {/* Notfallkontakt 2 */}
        <div className="emergency-contact-section">
          <div className="contact-grid">
            <div className="contact-header">
              <h4>Notfallkontakt 2</h4>
            </div>
            <div>
              <label>Name:</label>
              {editMode ? (
                <input
                  type="text"
                  value={updatedData.notfallkontakt2_name || ""}
                  onChange={(e) => handleChange(e, "notfallkontakt2_name")}
                  placeholder="Maria Musterfrau"
                />
              ) : (
                <span>{mitglied.notfallkontakt2_name || "Nicht angegeben"}</span>
              )}
            </div>
            <div>
              <label>Telefon:</label>
              {editMode ? (
                <input
                  type="tel"
                  value={updatedData.notfallkontakt2_telefon || ""}
                  onChange={(e) => handleChange(e, "notfallkontakt2_telefon")}
                  placeholder="+49 123 456789"
                />
              ) : (
                <span>{mitglied.notfallkontakt2_telefon || "Nicht angegeben"}</span>
              )}
            </div>
            <div>
              <label>Verhaeltnis:</label>
              {editMode ? (
                <SelectComponent
                  value={updatedData.notfallkontakt2_verhaeltnis || ""}
                  onChange={(e) => handleChange(e, "notfallkontakt2_verhaeltnis")}
                  options={RELATIONSHIP_OPTIONS}
                />
              ) : (
                <span>{mitglied.notfallkontakt2_verhaeltnis || "Nicht angegeben"}</span>
              )}
            </div>
          </div>
        </div>

        {/* Notfallkontakt 3 */}
        <div className="emergency-contact-section">
          <div className="contact-grid">
            <div className="contact-header">
              <h4>Notfallkontakt 3</h4>
            </div>
            <div>
              <label>Name:</label>
              {editMode ? (
                <input
                  type="text"
                  value={updatedData.notfallkontakt3_name || ""}
                  onChange={(e) => handleChange(e, "notfallkontakt3_name")}
                  placeholder="Dr. med. Beispiel"
                />
              ) : (
                <span>{mitglied.notfallkontakt3_name || "Nicht angegeben"}</span>
              )}
            </div>
            <div>
              <label>Telefon:</label>
              {editMode ? (
                <input
                  type="tel"
                  value={updatedData.notfallkontakt3_telefon || ""}
                  onChange={(e) => handleChange(e, "notfallkontakt3_telefon")}
                  placeholder="+49 123 456789"
                />
              ) : (
                <span>{mitglied.notfallkontakt3_telefon || "Nicht angegeben"}</span>
              )}
            </div>
            <div>
              <label>Verhaeltnis:</label>
              {editMode ? (
                <SelectComponent
                  value={updatedData.notfallkontakt3_verhaeltnis || ""}
                  onChange={(e) => handleChange(e, "notfallkontakt3_verhaeltnis")}
                  options={RELATIONSHIP_OPTIONS}
                />
              ) : (
                <span>{mitglied.notfallkontakt3_verhaeltnis || "Nicht angegeben"}</span>
              )}
            </div>
          </div>
        </div>

        <div className="info-box">
          <p><strong>Hinweis:</strong> Es wird empfohlen, mindestens einen Primaerkontakt anzugeben. Zusaetzliche Kontakte bieten mehr Sicherheit im Notfall.</p>
        </div>
      </div>
    </div>
  );
};

export default MemberMedicalTab;
