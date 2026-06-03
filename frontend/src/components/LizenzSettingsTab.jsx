import React from "react";
import { Shield, XCircle, Settings, Zap, RefreshCw, Globe, CheckCircle2, Info } from "lucide-react";


const LizenzSettingsTab = ({ loading, message, saasSettings, saasCategories, saasSettingsLoading, saasSettingsSaving, editedSettings, testResults, handleSettingChange, saveSaasSettings, testStripeConnection, testEmailConnection, clearSettingsCache, getCategoryLabel, getCategoryIcon }) => {
  return (
          <div className="settings-tab">
            <div className="settings-header">
              <div>
                <h3><Settings size={20} /> SaaS-Einstellungen</h3>
                <p className="hint">Globale Konfiguration für das SaaS-System</p>
              </div>
              <div className="settings-actions">
                <button
                  className="btn btn-secondary"
                  onClick={clearSettingsCache}
                >
                  <RefreshCw size={16} /> Cache leeren
                </button>
                <button
                  className="btn btn-primary"
                  onClick={saveSaasSettings}
                  disabled={saasSettingsSaving || Object.keys(editedSettings).length === 0}
                >
                  {saasSettingsSaving ? 'Speichert...' : 'Änderungen speichern'}
                </button>
              </div>
            </div>

            {saasSettingsLoading ? (
              <div className="loading-state">Laden...</div>
            ) : (
              <div className="settings-categories">
                {saasCategories.map(category => (
                  <div key={category} className="settings-category">
                    <h4 className="category-header">
                      {getCategoryIcon(category)}
                      <span>{getCategoryLabel(category)}</span>
                    </h4>

                    {/* Test-Buttons für bestimmte Kategorien */}
                    {category === 'stripe' && (
                      <div className="category-actions">
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={testStripeConnection}
                          disabled={testResults.stripe?.loading}
                        >
                          <Zap size={14} />
                          {testResults.stripe?.loading ? 'Teste...' : 'Verbindung testen'}
                        </button>
                        {testResults.stripe && !testResults.stripe.loading && (
                          <span className={`test-result ${testResults.stripe.success ? 'success' : 'error'}`}>
                            {testResults.stripe.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                            {testResults.stripe.message}
                            {testResults.stripe.mode && ` (${testResults.stripe.mode})`}
                          </span>
                        )}
                      </div>
                    )}

                    {category === 'email' && (
                      <div className="category-actions">
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={testEmailConnection}
                          disabled={testResults.email?.loading}
                        >
                          <Globe size={14} />
                          {testResults.email?.loading ? 'Sende...' : 'Test-Email senden'}
                        </button>
                        {testResults.email && !testResults.email.loading && (
                          <span className={`test-result ${testResults.email.success ? 'success' : 'error'}`}>
                            {testResults.email.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                            {testResults.email.message}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="settings-grid">
                      {(saasSettings[category] || []).map(setting => (
                        <div key={setting.key} className="setting-item">
                          <div className="setting-header">
                            <label htmlFor={setting.key}>{setting.displayName || setting.key}</label>
                            {setting.isSecret && (
                              <span className="secret-badge">
                                <Shield size={12} /> Secret
                              </span>
                            )}
                          </div>

                          {setting.updatedAt && (
                            <span className="setting-updated">
                              {new Date(setting.updatedAt).toLocaleDateString('de-DE')}
                            </span>
                          )}

                          <p className="setting-description">{setting.description}</p>

                          <div className="setting-input-wrapper">
                            {setting.type === 'boolean' ? (
                              <label className="toggle-switch">
                                <input
                                  type="checkbox"
                                  id={setting.key}
                                  checked={
                                    editedSettings[setting.key] !== undefined
                                      ? editedSettings[setting.key]
                                      : setting.value === true || setting.value === 'true'
                                  }
                                  onChange={(e) => handleSettingChange(setting.key, e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                              </label>
                            ) : setting.type === 'number' ? (
                              <input
                                type="number"
                                id={setting.key}
                                className="setting-input"
                                value={
                                  editedSettings[setting.key] !== undefined
                                    ? editedSettings[setting.key]
                                    : setting.value ?? ''
                                }
                                onChange={(e) => handleSettingChange(setting.key, parseFloat(e.target.value) || 0)}
                                placeholder="Wert eingeben..."
                              />
                            ) : setting.type === 'json' ? (
                              <textarea
                                id={setting.key}
                                className="setting-input setting-textarea"
                                value={
                                  editedSettings[setting.key] !== undefined
                                    ? (typeof editedSettings[setting.key] === 'string'
                                        ? editedSettings[setting.key]
                                        : JSON.stringify(editedSettings[setting.key], null, 2))
                                    : (typeof setting.value === 'string'
                                        ? setting.value
                                        : JSON.stringify(setting.value, null, 2))
                                }
                                onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                                rows={4}
                                placeholder='{"key": "value"}'
                              />
                            ) : (
                              <input
                                type={setting.isSecret ? 'password' : 'text'}
                                id={setting.key}
                                className="setting-input"
                                value={
                                  editedSettings[setting.key] !== undefined
                                    ? editedSettings[setting.key]
                                    : setting.value || ''
                                }
                                onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                                placeholder={setting.isSecret ? '••••••••••••••••' : 'Wert eingeben...'}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {saasCategories.length === 0 && (
                  <div className="empty-state">
                    <Info size={48} />
                    <p>Keine SaaS-Einstellungen gefunden.</p>
                    <p className="hint">Bitte führe die Migration 062_create_saas_settings.sql aus.</p>
                  </div>
                )}
              </div>
            )}
          </div>
  );
};

export default LizenzSettingsTab;
