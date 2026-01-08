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
  CheckCircle, XCircle, BarChart3, Activity, Award, Calendar, HardDrive, Clock, AlertTriangle
} from 'lucide-react';
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
  const [subscriptionPlan, setSubscriptionPlan] = useState('basic');
  const [subscriptionInterval, setSubscriptionInterval] = useState('monthly');
  const [subscriptionDuration, setSubscriptionDuration] = useState(12);

  // Daten laden beim Mount
  useEffect(() => {
    loadAllData();
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
      await axios.put(
        `/admin/dojos/${selectedDojo.id}/activate-subscription`,
        {
          plan: subscriptionPlan,
          interval: subscriptionInterval,
          duration_months: subscriptionDuration
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(`Abonnement für "${selectedDojo.dojoname}" aktiviert (${subscriptionPlan}, ${subscriptionDuration} Monate)`);
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

  return (
    <div className="super-admin-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-icon">
            <Award size={48} />
          </div>
          <div className="header-text">
            <h1>Tiger & Dragon Association - International</h1>
            <p className="subtitle">Super-Admin Verwaltungsdashboard</p>
          </div>
        </div>
      </div>

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

          <div className="stat-card success">
            <div className="stat-icon">
              <Activity size={32} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{tdaStats?.courses?.total_courses || 0}</div>
              <div className="stat-label">Kurse</div>
            </div>
          </div>

          <div className="stat-card info">
            <div className="stat-icon">
              <Award size={32} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{tdaStats?.trainers?.total_trainers || 0}</div>
              <div className="stat-label">Trainer</div>
            </div>
          </div>

          <div className="stat-card warning">
            <div className="stat-icon">
              <CheckCircle size={32} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{tdaStats?.checkins?.active_checkins_today || 0}</div>
              <div className="stat-label">Check-ins Heute</div>
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

          <div className="stat-card global-info">
            <div className="stat-icon">
              <Activity size={32} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{globalStats?.courses?.total_courses || 0}</div>
              <div className="stat-label">Kurse (Verband)</div>
            </div>
          </div>

          <div className="stat-card global-warning">
            <div className="stat-icon">
              <Award size={32} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{globalStats?.trainers?.total_trainers || 0}</div>
              <div className="stat-label">Trainer (Verband)</div>
            </div>
          </div>

          <div className="stat-card global-info">
            <div className="stat-icon">
              <HardDrive size={32} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{globalStats?.storage?.total_storage_gb || '0.00'} GB</div>
              <div className="stat-label">Speicherplatz</div>
              <div className="stat-sublabel">
                {globalStats?.storage?.dojos_count || 0} Dojos
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
          <button onClick={handleCreateDojo} className="btn btn-primary">
            <Plus size={16} />
            Neues Dojo anlegen
          </button>
        </div>

        <div className="dojos-table-container">
          <table className="dojos-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Dojo-Name</th>
                <th>Subdomain</th>
                <th>Inhaber</th>
                <th>Ort</th>
                <th className="text-center">Mitglieder</th>
                <th className="text-center">Kurse</th>
                <th className="text-center">Trainer</th>
                <th className="text-center">Speicher</th>
                <th className="text-center">Abo-Status</th>
                <th className="text-center">Trial/Abo Ende</th>
                <th className="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {dojos.map((dojo) => (
                <tr key={dojo.id} className={!dojo.ist_aktiv ? 'inactive' : ''}>
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
                  <td className="text-center">{dojo.trainer_count || 0}</td>
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
                  <td className="text-right">
                    <div className="action-buttons">
                      {dojo.subscription_status === 'trial' && (
                        <button
                          onClick={() => handleExtendTrial(dojo)}
                          className="btn btn-sm btn-warning"
                          title="Trial verlängern"
                        >
                          <Clock size={14} /> +
                        </button>
                      )}
                      {(dojo.subscription_status === 'trial' || dojo.subscription_status === 'expired') && (
                        <button
                          onClick={() => handleActivateSubscription(dojo)}
                          className="btn btn-sm btn-success"
                          title="Abo aktivieren"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleEditDojo(dojo)}
                        className="btn btn-sm btn-secondary"
                        title="Bearbeiten"
                      >
                        <Edit size={14} />
                      </button>
                      {dojo.id !== 2 && ( // TDA International nicht löschbar
                        <button
                          onClick={() => handleDeleteDojo(dojo)}
                          className="btn btn-sm btn-danger"
                          title="Deaktivieren"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
                    <span><Award size={14} /> {dojo.trainer_count} Trainer</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
                  <option value="basic">Basic (29€/Monat)</option>
                  <option value="premium">Premium (49€/Monat)</option>
                  <option value="enterprise">Enterprise (99€/Monat)</option>
                </select>
              </div>

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
    land: dojo?.land || 'Deutschland'
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
