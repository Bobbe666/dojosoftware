import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { DollarSign, TrendingUp, AlertCircle, Clock, CheckCircle, BarChart2 } from 'lucide-react';

const COLORS = ['#4ECDC4', '#FFD700', '#FF6B35', '#45B7D1', '#96CEB4', '#FFA500'];

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// Hilfsfunktion für sichere Zahlenformatierung
const formatNumber = (value, decimals = 0) => {
  const num = parseFloat(value);
  if (isNaN(num) || value === null || value === undefined) {
    return decimals > 0 ? '0,00' : '0';
  }
  return num.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

// Leerer Zustand Komponente
const EmptyState = ({ icon: Icon, title, subtitle }) => (
  <div className="empty-state" style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center'
  }}>
    <Icon size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
    <div style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: '8px' }}>{title}</div>
    <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>{subtitle}</div>
  </div>
);

const FinanceTab = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [finance, setFinance] = useState(null);

  useEffect(() => {
    loadFinance();
  }, []);

  const loadFinance = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.get('/admin/finance', {
        headers: { Authorization: `Bearer ${token}` }
      });

      setFinance(response.data.finance);
      console.log('✅ Finanzdaten geladen:', response.data.finance);
    } catch (err) {
      console.error('❌ Fehler beim Laden der Finanzdaten:', err);
      setError(err.response?.data?.message || 'Fehler beim Laden der Finanzdaten');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="statistics-loading">
        <div className="loading-spinner"></div>
        <p>Lade Finanzdaten...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="statistics-error">
        <p>{error}</p>
        <button onClick={loadFinance} className="btn btn-primary">
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (!finance) {
    return null;
  }

  // Prepare Monthly Revenue Data with month names
  const monthlyRevenueData = finance.monthlyRevenue.map(item => ({
    monat: MONTH_NAMES[item.monat - 1],
    bezahlt: item.bezahlt,
    offen: item.offen,
    gesamt: item.umsatz
  }));

  // Prepare Payment Behavior Data for Pie Chart
  const paymentBehaviorData = [
    { name: 'Pünktlich', value: finance.paymentBehavior.onTimeCount, color: '#4ECDC4' },
    { name: 'Verspätet', value: finance.paymentBehavior.lateCount, color: '#FFA500' },
    { name: 'Offen', value: finance.paymentBehavior.overdueCount, color: '#FF6B35' }
  ];

  return (
    <div className="statistics-tab finance-tab">
      {/* KPI Cards */}
      <div className="stats-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon success">
            <DollarSign size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Gesamt-Umsatz {new Date().getFullYear()}</div>
            <div className="kpi-value">
              {formatNumber(finance?.overview?.totalRevenue, 2)} €
            </div>
            <div className="kpi-sublabel">{formatNumber(finance?.overview?.totalInvoices)} Rechnungen</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon primary">
            <TrendingUp size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">MRR (Monthly Recurring Revenue)</div>
            <div className="kpi-value">
              {formatNumber(finance?.subscriptionRevenue?.monthlyRecurringRevenue, 2)} €
            </div>
            <div className="kpi-sublabel">ARR: {formatNumber(finance?.subscriptionRevenue?.annualRecurringRevenue, 2)} €</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon warning">
            <AlertCircle size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Offene Rechnungen</div>
            <div className="kpi-value">
              {formatNumber(finance?.overview?.unpaidAmount, 2)} €
            </div>
            <div className="kpi-sublabel">{formatNumber(finance?.overview?.unpaidInvoices)} Rechnungen</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon success">
            <CheckCircle size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Zahlungsmoral</div>
            <div className="kpi-value">{formatNumber(finance?.paymentBehavior?.onTimeRate)}%</div>
            <div className="kpi-sublabel">Pünktlich bezahlt</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Monatliche Umsatz-Entwicklung (Stacked) */}
        <div className="chart-card chart-wide">
          <h3 className="chart-title">
            <TrendingUp size={18} />
            Monatliche Umsatz-Entwicklung {new Date().getFullYear()}
          </h3>
          {monthlyRevenueData.length > 0 && monthlyRevenueData.some(d => d.bezahlt > 0 || d.offen > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyRevenueData}>
                <defs>
                  <linearGradient id="colorBezahlt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4ECDC4" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#4ECDC4" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorOffen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6B35" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#FF6B35" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="monat" stroke="#fff" />
                <YAxis stroke="#fff" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                  labelStyle={{ color: '#FFD700' }}
                />
                <Legend />
                <Area type="monotone" dataKey="bezahlt" stackId="1" stroke="#4ECDC4" fill="url(#colorBezahlt)" name="Bezahlt" />
                <Area type="monotone" dataKey="offen" stackId="1" stroke="#FF6B35" fill="url(#colorOffen)" name="Offen" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="Noch keine Umsätze"
              subtitle="Umsatzdaten werden hier angezeigt, sobald Einnahmen verbucht werden"
            />
          )}
        </div>

        {/* Umsatz pro Dojo */}
        <div className="chart-card">
          <h3 className="chart-title">
            <DollarSign size={18} />
            Umsatz pro Dojo
          </h3>
          {Array.isArray(finance.revenuePerDojo) && finance.revenuePerDojo.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={finance.revenuePerDojo}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="dojoname" stroke="#fff" angle={-45} textAnchor="end" height={100} />
                <YAxis stroke="#fff" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                  labelStyle={{ color: '#FFD700' }}
                />
                <Legend />
                <Bar dataKey="bezahlt" stackId="a" fill="#4ECDC4" name="Bezahlt" />
                <Bar dataKey="offen" stackId="a" fill="#FF6B35" name="Offen" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={DollarSign}
              title="Noch keine Dojo-Umsätze"
              subtitle="Hier werden Umsätze nach Dojo aufgeschlüsselt"
            />
          )}
        </div>

        {/* Zahlungsverhalten */}
        <div className="chart-card">
          <h3 className="chart-title">
            <Clock size={18} />
            Zahlungsverhalten
          </h3>
          {paymentBehaviorData.some(d => d.value > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentBehaviorData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                  >
                    {paymentBehaviorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="payment-stats">
                <div className="stat-item">
                  <span className="stat-label">Durchschn. Tage bis Zahlung:</span>
                  <span className="stat-value">{formatNumber(finance?.paymentBehavior?.avgDaysToPayment)} Tage</span>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              icon={Clock}
              title="Noch keine Zahlungsdaten"
              subtitle="Hier wird das Zahlungsverhalten analysiert"
            />
          )}
        </div>
      </div>

      {/* Subscription Revenue Breakdown */}
      <div className="finance-section">
        <h3 className="section-title">
          <DollarSign size={18} />
          Subscription Revenue Details
        </h3>
        {Array.isArray(finance?.subscriptionRevenue?.breakdown) && finance.subscriptionRevenue.breakdown.length > 0 ? (
          <div className="subscription-grid">
            {finance.subscriptionRevenue.breakdown.map((sub, idx) => (
              <div key={idx} className="subscription-card">
                <div className="sub-plan">{sub.plan_name || 'Standard Plan'}</div>
                <div className="sub-details">
                  <div className="sub-count">{formatNumber(sub.anzahl)} Dojos</div>
                  <div className="sub-price">{formatNumber(sub.preis_monatlich, 2)} € / Monat</div>
                  <div className="sub-total">
                    = {formatNumber((parseFloat(sub.preis_monatlich) || 0) * (parseInt(sub.anzahl) || 0), 2)} € / Monat
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={DollarSign}
            title="Keine Subscriptions"
            subtitle="Hier werden die aktiven Abo-Pläne angezeigt"
          />
        )}
      </div>

      {/* Open/Overdue Invoices Table */}
      <div className="finance-section">
        <h3 className="section-title">
          <AlertCircle size={18} />
          Top 10 Offene/Überfällige Rechnungen
        </h3>
        {Array.isArray(finance?.openInvoices) && finance.openInvoices.length > 0 ? (
          <div className="finance-table-container">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Rechnung</th>
                  <th>Dojo</th>
                  <th>Mitglied</th>
                  <th>Betrag</th>
                  <th>Fällig am</th>
                  <th>Überfällig</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {finance.openInvoices.map((inv, idx) => (
                  <tr key={idx} className={inv.tage_ueberfaellig > 0 ? 'overdue' : ''}>
                    <td className="invoice-number">{inv.rechnungsnummer}</td>
                    <td>{inv.dojoname}</td>
                    <td>{inv.vorname} {inv.nachname}</td>
                    <td className="amount">{formatNumber(inv.gesamtsumme, 2)} €</td>
                    <td>{inv.faellig_am ? new Date(inv.faellig_am).toLocaleDateString('de-DE') : '-'}</td>
                    <td className="overdue-days">
                      {inv.tage_ueberfaellig > 0 ? `${inv.tage_ueberfaellig} Tage` : '-'}
                    </td>
                    <td>
                      <span className={`status-badge ${inv.tage_ueberfaellig > 0 ? 'overdue' : 'pending'}`}>
                        {inv.tage_ueberfaellig > 0 ? 'Überfällig' : 'Offen'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={CheckCircle}
            title="Keine offenen Rechnungen"
            subtitle="Alle Rechnungen sind bezahlt - super!"
          />
        )}
      </div>

      {/* Average Revenue per Member */}
      <div className="finance-section">
        <h3 className="section-title">
          <DollarSign size={18} />
          Durchschnittlicher Umsatz pro Mitglied
        </h3>
        {Array.isArray(finance?.avgRevenuePerMember) && finance.avgRevenuePerMember.length > 0 ? (
          <div className="avg-revenue-grid">
            {finance.avgRevenuePerMember.map((dojo, idx) => (
              <div key={idx} className="avg-revenue-card">
                <div className="dojo-name">{dojo.dojoname}</div>
                <div className="avg-amount">
                  {formatNumber(dojo.avg_umsatz_pro_mitglied, 2)} €
                </div>
                <div className="member-count">{formatNumber(dojo.aktive_mitglieder)} aktive Mitglieder</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={BarChart2}
            title="Noch keine Daten"
            subtitle="Hier wird der durchschnittliche Umsatz pro Mitglied angezeigt"
          />
        )}
      </div>
    </div>
  );
};

export default FinanceTab;
