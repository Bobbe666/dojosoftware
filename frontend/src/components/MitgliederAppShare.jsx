import React, { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Printer, Copy, Check, ExternalLink, Smartphone } from 'lucide-react';

/**
 * Teilbares "Mitglieder-App"-Panel pro Dojo.
 * Zeigt die Subdomain-URL, einen QR-Code (Download/Druck) und einen
 * fertigen Mitglieder-Text zum Kopieren. Läuft unter dem bestehenden
 * *.dojo.tda-intl.org-Wildcard – keine eigene Domain nötig.
 */
const MitgliederAppShare = ({ subdomain, dojoName }) => {
  const qrRef = useRef(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  if (!subdomain) {
    return (
      <div className="de-probetraining-empty">
        <p>Keine Subdomain konfiguriert.</p>
        <p className="de-probetraining-empty-hint">
          Sobald eine Subdomain für dieses Dojo eingerichtet ist, erscheint hier der teilbare App-Link inkl. QR-Code.
        </p>
      </div>
    );
  }

  const name = dojoName || 'Deinem Dojo';
  const appUrl = `https://${subdomain}.dojo.tda-intl.org`;

  const memberText =
`📱 Deine Mitglieder-App von ${name}

So hast du deinen Mitgliederbereich immer dabei:
1. Öffne diesen Link: ${appUrl}
2. Melde dich mit deinen Zugangsdaten an
3. Füge die Seite zum Home-Bildschirm hinzu:
   • iPhone (Safari): Teilen-Symbol → „Zum Home-Bildschirm"
   • Android (Chrome): Menü ⋮ → „App installieren"

Fertig – ab jetzt startest du die App direkt vom Handy. 🥋`;

  const copy = async (value, setFlag) => {
    try {
      await navigator.clipboard.writeText(value);
      setFlag(true);
      setTimeout(() => setFlag(false), 2000);
    } catch (_) {
      /* Clipboard nicht verfügbar – still ignorieren */
    }
  };

  const safeName = (name || 'Dojo').replace(/[^\wäöüÄÖÜß -]/g, '').trim() || 'Dojo';

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `Mitglieder-App-${safeName}-QR.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handlePrint = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const imageUrl = canvas.toDataURL('image/png');
    const w = window.open('', '', 'width=600,height=800');
    w.document.write(`
      <!DOCTYPE html><html><head><title>Mitglieder-App – ${name}</title>
      <style>
        @page { margin: 2cm; }
        body { font-family: Arial, sans-serif; display:flex; flex-direction:column; align-items:center; text-align:center; padding:2rem; }
        h1 { color:#0f0f23; margin:0 0 .25rem; font-size:1.9rem; }
        .subtitle { color:#666; font-size:1.1rem; margin-bottom:1.5rem; }
        .qr { padding:1.5rem; background:#fff; border:2px solid #ffd700; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,.1); }
        .steps { max-width:480px; text-align:left; margin-top:2rem; padding:1.25rem 1.5rem; background:#f9f9f9; border-radius:8px; }
        .steps h2 { color:#c79a00; font-size:1.2rem; margin:0 0 .75rem; }
        .steps ol { padding-left:1.25rem; line-height:1.7; margin:0; }
        .url { margin-top:1.25rem; padding:.7rem 1rem; background:#fff; border:1px solid #ddd; border-radius:6px; font-family:monospace; font-size:1rem; color:#0f0f23; }
      </style></head><body>
        <h1>🥋 ${name}</h1>
        <div class="subtitle">Deine Mitglieder-App – jetzt aufs Handy</div>
        <div class="qr"><img src="${imageUrl}" alt="QR-Code" /></div>
        <div class="steps">
          <h2>📱 So geht's:</h2>
          <ol>
            <li><strong>QR-Code scannen</strong> mit der Kamera deines Smartphones</li>
            <li><strong>Anmelden</strong> mit deinen Zugangsdaten</li>
            <li><strong>Zum Home-Bildschirm hinzufügen</strong> (iPhone: Teilen → „Zum Home-Bildschirm"; Android: Menü ⋮ → „App installieren")</li>
          </ol>
          <div class="url">${appUrl}</div>
        </div>
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 250);
  };

  return (
    <div className="de-probetraining-box">
      <label className="de-probetraining-label">App-Link für Ihre Mitglieder:</label>
      <div className="de-probetraining-url-row">
        <input type="text" readOnly value={appUrl} className="de-probetraining-input" />
        <button
          type="button"
          onClick={() => copy(appUrl, setCopiedUrl)}
          className={copiedUrl ? 'de-copy-btn--copied' : 'de-copy-btn'}
        >
          {copiedUrl ? '✓ Kopiert!' : '📋 Kopieren'}
        </button>
      </div>

      <div className="de-probetraining-links-grid">
        <a href={appUrl} target="_blank" rel="noopener noreferrer" className="de-probetraining-link">
          <ExternalLink size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />Link öffnen
        </a>
      </div>

      {/* QR-Code + Aktionen */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center', marginTop: '1.25rem' }}>
        <div
          ref={qrRef}
          style={{ background: '#fff', padding: 12, borderRadius: 12, border: '2px solid #ffd700', lineHeight: 0 }}
        >
          <QRCodeCanvas value={appUrl} size={180} level="H" includeMargin={true} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
          <p className="de-text-secondary-no-margin" style={{ maxWidth: 260 }}>
            <Smartphone size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            QR-Code zum Aushängen im Dojo, für Flyer oder die Anmeldung.
          </p>
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={handleDownload} className="de-probetraining-link" style={{ cursor: 'pointer' }}>
              <Download size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />QR herunterladen
            </button>
            <button type="button" onClick={handlePrint} className="de-probetraining-link" style={{ cursor: 'pointer' }}>
              <Printer size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />Drucken
            </button>
          </div>
        </div>
      </div>

      {/* Fertiger Mitglieder-Text */}
      <div style={{ marginTop: '1.25rem' }}>
        <label className="de-probetraining-label">Fertiger Text für Ihre Mitglieder (WhatsApp/E-Mail):</label>
        <textarea
          readOnly
          value={memberText}
          rows={9}
          className="de-probetraining-input"
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, marginTop: 6 }}
        />
        <div className="de-probetraining-links-grid" style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={() => copy(memberText, setCopiedText)}
            className="de-probetraining-link"
            style={{ cursor: 'pointer' }}
          >
            {copiedText
              ? <><Check size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />Text kopiert!</>
              : <><Copy size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />Text kopieren</>}
          </button>
        </div>
      </div>

      <div className="de-tip-box" style={{ marginTop: '1.25rem' }}>
        <h4 className="de-heading-success">💡 Tipp</h4>
        <p className="de-text-secondary-no-margin">
          Einmal „Zum Home-Bildschirm" hinzugefügt, startet die App als eigenes Icon – die lange Adresse
          sehen Ihre Mitglieder danach nie wieder.
        </p>
      </div>
    </div>
  );
};

export default MitgliederAppShare;
