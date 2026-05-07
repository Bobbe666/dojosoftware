// ============================================================================
// SUPPORT PORTAL — support.tda-intl.org
// Eigenständiges Portal für Support-Tickets und Wunschliste
// Zugänglich für Enterprise-Dojo-Admins, Mitglieder und Super-Admins
// ============================================================================

import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import SupportTickets from './SupportTickets';
import FeatureBoard from './FeatureBoard';
import { Ticket, Lightbulb, BarChart3, LogOut, Shield, Building2 } from 'lucide-react';
import '../styles/SupportPortal.css';

// ── Login-Seite des Portals ────────────────────────────────────────────────
const SupportLogin = () => {
  const { login, logout } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userData = await login({ username: form.username, password: form.password });
      if (userData && userData.support_app_access === false) {
        logout();
        setError('Kein Zugriff auf das Support-Portal');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sp-login-page">
      <div className="sp-login-card">
        <div className="sp-login-logo">
          <Shield size={36} className="sp-login-icon" />
          <h1 className="sp-login-title">TDA Support</h1>
          <p className="sp-login-subtitle">Melde dich mit deinen Dojo-Zugangsdaten an</p>
        </div>

        <form onSubmit={handleSubmit} className="sp-login-form">
          {error && <div className="sp-login-error">{error}</div>}

          <div className="sp-login-field">
            <label>Benutzername</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="Benutzername"
              autoFocus
              required
            />
          </div>

          <div className="sp-login-field">
            <label>Passwort</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Passwort"
              required
            />
          </div>

          <button type="submit" className="sp-login-btn" disabled={loading}>
            {loading ? 'Anmelden...' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ── Haupt-Portal nach Login ────────────────────────────────────────────────
const SupportPortalApp = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('tickets');

  const isSuperAdmin = user?.dojo_id === null || user?.dojo_id === undefined;
  const displayName = user?.name || user?.username || user?.vorname || 'Benutzer';

  const tabs = [
    { id: 'tickets',     label: 'Support-Tickets', icon: Ticket },
    { id: 'wunschliste', label: 'Wunschliste',     icon: Lightbulb },
  ];

  const bereich = isSuperAdmin ? 'org' : 'dojo';

  return (
    <div className="sp-app">
      {/* Header */}
      <header className="sp-header">
        <div className="sp-header-brand">
          <Shield size={22} className="sp-header-icon" />
          <span className="sp-header-title">TDA Support-Portal</span>
        </div>

        <nav className="sp-header-tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`sp-header-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="sp-header-user">
          {isSuperAdmin
            ? <span className="sp-badge sp-badge--admin">Super-Admin</span>
            : <span className="sp-badge sp-badge--dojo"><Building2 size={12} /> Dojo</span>
          }
          <span className="sp-header-username">{displayName}</span>
          <button className="sp-logout-btn" onClick={logout} title="Abmelden">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="sp-main">
        {activeTab === 'tickets' && (
          <SupportTickets
            bereich={bereich}
            showAllBereiche={isSuperAdmin}
            compact={false}
          />
        )}
        {activeTab === 'wunschliste' && (
          <FeatureBoard adminMode={isSuperAdmin} />
        )}
      </main>
    </div>
  );
};

// ── Root-Komponente: Login-Gate ────────────────────────────────────────────
const SupportPortal = () => {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="sp-loading">
        <div className="sp-loading-spinner" />
      </div>
    );
  }

  return token ? <SupportPortalApp /> : <SupportLogin />;
};

export default SupportPortal;
