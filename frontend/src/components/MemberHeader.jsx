import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { useChatContext } from '../context/ChatContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { MessageCircle } from 'lucide-react';
import config from '../config/config.js';
import '../styles/Dashboard.css';
import '../styles/MemberHeader.css';
import LanguageSwitcher from './LanguageSwitcher';
import MobileBottomNav from './MobileBottomNav.jsx';

const MemberHeader = () => {
  const { t } = useTranslation('member');
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const { unreadCount } = useChatContext();
  const { activeDojo } = useDojoContext();
  const [userDisplayName, setUserDisplayName] = useState('');
  const [familyMembers, setFamilyMembers] = useState([]);
  const [familySwitching, setFamilySwitching] = useState(false);

  const dojoName = activeDojo?.dojoname || null;
  const dojoLogo = activeDojo?.logo_url || '/dojo-logo.png';

  const isMainDashboard = location.pathname === '/member/dashboard';

  // Lade Mitgliedsnamen für Anzeige im Header
  useEffect(() => {
    const loadUserDisplayName = async () => {
      if (user?.mitglied_id) {
        try {
          const response = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${user.mitglied_id}`);
          if (response.ok) {
            const data = await response.json();
            const member = data.data || data;
            const fullName = `${member.vorname || ''} ${member.nachname || ''}`.trim();
            setUserDisplayName(fullName || user.username || 'Mitglied');
          } else {
            setUserDisplayName(user.username || 'Mitglied');
          }
        } catch (err) {
          setUserDisplayName(user.username || 'Mitglied');
        }
      } else if (user?.username) {
        setUserDisplayName(user.username);
      }
    };

    loadUserDisplayName();
  }, [user]);

  useEffect(() => {
    const loadFamily = async () => {
      try {
        const res = await fetchWithAuth(`${config.apiBaseUrl}/auth/family-members`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.members.length > 1) setFamilyMembers(data.members);
        }
      } catch (e) { /* ignore */ }
    };
    loadFamily();
  }, [user]);

  const handleFamilySwitch = async (targetId) => {
    if (targetId === user?.mitglied_id || familySwitching) return;
    setFamilySwitching(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/auth/family-switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitglied_id: targetId })
      });
      const data = await res.json();
      if (data.success && data.token) {
        const payload = JSON.parse(atob(data.token.split('.')[1]));
        const expiryTime = payload.exp ? payload.exp * 1000 : Date.now() + (30 * 24 * 60 * 60 * 1000);
        localStorage.setItem('dojo_auth_token', data.token);
        localStorage.setItem('dojo_user', JSON.stringify(data.user));
        localStorage.setItem('dojo_session_expiry', expiryTime.toString());
        window.location.reload();
      }
    } catch (e) {
      console.error('Familie-Wechsel fehlgeschlagen:', e);
    } finally {
      setFamilySwitching(false);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const handleDashboardClick = () => {
    navigate('/member/dashboard');
  };

  return (
    <>
    <MobileBottomNav />
    <header className="dashboard-header">
      <div className="dashboard-header-left">
        <img src={dojoLogo} alt={dojoName || 'Dojo Logo'} className="dashboard-logo" />
        <h2>{dojoName || t('header.title')}</h2>
      </div>
      <div className="dashboard-header-right">
        {!isMainDashboard && (
          <button
            onClick={handleDashboardClick}
            className="logout-button header-btn-mr"
          >
            ← {t('header.dashboard')}
          </button>
        )}

        {/* Chat-Button mit Ungelesen-Badge */}
        <button
          onClick={() => navigate('/member/chat')}
          className="logout-button chat-header-badge-wrap header-btn-mr"
          title="Chat"
        >
          <MessageCircle size={18} />
          {unreadCount > 0 && (
            <span className="chat-header-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => navigate('/member/support')}
          className="logout-button header-btn-mr"
          title={t('header.support')}
        >
          <span className="header-icon-mr">🎫</span>
          <span className="logout-text">{t('header.support')}</span>
        </button>
        <button
          onClick={() => navigate('/member/wunschliste')}
          className="logout-button header-btn-mr"
          title={t('header.wishlist')}
        >
          <span className="header-icon-mr">💡</span>
          <span className="logout-text">{t('header.wishlist')}</span>
        </button>
        {familyMembers.length > 1 ? (
          <div className="family-switcher-header">
            {familyMembers.map(m => (
              <button
                key={m.mitglied_id}
                className={`family-switcher-header-btn${m.mitglied_id === user?.mitglied_id ? ' family-switcher-header-btn--active' : ''}`}
                onClick={() => handleFamilySwitch(m.mitglied_id)}
                disabled={familySwitching}
                title={`Zu ${m.vorname} wechseln`}
              >
                {m.vorname}
              </button>
            ))}
          </div>
        ) : userDisplayName ? (
          <div className="user-display">
            <span className="user-icon">👤</span>
            <span className="user-name">{userDisplayName}</span>
          </div>
        ) : null}
        <LanguageSwitcher compact={true} showLabel={false} />
        <button className="logout-button" onClick={handleLogout}>
          <svg
            className="logout-icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span className="logout-text">{t('header.logout')}</span>
        </button>
      </div>
    </header>
    </>
  );
};

export default MemberHeader;
