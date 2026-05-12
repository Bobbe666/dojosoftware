import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import '../styles/LieferantenTab.css';

const EMPTY_FORM = {
  firmenname: '', ansprechpartner: '', rechtsform: '',
  email: '', telefon: '', telefon_mobil: '', fax: '', website: '',
  strasse: '', hausnummer: '', plz: '', ort: '', land: 'Deutschland',
  ust_id: '', eori_nummer: '', handelsreg_nr: '', handelsreg_gericht: '',
  zolltarifnummer: '', ursprungsland: '',
  waehrung: 'EUR', zahlungsziel_tage: 30, skonto_prozent: 0, skonto_tage: 0,
  mindestbestellwert_cent: 0, lieferzeit_tage: '',
  bank_name: '', bank_iban: '', bank_bic: '', bank_kontoinhaber: '',
  swift_code: '', routing_number: '', account_number: '',
  bemerkungen: '',
};

const LAENDER = [
  'Deutschland','Österreich','Schweiz','Frankreich','Italien','Spanien','Polen',
  'Tschechien','Niederlande','Belgien','Dänemark','Schweden','Norwegen','Finnland',
  'Portugal','Griechenland','Ungarn','Rumänien','Bulgarien','Kroatien','Slowenien',
  'Slowakei','Litauen','Lettland','Estland','Luxemburg','Irland','China','Japan',
  'Südkorea','Taiwan','Indien','Pakistan','Türkei','USA','Kanada','Australien',
  'Sonstiges',
];

