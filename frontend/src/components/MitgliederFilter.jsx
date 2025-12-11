import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  AlertCircle,
  FileText,
  CreditCard,
  Users,
  Download,
  Mail
} from "lucide-react";
import { useDojoContext } from '../context/DojoContext.jsx';
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Auswertungen.css";

const MitgliederFilter = () => {
  const { filterType } = useParams();
  const navigate = useNavigate();
  const { getDojoFilterParam, activeDojo } = useDojoContext();
  const [loading, setLoading] = useState(true);
  const [mitglieder, setMitglieder] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('all');

  useEffect(() => {
    loadFilteredMembers();
  }, [filterType, activeDojo, selectedPaymentMethod]);

  const loadFilteredMembers = async () => {
    try {
      setLoading(true);
      const dojoFilterParam = getDojoFilterParam();
      const separator = dojoFilterParam ? '&' : '';

      let endpoint = '';
      switch (filterType) {
        case 'ohne-sepa':
          endpoint = `/mitglieder/filter/ohne-sepa?${dojoFilterParam}`;
          break;
        case 'ohne-vertrag':
          endpoint = `/mitglieder/filter/ohne-vertrag?${dojoFilterParam}`;
          break;
        case 'tarif-abweichung':
          endpoint = `/mitglieder/filter/tarif-abweichung?${dojoFilterParam}`;
          break;
        case 'zahlungsweisen':
          endpoint = `/mitglieder/filter/zahlungsweisen?payment_method=${selectedPaymentMethod}${separator}${dojoFilterParam}`;
          break;
        default:
          endpoint = `/mitglieder?${dojoFilterParam}`;
      }

      const response = await fetch(`${config.apiBaseUrl}${endpoint}`);

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Mitglieder');
      }

      const data = await response.json();
      setMitglieder(data.data || data.mitglieder || []);
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Mitglieder:', error);
      setMitglieder([]);
      setLoading(false);
    }
  };

  const getFilterTitle = () => {
    switch (filterType) {
      case 'ohne-sepa':
        return '🚫 Mitglieder ohne SEPA-Mandat';
      case 'ohne-vertrag':
        return '📄 Mitglieder ohne Vertrag';
      case 'tarif-abweichung':
        return '⚠️ Mitglieder mit Tarif-Abweichungen';
      case 'zahlungsweisen':
        return '💳 Mitglieder nach Zahlungsweise';
      default:
        return '👥 Mitglieder';
    }
  };

  const getFilterDescription = () => {
    switch (filterType) {
      case 'ohne-sepa':
        return 'Diese Mitglieder haben Lastschrift als Zahlungsmethode, aber kein aktives SEPA-Mandat hinterlegt.';
      case 'ohne-vertrag':
        return 'Diese Mitglieder haben aktuell keinen aktiven Vertrag.';
      case 'tarif-abweichung':
        return 'Diese Mitglieder zahlen einen abweichenden Beitrag vom Standard-Tarif.';
      case 'zahlungsweisen':
        return 'Mitglieder gefiltert nach ihrer Zahlungsmethode.';
      default:
        return '';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Vorname', 'Nachname', 'Email', 'Zahlungsmethode', 'Monatsbeitrag', 'Status'];
    const rows = mitglieder.map(m => [
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.email,
      m.zahlungsmethode || '-',
      m.monatsbeitrag || '-',
      m.aktiv ? 'Aktiv' : 'Inaktiv'
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(';'))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `mitglieder_${filterType}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div style={{ padding: '2rem', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard/finanzcockpit')}>
          <ArrowLeft size={20} />
          Zurück zum Finanzcockpit
        </button>
        <div>
          <h1>{getFilterTitle()}</h1>
          <p>{getFilterDescription()}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={exportToCSV} disabled={mitglieder.length === 0}>
            <Download size={20} />
            CSV Export
          </button>
        </div>
      </div>

      {/* Zahlungsweise-Filter (nur für zahlungsweisen-Ansicht) */}
      {filterType === 'zahlungsweisen' && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h3 style={{ color: '#FFD700', marginBottom: '1rem' }}>Zahlungsmethode wählen</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['all', 'SEPA-Lastschrift', 'Lastschrift', 'Überweisung', 'Bar', 'Karte', 'PayPal'].map(method => (
              <button
                key={method}
                className={`btn ${selectedPaymentMethod === method ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedPaymentMethod(method)}
              >
                {method === 'all' ? '🔍 Alle' : method}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <AlertCircle size={32} color="#3b82f6" />
        <div>
          <h3 style={{ margin: 0, color: '#3b82f6' }}>
            {loading ? 'Laden...' : `${mitglieder.length} Mitglied${mitglieder.length !== 1 ? 'er' : ''} gefunden`}
          </h3>
          <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
            {filterType === 'ohne-sepa' && 'Bitte SEPA-Mandate für diese Mitglieder hinterlegen.'}
            {filterType === 'ohne-vertrag' && 'Diese Mitglieder benötigen möglicherweise einen neuen Vertrag.'}
            {filterType === 'tarif-abweichung' && 'Prüfen Sie die Beiträge dieser Mitglieder.'}
            {filterType === 'zahlungsweisen' && 'Übersicht über Zahlungsmethoden der Mitglieder.'}
          </p>
        </div>
      </div>

      {/* Mitglieder-Liste */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Lade Mitglieder...</p>
        </div>
      ) : mitglieder.length === 0 ? (
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '3rem',
          textAlign: 'center',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <Users size={48} color="#9ca3af" style={{ marginBottom: '1rem' }} />
          <h3 style={{ color: '#9ca3af' }}>Keine Mitglieder gefunden</h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
            {filterType === 'ohne-sepa' && 'Alle Mitglieder mit Lastschrift haben ein SEPA-Mandat. ✅'}
            {filterType === 'ohne-vertrag' && 'Alle aktiven Mitglieder haben einen Vertrag. ✅'}
            {filterType === 'tarif-abweichung' && 'Keine Tarif-Abweichungen gefunden. ✅'}
            {filterType === 'zahlungsweisen' && 'Keine Mitglieder mit dieser Zahlungsmethode.'}
          </p>
        </div>
      ) : (
        <div className="mitglieder-grid">
          {mitglieder.map(mitglied => (
            <div
              key={mitglied.mitglied_id}
              className="mitglied-card"
              onClick={() => navigate(`/dashboard/mitglied/${mitglied.mitglied_id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="mitglied-card__header">
                <div>
                  <h3>{mitglied.vorname} {mitglied.nachname}</h3>
                  <p>ID: {mitglied.mitglied_id}</p>
                </div>
                <span className={`mitglied-card__badge ${mitglied.aktiv ? 'badge-success' : 'badge-danger'}`}>
                  {mitglied.aktiv ? '✅ Aktiv' : '❌ Inaktiv'}
                </span>
              </div>

              <div className="mitglied-card__body">
                <div className="mitglied-card__info">
                  <Mail size={16} />
                  <span>{mitglied.email || 'Keine Email'}</span>
                </div>

                {mitglied.zahlungsmethode && (
                  <div className="mitglied-card__info">
                    <CreditCard size={16} />
                    <span>{mitglied.zahlungsmethode}</span>
                  </div>
                )}

                {mitglied.monatsbeitrag && (
                  <div className="mitglied-card__info">
                    <span style={{ fontWeight: '600', color: '#4caf50' }}>
                      {formatCurrency(mitglied.monatsbeitrag)}/Monat
                    </span>
                  </div>
                )}

                {filterType === 'ohne-sepa' && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}>
                    <AlertCircle size={14} style={{ display: 'inline', marginRight: '0.5rem' }} />
                    Kein SEPA-Mandat
                  </div>
                )}

                {filterType === 'ohne-vertrag' && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem',
                    background: 'rgba(245, 158, 11, 0.1)',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    color: '#f59e0b',
                    border: '1px solid rgba(245, 158, 11, 0.3)'
                  }}>
                    <FileText size={14} style={{ display: 'inline', marginRight: '0.5rem' }} />
                    Kein aktiver Vertrag
                  </div>
                )}

                {filterType === 'tarif-abweichung' && mitglied.abweichung_grund && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem',
                    background: 'rgba(139, 92, 246, 0.1)',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    color: '#8b5cf6',
                    border: '1px solid rgba(139, 92, 246, 0.3)'
                  }}>
                    {mitglied.abweichung_grund}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MitgliederFilter;
