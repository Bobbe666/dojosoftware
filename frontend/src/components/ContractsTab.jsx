import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { FileText, AlertTriangle, CheckCircle, Clock, TrendingUp, Award } from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const ContractsTab = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contracts, setContracts] = useState(null);

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.get('/admin/contracts', {
        headers: { Authorization: `Bearer ${token}` }
      });

      setContracts(response.data.contracts);
      console.log('✅ Vertragsdaten geladen:', response.data.contracts);
    } catch (err) {
      console.error('❌ Fehler beim Laden der Vertragsdaten:', err);
      setError(err.response?.data?.message || 'Fehler beim Laden der Vertragsdaten');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="statistics-loading">
        <div className="loading-spinner"></div>
        <p>Lade Vertragsdaten...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="statistics-error">
        <p>{error}</p>
        <button onClick={loadContracts} className="btn btn-primary">
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (!contracts) {
    return null;
  }

  // Prepare Monthly Contracts Data
  const monthlyContractsData = contracts.monthlyContracts.map(item => ({
    monat: MONTH_NAMES[item.monat - 1],
    vertraege: item.anzahl_vertraege,
    aktiv: item.aktiv,
    abgelaufen: item.abgelaufen
  }));

  // Calculate total active contracts
  const totalActive = contracts.contractStats?.active?.anzahl || 0;
  const totalTrial = contracts.contractStats?.trial?.anzahl || 0;
  const totalExpired = contracts.contractStats?.expired?.anzahl || 0;

  return (
    <div className="statistics-tab contracts-tab">
      {/* KPI Cards */}
      <div className="stats-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon success">
            <CheckCircle size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Aktive Verträge</div>
            <div className="kpi-value">{totalActive}</div>
            <div className="kpi-sublabel">{totalTrial} in Trial-Phase</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon warning">
            <Clock size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Ablaufend (30 Tage)</div>
            <div className="kpi-value">{contracts.upcomingRenewals.next30Days.length}</div>
            <div className="kpi-sublabel">{contracts.upcomingRenewals.count90Days} in 90 Tagen</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon primary">
            <TrendingUp size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Ø Vertragslaufzeit</div>
            <div className="kpi-value">{Math.round(contracts.avgContractDuration.avg_tage / 30)} Monate</div>
            <div className="kpi-sublabel">{contracts.avgContractDuration.avg_tage} Tage</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon success">
            <Award size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Verlängerungs-Rate</div>
            <div className="kpi-value">{contracts.renewalRate}%</div>
            <div className="kpi-sublabel">Verträge erneuert</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card chart-wide">
          <h3 className="chart-title">
            <TrendingUp size={18} />
            Vertragsabschlüsse 2026
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyContractsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="monat" stroke="#fff" />
              <YAxis stroke="#fff" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                labelStyle={{ color: '#FFD700' }}
              />
              <Legend />
              <Bar dataKey="aktiv" fill="#4ECDC4" name="Aktiv" />
              <Bar dataKey="abgelaufen" fill="#FF6B35" name="Abgelaufen" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Upcoming Renewals (Next 30 Days) */}
      {contracts.upcomingRenewals.next30Days.length > 0 && (
        <div className="finance-section">
          <h3 className="section-title">
            <AlertTriangle size={18} />
            Bald ablaufende Verträge (nächste 30 Tage)
          </h3>
          <div className="finance-table-container">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Dojo</th>
                  <th>Plan</th>
                  <th>Endet am</th>
                  <th>Verbleibend</th>
                  <th>Preis</th>
                </tr>
              </thead>
              <tbody>
                {contracts.upcomingRenewals.next30Days.map((renewal, idx) => (
                  <tr key={idx} className={renewal.tage_bis_ende <= 7 ? 'urgent' : ''}>
                    <td className="dojo-name">{renewal.dojoname}</td>
                    <td>{renewal.subscription_plan || 'Standard'}</td>
                    <td>{new Date(renewal.subscription_end).toLocaleDateString('de-DE')}</td>
                    <td className={renewal.tage_bis_ende <= 7 ? 'urgent-text' : 'warning-text'}>
                      {renewal.tage_bis_ende} Tage
                    </td>
                    <td>
                      {renewal.custom_pricing ? (
                        <span className="custom-price">{renewal.custom_pricing.toFixed(2)} € (Custom)</span>
                      ) : (
                        <span>Standard</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Contracts */}
      <div className="finance-section">
        <h3 className="section-title">
          <CheckCircle size={18} />
          Aktive Verträge ({contracts.activeContracts.length})
        </h3>
        <div className="finance-table-container">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Dojo</th>
                <th>Status</th>
                <th>Plan</th>
                <th>Start</th>
                <th>Ende</th>
                <th>Mitglieder</th>
                <th>Bemerkungen</th>
              </tr>
            </thead>
            <tbody>
              {contracts.activeContracts.map((contract, idx) => (
                <tr key={idx}>
                  <td className="dojo-name">{contract.dojoname}</td>
                  <td>
                    <span className={`status-badge ${contract.subscription_status === 'trial' ? 'warning' : 'success'}`}>
                      {contract.subscription_status === 'trial' ? 'Trial' : 'Aktiv'}
                    </span>
                  </td>
                  <td>{contract.subscription_plan || 'Standard'}</td>
                  <td>{contract.subscription_start ? new Date(contract.subscription_start).toLocaleDateString('de-DE') : '-'}</td>
                  <td>{contract.subscription_end ? new Date(contract.subscription_end).toLocaleDateString('de-DE') : '-'}</td>
                  <td className="member-count">{contract.mitglied_count}</td>
                  <td className="notes-cell">
                    {contract.custom_pricing && (
                      <span className="custom-badge">Custom: {contract.custom_pricing.toFixed(2)} €</span>
                    )}
                    {contract.custom_notes && (
                      <span className="notes-text" title={contract.custom_notes}>
                        {contract.custom_notes.substring(0, 50)}{contract.custom_notes.length > 50 ? '...' : ''}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Pricing Contracts */}
      {contracts.customContracts.length > 0 && (
        <div className="finance-section">
          <h3 className="section-title">
            <FileText size={18} />
            Verträge mit individueller Preisgestaltung ({contracts.customContracts.length})
          </h3>
          <div className="custom-contracts-grid">
            {contracts.customContracts.map((contract, idx) => (
              <div key={idx} className="custom-contract-card">
                <div className="contract-header">
                  <h4>{contract.dojoname}</h4>
                  <span className={`status-badge ${contract.subscription_status === 'active' ? 'success' : 'warning'}`}>
                    {contract.subscription_status}
                  </span>
                </div>
                <div className="contract-details">
                  <div className="detail-row">
                    <span className="label">Plan:</span>
                    <span className="value">{contract.subscription_plan || 'Standard'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Custom Preis:</span>
                    <span className="value custom-price">{contract.custom_pricing.toFixed(2)} € / Monat</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Laufzeit:</span>
                    <span className="value">
                      {new Date(contract.subscription_start).toLocaleDateString('de-DE')} - {new Date(contract.subscription_end).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                  {contract.custom_notes && (
                    <div className="detail-row notes-row">
                      <span className="label">Notizen:</span>
                      <span className="value notes">{contract.custom_notes}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trial Conversions (Last 90 Days) */}
      {contracts.trialConversions.length > 0 && (
        <div className="finance-section">
          <h3 className="section-title">
            <Award size={18} />
            Trial Conversions (Letzte 90 Tage)
          </h3>
          <div className="trial-conversions-grid">
            {contracts.trialConversions.map((conversion, idx) => (
              <div key={idx} className="trial-conversion-card">
                <div className="conversion-dojo">{conversion.dojoname}</div>
                <div className="conversion-timeline">
                  <div className="timeline-item">
                    <span className="timeline-label">Trial Ende:</span>
                    <span className="timeline-date">{new Date(conversion.trial_end).toLocaleDateString('de-DE')}</span>
                  </div>
                  <div className="timeline-arrow">→</div>
                  <div className="timeline-item">
                    <span className="timeline-label">Aktiviert:</span>
                    <span className="timeline-date">{new Date(conversion.subscription_start).toLocaleDateString('de-DE')}</span>
                  </div>
                </div>
                <div className="conversion-duration">
                  Trial-Dauer: {conversion.trial_dauer_tage} Tage
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expired Contracts (Last 90 Days) */}
      {contracts.expiredContracts.length > 0 && (
        <div className="finance-section">
          <h3 className="section-title">
            <AlertTriangle size={18} />
            Abgelaufene Verträge (Letzte 90 Tage)
          </h3>
          <div className="finance-table-container">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Dojo</th>
                  <th>Plan</th>
                  <th>Abgelaufen am</th>
                  <th>Tage seit Ablauf</th>
                </tr>
              </thead>
              <tbody>
                {contracts.expiredContracts.map((contract, idx) => (
                  <tr key={idx} className="expired">
                    <td className="dojo-name">{contract.dojoname}</td>
                    <td>{contract.subscription_plan || 'Standard'}</td>
                    <td>{new Date(contract.subscription_end).toLocaleDateString('de-DE')}</td>
                    <td className="expired-days">{contract.tage_abgelaufen} Tage</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractsTab;
