// =============================================
// SUPER-ADMIN DASHBOARD - Tiger & Dragon Association International
// =============================================
// Nur sichtbar wenn Dojo-ID = 2 (TDA International) ausgewählt

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import config from '../config/config';
import {
  Building2, Users, TrendingUp, Globe, Plus, Edit, Trash2,
  CheckCircle, XCircle, BarChart3, Activity, Award, Calendar, HardDrive, Clock, AlertTriangle,
  ChevronDown, ChevronUp, LayoutDashboard, PieChart, DollarSign, FileText, UserCog, CreditCard, Save, ToggleLeft, ToggleRight, Euro, Ticket
} from 'lucide-react';
import StatisticsTab from './StatisticsTab';
import ContractsTab from './ContractsTab';
import UsersTab from './UsersTab';
import FinanzenTab from './FinanzenTab';
import BuchhaltungTab from './BuchhaltungTab';
import ZieleEntwicklung from './ZieleEntwicklung';
import SupportTickets from './SupportTickets';
import VerbandsMitglieder from './VerbandsMitglieder';
import ArtikelVerwaltung from './ArtikelVerwaltung';
import '../styles/SuperAdminDashboard.css';

const SuperAdminDashboard = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State für Statistiken
  const [tdaStats, setTdaStats] = useState(null);
  const [globalStats, setGlobalStats] = useState(null);
  const [dojos, setDojos] = useState([]);

  // State für Dojo-Management
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDojo, setSelectedDojo] = useState(null);

  // State für Trial-Management
  const [showExtendTrialModal, setShowExtendTrialModal] = useState(false);
  const [showActivateSubscriptionModal, setShowActivateSubscriptionModal] = useState(false);
  const [trialDays, setTrialDays] = useState(14);
  const [subscriptionPlan, setSubscriptionPlan] = useState('starter');
  const [subscriptionInterval, setSubscriptionInterval] = useState('monthly');
  const [subscriptionDuration, setSubscriptionDuration] = useState(12);
  const [customPrice, setCustomPrice] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [isMainSuperAdmin, setIsMainSuperAdmin] = useState(false);
  const [expandedDojos, setExpandedDojos] = useState(new Set());

  // State für Tab-Navigation
  const [activeTab, setActiveTab] = useState('overview');
  // State für Pläne-Verwaltung
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);
  const [plansLoading, setPlansLoading] = useState(false);

  // State für Shop-Bestellungen
  const [bestellungen, setBestellungen] = useState([]);
  const [bestellungenStats, setBestellungenStats] = useState(null);
  const [bestellungenLoading, setBestellungenLoading] = useState(false);
  const [bestellungenFilter, setBestellungenFilter] = useState('alle');
  const [selectedBestellung, setSelectedBestellung] = useState(null);
  const [bestellungUpdating, setBestellungUpdating] = useState(false);

  // State für E-Mail-Einstellungen
  const [emailSettings, setEmailSettings] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: true,
    smtp_user: '',
    smtp_password: '',
    default_from_email: 'noreply@tda-intl.com',
    default_from_name: 'DojoSoftware',
    aktiv: true
  });
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [testEmail, setTestEmail] = useState('');

  // Prüfe ob Main Super-Admin (nur für den Hauptadministrator)
  useEffect(() => {
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        // Nur für username="admin" oder user_id=1
        setIsMainSuperAdmin(decoded.username === 'admin' || decoded.user_id === 1);
      } catch (err) {
        console.error('Token decode error:', err);
      }
    }
  }, [token]);

  // Daten laden beim Mount
  useEffect(() => {
    loadAllData();
    loadSubscriptionPlans();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError('');

    try {
      // Parallel alle Daten laden
      const [tdaRes, globalRes, dojosRes] = await Promise.all([
        axios.get('/admin/tda-stats', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/admin/global-stats', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/admin/dojos', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setTdaStats(tdaRes.data.stats);
      setGlobalStats(globalRes.data.stats);
      setDojos(dojosRes.data.dojos);

      console.log('✅ Super-Admin Daten geladen');
    } catch (err) {
      console.error('❌ Fehler beim Laden der Super-Admin Daten:', err);
      setError(err.response?.data?.message || 'Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  // Subscription-Pläne laden
  const loadSubscriptionPlans = async () => {
    try {
      setPlansLoading(true);
      const response = await axios.get('/admin/subscription-plans', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setSubscriptionPlans(response.data.plans);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Pläne:', error);
    } finally {
      setPlansLoading(false);
    }
  };

  // E-Mail-Einstellungen laden
  const loadEmailSettings = async () => {
    try {
      setEmailLoading(true);
      const response = await axios.get('/email-settings/global', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setEmailSettings(response.data.data);
      }
    } catch (error) {
      console.error('Fehler beim Laden der E-Mail-Einstellungen:', error);
    } finally {
      setEmailLoading(false);
    }
  };

  // Shop-Bestellungen laden
  const loadBestellungen = async (statusFilter = 'alle') => {
    try {
      setBestellungenLoading(true);
      const params = statusFilter !== 'alle' ? `?status=${statusFilter}` : '';
      const response = await axios.get(`/verband-auth/admin/bestellungen${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setBestellungen(response.data.bestellungen);
        setBestellungenStats(response.data.stats);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Bestellungen:', error);
    } finally {
      setBestellungenLoading(false);
    }
  };

  // Bestellstatus aktualisieren
  const updateBestellungStatus = async (bestellungId, updates) => {
    try {
      setBestellungUpdating(true);
      const response = await axios.put(`/verband-auth/admin/bestellungen/${bestellungId}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        // Liste neu laden
        await loadBestellungen(bestellungenFilter);
        setSelectedBestellung(null);
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Bestellung:', error);
      alert('Fehler beim Aktualisieren');
    } finally {
      setBestellungUpdating(false);
    }
  };

  // E-Mail-Einstellungen speichern
  const saveEmailSettings = async () => {
    try {
      setEmailLoading(true);
      setEmailMessage('');
      const response = await axios.put('/email-settings/global', emailSettings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setEmailMessage('✅ E-Mail-Einstellungen erfolgreich gespeichert');
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      setEmailMessage('❌ Fehler beim Speichern: ' + (error.response?.data?.error || error.message));
    } finally {
      setEmailLoading(false);
    }
  };

  // Test-E-Mail senden
  const sendTestEmail = async () => {
    if (!testEmail) {
      setEmailMessage('⚠️ Bitte geben Sie eine Test-E-Mail-Adresse ein');
      return;
    }
    try {
      setEmailLoading(true);
      setEmailMessage('');
      const response = await axios.post('/email-settings/test', {
        test_email: testEmail,
        use_global: true
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setEmailMessage(`✅ ${response.data.message}`);
      }
    } catch (error) {
      console.error('Test-E-Mail fehlgeschlagen:', error);
      setEmailMessage('❌ ' + (error.response?.data?.error || error.message));
    } finally {
      setEmailLoading(false);
    }
  };

  // Lade E-Mail-Einstellungen wenn Tab aktiv
  useEffect(() => {
    if (activeTab === 'email') {
      loadEmailSettings();
    }
  }, [activeTab]);

  // Lade Bestellungen wenn Tab aktiv
  useEffect(() => {
    if (activeTab === 'bestellungen') {
      loadBestellungen(bestellungenFilter);
    }
  }, [activeTab, bestellungenFilter]);

  // Plan aktualisieren
  const updatePlan = async (planId, updates) => {
    try {
      const response = await axios.put(`/admin/subscription-plans/${planId}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        loadSubscriptionPlans();
        setEditingPlan(null);
        alert('Plan erfolgreich aktualisiert');
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      alert('Fehler beim Aktualisieren des Plans');
    }
  };

  const handleCreateDojo = () => {
    setSelectedDojo(null);
    setShowCreateModal(true);
  };

  const handleEditDojo = (dojo) => {
    setSelectedDojo(dojo);
    setShowEditModal(true);
  };

  const handleDeleteDojo = async (dojo) => {
    if (!confirm(`Möchten Sie "${dojo.dojoname}" wirklich deaktivieren?`)) {
      return;
    }

    try {
      await axios.delete(`/admin/dojos/${dojo.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(`Dojo "${dojo.dojoname}" wurde deaktiviert`);
      loadAllData(); // Neu laden
    } catch (err) {
      console.error('❌ Fehler beim Löschen:', err);
      alert(err.response?.data?.error || 'Fehler beim Löschen');
    }
  };

  // Trial-Management Handler
  const handleExtendTrial = (dojo) => {
    setSelectedDojo(dojo);
    setTrialDays(14);
    setShowExtendTrialModal(true);
  };

  const handleActivateSubscription = (dojo) => {
    setSelectedDojo(dojo);
    setSubscriptionPlan('basic');
    setSubscriptionInterval('monthly');
    setSubscriptionDuration(12);
    setCustomPrice('');
    setCustomNotes('');
    setShowActivateSubscriptionModal(true);
  };

  const confirmExtendTrial = async () => {
    if (!selectedDojo) return;

    try {
      await axios.put(
        `/admin/dojos/${selectedDojo.id}/extend-trial`,
        { days: trialDays },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(`Trial für "${selectedDojo.dojoname}" um ${trialDays} Tage verlängert`);
      setShowExtendTrialModal(false);
      loadAllData();
    } catch (err) {
      console.error('❌ Fehler beim Verlängern:', err);
      alert(err.response?.data?.error || 'Fehler beim Verlängern des Trials');
    }
  };

  const confirmActivateSubscription = async () => {
    if (!selectedDojo) return;

    try {
      const requestData = {
        plan: subscriptionPlan,
        interval: subscriptionInterval,
        duration_months: subscriptionDuration
      };

      // Zusätzliche Felder für custom/free (nur für Main Super-Admin)
      if (isMainSuperAdmin) {
        if (subscriptionPlan === 'free') {
          requestData.is_free = true;
        } else if (subscriptionPlan === 'custom') {
          requestData.custom_price = customPrice;
          requestData.custom_notes = customNotes;
        }
      }

      await axios.put(
        `/admin/dojos/${selectedDojo.id}/activate-subscription`,
        requestData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const message = subscriptionPlan === 'free'
        ? `Kostenloser Account für "${selectedDojo.dojoname}" aktiviert (unbegrenzt)`
        : subscriptionPlan === 'custom'
        ? `Custom Abo für "${selectedDojo.dojoname}" aktiviert (${customPrice}€, ${subscriptionDuration} Monate)`
        : `Abonnement für "${selectedDojo.dojoname}" aktiviert (${subscriptionPlan}, ${subscriptionDuration} Monate)`;

      alert(message);
      setShowActivateSubscriptionModal(false);
      loadAllData();
    } catch (err) {
      console.error('❌ Fehler beim Aktivieren:', err);
      alert(err.response?.data?.error || 'Fehler beim Aktivieren des Abonnements');
    }
  };

  // Helper-Funktionen
  const getSubscriptionStatusBadge = (dojo) => {
    const statusMap = {
      trial: { label: 'Trial', className: 'info', icon: <Clock size={14} /> },
      active: { label: 'Aktiv', className: 'success', icon: <CheckCircle size={14} /> },
      expired: { label: 'Abgelaufen', className: 'danger', icon: <XCircle size={14} /> },
      cancelled: { label: 'Gekündigt', className: 'warning', icon: <AlertTriangle size={14} /> },
      suspended: { label: 'Gesperrt', className: 'danger', icon: <XCircle size={14} /> }
    };

    const status = statusMap[dojo.subscription_status] || statusMap.trial;

    return (
      <span className={`status-badge ${status.className}`}>
        {status.icon} {status.label}
      </span>
    );
  };

  const getSubscriptionEndInfo = (dojo) => {
    if (dojo.subscription_status === 'trial') {
      const daysRemaining = dojo.trial_days_remaining;
      if (daysRemaining === null) return '-';
      if (daysRemaining < 0) return <span className="text-danger">Abgelaufen</span>;
      if (daysRemaining === 0) return <span className="text-danger">Heute</span>;
      if (daysRemaining <= 3) return <span className="text-danger">{daysRemaining} Tage</span>;
      if (daysRemaining <= 7) return <span className="text-warning">{daysRemaining} Tage</span>;
      return <span>{daysRemaining} Tage</span>;
    } else if (dojo.subscription_status === 'active') {
      const daysRemaining = dojo.subscription_days_remaining;
      if (daysRemaining === null) return '-';
      if (daysRemaining < 0) return <span className="text-danger">Abgelaufen</span>;
      if (daysRemaining === 0) return <span className="text-danger">Heute</span>;
      if (daysRemaining <= 14) return <span className="text-warning">{daysRemaining} Tage</span>;

      const endDate = new Date(dojo.subscription_ends_at);
      return endDate.toLocaleDateString('de-DE');
    }
    return '-';
  };

  const toggleDojoExpand = (dojoId) => {
    setExpandedDojos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dojoId)) {
        newSet.delete(dojoId);
      } else {
        newSet.add(dojoId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="super-admin-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Lade Super-Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="super-admin-dashboard">
        <div className="error-container">
          <XCircle size={48} />
          <h2>Fehler</h2>
          <p>{error}</p>
          <button onClick={loadAllData} className="btn btn-primary">
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  // Tab Definitions - wie im normalen Dashboard
  // Verbandsmitglieder wurden ins separate Verband-Dashboard verschoben
  const tabs = [
    { id: 'overview', label: 'Übersicht', icon: '📊' },
    { id: 'verbandsmitglieder', label: 'Verbandsmitglieder', icon: '🏆' },
    { id: 'shop', label: 'Artikel/Shop', icon: '🛒' },
    { id: 'bestellungen', label: 'Bestellungen', icon: '📦' },
    { id: 'entwicklung', label: 'Entwicklung', icon: '🎯' },
    { id: 'support', label: 'Support', icon: '🎫' },
    { id: 'statistics', label: 'Statistiken', icon: '📈' },
    { id: 'finanzen', label: 'Finanzen', icon: '💰' },
    { id: 'buchhaltung', label: 'Buchhaltung', icon: '📒' },
    { id: 'contracts', label: 'Verträge', icon: '📄' },
    { id: 'users', label: 'Benutzer', icon: '👤' },
    { id: 'plans', label: 'Pläne & Preise', icon: '💳' },
    { id: 'email', label: 'E-Mail', icon: '✉️' }
  ];

  return (
    <div className="super-admin-dashboard">
      {/* Tab Navigation - wie im normalen Dashboard */}
      <div className="dashboard-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`dashboard-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <>
            {/* TDA International Statistiken */}
            <section className="stats-section">
        <h2 className="section-title">
          <Building2 size={20} />
          TDA International Statistiken
        </h2>
        <div className="stats-grid">
          <div className="stat-card primary">
            <div className="stat-icon">
              <Users size={32} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{tdaStats?.members?.active_members || 0}</div>
              <div className="stat-label">Aktive Mitglieder</div>
              <div className="stat-sublabel">
                von {tdaStats?.members?.total_members || 0} gesamt
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Globale Statistiken (Alle Dojos) */}
      <section className="stats-section">
        <h2 className="section-title">
          <Globe size={20} />
          Verbandsstatistiken (Alle Dojos)
        </h2>
        <div className="stats-grid">
          <div className="stat-card global-primary">
            <div className="stat-icon">
              <Building2 size={32} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{globalStats?.dojos?.active_dojos || 0}</div>
              <div className="stat-label">Aktive Dojos</div>
              <div className="stat-sublabel">
                von {globalStats?.dojos?.total_dojos || 0} gesamt
              </div>
            </div>
          </div>

          <div className="stat-card global-success">
            <div className="stat-icon">
              <Users size={32} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{globalStats?.members?.active_members || 0}</div>
              <div className="stat-label">Mitglieder (Verband)</div>
              <div className="stat-sublabel">
                in {globalStats?.members?.dojos_with_members || 0} Dojos
              </div>
            </div>
          </div>

          <div className="stat-card global-warning">
            <div className="stat-icon">
              <HardDrive size={32} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{globalStats?.storage?.used_gb || '0'} / {globalStats?.storage?.total_gb || '0'} GB</div>
              <div className="stat-label">Server-Speicher</div>
              <div className="stat-sublabel">
                {globalStats?.storage?.percent_used || 0}% belegt
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dojo-Verwaltung */}
      <section className="dojos-section">
        <div className="section-header">
          <h2 className="section-title">
            <BarChart3 size={20} />
            Dojo-Verwaltung
          </h2>
          <div className="header-actions">
            <button onClick={handleCreateDojo} className="btn btn-primary">
              <Plus size={16} />
              Neues Dojo anlegen
            </button>
          </div>
        </div>

        <div className="dojos-table-container">
          <table className="dojos-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Status</th>
                <th>Dojo-Name</th>
                <th>Subdomain</th>
                <th>Inhaber</th>
                <th>Ort</th>
                <th className="text-center">Mitglieder</th>
                <th className="text-center">Kurse</th>
                <th className="text-center">Speicher</th>
                <th className="text-center">Abo-Status</th>
                <th className="text-center">Trial/Abo Ende</th>
              </tr>
            </thead>
            <tbody>
              {dojos.map((dojo) => {
                const isExpanded = expandedDojos.has(dojo.id);
                return (
                  <React.Fragment key={dojo.id}>
                    <tr 
                      className={`dojo-row ${!dojo.ist_aktiv ? 'inactive' : ''} ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleDojoExpand(dojo.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <button 
                          className="expand-toggle"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDojoExpand(dojo.id);
                          }}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                      <td>
                        {dojo.ist_aktiv ? (
                          <span className="status-badge active">
                            <CheckCircle size={14} /> Aktiv
                          </span>
                        ) : (
                          <span className="status-badge inactive">
                            <XCircle size={14} /> Inaktiv
                          </span>
                        )}
                      </td>
                      <td className="font-bold">{dojo.dojoname}</td>
                      <td>
                        <code className="subdomain">{dojo.subdomain}</code>
                      </td>
                      <td>{dojo.inhaber}</td>
                      <td>{dojo.ort || '-'}</td>
                      <td className="text-center">{dojo.mitglieder_count || 0}</td>
                      <td className="text-center">{dojo.kurse_count || 0}</td>
                      <td className="text-center">
                        {dojo.storage_mb >= 1024
                          ? `${dojo.storage_gb} GB`
                          : `${dojo.storage_mb} MB`}
                      </td>
                      <td className="text-center">
                        {getSubscriptionStatusBadge(dojo)}
                      </td>
                      <td className="text-center">
                        {getSubscriptionEndInfo(dojo)}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="expandable-row">
                        <td colSpan={11} className="expandable-cell">
                          <div className="dojo-details-panel">
                            {/* Kontaktdaten */}
                            <div className="details-card">
                              <div className="details-card-header">
                                <span className="details-card-icon">📍</span>
                                <h4>Kontaktdaten</h4>
                              </div>
                              <div className="details-card-body">
                                <div className="details-row">
                                  <span className="details-label">E-Mail</span>
                                  <span className="details-value">{dojo.email || '-'}</span>
                                </div>
                                <div className="details-row">
                                  <span className="details-label">Telefon</span>
                                  <span className="details-value">{dojo.telefon || '-'}</span>
                                </div>
                                <div className="details-row">
                                  <span className="details-label">Adresse</span>
                                  <span className="details-value">
                                    {dojo.strasse || dojo.plz || dojo.ort
                                      ? `${dojo.strasse || ''} ${dojo.hausnummer || ''}, ${dojo.plz || ''} ${dojo.ort || ''}`
                                      : '-'}
                                  </span>
                                </div>
                                <div className="details-row">
                                  <span className="details-label">Land</span>
                                  <span className="details-value">{dojo.land || 'Deutschland'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Abonnement Details */}
                            <div className="details-card">
                              <div className="details-card-header">
                                <span className="details-card-icon">💳</span>
                                <h4>Abonnement</h4>
                              </div>
                              <div className="details-card-body">
                                <div className="details-row">
                                  <span className="details-label">Status</span>
                                  <span className="details-value">{getSubscriptionStatusBadge(dojo)}</span>
                                </div>
                                {dojo.subscription_status === 'trial' && (
                                  <>
                                    <div className="details-row">
                                      <span className="details-label">Trial Start</span>
                                      <span className="details-value">
                                        {dojo.trial_starts_at ? new Date(dojo.trial_starts_at).toLocaleDateString('de-DE') : '-'}
                                      </span>
                                    </div>
                                    <div className="details-row">
                                      <span className="details-label">Trial Ende</span>
                                      <span className="details-value">
                                        {dojo.trial_ends_at ? new Date(dojo.trial_ends_at).toLocaleDateString('de-DE') : '-'}
                                      </span>
                                    </div>
                                    <div className="details-row highlight">
                                      <span className="details-label">Verbleibend</span>
                                      <span className="details-value countdown">
                                        {dojo.trial_days_remaining !== null ? `${dojo.trial_days_remaining} Tage` : '-'}
                                      </span>
                                    </div>
                                  </>
                                )}
                                {dojo.subscription_status === 'active' && (
                                  <>
                                    <div className="details-row">
                                      <span className="details-label">Plan</span>
                                      <span className="details-value plan-badge">{dojo.subscription_plan || '-'}</span>
                                    </div>
                                    <div className="details-row">
                                      <span className="details-label">Intervall</span>
                                      <span className="details-value">{dojo.subscription_interval || '-'}</span>
                                    </div>
                                    <div className="details-row">
                                      <span className="details-label">Abo Start</span>
                                      <span className="details-value">
                                        {dojo.subscription_starts_at ? new Date(dojo.subscription_starts_at).toLocaleDateString('de-DE') : '-'}
                                      </span>
                                    </div>
                                    <div className="details-row">
                                      <span className="details-label">Abo Ende</span>
                                      <span className="details-value">
                                        {dojo.subscription_ends_at ? new Date(dojo.subscription_ends_at).toLocaleDateString('de-DE') : '-'}
                                      </span>
                                    </div>
                                    {dojo.subscription_days_remaining !== null && (
                                      <div className="details-row highlight">
                                        <span className="details-label">Verbleibend</span>
                                        <span className="details-value countdown">{dojo.subscription_days_remaining} Tage</span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Aktionen */}
                            <div className="details-card actions-card">
                              <div className="details-card-header">
                                <span className="details-card-icon">⚡</span>
                                <h4>Aktionen</h4>
                              </div>
                              <div className="details-card-body">
                                <div className="action-buttons-grid">
                                  {dojo.subscription_status === 'trial' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleExtendTrial(dojo);
                                      }}
                                      className="action-btn warning"
                                      title="Trial verlängern"
                                    >
                                      <Clock size={16} />
                                      <span>Trial verlängern</span>
                                    </button>
                                  )}
                                  {(dojo.subscription_status === 'trial' || dojo.subscription_status === 'expired') && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleActivateSubscription(dojo);
                                      }}
                                      className="action-btn success"
                                      title="Abo aktivieren"
                                    >
                                      <CheckCircle size={16} />
                                      <span>Abo aktivieren</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditDojo(dojo);
                                    }}
                                    className="action-btn secondary"
                                    title="Bearbeiten"
                                  >
                                    <Edit size={16} />
                                    <span>Bearbeiten</span>
                                  </button>
                                  {dojo.id !== 2 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteDojo(dojo);
                                      }}
                                      className="action-btn danger"
                                      title="Deaktivieren"
                                    >
                                      <Trash2 size={16} />
                                      <span>Deaktivieren</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {dojos.length === 0 && (
            <div className="empty-state">
              <Building2 size={48} />
              <p>Keine Dojos gefunden</p>
            </div>
          )}
        </div>
      </section>

      {/* Top Dojos Ranking */}
      {globalStats?.top_dojos && globalStats.top_dojos.length > 0 && (
        <section className="top-dojos-section">
          <h2 className="section-title">
            <TrendingUp size={20} />
            Top Dojos nach Mitgliederzahl
          </h2>
          <div className="top-dojos-grid">
            {globalStats.top_dojos.slice(0, 5).map((dojo, index) => (
              <div key={dojo.id} className="top-dojo-card">
                <div className="ranking-badge">#{index + 1}</div>
                <div className="dojo-info">
                  <h3>{dojo.dojoname}</h3>
                  <div className="dojo-stats">
                    <span><Users size={14} /> {dojo.member_count} Mitglieder</span>
                    <span><Activity size={14} /> {dojo.course_count} Kurse</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
          </>
        )}

        {/* Verbandsmitglieder Tab */}
        {activeTab === 'verbandsmitglieder' && (
          <VerbandsMitglieder />
        )}

        {/* Artikel/Shop Tab */}
        {activeTab === 'shop' && (
          <ArtikelVerwaltung />
        )}

        {/* Bestellungen Tab */}
        {activeTab === 'bestellungen' && (
          <section className="bestellungen-section">
            <h2 className="section-title">
              📦 Shop-Bestellungen
            </h2>

            {/* Statistik-Karten */}
            {bestellungenStats && (
              <div className="bestellungen-stats">
                <div className="stat-card stat-offen" onClick={() => setBestellungenFilter('offen')}>
                  <span className="stat-number">{bestellungenStats.offen || 0}</span>
                  <span className="stat-label">Offen</span>
                </div>
                <div className="stat-card stat-bearbeitung" onClick={() => setBestellungenFilter('in_bearbeitung')}>
                  <span className="stat-number">{bestellungenStats.in_bearbeitung || 0}</span>
                  <span className="stat-label">In Bearbeitung</span>
                </div>
                <div className="stat-card stat-versendet" onClick={() => setBestellungenFilter('versendet')}>
                  <span className="stat-number">{bestellungenStats.versendet || 0}</span>
                  <span className="stat-label">Versendet</span>
                </div>
                <div className="stat-card stat-abgeschlossen" onClick={() => setBestellungenFilter('abgeschlossen')}>
                  <span className="stat-number">{bestellungenStats.abgeschlossen || 0}</span>
                  <span className="stat-label">Abgeschlossen</span>
                </div>
                <div className="stat-card stat-alle" onClick={() => setBestellungenFilter('alle')}>
                  <span className="stat-number">{bestellungenStats.gesamt || 0}</span>
                  <span className="stat-label">Gesamt</span>
                </div>
              </div>
            )}

            {/* Filter */}
            <div className="bestellungen-filter">
              <label>Status:</label>
              <select value={bestellungenFilter} onChange={(e) => setBestellungenFilter(e.target.value)}>
                <option value="alle">Alle</option>
                <option value="offen">Offen</option>
                <option value="in_bearbeitung">In Bearbeitung</option>
                <option value="versendet">Versendet</option>
                <option value="abgeschlossen">Abgeschlossen</option>
                <option value="storniert">Storniert</option>
              </select>
            </div>

            {/* Bestellungen-Liste */}
            {bestellungenLoading ? (
              <div className="loading-spinner">Lade Bestellungen...</div>
            ) : bestellungen.length === 0 ? (
              <div className="empty-state">
                <p>Keine Bestellungen gefunden.</p>
              </div>
            ) : (
              <div className="bestellungen-liste">
                {bestellungen.map(bestellung => (
                  <div
                    key={bestellung.id}
                    className={`bestellung-card ${selectedBestellung?.id === bestellung.id ? 'selected' : ''}`}
                    onClick={() => setSelectedBestellung(selectedBestellung?.id === bestellung.id ? null : bestellung)}
                  >
                    <div className="bestellung-header">
                      <span className="bestellung-nummer">{bestellung.bestellnummer}</span>
                      <span className={`bestellung-status status-${bestellung.status}`}>
                        {bestellung.status === 'offen' && '🟡 Offen'}
                        {bestellung.status === 'in_bearbeitung' && '🔵 In Bearbeitung'}
                        {bestellung.status === 'versendet' && '📬 Versendet'}
                        {bestellung.status === 'abgeschlossen' && '✅ Abgeschlossen'}
                        {bestellung.status === 'storniert' && '❌ Storniert'}
                      </span>
                    </div>
                    <div className="bestellung-info">
                      <div className="bestellung-kunde">
                        <strong>{bestellung.kunde_name}</strong>
                        <span>{bestellung.kunde_email}</span>
                        {bestellung.mitgliedsnummer && <span className="mitglied-nr">({bestellung.mitgliedsnummer})</span>}
                      </div>
                      <div className="bestellung-betrag">
                        <strong>{bestellung.gesamtbetrag_euro?.toFixed(2)} €</strong>
                        <span>{bestellung.anzahl_positionen} Artikel</span>
                      </div>
                      <div className="bestellung-datum">
                        {new Date(bestellung.bestellt_am).toLocaleDateString('de-DE', {
                          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>

                    {/* Aufgeklappte Details */}
                    {selectedBestellung?.id === bestellung.id && (
                      <div className="bestellung-details">
                        <div className="details-section">
                          <h4>Lieferadresse</h4>
                          <p>
                            {bestellung.lieferadresse_strasse}<br />
                            {bestellung.lieferadresse_plz} {bestellung.lieferadresse_ort}<br />
                            {bestellung.lieferadresse_land}
                          </p>
                        </div>

                        <div className="details-section">
                          <h4>Bestellte Artikel</h4>
                          <table className="positionen-table">
                            <thead>
                              <tr>
                                <th>Artikel</th>
                                <th>Variante</th>
                                <th>Menge</th>
                                <th>Preis</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bestellung.positionen?.map((pos, idx) => (
                                <tr key={idx}>
                                  <td>{pos.artikel_name}</td>
                                  <td>{pos.variante || '-'}</td>
                                  <td>{pos.menge}</td>
                                  <td>{(pos.gesamtpreis_cent / 100).toFixed(2)} €</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {bestellung.kundennotiz && (
                          <div className="details-section">
                            <h4>Kundennotiz</h4>
                            <p className="kundennotiz">{bestellung.kundennotiz}</p>
                          </div>
                        )}

                        <div className="details-section">
                          <h4>Status ändern</h4>
                          <div className="status-actions">
                            {bestellung.status === 'offen' && (
                              <button
                                className="btn btn-primary"
                                onClick={(e) => { e.stopPropagation(); updateBestellungStatus(bestellung.id, { status: 'in_bearbeitung' }); }}
                                disabled={bestellungUpdating}
                              >
                                In Bearbeitung nehmen
                              </button>
                            )}
                            {bestellung.status === 'in_bearbeitung' && (
                              <>
                                <input
                                  type="text"
                                  placeholder="Tracking-Nummer (optional)"
                                  className="tracking-input"
                                  onClick={(e) => e.stopPropagation()}
                                  id={`tracking-${bestellung.id}`}
                                />
                                <button
                                  className="btn btn-success"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const tracking = document.getElementById(`tracking-${bestellung.id}`).value;
                                    updateBestellungStatus(bestellung.id, { status: 'versendet', tracking_nummer: tracking });
                                  }}
                                  disabled={bestellungUpdating}
                                >
                                  Als versendet markieren
                                </button>
                              </>
                            )}
                            {bestellung.status === 'versendet' && (
                              <button
                                className="btn btn-success"
                                onClick={(e) => { e.stopPropagation(); updateBestellungStatus(bestellung.id, { status: 'abgeschlossen' }); }}
                                disabled={bestellungUpdating}
                              >
                                Abschließen
                              </button>
                            )}
                            {['offen', 'in_bearbeitung'].includes(bestellung.status) && (
                              <button
                                className="btn btn-danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm('Bestellung wirklich stornieren?')) {
                                    updateBestellungStatus(bestellung.id, { status: 'storniert' });
                                  }
                                }}
                                disabled={bestellungUpdating}
                              >
                                Stornieren
                              </button>
                            )}
                          </div>
                          {bestellung.tracking_nummer && (
                            <p className="tracking-info">
                              📦 Tracking: {bestellung.tracking_nummer}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Entwicklung Tab - Org-Gesamtübersicht */}
        {activeTab === 'entwicklung' && (
          <ZieleEntwicklung bereich="org" />
        )}

        {/* Support Tab - Alle Tickets aus allen Bereichen */}
        {activeTab === 'support' && (
          <SupportTickets bereich="org" showAllBereiche={true} />
        )}

        {/* Statistiken Tab */}
        {activeTab === 'statistics' && (
          <StatisticsTab token={token} />
        )}

        {/* Finanzen Tab - Kombiniert: Übersicht, Mitglieder-Lastschrift, Dojo-SEPA */}
        {activeTab === 'finanzen' && (
          <FinanzenTab token={token} />
        )}

        {/* Buchhaltung Tab - EÜR */}
        {activeTab === 'buchhaltung' && (
          <BuchhaltungTab token={token} />
        )}

        {/* Verträge Tab */}
        {activeTab === 'contracts' && (
          <ContractsTab token={token} />
        )}

        {/* Benutzer Tab */}
        {activeTab === 'plans' && (
          <div className="plans-management">
            <h2 className="section-title" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={24} /> Pläne & Preise verwalten
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Änderungen hier werden automatisch auf der Pricing-Seite und im Vertragsmodul übernommen.
            </p>

            {plansLoading ? (
              <p>Lade Pläne...</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                {subscriptionPlans.map(plan => (
                  <div key={plan.plan_id} className="plan-card" style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    border: '1px solid var(--border-default)',
                    opacity: plan.is_visible ? 1 : 0.6
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0, color: 'var(--primary)' }}>{plan.display_name}</h3>
                      <button
                        onClick={() => setEditingPlan(editingPlan === plan.plan_id ? null : plan.plan_id)}
                        style={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-default)',
                          borderRadius: '6px',
                          padding: '0.4rem 0.8rem',
                          cursor: 'pointer',
                          color: 'var(--text-primary)'
                        }}
                      >
                        <Edit size={14} /> {editingPlan === plan.plan_id ? 'Abbrechen' : 'Bearbeiten'}
                      </button>
                    </div>

                    {editingPlan === plan.plan_id ? (
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target);
                        updatePlan(plan.plan_id, {
                          display_name: formData.get('display_name'),
                          description: formData.get('description'),
                          price_monthly: parseFloat(formData.get('price_monthly')),
                          price_yearly: parseFloat(formData.get('price_yearly')),
                          max_members: parseInt(formData.get('max_members')),
                          max_dojos: parseInt(formData.get('max_dojos')),
                          storage_limit_mb: parseInt(formData.get('storage_limit_mb')),
                          feature_verkauf: formData.get('feature_verkauf') === 'on',
                          feature_buchfuehrung: formData.get('feature_buchfuehrung') === 'on',
                          feature_events: formData.get('feature_events') === 'on',
                          feature_multidojo: formData.get('feature_multidojo') === 'on',
                          feature_api: formData.get('feature_api') === 'on',
                          is_visible: formData.get('is_visible') === 'on'
                        });
                      }}>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                          <div>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Anzeigename</label>
                            <input name="display_name" defaultValue={plan.display_name} className="form-control" style={{ width: '100%', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Beschreibung</label>
                            <input name="description" defaultValue={plan.description} className="form-control" style={{ width: '100%', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <div>
                              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Preis/Monat</label>
                              <input name="price_monthly" type="number" step="0.01" defaultValue={plan.price_monthly} className="form-control" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Preis/Jahr</label>
                              <input name="price_yearly" type="number" step="0.01" defaultValue={plan.price_yearly} className="form-control" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                            <div>
                              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Max Mitglieder</label>
                              <input name="max_members" type="number" defaultValue={plan.max_members} className="form-control" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Max Dojos</label>
                              <input name="max_dojos" type="number" defaultValue={plan.max_dojos} className="form-control" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Speicher MB</label>
                              <input name="storage_limit_mb" type="number" defaultValue={plan.storage_limit_mb} className="form-control" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
                              <input name="feature_verkauf" type="checkbox" defaultChecked={plan.feature_verkauf} /> Verkauf
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
                              <input name="feature_buchfuehrung" type="checkbox" defaultChecked={plan.feature_buchfuehrung} /> Buchführung
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
                              <input name="feature_events" type="checkbox" defaultChecked={plan.feature_events} /> Events
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
                              <input name="feature_multidojo" type="checkbox" defaultChecked={plan.feature_multidojo} /> Multi-Dojo
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
                              <input name="feature_api" type="checkbox" defaultChecked={plan.feature_api} /> API
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
                              <input name="is_visible" type="checkbox" defaultChecked={plan.is_visible} /> Sichtbar
                            </label>
                          </div>
                          <button type="submit" style={{
                            marginTop: '1rem',
                            background: 'var(--primary)',
                            color: '#000',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.6rem 1rem',
                            cursor: 'pointer',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            justifyContent: 'center'
                          }}>
                            <Save size={16} /> Speichern
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>{plan.description}</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                          <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Monatlich</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)' }}>{plan.price_monthly}€</div>
                          </div>
                          <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Jährlich</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)' }}>{plan.price_yearly}€</div>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <div>Max. {plan.max_members >= 999999 ? 'Unbegrenzt' : plan.max_members} Mitglieder</div>
                          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {plan.feature_verkauf ? <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>Verkauf</span> : null}
                            {plan.feature_buchfuehrung ? <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>Buchführung</span> : null}
                            {plan.feature_events ? <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>Events</span> : null}
                            {plan.feature_multidojo ? <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>Multi-Dojo</span> : null}
                            {plan.feature_api ? <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>API</span> : null}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <UsersTab token={token} />
        )}

        {/* E-Mail-Einstellungen Tab */}
        {activeTab === 'email' && (
          <div className="tab-content">
            <div className="section-card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                ✉️ Globale E-Mail-Einstellungen
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Diese Einstellungen werden als Fallback für alle Dojos verwendet, die keine eigenen SMTP-Daten hinterlegt haben.
              </p>

              {emailMessage && (
                <div style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  marginBottom: '1.5rem',
                  background: emailMessage.includes('✅') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${emailMessage.includes('✅') ? '#10b981' : '#ef4444'}`,
                  color: emailMessage.includes('✅') ? '#10b981' : '#ef4444'
                }}>
                  {emailMessage}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label>SMTP-Server</label>
                  <input
                    type="text"
                    value={emailSettings.smtp_host}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtp_host: e.target.value })}
                    placeholder="z.B. smtp.tda-intl.com"
                  />
                </div>
                <div className="form-group">
                  <label>SMTP-Port</label>
                  <input
                    type="number"
                    value={emailSettings.smtp_port}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtp_port: parseInt(e.target.value) || 587 })}
                    placeholder="587"
                  />
                </div>
                <div className="form-group">
                  <label>SMTP-Benutzer</label>
                  <input
                    type="text"
                    value={emailSettings.smtp_user}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtp_user: e.target.value })}
                    placeholder="E-Mail-Adresse für Login"
                  />
                </div>
                <div className="form-group">
                  <label>SMTP-Passwort</label>
                  <input
                    type="password"
                    value={emailSettings.smtp_password}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtp_password: e.target.value })}
                    placeholder={emailSettings.has_password ? '********' : 'Passwort eingeben'}
                  />
                </div>
                <div className="form-group">
                  <label>Absender-E-Mail</label>
                  <input
                    type="email"
                    value={emailSettings.default_from_email}
                    onChange={(e) => setEmailSettings({ ...emailSettings, default_from_email: e.target.value })}
                    placeholder="noreply@tda-intl.com"
                  />
                </div>
                <div className="form-group">
                  <label>Absender-Name</label>
                  <input
                    type="text"
                    value={emailSettings.default_from_name}
                    onChange={(e) => setEmailSettings({ ...emailSettings, default_from_name: e.target.value })}
                    placeholder="DojoSoftware"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={emailSettings.smtp_secure}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtp_secure: e.target.checked })}
                  />
                  TLS/SSL verwenden
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={emailSettings.aktiv}
                    onChange={(e) => setEmailSettings({ ...emailSettings, aktiv: e.target.checked })}
                  />
                  E-Mail-Versand aktiviert
                </label>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <button
                  className="btn-primary"
                  onClick={saveEmailSettings}
                  disabled={emailLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Save size={18} />
                  {emailLoading ? 'Speichern...' : 'Einstellungen speichern'}
                </button>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '2rem 0' }} />

              <h4 style={{ marginBottom: '1rem' }}>🧪 Test-E-Mail senden</h4>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                Senden Sie eine Test-E-Mail, um die Konfiguration zu prüfen.
              </p>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Test-E-Mail-Adresse</label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="ihre-email@beispiel.de"
                  />
                </div>
                <button
                  className="btn-secondary"
                  onClick={sendTestEmail}
                  disabled={emailLoading || !testEmail}
                  style={{ marginBottom: '0.5rem' }}
                >
                  {emailLoading ? 'Sende...' : 'Test senden'}
                </button>
              </div>

              <div style={{
                marginTop: '2rem',
                padding: '1rem',
                background: 'rgba(59,130,246,0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(59,130,246,0.2)'
              }}>
                <h4 style={{ color: '#3b82f6', marginBottom: '0.5rem' }}>ℹ️ So funktioniert das 3-Stufen-System</h4>
                <ol style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, paddingLeft: '1.5rem' }}>
                  <li style={{ marginBottom: '0.5rem' }}><strong>Eigene SMTP-Daten:</strong> Dojos können eigene Mailserver-Daten hinterlegen</li>
                  <li style={{ marginBottom: '0.5rem' }}><strong>TDA-E-Mail:</strong> Sie können Dojos eine @tda-intl.com Adresse zuweisen</li>
                  <li><strong>Zentraler Versand (Fallback):</strong> Diese globalen Einstellungen werden verwendet, wenn nichts anderes konfiguriert ist</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals für Create/Edit */}
      {showCreateModal && (
        <DojoFormModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadAllData();
          }}
          token={token}
        />
      )}

      {showEditModal && selectedDojo && (
        <DojoFormModal
          dojo={selectedDojo}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            loadAllData();
          }}
          token={token}
        />
      )}

      {/* Trial verlängern Modal */}
      {showExtendTrialModal && selectedDojo && (
        <div className="modal-overlay" onClick={() => setShowExtendTrialModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <Clock size={24} />
                Trial verlängern
              </h2>
              <button onClick={() => setShowExtendTrialModal(false)} className="modal-close">
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body">
              <p><strong>Dojo:</strong> {selectedDojo.dojoname}</p>
              <p><strong>Aktuelles Trial-Ende:</strong> {new Date(selectedDojo.trial_ends_at).toLocaleDateString('de-DE')}</p>
              <p><strong>Verbleibende Tage:</strong> {selectedDojo.trial_days_remaining} Tage</p>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label>Trial verlängern um (Tage):</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={trialDays}
                  onChange={(e) => setTrialDays(parseInt(e.target.value))}
                  className="form-control"
                />
                <small style={{ color: 'rgba(255,255,255,0.6)', marginTop: '0.5rem', display: 'block' }}>
                  Neues Trial-Ende: {new Date(new Date(selectedDojo.trial_ends_at).getTime() + trialDays * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE')}
                </small>
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowExtendTrialModal(false)} className="btn btn-secondary">
                Abbrechen
              </button>
              <button onClick={confirmExtendTrial} className="btn btn-warning">
                Trial verlängern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Abo aktivieren Modal */}
      {showActivateSubscriptionModal && selectedDojo && (
        <div className="modal-overlay" onClick={() => setShowActivateSubscriptionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <CheckCircle size={24} />
                Abonnement aktivieren
              </h2>
              <button onClick={() => setShowActivateSubscriptionModal(false)} className="modal-close">
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body">
              <p><strong>Dojo:</strong> {selectedDojo.dojoname}</p>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label>Abo-Plan:</label>
                <select
                  value={subscriptionPlan}
                  onChange={(e) => setSubscriptionPlan(e.target.value)}
                  className="form-control"
                >
                  <option value="starter">Starter (49€/Monat)</option>
                  <option value="professional">Professional (89€/Monat)</option>
                  <option value="premium">Premium (149€/Monat)</option>
                  <option value="enterprise">Enterprise (249€/Monat)</option>
                  {isMainSuperAdmin && (
                    <>
                      <option value="free">🎁 Kostenloser Account (Lifetime)</option>
                      <option value="custom">⚙️ Flexibel/Custom</option>
                    </>
                  )}
                </select>
              </div>

              {/* Custom Pricing Felder - nur bei Plan "custom" */}
              {subscriptionPlan === 'custom' && isMainSuperAdmin && (
                <>
                  <div className="form-group">
                    <label>Custom Preis (€):</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      className="form-control"
                      placeholder="z.B. 39.99"
                    />
                  </div>

                  <div className="form-group">
                    <label>Notizen/Details:</label>
                    <textarea
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      className="form-control"
                      rows="3"
                      placeholder="z.B. Sonderkonditionen, Rabatte, besondere Vereinbarungen..."
                    />
                  </div>
                </>
              )}

              {/* Zahlungsintervall - nicht bei free */}
              {subscriptionPlan !== 'free' && (
                <div className="form-group">
                  <label>Zahlungsintervall:</label>
                  <select
                    value={subscriptionInterval}
                    onChange={(e) => setSubscriptionInterval(e.target.value)}
                    className="form-control"
                  >
                    <option value="monthly">Monatlich</option>
                    <option value="quarterly">Quartalsweise</option>
                    <option value="yearly">Jährlich</option>
                  </select>
                </div>
              )}

              {/* Laufzeit - nicht bei free */}
              {subscriptionPlan !== 'free' && (
                <div className="form-group">
                  <label>Laufzeit (Monate):</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={subscriptionDuration}
                    onChange={(e) => setSubscriptionDuration(parseInt(e.target.value))}
                    className="form-control"
                  />
                  <small style={{ color: 'rgba(255,255,255,0.6)', marginTop: '0.5rem', display: 'block' }}>
                    Abo-Ende: {new Date(new Date().setMonth(new Date().getMonth() + subscriptionDuration)).toLocaleDateString('de-DE')}
                  </small>
                </div>
              )}

              {/* Hinweis bei Free */}
              {subscriptionPlan === 'free' && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginTop: '1rem',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}>
                  <strong>🎁 Kostenloser Account</strong><br />
                  Dieser Account hat unbegrenzten Zugriff ohne Ablaufdatum.
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowActivateSubscriptionModal(false)} className="btn btn-secondary">
                Abbrechen
              </button>
              <button onClick={confirmActivateSubscription} className="btn btn-success">
                Abo aktivieren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================
// DOJO FORM MODAL (Create/Edit)
// =============================================
const DojoFormModal = ({ dojo, onClose, onSuccess, token }) => {
  const isEdit = !!dojo;

  const [formData, setFormData] = useState({
    dojoname: dojo?.dojoname || '',
    subdomain: dojo?.subdomain || '',
    inhaber: dojo?.inhaber || '',
    email: dojo?.email || '',
    telefon: dojo?.telefon || '',
    strasse: dojo?.strasse || '',
    hausnummer: dojo?.hausnummer || '',
    plz: dojo?.plz || '',
    ort: dojo?.ort || '',
    land: dojo?.land || 'Deutschland',
    ist_aktiv: dojo?.ist_aktiv !== undefined ? dojo.ist_aktiv : true
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (isEdit) {
        // Update
        await axios.put(
          `/admin/dojos/${dojo.id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert('Dojo erfolgreich aktualisiert!');
      } else {
        // Create
        await axios.post(
          `/admin/dojos`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert('Dojo erfolgreich angelegt!');
      }

      onSuccess();
    } catch (err) {
      console.error('❌ Fehler beim Speichern:', err);
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Dojo bearbeiten' : 'Neues Dojo anlegen'}</h2>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="dojo-form">
          <div className="form-row">
            <div className="form-group">
              <label>Dojo-Name *</label>
              <input
                type="text"
                name="dojoname"
                value={formData.dojoname}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Subdomain *</label>
              <input
                type="text"
                name="subdomain"
                value={formData.subdomain}
                onChange={handleChange}
                placeholder="z.B. mein-dojo"
                required
              />
              <small>.dojo.tda-intl.org</small>
            </div>
          </div>

          <div className="form-group">
            <label>Inhaber *</label>
            <input
              type="text"
              name="inhaber"
              value={formData.inhaber}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>E-Mail</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Telefon</label>
              <input
                type="tel"
                name="telefon"
                value={formData.telefon}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-2">
              <label>Straße</label>
              <input
                type="text"
                name="strasse"
                value={formData.strasse}
                onChange={handleChange}
              />
            </div>

            <div className="form-group flex-1">
              <label>Hausnr.</label>
              <input
                type="text"
                name="hausnummer"
                value={formData.hausnummer}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>PLZ</label>
              <input
                type="text"
                name="plz"
                value={formData.plz}
                onChange={handleChange}
              />
            </div>

            <div className="form-group flex-2">
              <label>Ort</label>
              <input
                type="text"
                name="ort"
                value={formData.ort}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Land</label>
              <input
                type="text"
                name="land"
                value={formData.land}
                onChange={handleChange}
              />
            </div>
          </div>

          {isEdit && (
            <div className="form-group" style={{
              marginTop: '1rem',
              padding: '1rem',
              background: formData.ist_aktiv ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              borderRadius: '8px',
              border: `1px solid ${formData.ist_aktiv ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={formData.ist_aktiv}
                  onChange={(e) => setFormData(prev => ({ ...prev, ist_aktiv: e.target.checked }))}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 600, color: formData.ist_aktiv ? '#22c55e' : '#ef4444' }}>
                  {formData.ist_aktiv ? '✓ Dojo ist aktiv' : '✗ Dojo ist inaktiv'}
                </span>
              </label>
            </div>
          )}

          {error && (
            <div className="error-message">
              <XCircle size={16} />
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={submitting}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Speichere...' : (isEdit ? 'Aktualisieren' : 'Anlegen')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
