import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx';
import { useStandortContext } from '../context/StandortContext.jsx';
import { useMitgliederUpdate } from '../context/MitgliederUpdateContext.jsx';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import config from '../config/config.js';
import { fetchDashboardBatch, fetchDashboardStats, fetchRecentActivities } from '../utils/apiCache.js';
import '../styles/themes.css';
import '../styles/Dashboard-TdaVib.css';  // ✨ TDA-VIB STYLE!
import '../styles/components.css';
import '../styles/BuddyVerwaltung.css';
import logo from '../assets/dojo-logo.png';
import { Users, Trophy, ClipboardList, Calendar, Menu, FileText, ChevronDown } from 'lucide-react';
import DojoSwitcher from './DojoSwitcher';
import StandortSwitcher from './StandortSwitcher';
import MemberDashboard from './MemberDashboard';
import AdminRegistrationPopup from './AdminRegistrationPopup';
import SuperAdminDashboard from './SuperAdminDashboard';
import TrialBanner from './TrialBanner';

/**
 * Dashboard mit TDA-Vib Styling (Traditionelles Japanisches Design)
 * - Washi Paper Hintergrund
 * - Sumi Ink (schwarz) für Text/Buttons
 * - Gold & Vermillion Akzente
 * - Clean, minimalistisch
 */
