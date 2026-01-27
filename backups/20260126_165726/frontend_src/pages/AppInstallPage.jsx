import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { ArrowLeft, Download, Printer, Smartphone, QrCode } from 'lucide-react';

const AppInstallPage = () => {
  const navigate = useNavigate();
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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%)',
      padding: '2rem',
      color: '#e0e0e0',
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
      }}>
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#e0e0e0',
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
            marginBottom: '2rem',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          <ArrowLeft size={20} />
          Zurück zum Dashboard
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <QrCode size={48} style={{ color: '#ffd700' }} />
            <h1 style={{ color: '#ffd700', margin: 0, fontSize: '2.5rem' }}>
              App QR-Code
            </h1>
          </div>
          <p style={{ color: '#a0a0a0', margin: 0, fontSize: '1.1rem' }}>
            Scanne den Code mit deinem Smartphone um die App zu installieren
          </p>
        </div>

        {/* QR Code Container */}
        <div style={{
          background: '#1a1a2e',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          marginBottom: '2rem',
        }}>
          <div ref={qrRef} style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '2rem',
            border: '3px solid #ffd700',
          }}>
            <QRCodeCanvas
              value={appUrl}
              size={300}
              level="H"
              includeMargin={true}
              style={{ display: 'block' }}
            />
          </div>

          {/* Instructions */}
          <div style={{
            backgroundColor: 'rgba(255, 215, 0, 0.1)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            marginBottom: '2rem',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}>
              <Smartphone size={24} style={{ color: '#ffd700' }} />
              <strong style={{ color: '#ffd700', fontSize: '1.2rem' }}>So geht's:</strong>
            </div>
            <ol style={{
              paddingLeft: '1.5rem',
              margin: 0,
              color: '#e0e0e0',
              fontSize: '1rem',
              lineHeight: '1.8',
            }}>
              <li>Öffne die <strong>Kamera-App</strong> auf deinem Smartphone</li>
              <li>Scanne den <strong>QR-Code</strong> oben</li>
              <li>Tippe auf die <strong>Benachrichtigung</strong> zum Öffnen</li>
              <li>Folge den <strong>Installations-Anweisungen</strong>:
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                  <li><strong>iPhone/iPad:</strong> Safari → Teilen 📤 → "Zum Home-Bildschirm"</li>
                  <li><strong>Android:</strong> Chrome → Menü ⋮ → "App installieren"</li>
                </ul>
              </li>
            </ol>
          </div>

          {/* URL Display */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            padding: '1.25rem',
            borderRadius: '8px',
            marginBottom: '2rem',
            textAlign: 'center',
          }}>
            <div style={{ color: '#a0a0a0', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Oder direkt öffnen:
            </div>
            <a
              href={appUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#ffd700',
                textDecoration: 'none',
                fontSize: '1.1rem',
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
                gap: '0.75rem',
                padding: '1rem',
                background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
                color: '#0f0f23',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '600',
                fontSize: '1rem',
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
              <span>QR-Code Download</span>
            </button>

            <button
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#e0e0e0',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                fontWeight: '600',
                fontSize: '1rem',
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
              <span>QR-Code Drucken</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppInstallPage;
