import React from "react";


const LizenzAblaufTab = ({ dojos, ablaufData, ablaufLoading, ablaufDays, setAblaufDays, handleExtendTrial, loadAblauf, handleRenewSubscription }) => {
  return (
          <div>
            {/* Filter-Leiste */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>Ablaufend in:</span>
              {[7, 14, 30, 60].map(d => (
                <button key={d} className={`btn btn-sm ${ablaufDays === d ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => { setAblaufDays(d); loadAblauf(d); }}>
                  {d} Tage
                </button>
              ))}
              {ablaufLoading && <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>Lädt…</span>}
            </div>

            {/* Ablaufende Trials */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                ⏳ Ablaufende Trials ({ablaufData.trials.length})
              </h3>
              {ablaufData.trials.length === 0 ? (
                <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>Keine ablaufenden Trials im gewählten Zeitraum.</p>
              ) : (
                <div className="dojos-table">
                  <table>
                    <thead><tr><th>Dojo</th><th>Plan</th><th>Trial endet</th><th>Verbleibend</th><th>Aktionen</th></tr></thead>
                    <tbody>
                      {ablaufData.trials.map(d => (
                        <tr key={d.id}>
                          <td className="dojo-cell"><strong>{d.dojoname}</strong><span className="dojo-email">{d.email}</span></td>
                          <td>{d.subscription_plan || 'trial'}</td>
                          <td>{new Date(d.trial_ends_at).toLocaleDateString('de-DE')}</td>
                          <td>
                            <span style={{ color: d.tage_verbleibend <= 3 ? '#ef4444' : d.tage_verbleibend <= 7 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
                              {d.tage_verbleibend} Tage
                            </span>
                          </td>
                          <td className="actions-cell">
                            <button className="btn btn-sm btn-success" onClick={() => handleExtendTrial(d.id, 14)}>+14d</button>
                            <button className="btn btn-sm btn-ghost" onClick={() => handleExtendTrial(d.id, 30)}>+30d</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Ablaufende Abos */}
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ef4444', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                💳 Ablaufende Abonnements ({ablaufData.abos.length})
              </h3>
              {ablaufData.abos.length === 0 ? (
                <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>Keine ablaufenden Abos im gewählten Zeitraum.</p>
              ) : (
                <div className="dojos-table">
                  <table>
                    <thead><tr><th>Dojo</th><th>Plan</th><th>Interval</th><th>Abo endet</th><th>Verbleibend</th><th>Aktionen</th></tr></thead>
                    <tbody>
                      {ablaufData.abos.map(d => (
                        <tr key={d.id}>
                          <td className="dojo-cell"><strong>{d.dojoname}</strong><span className="dojo-email">{d.email}</span></td>
                          <td>{d.subscription_plan}</td>
                          <td style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>{d.payment_interval || '—'}</td>
                          <td>{new Date(d.subscription_ends_at).toLocaleDateString('de-DE')}</td>
                          <td>
                            <span style={{ color: d.tage_verbleibend <= 3 ? '#ef4444' : d.tage_verbleibend <= 7 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
                              {d.tage_verbleibend} Tage
                            </span>
                          </td>
                          <td className="actions-cell">
                            <button className="btn btn-sm btn-success" onClick={() => handleRenewSubscription(d.id, d.dojoname)}>
                              Verlängern
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
  );
};

export default LizenzAblaufTab;
