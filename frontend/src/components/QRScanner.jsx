import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, RefreshCw, X, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * QRScanner - QR-Code Scanner Komponente fuer Check-in
 *
 * Verwendet html5-qrcode fuer Kamera-Zugriff und QR-Code-Erkennung.
 * Optimiert fuer Mobile und Desktop.
 *
 * @param {function} onScan - Callback wenn QR-Code gescannt wird (qrData, parsedData)
 * @param {function} onClose - Callback zum Schliessen des Scanners
 * @param {boolean} isOpen - Steuert ob Scanner aktiv ist
 */
const QRScanner = ({ onScan, onClose, isOpen }) => {
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [lastScanned, setLastScanned] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);

  // Scanner initialisieren wenn geoeffnet
  useEffect(() => {
    if (isOpen) {
      initScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  // Kamera wechseln
  useEffect(() => {
    if (selectedCamera && isScanning) {
      restartWithCamera(selectedCamera);
    }
  }, [selectedCamera]);

  const initScanner = async () => {
    try {
      setError(null);

      // Verfuegbare Kameras auflisten
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        // Bevorzuge Rueckkamera (environment) fuer Mobile
        const backCamera = devices.find(d =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        );
        setSelectedCamera(backCamera?.id || devices[0].id);
        await startScanner(backCamera?.id || devices[0].id);
      } else {
        setError('Keine Kamera gefunden. Bitte erlauben Sie den Kamera-Zugriff.');
      }
    } catch (err) {
      console.error('Scanner Init Fehler:', err);
      setError(`Kamera-Zugriff fehlgeschlagen: ${err.message}`);
    }
  };

  const startScanner = async (cameraId) => {
    if (html5QrCodeRef.current) {
      await stopScanner();
    }

    try {
      const scannerId = 'qr-reader-' + Date.now();

      // Erstelle Scanner-Element wenn nicht vorhanden
      if (scannerRef.current) {
        scannerRef.current.innerHTML = '';
        const scannerDiv = document.createElement('div');
        scannerDiv.id = scannerId;
        scannerRef.current.appendChild(scannerDiv);
      }

      html5QrCodeRef.current = new Html5Qrcode(scannerId);

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false
      };

      await html5QrCodeRef.current.start(
        cameraId,
        config,
        onScanSuccess,
        onScanFailure
      );

      setIsScanning(true);
      setError(null);
    } catch (err) {
      console.error('Scanner Start Fehler:', err);
      setError(`Scanner konnte nicht gestartet werden: ${err.message}`);
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.error('Scanner Stop Fehler:', err);
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  };

  const restartWithCamera = async (cameraId) => {
    await stopScanner();
    await startScanner(cameraId);
  };

  const onScanSuccess = (decodedText, decodedResult) => {
    console.log('QR-Code gescannt:', decodedText);

    // Verhindere mehrfaches Scannen desselben Codes
    if (lastScanned === decodedText) {
      return;
    }
    setLastScanned(decodedText);

    // Parse QR-Code Daten
    const parsedData = parseQRCode(decodedText);

    if (parsedData) {
      // Vibration Feedback (falls unterstuetzt)
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }

      // Callback aufrufen
      if (onScan) {
        onScan(decodedText, parsedData);
      }

      // Nach 3 Sekunden wieder scannen erlauben
      setTimeout(() => {
        setLastScanned(null);
      }, 3000);
    } else {
      setError('Ungueltiger QR-Code. Bitte einen Mitglieder-QR-Code scannen.');
      setTimeout(() => {
        setLastScanned(null);
        setError(null);
      }, 2000);
    }
  };

  const onScanFailure = (errorMessage) => {
    // Ignoriere "No QR code found" - das ist normal
    if (!errorMessage.includes('No QR code found')) {
      console.warn('QR Scan Warnung:', errorMessage);
    }
  };

  /**
   * Parse QR-Code Daten
   * Unterstuetzte Formate:
   * - DOJO_MEMBER:{mitglied_id}:{timestamp}
   * - DOJO_MEMBER:{mitglied_id}:{name}:{email}
   */
  const parseQRCode = (data) => {
    if (!data) return null;

    // Format: DOJO_MEMBER:{mitglied_id}:{...}
    if (data.startsWith('DOJO_MEMBER:')) {
      const parts = data.split(':');
      if (parts.length >= 2) {
        const mitgliedId = parseInt(parts[1], 10);
        if (!isNaN(mitgliedId)) {
          return {
            type: 'member',
            mitglied_id: mitgliedId,
            name: parts[2] || null,
            email: parts[3] || null,
            raw: data
          };
        }
      }
    }

    // Versuche als reine Mitglieds-ID zu parsen
    const numericId = parseInt(data, 10);
    if (!isNaN(numericId) && numericId > 0) {
      return {
        type: 'member',
        mitglied_id: numericId,
        raw: data
      };
    }

    return null;
  };

  const handleClose = () => {
    stopScanner();
    if (onClose) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="qr-scanner-overlay">
      <div className="qr-scanner-modal">
        {/* Header */}
        <div className="qr-scanner-header">
          <div className="qr-scanner-title">
            <Camera size={24} />
            <span>QR-Code Scanner</span>
          </div>
          <button className="qr-scanner-close" onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        {/* Scanner Area */}
        <div className="qr-scanner-body">
          {error ? (
            <div className="qr-scanner-error">
              <AlertCircle size={48} />
              <p>{error}</p>
              <button className="btn btn-primary" onClick={initScanner}>
                <RefreshCw size={18} />
                Erneut versuchen
              </button>
            </div>
          ) : (
            <>
              <div className="qr-scanner-viewport" ref={scannerRef}>
                {!isScanning && (
                  <div className="qr-scanner-loading">
                    <div className="loading-spinner"></div>
                    <p>Kamera wird gestartet...</p>
                  </div>
                )}
              </div>

              {/* Scanner Frame Overlay */}
              {isScanning && (
                <div className="qr-scanner-frame">
                  <div className="qr-scanner-corner top-left"></div>
                  <div className="qr-scanner-corner top-right"></div>
                  <div className="qr-scanner-corner bottom-left"></div>
                  <div className="qr-scanner-corner bottom-right"></div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        <div className="qr-scanner-controls">
          {/* Kamera-Auswahl */}
          {cameras.length > 1 && (
            <div className="qr-scanner-camera-select">
              <label>Kamera:</label>
              <select
                value={selectedCamera || ''}
                onChange={(e) => setSelectedCamera(e.target.value)}
              >
                {cameras.map(camera => (
                  <option key={camera.id} value={camera.id}>
                    {camera.label || `Kamera ${camera.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Hinweise */}
          <div className="qr-scanner-hints">
            <p>Halten Sie den QR-Code des Mitglieds in den Rahmen</p>
            <p className="hint-small">Der Code wird automatisch erkannt</p>
          </div>

          {/* Success Indicator */}
          {lastScanned && (
            <div className="qr-scanner-success">
              <CheckCircle size={24} />
              <span>QR-Code erkannt!</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .qr-scanner-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .qr-scanner-modal {
          background: #1a1a1a;
          border-radius: 16px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .qr-scanner-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          background: linear-gradient(135deg, #FFD700, #FFA500);
          color: #000;
        }

        .qr-scanner-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 1.25rem;
          font-weight: 700;
        }

        .qr-scanner-close {
          background: rgba(0, 0, 0, 0.2);
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s;
        }

        .qr-scanner-close:hover {
          background: rgba(0, 0, 0, 0.3);
        }

        .qr-scanner-body {
          position: relative;
          flex: 1;
          min-height: 350px;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .qr-scanner-viewport {
          width: 100%;
          height: 100%;
        }

        .qr-scanner-viewport video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover;
        }

        .qr-scanner-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          color: #fff;
        }

        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid rgba(255, 215, 0, 0.3);
          border-top-color: #FFD700;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .qr-scanner-frame {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 250px;
          height: 250px;
          pointer-events: none;
        }

        .qr-scanner-corner {
          position: absolute;
          width: 30px;
          height: 30px;
          border-color: #FFD700;
          border-style: solid;
          border-width: 0;
        }

        .qr-scanner-corner.top-left {
          top: 0;
          left: 0;
          border-top-width: 4px;
          border-left-width: 4px;
          border-top-left-radius: 8px;
        }

        .qr-scanner-corner.top-right {
          top: 0;
          right: 0;
          border-top-width: 4px;
          border-right-width: 4px;
          border-top-right-radius: 8px;
        }

        .qr-scanner-corner.bottom-left {
          bottom: 0;
          left: 0;
          border-bottom-width: 4px;
          border-left-width: 4px;
          border-bottom-left-radius: 8px;
        }

        .qr-scanner-corner.bottom-right {
          bottom: 0;
          right: 0;
          border-bottom-width: 4px;
          border-right-width: 4px;
          border-bottom-right-radius: 8px;
        }

        .qr-scanner-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 2rem;
          color: #ef4444;
          text-align: center;
        }

        .qr-scanner-error p {
          color: #fff;
          margin: 0;
        }

        .qr-scanner-controls {
          padding: 1.5rem;
          background: #1a1a1a;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .qr-scanner-camera-select {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .qr-scanner-camera-select label {
          color: #888;
          font-size: 0.875rem;
        }

        .qr-scanner-camera-select select {
          flex: 1;
          padding: 0.5rem;
          background: #2a2a2a;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          color: #fff;
          font-size: 0.875rem;
        }

        .qr-scanner-hints {
          text-align: center;
          color: #888;
        }

        .qr-scanner-hints p {
          margin: 0.25rem 0;
        }

        .qr-scanner-hints .hint-small {
          font-size: 0.75rem;
          color: #666;
        }

        .qr-scanner-success {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 1rem;
          padding: 0.75rem;
          background: rgba(16, 185, 129, 0.2);
          border: 1px solid #10b981;
          border-radius: 8px;
          color: #10b981;
          font-weight: 600;
          animation: pulse 0.5s ease;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        /* Mobile Optimierung */
        @media (max-width: 480px) {
          .qr-scanner-modal {
            max-width: 100%;
            max-height: 100vh;
            border-radius: 0;
          }

          .qr-scanner-body {
            min-height: 60vh;
          }

          .qr-scanner-frame {
            width: 200px;
            height: 200px;
          }
        }
      `}</style>
    </div>
  );
};

export default QRScanner;
