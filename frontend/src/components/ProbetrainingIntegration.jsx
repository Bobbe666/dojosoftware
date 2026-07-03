// ============================================================================
// PROBETRAINING – WEBSITE-INTEGRATION
// Gibt dem Dojo den gebrandeten Buchungs-Link, einen QR-Code und ein
// Embed-Snippet (iframe), um Probetraining auf der eigenen Homepage anzubieten.
// Buchungen landen automatisch als Interessent im CRM.
// ============================================================================
import React, { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useDojoContext } from '../context/DojoContext';

export default function ProbetrainingIntegration() {
  const { activeDojo } = useDojoContext();
  const sub = activeDojo?.subdomain || '';
  const qrRef = useRef(null);
  const [copied, setCopied] = useState('');

  const linkSubdomain = sub ? `https://${sub}.dojo.tda-intl.org/probetraining` : '';
  const linkParam = sub ? `https://dojo.tda-intl.org/probetraining?dojo=${sub}` : '';
  const bookingUrl = linkSubdomain || linkParam;
  const embedCode = bookingUrl
    ? `<iframe src="${bookingUrl}" title="Probetraining buchen" style="width:100%;min-height:760px;border:0;border-radius:12px;" loading="lazy"></iframe>`
    : '';

  const copy = (text, key) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 2000); });
  };

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `probetraining-qr-${sub || 'dojo'}.png`;
    a.click();
  };

  if (!sub) {
    return (
      <div style={{ padding: 24, color: 'var(--ds-text,#e2e8f0)', maxWidth: 820, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>🌐 Probetraining – Website-Integration</h1>
        <div style={{ padding: 16, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 10 }}>
          Für dieses Dojo ist noch keine <strong>Subdomain</strong> hinterlegt. Bitte zuerst unter
          <em> Dojo-Verwaltung → Subdomain</em> setzen, dann erscheint hier der fertige Buchungs-Link.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, color: 'var(--ds-text,#e2e8f0)', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 6px' }}>🌐 Probetraining – Website-Integration</h1>
      <p style={{ opacity: 0.72, marginTop: 0 }}>
        Biete Probetraining auf deiner bestehenden Homepage an – per Link, QR-Code oder eingebettet.
        Jede Buchung landet automatisch als <strong>Interessent</strong> in deinem CRM.
      </p>

      {/* 1) Buchungs-Link */}
      <Box titel="1 · Buchungs-Link (zum Verlinken)">
        <p style={{ fontSize: 13.5, opacity: 0.75, marginTop: 0 }}>Setze auf deiner Homepage einen Button „Probetraining buchen" mit diesem Link:</p>
        <UrlRow url={linkSubdomain} onCopy={() => copy(linkSubdomain, 'sub')} copied={copied === 'sub'} />
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12.5, opacity: 0.7 }}>Alternative (falls die Subdomain nicht erreichbar ist)</summary>
          <UrlRow url={linkParam} onCopy={() => copy(linkParam, 'param')} copied={copied === 'param'} />
        </details>
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <a href={bookingUrl} target="_blank" rel="noreferrer" style={btn('#6366f1')}>Seite öffnen ↗</a>
        </div>
      </Box>

      {/* 2) QR-Code */}
      <Box titel="2 · QR-Code (für Flyer, Schaufenster, Social Media)">
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div ref={qrRef} style={{ background: '#fff', padding: 12, borderRadius: 12 }}>
            <QRCodeCanvas value={bookingUrl} size={150} includeMargin={false} level="M" />
          </div>
          <div>
            <p style={{ fontSize: 13.5, opacity: 0.75, marginTop: 0 }}>Interessenten scannen den Code und landen direkt auf deiner Buchungsseite.</p>
            <button onClick={downloadQr} style={btn('#22c55e')}>QR-Code herunterladen (PNG)</button>
          </div>
        </div>
      </Box>

      {/* 3) Embed */}
      <Box titel="3 · Einbetten (direkt auf deiner Homepage)">
        <p style={{ fontSize: 13.5, opacity: 0.75, marginTop: 0 }}>
          Kopiere diesen Code in deine Website (HTML-Block) – die Buchung erscheint dann <strong>direkt auf deiner Seite</strong>, der Besucher bleibt bei dir:
        </p>
        <pre style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: 12, fontSize: 12, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{embedCode}</pre>
        <button onClick={() => copy(embedCode, 'embed')} style={btn(copied === 'embed' ? '#22c55e' : '#6366f1')}>
          {copied === 'embed' ? 'Kopiert ✓' : 'Embed-Code kopieren'}
        </button>
      </Box>

      <p style={{ opacity: 0.5, fontSize: 12, marginTop: 8 }}>
        Tipp: Welche Kurse als Probetraining wählbar sind, steuerst du je Kurs über „Probetraining erlaubt" in der Kursverwaltung.
      </p>
    </div>
  );
}

function Box({ titel, children }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.7, marginBottom: 8 }}>{titel}</div>
      {children}
    </div>
  );
}

function UrlRow({ url, onCopy, copied }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
      <input readOnly value={url} onFocus={(e) => e.target.select()}
        style={{ flex: 1, minWidth: 0, padding: '9px 11px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#e2e8f0', fontSize: 13 }} />
      <button onClick={onCopy} style={btn(copied ? '#22c55e' : '#334155', true)}>{copied ? 'Kopiert ✓' : 'Kopieren'}</button>
    </div>
  );
}

const btn = (bg, sm) => ({ background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: sm ? '9px 12px' : '9px 16px', cursor: 'pointer', fontSize: sm ? 13 : 14, fontWeight: 600, textDecoration: 'none', display: 'inline-block', whiteSpace: 'nowrap' });
