import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, X, QrCode } from 'lucide-react';
import '../styles/MemberQRCode.css';

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
      <div className="modal-content mqr-modal-content">
        <div className="modal-header">
          <h2 className="u-flex-row-sm">
            <QrCode size={24} />
            Mein QR-Code
          </h2>
          <button onClick={onClose} className="close-button">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body mqr-modal-body">
          <div className="mqr-card">
            <h3 className="mqr-member-name">
              {memberData.vorname} {memberData.nachname}
            </h3>

            <div ref={qrRef} className="mqr-qr-wrap">
              <QRCodeCanvas
                value={qrData}
                size={250}
                level="H"
                includeMargin={true}
                fgColor="#0f0f23"
                bgColor="#ffffff"
              />
            </div>

            <div className="mqr-info-text">
              <div className="mqr-info-row">
                <strong className="u-text-accent">Mitglieds-ID:</strong> {memberData.mitglied_id}
              </div>
              {memberData.email && (
                <div className="mqr-info-row">
                  <strong className="u-text-accent">Email:</strong> {memberData.email}
                </div>
              )}
            </div>
          </div>

          <div className="mqr-hint-box">
            <strong className="u-text-accent">💡 Verwendung:</strong><br/>
            Zeige diesen QR-Code beim Check-in vor oder scanne ihn selbst in der App.
          </div>

          <div className="mqr-btn-grid">
            <button
              onClick={handleDownload}
              className="btn btn-primary mqr-btn-action"
            >
              <Download size={20} />
              Herunterladen
            </button>

            <button
              onClick={handlePrint}
              className="btn btn-secondary mqr-btn-print"
            >
              🖨️ Drucken
            </button>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary mqr-btn-close"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemberQRCode;
