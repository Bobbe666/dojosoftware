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

// Username (z. B. "sam.schreiner") als sauberen Namen darstellen ("Sam Schreiner"),
// falls kein echter Mitgliedsname geladen werden konnte.
const prettyName = (u) => {
  if (!u) return 'Mitglied';
  const parts = String(u).split(/[._\s]+/).filter(Boolean);
  if (!parts.length) return 'Mitglied';
  return parts.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
};

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
            setUserDisplayName(fullName || prettyName(user.username));
          } else {
            setUserDisplayName(prettyName(user.username));
          }
        } catch (err) {
          setUserDisplayName(prettyName(user.username));
        }
      } else if (user?.username) {
        setUserDisplayName(prettyName(user.username));
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
    <header className="dashboard-header mh-portal">
      <div className="dashboard-header-left">
        <img src={dojoLogo} alt={dojoName || 'Dojo Logo'} className="dashboard-logo mh-logo" />
        <div className="mh-title-wrap">
          <span className="mh-dojo-name">{dojoName || t('header.title')}</span>
          {userDisplayName && <span className="mh-greeting">Hallo, {userDisplayName.split(' ')[0]}</span>}
        </div>
      </div>
      <div className="dashboard-header-right mh-actions">
        {!isMainDashboard && (
          <button onClick={handleDashboardClick} className="mh-btn mh-btn--back">
            ← {t('header.dashboard')}
          </button>
        )}

        <button
          onClick={() => navigate('/member/chat')}
          className="mh-btn mh-btn--icon chat-header-badge-wrap"
          title="Chat"
        >
          <MessageCircle size={18} />
          {unreadCount > 0 && (
            <span className="chat-header-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>

        <button onClick={() => navigate('/member/support')} className="mh-btn mh-btn--icon" title={t('header.support')}>
          🎫
        </button>
        <button onClick={() => navigate('/member/wunschliste')} className="mh-btn mh-btn--icon" title={t('header.wishlist')}>
          💡
        </button>

        {familyMembers.length > 1 && (
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
        )}

        <LanguageSwitcher compact={true} showLabel={false} />

        <button className="mh-btn mh-btn--logout" onClick={handleLogout} title={t('header.logout')}>
          <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="mh-logout-label">{t('header.logout')}</span>
        </button>
      </div>
    </header>
    </>
  );
};

export default MemberHeader;
