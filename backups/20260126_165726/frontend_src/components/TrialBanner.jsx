import React from 'react';
import { Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import '../styles/TrialBanner.css';

/**
 * TrialBanner Component
 *
 * Shows a banner when dojo is in trial period or subscription is expiring soon.
 * Displays days remaining and contact CTA.
 *
 * Usage:
 * <TrialBanner stats={stats} />
 */
const TrialBanner = ({ stats }) => {
  // Kein Banner anzeigen wenn Super-Admin oder keine Trial-Info
  if (!stats || !stats.subscription_status) {
    return null;
  }

  const { subscription_status, trial_days_remaining, subscription_days_remaining, subscription_plan } = stats;

  // Nur bei Trial oder bald ablaufendem Abo anzeigen
  if (subscription_status === 'trial') {
    // Trial-Modus
    if (trial_days_remaining === null || trial_days_remaining < 0) {
      return null; // Sollte nicht passieren (wird auf expired gesetzt)
    }

    let bannerType = 'info';
    let icon = <Clock size={24} />;
    let message = '';
    let showButton = false;

    if (trial_days_remaining === 0) {
      bannerType = 'danger';
      icon = <AlertTriangle size={24} />;
      message = '⏰ Ihre Testphase läuft heute ab! Schließen Sie jetzt ein Abonnement ab.';
      showButton = true;
    } else if (trial_days_remaining === 1) {
      bannerType = 'danger';
      icon = <AlertTriangle size={24} />;
      message = '⏰ Ihre Testphase läuft morgen ab! Schließen Sie jetzt ein Abonnement ab.';
      showButton = true;
    } else if (trial_days_remaining <= 3) {
      bannerType = 'warning';
      icon = <AlertTriangle size={24} />;
      message = `⚠️ Ihre Testphase läuft in ${trial_days_remaining} Tagen ab. Sichern Sie sich jetzt Ihren Zugang.`;
      showButton = true;
    } else if (trial_days_remaining <= 7) {
      bannerType = 'warning';
      icon = <Clock size={24} />;
      message = `Ihre Testphase läuft noch ${trial_days_remaining} Tage.`;
      showButton = false;
    } else {
      bannerType = 'info';
      icon = <CheckCircle size={24} />;
      message = `✓ Testphase aktiv - Noch ${trial_days_remaining} Tage verbleibend.`;
      showButton = false;
    }

    return (
      <div className={`trial-banner trial-banner-${bannerType}`}>
        <div className="trial-banner-icon">{icon}</div>
        <div className="trial-banner-content">
          <div className="trial-banner-message">{message}</div>
        </div>
        {showButton && (
          <a href="mailto:abo@tda-intl.org" className="trial-banner-button">
            Jetzt Abo abschließen
          </a>
        )}
      </div>
    );
  } else if (subscription_status === 'active') {
    // Aktives Abo - nur anzeigen wenn bald ablaufend
    if (subscription_days_remaining !== null && subscription_days_remaining <= 14) {
      let bannerType = subscription_days_remaining <= 3 ? 'danger' : 'warning';
      let icon = subscription_days_remaining <= 3 ? <AlertTriangle size={24} /> : <Clock size={24} />;
      let message = subscription_days_remaining === 0
        ? '⏰ Ihr Abonnement läuft heute ab!'
        : subscription_days_remaining === 1
        ? '⏰ Ihr Abonnement läuft morgen ab!'
        : `Ihr ${subscription_plan || 'Abonnement'} läuft in ${subscription_days_remaining} Tagen ab.`;

      return (
        <div className={`trial-banner trial-banner-${bannerType}`}>
          <div className="trial-banner-icon">{icon}</div>
          <div className="trial-banner-content">
            <div className="trial-banner-message">{message}</div>
          </div>
          <a href="mailto:abo@tda-intl.org" className="trial-banner-button">
            Jetzt verlängern
          </a>
        </div>
      );
    }
  } else if (subscription_status === 'expired') {
    // Abgelaufen - sollte eigentlich auf TrialExpired Page sein
    return (
      <div className="trial-banner trial-banner-expired">
        <div className="trial-banner-icon">
          <XCircle size={24} />
        </div>
        <div className="trial-banner-content">
          <div className="trial-banner-message">❌ Ihr Zugang ist abgelaufen. Bitte schließen Sie ein Abonnement ab.</div>
        </div>
        <a href="mailto:abo@tda-intl.org" className="trial-banner-button">
          Jetzt Abo abschließen
        </a>
      </div>
    );
  }

  // Kein Banner für andere Statuswerte
  return null;
};

export default TrialBanner;
