import React, { useState, useEffect } from 'react';
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

// Status Badge Komponente
const StatusBadge = ({ status, count }) => {
  const color = STATUS_COLORS[status] || COLORS.slate;
  const label = STATUS_LABELS[status] || status;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      background: `${color}15`,
      borderLeft: `4px solid ${color}`,
      borderRadius: '0 8px 8px 0',
      marginBottom: '8px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: color
        }} />
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{label}</span>
      </div>
      <span style={{
        color: color,
        fontWeight: 700,
        fontSize: '1.2rem'
      }}>{count}</span>
    </div>
  );
};

// Top Dojo Card Komponente
const TopDojoCard = ({ rank, dojo, maxMembers }) => {
  const percentage = maxMembers > 0 ? (dojo.mitglieder / maxMembers) * 100 : 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '16px',
      background: 'var(--bg-tertiary)',
      borderRadius: '12px',
      marginBottom: '10px',
      border: '1px solid var(--border-default)'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        background: rank <= 3
          ? `linear-gradient(135deg, ${rank === 1 ? '#D4AF37' : rank === 2 ? '#C0C0C0' : '#CD7F32'}, ${rank === 1 ? '#B8860B' : rank === 2 ? '#A8A8A8' : '#8B4513'})`
          : 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: '1.1rem',
        color: rank <= 3 ? '#fff' : 'var(--text-secondary)'
      }}>
        {rank}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '6px'
        }}>
          {dojo.dojoname}
        </div>
        <div style={{
          height: '6px',
          background: 'var(--bg-secondary)',
          borderRadius: '3px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${percentage}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.teal})`,
            borderRadius: '3px',
            transition: 'width 0.5s ease'
          }} />
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 700, color: COLORS.primary, fontSize: '1.2rem' }}>
          {formatNumber(dojo.mitglieder)}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
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
          <div className="kpi-icon" style={{ background: `${COLORS.success}20`, color: COLORS.success }}>
            <Target size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Conversion Rate</div>
            <div className="kpi-value">{formatNumber(statistics.conversionRate || 0)}%</div>
            <div className="kpi-sublabel">Trial → Active</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: `${COLORS.primary}20`, color: COLORS.primary }}>
            <Users size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Aktive Mitglieder</div>
            <div className="kpi-value">{formatNumber(memberStatus.aktiv)}</div>
            <div className="kpi-sublabel">von {formatNumber(totalMembers)} gesamt</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: `${COLORS.purple}20`, color: COLORS.purple }}>
            <Building2 size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Dojos</div>
            <div className="kpi-value">{formatNumber(trialStats.active + trialStats.trial)}</div>
            <div className="kpi-sublabel">{formatNumber(trialStats.trial)} in Testphase</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: `${COLORS.teal}20`, color: COLORS.teal }}>
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
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              {/* Pie Chart */}
              <div style={{ flex: '0 0 180px' }}>
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
              <div style={{ flex: 1 }}>
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
            <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }}>
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
      <div className="charts-grid" style={{ marginTop: '24px' }}>
        <div className="chart-card">
          <h3 className="chart-title">
            <UserCheck size={18} />
            Mitglieder-Status
          </h3>
          <div style={{ display: 'flex', gap: '16px', padding: '16px 0' }}>
            <div style={{
              flex: 1,
              padding: '20px',
              background: `${COLORS.success}15`,
              borderRadius: '12px',
              textAlign: 'center',
              border: `1px solid ${COLORS.success}30`
            }}>
              <UserCheck size={32} style={{ color: COLORS.success, marginBottom: '8px' }} />
              <div style={{ fontSize: '2rem', fontWeight: 700, color: COLORS.success }}>
                {formatNumber(memberStatus.aktiv)}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Aktive Mitglieder</div>
            </div>
            <div style={{
              flex: 1,
              padding: '20px',
              background: `${COLORS.slate}15`,
              borderRadius: '12px',
              textAlign: 'center',
              border: `1px solid ${COLORS.slate}30`
            }}>
              <UserX size={32} style={{ color: COLORS.slate, marginBottom: '8px' }} />
              <div style={{ fontSize: '2rem', fontWeight: 700, color: COLORS.slate }}>
                {formatNumber(memberStatus.inaktiv)}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Inaktive Mitglieder</div>
            </div>
            <div style={{
              flex: 1,
              padding: '20px',
              background: `${COLORS.primary}15`,
              borderRadius: '12px',
              textAlign: 'center',
              border: `1px solid ${COLORS.primary}30`
            }}>
              <Clock size={32} style={{ color: COLORS.primary, marginBottom: '8px' }} />
              <div style={{ fontSize: '2rem', fontWeight: 700, color: COLORS.primary }}>
                {formatNumber(trialStats.trial)}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Trial Dojos</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsTab;
