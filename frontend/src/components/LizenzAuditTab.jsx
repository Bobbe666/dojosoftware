import React from "react";
import { Activity, Info } from "lucide-react";


const LizenzAuditTab = ({ loading, auditLogs, auditLogsLoading, getPlanBadge }) => {
  return (
          <div className="audit-tab">
            <div className="audit-header">
              <h3><Activity size={20} /> Subscription Audit-Log</h3>
              <p className="hint">Alle Änderungen an Subscriptions und Dojo-Status</p>
            </div>

            {auditLogsLoading ? (
              <div className="loading-state">Laden...</div>
            ) : auditLogs.length === 0 ? (
              <div className="empty-state">
                <Info size={48} />
                <p>Noch keine Audit-Log Einträge vorhanden</p>
              </div>
            ) : (
              <div className="audit-log-table">
                <table>
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Dojo</th>
                      <th>Aktion</th>
                      <th>Alter Plan</th>
                      <th>Neuer Plan</th>
                      <th>Admin</th>
                      <th>Grund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log, idx) => (
                      <tr key={log.log_id || idx}>
                        <td className="date-cell">
                          {log.created_at ? new Date(log.created_at).toLocaleString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '-'}
                        </td>
                        <td>
                          <strong>{log.dojoname || `Dojo #${log.dojo_id}`}</strong>
                        </td>
                        <td>
                          <span className={`action-badge ${log.action?.includes('deactivat') ? 'danger' : log.action?.includes('activat') ? 'success' : 'info'}`}>
                            {log.action || '-'}
                          </span>
                        </td>
                        <td>
                          {log.old_plan ? getPlanBadge(log.old_plan) : '-'}
                        </td>
                        <td>
                          {log.new_plan ? getPlanBadge(log.new_plan) : '-'}
                        </td>
                        <td>{log.admin_username || '-'}</td>
                        <td className="reason-cell">{log.reason || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
  );
};

export default LizenzAuditTab;
