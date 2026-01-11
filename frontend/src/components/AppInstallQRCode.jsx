import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Download, Printer, Smartphone, QrCode } from 'lucide-react';

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
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
    }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
        backgroundColor: '#1a1a2e',
        padding: '2rem',
        borderRadius: '16px',
        maxWidth: '500px',
        width: '90%',
        position: 'relative',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
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
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
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
            <QrCode size={32} style={{ color: '#ffd700' }} />
            <h2 style={{ color: '#ffd700', margin: 0, fontSize: '1.75rem' }}>
              App QR-Code
            </h2>
          </div>
          <p style={{ color: '#a0a0a0', margin: 0, fontSize: '0.95rem' }}>
            Scanne mit deinem Smartphone
          </p>
        </div>

        {/* QR Code */}
        <div ref={qrRef} style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '1.5rem',
          border: '3px solid #ffd700',
        }}>
          <QRCodeCanvas
            value={appUrl}
            size={250}
            level="H"
            includeMargin={true}
            style={{ display: 'block' }}
          />
        </div>

        {/* Instructions */}
        <div style={{
          backgroundColor: 'rgba(255, 215, 0, 0.1)',
          padding: '1.25rem',
          borderRadius: '12px',
          border: '1px solid rgba(255, 215, 0, 0.3)',
          marginBottom: '1.5rem',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.75rem',
          }}>
            <Smartphone size={20} style={{ color: '#ffd700' }} />
            <strong style={{ color: '#ffd700', fontSize: '1rem' }}>So geht's:</strong>
          </div>
          <ol style={{
            paddingLeft: '1.5rem',
            margin: 0,
            color: '#e0e0e0',
            fontSize: '0.9rem',
            lineHeight: '1.7',
          }}>
            <li>Öffne die <strong>Kamera-App</strong> auf deinem Smartphone</li>
            <li>Scanne den <strong>QR-Code</strong> oben</li>
            <li>Tippe auf die <strong>Benachrichtigung</strong> zum Öffnen</li>
            <li>Folge den <strong>Installations-Anweisungen</strong></li>
          </ol>
        </div>

        {/* URL Display */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          textAlign: 'center',
        }}>
          <div style={{ color: '#a0a0a0', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Oder direkt öffnen:
          </div>
          <a
            href={appUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#ffd700',
              textDecoration: 'none',
              fontSize: '0.95rem',
              fontWeight: '600',
              wordBreak: 'break-all',
            }}
          >
            {appUrl}
          </a>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
        }}>
          <button
            onClick={handleDownload}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.875rem',
              background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
              color: '#0f0f23',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '600',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 215, 0, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.3)';
            }}
          >
            <Download size={20} />
            <span>Download</span>
          </button>

          <button
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.875rem',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#e0e0e0',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '10px',
              fontWeight: '600',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'background 0.2s, border-color 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
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
