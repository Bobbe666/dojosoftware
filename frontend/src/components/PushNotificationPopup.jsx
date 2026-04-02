import React, { useState } from 'react';
import { X, Bell, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import './PushNotificationPopup.css';

const PushNotificationPopup = ({ notifications, onClose, onConfirm }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [confirmedIds, setConfirmedIds] = useState(new Set());

  if (!notifications || notifications.length === 0) return null;

  const current = notifications[currentIndex];
  const total = notifications.length;
  const isConfirmed = confirmedIds.has(current.id);

  const handleConfirm = async () => {
    await onConfirm(current.id);
    setConfirmedIds(prev => new Set([...prev, current.id]));
  };

  const handleNext = () => {
    if (currentIndex < total - 1) setCurrentIndex(i => i + 1);
    else onClose();
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1);
  };

  return (
    <div className="pnp-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pnp-card">

        {/* Header */}
        <div className="pnp-header">
          <div className="pnp-header-left">
            <Bell size={16} className="pnp-bell-icon" />
            <span className="pnp-header-title">Neue Nachricht</span>
            {total > 1 && (
              <span className="pnp-counter">{currentIndex + 1} / {total}</span>
            )}
          </div>
          <button className="pnp-close-btn" onClick={onClose} title="Schließen">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="pnp-body">
          <div className="pnp-subject">
            {current.subject || current.title || 'Benachrichtigung'}
          </div>
          <div className="pnp-message">
            {current.message}
          </div>
          {current.created_at && (
            <div className="pnp-time">
              {new Date(current.created_at).toLocaleString('de-DE', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pnp-footer">
          {/* Bestätigen-Button (nur wenn erforderlich und noch nicht bestätigt) */}
          {current.requires_confirmation && !current.confirmed_at && !isConfirmed ? (
            <button className="pnp-confirm-btn" onClick={handleConfirm}>
              <Check size={14} /> Bestätigen
            </button>
          ) : current.requires_confirmation && (current.confirmed_at || isConfirmed) ? (
            <span className="pnp-confirmed-badge">✓ Bestätigt</span>
          ) : (
            <span />
          )}

          {/* Navigation */}
          <div className="pnp-nav">
            {total > 1 && (
              <button
                className="pnp-nav-btn"
                onClick={handlePrev}
                disabled={currentIndex === 0}
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <button className="pnp-next-btn" onClick={handleNext}>
              {currentIndex < total - 1 ? 'Weiter' : 'Schließen'}
              {currentIndex < total - 1 && <ChevronRight size={14} />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PushNotificationPopup;
