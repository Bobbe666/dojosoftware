import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import SignaturePad from 'react-signature-canvas';
import { Trash2, Check, PenTool } from 'lucide-react';

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
    <div className="signature-canvas-container" style={{ marginBottom: '1rem' }}>
      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.5rem',
        fontWeight: '600',
        color: '#e5e5e5',
        fontSize: '0.9rem'
      }}>
        <PenTool size={16} />
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>

      <div style={{
        border: `2px ${hasSignature ? 'solid #10b981' : 'dashed rgba(255,255,255,0.3)'}`,
        borderRadius: '8px',
        backgroundColor: disabled ? 'rgba(255,255,255,0.05)' : backgroundColor,
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.3s ease'
      }}>
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
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#9ca3af',
            pointerEvents: 'none',
            textAlign: 'center',
            fontSize: '0.9rem'
          }}>
            <PenTool size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
            <div>Hier unterschreiben...</div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
              (Mit Maus oder Touch zeichnen)
            </div>
          </div>
        )}

        {/* Bestaetigungs-Icon wenn unterschrieben */}
        {hasSignature && (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            backgroundColor: '#10b981',
            borderRadius: '50%',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            <Check size={16} color="white" />
          </div>
        )}
      </div>

      {/* Buttons */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginTop: '0.5rem',
        justifyContent: 'flex-end'
      }}>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || isEmpty}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '6px',
            backgroundColor: disabled || isEmpty ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
            color: disabled || isEmpty ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)',
            cursor: disabled || isEmpty ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            transition: 'all 0.2s ease'
          }}
        >
          <Trash2 size={16} />
          Loeschen
        </button>
      </div>

      {/* Hinweistext */}
      <p style={{
        fontSize: '0.75rem',
        color: 'rgba(255,255,255,0.5)',
        marginTop: '0.5rem',
        marginBottom: 0,
        lineHeight: 1.4
      }}>
        Mit Ihrer Unterschrift bestaetigen Sie die Erteilung des SEPA-Lastschriftmandats.
        Die Unterschrift wird digital gespeichert und ist rechtlich bindend.
      </p>
    </div>
  );
});

SignatureCanvas.displayName = 'SignatureCanvas';

export default SignatureCanvas;
