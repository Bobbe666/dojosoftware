import React, { useState } from 'react';
import { X, Bell, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';
import './PushNotificationPopup.css';

const PushNotificationPopup = ({ notifications, onClose, onConfirm }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [confirmedIds, setConfirmedIds] = useState(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  if (!notifications || notifications.length === 0) return null;

  const current = notifications[currentIndex];
  const total = notifications.length;
  const isConfirmed = confirmedIds.has(current.id);

  let meta = null;
  try { meta = current.metadata ? JSON.parse(current.metadata) : null; } catch {}

  const isPruefungZulassung = meta?.type === 'pruefung_zulassung';
  const isPruefungLastschrift = meta?.type === 'pruefung_lastschrift';

  // Nur lokalen Zustand aktualisieren (kein onConfirm aufrufen)
  const markLocalDone = (id) => {
    setConfirmedIds(prev => new Set([...prev, id]));
  };

  const handlePruefungAntwort = async (antwort) => {
    setActionLoading(true);
    try {
      await axios.post('/pruefungen/kandidaten/antwort', {
        pruefung_id: meta.pruefung_id,
        antwort,
        notification_id: current.id,
      });
      markLocalDone(current.id);
    } catch { /* still mark done locally */ markLocalDone(current.id); }
    setActionLoading(false);
  };

  const handleLastschriftAntwort = async (zugestimmt) => {
    setActionLoading(true);
    try {
      await axios.post('/pruefungen/kandidaten/lastschrift-zustimmung', {
        pruefung_id: meta.pruefung_id,
        zugestimmt,
        notification_id: current.id,
      });
      markLocalDone(current.id);
    } catch { markLocalDone(current.id); }
    setActionLoading(false);
  };

  const handleConfirm = async () => {
    if (onConfirm) await onConfirm(current.id);
    markLocalDone(current.id);
  };

  const handleNext = () => {
    if (currentIndex < total - 1) setCurrentIndex(i => i + 1);
    else onClose();
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1);
  };

  // Formatiere Datum sicher ohne Timezone-Shift
  const formatDatum = (iso) => {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('T')[0].split('-');
    return `${d}.${m}.${y}`;
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
          <button className="pnp-close-btn" onClick={onClose} title="Schliessen">
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
          {isPruefungZulassung && meta?.pruefungsdatum && !isConfirmed && (
            <div style={{ marginTop: '4px', fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
              Pruefungsdatum: {formatDatum(meta.pruefungsdatum)}
            </div>
          )}
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>

            {/* Pruefungs-Zulassung Antwort */}
            {isPruefungZulassung && !isConfirmed && (
              <>
                <button
                  className="pnp-confirm-btn"
                  style={{ background: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.4)', color: '#4ade80' }}
                  onClick={() => handlePruefungAntwort('kommt')}
                  disabled={actionLoading}
                >
                  <Check size={14} /> Ich komme
                </button>
                <button
                  className="pnp-confirm-btn"
                  style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}
                  onClick={() => handlePruefungAntwort('kommt_nicht')}
                  disabled={actionLoading}
                >
                  <X size={14} /> Ich komme nicht
                </button>
              </>
            )}

            {/* Lastschrift-Zustimmung */}
            {isPruefungLastschrift && !isConfirmed && (
              <>
                <button
                  className="pnp-confirm-btn"
                  style={{ background: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.4)', color: '#4ade80' }}
                  onClick={() => handleLastschriftAntwort(true)}
                  disabled={actionLoading}
                >
                  <Check size={14} /> Ja, einverstanden
                </button>
                <button
                  className="pnp-confirm-btn"
                  style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}
                  onClick={() => handleLastschriftAntwort(false)}
                  disabled={actionLoading}
                >
                  <X size={14} /> Nein
                </button>
              </>
            )}

            {/* Standard Bestaetigen (fuer andere requires_confirmation) */}
            {!isPruefungZulassung && !isPruefungLastschrift && current.requires_confirmation && !current.confirmed_at && !isConfirmed && (
              <button className="pnp-confirm-btn" onClick={handleConfirm}>
                <Check size={14} /> Bestaetigen
              </button>
            )}

            {isConfirmed && (
              <span className="pnp-confirmed-badge">&#10003; Gespeichert</span>
            )}
          </div>

          {/* Navigation */}
          <div className="pnp-nav">
            {total > 1 && (
              <button className="pnp-nav-btn" onClick={handlePrev} disabled={currentIndex === 0}>
                <ChevronLeft size={16} />
              </button>
            )}
            <button className="pnp-next-btn" onClick={handleNext}>
              {currentIndex < total - 1 ? 'Weiter' : (current.requires_confirmation && !isConfirmed ? 'Ueberspringen' : 'Schliessen')}
              {currentIndex < total - 1 && <ChevronRight size={14} />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PushNotificationPopup;
