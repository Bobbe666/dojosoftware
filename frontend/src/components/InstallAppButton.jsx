import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Chrome, QrCode } from 'lucide-react';

const InstallAppButton = ({ onShowQRCode }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Prüfe ob iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Prüfe ob bereits installiert (PWA läuft im Standalone-Modus)
    const installed = window.matchMedia('(display-mode: standalone)').matches;
    setIsInstalled(installed);

    // beforeinstallprompt Event für Android/Desktop
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('📱 Install-Prompt verfügbar');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      // Zeige iOS-Anleitung
      setShowModal(true);
      return;
    }

    if (!deferredPrompt) {
      // Zeige allgemeine Anleitung
      setShowModal(true);
      return;
    }

    // Android/Desktop: Zeige nativen Install-Dialog
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`📱 User-Auswahl: ${outcome}`);

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      alert('✅ App erfolgreich installiert!');
    }
  };

  // Wenn bereits installiert, zeige keinen Button
  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleInstallClick();
        }}
        className="install-app-button"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.3rem',
          width: '100%',
          minHeight: '60px',
          padding: '0.8rem',
          background: 'transparent',
          color: '#ffd700',
          border: 'none',
          fontWeight: '600',
          fontSize: '0.85rem',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <Download size={20} />
        <span>App installieren</span>
      </button>

      {showModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="install-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#1a1a2e',
              padding: '2rem',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '90%',
              color: '#e0e0e0',
              position: 'relative',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
            }}
          >
            <button
              onClick={() => setShowModal(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                color: '#e0e0e0',
                cursor: 'pointer',
                padding: '0.25rem',
              }}
            >
              <X size={24} />
            </button>

            <h2 style={{
              color: '#ffd700',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <Smartphone size={28} />
              App installieren
            </h2>

            {isIOS ? (
              <div>
                <p style={{ marginBottom: '1rem' }}>
                  Um die Dojosoftware-App auf deinem iPhone/iPad zu installieren:
                </p>
                <ol style={{
                  paddingLeft: '1.5rem',
                  lineHeight: '1.8',
                  marginBottom: '1rem',
                }}>
                  <li>Tippe auf das <strong>Teilen-Symbol</strong> 📤 (unten in Safari)</li>
                  <li>Scrolle nach unten und wähle <strong>"Zum Home-Bildschirm"</strong></li>
                  <li>Tippe auf <strong>"Hinzufügen"</strong></li>
                </ol>
                <p style={{
                  fontSize: '0.9rem',
                  color: '#a0a0a0',
                  marginTop: '1rem',
                }}>
                  Die App wird dann wie eine normale App auf deinem Home-Bildschirm erscheinen.
                </p>
              </div>
            ) : (
              <div>
                <p style={{ marginBottom: '1rem' }}>
                  Um die Dojosoftware-App zu installieren:
                </p>
                <ol style={{
                  paddingLeft: '1.5rem',
                  lineHeight: '1.8',
                  marginBottom: '1rem',
                }}>
                  <li>Öffne das Browser-Menü (⋮ oder ⋯)</li>
                  <li>Wähle <strong>"App installieren"</strong> oder <strong>"Zum Startbildschirm hinzufügen"</strong></li>
                  <li>Bestätige die Installation</li>
                </ol>
                <div style={{
                  backgroundColor: 'rgba(255, 215, 0, 0.1)',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  marginTop: '1rem',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.5rem',
                  }}>
                    <Chrome size={20} style={{ color: '#ffd700' }} />
                    <strong style={{ color: '#ffd700' }}>Empfehlung:</strong>
                  </div>
                  <p style={{ fontSize: '0.9rem', margin: 0 }}>
                    Verwende Chrome oder Edge für die beste Erfahrung.
                    Die Installation macht die App schneller und ermöglicht Offline-Nutzung.
                  </p>
                </div>
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginTop: '1.5rem',
            }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowModal(false);
                  setTimeout(() => {
                    if (onShowQRCode) {
                      onShowQRCode();
                    }
                  }, 100);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255, 215, 0, 0.15)',
                  color: '#ffd700',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 215, 0, 0.25)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 215, 0, 0.15)';
                }}
              >
                <QrCode size={18} />
                QR-Code
              </button>

              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
                  color: '#0f0f23',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Verstanden
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallAppButton;
