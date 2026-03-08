import React, { useState, useEffect } from 'react';
import '../styles/StatisticsTab.css';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { TrendingUp, Users, DollarSign, Target, Award, BarChart2, Building2, UserCheck, UserX, Clock } from 'lucide-react';

// Sanfte, professionelle Farbpalette
const COLORS = {
  primary: '#3B82F6',    // Blau
  success: '#10B981',    // Grün
  warning: '#F59E0B',    // Orange
  danger: '#EF4444',     // Rot
  purple: '#8B5CF6',     // Lila
  teal: '#14B8A6',       // Türkis
  slate: '#64748B',      // Grau
  gold: '#D4AF37'        // Dezentes Gold
};

const STATUS_COLORS = {
  'active': COLORS.success,
  'trial': COLORS.primary,
  'expired': COLORS.danger,
  'cancelled': COLORS.slate,
  'pending': COLORS.warning
};

const STATUS_LABELS = {
  'active': 'Aktiv',
  'trial': 'Testphase',
  'expired': 'Abgelaufen',
  'cancelled': 'Gekündigt',
  'pending': 'Ausstehend'
};

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
  <div className="empty-state mst-empty-state">
    <Icon size={48} className="mst-empty-icon" />
    <div className="mst-empty-title">{title}</div>
    <div className="mst-empty-sub">{subtitle}</div>
  </div>
);

// Status Badge Komponente
const StatusBadge = ({ status, count }) => {
  const label = STATUS_LABELS[status] || status;
  const statusKey = status || 'default';

  return (
    <div className={`mst-status-badge mst-status-badge--${statusKey}`}>
      <div className="mst-status-badge-inner">
        <div className={`mst-status-dot mst-status-dot--${statusKey}`} />
        <span className="mst-status-label">{label}</span>
      </div>
      <span className={`mst-status-count mst-status-count--${statusKey}`}>{count}</span>
    </div>
  );
};

