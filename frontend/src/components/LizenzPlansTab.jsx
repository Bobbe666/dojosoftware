import React from "react";
import { XCircle, Check, Settings, Globe, PowerOff } from "lucide-react";
import config from "../config/config.js";
import { fetchWithAuth } from "../utils/fetchWithAuth";


const LizenzPlansTab = ({ message, setMessage, allFeatures, planFeatures, setPlanFeatures, subscriptionPlans, editingPlanPrices, setEditingPlanPrices, activePlanTab, setActivePlanTab, featureStatusFilter, setFeatureStatusFilter, savePlanPrices }) => {
  return (
          <div className="plans-tab">
            {/* Kompakte Plan-Tabs */}
            <div className="plan-tabs-compact">
              {[
                { key: 'trial', icon: '🎁', name: 'Trial' },
                { key: 'basic', icon: '📦', name: 'Basic' },
                { key: 'free', icon: '🆓', name: 'Free' },
                { key: 'starter', icon: '🚀', name: 'Starter' },
                { key: 'professional', icon: '💼', name: 'Pro' },
                { key: 'premium', icon: '⭐', name: 'Premium' },
                { key: 'enterprise', icon: '🏢', name: 'Enterprise' }
              ].map(plan => {
                const featureCount = (planFeatures[plan.key] || []).length;
                return (
                  <button
                    key={plan.key}
                    className={`plan-tab-compact ${activePlanTab === plan.key ? 'active' : ''}`}
                    onClick={() => setActivePlanTab(plan.key)}
                    title={`${plan.name} - ${featureCount} Features`}
                  >
                    <span className="ptc-icon">{plan.icon}</span>
                    <span className="ptc-name">{plan.name}</span>
                    <span className="ptc-count">{featureCount}</span>
                  </button>
                );
              })}
            </div>

            {/* Plan Settings Card */}
            {(() => {
              const dbPlan = subscriptionPlans.find(p => p.plan_name === activePlanTab);
              const currentPrices = editingPlanPrices[activePlanTab] || {
                price_monthly: dbPlan?.price_monthly || 0,
                price_yearly: dbPlan?.price_yearly || 0,
                max_members: dbPlan?.max_members || null,
                is_visible: dbPlan?.is_visible ?? true
              };
              const planIcons = { trial: '🎁', basic: '📦', free: '🆓', starter: '🚀', professional: '💼', premium: '⭐', enterprise: '🏢' };

              return (
                <div className="plan-settings-card">
                  {/* Zeile 1: Plan-Name + Sichtbarkeit + Speichern */}
                  <div className="psc-header">
                    <div className="psc-plan-name">
                      <span className="psc-icon">{planIcons[activePlanTab]}</span>
                      <span className="psc-title">{PLAN_NAMES[activePlanTab]}</span>
                      <span className="psc-feature-count">
                        {(planFeatures[activePlanTab] || []).length} / {allFeatures.length} Features
                      </span>
                    </div>
                    <div className="psc-actions">
                      <button
                        className={`psb-visibility ${currentPrices.is_visible ? 'visible' : 'hidden'}`}
                        onClick={() => setEditingPlanPrices(prev => ({
                          ...prev,
                          [activePlanTab]: { ...currentPrices, is_visible: !currentPrices.is_visible }
                        }))}
                        title={currentPrices.is_visible ? 'Plan ist öffentlich sichtbar' : 'Plan ist versteckt'}
                      >
                        {currentPrices.is_visible ? <Globe size={14} /> : <PowerOff size={14} />}
                        {currentPrices.is_visible ? 'Öffentlich' : 'Versteckt'}
                      </button>
                      {dbPlan && (
                        <button
                          className="psb-save"
                          onClick={() => savePlanPrices(dbPlan.plan_id, PLAN_NAMES[activePlanTab], currentPrices)}
                        >
                          <Check size={14} /> Preise speichern
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Zeile 2: Preisfelder + Filter */}
                  <div className="psc-body">
                    <div className="psc-price-fields">
                      <div className="psc-field">
                        <label>Monatspreis</label>
                        <div className="psc-input-wrap">
                          <input
                            type="number"
                            min="0"
                            value={currentPrices.price_monthly}
                            onChange={(e) => setEditingPlanPrices(prev => ({
                              ...prev,
                              [activePlanTab]: { ...currentPrices, price_monthly: parseFloat(e.target.value) || 0 }
                            }))}
                          />
                          <span className="psc-unit">€</span>
                        </div>
                      </div>
                      <div className="psc-field">
                        <label>Jahrespreis</label>
                        <div className="psc-input-wrap">
                          <input
                            type="number"
                            min="0"
                            value={currentPrices.price_yearly}
                            onChange={(e) => setEditingPlanPrices(prev => ({
                              ...prev,
                              [activePlanTab]: { ...currentPrices, price_yearly: parseFloat(e.target.value) || 0 }
                            }))}
                          />
                          <span className="psc-unit">€</span>
                        </div>
                      </div>
                      <div className="psc-field">
                        <label>Max. Mitglieder</label>
                        <div className="psc-input-wrap">
                          <input
                            type="number"
                            min="0"
                            placeholder="∞"
                            value={currentPrices.max_members || ''}
                            onChange={(e) => setEditingPlanPrices(prev => ({
                              ...prev,
                              [activePlanTab]: { ...currentPrices, max_members: e.target.value ? parseInt(e.target.value) : null }
                            }))}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="psc-filters">
                      <span className="psc-filter-label">Anzeigen:</span>
                      <button onClick={() => setFeatureStatusFilter('all')} className={`psb-filter ${featureStatusFilter === 'all' ? 'active' : ''}`}>Alle</button>
                      <button onClick={() => setFeatureStatusFilter('active')} className={`psb-filter ${featureStatusFilter === 'active' ? 'active' : ''}`}>✓ Aktiv</button>
                      <button onClick={() => setFeatureStatusFilter('inactive')} className={`psb-filter ${featureStatusFilter === 'inactive' ? 'active' : ''}`}>✕ Inaktiv</button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Features Grid - 2-3 pro Zeile */}
            <div className="features-grid-compact">
              {(() => {
                // Sortiere Features: Aktivierte zuerst
                const sortedFeatures = [...allFeatures].sort((a, b) => {
                  const aIncluded = (planFeatures[activePlanTab] || []).includes(a.id);
                  const bIncluded = (planFeatures[activePlanTab] || []).includes(b.id);
                  if (aIncluded && !bIncluded) return -1;
                  if (!aIncluded && bIncluded) return 1;
                  return 0;
                });

                // Filtere Features basierend auf Status
                const filteredFeatures = sortedFeatures.filter(feature => {
                  const isIncluded = (planFeatures[activePlanTab] || []).includes(feature.id);
                  if (featureStatusFilter === 'active') return isIncluded;
                  if (featureStatusFilter === 'inactive') return !isIncluded;
                  return true; // 'all'
                });

                return filteredFeatures.map(feature => {
                  const isIncluded = (planFeatures[activePlanTab] || []).includes(feature.id);
                  return (
                    <div
                      key={feature.id}
                      className={`feature-card-mini ${isIncluded ? 'included' : 'excluded'}`}
                      onClick={() => {
                        const currentFeatures = planFeatures[activePlanTab] || [];
                        const newFeatures = isIncluded
                          ? currentFeatures.filter(f => f !== feature.id)
                          : [...currentFeatures, feature.id];
                        setPlanFeatures(prev => ({
                          ...prev,
                          [activePlanTab]: newFeatures
                        }));
                      }}
                    >
                      <div className="fcm-header">
                        <span className="fcm-emoji">{feature.emoji}</span>
                        <span className="fcm-name">{feature.label}</span>
                        <span className={`fcm-status ${isIncluded ? 'on' : 'off'}`}>
                          {isIncluded ? <Check size={12} /> : <XCircle size={12} />}
                        </span>
                      </div>
                      <div className="fcm-desc">{feature.description}</div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Save Button */}
            <div className="plan-save-bar">
              <span className="psb-info">
                {(planFeatures[activePlanTab] || []).length} von {allFeatures.length} Features aktiv
              </span>
              <button
                className="btn-save-features"
                onClick={async () => {
                  try {
                    const response = await fetchWithAuth(
                      `${config.apiBaseUrl}/admin/subscription-plans/${activePlanTab}/features`,
                      {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ features: planFeatures[activePlanTab] })
                      }
                    );
                    if (response.ok) {
                      setMessage({ type: 'success', text: `Features für ${PLAN_NAMES[activePlanTab]} gespeichert!` });
                    } else {
                      throw new Error('Speichern fehlgeschlagen');
                    }
                  } catch (error) {
                    setMessage({ type: 'error', text: error.message });
                  }
                }}
              >
                <Check size={16} /> Features speichern
              </button>
            </div>
          </div>
  );
};

export default LizenzPlansTab;
