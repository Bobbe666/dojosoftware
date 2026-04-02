import React, { useState, useEffect } from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config.js';
import './FeatureGate.css';

/**
 * FeatureGate Component
 *
 * Prüft Feature-Zugriff dynamisch (Plan, Trial, Addon).
 * Zeigt Locked-State mit Trial/Upgrade Optionen wenn kein Zugriff.
 *
 * Props:
 * - feature: Feature-Key (z.B. 'verkauf')
 * - children: Inhalt wenn Zugriff gewährt
 * - fallback: Custom Fallback Komponente
 * - showLockedPreview: Zeigt verschwommene Preview
 * - onAccessChange: Callback bei Zugriffs-Änderung
 */
function FeatureGate({
  feature,
  children,
  fallback = null,
  showUpgradePrompt = true,
  showLockedPreview = false,
  onAccessChange = null
}) {
  const { hasFeature, getFeatureName, getMinimumPlanForFeature, getPlanName, getUpgradeUrl, subscription } = useSubscription();
  const navigate = useNavigate();

  const [accessInfo, setAccessInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);

  useEffect(() => {
    checkDynamicAccess();
  }, [feature]);

  // Dynamische Zugriffsprüfung (Plan + Trial + Addon)
  const checkDynamicAccess = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/subscription/feature-access/${feature}`
      );
      const data = await response.json();
      setAccessInfo(data);

      if (onAccessChange) {
        onAccessChange(data);
      }
    } catch (error) {
      // Fallback auf statische Prüfung
      const staticAccess = hasFeature(feature);
      setAccessInfo({
        hasAccess: staticAccess,
        accessType: staticAccess ? 'plan' : 'none',
        details: { featureName: getFeatureName(feature) }
      });
    } finally {
      setLoading(false);
    }
  };

  // Trial starten
  const handleStartTrial = async () => {
    if (!accessInfo?.details?.featureId) return;

    try {
      setStartingTrial(true);
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/subscription/feature-trial/start`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ featureId: accessInfo.details.featureId })
        }
      );

      const data = await response.json();

      if (data.success) {
        await checkDynamicAccess();
        setShowModal(false);
      } else {
        alert(data.error || 'Trial konnte nicht gestartet werden');
      }
    } catch (error) {
      alert('Fehler beim Starten des Trials');
    } finally {
      setStartingTrial(false);
    }
  };

  // Loading State
  if (loading) {
    return <div className="feature-gate-loading"><div className="fg-spinner"></div></div>;
  }

  // Zugriff gewährt
  if (accessInfo?.hasAccess) {
    // Trial-Badge anzeigen
    if (accessInfo.accessType === 'trial') {
      const daysLeft = accessInfo.details?.daysRemaining || 0;
      return (
        <div className="feature-gate-trial-wrapper">
          <div className={`trial-badge ${daysLeft <= 3 ? 'expiring' : ''}`}>
            <span className="trial-icon">⏱️</span>
            <span>Trial: {daysLeft} {daysLeft === 1 ? 'Tag' : 'Tage'} verbleibend</span>
            <button className="trial-upgrade-btn" onClick={() => setShowModal(true)}>
              Upgraden
            </button>
          </div>
          {children}
          {showModal && (
            <UpgradeModal
              accessInfo={accessInfo}
              onClose={() => setShowModal(false)}
              onStartTrial={handleStartTrial}
              startingTrial={startingTrial}
              isTrial={true}
              navigate={navigate}
              getUpgradeUrl={getUpgradeUrl}
            />
          )}
        </div>
      );
    }

    // Addon-Badge anzeigen
    if (accessInfo.accessType === 'addon') {
      return (
        <div className="feature-gate-addon-wrapper">
          <div className="addon-badge">
            <span>💎</span>
            <span>Feature-Addon aktiv</span>
          </div>
          {children}
        </div>
      );
    }

    // Normaler Plan-Zugriff
    return <>{children}</>;
  }

  // Custom Fallback
  if (fallback) {
    return <>{fallback}</>;
  }

  // Kein Zugriff - Locked State
  if (showUpgradePrompt) {
    const featureName = accessInfo?.details?.featureName || getFeatureName(feature);
    const currentPlan = accessInfo?.details?.currentPlan || subscription?.plan_type || 'Trial';
    const canStartTrial = accessInfo?.details?.canStartTrial !== false && !accessInfo?.details?.hadTrialBefore;

    return (
      <div className="feature-gate-container">
        {showLockedPreview && (
          <div className="locked-preview-blur">{children}</div>
        )}

        <div className="feature-gate-card">
          <div className="feature-gate-icon">🔒</div>
          <h2>Feature nicht verfügbar</h2>
          <p className="feature-gate-message">
            <strong>{featureName}</strong> ist in deinem aktuellen Plan nicht enthalten.
          </p>

          {accessInfo?.details?.upgradeHint && (
            <p className="feature-gate-hint">{accessInfo.details.upgradeHint}</p>
          )}

          <div className="feature-gate-info">
            <div className="info-item">
              <span className="info-label">Aktueller Plan:</span>
              <span className="info-value current-plan">{getPlanName(currentPlan)}</span>
            </div>
          </div>

          <div className="feature-gate-actions">
            {/* Trial Button */}
            {canStartTrial && (
              <button className="trial-btn" onClick={() => setShowModal(true)}>
                ✨ 14 Tage kostenlos testen
              </button>
            )}

            {/* Bereits getestet Info */}
            {accessInfo?.details?.hadTrialBefore && (
              <p className="trial-used-hint">
                ⚠️ Du hast dieses Feature bereits getestet
              </p>
            )}

            {/* Upgrade Button */}
            <button className="upgrade-btn" onClick={() => setShowModal(true)}>
              🚀 Upgraden
            </button>

            {/* Addon Option */}
            {accessInfo?.details?.addonPrice?.addon_enabled && (
              <button className="addon-btn" onClick={() => setShowModal(true)}>
                💎 Als Addon ({accessInfo.details.addonPrice.monthly_price}€/Mo)
              </button>
            )}

            <button className="back-btn" onClick={() => navigate('/dashboard')}>
              Zurück zum Dashboard
            </button>
          </div>
        </div>

        {showModal && (
          <UpgradeModal
            accessInfo={accessInfo}
            onClose={() => setShowModal(false)}
            onStartTrial={handleStartTrial}
            startingTrial={startingTrial}
            navigate={navigate}
            getUpgradeUrl={getUpgradeUrl}
          />
        )}
      </div>
    );
  }

  return null;
}

