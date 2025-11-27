import React, { useState, useEffect } from 'react';
import { X, Bell, Info } from 'lucide-react';
import '../styles/LoginInfoPopup.css';

const LoginInfoPopup = ({ onClose }) => {
  const [currentInfo, setCurrentInfo] = useState(null);

  useEffect(() => {
    // Simuliere das Laden aktueller Informationen
    const info = {
      title: "Willkommen zurück!",
      message: "Dein Mitgliedsstatus ist aktiv. Hier findest du alle wichtigen Informationen zu deinem Training.",
      type: "info",
      date: new Date().toLocaleDateString('de-DE')
    };
    setCurrentInfo(info);
  }, []);

  if (!currentInfo) return null;

  return (
    <div className="login-popup-overlay">
      <div className="login-popup-content">
        <div className="login-popup-header">
          <div className="login-popup-icon">
            <Info size={20} />
          </div>
          <h3>{currentInfo.title}</h3>
          <button onClick={onClose} className="login-popup-close">
            <X size={18} />
          </button>
        </div>
        
        <div className="login-popup-body">
          <p>{currentInfo.message}</p>
          <div className="login-popup-footer">
            <span className="login-popup-date">{currentInfo.date}</span>
            <button onClick={onClose} className="login-popup-button">
              Verstanden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginInfoPopup;
