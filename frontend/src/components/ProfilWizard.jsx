/**
 * ProfilWizard.jsx
 * Erscheint beim ersten Login nach der Registrierung über tda-vib.de.
 * Sammelt optional: Notfallkontakt + medizinische Hinweise.
 * Erkennung: localStorage-Key `profil_wizard_done_{mitgliedId}`
 */
import { useState } from 'react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config.js';
import '../styles/ProfilWizard.css';

const STEPS = ['notfall', 'medizin'];

const ProfilWizard = ({ mitgliedId, vorname, onClose }) => {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    notfallkontakt_name: '',
    notfallkontakt_telefon: '',
    notfallkontakt_verhaeltnis: '',
    allergien: '',
    medizinische_hinweise: ''
  });

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const stepName = STEPS[step];

  const saveAndFinish = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${mitgliedId}/medizinisch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notfallkontakt_name: form.notfallkontakt_name || null,
          notfallkontakt_telefon: form.notfallkontakt_telefon || null,
          notfallkontakt_verhaeltnis: form.notfallkontakt_verhaeltnis || null,
          allergien: form.allergien || null,
          medizinische_hinweise: form.medizinische_hinweise || null
        })
      });
      if (!res.ok) throw new Error('Speichern fehlgeschlagen');
    } catch (err) {
      console.error('ProfilWizard Speicherfehler:', err);
      // Nicht-blockierend – trotzdem beenden
    } finally {
      setSaving(false);
      markDone();
    }
  };

  const markDone = () => {
    localStorage.setItem(`profil_wizard_done_${mitgliedId}`, '1');
    onClose();
  };

  const nextStep = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const prevStep = () => { setError(''); setStep(s => Math.max(s - 1, 0)); };

  const handleNotfallWeiter = () => {
    if (!form.notfallkontakt_name || !form.notfallkontakt_telefon) {
      setError('Bitte Name und Telefonnummer des Notfallkontakts angeben.');
      return;
    }
    setError('');
    nextStep();
  };

  return (
    <div className="pw-overlay">
      <div className="pw-modal">
        {/* Header */}
        <div className="pw-header">
          <div className="pw-progress">
            {STEPS.map((s, i) => (
              <div key={s} className={`pw-dot ${i <= step ? 'active' : ''}`} />
            ))}
          </div>
          <button className="pw-skip" onClick={markDone} title="Überspringen">✕</button>
        </div>

        {/* Schritt 1: Notfallkontakt */}
        {stepName === 'notfall' && (
          <div className="pw-step">
            <div className="pw-icon">🆘</div>
            <h2>Notfallkontakt hinterlegen</h2>
            <p className="pw-subtitle">
              Hallo {vorname}! Bitte hinterlege eine Person, die wir im Notfall erreichen können.
            </p>
            {error && <div className="pw-error">{error}</div>}
            <div className="pw-form">
              <label>Name des Notfallkontakts *</label>
              <input
                type="text"
                value={form.notfallkontakt_name}
                onChange={e => set('notfallkontakt_name', e.target.value)}
                placeholder="Vorname Nachname"
                autoFocus
              />
              <label>Telefonnummer *</label>
              <input
                type="tel"
                value={form.notfallkontakt_telefon}
                onChange={e => set('notfallkontakt_telefon', e.target.value)}
                placeholder="0151 12345678"
              />
              <label>Verhältnis</label>
              <select value={form.notfallkontakt_verhaeltnis} onChange={e => set('notfallkontakt_verhaeltnis', e.target.value)}>
                <option value="">Bitte wählen (optional)</option>
                <option value="Mutter">Mutter</option>
                <option value="Vater">Vater</option>
                <option value="Partner/in">Partner/in</option>
                <option value="Geschwister">Geschwister</option>
                <option value="Freund/in">Freund/in</option>
                <option value="Sonstige/r">Sonstige/r</option>
              </select>
            </div>
            <div className="pw-footer">
              <button className="pw-btn-skip" onClick={nextStep}>Überspringen</button>
              <button className="pw-btn-primary" onClick={handleNotfallWeiter}>Weiter</button>
            </div>
          </div>
        )}

        {/* Schritt 2: Medizinisches (optional) */}
        {stepName === 'medizin' && (
          <div className="pw-step">
            <div className="pw-icon">🏥</div>
            <h2>Medizinische Hinweise</h2>
            <p className="pw-subtitle">
              Gibt es Allergien oder gesundheitliche Besonderheiten, die wir wissen sollten?
              <br /><span className="pw-optional">Komplett optional – du kannst auch später ergänzen.</span>
            </p>
            <div className="pw-form">
              <label>Allergien</label>
              <textarea
                value={form.allergien}
                onChange={e => set('allergien', e.target.value)}
                placeholder="z.B. Bienenallergie, Laktoseintoleranz…"
                rows={3}
              />
              <label>Weitere medizinische Hinweise</label>
              <textarea
                value={form.medizinische_hinweise}
                onChange={e => set('medizinische_hinweise', e.target.value)}
                placeholder="z.B. Knieprobleme, Asthma, Blutverdünner…"
                rows={3}
              />
            </div>
            <div className="pw-footer">
              <button className="pw-btn-back" onClick={prevStep}>Zurück</button>
              <button className="pw-btn-skip" onClick={markDone} disabled={saving}>Überspringen</button>
              <button className="pw-btn-primary" onClick={saveAndFinish} disabled={saving}>
                {saving ? 'Speichern…' : 'Speichern & Fertig'}
              </button>
            </div>
          </div>
        )}


      </div>
    </div>
  );
};

export default ProfilWizard;
