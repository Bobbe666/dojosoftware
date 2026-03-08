import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import SignaturePad from 'react-signature-canvas';
import { Trash2, Check, PenTool } from 'lucide-react';
import '../styles/SignatureCanvas.css';

/**
 * SignatureCanvas - Digitale Unterschrift Komponente
 *
 * Verwendet react-signature-canvas fuer ein Touch-freundliches Unterschriftsfeld.
 * Speichert als Base64 PNG fuer direkte Datenbank-Speicherung.
 *
 * @param {function} onSignatureChange - Callback wenn Unterschrift geaendert wird (Base64 oder null)
 * @param {number} width - Breite des Canvas (default: 500)
 * @param {number} height - Hoehe des Canvas (default: 200)
 * @param {string} penColor - Stiftfarbe (default: #000000)
 * @param {string} backgroundColor - Hintergrundfarbe (default: #ffffff)
 * @param {string} label - Label Text (default: Unterschrift)
 * @param {boolean} required - Pflichtfeld markierung
 * @param {boolean} disabled - Deaktiviert das Feld
 * @param {string} existingSignature - Vorhandene Unterschrift zum Laden
 */
const SignatureCanvas = forwardRef(({
  onSignatureChange,
  width = 500,
  height = 200,
  penColor = '#000000',
  backgroundColor = '#ffffff',
  label = 'Unterschrift',
  required = false,
  disabled = false,
  existingSignature = null
}, ref) => {
  const sigPad = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [hasSignature, setHasSignature] = useState(false);

  // Lade existierende Unterschrift
  useEffect(() => {
    if (existingSignature && sigPad.current) {
      // Kurze Verzoegerung damit Canvas initialisiert ist
      setTimeout(() => {
        try {
          sigPad.current.fromDataURL(existingSignature);
          setIsEmpty(false);
          setHasSignature(true);
        } catch (err) {
          console.error('Fehler beim Laden der Unterschrift:', err);
        }
      }, 100);
    }
  }, [existingSignature]);

  // Exponiere Methoden nach aussen
  useImperativeHandle(ref, () => ({
    clear: () => handleClear(),
    isEmpty: () => isEmpty,
    getSignatureData: () => getSignatureData(),
    toDataURL: () => sigPad.current?.toDataURL('image/png')
  }));

  const handleClear = () => {
    if (sigPad.current) {
      sigPad.current.clear();
      setIsEmpty(true);
      setHasSignature(false);
      if (onSignatureChange) {
        onSignatureChange(null);
      }
    }
  };

  const handleEnd = () => {
    if (sigPad.current && !sigPad.current.isEmpty()) {
      setIsEmpty(false);
      setHasSignature(true);
      if (onSignatureChange) {
        const dataUrl = sigPad.current.toDataURL('image/png');
        onSignatureChange(dataUrl);
      }
    }
  };

  const getSignatureData = () => {
    if (sigPad.current && !sigPad.current.isEmpty()) {
      return sigPad.current.toDataURL('image/png');
    }
    return null;
  };

  return (
    <div className="signature-canvas-container sc-container">
      <label className="sc-label">
        <PenTool size={16} />
        {label} {required && <span className="u-text-error">*</span>}
      </label>

      <div
        className={`sc-pad-wrapper${hasSignature ? ' sc-pad-wrapper--signed' : ''}${disabled ? ' sc-pad-wrapper--disabled' : ''}`}
        style={{ '--sc-bg': backgroundColor }}
      >
        <SignaturePad
          ref={sigPad}
          canvasProps={{
            width: width,
            height: height,
            className: 'signature-pad',
            style: {
              width: '100%',
              height: `${height}px`,
              cursor: disabled ? 'not-allowed' : 'crosshair',
              display: 'block'
            }
          }}
          penColor={penColor}
          backgroundColor={backgroundColor}
          onEnd={handleEnd}
          clearOnResize={false}
        />

        {/* Platzhalter-Text wenn leer */}
        {isEmpty && !disabled && (
          <div className="sc-placeholder">
            <PenTool size={24} className="sc-placeholder-icon" />
            <div>Hier unterschreiben...</div>
            <div className="sc-placeholder-sub">
              (Mit Maus oder Touch zeichnen)
            </div>
          </div>
        )}

        {/* Bestaetigungs-Icon wenn unterschrieben */}
        {hasSignature && (
          <div className="sc-confirm-badge">
            <Check size={16} color="white" />
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="sc-buttons">
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || isEmpty}
          className="sc-clear-btn"
        >
          <Trash2 size={16} />
          Loeschen
        </button>
      </div>

      {/* Hinweistext */}
      <p className="sc-hint">
        Mit Ihrer Unterschrift bestaetigen Sie die Erteilung des SEPA-Lastschriftmandats.
        Die Unterschrift wird digital gespeichert und ist rechtlich bindend.
      </p>
    </div>
  );
});

SignatureCanvas.displayName = 'SignatureCanvas';

export default SignatureCanvas;
