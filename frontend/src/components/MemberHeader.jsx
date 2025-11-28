import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import axios from 'axios';
import logo from '../assets/dojo-logo.png';
import '../styles/Dashboard.css';

const MemberHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const [userDisplayName, setUserDisplayName] = useState('');

  const isMainDashboard = location.pathname === '/dashboard';

  // Lade Mitgliedsnamen für Anzeige im Header
  useEffect(() => {
    const loadUserDisplayName = async () => {
      if (user?.email) {
        try {
          const response = await axios.get(`/mitglieder/by-email/${encodeURIComponent(user.email)}`);
          if (response.data) {
            const fullName = `${response.data.vorname || ''} ${response.data.nachname || ''}`.trim();
            setUserDisplayName(fullName || user.username || 'Mitglied');
          }
        } catch (err) {
          console.error('Fehler beim Laden des Mitgliedsnamens:', err);
          setUserDisplayName(user.username || 'Mitglied');
        }
      }
    };

    loadUserDisplayName();
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDashboardClick = () => {
    navigate('/dashboard');
  };

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-left">
        <img src={logo} alt="Dojo Logo" className="dashboard-logo" />
        <h2>Mein Dojo Dashboard</h2>
      </div>
      <div className="dashboard-header-right">
        {!isMainDashboard && (
          <button
            onClick={handleDashboardClick}
            className="logout-button"
            style={{ marginRight: '0.5rem' }}
          >
            ← Dashboard
          </button>
        )}
        {userDisplayName && (
          <div className="user-display">
            <span className="user-icon">👤</span>
            <span className="user-name">{userDisplayName}</span>
          </div>
        )}
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
          <span className="logout-text">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default MemberHeader;
