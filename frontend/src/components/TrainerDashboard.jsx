import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Calendar, Users, CheckCircle, Clock, LogOut, UserCheck } from 'lucide-react';
import axios from 'axios';
import '../styles/components.css';
import '../styles/themes.css';
import '../styles/TrainerDashboard.css';

// Importiere die bestehenden Komponenten
import CheckinSystem from './CheckinSystem';
import Anwesenheit from './Anwesenheit';
import Stundenplan from './Stundenplan';

const TrainerDashboard = () => {
  const { user, logout } = useAuth();
  const [activeView, setActiveView] = useState('checkin');

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="trainer-dashboard">
      {/* Header */}
      <div className="trainer-dashboard-header">
        <div>
          <h1 className="trainer-dashboard-title">
            <UserCheck size={32} />
            Trainer Dashboard
          </h1>
          <p className="u-text-secondary">
            Willkommen, {user?.vorname || user?.username || 'Trainer'}!
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="trainer-dashboard-logout-btn"
        >
          <LogOut size={18} />
          Abmelden
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="trainer-dashboard-nav">
        <button
          onClick={() => setActiveView('checkin')}
          className={`trainer-dashboard-tab${activeView === 'checkin' ? ' trainer-dashboard-tab--active' : ''}`}
        >
          <CheckCircle size={20} />
          Check-in
        </button>
        <button
          onClick={() => setActiveView('anwesenheit')}
          className={`trainer-dashboard-tab${activeView === 'anwesenheit' ? ' trainer-dashboard-tab--active' : ''}`}
        >
          <Users size={20} />
          Anwesenheit
        </button>
        <button
          onClick={() => setActiveView('stundenplan')}
          className={`trainer-dashboard-tab${activeView === 'stundenplan' ? ' trainer-dashboard-tab--active' : ''}`}
        >
          <Calendar size={20} />
          Stundenplan
        </button>
      </div>

      {/* Content Area */}
      <div className="trainer-dashboard-content">
        {activeView === 'checkin' && <CheckinSystem />}
        {activeView === 'anwesenheit' && <Anwesenheit />}
        {activeView === 'stundenplan' && <Stundenplan />}
      </div>
    </div>
  );
};

export default TrainerDashboard;
