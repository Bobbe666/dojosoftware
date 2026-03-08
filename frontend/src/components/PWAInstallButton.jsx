import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import './PWAInstallButton.css';

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
      <div onClick={handleInstallClick} className="pwa-install-tile">
        <Download size={20} className="u-text-accent" />
        <span className="pwa-install-label">
          App installieren
        </span>
        {isIOS && (
          <span className="pwa-install-sublabel">
            Anleitung anzeigen
          </span>
        )}
      </div>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="pwa-overlay" onClick={() => setShowIOSInstructions(false)}>
          <div onClick={(e) => e.stopPropagation()} className="pwa-modal pwa-modal--ios">
            {/* Close Button */}
            <button onClick={() => setShowIOSInstructions(false)} className="pwa-modal-close">
              <X size={24} />
            </button>

            {/* Header */}
            <div className="pwa-modal-header">
              <div className="pwa-modal-header-icon-row">
                <Smartphone size={32} className="u-text-accent" />
                <h2 className="pwa-modal-title">
                  App installieren
                </h2>
              </div>
              <p className="pwa-modal-subtitle">
                So installierst du die App auf deinem iPhone
              </p>
            </div>

            {/* Instructions */}
            <div className="pwa-instruction-box">
              <ol className="pwa-instruction-list">
                <li>
                  Tippe auf den <strong className="u-text-accent">Teilen-Button</strong> (Quadrat mit Pfeil ↑) unten oder oben rechts
                </li>
                <li>
                  Scrolle nach unten und wähle <strong className="u-text-accent">"Zum Home-Bildschirm"</strong>
                </li>
                <li>
                  Tippe oben rechts auf <strong className="u-text-accent">"Hinzufügen"</strong>
                </li>
                <li>
                  Fertig! Das App-Icon 🥋 erscheint auf deinem Homescreen
                </li>
              </ol>
            </div>

            <div className="pwa-tip-box">
              <p className="pwa-tip-text">
                💡 Die App funktioniert dann wie eine normale App - ohne Browser-Leiste!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Desktop/Safari Instructions Modal */}
      {showDesktopInstructions && (
        <div className="pwa-overlay" onClick={() => setShowDesktopInstructions(false)}>
          <div onClick={(e) => e.stopPropagation()} className="pwa-modal pwa-modal--desktop">
            {/* Close Button */}
            <button onClick={() => setShowDesktopInstructions(false)} className="pwa-modal-close">
              <X size={24} />
            </button>

            {/* Header */}
            <div className="pwa-modal-header">
              <div className="pwa-modal-header-icon-row">
                <Download size={32} className="u-text-accent" />
                <h2 className="pwa-modal-title">
                  App installieren
                </h2>
              </div>
              <p className="pwa-modal-subtitle">
                So installierst du die App auf deinem Mac (Safari)
              </p>
            </div>

            {/* Instructions */}
            <div className="pwa-instruction-box pwa-instruction-box--mb">
              <h3 className="pwa-instruction-box-title">
                Option 1: Über die Adressleiste
              </h3>
              <ol className="pwa-instruction-list pwa-instruction-list--half-gap">
                <li>
                  Suche in der <strong className="u-text-accent">Adressleiste</strong> (oben) nach einem Icon
                </li>
                <li>
                  Klicke darauf und wähle <strong className="u-text-accent">"Zum Dock hinzufügen"</strong>
                </li>
              </ol>
            </div>

            <div className="pwa-instruction-box">
              <h3 className="pwa-instruction-box-title">
                Option 2: Über das Menü
              </h3>
              <ol className="pwa-instruction-list pwa-instruction-list--half-gap">
                <li>
                  Klicke oben links auf <strong className="u-text-accent">"Ablage"</strong> (oder "File")
                </li>
                <li>
                  Wähle <strong className="u-text-accent">"Zum Dock hinzufügen"</strong> (oder "Add to Dock")
                </li>
              </ol>
            </div>

            <div className="pwa-tip-box">
              <p className="pwa-tip-text">
                💡 Die App erscheint dann in deinem Dock und Launchpad - wie eine normale Mac-App!
              </p>
            </div>

            <div className="pwa-chrome-tip">
              <p className="pwa-chrome-tip-text">
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
