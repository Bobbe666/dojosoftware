import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CreditCard, Zap, Check, ChevronRight, AlertCircle,
  Star, Users, HardDrive, Building2, Sparkles, CheckCircle, XCircle
} from 'lucide-react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import './PlanUpgradeSection.css';

const PLAN_FEATURES = {
  starter: {
    name: 'Starter',
    price_monthly: 49,
    price_yearly: 490,
    color: '#3b82f6',
    features: [
      'Bis zu 100 Mitglieder',
      'Mitgliederverwaltung',
      'Check-In System',
      'SEPA-Lastschrift',
      'Grundlegende Statistiken',
      '1 GB Speicherplatz'
    ],
    limits: { members: 100, storage: '1 GB' }
  },
  professional: {
    name: 'Professional',
    price_monthly: 89,
    price_yearly: 890,
    color: '#8b5cf6',
    popular: true,
    features: [
      'Bis zu 300 Mitglieder',
      'Alles aus Starter',
      'Verkauf & Lagerhaltung',
      'Event-Verwaltung',
      'Erweiterte Statistiken',
      '5 GB Speicherplatz'
    ],
    limits: { members: 300, storage: '5 GB' }
  },
  premium: {
    name: 'Premium',
    price_monthly: 149,
    price_yearly: 1490,
    color: '#d4af37',
    features: [
      'Unbegrenzte Mitglieder',
      'Alles aus Professional',
      'Buchhaltung & EÜR',
      'API-Zugang',
      'Priority Support',
      '20 GB Speicherplatz'
    ],
    limits: { members: 'Unbegrenzt', storage: '20 GB' }
  },
  enterprise: {
    name: 'Enterprise',
    price_monthly: 249,
    price_yearly: 2490,
    color: '#ef4444',
    features: [
      'Unbegrenzte Mitglieder',
      'Alles aus Premium',
      'Multi-Dojo Support',
      'Dedizierter Support',
      'Custom Integrationen',
      '50 GB Speicherplatz'
    ],
    limits: { members: 'Unbegrenzt', storage: '50 GB' }
  }
};

const PLAN_HIERARCHY = {
  'trial': 0,
  'starter': 1,
  'professional': 2,
  'premium': 3,
  'enterprise': 4
};