function DashboardTdaVib() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, logout } = useAuth();
  const { getDojoFilterParam, selectedDojo } = useDojoContext();
  const { standorte } = useStandortContext();
  const { updateTrigger } = useMitgliederUpdate();

  const [stats, setStats] = useState({
    mitglieder: 0,
    anwesenheit: 0,
    kurse: 0,
    trainer: 0,
    beitraege: 0,
    checkins_heute: 0,
    stile: 0,
    termine: 0,
    inventar: 0,
    personal: 0,
    buddy_gruppen: 0,
    tarife: 0,
    zahlungszyklen: 0
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userDisplayName, setUserDisplayName] = useState('');
  const [activeTab, setActiveTab] = useState('checkin');

  let role = 'mitglied';

  try {
    if (token) {
      const decoded = jwtDecode(token);
      role = decoded.role || 'mitglied';
    }
  } catch (error) {
    console.error("Fehler beim Dekodieren des Tokens:", error);
  }

  const fetchDashboardStatsOptimized = async () => {
    setLoading(true);
    setError('');
    try {
      const dojoFilterParam = getDojoFilterParam();
      const data = await fetchDashboardBatch(token, dojoFilterParam);

      setStats({
        ...data.stats,
        checkins_heute: data.stats.checkins_heute || 0,
        stile: data.stats.stile || 0,
        termine: data.stats.termine || 0,
        inventar: data.stats.inventar || 0,
        personal: data.stats.personal || 0,
        buddy_gruppen: data.stats.buddy_gruppen || 0,
        tarife: data.stats.tarife || 0,
        zahlungszyklen: data.stats.zahlungszyklen || 0
      });

      if (data.activities) {
        const activities = data.activities.activities || data.activities || [];
        setRecentActivities(activities);
      }

    } catch (err) {
      console.error('Fehler beim Laden der Dashboard-Statistiken:', err);
      setError('Fehler beim Laden der Statistiken: ' + err.message);

      try {
        const dojoFilterParam = getDojoFilterParam();
        const [statsData, activitiesData] = await Promise.all([
          fetchDashboardStats(token, dojoFilterParam),
          fetchRecentActivities(token, dojoFilterParam)
        ]);

        setStats({
          ...statsData,
          checkins_heute: statsData.checkins_heute || 0,
          stile: statsData.stile || 0,
          termine: statsData.termine || 0,
          inventar: statsData.inventar || 0,
          personal: statsData.personal || 0,
          buddy_gruppen: statsData.buddy_gruppen || 0,
          tarife: statsData.tarife || 0,
          zahlungszyklen: statsData.zahlungszyklen || 0
        });

        const activities = activitiesData.activities || activitiesData || [];
        setRecentActivities(activities);
        setError('');
      } catch (fallbackErr) {
        console.error('Fallback fehlgeschlagen:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDashboardStatsOptimized();
    }
  }, [token, getDojoFilterParam, updateTrigger]);

  useEffect(() => {
    const loadUserDisplayName = async () => {
      try {
        if (token) {
          const decoded = jwtDecode(token);

          if (decoded.role === 'admin') {
            setUserDisplayName(decoded.username || 'Admin');
          }
          else if (decoded.email) {
            try {
              const response = await axios.get(`/mitglieder/by-email/${encodeURIComponent(decoded.email)}`);
              if (response.data) {
                const fullName = `${response.data.vorname || ''} ${response.data.nachname || ''}`.trim();
                setUserDisplayName(fullName || decoded.username || 'Mitglied');
              }
            } catch (err) {
              console.error('Fehler beim Laden des Mitgliedsnamens:', err);
              setUserDisplayName(decoded.username || 'Mitglied');
            }
          }
        }
      } catch (error) {
        console.error('Fehler beim Dekodieren des Tokens:', error);
      }
    };

    loadUserDisplayName();
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavigation = (path) => {
    if (path === '/dashboard/stundenplan') {
      try {
        navigate(path);
      } catch (error) {
        console.error('Stundenplan Navigation Fehler:', error);
        window.location.href = path;
      }
    } else {
      navigate(path);
    }
  };

  const tabs = [
    { id: 'checkin', label: 'Check-in Systeme', icon: '📱' },
    { id: 'mitglieder', label: 'Mitgliederverwaltung', icon: '👥' },
    { id: 'pruefungswesen', label: 'Prüfungswesen', icon: '🏆' },
    { id: 'events', label: 'Events', icon: '📅' },
    { id: 'finanzen', label: 'Finanzen', icon: '💰' },
    { id: 'artikelverwaltung', label: 'Artikelverwaltung', icon: '📦' },
    { id: 'verwaltung', label: 'Dojo-Verwaltung', icon: '🔧' },
    { id: 'personal', label: 'Personal', icon: '👨‍🏫' },
    { id: 'berichte', label: 'Berichte', icon: '📊' },
    { id: 'einstellungen', label: 'Einstellungen', icon: '⚙️' },
    { id: 'schnellaktionen', label: 'Schnellaktionen', icon: '⚡' }
  ];

  const formatNumber = (num) => {
    if (num === 0) return '0';
    return num.toLocaleString('de-DE');
  };

  const isMainDashboard = location.pathname === '/dashboard-tda-vib' || location.pathname === '/dashboard';
  const headerTitle = role === 'admin' ? 'Dojo Admin Dashboard' : 'Mitglieder Dashboard';

  // Navigation Cards (gekürzt für Demo)
  const mitgliederCards = [
    { icon: '👥', title: 'Mitglieder', description: 'Verwalten Sie alle Dojo-Mitglieder', path: '/dashboard/mitglieder', count: stats.mitglieder },
    { icon: '👥', title: 'Buddy-Gruppen', description: 'Freunde-Einladungen und Gruppenverwaltung', path: '/dashboard/buddy-gruppen', badge: 'NEU', featured: true, count: stats.buddy_gruppen || 0 },
    { icon: '📧', title: 'Newsletter & Benachrichtigungen', description: 'Email-Versand, Push-Nachrichten', path: '/dashboard/notifications', badge: 'NEU', featured: true },
    { icon: '👋', title: 'Ehemalige', description: 'Ehemalige Mitglieder verwalten', path: '/dashboard/ehemalige', badge: 'NEU', count: stats.ehemalige || 0 },
    { icon: '💼', title: 'Interessenten', description: 'Potenzielle Mitglieder und Leads', path: '/dashboard/interessenten', badge: 'NEU', count: stats.interessenten || 0 }
  ];

  const verwaltungCards = [
    { icon: '🥋', title: 'Kurse', description: 'Kurse und Gruppen verwalten', path: '/dashboard/kurse', count: stats.kurse },
    { icon: '📋', title: 'Stundenplan', description: 'Stundenplan und Kurszeiten', path: '/dashboard/stundenplan', featured: true },
    { icon: '🎖️', title: 'Stil-Verwaltung', description: 'Kampfkunst-Stile & Prüfungen', path: '/dashboard/stile', badge: 'NEU', featured: true, count: stats.stile || 0 },
    { icon: '👥', title: 'Gruppen', description: 'Trainingsgruppen verwalten', path: '/dashboard/gruppen' },
    { icon: '📍', title: 'Standorte', description: 'Standorte & Filialen', path: '/dashboard/standorte', count: standorte?.length || 0 }
  ];

  const personalCards = [
    { icon: '👨‍🏫', title: 'Trainer', description: 'Trainer und Qualifikationen', path: '/dashboard/trainer', count: stats.trainer },
    { icon: '🧑‍💼', title: 'Personal', description: 'Mitarbeiter & Personalverwaltung', path: '/dashboard/personal', count: stats.personal, badge: 'NEU', featured: true }
  ];

  const finanzenCards = [
    { icon: '📊', title: 'Finanzcockpit', description: 'Übersicht Finanzkennzahlen', path: '/dashboard/finanzcockpit', featured: true },
    { icon: '💰', title: 'Beiträge', description: 'Mitgliedsbeiträge', path: '/dashboard/beitraege', count: stats.beitraege, featured: true },
    { icon: '🧾', title: 'Rechnungen', description: 'Rechnungen verwalten', path: '/dashboard/rechnungen', featured: true },
    { icon: '💳', title: 'Lastschriftlauf', description: 'SEPA-Lastschriften', path: '/dashboard/lastschriftlauf', featured: true },
    { icon: '📋', title: 'SEPA-Mandate', description: 'Einzugsermächtigungen', path: '/dashboard/sepa-mandate', featured: true },
    { icon: '⚠️', title: 'Mahnwesen', description: 'Offene Rechnungen', path: '/dashboard/mahnwesen', featured: true },
    { icon: '🎯', title: 'Tarife & Preise', description: 'Mitgliedschaftstarife', path: '/dashboard/tarife', featured: true }
  ];

  const adminQuickActions = [
    { label: '➕ Neues Mitglied', path: '/dashboard/mitglieder/neu', className: 'primary' },
    { label: '🎖️ Neuen Stil anlegen', path: '/dashboard/stile/neu', className: 'info' },
    { label: '✅ Anwesenheit erfassen', path: '/dashboard/anwesenheit', className: 'secondary' },
    { label: '🥋 Prüfung verwalten', path: '/dashboard/stile/pruefungen', className: 'warning' },
    { label: '👥 Buddy-Gruppe erstellen', path: '/dashboard/buddy-gruppen', className: 'success' },
    { label: '💰 Barverkauf', path: '/dashboard/kasse', className: 'primary' }
  ];

  // Für Members auf der Hauptseite
  if (role !== 'admin' && isMainDashboard) {
    return <MemberDashboard />;
  }

  return (
    // ✨ TDA-VIB THEME CLASS ✨
    <div className="dashboard-container dashboard-tda-vib">
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <img src={logo} alt="DojoSoftware Logo" className="dashboard-logo dojo-software-logo" />
          <h2>{headerTitle}</h2>
        </div>
        <div className="dashboard-header-right">
          {role === 'admin' && <DojoSwitcher />}
          {role === 'admin' && <StandortSwitcher />}
          {!isMainDashboard && (
            <button onClick={() => navigate('/dashboard-tda-vib')} className="dashboard-button">
              ← Dashboard
            </button>
          )}
          {userDisplayName && (
            <div className="user-display">
              <span className="user-greeting">Willkommen</span>
              <span className="user-name">{userDisplayName}</span>
            </div>
          )}
          <button className="logout-button" onClick={handleLogout}>
            <span className="logout-text">Logout</span>
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <main className="dashboard-main">
          {isMainDashboard ? (
            <div className="content-card">
              {error && (
                <div className="error-message">
                  ⚠️ {error}
                  <button onClick={fetchDashboardStatsOptimized} className="btn btn-neutral btn-small" style={{ marginLeft: '10px' }}>
                    🔄 Erneut versuchen
                  </button>
                </div>
              )}

              <TrialBanner stats={stats} />

              {role === 'admin' && (
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
              )}

              <div className="dashboard-navigation">
                {role === 'admin' && (
                  <div className="tab-content">
                    {/* Check-in Tab */}
                    {activeTab === 'checkin' && (
                      <div className="nav-cards">
                        <div onClick={() => handleNavigation('/dashboard/checkin')} className="nav-card clickable featured">
                          <div className="nav-badge live">LIVE</div>
                          <div className="nav-content">
                            <div className="nav-card-header">
                              <span className="nav-icon">📱</span>
                              <h3>Mitglieder Check-in <span className="nav-count">({formatNumber(stats.checkins_heute)})</span></h3>
                            </div>
                            <p>Touch & QR-Code Check-in für Mitglieder</p>
                          </div>
                          <div className="nav-arrow">→</div>
                        </div>

                        <div onClick={() => handleNavigation('/dashboard/anwesenheit')} className="nav-card clickable">
                          <div className="nav-content">
                            <div className="nav-card-header">
                              <span className="nav-icon">✅</span>
                              <h3>Anwesenheit <span className="nav-count">({formatNumber(stats.anwesenheit)})</span></h3>
                            </div>
                            <p>Anwesenheitsverfolgung und Statistiken</p>
                          </div>
                          <div className="nav-arrow">→</div>
                        </div>

                        <div onClick={() => handleNavigation('/dashboard/personal-checkin')} className="nav-card clickable featured">
                          <div className="nav-badge new">NEU</div>
                          <div className="nav-content">
                            <div className="nav-card-header">
                              <span className="nav-icon">👥</span>
                              <h3>Personal Check-in</h3>
                            </div>
                            <p>Arbeitszeit-Erfassung für Personal</p>
                          </div>
                          <div className="nav-arrow">→</div>
                        </div>

                        <div onClick={() => handleNavigation('/dashboard/kasse')} className="nav-card clickable featured">
                          <div className="nav-badge new">NEU</div>
                          <div className="nav-content">
                            <div className="nav-card-header">
                              <span className="nav-icon">💰</span>
                              <h3>Barverkauf</h3>
                            </div>
                            <p>Touch-Kasse für Verkäufe und Barzahlungen</p>
                          </div>
                          <div className="nav-arrow">→</div>
                        </div>

                        <div onClick={() => handleNavigation('/dashboard/tresen')} className="nav-card clickable featured">
                          <div className="nav-badge live">LIVE</div>
                          <div className="nav-content">
                            <div className="nav-card-header">
                              <span className="nav-icon">🏪</span>
                              <h3>Tresen-Übersicht</h3>
                            </div>
                            <p>Empfang, Checkin & Tagesübersicht</p>
                          </div>
                          <div className="nav-arrow">→</div>
                        </div>
                      </div>
                    )}

                    {/* Mitglieder Tab */}
                    {activeTab === 'mitglieder' && (
                      <div className="nav-cards">
                        {mitgliederCards.map((card, index) => (
                          <div key={index} onClick={() => handleNavigation(card.path)} className={`nav-card clickable ${card.featured ? 'featured' : ''}`}>
                            {card.badge && <div className={`nav-badge ${card.badge === 'NEU' ? 'new' : 'live'}`}>{card.badge}</div>}
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">{card.icon}</span>
                                <h3>{card.title} {card.count !== undefined && <span className="nav-count">({formatNumber(card.count)})</span>}</h3>
                              </div>
                              <p>{card.description}</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Verwaltung Tab */}
                    {activeTab === 'verwaltung' && (
                      <div className="nav-cards">
                        {verwaltungCards.map((card, index) => (
                          <div key={index} onClick={() => handleNavigation(card.path)} className={`nav-card clickable ${card.featured ? 'featured' : ''}`}>
                            {card.badge && <div className={`nav-badge ${card.badge === 'NEU' ? 'new' : 'live'}`}>{card.badge}</div>}
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">{card.icon}</span>
                                <h3>{card.title} {card.count !== undefined && <span className="nav-count">({formatNumber(card.count)})</span>}</h3>
                              </div>
                              <p>{card.description}</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Personal Tab */}
                    {activeTab === 'personal' && (
                      <div className="nav-cards">
                        {personalCards.map((card, index) => (
                          <div key={index} onClick={() => handleNavigation(card.path)} className={`nav-card clickable ${card.featured ? 'featured' : ''}`}>
                            {card.badge && <div className={`nav-badge ${card.badge === 'NEU' ? 'new' : 'live'}`}>{card.badge}</div>}
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">{card.icon}</span>
                                <h3>{card.title} {card.count !== undefined && <span className="nav-count">({formatNumber(card.count)})</span>}</h3>
                              </div>
                              <p>{card.description}</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Finanzen Tab */}
                    {activeTab === 'finanzen' && (
                      <div className="nav-cards">
                        {finanzenCards.map((card, index) => (
                          <div key={index} onClick={() => handleNavigation(card.path)} className={`nav-card clickable ${card.featured ? 'featured' : ''}`}>
                            {card.badge && <div className={`nav-badge ${card.badge === 'NEU' ? 'new' : 'live'}`}>{card.badge}</div>}
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">{card.icon}</span>
                                <h3>{card.title} {card.count !== undefined && <span className="nav-count">({formatNumber(card.count)})</span>}</h3>
                              </div>
                              <p>{card.description}</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Schnellaktionen Tab */}
                    {activeTab === 'schnellaktionen' && (
                      <div className="nav-section">
                        <h2 className="section-header">Schnellaktionen</h2>
                        <div className="quick-actions">
                          {adminQuickActions.map((action, index) => (
                            <button key={index} onClick={() => handleNavigation(action.path)} className={`quick-action-btn ${action.className}`}>
                              {action.label}
                            </button>
                          ))}
                        </div>
                        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                          <button onClick={fetchDashboardStatsOptimized} className="quick-action-btn info" disabled={loading}>
                            🔄 {loading ? 'Lädt...' : 'Statistiken aktualisieren'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Platzhalter für andere Tabs */}
                    {['pruefungswesen', 'events', 'artikelverwaltung', 'berichte', 'einstellungen'].includes(activeTab) && (
                      <div className="nav-cards">
                        <div className="nav-card">
                          <div className="nav-content">
                            <div className="nav-card-header">
                              <span className="nav-icon">🔧</span>
                              <h3>{tabs.find(t => t.id === activeTab)?.label}</h3>
                            </div>
                            <p>Dieser Bereich ist in der Demo-Ansicht verfügbar</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="content-card">
              <Outlet />
            </div>
          )}
        </main>
      </div>

      {role === 'admin' && <AdminRegistrationPopup />}
    </div>
  );
}

export default DashboardTdaVib;
