import React from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import { useNavigate } from 'react-router-dom';
import './TrialBanner.css';

/**
 * TrialBanner Component
 *
 * Shows a banner when dojo is in trial period.
 * Displays days remaining and upgrade CTA.
 *
 * Usage:
 * <TrialBanner />
 */
function TrialBanner() {
  const { isTrial, getTrialDaysRemaining, isTrialExpired, subscription, getUpgradeUrl } = useSubscription();
  const navigate = useNavigate();

  // Don't show if not in trial
  if (!isTrial()) {
    return null;
  }

  const daysRemaining = getTrialDaysRemaining();
  const isExpired = isTrialExpired();

  // Determine banner style based on days remaining
  const getBannerClass = () => {
    if (isExpired) return 'trial-banner expired';
    if (daysRemaining <= 3) return 'trial-banner urgent';
    if (daysRemaining <= 7) return 'trial-banner warning';
    return 'trial-banner info';
  };

  const getMessage = () => {
    if (isExpired) {
      return 'Deine Trial-Phase ist abgelaufen';
    }
    if (daysRemaining === 0) {
      return 'Deine Trial-Phase endet heute';
    }
    if (daysRemaining === 1) {
      return 'Noch 1 Tag Trial verbleibend';
    }
    return `Noch ${daysRemaining} Tage Trial verbleibend`;
  };

  const getIcon = () => {
    if (isExpired) return '⏱️';
    if (daysRemaining <= 3) return '⚠️';
    return 'ℹ️';
  };

  return (
    <div className={getBannerClass()}>
      <div className="trial-banner-content">
        <div className="trial-icon">{getIcon()}</div>
        <div className="trial-message">
          <strong>{getMessage()}</strong>
          {!isExpired && (
            <span className="trial-details">
              Wähle jetzt einen Plan um nach dem Trial weiterzumachen
            </span>
          )}
          {isExpired && (
            <span className="trial-details">
              Bitte wähle einen Plan um DojoSoftware weiter zu nutzen
            </span>
          )}
        </div>
        <button
          className="trial-upgrade-btn"
          onClick={() => navigate(getUpgradeUrl())}
        >
          {isExpired ? 'Plan wählen' : 'Jetzt upgraden'}
        </button>
      </div>
    </div>
  );
}

export default TrialBanner;
