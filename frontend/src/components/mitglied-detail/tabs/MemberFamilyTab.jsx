import React, { useState, useEffect } from 'react';
import config from '../../../config/config';
import './MemberFamilyTab.css';

const VERTRETER_TYPEN = [
  { value: '', label: 'Bitte wählen' },
  { value: 'Vater', label: 'Vater' },
  { value: 'Mutter', label: 'Mutter' },
  { value: 'Opa', label: 'Opa' },
  { value: 'Oma', label: 'Oma' },
  { value: 'sonstiger gesetzl. Vertreter', label: 'Sonstiger gesetzl. Vertreter' }
];

const RABATT_GRUENDE = [
  { value: '', label: 'Kein Rabatt' },
  { value: 'Familie', label: 'Familienrabatt' },
  { value: 'Student', label: 'Studenten-Rabatt' },
  { value: 'Senior', label: 'Senioren-Rabatt' },
  { value: 'Geschwister', label: 'Geschwister-Rabatt' },
  { value: 'Sonstiges', label: 'Sonstiges' }
];

const MemberFamilyTab = ({ mitglied, updatedData, editMode, handleChange, CustomSelect }) => {
  const [familienmitglieder, setFamilienmitglieder] = useState([]);
  const [familienId, setFamilienId] = useState(null);
  const [loadingFamilie, setLoadingFamilie] = useState(false);

  useEffect(() => {
    const fetchFamilienmitglieder = async () => {
      if (!mitglied?.mitglied_id) return;
      setLoadingFamilie(true);
      try {
        const token = localStorage.getItem('dojo_auth_token');
        const response = await fetch(`${config.apiBaseUrl}/mitglieddetail/${mitglied.mitglied_id}/familie`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (response.ok) {
          const data = await response.json();
          setFamilienId(data.familien_id);
          setFamilienmitglieder(data.familienmitglieder || []);
        }
      } catch (error) {
        console.error('Fehler beim Laden der Familienmitglieder:', error);
      } finally {
        setLoadingFamilie(false);
      }
    };
    fetchFamilienmitglieder();
  }, [mitglied?.mitglied_id, mitglied?.familien_id]);

  const SelectComponent = CustomSelect || (({ value, onChange, options, className }) => (
    <select className={className} value={value} onChange={onChange}>
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  ));

  const renderVertreter = (n) => {
    const nameKey = `vertreter${n}_name`;
    const typKey  = `vertreter${n}_typ`;
    const telKey  = `vertreter${n}_telefon`;
    const mailKey = `vertreter${n}_email`;

    if (editMode) {
      return (
        <div className="fam-vtr-form">
          <div className="fam-vtr-form-label">Vertreter {n}</div>
          <div className="fam-vtr-form-grid">
            <div className="fam-vtr-field">
              <span className="fam-vtr-field-label">Typ</span>
              <select className="fam-input fam-select" value={updatedData[typKey] || ''} onChange={(e) => handleChange(e, typKey)}>
                {VERTRETER_TYPEN.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div className="fam-vtr-field">
              <span className="fam-vtr-field-label">Name</span>
              <input className="fam-input" type="text" value={updatedData[nameKey] || ''} onChange={(e) => handleChange(e, nameKey)} placeholder="Vor- und Nachname" />
            </div>
            <div className="fam-vtr-field">
              <span className="fam-vtr-field-label">Telefon</span>
              <input className="fam-input" type="tel" value={updatedData[telKey] || ''} onChange={(e) => handleChange(e, telKey)} placeholder="+49 123 456789" />
            </div>
            <div className="fam-vtr-field">
              <span className="fam-vtr-field-label">E-Mail</span>
              <input className="fam-input" type="email" value={updatedData[mailKey] || ''} onChange={(e) => handleChange(e, mailKey)} placeholder="vertreter@example.com" />
            </div>
          </div>
        </div>
      );
    }

    if (!mitglied[nameKey] && !mitglied[typKey]) return null;

    return (
      <div className="fam-vtr-card">
        <div className="fam-vtr-card-head">
          <span className="fam-vtr-type">{mitglied[typKey] || '—'}</span>
        </div>
        <div className="fam-vtr-kv-grid">
          <span className="fam-kv-label">Name</span>
          <span className="fam-kv-value">{mitglied[nameKey] || '—'}</span>
          <span className="fam-kv-label">Telefon</span>
          <span className="fam-kv-value">
            {mitglied[telKey]
              ? <a href={`tel:${mitglied[telKey]}`} className="fam-tel-link">{mitglied[telKey]}</a>
              : '—'}
          </span>
          <span className="fam-kv-label">E-Mail</span>
          <span className="fam-kv-value">{mitglied[mailKey] || '—'}</span>
        </div>
      </div>
    );
  };

  const hasVertreter = mitglied.vertreter1_name || mitglied.vertreter1_typ || mitglied.vertreter2_name || mitglied.vertreter2_typ;

  return (
    <div className="fam-wrap">

      {/* ── Familienmitglieder ── */}
      <div className="fam-card">
        <div className="fam-card-head-row">
          <h3 className="fam-section-title">👨‍👩‍👧 Familienmitglieder</h3>
          {familienId && <span className="fam-id-badge">Familie #{familienId}</span>}
        </div>

        {loadingFamilie ? (
          <div className="fam-loading">Lade Familienmitglieder…</div>
        ) : familienmitglieder.length > 0 ? (
          <div className="fam-member-list">
            {familienmitglieder.map((fm) => {
              const isCurrent = fm.mitglied_id === mitglied?.mitglied_id;
              return (
                <div
                  key={fm.mitglied_id}
                  className={`fam-member-row${isCurrent ? ' fam-member-row--current' : ' fam-member-row--other'}`}
                  onClick={() => { if (!isCurrent) window.location.href = `/dashboard/mitglieder/${fm.mitglied_id}`; }}
                >
                  <div className={`fam-avatar${fm.ist_minderjaehrig ? ' fam-avatar--minor' : ' fam-avatar--adult'}`}>
                    {fm.ist_minderjaehrig ? '👶' : '👤'}
                  </div>
                  <div className="fam-member-info">
                    <div className="fam-member-name">
                      {fm.vorname} {fm.nachname}
                      {isCurrent && <span className="fam-current-chip">aktuell</span>}
                    </div>
                    <div className="fam-member-meta">
                      {fm.alter_jahre !== null && <span>{fm.alter_jahre} Jahre</span>}
                      {fm.tarif_name && <span className="fam-meta-tarif">{fm.tarif_name}</span>}
                      {fm.rabatt_prozent && parseFloat(fm.rabatt_prozent) > 0 && (
                        <span className="fam-meta-rabatt">-{fm.rabatt_prozent}% {fm.rabatt_grund || 'Rabatt'}</span>
                      )}
                      {fm.vertrag_status && (
                        <span className={fm.vertrag_status === 'aktiv' ? 'fam-meta-aktiv' : 'fam-meta-inaktiv'}>
                          {fm.vertrag_status}
                        </span>
                      )}
                    </div>
                  </div>
                  {!isCurrent && <div className="fam-arrow">→</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="fam-empty">Keine Familienmitglieder vorhanden</div>
        )}
      </div>

      {/* ── Familienmanagement ── */}
      <div className="fam-card">
        <h3 className="fam-section-title">🏷️ Familienmanagement</h3>
        <div className="fam-mgmt-grid">
          <div className="fam-kv-row">
            <span className="fam-kv-label">Familien-ID</span>
            {editMode
              ? <input className="fam-input fam-input--sm" type="number" value={updatedData.familien_id || ''} onChange={(e) => handleChange(e, 'familien_id')} placeholder="z.B. 1001" />
              : <span className="fam-kv-value">{mitglied.familien_id || <span className="fam-kv-empty">Keine Zuordnung</span>}</span>
            }
          </div>
          <div className="fam-kv-row">
            <span className="fam-kv-label">Rabatt</span>
            {editMode
              ? <input className="fam-input fam-input--sm" type="number" step="0.01" min="0" max="100" value={updatedData.rabatt_prozent || ''} onChange={(e) => handleChange(e, 'rabatt_prozent')} placeholder="z.B. 15.50" />
              : <span className="fam-kv-value">
                  {mitglied.rabatt_prozent && parseFloat(mitglied.rabatt_prozent) > 0
                    ? `${mitglied.rabatt_prozent}%`
                    : <span className="fam-kv-empty">Kein Rabatt</span>}
                </span>
            }
          </div>
          <div className="fam-kv-row">
            <span className="fam-kv-label">Rabatt-Grund</span>
            {editMode
              ? <SelectComponent className="fam-input fam-select fam-input--sm" value={updatedData.rabatt_grund || ''} onChange={(e) => handleChange(e, 'rabatt_grund')} options={RABATT_GRUENDE} />
              : <span className="fam-kv-value">{mitglied.rabatt_grund || <span className="fam-kv-empty">—</span>}</span>
            }
          </div>
        </div>
        {mitglied.familien_id && (
          <p className="fam-info-note">ℹ️ Dieses Mitglied ist der Familie {mitglied.familien_id} zugeordnet.</p>
        )}
      </div>

      {/* ── Gesetzliche Vertreter ── */}
      <div className="fam-card">
        <h3 className="fam-section-title">👮 Gesetzliche Vertreter</h3>
        {editMode ? (
          <div className="fam-vtr-forms">
            {renderVertreter(1)}
            {renderVertreter(2)}
          </div>
        ) : hasVertreter ? (
          <div className="fam-vtr-cards">
            {renderVertreter(1)}
            {renderVertreter(2)}
          </div>
        ) : (
          <div className="fam-empty">Keine Vertreter eingetragen</div>
        )}
        <p className="fam-info-note">ℹ️ Vertreter-Informationen sind nur für minderjährige Mitglieder erforderlich oder wenn eine gesetzliche Vertretung vorliegt.</p>
      </div>

    </div>
  );
};

export default MemberFamilyTab;
