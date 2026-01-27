import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { TrendingUp, Users, DollarSign, Target, Award } from 'lucide-react';

const COLORS = ['#FFD700', '#FFA500', '#FF6B35', '#4ECDC4', '#45B7D1', '#96CEB4'];

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

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
    return null;
  }

  // Prepare Revenue Trend Data with month names
  const revenueTrendData = statistics.revenueTrend.map(item => ({
    monat: MONTH_NAMES[item.monat - 1],
    umsatz: item.umsatz
  }));

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
            <div className="kpi-value">{statistics.conversionRate}%</div>
            <div className="kpi-sublabel">Trial → Active</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon primary">
            <Users size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Aktive Mitglieder</div>
            <div className="kpi-value">{statistics.memberStatus.aktiv}</div>
            <div className="kpi-sublabel">von {statistics.memberStatus.aktiv + statistics.memberStatus.inaktiv} gesamt</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon warning">
            <Award size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Trial Dojos</div>
            <div className="kpi-value">{statistics.trialStats.trial}</div>
            <div className="kpi-sublabel">{statistics.trialStats.active} aktive Abos</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon success">
            <DollarSign size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Gesamt-Umsatz 2026</div>
            <div className="kpi-value">
              {statistics.revenuePerDojo.reduce((sum, d) => sum + d.umsatz, 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
            </div>
            <div className="kpi-sublabel">Alle Dojos</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Umsatz-Entwicklung */}
        <div className="chart-card">
          <h3 className="chart-title">
            <TrendingUp size={18} />
            Umsatz-Entwicklung 2026
          </h3>
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
              />
              <Area type="monotone" dataKey="umsatz" stroke="#FFD700" fillOpacity={1} fill="url(#colorUmsatz)" />
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
            <BarChart data={statistics.revenuePerDojo}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="dojoname" stroke="#fff" angle={-45} textAnchor="end" height={100} />
              <YAxis stroke="#fff" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                labelStyle={{ color: '#FFD700' }}
              />
              <Bar dataKey="umsatz" fill="#FFD700" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Subscription Status Verteilung */}
        <div className="chart-card">
          <h3 className="chart-title">
            <Award size={18} />
            Subscription Status
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statistics.subscriptionDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ status, anzahl }) => `${status}: ${anzahl}`}
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
        </div>

        {/* Top Dojos nach Mitgliedern */}
        <div className="chart-card">
          <h3 className="chart-title">
            <Users size={18} />
            Top Dojos nach Mitgliedern
          </h3>
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
        </div>
      </div>
    </div>
  );
};

export default StatisticsTab;
