import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, AlertCircle } from 'lucide-react';
import '../styles/QRCodeScanner.css';

const QRCodeScanner = ({ onScanSuccess, onClose }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [scannerReady, setScannerReady] = useState(false);

  const html5QrCodeRef = useRef(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    // Initialize camera list
    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back camera (environment facing)
          const backCamera = devices.find(device =>
            device.label.toLowerCase().includes('back') ||
            device.label.toLowerCase().includes('environment')
          );
          setSelectedCamera(backCamera ? backCamera.id : devices[0].id);
        } else {
          setError('Keine Kamera gefunden');
        }
      })
      .catch(err => {
        console.error('Kamera-Zugriff fehlgeschlagen:', err);
        setError('Kamera-Zugriff verweigert. Bitte erlaube den Kamera-Zugriff in deinen Browser-Einstellungen.');
      });

    return () => {
      stopScanning();
    };
  }, []);

  useEffect(() => {
    if (selectedCamera && !isScanning) {
      startScanning(selectedCamera);
    }
  }, [selectedCamera]);

  const startScanning = async (cameraId) => {
    if (isScanning) {
      await stopScanning();
    }

    try {
      setError(null);
      setScannerReady(false);

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader');
      }

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true
      };

      await html5QrCodeRef.current.start(
        cameraId,
        config,
        onScanSuccessHandler,
        onScanErrorHandler
      );

      setIsScanning(true);
      setScannerReady(true);
    } catch (err) {
      console.error('Scanner-Start fehlgeschlagen:', err);
      setError('Scanner konnte nicht gestartet werden: ' + err.message);
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current && isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        setIsScanning(false);
        setScannerReady(false);
      } catch (err) {
        console.error('Scanner-Stop fehlgeschlagen:', err);
      }
    }
  };

  const onScanSuccessHandler = (decodedText, decodedResult) => {
    console.log('QR Code gescannt:', decodedText);

    // Parse QR code format: DOJO_MEMBER:123:timestamp or just the member ID
    let memberId = null;

    if (decodedText.startsWith('DOJO_MEMBER:')) {
      const parts = decodedText.split(':');
      if (parts.length >= 2) {
        memberId = parts[1];
      }
    } else if (/^\d+$/.test(decodedText)) {
      // If it's just a number, assume it's the member ID
      memberId = decodedText;
    }

    if (memberId) {
      stopScanning();
      onScanSuccess(memberId, decodedText);
    } else {
      setError('Ungültiger QR-Code. Format: DOJO_MEMBER:ID oder nur die Mitglieds-ID');
      setTimeout(() => setError(null), 3000);
    }
  };

  const onScanErrorHandler = (errorMessage) => {
    // Suppress common scanning errors (happens continuously while scanning)
    // Only log actual errors, not "No QR code found"
    if (!errorMessage.includes('NotFoundException')) {
      console.warn('QR Scan Error:', errorMessage);
    }
  };

  const switchCamera = () => {
    if (cameras.length < 2) return;

    const currentIndex = cameras.findIndex(cam => cam.id === selectedCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setSelectedCamera(cameras[nextIndex].id);
  };

  const handleClose = async () => {
    await stopScanning();
    onClose();
  };

  return (
    <div className="qr-scanner-overlay">
      <div className="qr-scanner-container">
        <div className="qr-scanner-header">
          <h2>QR-Code scannen</h2>
          <button className="qr-scanner-close" onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        <div className="qr-scanner-content">
          {error && (
            <div className="qr-scanner-error">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <div className="qr-reader-wrapper">
            <div id="qr-reader" ref={scannerRef}></div>
            {!scannerReady && !error && (
              <div className="qr-scanner-loading">
                <Camera size={48} />
                <p>Kamera wird geladen...</p>
              </div>
            )}
          </div>

          {scannerReady && (
            <div className="qr-scanner-instructions">
              <p>Halte den QR-Code in den Rahmen</p>
            </div>
          )}

          {cameras.length > 1 && (
            <button
              className="qr-scanner-switch"
              onClick={switchCamera}
              disabled={!scannerReady}
            >
              <RefreshCw size={20} />
              Kamera wechseln
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRCodeScanner;
