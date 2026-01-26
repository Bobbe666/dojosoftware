import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { DollarSign, TrendingUp, AlertCircle, Clock, CheckCircle } from 'lucide-react';

const COLORS = ['#4ECDC4', '#FFD700', '#FF6B35', '#45B7D1', '#96CEB4', '#FFA500'];

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

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
            <div className="kpi-label">Gesamt-Umsatz 2026</div>
            <div className="kpi-value">
              {parseFloat(finance?.overview?.totalRevenue || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
            </div>
            <div className="kpi-sublabel">{finance.overview.totalInvoices} Rechnungen</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon primary">
            <TrendingUp size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">MRR (Monthly Recurring Revenue)</div>
            <div className="kpi-value">
              {parseFloat(finance?.subscriptionRevenue?.monthlyRecurringRevenue || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
            </div>
            <div className="kpi-sublabel">ARR: {parseFloat(finance?.subscriptionRevenue?.annualRecurringRevenue || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon warning">
            <AlertCircle size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Offene Rechnungen</div>
            <div className="kpi-value">
              {parseFloat(finance?.overview?.unpaidAmount || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
            </div>
            <div className="kpi-sublabel">{finance.overview.unpaidInvoices} Rechnungen</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon success">
            <CheckCircle size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Zahlungsmoral</div>
            <div className="kpi-value">{finance?.paymentBehavior?.onTimeRate || 0}%</div>
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
            Monatliche Umsatz-Entwicklung 2026
          </h3>
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
        </div>

        {/* Umsatz pro Dojo */}
        <div className="chart-card">
          <h3 className="chart-title">
            <DollarSign size={18} />
            Umsatz pro Dojo
          </h3>
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
        </div>

        {/* Zahlungsverhalten */}
        <div className="chart-card">
          <h3 className="chart-title">
            <Clock size={18} />
            Zahlungsverhalten
          </h3>
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
              <span className="stat-value">{finance.paymentBehavior.avgDaysToPayment} Tage</span>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Revenue Breakdown */}
      <div className="finance-section">
        <h3 className="section-title">
          <DollarSign size={18} />
          Subscription Revenue Details
        </h3>
        <div className="subscription-grid">
          {finance.subscriptionRevenue.breakdown.map((sub, idx) => (
            <div key={idx} className="subscription-card">
              <div className="sub-plan">{sub.plan_name || 'Standard Plan'}</div>
              <div className="sub-details">
                <div className="sub-count">{sub.anzahl} Dojos</div>
                <div className="sub-price">{parseFloat(sub.preis_monatlich).toFixed(2)} € / Monat</div>
                <div className="sub-total">
                  = {(parseFloat(sub.preis_monatlich) * parseInt(sub.anzahl)).toLocaleString('de-DE', { minimumFractionDigits: 2 })} € / Monat
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Open/Overdue Invoices Table */}
      <div className="finance-section">
        <h3 className="section-title">
          <AlertCircle size={18} />
          Top 10 Offene/Überfällige Rechnungen
        </h3>
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
                  <td className="amount">{parseFloat(inv.gesamtsumme).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                  <td>{new Date(inv.faellig_am).toLocaleDateString('de-DE')}</td>
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
      </div>

      {/* Average Revenue per Member */}
      <div className="finance-section">
        <h3 className="section-title">
          <DollarSign size={18} />
          Durchschnittlicher Umsatz pro Mitglied
        </h3>
        <div className="avg-revenue-grid">
          {finance.avgRevenuePerMember.map((dojo, idx) => (
            <div key={idx} className="avg-revenue-card">
              <div className="dojo-name">{dojo.dojoname}</div>
              <div className="avg-amount">
                {parseFloat(dojo.avg_umsatz_pro_mitglied).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
              </div>
              <div className="member-count">{dojo.aktive_mitglieder} aktive Mitglieder</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FinanceTab;
