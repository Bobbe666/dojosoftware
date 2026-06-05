import React from 'react';

// ============================================================================
// SSL-Zertifikat-Warnungen — EINE Komponente für beide Darstellungen:
//   variant="briefing"  → kompakte Liste mit Befehlen (Daily Briefing Popup)
//   variant="cockpit"   → Accordion-Alert-Bar mit Schritt-Anleitung + Refresh
// Vorher 2× inline in SuperAdminDashboard.jsx dupliziert.
// ============================================================================

const renewCommand = (cert) => cert.renewalType === 'manual'
  ? `certbot certonly --manual --preferred-challenges dns --force-renewal -d '${cert.domains}'`
  : `certbot renew --cert-name ${cert.name}`;

const sshPrefix = 'ssh -i ~/.ssh/id_ed25519_dojo_deploy -p 2222 root@dojo.tda-intl.org';

const SslWarnungen = ({ warnings = [], variant = 'cockpit', onRefresh }) => {
  if (!warnings.length) return null;

  if (variant === 'briefing') {
    return (
      <div>
        <div className="sad-trial-warning-meta">🔒 SSL-Zertifikate — Handlungsbedarf</div>
        <div className="sad2-flex-col-04">
          {warnings.map((cert, i) => {
            const isUrgent = cert.status === 'expired' || cert.status === 'critical';
            return (
              <div key={i} className={`sad-ssl-item ${isUrgent ? 'sad-ssl-item--urgent' : 'sad-ssl-item--warning'}`}>
                <div className="sad-ssl-item-header">
                  <span className="sad2-fw600">{cert.domains}</span>
                  <span className={`sad-ssl-badge ${isUrgent ? 'sad-ssl-badge--urgent' : 'sad-ssl-badge--warning'}`}>
                    {cert.status === 'expired' ? 'ABGELAUFEN' : `noch ${cert.daysLeft} Tag${cert.daysLeft !== 1 ? 'e' : ''}`}
                  </span>
                </div>
                <div className="sad-ssl-item-type">
                  {cert.renewalType === 'manual' ? '⚠️ Manuell erneuern (DNS-Challenge)' : '✅ Auto-Renewal (nginx) — läuft automatisch'}
                </div>
                <div className="sad-ssl-cmd-block">
                  <code className="sad-ssl-cmd">{sshPrefix} "{renewCommand(cert)}"</code>
                  {cert.renewalType === 'manual' && (
                    <div className="sad-ssl-dns-hint">
                      Dann: Bei <strong>Alfahosting → DNS-System → Zonendatei importieren</strong>:<br/>
                      <code style={{fontSize:'0.82em', display:'block', marginTop:'0.3rem', wordBreak:'break-all'}}>_acme-challenge.{cert.domains.replace('*.', '').replace('tda-intl.org', 'dojo')} IN TXT "[Wert]"</code>
                      Warten bis DNS propagiert (<code>dig TXT _acme-challenge.{cert.domains.replace('*.', '')} @8.8.8.8 +short</code>), dann Enter drücken.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // variant === 'cockpit'
  return (
    <div className="sad-ssl-alert-bar">
      <div className="sad-ssl-alert-bar-header">
        <span>🔒 SSL-Zertifikate — Handlungsbedarf ({warnings.length})</span>
        {onRefresh && (
          <button className="sad-ssl-refresh-btn" onClick={onRefresh}>↺ Aktualisieren</button>
        )}
      </div>
      {warnings.map((cert, i) => {
        const isUrgent = cert.status === 'expired' || cert.status === 'critical';
        const renewCmd = renewCommand(cert);
        return (
          <details key={i} className={`sad-ssl-alert-item ${isUrgent ? 'sad-ssl-alert-item--urgent' : 'sad-ssl-alert-item--warning'}`}>
            <summary className="sad-ssl-alert-summary">
              <span className={`sad-ssl-dot ${isUrgent ? 'sad-ssl-dot--urgent' : 'sad-ssl-dot--warning'}`} />
              <span className="sad2-fw600">{cert.domains}</span>
              <span className="sad-ssl-alert-days">
                {cert.status === 'expired' ? 'ABGELAUFEN' : `läuft in ${cert.daysLeft} Tag${cert.daysLeft !== 1 ? 'en' : ''} ab`}
                {' '}· {cert.renewalType === 'manual' ? 'Manuell' : 'Auto'}
              </span>
            </summary>
            <div className="sad-ssl-alert-body">
              {cert.renewalType === 'manual' ? (
                <>
                  <p className="sad-ssl-step"><strong>1.</strong> SSH-Befehl auf dem Server ausführen:</p>
                  <code className="sad-ssl-cmd">{sshPrefix} "{renewCmd}"</code>
                  <p className="sad-ssl-step"><strong>2.</strong> Certbot zeigt einen TXT-Record-Wert an. Bei <strong>Alfahosting → DNS-System → Zonendatei importieren</strong> einfügen:</p>
                  <code className="sad-ssl-cmd">_acme-challenge.{cert.domains.replace('*.', '').replace('tda-intl.org', 'dojo')} IN TXT "[Wert von certbot]"</code>
                  <p className="sad-ssl-step" style={{fontSize:'0.85em', color:'var(--text-muted, #aaa)', marginTop:'-0.5rem'}}>Falls der alte _acme-challenge-Eintrag noch existiert: zuerst löschen (Mülleimer), dann Speichern, dann Zonendatei importieren.</p>
                  <p className="sad-ssl-step"><strong>3.</strong> DNS-Propagation prüfen (ca. 1–5 Min.):<br/><code style={{fontSize:'0.85em'}}>dig TXT _acme-challenge.{cert.domains.replace('*.', '')} @8.8.8.8 +short</code></p>
                  <p className="sad-ssl-step"><strong>4.</strong> Erst wenn der neue Wert erscheint → im Terminal <strong>Enter</strong> drücken.</p>
                  <p className="sad-ssl-step"><strong>5.</strong> Nginx neu laden: <code>systemctl reload nginx</code></p>
                </>
              ) : (
                <>
                  <p className="sad-ssl-step">Wird automatisch erneuert (certbot.timer läuft täglich). Bei Problemen manuell anstoßen:</p>
                  <code className="sad-ssl-cmd">{sshPrefix} "{renewCmd}"</code>
                </>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
};

export default SslWarnungen;
