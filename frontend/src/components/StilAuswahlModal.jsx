/**
 * StilAuswahlModal.jsx
 * Erscheint beim ersten Login wenn noch kein Stil hinterlegt ist.
 * Schritt 1: Stil-Pflichtauswahl (genau einer)
 * Schritt 2: Starterpaket für den gewählten Stil anzeigen + bestellen
 * Erkennung: localStorage-Key `stil_ausgewaehlt_{mitgliedId}`
 */
import { useState, useEffect } from 'react';
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
  'MMA':                  { emoji: '🤺', farbe: '#ef4444' },
  'Selbstverteidigung':   { emoji: '🛡️', farbe: '#22c55e' },
};

const StilAuswahlModal = ({ mitgliedId, vorname, stile, onClose, onSaved }) => {
  const [step, setStep] = useState(1);
  const [selectedStilId, setSelectedStilId] = useState(null);
  const [starterpaket, setStarterpaket] = useState(null);
  const [paketLoading, setPaketLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [bestelltErfolgreich, setBestelltErfolgreich] = useState(false);

  const aktiveStile = (stile || []).filter(s => s.aktiv !== false && s.aktiv !== 0);

  // Starterpaket laden wenn Stil gewählt
  useEffect(() => {
    if (!selectedStilId) return;
    setPaketLoading(true);
    setStarterpaket(null);
    fetchWithAuth(`${config.apiBaseUrl}/starterpakete/for-stil/${selectedStilId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.success) setStarterpaket(d.paket); })
      .catch(() => {})
      .finally(() => setPaketLoading(false));
  }, [selectedStilId]);

  const handleStilWeiter = async () => {
    if (!selectedStilId) {
      setError('Bitte wähle einen Kampfkunststil aus.');
      return;
    }
    setError('');

    // Stil sofort speichern
    setSaving(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${mitgliedId}/stile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stile: [selectedStilId] }),
      });
      if (!res.ok) throw new Error('Fehler beim Speichern des Stils');
    } catch (err) {
      console.error(err);
      setError('Stil konnte nicht gespeichert werden. Bitte erneut versuchen.');
      setSaving(false);
      return;
    } finally {
      setSaving(false);
    }

    setStep(2);
  };

  const handleBestellen = async () => {
    if (!starterpaket) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/starterpakete/${starterpaket.paket_id}/bestellen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitglied_id: mitgliedId }),
      });
      if (!res.ok) throw new Error('Bestellung fehlgeschlagen');
      setBestelltErfolgreich(true);
    } catch (err) {
      console.error(err);
      setError('Bestellung konnte nicht übermittelt werden. Bitte wende dich ans Dojo.');
    } finally {
      setSaving(false);
    }
  };

  const markDone = () => {
    localStorage.setItem(`stil_ausgewaehlt_${mitgliedId}`, '1');
    onSaved?.();
    onClose();
  };

  const selectedStil = aktiveStile.find(s => s.stil_id === selectedStilId);
  const selectedMeta = selectedStil ? (STIL_META[selectedStil.name] || { emoji: '🥋', farbe: '#d4af37' }) : null;

  return (
    <div className="sa-overlay">
      <div className="sa-modal">
        {/* Header mit Schrittanzeige */}
        <div className="sa-header">
          <div className="sa-steps">
            <div className={`sa-step-dot ${step >= 1 ? 'active' : ''}`} />
            <div className={`sa-step-line ${step >= 2 ? 'active' : ''}`} />
            <div className={`sa-step-dot ${step >= 2 ? 'active' : ''}`} />
          </div>
          <button className="sa-skip" onClick={markDone} title="Überspringen">✕</button>
        </div>

        {/* ── Schritt 1: Stil-Auswahl ─────────────────────────── */}
        {step === 1 && (
          <div className="sa-body">
            <div className="sa-icon">🥋</div>
            <h2 className="sa-title">Willkommen, {vorname}!</h2>
            <p className="sa-subtitle">
              Welchen Kampfkunststil möchtest du trainieren?
            </p>

            {error && <div className="sa-error">{error}</div>}

            <div className="sa-stile-grid">
              {aktiveStile.map(stil => {
                const meta = STIL_META[stil.name] || { emoji: '🥋', farbe: '#d4af37' };
                const isSelected = selectedStilId === stil.stil_id;
                return (
                  <button
                    key={stil.stil_id}
                    className={`sa-stil-card ${isSelected ? 'sa-stil-card--selected' : ''}`}
                    style={isSelected ? { '--sa-stil-farbe': meta.farbe } : {}}
                    onClick={() => { setSelectedStilId(stil.stil_id); setError(''); }}
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
                onClick={handleStilWeiter}
                disabled={saving || !selectedStilId}
              >
                {saving ? 'Speichern…' : 'Weiter →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Schritt 2: Starterpaket ─────────────────────────── */}
        {step === 2 && (
          <div className="sa-body">
            {bestelltErfolgreich ? (
              <div style={{ textAlign: 'center', padding: '1rem 0 0.5rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</div>
                <h2 className="sa-title">Bestellung erhalten!</h2>
                <p className="sa-subtitle">
                  Dein Starterpaket wurde bestellt und wird per Lastschrift abgebucht.<br />
                  Wir melden uns bei dir.
                </p>
                <button className="sa-btn-primary" style={{ marginTop: '0.5rem' }} onClick={markDone}>
                  Fertig
                </button>
              </div>
            ) : (
              <>
                {/* Gewählter Stil */}
                {selectedStil && selectedMeta && (
                  <div className="sa-chosen-stil" style={{ '--sa-stil-farbe': selectedMeta.farbe }}>
                    <span>{selectedMeta.emoji}</span>
                    <span>{selectedStil.name}</span>
                    <span className="sa-chosen-check">✓ gewählt</span>
                  </div>
                )}

                <h2 className="sa-title" style={{ marginTop: '1rem' }}>Dein Starterpaket</h2>

                {paketLoading && (
                  <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', marginTop: '1.5rem' }}>Paket wird geladen…</p>
                )}

                {!paketLoading && !starterpaket && (
                  <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                      Für diesen Stil ist noch kein Starterpaket hinterlegt.<br />
                      Wende dich an unser Team.
                    </p>
                    <button className="sa-btn-primary" style={{ marginTop: '1rem' }} onClick={markDone}>
                      Verstanden
                    </button>
                  </div>
                )}

                {!paketLoading && starterpaket && (
                  <>
                    {starterpaket.hinweis && (
                      <div className="sa-hinweis">
                        ⚠️ {starterpaket.hinweis}
                      </div>
                    )}

                    {starterpaket.beschreibung && (
                      <p style={{ fontSize: '0.87rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1rem', lineHeight: 1.5 }}>
                        {starterpaket.beschreibung}
                      </p>
                    )}

                    {/* Positionen-Tabelle */}
                    <div className="sa-paket-table">
                      {(starterpaket.positionen || []).map(pos => (
                        <div key={pos.id} className="sa-paket-row">
                          <div className="sa-paket-bez">
                            {pos.bezeichnung}
                            {pos.menge > 1 && <span className="sa-paket-menge">× {pos.menge}</span>}
                            {!pos.pflicht && <span className="sa-paket-opt">optional</span>}
                          </div>
                          <div className="sa-paket-preis">{(pos.einzelpreis_cent * pos.menge / 100).toFixed(2)} €</div>
                        </div>
                      ))}
                      {starterpaket.rabatt_prozent > 0 && (
                        <div className="sa-paket-row sa-paket-rabatt">
                          <div>Rabatt ({starterpaket.rabatt_prozent}%)</div>
                          <div>−{(starterpaket.rabatt_cent / 100).toFixed(2)} €</div>
                        </div>
                      )}
                      <div className="sa-paket-row sa-paket-total">
                        <div>Gesamtpreis</div>
                        <div>{((starterpaket.endpreis_cent || 0) / 100).toFixed(2)} €</div>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', margin: '0.75rem 0 0', textAlign: 'center' }}>
                      Der Betrag wird per SEPA-Lastschrift eingezogen.
                    </p>

                    {error && <div className="sa-error" style={{ marginTop: '0.75rem' }}>{error}</div>}

                    <div className="sa-footer" style={{ marginTop: '1.25rem' }}>
                      <button className="sa-btn-skip" onClick={markDone} disabled={saving}>
                        Später entscheiden
                      </button>
                      <button className="sa-btn-primary" onClick={handleBestellen} disabled={saving}>
                        {saving ? 'Wird gesendet…' : 'Paket bestellen'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StilAuswahlModal;
