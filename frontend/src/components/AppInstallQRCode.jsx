import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Download, Printer, Smartphone, QrCode } from 'lucide-react';
import '../styles/AppInstallQRCode.css';

const AppInstallQRCode = ({ onClose }) => {
  const qrRef = useRef(null);
  const appUrl = 'https://dojo.tda-intl.org';

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'Dojosoftware-App-QR-Code.png';
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handlePrint = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    const printWindow = window.open('', '', 'width=600,height=800');
    const imageUrl = canvas.toDataURL('image/png');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Dojosoftware App - QR-Code</title>
          <style>
            @page { margin: 2cm; }
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 2rem;
              text-align: center;
            }
            .header {
              margin-bottom: 2rem;
            }
            h1 {
              color: #0f0f23;
              margin-bottom: 0.5rem;
              font-size: 2rem;
            }
            .subtitle {
              color: #666;
              font-size: 1.1rem;
              margin-bottom: 1rem;
            }
            .qr-container {
              padding: 2rem;
              background: white;
              border: 2px solid #ffd700;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              margin-bottom: 2rem;
            }
            .qr-code {
              display: block;
              margin: 0 auto;
            }
            .instructions {
              max-width: 500px;
              text-align: left;
              margin-top: 2rem;
              padding: 1.5rem;
              background: #f9f9f9;
              border-radius: 8px;
            }
            .instructions h2 {
              color: #ffd700;
              font-size: 1.3rem;
              margin-bottom: 1rem;
            }
            .instructions ol {
              padding-left: 1.5rem;
              line-height: 1.8;
            }
            .instructions li {
              margin-bottom: 0.5rem;
            }
            .url {
              margin-top: 1rem;
              padding: 0.75rem;
              background: white;
              border: 1px solid #ddd;
              border-radius: 4px;
              font-family: monospace;
              color: #0f0f23;
              font-size: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🥋 Dojosoftware App</h1>
            <p class="subtitle">Dein persönlicher Mitgliederbereich - jetzt als App!</p>
          </div>

          <div class="qr-container">
            <img src="${imageUrl}" alt="QR-Code" class="qr-code" />
          </div>

          <div class="instructions">
            <h2>📱 So installierst du die App:</h2>
            <ol>
              <li><strong>QR-Code scannen</strong> mit der Kamera-App deines Smartphones</li>
              <li><strong>Link öffnen</strong> im Browser (Safari für iOS, Chrome für Android)</li>
              <li><strong>App installieren:</strong>
                <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                  <li><strong>iPhone/iPad:</strong> Teilen-Button 📤 → "Zum Home-Bildschirm"</li>
                  <li><strong>Android:</strong> Menü ⋮ → "App installieren"</li>
                </ul>
              </li>
            </ol>
            <div class="url">
              <strong>Oder direkt öffnen:</strong><br/>
              ${appUrl}
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="aiqr-overlay modal-overlay" onClick={onClose}>
      <div className="aiqr-modal modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className="aiqr-close-btn"
        >
          <X size={24} />
        </button>

        {/* Header */}
        <div className="aiqr-header">
          <div className="aiqr-header-row">
            <QrCode size={32} className="u-text-accent" />
            <h2 className="aiqr-title">
              App QR-Code
            </h2>
          </div>
          <p className="aiqr-subtitle">
            Scanne mit deinem Smartphone
          </p>
        </div>

        {/* QR Code */}
        <div ref={qrRef} className="aiqr-qr-wrap">
          <QRCodeCanvas
            value={appUrl}
            size={250}
            level="H"
            includeMargin={true}
            className="u-block"
          />
        </div>

        {/* Instructions */}
        <div className="aiqr-instructions">
          <div className="aiqr-instructions-header">
            <Smartphone size={20} className="u-text-accent" />
            <strong className="aiqr-instructions-title">So geht's:</strong>
          </div>
          <ol className="aiqr-instructions-list">
            <li>Öffne die <strong>Kamera-App</strong> auf deinem Smartphone</li>
            <li>Scanne den <strong>QR-Code</strong> oben</li>
            <li>Tippe auf die <strong>Benachrichtigung</strong> zum Öffnen</li>
            <li>Folge den <strong>Installations-Anweisungen</strong></li>
          </ol>
        </div>

        {/* URL Display */}
        <div className="aiqr-url-box">
          <div className="aiqr-url-label">
            Oder direkt öffnen:
          </div>
          <a
            href={appUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="aiqr-url-link"
          >
            {appUrl}
          </a>
        </div>

        {/* Action Buttons */}
        <div className="aiqr-btn-grid">
          <button
            onClick={handleDownload}
            className="aiqr-btn-download"
          >
            <Download size={20} />
            <span>Download</span>
          </button>

          <button
            onClick={handlePrint}
            className="aiqr-btn-print"
          >
            <Printer size={20} />
            <span>Drucken</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppInstallQRCode;
