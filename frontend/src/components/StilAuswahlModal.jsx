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

const calcAge = (geburtsdatum) => {
  if (!geburtsdatum) return null;
  const heute = new Date();
  const geb = new Date(geburtsdatum);
  let alter = heute.getFullYear() - geb.getFullYear();
  const m = heute.getMonth() - geb.getMonth();
  if (m < 0 || (m === 0 && heute.getDate() < geb.getDate())) alter--;
  return alter;
};

const StilAuswahlModal = ({ mitgliedId, vorname, geburtsdatum, stile, onClose, onSaved }) => {
  const alter = calcAge(geburtsdatum);
  const isKid = alter !== null ? alter < 14 : null;
  const [step, setStep] = useState(1);
  const [selectedStilIds, setSelectedStilIds] = useState([]);
  const [paketStilId, setPaketStilId] = useState(null); // welcher Stil für Starterpaket
  const [starterpaket, setStarterpaket] = useState(null);
  const [paketLoading, setPaketLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [bestelltErfolgreich, setBestelltErfolgreich] = useState(false);
  const [variantenWahl, setVariantenWahl] = useState({});

  const aktiveStile = (stile || []).filter(s => s.aktiv !== false && s.aktiv !== 0);

  // Starterpaket laden + Varianten automatisch vorbelegen
  useEffect(() => {
    if (!paketStilId) return;
    setPaketLoading(true);
    setStarterpaket(null);
    setVariantenWahl({});
    fetchWithAuth(`${config.apiBaseUrl}/starterpakete/for-stil/${paketStilId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.success) return;
        const paket = d.paket;
        setStarterpaket(paket);
        // Automatisch Kids/Erwachsene aus Alter setzen
        if (paket && isKid !== null) {
          const vorwahl = {};
          (paket.positionen || []).forEach(pos => {
            if (pos.hat_varianten) {
              const opts = pos.varianten_options
                ? (typeof pos.varianten_options === 'string' ? JSON.parse(pos.varianten_options) : pos.varianten_options)
                : null;
              if (opts?.hat_preiskategorien) {
                vorwahl[pos.id] = { kategorie: isKid ? 'kids' : 'erwachsene', groesse: null };
              }
            }
          });
          if (Object.keys(vorwahl).length) setVariantenWahl(vorwahl);
        }
      })
      .catch(() => {})
      .finally(() => setPaketLoading(false));
  }, [paketStilId, isKid]);

  const toggleStil = (stilId) => {
    setSelectedStilIds(prev =>
      prev.includes(stilId) ? prev.filter(id => id !== stilId) : [...prev, stilId]
    );
    setError('');
  };

  const handleStilWeiter = async () => {
    if (selectedStilIds.length === 0) {
      setError('Bitte wähle mindestens einen Kampfkunststil aus.');
      return;
    }
    setError('');

    // Alle Stile speichern
    setSaving(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${mitgliedId}/stile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stile: selectedStilIds }),
      });
      if (!res.ok) throw new Error('Fehler beim Speichern');
    } catch (err) {
      console.error(err);
      setError('Stile konnten nicht gespeichert werden. Bitte erneut versuchen.');
      setSaving(false);
      return;
    } finally {
      setSaving(false);
    }

    // Für Starterpaket den ersten gewählten Stil nehmen
    setPaketStilId(selectedStilIds[0]);
    setStep(2);
  };

  const variantenPositionen = (starterpaket?.positionen || []).filter(p => p.hat_varianten);
  const variantenVollstaendig = variantenPositionen.every(p => {
    const w = variantenWahl[p.id];
    if (!w) return false;
    const opts = p.varianten_options ? (typeof p.varianten_options === 'string' ? JSON.parse(p.varianten_options) : p.varianten_options) : null;
    if (opts?.hat_preiskategorien) return w.kategorie && w.groesse;
    return !!w.groesse;
  });

  const handleBestellen = async () => {
    if (!starterpaket) return;
    if (variantenPositionen.length > 0 && !variantenVollstaendig) {
      setError('Bitte wähle für alle Artikel eine Größe aus.');
      return;
    }
    setSaving(true);
    setError('');
    const variantenJson = {};
    variantenPositionen.forEach(p => {
      const w = variantenWahl[p.id];
      if (w) variantenJson[p.id] = w.kategorie ? `${w.kategorie === 'kids' ? 'Kids' : 'Erwachsene'} ${w.groesse}` : w.groesse;
    });
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/starterpakete/${starterpaket.paket_id}/bestellen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitglied_id: mitgliedId, varianten_json: Object.keys(variantenJson).length ? variantenJson : null }),
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

  const paketStil = aktiveStile.find(s => s.stil_id === paketStilId);
  const paketMeta = paketStil ? (STIL_META[paketStil.name] || { emoji: '🥋', farbe: '#d4af37' }) : null;

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
        </div>

        {/* ── Schritt 1: Stil-Auswahl ─────────────────────────── */}
        {step === 1 && (
          <div className="sa-body">
            <div className="sa-icon">🥋</div>
            <h2 className="sa-title">Willkommen, {vorname}!</h2>
            <p className="sa-subtitle">
              Welche Kampfkunststile möchtest du trainieren? (Mehrere möglich)
            </p>

            {error && <div className="sa-error">{error}</div>}

            <div className="sa-stile-grid">
              {aktiveStile.map(stil => {
                const meta = STIL_META[stil.name] || { emoji: '🥋', farbe: '#d4af37' };
                const isSelected = selectedStilIds.includes(stil.stil_id);
                return (
                  <button
                    key={stil.stil_id}
                    className={`sa-stil-card ${isSelected ? 'sa-stil-card--selected' : ''}`}
                    style={isSelected ? { '--sa-stil-farbe': meta.farbe } : {}}
                    onClick={() => toggleStil(stil.stil_id)}
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
              <button
                className="sa-btn-primary"
                onClick={handleStilWeiter}
                disabled={saving || selectedStilIds.length === 0}
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
                {/* Gewählte Stile */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  {selectedStilIds.map(id => {
                    const s = aktiveStile.find(x => x.stil_id === id);
                    if (!s) return null;
                    const m = STIL_META[s.name] || { emoji: '🥋', farbe: '#d4af37' };
                    return (
                      <div key={id} className="sa-chosen-stil" style={{ '--sa-stil-farbe': m.farbe, flex: 'none' }}>
                        <span>{m.emoji}</span>
                        <span>{s.name}</span>
                        <span className="sa-chosen-check">✓</span>
                      </div>
                    );
                  })}
                </div>

                <h2 className="sa-title" style={{ marginTop: '1rem' }}>
                  Dein Starterpaket{paketStil ? ` – ${paketStil.name}` : ''}
                </h2>

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
                      {(starterpaket.positionen || []).map(pos => {
                        const opts = pos.hat_varianten && pos.varianten_options
                          ? (typeof pos.varianten_options === 'string' ? JSON.parse(pos.varianten_options) : pos.varianten_options)
                          : null;
                        const wahl = variantenWahl[pos.id] || {};
                        // Altersbasierter Preis
                        const preis_cent = (opts?.hat_preiskategorien && isKid !== null)
                          ? (isKid ? (opts.preis_kids_cent || pos.einzelpreis_cent) : (opts.preis_erwachsene_cent || pos.einzelpreis_cent))
                          : pos.einzelpreis_cent;
                        const original_cent = opts?.hat_preiskategorien && isKid !== null
                          ? (isKid ? (opts.original_kids_cent || null) : (opts.original_erwachsene_cent || null))
                          : pos.originalpreis_cent;
                        return (
                          <div key={pos.id} className="sa-paket-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.4rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div className="sa-paket-bez">
                                {pos.bezeichnung}
                                {pos.menge > 1 && <span className="sa-paket-menge">× {pos.menge}</span>}
                                {!pos.pflicht && <span className="sa-paket-opt">optional</span>}
                              </div>
                              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                {pos.rabatt_prozent > 0 && original_cent > 0 && (
                                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through' }}>
                                    {(original_cent * pos.menge / 100).toFixed(2)} €
                                  </div>
                                )}
                                <div className="sa-paket-preis">{(preis_cent * pos.menge / 100).toFixed(2)} €</div>
                                {pos.rabatt_prozent > 0 && (
                                  <div style={{ fontSize: '0.72rem', color: '#d4af37' }}>{pos.rabatt_prozent}% Rabatt</div>
                                )}
                              </div>
                            </div>
                            {/* Größenauswahl — Kategorie automatisch aus Alter */}
                            {opts && (
                              <div style={{ paddingLeft: '0.25rem' }}>
                                {opts.hat_preiskategorien && isKid !== null && (
                                  <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.45)', marginBottom: '0.3rem' }}>
                                    {isKid ? '👧 Kinder-Größe' : '🧑 Erwachsenen-Größe'}
                                  </div>
                                )}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                  {(opts.hat_preiskategorien
                                    ? (isKid ? (opts.groessen_kids || []) : (opts.groessen_erwachsene || []))
                                    : (opts.groessen || [])
                                  ).map(gr => (
                                    <button key={gr} type="button"
                                      style={{ padding: '0.2rem 0.55rem', borderRadius: 5, border: `1px solid ${wahl.groesse === gr ? '#d4af37' : 'rgba(255,255,255,0.15)'}`, background: wahl.groesse === gr ? 'rgba(212,175,55,0.15)' : 'transparent', color: wahl.groesse === gr ? '#d4af37' : 'rgba(255,255,255,0.6)', fontSize: '0.78rem', cursor: 'pointer' }}
                                      onClick={() => setVariantenWahl(v => ({ ...v, [pos.id]: { ...v[pos.id], groesse: gr } }))}>
                                      {gr}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
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
