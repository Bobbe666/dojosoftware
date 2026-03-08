import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, AlertTriangle, Clock, Euro, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config.js';
import MemberHeader from './MemberHeader.jsx';
import '../styles/components.css';
import '../styles/themes.css';
import '../styles/MemberPayments.css';

const MemberPayments = () => {
  const { user } = useAuth();
  const [vertraege, setVertraege] = useState([]);
  const [loading, setLoading] = useState(true);
  const [memberData, setMemberData] = useState(null);

  useEffect(() => {
    if (user?.mitglied_id) {
      loadPayments();
    }
  }, [user?.mitglied_id]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const mitgliedId = user.mitglied_id;

      // Lade Verträge des Mitglieds
      const vertraegeResponse = await fetchWithAuth(`${config.apiBaseUrl}/vertraege?mitglied_id=${mitgliedId}`);
      if (!vertraegeResponse.ok) throw new Error(`HTTP ${vertraegeResponse.status}`);

      const vertraegeData = await vertraegeResponse.json();
      const memberVertraege = Array.isArray(vertraegeData?.data)
        ? vertraegeData.data.filter(v => v.mitglied_id === mitgliedId && !v.geloescht)
        : Array.isArray(vertraegeData)
          ? vertraegeData.filter(v => v.mitglied_id === mitgliedId && !v.geloescht)
          : [];

      setVertraege(memberVertraege);
    } catch (error) {
      console.error('Fehler beim Laden der Zahlungsdaten:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Nicht festgelegt';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getStatusInfo = (vertrag) => {
    if (vertrag.status === 'aktiv') {
      return {
        icon: <CheckCircle size={20} />,
        text: 'Aktiv',
        color: 'var(--success)',
        bgColor: 'rgba(16, 185, 129, 0.2)'
      };
    } else if (vertrag.status === 'gekündigt') {
      return {
        icon: <AlertTriangle size={20} />,
        text: 'Gekündigt',
        color: 'var(--error)',
        bgColor: 'rgba(239, 68, 68, 0.2)'
      };
    } else if (vertrag.status === 'pausiert') {
      return {
        icon: <Clock size={20} />,
        text: 'Pausiert',
        color: 'var(--warning)',
        bgColor: 'rgba(245, 158, 11, 0.2)'
      };
    }
    return {
      icon: <Clock size={20} />,
      text: vertrag.status,
      color: 'var(--text-secondary)',
      bgColor: 'rgba(255, 255, 255, 0.1)'
    };
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="mp-loading-wrapper">
            <div className="loading-spinner mp-loading-spinner"></div>
            <p>Lade Zahlungsdaten...</p>
          </div>
        </div>
      </div>
    );
  }

  const totalMonatlich = vertraege
    .filter(v => v.status === 'aktiv')
    .reduce((sum, v) => sum + parseFloat(v.monatlicher_betrag || 0), 0);

  const aktiveVertraege = vertraege.filter(v => v.status === 'aktiv').length;

  return (
    <div className="dashboard-container">
      <MemberHeader />
      <div className="dashboard-content mp-content-padding">
        <div className="mp-content-wrapper">
          {/* Header */}
          <div className="mp-page-header">
            <div className="mp-page-header-row">
              <CreditCard size={32} className="u-text-accent" />
              <h1 className="mp-page-title">Meine Beiträge</h1>
            </div>
            <p className="mp-page-subtitle">
              Übersicht über deine Verträge und Zahlungen
            </p>
          </div>

          {/* Zusammenfassung - Statistik-Karten */}
          <div className="mp-stats-grid">
            {/* Monatlicher Betrag */}
            <div className="mp-stat-card">
              <div className="mp-stat-icon">
                <Euro size={40} />
              </div>
              <div className="mp-stat-value-lg">
                {formatCurrency(totalMonatlich)}
              </div>
              <h3 className="mp-card-title">Monatlich</h3>
            </div>

            {/* Aktive Verträge */}
            <div className="mp-stat-card">
              <div className="mp-stat-icon">
                <FileText size={40} />
              </div>
              <div className="mp-stat-value-lg">
                {aktiveVertraege}
              </div>
              <h3 className="mp-card-title">Aktive Verträge</h3>
            </div>

            {/* Zahlungsart */}
            {vertraege.length > 0 && (
              <div className="mp-stat-card">
                <div className="mp-stat-icon">
                  <CreditCard size={40} />
                </div>
                <div className="mp-stat-value-md">
                  {vertraege[0].zahlungsart === 'lastschrift' ? 'Lastschrift' :
                   vertraege[0].zahlungsart === 'überweisung' ? 'Überweisung' :
                   vertraege[0].zahlungsart || 'Nicht festgelegt'}
                </div>
                <h3 className="mp-card-title">Zahlungsart</h3>
              </div>
            )}
          </div>

          {/* Vertragsliste */}
          <div>
            <h2 className="mp-section-title">Meine Verträge</h2>

            {vertraege.length === 0 ? (
              <div className="mp-empty-state">
                <AlertTriangle size={48} className="mp-empty-icon" />
                <h3 className="mp-empty-title">Keine Verträge gefunden</h3>
                <p className="u-text-secondary">Es wurden keine Vertragsdaten gefunden.</p>
              </div>
            ) : (
              <div className="mp-contract-list">
                {vertraege.map(vertrag => {
                  const statusInfo = getStatusInfo(vertrag);
                  return (
                    <div key={vertrag.vertrag_id} className={`mp-contract-card${vertrag.status === 'aktiv' ? ' mp-contract-card--aktiv' : ''}`}
                    style={{ '--status-bg': statusInfo.bgColor, '--status-color': statusInfo.color }}>
                      <div className="mp-contract-card-inner">
                        {/* Icon */}
                        <div className="mp-contract-icon-box">
                          📄
                        </div>

                        {/* Content */}
                        <div className="u-flex-1">
                          <div className="mp-contract-header-row">
                            <div>
                              <h3 className="mp-contract-title">
                                Vertrag #{vertrag.vertrag_id}
                              </h3>
                              <div className="u-flex-row-sm">
                                <div className="mp-contract-status-icon">
                                  {statusInfo.icon}
                                </div>
                                <span className="mp-contract-status-badge">
                                  {statusInfo.text}
                                </span>
                              </div>
                            </div>

                            {/* Betrag prominent */}
                            <div className="mp-amount-block">
                              <div className="mp-amount-value">
                                {formatCurrency(vertrag.monatlicher_betrag)}
                              </div>
                              <div className="mp-amount-label">
                                pro Monat
                              </div>
                            </div>
                          </div>

                          {/* Details Grid */}
                          <div className="mp-details-grid">
                            <div>
                              <div className="mp-stat-label">
                                Start
                              </div>
                              <div className="mp-field-value">
                                {formatDate(vertrag.start_datum)}
                              </div>
                            </div>

                            {vertrag.ende_datum && (
                              <div>
                                <div className="mp-stat-label">
                                  Ende
                                </div>
                                <div className="mp-field-value">
                                  {formatDate(vertrag.ende_datum)}
                                </div>
                              </div>
                            )}

                            {vertrag.naechste_zahlung && (
                              <div>
                                <div className="mp-stat-label">
                                  Nächste Zahlung
                                </div>
                                <div className="mp-next-payment-value">
                                  {formatDate(vertrag.naechste_zahlung)}
                                </div>
                              </div>
                            )}

                            <div>
                              <div className="mp-stat-label">
                                Zahlungsart
                              </div>
                              <div className="mp-zahlungsart-value">
                                {vertrag.zahlungsart || 'Nicht festgelegt'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .loading-spinner {
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top: 3px solid #ffd700;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default MemberPayments;
