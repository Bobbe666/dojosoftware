import React from 'react';

/**
 * Kündigungshinweis-Komponente
 *
 * Zeigt einen deutlichen Hinweis zur Kündigungsfrist an.
 * WICHTIG: Die Kündigungsfrist bezieht sich auf das VERTRAGSENDE, nicht auf die Laufzeit!
 *
 * @param {Object} props
 * @param {number} props.kuendigungsfrist_monate - Kündigungsfrist in Monaten (z.B. 3)
 * @param {string} props.vertragsende - Vertragsende als ISO-Date-String (z.B. "2025-12-31")
 * @param {string} props.variant - Darstellungsvariante: "warning" (Standard) oder "info"
 * @param {string} props.className - Zusätzliche CSS-Klasse
 */
const Kuendigungshinweis = ({
  kuendigungsfrist_monate = 3,
  vertragsende = null,
  variant = "warning",
  className = ""
}) => {

  // Berechne das Datum, bis wann die Kündigung eingereicht werden muss
  const calculateKuendigungsdatum = () => {
    if (!vertragsende) return null;

    const ende = new Date(vertragsende);
    // Subtrahiere die Kündigungsfrist in Monaten
    const kuendigungBis = new Date(ende);
    kuendigungBis.setMonth(kuendigungBis.getMonth() - kuendigungsfrist_monate);

    return kuendigungBis.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const kuendigungBisDatum = calculateKuendigungsdatum();
  const vertragsendeFormatiert = vertragsende
    ? new Date(vertragsende).toLocaleDateString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    : null;

  const variantStyles = {
    warning: {
      container: {
        background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
        border: '2px solid #F59E0B',
        borderRadius: '12px',
        padding: '1.5rem',
        marginTop: '1rem',
        marginBottom: '1rem',
        boxShadow: '0 4px 6px rgba(245, 158, 11, 0.1)'
      },
      icon: {
        fontSize: '2rem',
        marginBottom: '0.5rem'
      },
      title: {
        color: '#92400E',
        fontSize: '1.1rem',
        fontWeight: '700',
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      },
      text: {
        color: '#78350F',
        fontSize: '0.95rem',
        lineHeight: '1.6',
        marginBottom: '0.5rem'
      },
      example: {
        background: 'rgba(251, 191, 36, 0.2)',
        padding: '1rem',
        borderRadius: '8px',
        marginTop: '1rem',
        borderLeft: '4px solid #F59E0B'
      },
      exampleText: {
        color: '#78350F',
        fontSize: '0.9rem',
        fontStyle: 'italic',
        lineHeight: '1.5'
      }
    },
    info: {
      container: {
        background: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)',
        border: '2px solid #3B82F6',
        borderRadius: '12px',
        padding: '1.5rem',
        marginTop: '1rem',
        marginBottom: '1rem',
        boxShadow: '0 4px 6px rgba(59, 130, 246, 0.1)'
      },
      icon: {
        fontSize: '2rem',
        marginBottom: '0.5rem'
      },
      title: {
        color: '#1E3A8A',
        fontSize: '1.1rem',
        fontWeight: '700',
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      },
      text: {
        color: '#1E40AF',
        fontSize: '0.95rem',
        lineHeight: '1.6',
        marginBottom: '0.5rem'
      },
      example: {
        background: 'rgba(96, 165, 250, 0.2)',
        padding: '1rem',
        borderRadius: '8px',
        marginTop: '1rem',
        borderLeft: '4px solid #3B82F6'
      },
      exampleText: {
        color: '#1E40AF',
        fontSize: '0.9rem',
        fontStyle: 'italic',
        lineHeight: '1.5'
      }
    }
  };

  const styles = variantStyles[variant];

  return (
    <div className={`kuendigungshinweis ${className}`} style={styles.container}>
      <div style={styles.icon}>⚠️</div>

      <h4 style={styles.title}>
        <strong>Wichtig: Kündigungsfrist</strong>
      </h4>

      <p style={styles.text}>
        <strong>Die Kündigungsfrist bezieht sich auf das im Vertrag angegebene VERTRAGSENDE, nicht auf die Laufzeit.</strong>
      </p>

      <p style={styles.text}>
        Bei einer Kündigungsfrist von <strong>{kuendigungsfrist_monate} Monaten</strong> bedeutet dies:
      </p>

      <ul style={{
        ...styles.text,
        paddingLeft: '1.5rem',
        margin: '0.5rem 0'
      }}>
        <li>Die Kündigung muss <strong>mindestens {kuendigungsfrist_monate} Monate VOR dem Vertragsende</strong> beim Verein eingehen.</li>
        <li>Der Vertrag endet dann zum ursprünglich vereinbarten Vertragsende.</li>
        {vertragsende && (
          <li>
            Bei diesem Vertrag (Ende: <strong>{vertragsendeFormatiert}</strong>) muss die Kündigung
            spätestens am <strong style={{ color: variant === 'warning' ? '#B45309' : '#1E3A8A' }}>
              {kuendigungBisDatum}
            </strong> vorliegen.
          </li>
        )}
      </ul>

      {vertragsende && (
        <div style={styles.example}>
          <p style={styles.exampleText}>
            <strong>Beispiel für diesen Vertrag:</strong><br/>
            ✓ Vertragsende: {vertragsendeFormatiert}<br/>
            ✓ Kündigungsfrist: {kuendigungsfrist_monate} Monate<br/>
            ✓ Kündigung muss spätestens am {kuendigungBisDatum} beim Verein vorliegen<br/>
            ✓ Vertrag endet dann am {vertragsendeFormatiert}
          </p>
        </div>
      )}

      {!vertragsende && (
        <div style={styles.example}>
          <p style={styles.exampleText}>
            <strong>Allgemeines Beispiel:</strong><br/>
            Bei einem Vertrag mit Laufzeit bis 31.12.2025 und {kuendigungsfrist_monate} Monaten Kündigungsfrist
            muss die Kündigung spätestens am {
              new Date(2025, 12 - kuendigungsfrist_monate - 1, 30).toLocaleDateString('de-DE')
            } beim Verein vorliegen.
            Der Vertrag endet dann am 31.12.2025.
          </p>
        </div>
      )}
    </div>
  );
};

export default Kuendigungshinweis;
