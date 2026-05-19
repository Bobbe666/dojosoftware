/**
 * StilAuswahlModal.jsx
 * Erscheint beim ersten Login wenn noch kein Stil hinterlegt ist.
 * Erkennung: localStorage-Key `stil_ausgewaehlt_{mitgliedId}`
 */
import { useState } from 'react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config.js';
import '../styles/StilAuswahlModal.css';

const STIL_META = {
  'Taekwon-Do':           { emoji: '🦵', farbe: '#d4af37' },
  'BJJ':                  { emoji: '🤼', farbe: '#3b82f6' },
  'Brazilian Jiu Jitsu':  { emoji: '🤼', farbe: '#3b82f6' },
  'Kickboxen':            { emoji: '🥊', farbe: '#f97316' },
  'Karate':               { emoji: '🥋', farbe: '#a78bfa' },
  'Enso Karate':          { emoji: '🥋', farbe: '#a78bfa' },
  'ShieldX':              { emoji: '🛡️', farbe: '#22c55e' },
};

const StilAuswahlModal = ({ mitgliedId, vorname, stile, onClose, onSaved }) => {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const aktiveStile = (stile || []).filter(s => s.aktiv !== false && s.aktiv !== 0);

  const toggle = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setError('');
  };

  const handleSave = async () => {
    if (selected.length === 0) {
      setError('Bitte wähle mindestens einen Stil aus.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${mitgliedId}/stile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stile: selected }),
      });
      if (!res.ok) throw new Error('Speichern fehlgeschlagen');
      markDone();
      onSaved?.();
    } catch (err) {
      console.error('StilAuswahl Speicherfehler:', err);
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  };

  const markDone = () => {
    localStorage.setItem(`stil_ausgewaehlt_${mitgliedId}`, '1');
    onClose();
  };

  return (
    <div className="sa-overlay">
      <div className="sa-modal">
        <div className="sa-header">
          <button className="sa-skip" onClick={markDone} title="Überspringen">✕</button>
        </div>

        <div className="sa-body">
          <div className="sa-icon">🥋</div>
          <h2 className="sa-title">Willkommen, {vorname}!</h2>
          <p className="sa-subtitle">
            Welchen Kampfkunststil möchtest du trainieren?<br />
            Du kannst auch mehrere Stile auswählen.
          </p>

          {error && <div className="sa-error">{error}</div>}

          <div className="sa-stile-grid">
            {aktiveStile.map(stil => {
              const meta = STIL_META[stil.name] || { emoji: '🥋', farbe: '#d4af37' };
              const isSelected = selected.includes(stil.stil_id);
              return (
                <button
                  key={stil.stil_id}
                  className={`sa-stil-card ${isSelected ? 'sa-stil-card--selected' : ''}`}
                  style={isSelected ? { '--sa-stil-farbe': meta.farbe } : {}}
                  onClick={() => toggle(stil.stil_id)}
                  type="button"
                >
                  <span className="sa-stil-emoji">{meta.emoji}</span>
                  <span className="sa-stil-name">{stil.name}</span>
                  {isSelected && <span className="sa-stil-check">✓</span>}
                </button>
              );
            })}
          </div>

          <div className="sa-footer">
            <button className="sa-btn-skip" onClick={markDone} disabled={saving}>
              Später auswählen
            </button>
            <button
              className="sa-btn-primary"
              onClick={handleSave}
              disabled={saving || selected.length === 0}
            >
              {saving ? 'Speichern…' : `Auswahl bestätigen${selected.length > 0 ? ` (${selected.length})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StilAuswahlModal;
