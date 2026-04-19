import React, { useState } from 'react';

const GROESSEN = [220, 240, 260, 280, 300, 320, 340];

/**
 * Gürtellängen-Rechner
 * Formel: Bauchumfang × 2 + 90 = Gürtellänge (aufgerundet auf nächste Standardgröße)
 *
 * Props:
 * - onApply(laenge_cm): optional – wird aufgerufen wenn "Übernehmen" geklickt
 * - compact: bool – kleinere Darstellung (für Admin-View)
 */
const GuertelRechner = ({ onApply, compact = false }) => {
  const [bauchumfang, setBauchumfang] = useState('');

  const cm = parseInt(bauchumfang, 10);
  const gueltig = !isNaN(cm) && cm >= 30 && cm <= 250;

  let rohLaenge = null;
  let empfehlung = null;
  if (gueltig) {
    rohLaenge = cm * 2 + 90;
    empfehlung = GROESSEN.find(g => g >= rohLaenge) ?? GROESSEN[GROESSEN.length - 1];
  }

  return (
    <div className={`guertel-rechner${compact ? ' guertel-rechner--compact' : ''}`}>
      <div className="guertel-rechner-title">
        📐 Gürtellängen-Rechner
      </div>
      <div className="guertel-rechner-formel">
        Bauchumfang × 2 + 90 cm = empfohlene Gürtellänge
      </div>

      <div className="guertel-rechner-row">
        <label className="guertel-rechner-label">Bauchumfang</label>
        <div className="guertel-rechner-input-row">
          <input
            type="number"
            className="guertel-rechner-input"
            value={bauchumfang}
            onChange={e => setBauchumfang(e.target.value)}
            placeholder="z. B. 85"
            min="30"
            max="250"
          />
          <span className="guertel-rechner-unit">cm</span>
        </div>
      </div>

      {gueltig && (
        <div className="guertel-rechner-result">
          <div className="guertel-rechner-calc">
            {cm} × 2 + 90 = <strong>{rohLaenge} cm</strong>
            {rohLaenge !== empfehlung && (
              <span className="guertel-rechner-round"> → aufgerundet auf</span>
            )}
          </div>
          <div className="guertel-rechner-empfehlung">
            <span className="guertel-rechner-badge">{empfehlung} cm</span>
            <span className="guertel-rechner-badge-label">empfohlene Größe</span>
          </div>
          {onApply && (
            <button
              className="guertel-rechner-btn"
              onClick={() => onApply(empfehlung)}
            >
              ✓ {empfehlung} cm übernehmen
            </button>
          )}
        </div>
      )}

      {bauchumfang && !gueltig && (
        <div className="guertel-rechner-error">
          Bitte einen Wert zwischen 30 und 250 cm eingeben.
        </div>
      )}
    </div>
  );
};

export default GuertelRechner;
