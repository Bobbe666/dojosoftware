/**
 * HofNominierungModal.jsx
 * Wiederverwendbares Modal zum Nominieren einer Person für die Hall of Fame.
 * Wird sowohl vom Mitglied-Profil als auch vom HOF-Dashboard-Tab genutzt.
 *
 * Props:
 *   onClose()           — Modal schließen
 *   mitglied            — optional: vorausgefülltes Mitglied-Objekt
 *   onSuccess(nominierung) — Callback nach erfolgreicher Nominierung
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { X, Search, User, Award, Calendar, CreditCard, ChevronDown } from 'lucide-react';
import { useDojoContext } from '../context/DojoContext';

// ─── Styles (inline, kein eigenes CSS-File nötig) ────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    zIndex: 99999, display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: '16px', overflowY: 'auto',
  },
  box: {
    background: '#1a1a2e', borderRadius: '12px', width: '100%', maxWidth: '600px',
    border: '1px solid rgba(212,175,55,0.3)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
  },
  header: {
    padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
  },
  title: { margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#d4af37' },
  subtitle: { margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)' },
  body: { padding: '20px 24px', overflowY: 'auto', flex: 1 },
  footer: {
    padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', gap: '10px', justifyContent: 'flex-end', flexShrink: 0,
  },
  label: { display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: {
    width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px', padding: '10px 12px', color: '#fff', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box',
  },
  select: {
    width: '100%', background: '#0f0f1e', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px', padding: '10px 12px', color: '#fff', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box', cursor: 'pointer',
  },
  formGroup: { marginBottom: '16px' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  divider: { borderColor: 'rgba(255,255,255,0.08)', margin: '20px 0' },
  toggleRow: { display: 'flex', gap: '8px', marginBottom: '16px' },
  toggleBtn: (active) => ({
    flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid',
    borderColor: active ? '#d4af37' : 'rgba(255,255,255,0.12)',
    background: active ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)',
    color: active ? '#d4af37' : 'rgba(255,255,255,0.6)',
    cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'all 0.15s',
  }),
  zahlerBtn: (active) => ({
    flex: 1, padding: '12px 8px', borderRadius: '8px', border: '1px solid',
    borderColor: active ? '#d4af37' : 'rgba(255,255,255,0.12)',
    background: active ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)',
    color: active ? '#d4af37' : 'rgba(255,255,255,0.5)',
    cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'all 0.15s',
    textAlign: 'center',
  }),
  btnCancel: {
    padding: '10px 20px', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
    color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '14px',
  },
  btnSubmit: (loading) => ({
    padding: '10px 24px',
    background: loading ? 'rgba(212,175,55,0.4)' : '#d4af37',
    border: 'none', borderRadius: '8px', color: '#0f0f1e',
    cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '14px',
  }),
  errorBox: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '8px', padding: '10px 14px', color: '#fca5a5',
    fontSize: '13px', marginBottom: '16px',
  },
  successBox: {
    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: '8px', padding: '16px', color: '#86efac', fontSize: '14px',
    textAlign: 'center',
  },
  sectionHead: {
    fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 0 4px',
  },
};

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function HofNominierungModal({ onClose, mitglied = null, onSuccess }) {
  const { activeDojo } = useDojoContext();
  const dojoId = activeDojo?.id || null;

  // Modus: 'mitglied' = Dojo-Mitglied, 'extern' = externe Person
  const [modus, setModus] = useState(mitglied ? 'mitglied' : 'extern');

  // Mitglieder-Suche (nur für Modus 'mitglied' ohne vorausgefülltes Mitglied)
  const [mitgliedSuche, setMitgliedSuche] = useState('');
  const [mitgliederListe, setMitgliederListe] = useState([]);
  const [mitgliedSucheLoading, setMitgliedSucheLoading] = useState(false);
  const [gewaehlteMitglied, setGewaehlteMitglied] = useState(mitglied || null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Formularfelder
  const [form, setForm] = useState({
    vorname: mitglied?.vorname || '',
    nachname: mitglied?.nachname || '',
    geschlecht: mitglied?.geschlecht || '',
    geburtsdatum: mitglied?.geburtsdatum ? mitglied.geburtsdatum.slice(0, 10) : '',
    email: mitglied?.email || '',
    verein: mitglied ? (activeDojo?.dojoname || '') : '',
    telefon: mitglied?.telefon || '',
    kategorie_id: '',
    kategorieTypFilter: '',
    altersgruppFilter: mitglied?.geburtsdatum ? (() => {
      const birth = new Date(mitglied.geburtsdatum.slice(0, 10) + 'T12:00:00');
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--;
      if (age < 14) return 'Kids';
      if (age < 18) return 'Youth';
      return 'Erwachsene';
    })() : '',
    geschlechtFilter: mitglied?.geschlecht ? ({ m: 'Männer', w: 'Frauen', d: '' }[mitglied.geschlecht] || '') : '',
    veranstaltung_id: '',
    jahr: String(new Date().getFullYear()),
    zahler: '',
    nominiert_durch: '',
  });

  // Daten von HOF-API
  const [kategorien, setKategorien] = useState([]);
  const [veranstaltungen, setVeranstaltungen] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  // Kategorien nach Typ gruppieren
  const kategorienGruppiert = kategorien.reduce((acc, k) => {
    const typ = k.type || k.typ || 'Sonstige';
    if (!acc[typ]) acc[typ] = [];
    acc[typ].push(k);
    return acc;
  }, {});

  // HOF-Daten laden
  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [katRes, veranstRes] = await Promise.all([
        axios.get('/hof/kategorien'),
        axios.get('/hof/veranstaltungen'),
      ]);
      setKategorien(katRes.data || []);
      setVeranstaltungen(veranstRes.data || []);
    } catch {
      setError('HOF-Daten konnten nicht geladen werden. Bitte später erneut versuchen.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Mitglieder suchen (nur eigenes Dojo — Backend filtert nach dojo_id aus JWT)
  useEffect(() => {
    if (modus !== 'mitglied' || mitglied || mitgliedSuche.length < 2) {
      setMitgliederListe([]);
      return;
    }
    setMitgliedSucheLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`/mitglieder?search=${encodeURIComponent(mitgliedSuche)}&limit=10${dojoId ? `&dojo_id=${dojoId}` : ''}`);
        const data = Array.isArray(res.data) ? res.data : (res.data?.mitglieder || []);
        setMitgliederListe(data);
        setShowSuggestions(true);
      } catch {
        setMitgliederListe([]);
      } finally {
        setMitgliedSucheLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [mitgliedSuche, modus, mitglied, dojoId]);

  const GESCHLECHT_MAP = { m: 'männlich', w: 'weiblich', d: 'divers' };

  const getAltersgruppe = (gebStr) => {
    if (!gebStr) return '';
    const birth = new Date(gebStr.slice(0, 10) + 'T12:00:00');
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--;
    if (age < 14) return 'Kids';
    if (age < 18) return 'Youth';
    return 'Erwachsene';
  };

  const waehleDojoMitglied = (m) => {
    setGewaehlteMitglied(m);
    setMitgliedSuche(`${m.vorname} ${m.nachname}`);
    setShowSuggestions(false);
    const ag = getAltersgruppe(m.geburtsdatum);
    setForm(f => ({
      ...f,
      vorname: m.vorname || '',
      nachname: m.nachname || '',
      geschlecht: GESCHLECHT_MAP[m.geschlecht] || m.geschlecht || '',
      geburtsdatum: m.geburtsdatum ? m.geburtsdatum.slice(0, 10) : '',
      email: m.email || '',
      telefon: m.telefon || m.telefon_mobil || '',
      verein: activeDojo?.dojoname || '',
      altersgruppFilter: ag,
      geschlechtFilter: { m: 'Männer', w: 'Frauen', d: '' }[m.geschlecht] || '',
      kategorie_id: '',
    }));
  };

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    setError('');
    if (!form.vorname || !form.nachname) return setError('Vor- und Nachname sind Pflichtfelder.');
    if (!form.kategorie_id) return setError('Bitte eine Kategorie auswählen.');
    if (!form.zahler) return setError('Bitte angeben, wer die Gebühr zahlt.');

    setLoading(true);
    try {
      const payload = {
        vorname: form.vorname,
        nachname: form.nachname,
        geschlecht: form.geschlecht || 'unbekannt',
        geburtsdatum: form.geburtsdatum || null,
        email: form.email || null,
        verein: form.verein || null,
        telefon: form.telefon || null,
        kategorie_id: Number(form.kategorie_id),
        veranstaltung_id: form.veranstaltung_id ? Number(form.veranstaltung_id) : null,
        jahr: Number(form.jahr),
        zahler: form.zahler,
        nominiert_durch: form.nominiert_durch || null,
        dojo_id: dojoId,
        mitglied_id: gewaehlteMitglied?.mitglied_id || mitglied?.mitglied_id || null,
      };
      const res = await axios.post('/hof/nominieren', payload);
      setSuccess(res.data);
      if (onSuccess) onSuccess(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || 'Nominierung fehlgeschlagen.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const modal = (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.box} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <h2 style={S.title}>🏛️ Hall of Fame — Nominierung</h2>
            <p style={S.subtitle}>Nominiere eine Person für die TDA Hall of Fame</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={S.body}>
          {loadingData ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>Lade HOF-Daten…</div>
          ) : success ? (
            <div style={S.successBox}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏆</div>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>Nominierung erfolgreich!</div>
              <div style={{ opacity: 0.8 }}>Nummer: <strong>{success.nominierungsnummer}</strong></div>
            </div>
          ) : (
            <>
              {error && <div style={S.errorBox}>{error}</div>}

              {/* Modus-Toggle — nur wenn kein Mitglied vorausgefüllt */}
              {!mitglied && (
                <div style={{ ...S.formGroup }}>
                  <label style={S.label}>Person</label>
                  <div style={S.toggleRow}>
                    <button style={S.toggleBtn(modus === 'mitglied')} onClick={() => setModus('mitglied')}>
                      <User size={14} style={{ marginRight: 6 }} />Dojo-Mitglied
                    </button>
                    <button style={S.toggleBtn(modus === 'extern')} onClick={() => setModus('extern')}>
                      <Search size={14} style={{ marginRight: 6 }} />Externe Person
                    </button>
                  </div>
                </div>
              )}

              {/* Mitglieder-Suche (nur im Dojo-Modus ohne vorausgefülltes Mitglied) */}
              {modus === 'mitglied' && !mitglied && (
                <div style={{ ...S.formGroup, position: 'relative' }}>
                  <label style={S.label}>Mitglied suchen *</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                    <input
                      style={{ ...S.input, paddingLeft: '32px' }}
                      value={mitgliedSuche}
                      onChange={e => { setMitgliedSuche(e.target.value); setGewaehlteMitglied(null); setForm(f => ({ ...f, vorname: '', nachname: '', geschlecht: '', geburtsdatum: '', email: '', telefon: '' })); }}
                      placeholder="Name eingeben…"
                      onFocus={() => mitgliederListe.length > 0 && setShowSuggestions(true)}
                    />
                    {mitgliedSucheLoading && (
                      <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>…</span>
                    )}
                  </div>
                  {showSuggestions && mitgliederListe.length > 0 && (
                    <div style={{ position: 'absolute', zIndex: 10, top: '100%', left: 0, right: 0, background: '#0f0f1e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                      {mitgliederListe.map(m => (
                        <div
                          key={m.mitglied_id || m.id}
                          onClick={() => waehleDojoMitglied(m)}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '13px' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <strong style={{ color: '#fff' }}>{m.vorname} {m.nachname}</strong>
                          <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: '8px', fontSize: '12px' }}>
                            {m.gurtfarbe && `· ${m.gurtfarbe}`} {m.geburtsdatum && `· geb. ${new Date(m.geburtsdatum).toLocaleDateString('de-DE')}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {gewaehlteMitglied && (
                    <div style={{ marginTop: '6px', padding: '6px 10px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '6px', fontSize: '12px', color: '#d4af37' }}>
                      ✓ {gewaehlteMitglied.vorname} {gewaehlteMitglied.nachname} ausgewählt
                    </div>
                  )}
                </div>
              )}

              {/* Persondaten — anzeigen wenn Mitglied gewählt oder im Extern-Modus */}
              {(modus === 'extern' || gewaehlteMitglied || mitglied) && (
              <div style={S.row}>
                <div style={S.formGroup}>
                  <label style={S.label}>Vorname *</label>
                  <input style={S.input} value={form.vorname} onChange={set('vorname')} placeholder="Vorname" disabled={!!mitglied || (modus === 'mitglied' && !!gewaehlteMitglied)} />
                </div>
                <div style={S.formGroup}>
                  <label style={S.label}>Nachname *</label>
                  <input style={S.input} value={form.nachname} onChange={set('nachname')} placeholder="Nachname" disabled={!!mitglied || (modus === 'mitglied' && !!gewaehlteMitglied)} />
                </div>
              </div>
              )}

              {(modus === 'extern' || gewaehlteMitglied || mitglied) && (
              <div style={S.row}>
                <div style={S.formGroup}>
                  <label style={S.label}>Geschlecht</label>
                  <select style={S.select} value={form.geschlecht} onChange={set('geschlecht')}>
                    <option value="">— Bitte wählen —</option>
                    <option value="männlich">Männlich</option>
                    <option value="weiblich">Weiblich</option>
                    <option value="divers">Divers</option>
                    <option value="unbekannt">Unbekannt</option>
                  </select>
                </div>
                <div style={S.formGroup}>
                  <label style={S.label}>Geburtsdatum</label>
                  <input style={S.input} type="date" value={form.geburtsdatum} onChange={set('geburtsdatum')} />
                </div>
              </div>
              )}

              {(modus === 'extern' || gewaehlteMitglied || mitglied) && (
              <div style={S.row}>
                <div style={S.formGroup}>
                  <label style={S.label}>E-Mail</label>
                  <input style={S.input} type="email" value={form.email} onChange={set('email')} placeholder="email@beispiel.de" />
                </div>
                <div style={S.formGroup}>
                  <label style={S.label}>Verein / Organisation</label>
                  <input style={S.input} value={form.verein} onChange={set('verein')} placeholder="Verein oder Dojo"
                    disabled={modus === 'mitglied' && (!!gewaehlteMitglied || !!mitglied)} />
                </div>
              </div>
              )}

              <hr style={S.divider} />

              {/* Nominierungsdaten */}
              {/* Altersgruppen-Filter */}
              {kategorien.length > 0 && (
                <div style={{ ...S.formGroup }}>
                  <label style={S.label}>Altersgruppe</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {['', 'Erwachsene', 'Youth', 'Kids'].map(ag => (
                      <button key={ag || 'alle'}
                        style={{ padding: '5px 12px', borderRadius: '100px', border: '1px solid', borderColor: form.altersgruppFilter === ag ? '#d4af37' : 'rgba(255,255,255,0.15)', background: form.altersgruppFilter === ag ? 'rgba(212,175,55,0.15)' : 'transparent', color: form.altersgruppFilter === ag ? '#d4af37' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                        onClick={() => setForm(f => ({ ...f, altersgruppFilter: ag, kategorie_id: '' }))}
                      >{ag === '' ? 'Alle' : ag === 'Kids' ? '👶 Kids' : ag === 'Youth' ? '🏃 Youth' : '👤 Erwachsene'}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Geschlecht-Filter */}
              {kategorien.length > 0 && (
                <div style={{ ...S.formGroup }}>
                  <label style={S.label}>Geschlecht</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[['', 'Alle'], ['Männer', '♂ Männer'], ['Frauen', '♀ Frauen'], ['Beide', '⚥ Beide']].map(([val, label]) => (
                      <button key={val || 'alle'}
                        style={{ padding: '5px 12px', borderRadius: '100px', border: '1px solid', borderColor: form.geschlechtFilter === val ? '#d4af37' : 'rgba(255,255,255,0.15)', background: form.geschlechtFilter === val ? 'rgba(212,175,55,0.15)' : 'transparent', color: form.geschlechtFilter === val ? '#d4af37' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                        onClick={() => setForm(f => ({ ...f, geschlechtFilter: val, kategorie_id: '' }))}
                      >{label}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Kategorie-Typ Filter */}
              {Object.keys(kategorienGruppiert).length > 0 && (
                <div style={{ ...S.formGroup }}>
                  <label style={S.label}>Kategorie-Typ</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      style={{ padding: '5px 12px', borderRadius: '100px', border: '1px solid', borderColor: !form.kategorieTypFilter ? '#d4af37' : 'rgba(255,255,255,0.15)', background: !form.kategorieTypFilter ? 'rgba(212,175,55,0.15)' : 'transparent', color: !form.kategorieTypFilter ? '#d4af37' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                      onClick={() => setForm(f => ({ ...f, kategorieTypFilter: '', kategorie_id: '' }))}
                    >Alle</button>
                    {Object.keys(kategorienGruppiert).map(typ => (
                      <button key={typ}
                        style={{ padding: '5px 12px', borderRadius: '100px', border: '1px solid', borderColor: form.kategorieTypFilter === typ ? '#d4af37' : 'rgba(255,255,255,0.15)', background: form.kategorieTypFilter === typ ? 'rgba(212,175,55,0.15)' : 'transparent', color: form.kategorieTypFilter === typ ? '#d4af37' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                        onClick={() => setForm(f => ({ ...f, kategorieTypFilter: typ, kategorie_id: '' }))}
                      >{typ}</button>
                    ))}
                  </div>
                </div>
              )}

              <div style={S.formGroup}>
                <label style={S.label}>Kategorie *</label>
                <select style={S.select} value={form.kategorie_id} onChange={set('kategorie_id')}>
                  <option value="">— Kategorie auswählen —</option>
                  {Object.entries(kategorienGruppiert)
                    .filter(([typ]) => !form.kategorieTypFilter || typ === form.kategorieTypFilter)
                    .map(([typ, items]) => {
                      const filtered = items.filter(k =>
                        (!form.altersgruppFilter || k.altersgruppe === form.altersgruppFilter) &&
                        (!form.geschlechtFilter || k.geschlecht === form.geschlechtFilter || k.geschlecht === 'Beide')
                      );
                      if (filtered.length === 0) return null;
                      return (
                        <optgroup key={typ} label={typ}>
                          {filtered.map(k => (
                            <option key={k.id} value={k.id}>
                              {k.name}{k.geschlecht && k.geschlecht !== 'Beide' ? ` (${k.geschlecht})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                </select>
              </div>

              <div style={S.row}>
                <div style={S.formGroup}>
                  <label style={S.label}>Veranstaltung</label>
                  <select style={S.select} value={form.veranstaltung_id} onChange={set('veranstaltung_id')}>
                    <option value="">— Optional —</option>
                    {veranstaltungen.map(v => (
                      <option key={v.id} value={v.id}>{v.titel || v.name} {v.jahr ? `(${v.jahr})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div style={S.formGroup}>
                  <label style={S.label}>Jahr</label>
                  <input style={S.input} type="number" value={form.jahr} onChange={set('jahr')} min="2000" max="2099" />
                </div>
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Nominiert durch</label>
                <input
                  style={S.input}
                  type="text"
                  placeholder="Name des Nominierenden (z. B. Sascha Schreiner)"
                  value={form.nominiert_durch}
                  onChange={set('nominiert_durch')}
                />
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Gebühr zahlt *</label>
                <div style={S.toggleRow}>
                  <button
                    style={S.zahlerBtn(form.zahler === 'verein')}
                    onClick={() => setForm(f => ({ ...f, zahler: 'verein' }))}
                  >
                    🏟️ Verein / Dojo
                  </button>
                  <button
                    style={S.zahlerBtn(form.zahler === 'nominierter')}
                    onClick={() => setForm(f => ({ ...f, zahler: 'nominierter' }))}
                  >
                    👤 Nominierte Person
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!success && !loadingData && (
          <div style={S.footer}>
            <button style={S.btnCancel} onClick={onClose}>Abbrechen</button>
            <button style={S.btnSubmit(loading)} onClick={handleSubmit} disabled={loading}>
              {loading ? 'Wird nominiert…' : '🏆 Nominierung einreichen'}
            </button>
          </div>
        )}
        {success && (
          <div style={S.footer}>
            <button style={S.btnCancel} onClick={onClose}>Schließen</button>
          </div>
        )}

      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