// Top Dojo Card Komponente
const TopDojoCard = ({ rank, dojo, maxMembers }) => {
  const percentage = maxMembers > 0 ? (dojo.mitglieder / maxMembers) * 100 : 0;

  return (
    <div className="mst-top-dojo-card">
      <div className={`mst-rank-badge mst-rank-badge--${rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'default'}`}>
        {rank}
      </div>
      <div className="u-flex-1">
        <div className="mst-dojo-name">
          {dojo.dojoname}
        </div>
        <div className="mst-progress-track">
          <div className="mst-progress-bar" style={{ width: `${percentage}%` }} />
        </div>
      </div>
      <div className="mst-dojo-count-right">
        <div className="mst-dojo-count-num">
          {formatNumber(dojo.mitglieder)}
        </div>
        <div className="mst-dojo-count-label">
          Mitglieder
        </div>
      </div>
    </div>
  );
};

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
  const trialStats = statistics.trialStats || { trial: 0, active: 0, expired: 0 };
  const revenuePerDojo = Array.isArray(statistics.revenuePerDojo) ? statistics.revenuePerDojo : [];
  const revenueTrend = Array.isArray(statistics.revenueTrend) ? statistics.revenueTrend : [];
  const subscriptionDistribution = Array.isArray(statistics.subscriptionDistribution) ? statistics.subscriptionDistribution : [];
  const topDojos = Array.isArray(statistics.topDojos) ? statistics.topDojos : [];

  // Prepare Revenue Trend Data with month names
  const revenueTrendData = revenueTrend.map(item => ({
    monat: MONTH_NAMES[(item.monat || 1) - 1],
    umsatz: parseFloat(item.umsatz) || 0
  }));

  // Berechne Gesamtumsatz sicher
  const totalRevenue = safeSum(revenuePerDojo, 'umsatz');
  const totalMembers = (memberStatus.aktiv || 0) + (memberStatus.inaktiv || 0);
  const hasRevenueData = totalRevenue > 0 || revenueTrendData.some(d => d.umsatz > 0);
  const maxMembers = topDojos.length > 0 ? Math.max(...topDojos.map(d => d.mitglieder || 0)) : 0;

  // Subscription Status für Pie Chart aufbereiten
  const pieData = subscriptionDistribution.map(item => ({
    name: STATUS_LABELS[item.status] || item.status,
    value: item.anzahl,
    color: STATUS_COLORS[item.status] || COLORS.slate
  }));

  return (
    <div className="statistics-tab">
      {/* KPI Cards */}
      <div className="stats-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon kpi-icon--success">
            <Target size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Conversion Rate</div>
            <div className="kpi-value">{formatNumber(statistics.conversionRate || 0)}%</div>
            <div className="kpi-sublabel">Trial → Active</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon kpi-icon--primary">
            <Users size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Aktive Mitglieder</div>
            <div className="kpi-value">{formatNumber(memberStatus.aktiv)}</div>
            <div className="kpi-sublabel">von {formatNumber(totalMembers)} gesamt</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon kpi-icon--purple">
            <Building2 size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Dojos</div>
            <div className="kpi-value">{formatNumber(trialStats.active + trialStats.trial)}</div>
            <div className="kpi-sublabel">{formatNumber(trialStats.trial)} in Testphase</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon kpi-icon--teal">
            <DollarSign size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Umsatz {new Date().getFullYear()}</div>
            <div className="kpi-value">
              {totalRevenue > 0 ? `${formatNumber(totalRevenue, 2)} €` : '—'}
            </div>
            <div className="kpi-sublabel">{revenuePerDojo.length} Dojos aktiv</div>
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
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="monat" stroke="rgba(255,255,255,0.6)" />
                <YAxis stroke="rgba(255,255,255,0.6)" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                  labelStyle={{ color: COLORS.primary }}
                  formatter={(value) => [`${formatNumber(value, 2)} €`, 'Umsatz']}
                />
                <Area type="monotone" dataKey="umsatz" stroke={COLORS.primary} strokeWidth={2} fillOpacity={1} fill="url(#colorUmsatz)" />
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
                <XAxis dataKey="dojoname" stroke="rgba(255,255,255,0.6)" angle={-45} textAnchor="end" height={100} />
                <YAxis stroke="rgba(255,255,255,0.6)" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                  labelStyle={{ color: COLORS.teal }}
                  formatter={(value) => [`${formatNumber(value, 2)} €`, 'Umsatz']}
                />
                <Bar dataKey="umsatz" fill={COLORS.teal} radius={[4, 4, 0, 0]} />
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

        {/* Subscription Status - Verbesserte Darstellung */}
        <div className="chart-card">
          <h3 className="chart-title">
            <Award size={18} />
            Abo-Status Übersicht
          </h3>
          {subscriptionDistribution.length > 0 ? (
            <div className="mst-subscription-wrapper">
              {/* Pie Chart */}
              <div className="mst-pie-container">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                      formatter={(value, name) => [value, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Status Liste */}
              <div className="u-flex-1">
                {subscriptionDistribution.map((item, index) => (
                  <StatusBadge
                    key={index}
                    status={item.status}
                    count={item.anzahl}
                  />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Award}
              title="Keine Abo-Daten"
              subtitle="Hier wird die Verteilung der Abo-Status angezeigt"
            />
          )}
        </div>

        {/* Top Dojos - Verbesserte Darstellung */}
        <div className="chart-card">
          <h3 className="chart-title">
            <Users size={18} />
            Top 10 Dojos nach Mitgliedern
          </h3>
          {topDojos.length > 0 ? (
            <div className="mst-dojos-scroll">
              {topDojos.slice(0, 10).map((dojo, index) => (
                <TopDojoCard
                  key={index}
                  rank={index + 1}
                  dojo={dojo}
                  maxMembers={maxMembers}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="Noch keine Dojos"
              subtitle="Top Dojos werden hier angezeigt, sobald Mitglieder registriert sind"
            />
          )}
        </div>
      </div>

      {/* Mitglieder Status Übersicht */}
      <div className="charts-grid mst-charts-grid-top">
        <div className="chart-card">
          <h3 className="chart-title">
            <UserCheck size={18} />
            Mitglieder-Status
          </h3>
          <div className="mst-member-status-row">
            <div className="mst-member-status-card mst-member-status-card--success">
              <UserCheck size={32} className="mst-member-status-icon mst-member-status-icon--success" />
              <div className="mst-member-status-num mst-member-status-num--success">
                {formatNumber(memberStatus.aktiv)}
              </div>
              <div className="mst-text-secondary-sm">Aktive Mitglieder</div>
            </div>
            <div className="mst-member-status-card mst-member-status-card--slate">
              <UserX size={32} className="mst-member-status-icon mst-member-status-icon--slate" />
              <div className="mst-member-status-num mst-member-status-num--slate">
                {formatNumber(memberStatus.inaktiv)}
              </div>
              <div className="mst-text-secondary-sm">Inaktive Mitglieder</div>
            </div>
            <div className="mst-member-status-card mst-member-status-card--primary">
              <Clock size={32} className="mst-member-status-icon mst-member-status-icon--primary" />
              <div className="mst-member-status-num mst-member-status-num--primary">
                {formatNumber(trialStats.trial)}
              </div>
              <div className="mst-text-secondary-sm">Trial Dojos</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsTab;
