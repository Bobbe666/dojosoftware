import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone
      || document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    // Listen for install prompt (Android/Desktop)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Show prompt after 30 seconds if not dismissed before
      setTimeout(() => {
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (!dismissed && !standalone) {
          setShowPrompt(true);
        }
      }, 30000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('PWA installed');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
      border: '2px solid #ffd700',
      borderRadius: '16px 16px 0 0',
      padding: '1.5rem',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
      zIndex: 10000,
      animation: 'slideUp 0.3s ease-out'
    }}>
      <button
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.6)',
          cursor: 'pointer'
        }}
      >
        <X size={24} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <Smartphone size={48} color="#ffd700" />
        <div>
          <h3 style={{ color: '#ffd700', margin: 0, fontSize: '1.2rem' }}>
            App installieren
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.8)', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
            {isIOS
              ? 'Tippe auf "Teilen" und dann "Zum Home-Bildschirm"'
              : 'Installiere die App für schnellen Zugriff'
            }
          </p>
        </div>
      </div>

      {!isIOS && (
        <button
          onClick={handleInstall}
          style={{
            width: '100%',
            padding: '1rem',
            background: 'linear-gradient(135deg, #ffd700, #ff6b35)',
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
        >
          <Download size={20} />
          Jetzt installieren
        </button>
      )}

      {isIOS && (
        <div style={{
          padding: '1rem',
          background: 'rgba(255,215,0,0.1)',
          borderRadius: '8px',
          fontSize: '0.85rem',
          color: 'rgba(255,255,255,0.9)',
          lineHeight: '1.5'
        }}>
          <strong>So installierst du die App:</strong><br/>
          1. Tippe auf das <strong>Teilen-Symbol</strong> (Pfeil nach oben)<br/>
          2. Scrolle nach unten und tippe auf <strong>"Zum Home-Bildschirm"</strong><br/>
          3. Tippe auf <strong>"Hinzufügen"</strong>
        </div>
      )}
    </div>
  );
};

export default PWAInstallPrompt;
