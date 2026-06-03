import React from "react";
import { Building2, Clock, CheckCircle, XCircle, CreditCard, TrendingUp, Globe, Info, Download, Power, PowerOff } from 'lucide-react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';

// Ausgelagert aus DojoLizenzverwaltung.jsx (LizenzDetailsTab).
const LizenzDetailsTab = ({ activeTab, setActiveTab, selectedDojo, setSelectedDojo, message, featureOverrides, allFeatures, planFeatures, subscriptionPlans, dojoVertraege, dojoVertraegeLoading, showPlanVergleich, setShowPlanVergleich, loadDojoVertraege, handleExtendTrial, handleActivatePlan, handleToggleDojoActive, getPlanBadge, getStatusBadge, formatDate, getRegistrationUrl }) => {
  return (
          <div className="details-tab">
            <div className="details-header">
              <h2>{selectedDojo.dojoname}</h2>
              <button
                className="logout-button"
                onClick={() => { setSelectedDojo(null); setActiveTab('list'); }}
              >
                Zurück zur Liste
              </button>
            </div>

            <div className="details-grid">
              {/* Info Card */}
              <div className="detail-card">
                <h4><Building2 size={18} /> Dojo-Informationen</h4>
                <div className="info-rows">
                  <div className="info-row">
                    <span>Inhaber</span>
                    <strong>{selectedDojo.inhaber || '-'}</strong>
                  </div>
                  <div className="info-row">
                    <span>E-Mail</span>
                    <strong>{selectedDojo.email || '-'}</strong>
                  </div>
                  <div className="info-row">
                    <span>Mitglieder</span>
                    <strong>{selectedDojo.mitglieder_count || 0}</strong>
                  </div>
                  <div className="info-row">
                    <span>Registriert</span>
                    <strong>{formatDate(selectedDojo.created_at)}</strong>
                  </div>
                </div>
              </div>

              {/* Registration URL Card */}
              <div className="detail-card">
                <h4><Globe size={18} /> Registrierungs-URL</h4>
                <div className="info-rows">
                  <div className="info-row">
                    <span>Subdomain</span>
                    <strong>{selectedDojo.subdomain || selectedDojo.slug || '-'}</strong>
                  </div>
                  {getRegistrationUrl(selectedDojo) && (
                    <>
                      <div className="info-row">
                        <span>URL</span>
                        <strong>
                          <a
                            href={getRegistrationUrl(selectedDojo)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="url-link"
                          >
                            {getRegistrationUrl(selectedDojo)}
                          </a>
                        </strong>
                      </div>
                      <div className="info-row">
                        <span>Registrierung</span>
                        <strong>
                          <a
                            href={`${getRegistrationUrl(selectedDojo)}/registrierung`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="url-link"
                          >
                            /registrierung
                          </a>
                        </strong>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Subscription Card */}
              <div className="detail-card">
                <h4><CreditCard size={18} /> Abonnement</h4>
                <div className="info-rows">
                  <div className="info-row">
                    <span>Aktueller Plan</span>
                    <strong>{getPlanBadge(selectedDojo.subscription_plan || selectedDojo.plan_type)}</strong>
                  </div>
                  <div className="info-row">
                    <span>Status</span>
                    <strong>{getStatusBadge(selectedDojo)}</strong>
                  </div>
                  {(selectedDojo.subscription_plan || selectedDojo.plan_type) === 'trial' && (
                    <div className="info-row">
                      <span>Trial endet</span>
                      <strong>{formatDate(selectedDojo.trial_ends_at)}</strong>
                    </div>
                  )}
                  <div className="info-row">
                    <span>Monatl. Preis</span>
                    <strong>{selectedDojo.monthly_price ? `€${selectedDojo.monthly_price}` : '-'}</strong>
                  </div>
                </div>

                {/* Plan Upgrade Buttons */}
                <div className="plan-actions">
                  <span className="label">Plan ändern:</span>
                  <div className="plan-buttons">
                    {Object.keys(PLAN_HIERARCHY)
                      .filter(p => p !== 'trial')
                      .map(plan => (
                        <button
                          key={plan}
                          className={`btn-plan btn-plan--${plan}`}
                          onClick={() => handleActivatePlan(selectedDojo.id, plan)}
                        >
                          {plan.charAt(0).toUpperCase() + plan.slice(1)}
                        </button>
                      ))
                    }
                  </div>
                </div>

                {(selectedDojo.subscription_plan || selectedDojo.plan_type) === 'trial' && (
                  <div className="trial-actions">
                    <button
                      className="btn-extend-trial"
                      onClick={() => handleExtendTrial(selectedDojo.id)}
                    >
                      <Clock size={16} /> Trial um 14 Tage verlängern
                    </button>
                  </div>
                )}

                {/* Dojo Aktivierung/Deaktivierung */}
                <div className="dojo-status-actions">
                  <span className="label">Dojo-Status:</span>
                  {selectedDojo.ist_aktiv !== false ? (
                    <button
                      className="btn-deactivate"
                      onClick={() => handleToggleDojoActive(selectedDojo.id, true)}
                    >
                      <PowerOff size={16} /> Dojo deaktivieren
                    </button>
                  ) : (
                    <button
                      className="btn-reactivate"
                      onClick={() => handleToggleDojoActive(selectedDojo.id, false)}
                    >
                      <Power size={16} /> Dojo reaktivieren
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Plan Comparison */}
            {(() => {
              const PAID_PLANS = ['starter', 'professional', 'premium', 'enterprise'];
              const currentPlan = selectedDojo.subscription_plan || selectedDojo.plan_type || 'trial';
              return (
                <div className="pct-wrap">
                  <h4
                    style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom: showPlanVergleich ? '0.75rem' : 0, cursor:'pointer', userSelect:'none' }}
                    onClick={() => setShowPlanVergleich(v => !v)}
                  >
                    <TrendingUp size={16} /> Plan-Vergleich & Upgrade
                    <span style={{ marginLeft:'auto', fontSize:'0.75rem', color:'var(--text-secondary,#9ca3af)', fontWeight:400 }}>
                      {showPlanVergleich ? '▲ Einklappen' : '▼ Ausklappen'}
                    </span>
                  </h4>

                  {showPlanVergleich && (
                    <>
                      {/* Plan-Header-Karten */}
                      <div className="pct-header-row">
                        <div className="pct-feature-col" />
                        {PAID_PLANS.map(plan => {
                          const isCurrent = plan === currentPlan;
                          const dbPlan = subscriptionPlans.find(p => p.plan_name === plan);
                          const price = dbPlan?.price_monthly ? `${dbPlan.price_monthly}€` : PLAN_PRICES[plan]?.replace('/Monat','') || '–';
                          return (
                            <div key={plan} className={`pct-plan-col ${isCurrent ? 'pct-current' : ''}`}>
                              <div className="pct-plan-name" style={{ color: PLAN_COLORS[plan] }}>{PLAN_NAMES[plan]}</div>
                              <div className="pct-plan-price">{price}<span>/Mo</span></div>
                              {isCurrent
                                ? <span className="pct-badge-current">Aktiv</span>
                                : <button className="pct-btn-upgrade" style={{ borderColor: PLAN_COLORS[plan], color: PLAN_COLORS[plan] }} onClick={() => handleActivatePlan(selectedDojo.id, plan)}>Wechseln</button>
                              }
                            </div>
                          );
                        })}
                      </div>

                      {/* Feature-Zeilen */}
                      <div className="pct-body">
                        {allFeatures.map((feature, idx) => (
                          <div key={feature.id} className={`pct-row ${idx % 2 === 0 ? 'pct-row-even' : ''}`}>
                            <div className="pct-feature-col">
                              <span className="pct-feature-icon">{feature.emoji}</span>
                              <span className="pct-feature-name">{feature.label}</span>
                              {featureOverrides[feature.id] && <span className="pct-active-dot" title="Für dieses Dojo aktiv" />}
                            </div>
                            {PAID_PLANS.map(plan => {
                              const ok = (planFeatures[plan] || []).includes(feature.id);
                              const isCurrent = plan === currentPlan;
                              return (
                                <div key={plan} className={`pct-cell ${isCurrent ? 'pct-cell-current' : ''}`}>
                                  {ok
                                    ? <CheckCircle size={15} style={{ color:'#4ade80' }} />
                                    : <XCircle size={15} style={{ color: 'var(--ds-text-faint)' }} />
                                  }
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Lizenzverträge */}
            <div className="pct-wrap" style={{ marginTop:'1rem' }}>
              <h4 style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.75rem', justifyContent:'space-between' }}>
                <span style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>📄 Unterzeichnete Lizenzverträge</span>
                <button
                  className="pct-btn-upgrade"
                  onClick={() => loadDojoVertraege(selectedDojo.id)}
                  style={{ fontSize:'0.72rem', padding:'0.15rem 0.5rem' }}
                >Aktualisieren</button>
              </h4>
              {dojoVertraegeLoading ? (
                <div style={{ padding:'1rem 0', fontSize:'0.85rem', color:'var(--text-secondary,#9ca3af)', textAlign:'center' }}>Lädt...</div>
              ) : dojoVertraege.length === 0 ? (
                <p style={{ fontSize:'0.85rem', margin:'0.5rem 0', color:'var(--text-secondary,#9ca3af)', fontStyle:'italic' }}>Noch keine signierten Verträge für dieses Dojo.</p>
              ) : (
                <table className="lv-sig-table" style={{ width:'100%' }}>
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Unterzeichner</th>
                      <th>Plan</th>
                      <th>Abrechnung</th>
                      <th>IP-Adresse</th>
                      <th>Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dojoVertraege.map(v => (
                      <tr key={v.id}>
                        <td style={{ fontSize:'0.8rem' }}>{new Date(v.signed_at).toLocaleString('de-DE')}</td>
                        <td style={{ fontSize:'0.8rem' }}>{v.signed_by || '–'}</td>
                        <td><span className={`plan-badge plan-badge--${v.plan}`}>{v.plan}</span></td>
                        <td style={{ fontSize:'0.8rem' }}>{v.interval_type}</td>
                        <td className="lv-sig-ip">{v.ip_address}</td>
                        <td>
                          {v.has_file ? (
                            <button
                              className="pct-btn-upgrade"
                              style={{ fontSize:'0.72rem', padding:'0.15rem 0.5rem', display:'inline-flex', alignItems:'center', gap:'0.25rem' }}
                              onClick={async () => {
                                try {
                                  const r = await fetchWithAuth(`${config.apiBaseUrl}/admin/lizenzvertrag/download/${v.id}`);
                                  const blob = await r.blob();
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = v.pdf_filename || `Lizenzvertrag_${v.id}.pdf`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                } catch (e) {
                                  alert('Download fehlgeschlagen: ' + e.message);
                                }
                              }}
                            >⬇ PDF</button>
                          ) : (
                            <span style={{ fontSize:'0.75rem', color:'#555' }}>–</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
  );
};

export default LizenzDetailsTab;