export default function LieferantenTab() {
  const { activeDojo } = useDojoContext();
  const [lieferanten, setLieferanten] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [mode, setMode] = useState('list'); // 'list' | 'edit' | 'new'
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  const dojoId = activeDojo?.id;

  const load = useCallback(async () => {
    if (!dojoId) return;
    setLoading(true);
    try {
      const res = await axios.get(`/lieferanten?dojo_id=${dojoId}`);
      setLieferanten(res.data?.data || []);
    } catch {
      setError('Lieferanten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [dojoId]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(EMPTY_FORM); setMode('new'); setSelected(null); setError(''); };

  const openEdit = (l) => {
    setSelected(l);
    setForm({ ...EMPTY_FORM, ...l });
    setMode('edit');
    setError('');
  };

  const cancel = () => { setMode('list'); setSelected(null); setError(''); };

  const save = async () => {
    if (!form.firmenname.trim()) { setError('Firmenname ist Pflichtfeld.'); return; }
    setSaving(true); setError('');
    try {
      if (mode === 'new') {
        await axios.post(`/lieferanten?dojo_id=${dojoId}`, form);
        setSuccess('Lieferant angelegt.');
      } else {
        await axios.put(`/lieferanten/${selected.lieferant_id}?dojo_id=${dojoId}`, form);
        setSuccess('Gespeichert.');
      }
      await load();
      setMode('list');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Lieferant wirklich deaktivieren?')) return;
    try {
      await axios.delete(`/lieferanten/${id}?dojo_id=${dojoId}`);
      await load();
    } catch {
      setError('Fehler beim Löschen.');
    }
  };

  const f = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const filtered = lieferanten.filter(l =>
    !search || l.firmenname.toLowerCase().includes(search.toLowerCase()) ||
    (l.land || '').toLowerCase().includes(search.toLowerCase())
  );

  if (mode === 'new' || mode === 'edit') {
    return (
      <div className="lt-form-page">
        <div className="lt-form-header">
          <div>
            <span className="lt-form-title">{mode === 'new' ? 'Neuer Lieferant' : form.firmenname}</span>
            <span className="lt-form-sub">{mode === 'new' ? 'Stammdaten erfassen' : 'Bearbeiten'}</span>
          </div>
          <div className="lt-form-actions">
            <button className="lt-btn lt-btn--ghost" onClick={cancel}>Abbrechen</button>
            <button className="lt-btn lt-btn--primary" onClick={save} disabled={saving}>
              {saving ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </div>

        {error && <div className="lt-alert lt-alert--err">{error}</div>}

        <div className="lt-form-grid">
          {/* Spalte 1 */}
          <div className="lt-form-col">
            <Section label="Firma">
              <Field label="Firmenname *" value={form.firmenname} onChange={f('firmenname')} />
              <Field label="Ansprechpartner" value={form.ansprechpartner} onChange={f('ansprechpartner')} />
              <Field label="Rechtsform" value={form.rechtsform} onChange={f('rechtsform')} placeholder="GmbH, AG, KG …" />
            </Section>

            <Section label="Kontakt">
              <Field label="E-Mail" type="email" value={form.email} onChange={f('email')} />
              <Field label="Telefon" value={form.telefon} onChange={f('telefon')} />
              <Field label="Mobil" value={form.telefon_mobil} onChange={f('telefon_mobil')} />
              <Field label="Fax" value={form.fax} onChange={f('fax')} />
              <Field label="Website" value={form.website} onChange={f('website')} placeholder="https://…" />
            </Section>

            <Section label="Adresse">
              <div className="lt-row-2">
                <Field label="Straße" value={form.strasse} onChange={f('strasse')} />
                <Field label="Nr." value={form.hausnummer} onChange={f('hausnummer')} />
              </div>
              <div className="lt-row-2">
                <Field label="PLZ" value={form.plz} onChange={f('plz')} />
                <Field label="Ort" value={form.ort} onChange={f('ort')} />
              </div>
              <div className="lt-field">
                <label className="lt-label">Land</label>
                <select className="lt-input" value={form.land} onChange={f('land')}>
                  {LAENDER.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </Section>
          </div>

          {/* Spalte 2 */}
          <div className="lt-form-col">
            <Section label="International & Zoll">
              <Field label="USt-IdNr. (VAT ID)" value={form.ust_id} onChange={f('ust_id')} placeholder="DE123456789" />
              <Field label="EORI-Nummer" value={form.eori_nummer} onChange={f('eori_nummer')} placeholder="DE1234567890123" />
              <Field label="Handelsreg.-Nr." value={form.handelsreg_nr} onChange={f('handelsreg_nr')} />
              <Field label="Registergericht" value={form.handelsreg_gericht} onChange={f('handelsreg_gericht')} />
              <Field label="Zolltarifnr. (HS-Code)" value={form.zolltarifnummer} onChange={f('zolltarifnummer')} placeholder="6206 10 00" />
              <div className="lt-field">
                <label className="lt-label">Ursprungsland der Waren</label>
                <select className="lt-input" value={form.ursprungsland} onChange={f('ursprungsland')}>
                  <option value="">— nicht angegeben —</option>
                  {LAENDER.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </Section>

            <Section label="Konditionen">
              <div className="lt-row-2">
                <Field label="Zahlungsziel (Tage)" type="number" value={form.zahlungsziel_tage} onChange={f('zahlungsziel_tage')} />
                <Field label="Lieferzeit (Tage)" type="number" value={form.lieferzeit_tage} onChange={f('lieferzeit_tage')} />
              </div>
              <div className="lt-row-2">
                <Field label="Skonto %" type="number" step="0.01" value={form.skonto_prozent} onChange={f('skonto_prozent')} />
                <Field label="Skonto Tage" type="number" value={form.skonto_tage} onChange={f('skonto_tage')} />
              </div>
              <div className="lt-row-2">
                <Field label="Mind.-Bestellwert (€)" type="number" step="0.01"
                  value={form.mindestbestellwert_cent / 100}
                  onChange={e => setForm(prev => ({ ...prev, mindestbestellwert_cent: Math.round(parseFloat(e.target.value || 0) * 100) }))}
                />
                <div className="lt-field">
                  <label className="lt-label">Währung</label>
                  <select className="lt-input" value={form.waehrung} onChange={f('waehrung')}>
                    {['EUR','USD','GBP','CHF','JPY','CNY','KRW','PLN','CZK','HUF'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Section>

            <Section label="Bankverbindung">
              <Field label="Kontoinhaber" value={form.bank_kontoinhaber} onChange={f('bank_kontoinhaber')} />
              <Field label="Bank" value={form.bank_name} onChange={f('bank_name')} />
              <div className="lt-row-2">
                <Field label="IBAN" value={form.bank_iban} onChange={f('bank_iban')} placeholder="DE…" />
                <Field label="BIC / SWIFT" value={form.bank_bic} onChange={f('bank_bic')} />
              </div>
              <p className="lt-section-sub">Nicht-SEPA (international)</p>
              <div className="lt-row-2">
                <Field label="SWIFT-Code" value={form.swift_code} onChange={f('swift_code')} />
                <Field label="Routing Number" value={form.routing_number} onChange={f('routing_number')} placeholder="US ACH" />
              </div>
              <Field label="Kontonummer / Account No." value={form.account_number} onChange={f('account_number')} />
            </Section>
          </div>
        </div>

        <div className="lt-form-footer">
          <div className="lt-field lt-field--full">
            <label className="lt-label">Bemerkungen</label>
            <textarea className="lt-input lt-textarea" rows="3"
              value={form.bemerkungen} onChange={f('bemerkungen')}
              placeholder="Interne Notizen zum Lieferanten…"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lt-list-page">
      <div className="lt-list-header">
        <input className="lt-search" placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="lt-btn lt-btn--primary" onClick={openNew}>+ Neuer Lieferant</button>
      </div>

      {error && <div className="lt-alert lt-alert--err">{error}</div>}
      {success && <div className="lt-alert lt-alert--ok">{success}</div>}

      {loading ? (
        <div className="lt-loading">Lädt…</div>
      ) : filtered.length === 0 ? (
        <div className="lt-empty">
          {lieferanten.length === 0 ? 'Noch keine Lieferanten erfasst.' : 'Keine Treffer.'}
        </div>
      ) : (
        <div className="lt-cards">
          {filtered.map(l => (
            <div key={l.lieferant_id} className="lt-card">
              <div className="lt-card__main">
                <div className="lt-card__name">{l.firmenname}</div>
                {l.ansprechpartner && <div className="lt-card__contact">{l.ansprechpartner}</div>}
                <div className="lt-card__meta">
                  {l.land && <span className="lt-tag">{l.land}</span>}
                  {l.waehrung && l.waehrung !== 'EUR' && <span className="lt-tag lt-tag--warn">{l.waehrung}</span>}
                  {l.ust_id && <span className="lt-tag lt-tag--dim">VAT: {l.ust_id}</span>}
                  {l.eori_nummer && <span className="lt-tag lt-tag--dim">EORI</span>}
                </div>
                {(l.email || l.telefon || l.website) && (
                  <div className="lt-card__contact-line">
                    {l.email && <span>✉ {l.email}</span>}
                    {l.telefon && <span>📞 {l.telefon}</span>}
                    {l.website && <a href={l.website} target="_blank" rel="noreferrer" className="lt-link">🔗 Website</a>}
                  </div>
                )}
              </div>
              <div className="lt-card__actions">
                <button className="lt-btn lt-btn--ghost lt-btn--sm" onClick={() => openEdit(l)}>Bearbeiten</button>
                <button className="lt-btn lt-btn--danger lt-btn--sm" onClick={() => del(l.lieferant_id)}>Entfernen</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="lt-section">
      <p className="lt-section-label">{label}</p>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '', step }) {
  return (
    <div className="lt-field">
      <label className="lt-label">{label}</label>
      <input className="lt-input" type={type} value={value ?? ''} onChange={onChange}
        placeholder={placeholder} step={step} />
    </div>
  );
}
