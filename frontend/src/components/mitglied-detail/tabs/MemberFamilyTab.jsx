import React, { useState, useEffect, useRef } from 'react';
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

  // Zusammenführen
  const [showZusammen, setShowZusammen] = useState(false);
  const [suchQuery, setSuchQuery] = useState('');
  const [suchErgebnisse, setSuchErgebnisse] = useState([]);
  const [suchLoading, setSuchLoading] = useState(false);
  const [gewaehlt, setGewaehlt] = useState(null); // { mitglied_id, vorname, nachname, familien_id }
  const [zusammenLoading, setZusammenLoading] = useState(false);
  const [zusammenError, setZusammenError] = useState('');
  const searchTimer = useRef(null);

  // Beitrag/Rabatt pro Familienmitglied bearbeiten (nachträglich, wirkt auf den Vertrag)
  const [beitragEditId, setBeitragEditId] = useState(null);
  const [beitragForm, setBeitragForm] = useState({ monatsbeitrag: '', rabatt_prozent: '', rabatt_grund: '' });
  const [beitragSaving, setBeitragSaving] = useState(false);
  const [beitragError, setBeitragError] = useState('');

  const token = localStorage.getItem('dojo_auth_token');

  const openBeitragEditor = (fm) => {
    setBeitragEditId(fm.mitglied_id);
    setBeitragError('');
    setBeitragForm({
      monatsbeitrag: fm.monatsbeitrag != null ? String(fm.monatsbeitrag) : '',
      rabatt_prozent: (fm.rabatt_prozent != null && parseFloat(fm.rabatt_prozent) > 0) ? String(fm.rabatt_prozent) : '',
      rabatt_grund: fm.rabatt_grund || ''
    });
  };
  const closeBeitragEditor = () => { setBeitragEditId(null); setBeitragError(''); };

  const saveBeitrag = async (fmId) => {
    if (beitragForm.monatsbeitrag === '' || isNaN(parseFloat(beitragForm.monatsbeitrag))) {
      setBeitragError('Bitte einen gültigen Monatsbeitrag eingeben.');
      return;
    }
    setBeitragSaving(true);
    setBeitragError('');
    try {
      const res = await fetch(`${config.apiBaseUrl}/mitglieder/${fmId}/beitrag`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monatsbeitrag: parseFloat(beitragForm.monatsbeitrag),
          rabatt_prozent: beitragForm.rabatt_prozent === '' ? 0 : parseFloat(beitragForm.rabatt_prozent),
          rabatt_grund: beitragForm.rabatt_grund || null
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen');
      setBeitragEditId(null);
      await fetchFamilie();
    } catch (err) {
      setBeitragError(err.message);
    } finally {
      setBeitragSaving(false);
    }
  };

  const fetchFamilie = async () => {
    if (!mitglied?.mitglied_id) return;
    setLoadingFamilie(true);
    try {
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

  useEffect(() => {
    fetchFamilie();
  }, [mitglied?.mitglied_id, mitglied?.familien_id]);

  // Mitglieder-Suche mit Debounce
  useEffect(() => {
    if (!suchQuery.trim() || suchQuery.length < 2) {
      setSuchErgebnisse([]);
      return;
    }
    setSuchLoading(true);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${config.apiBaseUrl}/mitglieder?search=${encodeURIComponent(suchQuery)}&limit=8`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const data = await res.json();
        setSuchErgebnisse(
          Array.isArray(data)
            ? data.filter(m => m.mitglied_id !== mitglied?.mitglied_id)
            : []
        );
      } catch {
        setSuchErgebnisse([]);
      } finally {
        setSuchLoading(false);
      }
    }, 300);
  }, [suchQuery]);

  const handleZusammenfuehren = async () => {
    if (!gewaehlt) return;
    setZusammenLoading(true);
    setZusammenError('');
    try {
      const res = await fetch(`${config.apiBaseUrl}/mitglieder/${mitglied.mitglied_id}/familie/zusammenfuehren`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ziel_mitglied_id: gewaehlt.mitglied_id })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Fehler');
      // Zurücksetzen und neu laden
      setShowZusammen(false);
      setSuchQuery('');
      setSuchErgebnisse([]);
      setGewaehlt(null);
      setFamilienId(data.familien_id);
      setFamilienmitglieder(data.familienmitglieder || []);
    } catch (err) {
      setZusammenError(err.message);
    } finally {
      setZusammenLoading(false);
    }
  };

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {familienId && <span className="fam-id-badge">Familie #{familienId}</span>}
            <button
              type="button"
              className="fam-merge-btn"
              onClick={() => { setShowZusammen(v => !v); setGewaehlt(null); setSuchQuery(''); setSuchErgebnisse([]); setZusammenError(''); }}
              title="Zur Familie eines anderen Mitglieds hinzufügen"
            >
              {showZusammen ? '✕ Abbrechen' : '🔗 Familie zuordnen'}
            </button>
          </div>
        </div>

        {/* ── Zusammenführen-Panel ── */}
        {showZusammen && (
          <div className="fam-merge-panel">
            <p className="fam-merge-hint">
              Suche nach dem Mitglied, mit dessen Familie <strong>{mitglied.vorname} {mitglied.nachname}</strong> zusammengeführt werden soll.
            </p>
            <div className="fam-merge-search-wrap">
              <input
                type="text"
                className="fam-merge-search"
                placeholder="Name eingeben…"
                value={suchQuery}
                onChange={e => { setSuchQuery(e.target.value); setGewaehlt(null); }}
                autoFocus
              />
              {suchLoading && <span className="fam-merge-spinner" />}
            </div>

            {suchErgebnisse.length > 0 && !gewaehlt && (
              <div className="fam-merge-results">
                {suchErgebnisse.map(m => (
                  <div
                    key={m.mitglied_id}
                    className="fam-merge-result-row"
                    onClick={() => setGewaehlt(m)}
                  >
                    <span className="fam-merge-result-name">{m.vorname} {m.nachname}</span>
                    {m.familien_id
                      ? <span className="fam-merge-result-fam">Familie #{m.familien_id}</span>
                      : <span className="fam-merge-result-nofam">Noch keine Familie</span>}
                  </div>
                ))}
              </div>
            )}

            {gewaehlt && (
              <div className="fam-merge-confirm">
                <div className="fam-merge-confirm-text">
                  <strong>{mitglied.vorname} {mitglied.nachname}</strong> wird der Familie von <strong>{gewaehlt.vorname} {gewaehlt.nachname}</strong>
                  {gewaehlt.familien_id ? ` (Familie #${gewaehlt.familien_id})` : ''} hinzugefügt.
                </div>
                {zusammenError && <div className="fam-merge-error">{zusammenError}</div>}
                <div className="fam-merge-confirm-btns">
                  <button type="button" className="fam-merge-confirm-cancel" onClick={() => setGewaehlt(null)}>
                    ← Andere wählen
                  </button>
                  <button type="button" className="fam-merge-confirm-ok" onClick={handleZusammenfuehren} disabled={zusammenLoading}>
                    {zusammenLoading ? 'Wird zusammengeführt…' : '✓ Bestätigen'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {loadingFamilie ? (
          <div className="fam-loading">Lade Familienmitglieder…</div>
        ) : familienmitglieder.length > 0 ? (
          <div className="fam-member-list">
            {familienmitglieder.map((fm) => {
              const isCurrent = fm.mitglied_id === mitglied?.mitglied_id;
              const editing = beitragEditId === fm.mitglied_id;
              const goTo = () => { if (!isCurrent) window.location.href = `/dashboard/mitglieder/${fm.mitglied_id}`; };
              return (
                <div key={fm.mitglied_id} className="fam-member-block">
                  <div className={`fam-member-row${isCurrent ? ' fam-member-row--current' : ' fam-member-row--other'}`}>
                    <div className={`fam-avatar${fm.ist_minderjaehrig ? ' fam-avatar--minor' : ' fam-avatar--adult'}`} onClick={goTo} style={{ cursor: isCurrent ? 'default' : 'pointer' }}>
                      {fm.ist_minderjaehrig ? '👶' : '👤'}
                    </div>
                    <div className="fam-member-info" onClick={goTo} style={{ cursor: isCurrent ? 'default' : 'pointer' }}>
                      <div className="fam-member-name">
                        {fm.vorname} {fm.nachname}
                        {isCurrent && <span className="fam-current-chip">aktuell</span>}
                      </div>
                      <div className="fam-member-meta">
                        {fm.alter_jahre !== null && <span>{fm.alter_jahre} Jahre</span>}
                        {fm.tarif_name && <span className="fam-meta-tarif">{fm.tarif_name}</span>}
                        {fm.monatsbeitrag != null && <span className="fam-meta-beitrag">{parseFloat(fm.monatsbeitrag).toFixed(2)} €/Mon.</span>}
                        {fm.rabatt_prozent != null && parseFloat(fm.rabatt_prozent) > 0 && (
                          <span className="fam-meta-rabatt">-{parseFloat(fm.rabatt_prozent)}% {fm.rabatt_grund || 'Rabatt'}</span>
                        )}
                        {fm.vertrag_status && (
                          <span className={fm.vertrag_status === 'aktiv' ? 'fam-meta-aktiv' : 'fam-meta-inaktiv'}>
                            {fm.vertrag_status}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: '0 0 auto' }}>
                      <button
                        type="button"
                        className="fam-beitrag-btn"
                        onClick={(e) => { e.stopPropagation(); editing ? closeBeitragEditor() : openBeitragEditor(fm); }}
                        title="Monatsbeitrag & Rabatt anpassen"
                        disabled={fm.vertrag_status !== 'aktiv'}
                        style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.15)', background: editing ? 'rgba(225,29,42,0.2)' : 'rgba(255,255,255,0.08)', color: 'inherit', cursor: fm.vertrag_status !== 'aktiv' ? 'not-allowed' : 'pointer', opacity: fm.vertrag_status !== 'aktiv' ? 0.5 : 1, whiteSpace: 'nowrap' }}
                      >
                        {editing ? '✕' : '✏️ Beitrag'}
                      </button>
                      {!isCurrent && <div className="fam-arrow" onClick={goTo} style={{ cursor: 'pointer' }}>→</div>}
                    </div>
                  </div>

                  {editing && (
                    <div style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.9rem', margin: '0.15rem 0 0.3rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '12px', opacity: 0.85 }}>
                          Monatsbeitrag (€)
                          <input className="fam-input fam-input--sm" type="number" step="0.01" min="0"
                            value={beitragForm.monatsbeitrag}
                            onChange={(e) => setBeitragForm({ ...beitragForm, monatsbeitrag: e.target.value })} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '12px', opacity: 0.85 }}>
                          Rabatt (%) <span style={{ opacity: 0.6 }}>(nur Doku)</span>
                          <input className="fam-input fam-input--sm" type="number" step="1" min="0" max="100"
                            value={beitragForm.rabatt_prozent}
                            onChange={(e) => setBeitragForm({ ...beitragForm, rabatt_prozent: e.target.value })} />
                        </label>
                      </div>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '12px', opacity: 0.85, marginTop: '0.7rem' }}>
                        Rabatt-Grund
                        <SelectComponent className="fam-input fam-select fam-input--sm"
                          value={beitragForm.rabatt_grund}
                          onChange={(e) => setBeitragForm({ ...beitragForm, rabatt_grund: e.target.value })}
                          options={RABATT_GRUENDE} />
                      </label>
                      {beitragError && <div style={{ color: '#f87171', fontSize: '12px', marginTop: '0.5rem' }}>{beitragError}</div>}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.8rem' }}>
                        <button type="button" className="fam-merge-confirm-cancel" onClick={closeBeitragEditor} style={{ padding: '6px 12px', fontSize: '13px' }}>Abbrechen</button>
                        <button type="button" className="fam-merge-confirm-ok" onClick={() => saveBeitrag(fm.mitglied_id)} disabled={beitragSaving} style={{ padding: '6px 14px', fontSize: '13px' }}>
                          {beitragSaving ? 'Speichert…' : '💾 Speichern'}
                        </button>
                      </div>
                      <p style={{ fontSize: '11px', opacity: 0.6, margin: '0.6rem 0 0' }}>
                        Ändert den <strong>Vertrag</strong> dieses Mitglieds und die noch offenen künftigen Beiträge (Lastschrift).
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="fam-empty">Keine Familienmitglieder vorhanden</div>
        )}
      </div>

      {/* ── Familien-Zuordnung ── */}
      <div className="fam-card">
        <h3 className="fam-section-title">🏷️ Familien-Zuordnung</h3>
        <div className="fam-mgmt-grid">
          <div className="fam-kv-row">
            <span className="fam-kv-label">Familien-ID</span>
            {editMode
              ? <input className="fam-input fam-input--sm" type="number" value={updatedData.familien_id || ''} onChange={(e) => handleChange(e, 'familien_id')} placeholder="z.B. 1001" />
              : <span className="fam-kv-value">{mitglied.familien_id || <span className="fam-kv-empty">Keine Zuordnung</span>}</span>
            }
          </div>
        </div>
        <p className="fam-info-note">
          {mitglied.familien_id
            ? <>ℹ️ Dieses Mitglied ist der Familie {mitglied.familien_id} zugeordnet. Monatsbeitrag &amp; Rabatt werden <strong>pro Mitglied oben über „✏️ Beitrag"</strong> gepflegt (wirkt direkt auf den Vertrag).</>
            : <>ℹ️ Noch keiner Familie zugeordnet. Über <strong>„🔗 Familie zuordnen"</strong> oben mit einer bestehenden Familie verbinden.</>}
        </p>
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
