import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import config from '../config';

const SubscriptionContext = createContext();

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider = ({ children }) => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load subscription on mount
  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    // Token-Key ist 'dojo_auth_token' (nicht 'token') — Interceptor in main.jsx setzt Auth-Header
    const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`/subscription/current`);

      // Backend gibt { subscription: {...}, trial_days_left, current_members, ... } zurück
      // → flach speichern damit hasFeature direkt auf Felder zugreifen kann
      const raw = response.data;
      const sub = raw.subscription
        ? { ...raw.subscription, _current_members: raw.current_members, _trial_days_left: raw.trial_days_left }
        : raw;
      setSubscription(sub);
      setError(null);
    } catch (err) {
      // 403 = nicht authentifiziert, kein echter Fehler für öffentliche Seiten
      if (err.response?.status !== 403) {
        console.error('Failed to load subscription:', err);
        setError(err.response?.data?.error || 'Fehler beim Laden der Subscription');
      }
    } finally {
      setLoading(false);
    }
  };

  // Check if a specific feature is available
  const hasFeature = (featureName) => {
    if (!subscription) return false;

    // Check subscription status
    if (!['active', 'trial'].includes(subscription.status)) {
      return false;
    }

    // Check feature flag — MySQL TINYINT gibt 0/1 zurück, kein Boolean
    const featureKey = `feature_${featureName}`;
    return !!subscription[featureKey];
  };

  // Check if trial is active
  const isTrial = () => {
    return subscription?.status === 'trial';
  };

  // Check if trial has expired
  const isTrialExpired = () => {
    if (!subscription || !subscription.trial_ends_at) return false;
    return new Date(subscription.trial_ends_at) < new Date();
  };

  // Get days remaining in trial
  const getTrialDaysRemaining = () => {
    if (!subscription || !subscription.trial_ends_at) return 0;
    const endDate = new Date(subscription.trial_ends_at);
    const now = new Date();
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Check if subscription is active (including trial)
  const isActive = () => {
    return ['active', 'trial'].includes(subscription?.status);
  };

  // Check if at member limit
  const isAtMemberLimit = () => {
    if (!subscription) return false;
    return subscription.current_member_count >= subscription.max_members;
  };

  // Get upgrade URL
  const getUpgradeUrl = () => {
    return '/dashboard/subscription';
  };

  // Get feature display name
  const getFeatureName = (featureName) => {
    const featureNames = {
      verkauf: 'Verkauf & Lagerhaltung',
      buchfuehrung: 'Buchführung & Rechnungen',
      events: 'Events-Verwaltung',
      multidojo: 'Multi-Dojo-Verwaltung',
      api: 'API-Zugang',
      messenger: 'Facebook Messenger',
      homepage_builder: 'Homepage Builder'
    };
    return featureNames[featureName] || featureName;
  };

  // Get minimum plan for feature
  const getMinimumPlanForFeature = (featureName) => {
    const featurePlans = {
      verkauf: 'professional',
      events: 'professional',
      buchfuehrung: 'premium',
      api: 'premium',
      multidojo: 'enterprise',
      messenger: 'enterprise',
      homepage_builder: 'enterprise'
    };
    return featurePlans[featureName] || 'starter';
  };

  // Get plan display name
  const getPlanName = (planType) => {
    const planNames = {
      trial: 'Trial',
      starter: 'Starter',
      professional: 'Professional',
      premium: 'Premium',
      enterprise: 'Enterprise'
    };
    return planNames[planType] || planType;
  };

  // Refresh subscription data
  const refresh = async () => {
    await loadSubscription();
  };

  const value = {
    subscription,
    loading,
    error,
    hasFeature,
    isTrial,
    isTrialExpired,
    getTrialDaysRemaining,
    isActive,
    isAtMemberLimit,
    getUpgradeUrl,
    getFeatureName,
    getMinimumPlanForFeature,
    getPlanName,
    refresh
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export default SubscriptionContext;
