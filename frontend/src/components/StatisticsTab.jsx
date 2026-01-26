import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { TrendingUp, Users, DollarSign, Target, Award, BarChart2 } from 'lucide-react';

const COLORS = ['#FFD700', '#FFA500', '#FF6B35', '#4ECDC4', '#45B7D1', '#96CEB4'];

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

// Hilfsfunktion für sichere Array-Summe
const safeSum = (array, key) => {
  if (!Array.isArray(array) || array.length === 0) return 0;
  return array.reduce((sum, item) => sum + (parseFloat(item[key]) || 0), 0);
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

const StatisticsTab = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statistics, setStatistics] = useState(null);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.get('/admin/statistics', {
        headers: { Authorization: `Bearer ${token}` }
      });

      setStatistics(response.data.statistics);
      console.log('✅ Statistiken geladen:', response.data.statistics);
    } catch (err) {
      console.error('❌ Fehler beim Laden der Statistiken:', err);
      setError(err.response?.data?.message || 'Fehler beim Laden der Statistiken');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="statistics-loading">
        <div className="loading-spinner"></div>
        <p>Lade Statistiken...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="statistics-error">
        <p>{error}</p>
        <button onClick={loadStatistics} className="btn btn-primary">
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className="statistics-tab">
        <EmptyState
          icon={BarChart2}
          title="Noch keine Statistiken verfügbar"
          subtitle="Sobald Daten vorliegen, werden hier Statistiken angezeigt"
        />
      </div>
    );
  }

  // Sichere Defaults für fehlende Daten
  const memberStatus = statistics.memberStatus || { aktiv: 0, inaktiv: 0 };
  const trialStats = statistics.trialStats || { trial: 0, active: 0 };
  const revenuePerDojo = Array.isArray(statistics.revenuePerDojo) ? statistics.revenuePerDojo : [];
  const revenueTrend = Array.isArray(statistics.revenueTrend) ? statistics.revenueTrend : [];

  // Prepare Revenue Trend Data with month names
  const revenueTrendData = revenueTrend.map(item => ({
    monat: MONTH_NAMES[(item.monat || 1) - 1],
    umsatz: parseFloat(item.umsatz) || 0
  }));

  // Berechne Gesamtumsatz sicher
  const totalRevenue = safeSum(revenuePerDojo, 'umsatz');
  const hasRevenueData = totalRevenue > 0 || revenueTrendData.some(d => d.umsatz > 0);

  return (
    <div className="statistics-tab">
      {/* KPI Cards */}
      <div className="stats-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon success">
            <Target size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Conversion Rate</div>
            <div className="kpi-value">{formatNumber(statistics.conversionRate || 0)}%</div>
            <div className="kpi-sublabel">Trial → Active</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon primary">
            <Users size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Aktive Mitglieder</div>
            <div className="kpi-value">{formatNumber(memberStatus.aktiv)}</div>
            <div className="kpi-sublabel">von {formatNumber((memberStatus.aktiv || 0) + (memberStatus.inaktiv || 0))} gesamt</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon warning">
            <Award size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Trial Dojos</div>
            <div className="kpi-value">{formatNumber(trialStats.trial)}</div>
            <div className="kpi-sublabel">{formatNumber(trialStats.active)} aktive Abos</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon success">
            <DollarSign size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Gesamt-Umsatz {new Date().getFullYear()}</div>
            <div className="kpi-value">
              {totalRevenue > 0 ? `${formatNumber(totalRevenue, 2)} €` : 'Noch keine Umsätze'}
            </div>
            <div className="kpi-sublabel">{revenuePerDojo.length > 0 ? `${revenuePerDojo.length} Dojos` : 'Keine Daten'}</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Umsatz-Entwicklung */}
        <div className="chart-card">
          <h3 className="chart-title">
            <TrendingUp size={18} />
            Umsatz-Entwicklung {new Date().getFullYear()}
          </h3>
          {revenueTrendData.length > 0 && hasRevenueData ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueTrendData}>
                <defs>
                  <linearGradient id="colorUmsatz" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFD700" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#FFD700" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="monat" stroke="#fff" />
                <YAxis stroke="#fff" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                  labelStyle={{ color: '#FFD700' }}
                  formatter={(value) => [`${formatNumber(value, 2)} €`, 'Umsatz']}
                />
                <Area type="monotone" dataKey="umsatz" stroke="#FFD700" fillOpacity={1} fill="url(#colorUmsatz)" />
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
          {revenuePerDojo.length > 0 && totalRevenue > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenuePerDojo}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="dojoname" stroke="#fff" angle={-45} textAnchor="end" height={100} />
                <YAxis stroke="#fff" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                  labelStyle={{ color: '#FFD700' }}
                  formatter={(value) => [`${formatNumber(value, 2)} €`, 'Umsatz']}
                />
                <Bar dataKey="umsatz" fill="#FFD700" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={DollarSign}
              title="Noch keine Umsätze pro Dojo"
              subtitle="Hier werden Umsätze nach Dojo aufgeschlüsselt"
            />
          )}
        </div>

        {/* Subscription Status Verteilung */}
        <div className="chart-card">
          <h3 className="chart-title">
            <Award size={18} />
            Subscription Status
          </h3>
          {Array.isArray(statistics.subscriptionDistribution) && statistics.subscriptionDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statistics.subscriptionDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, anzahl }) => `${status}: ${formatNumber(anzahl)}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="anzahl"
                  nameKey="status"
                >
                  {statistics.subscriptionDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={Award}
              title="Keine Abonnements"
              subtitle="Hier wird die Verteilung der Abo-Status angezeigt"
            />
          )}
        </div>

        {/* Top Dojos nach Mitgliedern */}
        <div className="chart-card">
          <h3 className="chart-title">
            <Users size={18} />
            Top Dojos nach Mitgliedern
          </h3>
          {Array.isArray(statistics.topDojos) && statistics.topDojos.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statistics.topDojos} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis type="number" stroke="#fff" />
                <YAxis dataKey="dojoname" type="category" stroke="#fff" width={150} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                  labelStyle={{ color: '#FFD700' }}
                />
                <Bar dataKey="mitglieder" fill="#4ECDC4" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={Users}
              title="Noch keine Dojos mit Mitgliedern"
              subtitle="Top Dojos werden hier angezeigt, sobald Mitglieder registriert sind"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default StatisticsTab;
