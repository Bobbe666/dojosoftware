import React from "react";
import { Search, Link, Download } from "lucide-react";


const LizenzListTab = ({ dojos, loading, searchQuery, setSearchQuery, selectedIds, setSelectedIds, bulkDays, setBulkDays, handleSelectDojo, handleExtendTrial, handleBulkExtendTrial, handleExportCSV, filteredDojos, getPlanBadge, getStatusBadge, formatDate }) => {
  return (
          <div className="list-tab">
            <div className="list-header-row">
              <div className="search-bar">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Dojo, Subdomain oder E-Mail suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="btn-export" onClick={handleExportCSV}>
                <Download size={16} /> CSV Export
              </button>
            </div>

            {/* Bulk-Toolbar */}
            {selectedIds.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1rem', marginBottom: '0.75rem', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: '#d4af37', fontWeight: 600, fontSize: '0.9rem' }}>{selectedIds.size} ausgewählt</span>
                <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>Trial verlängern um:</span>
                {[14, 30].map(d => (
                  <button key={d} className="btn btn-sm btn-success" onClick={() => handleBulkExtendTrial(d)}>+{d} Tage</button>
                ))}
                <input
                  type="number" min="1" max="365" value={bulkDays}
                  onChange={e => setBulkDays(parseInt(e.target.value) || 14)}
                  style={{ width: 64, padding: '0.25rem 0.5rem', background: 'var(--bg-glass)', border: '1px solid var(--border-secondary)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.85rem' }}
                />
                <button className="btn btn-sm btn-primary" onClick={() => handleBulkExtendTrial(bulkDays)}>+{bulkDays} Tage</button>
                <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setSelectedIds(new Set())}>Auswahl aufheben</button>
              </div>
            )}

            {loading ? (
              <div className="loading-state">Laden...</div>
            ) : (
              <div className="dojos-table">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <input
                          type="checkbox"
                          checked={filteredDojos.length > 0 && filteredDojos.every(d => selectedIds.has(d.id))}
                          onChange={e => {
                            if (e.target.checked) setSelectedIds(new Set(filteredDojos.map(d => d.id)));
                            else setSelectedIds(new Set());
                          }}
                          title="Alle auswählen"
                        />
                      </th>
                      <th>Dojo</th>
                      <th>Subdomain</th>
                      <th>Plan</th>
                      <th>Mitglieder</th>
                      <th>Status</th>
                      <th>Registriert</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDojos.map(dojo => {
                      const plan = dojo.subscription_plan || dojo.plan_type || 'trial';
                      const isTrial = plan === 'trial';

                      return (
                        <tr key={dojo.id} style={selectedIds.has(dojo.id) ? { background: 'rgba(212,175,55,0.05)' } : {}}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(dojo.id)}
                              onChange={e => {
                                const next = new Set(selectedIds);
                                e.target.checked ? next.add(dojo.id) : next.delete(dojo.id);
                                setSelectedIds(next);
                              }}
                            />
                          </td>
                          <td className="dojo-cell">
                            <strong>{dojo.dojoname}</strong>
                            <span className="dojo-email">{dojo.email}</span>
                          </td>
                          <td>
                            {dojo.subdomain ? (
                              <a
                                href={`https://${dojo.subdomain}.dojo.tda-intl.org`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="subdomain-link"
                              >
                                <Link size={12} /> {dojo.subdomain}
                              </a>
                            ) : '-'}
                          </td>
                          <td>{getPlanBadge(plan)}</td>
                          <td>{dojo.mitglieder_count || 0}</td>
                          <td>{getStatusBadge(dojo)}</td>
                          <td>{formatDate(dojo.created_at)}</td>
                          <td className="actions-cell">
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => handleSelectDojo(dojo)}
                            >
                              Details
                            </button>
                            {isTrial && (
                              <button
                                className="btn btn-sm btn-success"
                                onClick={() => handleExtendTrial(dojo.id)}
                              >
                                +14d
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
  );
};

export default LizenzListTab;
