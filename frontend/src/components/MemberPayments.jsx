import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, DollarSign, CheckCircle, AlertTriangle, Clock, Euro, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import axios from 'axios';
import MemberHeader from './MemberHeader.jsx';
import '../styles/components.css';
import '../styles/themes.css';

const MemberPayments = () => {
  const { user } = useAuth();
  const [vertraege, setVertraege] = useState([]);
  const [loading, setLoading] = useState(true);
  const [memberData, setMemberData] = useState(null);

  useEffect(() => {
    if (user?.email) {
      loadPayments();
    }
  }, [user?.email]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      // 1. Lade Mitgliedsdaten über Email
      const userEmail = user?.email || 'tom@example.com';

      const memberResponse = await fetch(`/api/mitglieder/by-email/${encodeURIComponent(userEmail)}`);

      if (!memberResponse.ok) {
        throw new Error(`HTTP ${memberResponse.status}: ${memberResponse.statusText}`);
      }

      const memberData = await memberResponse.json();
      setMemberData(memberData);

      // 2. Lade Verträge des Mitglieds
      const vertraegeResponse = await axios.get(`/vertraege?mitglied_id=${memberData.mitglied_id}`);

      // Filtere nur Verträge dieses Mitglieds (API filtert möglicherweise nicht korrekt)
      const memberVertraege = Array.isArray(vertraegeResponse.data?.data)
        ? vertraegeResponse.data.data.filter(v => v.mitglied_id === memberData.mitglied_id)
        : Array.isArray(vertraegeResponse.data)
          ? vertraegeResponse.data.filter(v => v.mitglied_id === memberData.mitglied_id)
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
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.2)'
      };
    } else if (vertrag.status === 'gekündigt') {
      return {
        icon: <AlertTriangle size={20} />,
        text: 'Gekündigt',
        color: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.2)'
      };
    } else if (vertrag.status === 'pausiert') {
      return {
        icon: <Clock size={20} />,
        text: 'Pausiert',
        color: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.2)'
      };
    }
    return {
      icon: <Clock size={20} />,
      text: vertrag.status,
      color: 'rgba(255, 255, 255, 0.7)',
      bgColor: 'rgba(255, 255, 255, 0.1)'
    };
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <MemberHeader />
        <div className="dashboard-content">
          <div style={{ textAlign: 'center', padding: '3rem', color: '#ffd700' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 1rem', border: '3px solid rgba(255, 215, 0, 0.3)', borderTopColor: '#ffd700', width: '40px', height: '40px' }}></div>
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

      <div className="dashboard-content" style={{ padding: '2rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <CreditCard size={32} style={{ color: '#ffd700' }} />
              <h1 style={{ color: '#ffd700', margin: 0 }}>Meine Beiträge</h1>
            </div>
            <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: 0 }}>
              Übersicht über deine Verträge und Zahlungen
            </p>
          </div>

          {/* Zusammenfassung - Statistik-Karten */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem',
            marginBottom: '3rem'
          }}>
            {/* Monatlicher Betrag */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 215, 0, 0.2)',
              borderRadius: '16px',
              padding: '1.5rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2.5rem', color: '#ffd700', marginBottom: '0.5rem' }}>
                <Euro size={40} />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffd700', marginBottom: '0.5rem' }}>
                {formatCurrency(totalMonatlich)}
              </div>
              <h3 style={{ color: '#ffffff', margin: 0, fontSize: '1rem' }}>Monatlich</h3>
            </div>

            {/* Aktive Verträge */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 215, 0, 0.2)',
              borderRadius: '16px',
              padding: '1.5rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2.5rem', color: '#ffd700', marginBottom: '0.5rem' }}>
                <FileText size={40} />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffd700', marginBottom: '0.5rem' }}>
                {aktiveVertraege}
              </div>
              <h3 style={{ color: '#ffffff', margin: 0, fontSize: '1rem' }}>Aktive Verträge</h3>
            </div>

            {/* Zahlungsart */}
            {vertraege.length > 0 && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: '16px',
                padding: '1.5rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', color: '#ffd700', marginBottom: '0.5rem' }}>
                  <CreditCard size={40} />
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffd700', marginBottom: '0.5rem' }}>
                  {vertraege[0].zahlungsart === 'lastschrift' ? 'Lastschrift' :
                   vertraege[0].zahlungsart === 'überweisung' ? 'Überweisung' :
                   vertraege[0].zahlungsart || 'Nicht festgelegt'}
                </div>
                <h3 style={{ color: '#ffffff', margin: 0, fontSize: '1rem' }}>Zahlungsart</h3>
              </div>
            )}
          </div>

          {/* Vertragsliste */}
          <div>
            <h2 style={{ color: '#ffd700', marginBottom: '1.5rem', fontSize: '1.5rem' }}>Meine Verträge</h2>

            {vertraege.length === 0 ? (
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: '16px',
                padding: '3rem',
                textAlign: 'center'
              }}>
                <AlertTriangle size={48} style={{ color: '#ffd700', margin: '0 auto 1rem' }} />
                <h3 style={{ color: '#ffd700', marginBottom: '0.5rem' }}>Keine Verträge gefunden</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Es wurden keine Vertragsdaten gefunden.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {vertraege.map(vertrag => {
                  const statusInfo = getStatusInfo(vertrag);
                  return (
                    <div key={vertrag.vertrag_id} style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${vertrag.status === 'aktiv' ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.15)'}`,
                      borderRadius: '16px',
                      padding: '1.5rem',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = vertrag.status === 'aktiv' ? '#ffd700' : 'rgba(255, 255, 255, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = vertrag.status === 'aktiv' ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.15)';
                    }}>
                      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                        {/* Icon */}
                        <div style={{
                          fontSize: '3rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '80px',
                          height: '80px',
                          background: statusInfo.bgColor,
                          borderRadius: '12px'
                        }}>
                          📄
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                              <h3 style={{ color: '#ffd700', margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>
                                Vertrag #{vertrag.vertrag_id}
                              </h3>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ color: statusInfo.color }}>
                                  {statusInfo.icon}
                                </div>
                                <span style={{
                                  padding: '0.25rem 0.75rem',
                                  background: statusInfo.bgColor,
                                  color: statusInfo.color,
                                  borderRadius: '6px',
                                  fontSize: '0.85rem',
                                  fontWeight: '500'
                                }}>
                                  {statusInfo.text}
                                </span>
                              </div>
                            </div>

                            {/* Betrag prominent */}
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#ffd700' }}>
                                {formatCurrency(vertrag.monatlicher_betrag)}
                              </div>
                              <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>
                                pro Monat
                              </div>
                            </div>
                          </div>

                          {/* Details Grid */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '1rem',
                            marginTop: '1rem',
                            padding: '1rem',
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '8px'
                          }}>
                            <div>
                              <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                Start
                              </div>
                              <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                                {formatDate(vertrag.start_datum)}
                              </div>
                            </div>

                            {vertrag.ende_datum && (
                              <div>
                                <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                  Ende
                                </div>
                                <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                                  {formatDate(vertrag.ende_datum)}
                                </div>
                              </div>
                            )}

                            {vertrag.naechste_zahlung && (
                              <div>
                                <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                  Nächste Zahlung
                                </div>
                                <div style={{ color: '#ffd700', fontWeight: '500' }}>
                                  {formatDate(vertrag.naechste_zahlung)}
                                </div>
                              </div>
                            )}

                            <div>
                              <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                Zahlungsart
                              </div>
                              <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500', textTransform: 'capitalize' }}>
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
