import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

const OfflineFallback = () => {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center',
        background: 'rgba(0, 0, 0, 0.3)',
        padding: '3rem 2rem',
        borderRadius: '16px',
        border: '2px solid rgba(255, 215, 0, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{
          marginBottom: '2rem',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          <WifiOff size={80} color="#ffd700" />
        </div>

        <h1 style={{
          color: '#ffd700',
          fontSize: '2rem',
          marginBottom: '1rem',
          fontWeight: 'bold'
        }}>
          Keine Internetverbindung
        </h1>

        <p style={{
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: '1.1rem',
          marginBottom: '2rem',
          lineHeight: '1.6'
        }}>
          Die App funktioniert offline mit eingeschränkten Funktionen.
          Einige Daten können veraltet sein.
        </p>

        <div style={{
          background: 'rgba(255, 215, 0, 0.1)',
          border: '1px solid rgba(255, 215, 0, 0.3)',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{
            color: '#ffd700',
            fontSize: '1.2rem',
            marginBottom: '0.75rem',
            fontWeight: '600'
          }}>
            Offline verfügbar:
          </h3>
          <ul style={{
            color: 'rgba(255, 255, 255, 0.9)',
            textAlign: 'left',
            paddingLeft: '1.5rem',
            margin: 0,
            lineHeight: '1.8'
          }}>
            <li>Gespeicherte Termine ansehen</li>
            <li>Trainingsplan einsehen</li>
            <li>Bisherige Statistiken</li>
          </ul>
        </div>

        <div style={{
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{
            color: '#fca5a5',
            fontSize: '1.2rem',
            marginBottom: '0.75rem',
            fontWeight: '600'
          }}>
            Nicht verfügbar:
          </h3>
          <ul style={{
            color: 'rgba(255, 255, 255, 0.9)',
            textAlign: 'left',
            paddingLeft: '1.5rem',
            margin: 0,
            lineHeight: '1.8'
          }}>
            <li>Check-in für Kurse</li>
            <li>Aktuelle Termine laden</li>
            <li>Profil aktualisieren</li>
          </ul>
        </div>

        <button
          onClick={handleRefresh}
          style={{
            width: '100%',
            padding: '1rem 2rem',
            background: 'linear-gradient(135deg, #ffd700, #ff6b35)',
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.3)';
          }}
        >
          <RefreshCw size={20} />
          Verbindung erneut prüfen
        </button>

        <p style={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '0.9rem',
          marginTop: '1.5rem',
          marginBottom: 0
        }}>
          Überprüfe deine Internetverbindung und versuche es erneut
        </p>
      </div>
    </div>
  );
};

// Inline animation
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(0.95);
    }
  }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(style);
}

export default OfflineFallback;
