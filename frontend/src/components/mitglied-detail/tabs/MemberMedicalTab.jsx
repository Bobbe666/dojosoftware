import React from 'react';
import '../../../styles/MemberMedicalTab.css';

const COMMON_ALLERGIES = [
  'Nüsse/Erdnüsse', 'Milch/Laktose', 'Gluten/Weizen', 'Eier',
  'Fisch/Meeresfrüchte', 'Soja', 'Insektenstiche (Bienen/Wespen)',
  'Medikamente (Penicillin etc.)', 'Latex', 'Pollen/Heuschnupfen',
  'Hausstaub/Milben', 'Tierhaare', 'Sonstiges'
];

const RELATIONSHIP_OPTIONS = [
  { value: '', label: 'Bitte wählen' },
  { value: 'Mutter', label: 'Mutter' },
  { value: 'Vater', label: 'Vater' },
  { value: 'Elternteil', label: 'Elternteil' },
  { value: 'Partner/in', label: 'Partner/in' },
  { value: 'Geschwister', label: 'Geschwister' },
  { value: 'Freund/in', label: 'Freund/in' },
  { value: 'Arzt', label: 'Hausarzt' },
  { value: 'Sonstiges', label: 'Sonstiges' }
];

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
  const SelectComponent = CustomSelect || (({ value, onChange, options, className }) => (
    <select className={className} value={value} onChange={onChange}>
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  ));

  return (
    <div className="mmt-container">

      {/* ── Zeile 1: Allergien + Medizinische Hinweise ── */}
      <div className="mmt-top-row">

        {/* Allergien */}
        <div className="field-group card">
          <h3 className="mmt-section-title">🌿 Allergien</h3>

          {editMode ? (
            <>
              <div className="mmt-tags-wrap">
                {allergien.length === 0
                  ? <span className="mmt-placeholder">Noch keine Allergien erfasst</span>
                  : allergien.map(a => (
                    <span key={a.id} className="mmt-tag mmt-tag--red">
                      {a.value}
                      <button type="button" className="mmt-tag-x" onClick={() => removeAllergie(a.id)}>×</button>
                    </span>
                  ))
                }
              </div>
              <div className="mmt-add-row">
                <SelectComponent
                  value={newAllergie.type}
                  onChange={(e) => setNewAllergie({ ...newAllergie, type: e.target.value })}
                  className="mmt-select"
                  options={[{ value: '', label: 'Allergie wählen…' }, ...COMMON_ALLERGIES.map(a => ({ value: a, label: a }))]}
                />
                {newAllergie.type === 'Sonstiges' && (
                  <input
                    type="text"
                    className="mmt-input"
                    value={newAllergie.custom}
                    onChange={(e) => setNewAllergie({ ...newAllergie, custom: e.target.value })}
                    placeholder="Eigene Allergie…"
                  />
                )}
                <button
                  type="button"
                  className="mmt-btn"
                  onClick={addAllergie}
                  disabled={!newAllergie.type || (newAllergie.type === 'Sonstiges' && !newAllergie.custom.trim())}
                >+ Hinzufügen</button>
              </div>
            </>
          ) : (
            <div className="mmt-tags-wrap">
              {allergien.length === 0
                ? <span className="mmt-placeholder">Keine Allergien bekannt</span>
                : allergien.map(a => <span key={a.id} className="mmt-tag mmt-tag--red">{a.value}</span>)
              }
            </div>
          )}

          {allergienArchiv?.length > 0 && (
            <div className="mmt-archiv-box">
              <span className="mmt-archiv-label">Archiviert</span>
              <div className="mmt-tags-wrap">
                {allergienArchiv.map((a, i) => (
                  <span key={i} className="mmt-tag mmt-tag--dim">
                    {a.value}{a.geloescht_am_readable && <em> ({a.geloescht_am_readable})</em>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Medizinische Hinweise */}
        <div className="field-group card">
          <h3 className="mmt-section-title">⚕️ Medizinische Hinweise</h3>
          {editMode ? (
            <textarea
              className="mmt-textarea"
              rows={6}
              value={updatedData.medizinische_hinweise || ''}
              onChange={(e) => handleChange(e, 'medizinische_hinweise')}
              placeholder="z.B. Asthma, Herzprobleme, Medikamente…"
            />
          ) : (
            <p className={mitglied.medizinische_hinweise ? 'mmt-text' : 'mmt-placeholder'}>
              {mitglied.medizinische_hinweise || 'Keine medizinischen Hinweise hinterlegt.'}
            </p>
          )}
        </div>
      </div>

      {/* ── Zeile 2: 3 Notfallkontakte ── */}
      <div className="mmt-contacts-row">
        {[
          { label: 'Notfallkontakt 1', primary: true,  nf: 'notfallkontakt',  nf2: 'notfallkontakt',  nf3: 'notfallkontakt'  },
          { label: 'Notfallkontakt 2', primary: false, nf: 'notfallkontakt2', nf2: 'notfallkontakt2', nf3: 'notfallkontakt2' },
          { label: 'Notfallkontakt 3', primary: false, nf: 'notfallkontakt3', nf2: 'notfallkontakt3', nf3: 'notfallkontakt3' },
        ].map(({ label, primary, nf }) => {
          const nameKey  = nf === 'notfallkontakt' ? 'notfallkontakt_name'      : `${nf}_name`;
          const telKey   = nf === 'notfallkontakt' ? 'notfallkontakt_telefon'   : `${nf}_telefon`;
          const verhKey  = nf === 'notfallkontakt' ? 'notfallkontakt_verhaeltnis' : `${nf}_verhaeltnis`;
          const name     = mitglied[nameKey];
          const telefon  = mitglied[telKey];
          const verhae   = mitglied[verhKey];

          return (
            <div key={label} className={`field-group card mmt-contact-card${primary ? ' mmt-contact-card--primary' : ''}`}>
              <h3 className="mmt-section-title">
                {primary ? '🚨 ' : '👤 '}{label}
                {primary && <span className="mmt-badge-primary">Primär</span>}
              </h3>

              {/* Name */}
              <div className="mmt-kv">
                <span className="mmt-kv-label">Name</span>
                {editMode
                  ? <input className="mmt-input" type="text" value={updatedData[nameKey] || ''} onChange={(e) => handleChange(e, nameKey)} placeholder="Vollständiger Name" />
                  : <span className={name ? 'mmt-kv-value' : 'mmt-kv-empty'}>{name || '—'}</span>
                }
              </div>

              {/* Telefon */}
              <div className="mmt-kv">
                <span className="mmt-kv-label">Telefon</span>
                {editMode
                  ? <input className="mmt-input" type="tel" value={updatedData[telKey] || ''} onChange={(e) => handleChange(e, telKey)} placeholder="+49 …" />
                  : <span className={telefon ? 'mmt-kv-value' : 'mmt-kv-empty'}>
                      {telefon ? <a href={`tel:${telefon}`} className="mmt-tel-link">{telefon}</a> : '—'}
                    </span>
                }
              </div>

              {/* Verhältnis */}
              <div className="mmt-kv">
                <span className="mmt-kv-label">Verhältnis</span>
                {editMode
                  ? <SelectComponent value={updatedData[verhKey] || ''} onChange={(e) => handleChange(e, verhKey)} options={RELATIONSHIP_OPTIONS} className="mmt-select mmt-select--sm" />
                  : <span className={verhae ? 'mmt-kv-value' : 'mmt-kv-empty'}>{verhae || '—'}</span>
                }
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default MemberMedicalTab;