// Upgrade Modal
function UpgradeModal({ accessInfo, onClose, onStartTrial, startingTrial, isTrial = false, navigate, getUpgradeUrl }) {
  const featureName = accessInfo?.details?.featureName || 'Feature';
  const availablePlans = accessInfo?.details?.availableInPlans || [];
  const addonPrice = accessInfo?.details?.addonPrice;
  const canStartTrial = !isTrial && accessInfo?.details?.canStartTrial !== false && !accessInfo?.details?.hadTrialBefore;

  return (
    <div className="upgrade-modal-overlay" onClick={onClose}>
      <div className="upgrade-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>×</button>

        <div className="modal-header">
          <div className="modal-icon">{isTrial ? '⏱️' : '🔓'}</div>
          <h2>{isTrial ? `${featureName} Trial` : `${featureName} freischalten`}</h2>
          <p>
            {isTrial
              ? `Dein Trial läuft in ${accessInfo?.details?.daysRemaining || 0} Tagen ab.`
              : `Wähle eine Option um "${featureName}" zu nutzen.`
            }
          </p>
        </div>

        <div className="modal-options">
          {/* Trial */}
          {canStartTrial && (
            <div className="option-card highlighted">
              <span className="option-badge">Empfohlen</span>
              <div className="option-icon">✨</div>
              <h3>14 Tage kostenlos testen</h3>
              <p>Keine Kreditkarte nötig</p>
              <button
                className="option-btn primary"
                onClick={onStartTrial}
                disabled={startingTrial}
              >
                {startingTrial ? 'Wird gestartet...' : 'Trial starten'}
              </button>
            </div>
          )}

          {/* Addon */}
          {addonPrice?.addon_enabled && (
            <div className="option-card">
              <div className="option-icon">💎</div>
              <h3>Als Addon kaufen</h3>
              <p className="option-price">{addonPrice.monthly_price}€<span>/Monat</span></p>
              <button className="option-btn">Addon kaufen</button>
            </div>
          )}

          {/* Plan Upgrade */}
          {availablePlans.length > 0 && (
            <div className="option-card">
              <div className="option-icon">🚀</div>
              <h3>Plan upgraden</h3>
              <div className="plan-list">
                {availablePlans.slice(0, 2).map(plan => (
                  <div key={plan.plan_name} className="plan-item">
                    <span>{plan.display_name}</span>
                    <span>{plan.price_monthly}€/Mo</span>
                  </div>
                ))}
              </div>
              <button className="option-btn" onClick={() => navigate(getUpgradeUrl())}>
                Pläne ansehen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FeatureGate;
