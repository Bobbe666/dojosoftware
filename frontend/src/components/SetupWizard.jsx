/**
 * SetupWizard.jsx
 * Ersteinrichtungs-Wizard für neue Dojos.
 * Erscheint beim ersten Login wenn onboarding_completed === 0.
 * Erkennung: DB-Feld onboarding_completed + localStorage-Fallback.
 */
import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Building2, CreditCard, Package, FileText, Rocket, X } from 'lucide-react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config.js';
import { useDojoContext } from '../context/DojoContext';
import '../styles/SetupWizard.css';

const STEPS = [
  { id: 'grunddaten', icon: <Building2 size={22} />, label: 'Grunddaten' },
  { id: 'bank',       icon: <CreditCard size={22} />, label: 'Bankverbindung' },
  { id: 'tarife',     icon: <Package size={22} />,    label: 'Tarife' },
  { id: 'rechtlich',  icon: <FileText size={22} />,   label: 'Rechtliches' },
  { id: 'fertig',     icon: <Rocket size={22} />,     label: 'Fertig' },
];

const Field = ({ label, required, children }) => (
  <div className="sw-field">
    <label>{label}{required && <span className="sw-required">*</span>}</label>
    {children}
  </div>
);

const StepStatus = ({ complete }) =>
  complete
    ? <CheckCircle size={16} className="sw-step-ok" />
    : <AlertCircle size={16} className="sw-step-warn" />;

