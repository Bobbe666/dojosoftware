import React, { useState, useEffect } from 'react';
import { X, UserPlus, Calendar, Mail, Phone, MapPin, CreditCard } from 'lucide-react';
import '../styles/AdminRegistrationPopup.css';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';


const AdminRegistrationPopup = () => {
  const [notifications, setNotifications] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [currentNotification, setCurrentNotification] = useState(null);

  // Prüfe alle 10 Sekunden auf neue Registrierungen
  useEffect(() => {
    const checkForNewRegistrations = async () => {
      try {
        console.log('🔍 Checking for new registrations...');
        const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/admin/unread`);
        console.log('📡 Response status:', response.status);

        const data = await response.json();
        console.log('📦 Response data:', data);

        if (data.success && data.notifications && data.notifications.length > 0) {
          console.log('✅ Found notifications:', data.notifications.length);

          // Zeige nur admin_alert Benachrichtigungen
          const adminAlerts = data.notifications.filter(n => n.type === 'admin_alert');
          console.log('🚨 Admin alerts found:', adminAlerts.length);

          if (adminAlerts.length > 0) {
            console.log('🎉 Showing popup with notification:', adminAlerts[0]);
            setNotifications(adminAlerts);
            setCurrentNotification(adminAlerts[0]);
            setShowPopup(true);
          }
        } else {
          console.log('ℹ️ No new notifications');
        }
      } catch (error) {
        console.error('❌ Fehler beim Abrufen der Benachrichtigungen:', error);
      }
    };

    // Initiale Prüfung
    console.log('🚀 Starting notification checker...');
    checkForNewRegistrations();

    // Prüfe alle 10 Sekunden
    const interval = setInterval(checkForNewRegistrations, 10000);

    return () => {
      console.log('🛑 Stopping notification checker');
      clearInterval(interval);
    };
  }, []);

  const handleClose = async () => {
    if (currentNotification) {
      try {
        // Markiere als gelesen
        await fetchWithAuth(`/notifications/admin/${currentNotification.id}/read`, {
          method: 'PUT'
        });

        // Entferne aus der Liste
        const remaining = notifications.filter(n => n.id !== currentNotification.id);
        setNotifications(remaining);

        // Zeige nächste Benachrichtigung oder schließe
        if (remaining.length > 0) {
          setCurrentNotification(remaining[0]);
        } else {
          setShowPopup(false);
          setCurrentNotification(null);
        }
      } catch (error) {
        console.error('Fehler beim Schließen der Benachrichtigung:', error);
        setShowPopup(false);
      }
    }
  };

  if (!showPopup || !currentNotification) {
    return null;
  }

  // Parse die Nachricht für strukturierte Anzeige
  const parseNotificationData = (message) => {
    const data = {};
    const lines = message.split('<br>');

    lines.forEach(line => {
      const match = line.match(/<strong>(.*?):<\/strong>\s*(.*)/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        data[key] = value;
      }
    });

    return data;
  };

  const notificationData = parseNotificationData(currentNotification.message);

  return (
    <div className="admin-registration-popup-overlay">
      <div className="admin-registration-popup">
        {/* Header */}
        <div className="popup-header">
          <div className="header-content">
            <UserPlus size={28} className="header-icon" />
            <div>
              <h2>{currentNotification.subject}</h2>
              <p className="timestamp">
                {new Date(currentNotification.created_at).toLocaleString('de-DE')}
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="popup-content">
          <div className="notification-badge">
            {notifications.length > 1 && (
              <span className="badge">
                {notifications.length} neue Registrierung{notifications.length > 1 ? 'en' : ''}
              </span>
            )}
          </div>

          <div className="member-info-grid">
            {notificationData.Name && (
              <div className="info-item">
                <UserPlus size={20} />
                <div>
                  <label>Name</label>
                  <p>{notificationData.Name}</p>
                </div>
              </div>
            )}

            {notificationData.Email && (
              <div className="info-item">
                <Mail size={20} />
                <div>
                  <label>Email</label>
                  <p>{notificationData.Email}</p>
                </div>
              </div>
            )}

            {notificationData.Geburtsdatum && notificationData.Geburtsdatum !== 'N/A' && (
              <div className="info-item">
                <Calendar size={20} />
                <div>
                  <label>Geburtsdatum</label>
                  <p>{notificationData.Geburtsdatum}</p>
                </div>
              </div>
            )}

            {notificationData.Telefon && notificationData.Telefon !== 'N/A' && (
              <div className="info-item">
                <Phone size={20} />
                <div>
                  <label>Telefon</label>
                  <p>{notificationData.Telefon}</p>
                </div>
              </div>
            )}

            {notificationData.Adresse && (
              <div className="info-item full-width">
                <MapPin size={20} />
                <div>
                  <label>Adresse</label>
                  <p>{notificationData.Adresse}</p>
                </div>
              </div>
            )}

            {notificationData.Tarif && notificationData.Tarif !== 'N/A' && (
              <div className="info-item full-width">
                <CreditCard size={20} />
                <div>
                  <label>Gewählter Tarif</label>
                  <p>{notificationData.Tarif}</p>
                </div>
              </div>
            )}

            {notificationData.Vertragsbeginn && notificationData.Vertragsbeginn !== 'N/A' && (
              <div className="info-item">
                <Calendar size={20} />
                <div>
                  <label>Vertragsbeginn</label>
                  <p>{notificationData.Vertragsbeginn}</p>
                </div>
              </div>
            )}

            {notificationData.Zahlungszyklus && notificationData.Zahlungszyklus !== 'N/A' && (
              <div className="info-item">
                <CreditCard size={20} />
                <div>
                  <label>Zahlungszyklus</label>
                  <p>{notificationData.Zahlungszyklus}</p>
                </div>
              </div>
            )}

            {notificationData.Zahlungsmethode && notificationData.Zahlungsmethode !== 'N/A' && (
              <div className="info-item">
                <CreditCard size={20} />
                <div>
                  <label>Zahlungsmethode</label>
                  <p>{notificationData.Zahlungsmethode}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="popup-footer">
          <button className="btn-primary" onClick={handleClose}>
            OK, verstanden
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminRegistrationPopup;
