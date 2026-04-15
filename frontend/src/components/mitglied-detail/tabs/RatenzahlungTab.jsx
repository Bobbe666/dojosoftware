import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../../../styles/RatenzahlungTab.css';

// Modelle mit Label und Berechnungslogik
const MODELLE = [
  {
    id: 'doppelter_beitrag',
    label: 'Doppelter Monatsbeitrag',
    beschreibung: 'Jeden Monat wird zusätzlich ein kompletter Monatsbeitrag abgebucht.',
    berechne: (monatsbeitrag) => monatsbeitrag,
  },
  {
    id: 'plus_10',
    label: '+ 10 € / Monat',
    beschreibung: 'Jeden Monat werden 10 € extra abgebucht.',
    berechne: () => 10,
  },
  {
    id: 'plus_20',
    label: '+ 20 € / Monat',
    beschreibung: 'Jeden Monat werden 20 € extra abgebucht.',
    berechne: () => 20,
  },
  {
    id: 'freier_betrag',
    label: 'Freier Betrag',
    beschreibung: 'Individuellen monatlichen Aufschlag festlegen.',
    berechne: () => null, // wird manuell eingegeben
  },
];

export default function RatenzahlungTab({ mitglied_id, monatsbeitrag = 0 }) {
  const [plan, setPlan] = useState(null);
  const [offenerBetrag, setOffenerBetrag] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // Formular-State
  const [gewaehltesBetrag, setGewaehltesBetrag] = useState('');
  const [gewaehlteModell, setGewaehlteModell] = useState('');
  const [freierBetrag, setFreierBetrag] = useState('');
  const [notizen, setNotizen] = useState('');
  const [formOffen, setFormOffen] = useState(false);

  const ladePlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/rechnungen/ratenplan/${mitglied_id}`);
      if (res.data.success) {
        setPlan(res.data.plan);
        setOffenerBetrag(res.data.offener_betrag);
      }
    } catch (err) {
      console.error('Ratenplan laden:', err);
    } finally {
      setLoading(false);
    }
  }, [mitglied_id]);

  useEffect(() => { ladePlan(); }, [ladePlan]);

  const berechneAufschlag = (modellId) => {
    const m = MODELLE.find(m => m.id === modellId);
    if (!m) return 0;
    if (modellId === 'freier_betrag') return parseFloat(freierBetrag) || 0;
    return m.berechne(monatsbeitrag);
  };

  const berechneMonate = (aufschlag) => {
    if (!aufschlag || aufschlag <= 0) return '∞';
    return Math.ceil(parseFloat(gewaehltesBetrag || offenerBetrag) / aufschlag);
  };

  const handleErstellen = async () => {
    const aufschlag = berechneAufschlag(gewaehlteModell);
    if (!gewaehlteModell || !gewaehltesBetrag || aufschlag <= 0) {
      setMsg({ type: 'error', text: 'Bitte alle Felder ausfüllen.' });
      return;
    }
    setSaving(true);
    try {
      await axios.post('/rechnungen/ratenplan', {
        mitglied_id,
        ausstehender_betrag: parseFloat(gewaehltesBetrag),
        modell: gewaehlteModell,
        monatlicher_aufschlag: aufschlag,
        notizen,
      });
      setMsg({ type: 'success', text: 'Ratenplan wurde aktiviert.' });
      setFormOffen(false);
      ladePlan();
    } catch (err) {
      setMsg({ type: 'error', text: 'Fehler beim Speichern.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeaktivieren = async () => {
    if (!plan || !window.confirm('Ratenplan wirklich deaktivieren?')) return;
    setSaving(true);
    try {
      await axios.put(`/rechnungen/ratenplan/${plan.id}`, { aktiv: 0 });
      setMsg({ type: 'success', text: 'Ratenplan deaktiviert.' });
      ladePlan();
    } catch {
      setMsg({ type: 'error', text: 'Fehler beim Deaktivieren.' });
    } finally {
      setSaving(false);
    }
  };

  const handleLoeschen = async () => {
    if (!plan || !window.confirm('Ratenplan endgültig löschen?')) return;
    setSaving(true);
    try {
      await axios.delete(`/rechnungen/ratenplan/${plan.id}`);
      setMsg({ type: 'success', text: 'Ratenplan gelöscht.' });
      ladePlan();
    } catch {
      setMsg({ type: 'error', text: 'Fehler beim Löschen.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="raten-loading">Lade Ratenplan…</div>;

  const aufschlagVorschau = berechneAufschlag(gewaehlteModell);
  const monateVorschau = berechneMonate(aufschlagVorschau);

  return (
    <div className="ratenplan-tab">
      {msg && (
        <div className={`raten-msg raten-msg--${msg.type}`} onClick={() => setMsg(null)}>
          {msg.text}
        </div>
      )}

      {/* ── Aktiver Plan ── */}
      {plan ? (
        <div className="raten-aktiv">
          <div className="raten-aktiv-header">
            <span className="raten-badge raten-badge--aktiv">● Aktiver Ratenplan</span>
            <div className="raten-aktiv-actions">
              <button className="btn-sm btn-ghost" onClick={handleDeaktivieren} disabled={saving}>
                Pausieren
              </button>
              <button className="btn-sm btn-danger-ghost" onClick={handleLoeschen} disabled={saving}>
                Löschen
              </button>
            </div>
          </div>

          {/* Fortschrittsbalken */}
          <div className="raten-progress-block">
            <div className="raten-progress-labels">
              <span>Abgezahlt: <strong>{parseFloat(plan.bereits_abgezahlt).toFixed(2)} €</strong></span>
              <span>Gesamt: <strong>{parseFloat(plan.ausstehender_betrag).toFixed(2)} €</strong></span>
            </div>
            <div className="raten-progress-bar">
              <div
                className="raten-progress-fill"
                style={{ width: `${Math.min(100, (plan.bereits_abgezahlt / plan.ausstehender_betrag) * 100)}%` }}
              />
            </div>
            <div className="raten-progress-pct">
              {Math.round((plan.bereits_abgezahlt / plan.ausstehender_betrag) * 100)} % beglichen
            </div>
          </div>

          <div className="raten-info-grid">
            <div className="raten-info-item">
              <span className="raten-info-label">Modell</span>
              <span className="raten-info-value">
                {MODELLE.find(m => m.id === plan.modell)?.label || plan.modell}
              </span>
            </div>
            <div className="raten-info-item">
              <span className="raten-info-label">Aufschlag / Monat</span>
              <span className="raten-info-value">{parseFloat(plan.monatlicher_aufschlag).toFixed(2)} €</span>
            </div>
            <div className="raten-info-item">
              <span className="raten-info-label">Noch offen</span>
              <span className="raten-info-value">
                {(parseFloat(plan.ausstehender_betrag) - parseFloat(plan.bereits_abgezahlt)).toFixed(2)} €
              </span>
            </div>
            <div className="raten-info-item">
              <span className="raten-info-label">Verbleibende Monate</span>
              <span className="raten-info-value">
                {Math.ceil((parseFloat(plan.ausstehender_betrag) - parseFloat(plan.bereits_abgezahlt)) / parseFloat(plan.monatlicher_aufschlag))}
              </span>
            </div>
          </div>

          {plan.notizen && (
            <div className="raten-notizen">📝 {plan.notizen}</div>
          )}
        </div>
      ) : (
        <div className="raten-kein-plan">
          <div className="raten-kein-plan-info">
            <span className="raten-badge raten-badge--inaktiv">Kein aktiver Ratenplan</span>
            {offenerBetrag > 0 && (
              <span className="raten-offener-hinweis">
                Offene Rechnungen: <strong>{offenerBetrag.toFixed(2)} €</strong>
              </span>
            )}
          </div>
          {!formOffen && (
            <button className="btn-primary" onClick={() => {
              setGewaehltesBetrag(offenerBetrag > 0 ? offenerBetrag.toFixed(2) : '');
              setFormOffen(true);
            }}>
              + Ratenplan einrichten
            </button>
          )}
        </div>
      )}

      {/* ── Neuen Plan erstellen (Formular) ── */}
      {formOffen && !plan && (
        <div className="raten-form">
          <h4>Neuen Ratenplan einrichten</h4>

          <div className="raten-form-row">
            <label>Nachzahlungsbetrag (€)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={gewaehltesBetrag}
              onChange={e => setGewaehltesBetrag(e.target.value)}
              placeholder={offenerBetrag > 0 ? offenerBetrag.toFixed(2) : '0.00'}
            />
          </div>

          <div className="raten-form-row">
            <label>Ratenzahlungsmodell</label>
            <div className="raten-modell-grid">
              {MODELLE.map(m => {
                const aufschlag = m.id === 'freier_betrag' ? null : m.berechne(monatsbeitrag);
                return (
                  <button
                    key={m.id}
                    className={`raten-modell-card ${gewaehlteModell === m.id ? 'selected' : ''}`}
                    onClick={() => setGewaehlteModell(m.id)}
                    type="button"
                  >
                    <span className="raten-modell-label">{m.label}</span>
                    {aufschlag !== null && (
                      <span className="raten-modell-betrag">+{aufschlag.toFixed(2)} €/Monat</span>
                    )}
                    <span className="raten-modell-desc">{m.beschreibung}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {gewaehlteModell === 'freier_betrag' && (
            <div className="raten-form-row">
              <label>Monatlicher Aufschlag (€)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={freierBetrag}
                onChange={e => setFreierBetrag(e.target.value)}
                placeholder="z. B. 15.00"
              />
            </div>
          )}

          {/* Vorschau */}
          {gewaehlteModell && gewaehltesBetrag && aufschlagVorschau > 0 && (
            <div className="raten-vorschau">
              <span>📊 Voraussichtliche Laufzeit:</span>
              <strong>{monateVorschau} {monateVorschau === 1 ? 'Monat' : 'Monate'}</strong>
              <span>({aufschlagVorschau.toFixed(2)} € / Monat)</span>
            </div>
          )}

          <div className="raten-form-row">
            <label>Notizen (optional)</label>
            <textarea
              value={notizen}
              onChange={e => setNotizen(e.target.value)}
              placeholder="Interne Notiz zum Ratenplan…"
              rows={2}
            />
          </div>

          <div className="raten-form-actions">
            <button className="btn-primary" onClick={handleErstellen} disabled={saving}>
              {saving ? 'Speichere…' : 'Ratenplan aktivieren'}
            </button>
            <button className="btn-secondary" onClick={() => setFormOffen(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
