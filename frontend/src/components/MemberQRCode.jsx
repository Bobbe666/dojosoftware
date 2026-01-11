import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, X, QrCode } from 'lucide-react';

const MemberQRCode = ({ memberData, onClose }) => {
  const qrRef = useRef(null);

  if (!memberData) return null;

  // QR-Code Daten: DOJO_MEMBER:ID:Name:Email
  const qrData = `DOJO_MEMBER:${memberData.mitglied_id}:${memberData.vorname} ${memberData.nachname}:${memberData.email || 'keine-email'}`;

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    // Canvas zu Blob konvertieren und downloaden
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `QR-Code-${memberData.vorname}-${memberData.nachname}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handlePrint = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR-Code - ${memberData.vorname} ${memberData.nachname}</title>
          <style>
            body {
              margin: 0;
              padding: 40px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              font-family: Arial, sans-serif;
              background: white;
            }
            .qr-container {
              text-align: center;
              border: 3px solid #ffd700;
              padding: 40px;
              border-radius: 16px;
              background: linear-gradient(135deg, #1a1a2e, #16213e);
            }
            h1 {
              color: #ffd700;
              margin: 0 0 10px 0;
              font-size: 32px;
            }
            h2 {
              color: #fff;
              margin: 0 0 30px 0;
              font-size: 24px;
              font-weight: normal;
            }
            img {
              display: block;
              margin: 0 auto 30px;
              background: white;
              padding: 20px;
              border-radius: 12px;
            }
            .info {
              color: rgba(255, 255, 255, 0.9);
              font-size: 16px;
              line-height: 1.6;
            }
            .info-item {
              margin: 10px 0;
            }
            .label {
              color: #ffd700;
              font-weight: bold;
            }
            @media print {
              body { background: white; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <h1>🥋 Dojo Check-in QR-Code</h1>
            <h2>${memberData.vorname} ${memberData.nachname}</h2>
            <img src="${dataUrl}" alt="QR Code" />
            <div class="info">
              <div class="info-item">
                <span class="label">Mitglieds-ID:</span> ${memberData.mitglied_id}
              </div>
              ${memberData.email ? `
                <div class="info-item">
                  <span class="label">Email:</span> ${memberData.email}
                </div>
              ` : ''}
              ${memberData.geburtsdatum ? `
                <div class="info-item">
                  <span class="label">Geburtsdatum:</span> ${new Date(memberData.geburtsdatum).toLocaleDateString('de-DE')}
                </div>
              ` : ''}
              <div class="info-item" style="margin-top: 20px; font-size: 14px; color: rgba(255,255,255,0.7);">
                Scannen Sie diesen QR-Code beim Check-in
              </div>
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    // Warte kurz, dann drucke
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <QrCode size={24} />
            Mein QR-Code
          </h2>
          <button onClick={onClose} className="close-button">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            padding: '2rem',
            borderRadius: '16px',
            border: '3px solid #ffd700',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{
              color: '#ffd700',
              marginTop: 0,
              marginBottom: '1rem',
              fontSize: '1.5rem'
            }}>
              {memberData.vorname} {memberData.nachname}
            </h3>

            <div ref={qrRef} style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '12px',
              display: 'inline-block',
              marginBottom: '1rem'
            }}>
              <QRCodeCanvas
                value={qrData}
                size={250}
                level="H"
                includeMargin={true}
                fgColor="#0f0f23"
                bgColor="#ffffff"
              />
            </div>

            <div style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '0.9rem',
              lineHeight: '1.6'
            }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong style={{ color: '#ffd700' }}>Mitglieds-ID:</strong> {memberData.mitglied_id}
              </div>
              {memberData.email && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#ffd700' }}>Email:</strong> {memberData.email}
                </div>
              )}
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 215, 0, 0.1)',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            color: '#666'
          }}>
            <strong style={{ color: '#ffd700' }}>💡 Verwendung:</strong><br/>
            Zeige diesen QR-Code beim Check-in vor oder scanne ihn selbst in der App.
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem'
          }}>
            <button
              onClick={handleDownload}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.875rem 1rem'
              }}
            >
              <Download size={20} />
              Herunterladen
            </button>

            <button
              onClick={handlePrint}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.875rem 1rem',
                background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 107, 53, 0.2))',
                border: '2px solid #ffd700',
                color: '#ffd700'
              }}
            >
              🖨️ Drucken
            </button>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              width: '100%',
              marginTop: '1rem'
            }}
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemberQRCode;
