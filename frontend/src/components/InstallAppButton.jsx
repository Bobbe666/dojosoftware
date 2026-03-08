import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Chrome, QrCode } from 'lucide-react';
import '../styles/InstallAppButton.css';

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
        className="install-app-button iab-trigger-btn"
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
          className="modal-overlay iab-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="install-modal iab-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowModal(false)}
              className="iab-close-btn"
            >
              <X size={24} />
            </button>

            <h2 className="iab-modal-title">
              <Smartphone size={28} />
              App installieren
            </h2>

            {isIOS ? (
              <div>
                <p className="iab-p-mb">
                  Um die Dojosoftware-App auf deinem iPhone/iPad zu installieren:
                </p>
                <ol className="iab-ol">
                  <li>Tippe auf das <strong>Teilen-Symbol</strong> 📤 (unten in Safari)</li>
                  <li>Scrolle nach unten und wähle <strong>"Zum Home-Bildschirm"</strong></li>
                  <li>Tippe auf <strong>"Hinzufügen"</strong></li>
                </ol>
                <p className="iab-ios-hint">
                  Die App wird dann wie eine normale App auf deinem Home-Bildschirm erscheinen.
                </p>
              </div>
            ) : (
              <div>
                <p className="iab-p-mb">
                  Um die Dojosoftware-App zu installieren:
                </p>
                <ol className="iab-ol">
                  <li>Öffne das Browser-Menü (⋮ oder ⋯)</li>
                  <li>Wähle <strong>"App installieren"</strong> oder <strong>"Zum Startbildschirm hinzufügen"</strong></li>
                  <li>Bestätige die Installation</li>
                </ol>
                <div className="iab-tip-box">
                  <div className="iab-tip-header">
                    <Chrome size={20} className="u-text-accent" />
                    <strong className="u-text-accent">Empfehlung:</strong>
                  </div>
                  <p className="iab-tip-text">
                    Verwende Chrome oder Edge für die beste Erfahrung.
                    Die Installation macht die App schneller und ermöglicht Offline-Nutzung.
                  </p>
                </div>
              </div>
            )}

            <div className="iab-btn-grid">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('🔵 QR-Code Button geklickt');
                  // WICHTIG: Erst QR-Code Modal öffnen, DANN erst dieses Modal schließen
                  if (onShowQRCode) {
                    onShowQRCode();
                    console.log('✅ QR-Modal geöffnet');
                  }
                  // Modal wird automatisch durch das QR-Modal überdeckt
                  setTimeout(() => {
                    setShowModal(false);
                  }, 200);
                }}
                className="iab-qr-btn"
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
                className="iab-confirm-btn"
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
