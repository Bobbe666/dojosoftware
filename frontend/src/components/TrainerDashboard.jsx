import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Calendar, Users, CheckCircle, Clock, LogOut, UserCheck } from 'lucide-react';
import axios from 'axios';
import '../styles/components.css';
import '../styles/themes.css';

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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      padding: '0'
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
        padding: '1.5rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{
            color: '#FFD700',
            marginBottom: '0.5rem',
            fontSize: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <UserCheck size={32} />
            Trainer Dashboard
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Willkommen, {user?.vorname || user?.username || 'Trainer'}!
          </p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '0.75rem 1.5rem',
            color: '#EF4444',
            cursor: 'pointer',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
          }}
        >
          <LogOut size={18} />
          Abmelden
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.2)',
        borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
        padding: '0 2rem',
        display: 'flex',
        gap: '1rem'
      }}>
        <button
          onClick={() => setActiveView('checkin')}
          style={{
            background: activeView === 'checkin' ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
            border: 'none',
            borderBottom: activeView === 'checkin' ? '2px solid #FFD700' : '2px solid transparent',
            padding: '1rem 2rem',
            color: activeView === 'checkin' ? '#FFD700' : 'rgba(255, 255, 255, 0.7)',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '1rem',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <CheckCircle size={20} />
          Check-in
        </button>
        <button
          onClick={() => setActiveView('anwesenheit')}
          style={{
            background: activeView === 'anwesenheit' ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
            border: 'none',
            borderBottom: activeView === 'anwesenheit' ? '2px solid #FFD700' : '2px solid transparent',
            padding: '1rem 2rem',
            color: activeView === 'anwesenheit' ? '#FFD700' : 'rgba(255, 255, 255, 0.7)',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '1rem',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Users size={20} />
          Anwesenheit
        </button>
        <button
          onClick={() => setActiveView('stundenplan')}
          style={{
            background: activeView === 'stundenplan' ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
            border: 'none',
            borderBottom: activeView === 'stundenplan' ? '2px solid #FFD700' : '2px solid transparent',
            padding: '1rem 2rem',
            color: activeView === 'stundenplan' ? '#FFD700' : 'rgba(255, 255, 255, 0.7)',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '1rem',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Calendar size={20} />
          Stundenplan
        </button>
      </div>

      {/* Content Area */}
      <div style={{
        padding: '0',
        minHeight: 'calc(100vh - 140px)'
      }}>
        {activeView === 'checkin' && <CheckinSystem />}
        {activeView === 'anwesenheit' && <Anwesenheit />}
        {activeView === 'stundenplan' && <Stundenplan />}
      </div>
    </div>
  );
};

export default TrainerDashboard;
