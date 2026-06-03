import React from "react";
import { Building2, Clock, XCircle, RefreshCw } from "lucide-react";


const LizenzTrialsTab = ({ dojos, loading, message, setMessage, allFeatures, featureTrials, featureTrialsLoading, trialStats, addonPrices, selectedTrialDojo, setSelectedTrialDojo, handleStartTrial, handleEndTrial, handleProcessExpiredTrials, handleUpdateAddonPrice, stats }) => {
  return (
          <div className="trials-tab">
            {/* Header mit Stats */}
            <div className="trials-header">
              <h3><Clock size={20} /> Feature-Trials Verwaltung</h3>
              <div className="trials-actions">
                <button
                  className="btn-process"
                  onClick={handleProcessExpiredTrials}
                  disabled={featureTrialsLoading}
                >
                  <RefreshCw size={14} /> Abgelaufene verarbeiten
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            {trialStats && (
              <div className="trials-stats">
                <div className="trial-stat-card">
                  <div className="tsc-value">{trialStats.activeTrials || 0}</div>
                  <div className="tsc-label">Aktive Trials</div>
                </div>
                <div className="trial-stat-card warning">
                  <div className="tsc-value">{trialStats.expiringSoon || 0}</div>
                  <div className="tsc-label">Laufen bald ab</div>
                </div>
                <div className="trial-stat-card success">
                  <div className="tsc-value">{trialStats.conversionRate || 0}%</div>
                  <div className="tsc-label">Conversion Rate</div>
                </div>
                <div className="trial-stat-card">
                  <div className="tsc-value">{trialStats.topFeatures?.[0]?.feature_name || '-'}</div>
                  <div className="tsc-label">Top Feature</div>
                </div>
              </div>
            )}

            {featureTrialsLoading ? (
              <div className="loading-state">Laden...</div>
            ) : (
              <>
                {/* Aktive Trials Liste */}
                <div className="trials-section">
                  <h4>Aktive Feature-Trials ({featureTrials.filter(t => t.status === 'active').length})</h4>
                  {featureTrials.filter(t => t.status === 'active').length === 0 ? (
                    <div className="empty-hint">Keine aktiven Trials</div>
                  ) : (
                    <div className="trials-grid">
                      {featureTrials.filter(t => t.status === 'active').map(trial => (
                        <div key={trial.trial_id} className={`trial-card ${trial.days_remaining <= 3 ? 'expiring' : ''}`}>
                          <div className="tc-header">
                            <span className="tc-feature">
                              {trial.feature_icon} {trial.feature_name}
                            </span>
                            <span className={`tc-days ${trial.days_remaining <= 3 ? 'warning' : ''}`}>
                              {trial.days_remaining > 0 ? `${trial.days_remaining} Tage` : 'Abgelaufen'}
                            </span>
                          </div>
                          <div className="tc-dojo">
                            <Building2 size={12} />
                            <span>{trial.dojoname}</span>
                            {trial.subdomain && <span className="tc-subdomain">{trial.subdomain}</span>}
                          </div>
                          <div className="tc-dates">
                            <span>Start: {new Date(trial.started_at).toLocaleDateString('de-DE')}</span>
                            <span>Ende: {new Date(trial.expires_at).toLocaleDateString('de-DE')}</span>
                          </div>
                          <div className="tc-actions">
                            <button
                              className="btn-end-trial"
                              onClick={() => handleEndTrial(trial.trial_id)}
                            >
                              <XCircle size={12} /> Beenden
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Trial für Dojo starten */}
                <div className="trials-section">
                  <h4>Trial für Dojo starten</h4>
                  <div className="start-trial-form">
                    <select
                      value={selectedTrialDojo || ''}
                      onChange={(e) => setSelectedTrialDojo(e.target.value)}
                      className="trial-dojo-select"
                    >
                      <option value="">Dojo auswählen...</option>
                      {dojos.map(d => (
                        <option key={d.id} value={d.id}>{d.dojoname}</option>
                      ))}
                    </select>
                    {selectedTrialDojo && (
                      <div className="trial-features-grid">
                        {allFeatures.map(feature => (
                          <button
                            key={feature.id}
                            className="btn-start-feature-trial"
                            onClick={() => {
                              const featureObj = addonPrices.find(p => p.feature_key === feature.id);
                              if (featureObj) {
                                handleStartTrial(selectedTrialDojo, featureObj.feature_id);
                              } else {
                                setMessage({ type: 'error', text: 'Feature nicht gefunden' });
                              }
                            }}
                          >
                            <span className="sft-emoji">{feature.emoji}</span>
                            <span className="sft-name">{feature.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Addon-Preise */}
                <div className="trials-section">
                  <h4>Feature-Addon Preise</h4>
                  <table className="addon-prices-table">
                    <thead>
                      <tr>
                        <th>Feature</th>
                        <th>Monat €</th>
                        <th>Jahr €</th>
                        <th>Trial-Tage</th>
                        <th>Trial</th>
                        <th>Addon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {addonPrices.map(price => (
                        <tr key={price.feature_id}>
                          <td className="apt-feature">
                            <span className="apt-icon">{price.feature_icon}</span>
                            <span className="apt-name">{price.feature_name}</span>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="apt-input"
                              defaultValue={price.monthly_price}
                              min="0"
                              step="0.01"
                              onBlur={(e) => handleUpdateAddonPrice(price.feature_id, {
                                ...price,
                                monthly_price: parseFloat(e.target.value)
                              })}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="apt-input"
                              defaultValue={price.yearly_price}
                              min="0"
                              step="0.01"
                              onBlur={(e) => handleUpdateAddonPrice(price.feature_id, {
                                ...price,
                                yearly_price: parseFloat(e.target.value)
                              })}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="apt-input apt-input--small"
                              defaultValue={price.trial_days}
                              min="0"
                              max="30"
                              onBlur={(e) => handleUpdateAddonPrice(price.feature_id, {
                                ...price,
                                trial_days: parseInt(e.target.value)
                              })}
                            />
                          </td>
                          <td className="apt-toggle-cell">
                            <input
                              type="checkbox"
                              defaultChecked={price.trial_enabled}
                              onChange={(e) => handleUpdateAddonPrice(price.feature_id, {
                                ...price,
                                trial_enabled: e.target.checked
                              })}
                            />
                          </td>
                          <td className="apt-toggle-cell">
                            <input
                              type="checkbox"
                              defaultChecked={price.addon_enabled}
                              onChange={(e) => handleUpdateAddonPrice(price.feature_id, {
                                ...price,
                                addon_enabled: e.target.checked
                              })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </>
            )}
          </div>
  );
};

export default LizenzTrialsTab;
