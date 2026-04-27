import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, CalendarDays, Trophy, BarChart3, User } from 'lucide-react';
import '../styles/MobileBottomNav.css';

const tabs = [
  { icon: Home,        label: 'Home',       path: '/member/dashboard' },
  { icon: CalendarDays,label: 'Stundenplan', path: '/member/schedule' },
  { icon: Trophy,      label: 'Gürtel',     path: '/member/styles' },
  { icon: BarChart3,   label: 'Stats',      path: '/member/stats' },
  { icon: User,        label: 'Profil',     path: '/member/profile' },
];

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="mobile-bottom-nav" role="navigation" aria-label="Hauptnavigation">
      {tabs.map(({ icon: Icon, label, path }) => {
        const isActive = location.pathname === path;
        return (
          <button
            key={path}
            className={`mobile-bottom-nav__tab${isActive ? ' mobile-bottom-nav__tab--active' : ''}`}
            onClick={() => navigate(path)}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