const SetupWizard = ({ onClose }) => {
  const { activeDojo, refreshDojos } = useDojoContext();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tarifCount, setTarifCount] = useState(null);
  const [nichtMehrAnzeigen, setNichtMehrAnzeigen] = useState(false);

  const [form, setForm] = useState({
    dojoname: '', inhaber: '', strasse: '', hausnummer: '',
    plz: '', ort: '', telefon: '', email: '',
    bank_iban: '', bank_bic: '', bank_name: '', bank_inhaber: '',
    sepa_glaeubiger_id: '',
    agb_text: '', datenschutz_text: '', impressum_text: '',
  });

  // Aktuelle Dojo-Daten laden
  useEffect(() => {
    fetchWithAuth(`${config.apiBaseUrl}/dojo`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.dojo) {
          const f = d.dojo;
          setForm({
            dojoname:         f.dojoname || '',
            inhaber:          f.inhaber || '',
            strasse:          f.strasse || '',
            hausnummer:       f.hausnummer || '',
            plz:              f.plz || '',
            ort:              f.ort || '',
            telefon:          f.telefon || '',
            email:            f.email || '',
            bank_iban:        f.bank_iban || '',
            bank_bic:         f.bank_bic || '',
            bank_name:        f.bank_name || '',
            bank_inhaber:     f.bank_inhaber || '',
            sepa_glaeubiger_id: f.sepa_glaeubiger_id || '',
            agb_text:         f.agb_text || '',
            datenschutz_text: f.datenschutz_text || '',
            impressum_text:   f.impressum_text || '',
          });
        }
      })
      .catch(() => {});

    // Tarife laden
    fetchWithAuth(`${config.apiBaseUrl}/tarife`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setTarifCount(Array.isArray(d.data) ? d.data.filter(t => t.active).length : 0);
      })
      .catch(() => setTarifCount(0));
  }, []);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Schritt-Validierungen
  const stepComplete = {
    grunddaten: !!(form.dojoname && form.ort && form.telefon && form.email),
    bank:       !!(form.bank_iban && form.bank_inhaber && form.sepa_glaeubiger_id),
    tarife:     tarifCount > 0,
    rechtlich:  !!(form.agb_text && form.impressum_text),
    fertig:     true,
  };

  const currentStepId = STEPS[step].id;
  const isLast = step === STEPS.length - 1;

  const save = async (fields) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/dojo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || 'Speichern fehlgeschlagen');
    } catch (err) {
      setError(err.message);
      setSaving(false);
      return false;
    }
    setSaving(false);
    return true;
  };

  const handleWeiter = async () => {
    setError('');

    if (currentStepId === 'grunddaten') {
      if (!form.dojoname || !form.ort || !form.telefon || !form.email) {
        setError('Bitte alle Pflichtfelder ausfüllen.');
        return;
      }
      const ok = await save({
        dojoname: form.dojoname, inhaber: form.inhaber,
        strasse: form.strasse, hausnummer: form.hausnummer,
        plz: form.plz, ort: form.ort,
        telefon: form.telefon, email: form.email,
      });
      if (!ok) return;
    }

    if (currentStepId === 'bank') {
      if (!form.bank_iban || !form.bank_inhaber || !form.sepa_glaeubiger_id) {
        setError('IBAN, Kontoinhaber und Gläubiger-ID sind Pflichtfelder.');
        return;
      }
      const ok = await save({
        bank_iban: form.bank_iban, bank_bic: form.bank_bic,
        bank_name: form.bank_name, bank_inhaber: form.bank_inhaber,
        sepa_glaeubiger_id: form.sepa_glaeubiger_id,
      });
      if (!ok) return;
    }

    if (currentStepId === 'rechtlich') {
      await save({
        agb_text: form.agb_text,
        datenschutz_text: form.datenschutz_text,
        impressum_text: form.impressum_text,
      });
    }

    setStep(s => s + 1);
  };

  const handleFertig = async () => {
    await save({ onboarding_completed: 1 });
    if (activeDojo?.id) {
      localStorage.setItem(`setup_wizard_done_${activeDojo.id}`, '1');
    }
    refreshDojos?.();
    onClose();
  };

  const handleDismiss = async () => {
    if (nichtMehrAnzeigen) {
      await save({ onboarding_completed: 1 });
      if (activeDojo?.id) {
        localStorage.setItem(`setup_wizard_done_${activeDojo.id}`, '1');
      }
      refreshDojos?.();
    }
    onClose();
  };

  const allComplete = Object.values(stepComplete).filter((_, i) => i < 4).every(Boolean);

  return (
    <div className="sw-overlay">
      <div className="sw-modal">

        {/* Header */}
        <div className="sw-header">
          <div className="sw-title-area">
            <span className="sw-title-icon">🏯</span>
            <div>
              <h2>Ersteinrichtung</h2>
              <p>Richte dein Dojo in wenigen Schritten ein.</p>
            </div>
          </div>
          <button className="sw-close" onClick={handleDismiss} title="Schließen">
            <X size={20} />
          </button>
        </div>

        {/* Stepper */}
        <div className="sw-stepper">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`sw-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
              onClick={() => i < step && setStep(i)}
            >
              <div className="sw-step-icon">
                {i < step ? <CheckCircle size={18} /> : s.icon}
              </div>
              <span className="sw-step-label">{s.label}</span>
              {i < STEPS.length - 1 && <div className="sw-step-line" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="sw-content">
          {error && <div className="sw-error"><AlertCircle size={15} /> {error}</div>}

          {/* ── Schritt 1: Grunddaten ── */}
          {currentStepId === 'grunddaten' && (
            <div className="sw-step-body">
              <div className="sw-step-heading">
                <Building2 size={24} />
                <div>
                  <h3>Dojo-Grunddaten <StepStatus complete={stepComplete.grunddaten} /></h3>
                  <p>Name, Adresse und Kontaktdaten deines Dojos.</p>
                </div>
              </div>
              <div className="sw-form-grid">
                <Field label="Dojoname" required>
                  <input value={form.dojoname} onChange={e => set('dojoname', e.target.value)} placeholder="z.B. Kampfkunstschule Mustermann" />
                </Field>
                <Field label="Inhaber / Verantwortliche/r">
                  <input value={form.inhaber} onChange={e => set('inhaber', e.target.value)} placeholder="Vor- und Nachname" />
                </Field>
                <Field label="Straße">
                  <input value={form.strasse} onChange={e => set('strasse', e.target.value)} placeholder="Musterstraße" />
                </Field>
                <Field label="Hausnummer">
                  <input value={form.hausnummer} onChange={e => set('hausnummer', e.target.value)} placeholder="12a" />
                </Field>
                <Field label="PLZ">
                  <input value={form.plz} onChange={e => set('plz', e.target.value)} placeholder="84034" maxLength={10} />
                </Field>
                <Field label="Ort" required>
                  <input value={form.ort} onChange={e => set('ort', e.target.value)} placeholder="Landshut" />
                </Field>
                <Field label="Telefon" required>
                  <input value={form.telefon} onChange={e => set('telefon', e.target.value)} placeholder="0871 12345678" type="tel" />
                </Field>
                <Field label="E-Mail" required>
                  <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="info@mein-dojo.de" type="email" />
                </Field>
              </div>
            </div>
          )}

          {/* ── Schritt 2: Bankverbindung ── */}
          {currentStepId === 'bank' && (
            <div className="sw-step-body">
              <div className="sw-step-heading">
                <CreditCard size={24} />
                <div>
                  <h3>Bankverbindung & SEPA <StepStatus complete={stepComplete.bank} /></h3>
                  <p>Bankdaten für Lastschrifteinzüge und Rechnungsstellung.</p>
                </div>
              </div>
              <div className="sw-form-grid">
                <Field label="IBAN" required>
                  <input
                    value={form.bank_iban}
                    onChange={e => set('bank_iban', e.target.value.toUpperCase().replace(/\s/g, ''))}
                    placeholder="DE89370400440532013000"
                    className="sw-mono"
                  />
                </Field>
                <Field label="BIC">
                  <input value={form.bank_bic} onChange={e => set('bank_bic', e.target.value.toUpperCase())} placeholder="COBADEFFXXX" className="sw-mono" />
                </Field>
                <Field label="Kontoinhaber" required>
                  <input value={form.bank_inhaber} onChange={e => set('bank_inhaber', e.target.value)} placeholder="Max Mustermann" />
                </Field>
                <Field label="Bank / Kreditinstitut">
                  <input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="Sparkasse Landshut" />
                </Field>
                <Field label="SEPA-Gläubiger-ID" required>
                  <input
                    value={form.sepa_glaeubiger_id}
                    onChange={e => set('sepa_glaeubiger_id', e.target.value.toUpperCase())}
                    placeholder="DE98ZZZ09999999999"
                    className="sw-mono sw-full"
                  />
                  <span className="sw-hint">Die Gläubiger-ID erhältst du bei der Bundesbank (kostenlos).</span>
                </Field>
              </div>
            </div>
          )}

          {/* ── Schritt 3: Tarife ── */}
          {currentStepId === 'tarife' && (
            <div className="sw-step-body">
              <div className="sw-step-heading">
                <Package size={24} />
                <div>
                  <h3>Mitgliedschaftstarife <StepStatus complete={stepComplete.tarife} /></h3>
                  <p>Mindestens ein aktiver Tarif ist für die Online-Anmeldung erforderlich.</p>
                </div>
              </div>

              {tarifCount === null ? (
                <div className="sw-loading">Lade Tarife…</div>
              ) : tarifCount > 0 ? (
                <div className="sw-tarif-ok">
                  <CheckCircle size={40} className="sw-big-check" />
                  <p><strong>{tarifCount} aktiver Tarif{tarifCount !== 1 ? 'e' : ''}</strong> angelegt.</p>
                  <p className="sw-muted">Du kannst jederzeit weitere Tarife unter <em>Einstellungen → Mitgliedschaft</em> hinzufügen.</p>
                </div>
              ) : (
                <div className="sw-tarif-warn">
                  <AlertCircle size={40} className="sw-big-warn" />
                  <p><strong>Kein aktiver Tarif gefunden.</strong></p>
                  <p className="sw-muted">Ohne Tarife können sich neue Mitglieder nicht anmelden.</p>
                  <a
                    href="/dashboard/dojos"
                    className="sw-btn-link"
                    onClick={onClose}
                  >
                    Tarife jetzt anlegen →
                  </a>
                  <p className="sw-muted-sm">Du kannst diesen Schritt auch überspringen und Tarife später anlegen.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Schritt 4: Rechtliches ── */}
          {currentStepId === 'rechtlich' && (
            <div className="sw-step-body">
              <div className="sw-step-heading">
                <FileText size={24} />
                <div>
                  <h3>Rechtliche Texte <StepStatus complete={stepComplete.rechtlich} /></h3>
                  <p>AGB, Datenschutz und Impressum werden Mitgliedern bei der Anmeldung angezeigt.</p>
                </div>
              </div>
              <div className="sw-form-stack">
                <Field label="Allgemeine Geschäftsbedingungen (AGB)" required>
                  <textarea
                    value={form.agb_text}
                    onChange={e => set('agb_text', e.target.value)}
                    placeholder="§1 Geltungsbereich…"
                    rows={5}
                  />
                </Field>
                <Field label="Datenschutzerklärung">
                  <textarea
                    value={form.datenschutz_text}
                    onChange={e => set('datenschutz_text', e.target.value)}
                    placeholder="Wir verarbeiten personenbezogene Daten gemäß DSGVO…"
                    rows={5}
                  />
                </Field>
                <Field label="Impressum" required>
                  <textarea
                    value={form.impressum_text}
                    onChange={e => set('impressum_text', e.target.value)}
                    placeholder="Angaben gemäß § 5 TMG: …"
                    rows={5}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* ── Schritt 5: Fertig ── */}
          {currentStepId === 'fertig' && (
            <div className="sw-step-body sw-finish">
              <div className="sw-finish-icon">{allComplete ? '🎉' : '✅'}</div>
              <h3>{allComplete ? 'Ersteinrichtung abgeschlossen!' : 'Fast fertig!'}</h3>
              <p className="sw-finish-sub">
                {allComplete
                  ? 'Dein Dojo ist vollständig eingerichtet und bereit für Mitglieder.'
                  : 'Du kannst fehlende Einstellungen jederzeit unter Einstellungen → Mein Dojo ergänzen.'}
              </p>

              <div className="sw-summary">
                {[
                  { label: 'Grunddaten',      complete: stepComplete.grunddaten },
                  { label: 'Bankverbindung',   complete: stepComplete.bank },
                  { label: 'Tarife',           complete: stepComplete.tarife },
                  { label: 'Rechtliche Texte', complete: stepComplete.rechtlich },
                ].map(item => (
                  <div key={item.label} className={`sw-summary-row ${item.complete ? 'ok' : 'warn'}`}>
                    {item.complete
                      ? <CheckCircle size={16} />
                      : <AlertCircle size={16} />}
                    <span>{item.label}</span>
                    <span className="sw-summary-status">{item.complete ? 'Vollständig' : 'Unvollständig'}</span>
                  </div>
                ))}
              </div>

              <button className="sw-btn-primary sw-btn-big" onClick={handleFertig} disabled={saving}>
                {saving ? 'Speichern…' : 'Los geht\'s! →'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sw-footer">
          <label className="sw-dismiss-check">
            <input
              type="checkbox"
              checked={nichtMehrAnzeigen}
              onChange={e => setNichtMehrAnzeigen(e.target.checked)}
            />
            <span>Nicht mehr anzeigen</span>
          </label>

          <div className="sw-footer-nav">
            {step > 0 && currentStepId !== 'fertig' && (
              <button className="sw-btn-back" onClick={() => { setError(''); setStep(s => s - 1); }}>
                <ChevronLeft size={16} /> Zurück
              </button>
            )}
            {currentStepId !== 'fertig' && (
              <button className="sw-btn-primary" onClick={handleWeiter} disabled={saving}>
                {saving ? 'Speichern…' : (
                  <>{currentStepId === 'rechtlich' ? 'Speichern & Weiter' : 'Weiter'} <ChevronRight size={16} /></>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default SetupWizard;
