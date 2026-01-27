import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

const PWAInstallButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showDesktopInstructions, setShowDesktopInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const checkInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                          window.navigator.standalone === true;
    setIsInstalled(checkInstalled);

    console.log('🔍 PWA Install Button - Status:', {
      isInstalled: checkInstalled,
      userAgent: navigator.userAgent,
      displayMode: window.matchMedia('(display-mode: standalone)').matches
    });

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Check if Safari
    const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    setIsSafari(safari);

    console.log('🔍 Browser Detection:', { iOS, safari });

    // Only show button if not installed
    if (!checkInstalled) {
      setShowInstallButton(true);

      if (!iOS) {
        // Android/Chrome/Edge: Listen for beforeinstallprompt
        const handleBeforeInstall = (e) => {
          console.log('✅ beforeinstallprompt event received!');
          e.preventDefault();
          setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        // Check after 1 second if event was fired
        setTimeout(() => {
          console.log('🔍 deferredPrompt status after 1s:', deferredPrompt ? 'Available' : 'Not available (Safari/unsupported)');
        }, 1000);

        return () => {
          window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        };
      }
    }
  }, []);

  const handleInstallClick = async () => {
    console.log('🖱️ Install button clicked!', { isIOS, isSafari, hasDeferredPrompt: !!deferredPrompt });

    if (isIOS) {
      // iOS: Show instructions
      console.log('📱 Showing iOS instructions');
      setShowIOSInstructions(true);
    } else if (deferredPrompt) {
      // Android/Chrome/Edge: Show native install prompt
      console.log('🤖 Showing native install prompt');
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('✅ User accepted PWA install');
        setShowInstallButton(false);
      } else {
        console.log('❌ User declined PWA install');
      }

      setDeferredPrompt(null);
    } else {
      // Safari/Desktop without beforeinstallprompt support
      console.log('🖥️ Showing desktop/Safari instructions');
      setShowDesktopInstructions(true);
    }
  };

  if (isInstalled || !showInstallButton) {
    return null;
  }

  return (
    <>
      {/* Install Button Tile */}
      <div
        onClick={handleInstallClick}
        style={{
          cursor: 'pointer',
          padding: '0.8rem',
          minHeight: '60px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.3rem',
          background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 237, 78, 0.15))',
          border: '1px solid rgba(255, 215, 0, 0.3)',
          borderRadius: '12px',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.25), rgba(255, 237, 78, 0.25))';
          e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.5)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 237, 78, 0.15))';
          e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.3)';
        }}
      >
        <Download size={20} style={{ color: '#ffd700' }} />
        <span style={{ fontSize: '0.85rem', color: '#ffd700', fontWeight: '600' }}>
          App installieren
        </span>
        {isIOS && (
          <span style={{ fontSize: '0.7rem', color: '#a0a0a0' }}>
            Anleitung anzeigen
          </span>
        )}
      </div>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            padding: '1rem'
          }}
          onClick={() => setShowIOSInstructions(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#1a1a2e',
              padding: '2rem',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              position: 'relative',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowIOSInstructions(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#e0e0e0',
                cursor: 'pointer',
                padding: '0.5rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={24} />
            </button>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <Smartphone size={32} style={{ color: '#ffd700' }} />
                <h2 style={{ color: '#ffd700', margin: 0, fontSize: '1.75rem' }}>
                  App installieren
                </h2>
              </div>
              <p style={{ color: '#a0a0a0', margin: 0, fontSize: '0.95rem' }}>
                So installierst du die App auf deinem iPhone
              </p>
            </div>

            {/* Instructions */}
            <div style={{
              backgroundColor: 'rgba(255, 215, 0, 0.1)',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid rgba(255, 215, 0, 0.3)'
            }}>
              <ol style={{
                paddingLeft: '1.5rem',
                margin: 0,
                color: '#e0e0e0',
                fontSize: '1rem',
                lineHeight: '1.8'
              }}>
                <li style={{ marginBottom: '1rem' }}>
                  Tippe auf den <strong style={{ color: '#ffd700' }}>Teilen-Button</strong> (Quadrat mit Pfeil ↑) unten oder oben rechts
                </li>
                <li style={{ marginBottom: '1rem' }}>
                  Scrolle nach unten und wähle <strong style={{ color: '#ffd700' }}>"Zum Home-Bildschirm"</strong>
                </li>
                <li style={{ marginBottom: '1rem' }}>
                  Tippe oben rechts auf <strong style={{ color: '#ffd700' }}>"Hinzufügen"</strong>
                </li>
                <li>
                  Fertig! Das App-Icon 🥋 erscheint auf deinem Homescreen
                </li>
              </ol>
            </div>

            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <p style={{ color: '#a0a0a0', fontSize: '0.85rem', margin: 0 }}>
                💡 Die App funktioniert dann wie eine normale App - ohne Browser-Leiste!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Desktop/Safari Instructions Modal */}
      {showDesktopInstructions && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            padding: '1rem'
          }}
          onClick={() => setShowDesktopInstructions(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#1a1a2e',
              padding: '2rem',
              borderRadius: '16px',
              maxWidth: '600px',
              width: '100%',
              position: 'relative',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowDesktopInstructions(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#e0e0e0',
                cursor: 'pointer',
                padding: '0.5rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={24} />
            </button>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <Download size={32} style={{ color: '#ffd700' }} />
                <h2 style={{ color: '#ffd700', margin: 0, fontSize: '1.75rem' }}>
                  App installieren
                </h2>
              </div>
              <p style={{ color: '#a0a0a0', margin: 0, fontSize: '0.95rem' }}>
                So installierst du die App auf deinem Mac (Safari)
              </p>
            </div>

            {/* Instructions */}
            <div style={{
              backgroundColor: 'rgba(255, 215, 0, 0.1)',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              marginBottom: '1rem'
            }}>
              <h3 style={{ color: '#ffd700', marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>
                Option 1: Über die Adressleiste
              </h3>
              <ol style={{
                paddingLeft: '1.5rem',
                margin: 0,
                color: '#e0e0e0',
                fontSize: '1rem',
                lineHeight: '1.8'
              }}>
                <li style={{ marginBottom: '0.5rem' }}>
                  Suche in der <strong style={{ color: '#ffd700' }}>Adressleiste</strong> (oben) nach einem Icon
                </li>
                <li>
                  Klicke darauf und wähle <strong style={{ color: '#ffd700' }}>"Zum Dock hinzufügen"</strong>
                </li>
              </ol>
            </div>

            <div style={{
              backgroundColor: 'rgba(255, 215, 0, 0.1)',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid rgba(255, 215, 0, 0.3)'
            }}>
              <h3 style={{ color: '#ffd700', marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>
                Option 2: Über das Menü
              </h3>
              <ol style={{
                paddingLeft: '1.5rem',
                margin: 0,
                color: '#e0e0e0',
                fontSize: '1rem',
                lineHeight: '1.8'
              }}>
                <li style={{ marginBottom: '0.5rem' }}>
                  Klicke oben links auf <strong style={{ color: '#ffd700' }}>"Ablage"</strong> (oder "File")
                </li>
                <li>
                  Wähle <strong style={{ color: '#ffd700' }}>"Zum Dock hinzufügen"</strong> (oder "Add to Dock")
                </li>
              </ol>
            </div>

            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <p style={{ color: '#a0a0a0', fontSize: '0.85rem', margin: 0 }}>
                💡 Die App erscheint dann in deinem Dock und Launchpad - wie eine normale Mac-App!
              </p>
            </div>

            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: 'rgba(100, 149, 237, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(100, 149, 237, 0.3)',
              textAlign: 'center'
            }}>
              <p style={{ color: '#6495ED', fontSize: '0.8rem', margin: 0 }}>
                🔧 <strong>Tipp für Chrome/Edge Nutzer:</strong> Die Installation funktioniert automatisch mit einem Klick!
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PWAInstallButton;
