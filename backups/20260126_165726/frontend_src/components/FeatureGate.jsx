import React from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import { useNavigate } from 'react-router-dom';
import './FeatureGate.css';

/**
 * FeatureGate Component
 *
 * Conditionally renders children based on subscription feature access.
 * Shows upgrade prompt if feature is not available.
 *
 * Usage:
 * <FeatureGate feature="verkauf" fallback={<div>Upgrade required</div>}>
 *   <VerkaufComponent />
 * </FeatureGate>
 */
function FeatureGate({ feature, children, fallback = null, showUpgradePrompt = true }) {
  const { hasFeature, getFeatureName, getMinimumPlanForFeature, getPlanName, getUpgradeUrl, subscription } = useSubscription();
  const navigate = useNavigate();

  // If feature is available, render children
  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  // If custom fallback is provided, use it
  if (fallback) {
    return <>{fallback}</>;
  }

  // Show upgrade prompt by default
  if (showUpgradePrompt) {
    const minimumPlan = getMinimumPlanForFeature(feature);
    const featureName = getFeatureName(feature);
    const planName = getPlanName(minimumPlan);

    return (
      <div className="feature-gate-container">
        <div className="feature-gate-card">
          <div className="feature-gate-icon">🔒</div>
          <h2>Feature nicht verfügbar</h2>
          <p className="feature-gate-message">
            <strong>{featureName}</strong> ist in deinem aktuellen Plan nicht enthalten.
          </p>

          <div className="feature-gate-info">
            <div className="info-item">
              <span className="info-label">Aktueller Plan:</span>
              <span className="info-value current-plan">{getPlanName(subscription?.plan_type)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Benötigt mindestens:</span>
              <span className="info-value required-plan">{planName}</span>
            </div>
          </div>

          <button
            className="upgrade-btn"
            onClick={() => navigate(getUpgradeUrl())}
          >
            Jetzt upgraden
          </button>

          <button
            className="back-btn"
            onClick={() => navigate('/dashboard')}
          >
            Zurück zum Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Don't render anything if no upgrade prompt
  return null;
}

export default FeatureGate;