const PlanUpgradeSection = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [subscription, setSubscription] = useState(null);
  const [availableUpgrades, setAvailableUpgrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [error, setError] = useState(null);
  const [upgradeSuccess, setUpgradeSuccess] = useState(null);
  const [upgradeCancelled, setUpgradeCancelled] = useState(false);

  // Handle URL params after Stripe Checkout redirect
  useEffect(() => {
    const success = searchParams.get('upgrade') === 'success' || searchParams.get('success') === 'true';
    const cancelled = searchParams.get('upgrade') === 'cancelled' || searchParams.get('cancelled') === 'true';
    const plan = searchParams.get('plan');

    if (success) {
      setUpgradeSuccess(plan ? PLAN_FEATURES[plan]?.name || plan : 'Neuer Plan');
      // Clear URL params
      searchParams.delete('upgrade');
      searchParams.delete('success');
      searchParams.delete('plan');
      searchParams.delete('session_id');
      setSearchParams(searchParams, { replace: true });
    } else if (cancelled) {
      setUpgradeCancelled(true);
      // Clear URL params
      searchParams.delete('upgrade');
      searchParams.delete('cancelled');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  useEffect(() => {
    loadSubscriptionStatus();
  }, [upgradeSuccess]);

  const loadSubscriptionStatus = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/saas-stripe/subscription-status`);
      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);
        setAvailableUpgrades(data.available_upgrades || []);
      } else {
        // Fallback: Lade aus /subscription/current
        const fallbackResponse = await fetchWithAuth(`${config.apiBaseUrl}/subscription/current`);
        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          setSubscription(data.subscription);

          // Berechne verfügbare Upgrades
          const currentPlan = data.subscription?.plan_type || 'trial';
          const upgrades = Object.keys(PLAN_HIERARCHY)
            .filter(p => PLAN_HIERARCHY[p] > PLAN_HIERARCHY[currentPlan] && PLAN_FEATURES[p])
            .map(p => ({ plan_name: p, ...PLAN_FEATURES[p] }));
          setAvailableUpgrades(upgrades);
        }
      }
    } catch (err) {
      console.error('Fehler beim Laden:', err);
      setError('Subscription-Status konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planName) => {
    setUpgrading(true);
    setError(null);

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/saas-stripe/create-upgrade-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_plan: planName,
          billing_interval: billingInterval
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Upgrade fehlgeschlagen');
      }

      // Redirect zu Stripe Checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('Keine Checkout-URL erhalten');
      }
    } catch (err) {
      console.error('Upgrade-Fehler:', err);
      setError(err.message);
    } finally {
      setUpgrading(false);
    }
  };

  const formatPrice = (monthly, yearly) => {
    if (billingInterval === 'yearly') {
      const monthlyEquivalent = (yearly / 12).toFixed(0);
      return (
        <div className="price-display">
          <span className="price-amount">€{monthlyEquivalent}</span>
          <span className="price-period">/Monat</span>
          <span className="price-billed">(€{yearly}/Jahr)</span>
          <span className="price-savings">2 Monate gratis!</span>
        </div>
      );
    }
    return (
      <div className="price-display">
        <span className="price-amount">€{monthly}</span>
        <span className="price-period">/Monat</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="plan-upgrade-section">
        <div className="loading-state">Lade Subscription-Status...</div>
      </div>
    );
  }

  const currentPlan = subscription?.plan_type || 'trial';
  const currentPlanInfo = PLAN_FEATURES[currentPlan] || {
    name: currentPlan === 'trial' ? 'Trial' : currentPlan,
    color: '#6b7280'
  };

  return (
    <div className="plan-upgrade-section">
      <div className="section-header">
        <h2><CreditCard size={24} /> Plan & Abrechnung</h2>
        <p>Verwalte dein Subscription und upgrade jederzeit</p>
      </div>

      {/* Aktueller Plan */}
      <div className="current-plan-card" style={{ borderColor: currentPlanInfo.color }}>
        <div className="current-plan-header">
          <div className="plan-badge" style={{ backgroundColor: currentPlanInfo.color }}>
            {currentPlanInfo.name || 'Trial'}
          </div>
          <span className="status-badge active">
            {subscription?.status === 'trial' ? 'Trial aktiv' : 'Aktiv'}
          </span>
        </div>

        <div className="current-plan-details">
          <div className="detail-item">
            <Users size={18} />
            <span>
              {subscription?.max_members === 999999
                ? 'Unbegrenzte Mitglieder'
                : `Bis zu ${subscription?.max_members || 50} Mitglieder`}
            </span>
          </div>
          <div className="detail-item">
            <HardDrive size={18} />
            <span>{subscription?.storage_limit_mb || 1000} MB Speicherplatz</span>
          </div>
          {subscription?.monthly_price > 0 && (
            <div className="detail-item">
              <CreditCard size={18} />
              <span>€{subscription.monthly_price}/{subscription.billing_interval === 'yearly' ? 'Jahr' : 'Monat'}</span>
            </div>
          )}
          {subscription?.trial_ends_at && (
            <div className="detail-item trial-warning">
              <AlertCircle size={18} />
              <span>Trial endet am {new Date(subscription.trial_ends_at).toLocaleDateString('de-DE')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Erfolgs-Anzeige nach Upgrade */}
      {upgradeSuccess && (
        <div className="success-banner">
          <CheckCircle size={18} />
          <div className="success-content">
            <strong>Upgrade erfolgreich!</strong>
            <span>Dein Plan wurde auf {upgradeSuccess} upgegradet. Die neuen Features sind sofort verfügbar.</span>
          </div>
          <button className="dismiss-btn" onClick={() => setUpgradeSuccess(null)}>
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* Abbruch-Anzeige */}
      {upgradeCancelled && (
        <div className="warning-banner">
          <AlertCircle size={18} />
          <div className="warning-content">
            <strong>Upgrade abgebrochen</strong>
            <span>Du kannst jederzeit zu einem höheren Plan wechseln.</span>
          </div>
          <button className="dismiss-btn" onClick={() => setUpgradeCancelled(false)}>
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* Fehler-Anzeige */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Upgrade-Optionen */}
      {availableUpgrades.length > 0 && (
        <>
          <div className="upgrade-header">
            <h3><Zap size={20} /> Upgrade verfügbar</h3>

            {/* Billing Toggle */}
            <div className="billing-toggle">
              <button
                className={billingInterval === 'monthly' ? 'active' : ''}
                onClick={() => setBillingInterval('monthly')}
              >
                Monatlich
              </button>
              <button
                className={billingInterval === 'yearly' ? 'active' : ''}
                onClick={() => setBillingInterval('yearly')}
              >
                Jährlich
                <span className="save-badge">-17%</span>
              </button>
            </div>
          </div>

          <div className="upgrade-plans-grid">
            {availableUpgrades.map(plan => {
              const planInfo = PLAN_FEATURES[plan.plan_name] || plan;
              const isPopular = planInfo.popular;

              return (
                <div
                  key={plan.plan_name}
                  className={`upgrade-plan-card ${isPopular ? 'popular' : ''}`}
                  style={{ borderColor: planInfo.color }}
                >
                  {isPopular && (
                    <div className="popular-badge">
                      <Sparkles size={14} /> Beliebt
                    </div>
                  )}

                  <div className="plan-header">
                    <h4 style={{ color: planInfo.color }}>{planInfo.name}</h4>
                    {formatPrice(
                      plan.price_monthly || planInfo.price_monthly,
                      plan.price_yearly || planInfo.price_yearly
                    )}
                  </div>

                  <ul className="plan-features">
                    {(planInfo.features || []).map((feature, idx) => (
                      <li key={idx}>
                        <Check size={16} style={{ color: planInfo.color }} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    className="btn-upgrade"
                    style={{
                      backgroundColor: planInfo.color,
                      borderColor: planInfo.color
                    }}
                    onClick={() => handleUpgrade(plan.plan_name)}
                    disabled={upgrading}
                  >
                    {upgrading ? 'Wird geladen...' : (
                      <>
                        Upgrade zu {planInfo.name}
                        <ChevronRight size={18} />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Wenn auf höchstem Plan */}
      {availableUpgrades.length === 0 && currentPlan !== 'trial' && (
        <div className="max-plan-info">
          <Star size={24} />
          <p>Du nutzt bereits den höchsten verfügbaren Plan.</p>
        </div>
      )}

      {/* Hinweis */}
      <div className="upgrade-info">
        <Building2 size={18} />
        <p>
          Alle Pläne beinhalten SSL-Verschlüsselung, DSGVO-Konformität und regelmäßige Backups.
          Bei Fragen kontaktiere uns unter <a href="mailto:support@tda-intl.org">support@tda-intl.org</a>
        </p>
      </div>
    </div>
  );
};

export default PlanUpgradeSection;
