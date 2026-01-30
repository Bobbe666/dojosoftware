// ============================================================================
// SUPPORT-TICKETSYSTEM - Frontend Komponente
// ============================================================================
// Bereiche: dojo (grün), verband (violett), org (blau)
// Status: offen, in_bearbeitung, warten_auf_antwort, erledigt, geschlossen

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  Ticket, Plus, Search, Filter, Send, Paperclip, X, ChevronDown, ChevronUp,
  Clock, CheckCircle, XCircle, MessageCircle, CircleDot, AlertTriangle,
  User, Calendar, Tag, Upload, Download, Loader2, RefreshCw, Users,
  Building2, Globe, FileText, HelpCircle, AlertOctagon, MoreVertical
} from 'lucide-react';
import '../styles/SupportTickets.css';

// Konfiguration
const STATUS_CONFIG = {
  offen: { label: 'Offen', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.15)', icon: CircleDot },
  in_bearbeitung: { label: 'In Bearbeitung', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.15)', icon: Clock },
  warten_auf_antwort: { label: 'Warten auf Antwort', color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.15)', icon: MessageCircle },
  erledigt: { label: 'Erledigt', color: '#10b981', bgColor: 'rgba(16,185,129,0.15)', icon: CheckCircle },
  geschlossen: { label: 'Geschlossen', color: '#6b7280', bgColor: 'rgba(107,114,128,0.15)', icon: XCircle }
};

const KATEGORIE_CONFIG = {
  vertrag: { label: 'Vertrag', icon: FileText, color: '#6366f1' },
  hilfe: { label: 'Hilfe zur Software', icon: HelpCircle, color: '#06b6d4' },
  problem: { label: 'Problem melden', icon: AlertOctagon, color: '#ef4444' },
  sonstiges: { label: 'Sonstiges', icon: Tag, color: '#8b5cf6' }
};

const BEREICH_CONFIG = {
  dojo: { label: 'Dojo', color: '#10b981', bgColor: 'rgba(16,185,129,0.1)', icon: Building2 },
  verband: { label: 'Verband', color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.1)', icon: Users },
  org: { label: 'Organisation', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)', icon: Globe }
};

const PRIORITAET_CONFIG = {
  niedrig: { label: 'Niedrig', color: '#6b7280' },
  mittel: { label: 'Mittel', color: '#f59e0b' },
  hoch: { label: 'Hoch', color: '#ef4444' },
  kritisch: { label: 'Kritisch', color: '#dc2626', pulse: true }
};

const SupportTickets = ({
  bereich = 'dojo',  // 'dojo' | 'verband' | 'org'
  showAllBereiche = false,  // Für SuperAdmin: Alle Bereiche anzeigen
  compact = false  // Kompakte Ansicht für Dashboard-Widget
}) => {
  const { token, user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.username === 'admin';
  const isSuperAdmin = user?.role === 'super_admin' || user?.username === 'admin';

  // State
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filter State
  const [filters, setFilters] = useState({
    status: '',
    kategorie: '',
    bereich: showAllBereiche ? '' : bereich,
    prioritaet: '',
    zugewiesen: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [newTicket, setNewTicket] = useState({
    kategorie: '',
    betreff: '',
    nachricht: '',
    prioritaet: 'mittel',
    bereich: bereich
  });

  // Nachricht State
  const [newMessage, setNewMessage] = useState('');
  const [isIntern, setIsIntern] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const fileInputRef = useRef(null);

  // Statistiken
  const [stats, setStats] = useState(null);

  // Bearbeiter-Liste
  const [bearbeiterListe, setBearbeiterListe] = useState([]);

  // Daten laden
  useEffect(() => {
    loadTickets();
    if (isAdmin) {
      loadStats();
      loadBearbeiter();
    }
  }, [filters]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await axios.get(`/support-tickets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setTickets(response.data.tickets || []);
    } catch (err) {
      console.error('Fehler beim Laden:', err);
      setError('Fehler beim Laden der Tickets');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get('/support-tickets/statistiken', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (err) {
      console.error('Fehler bei Statistiken:', err);
    }
  };

  const loadBearbeiter = async () => {
    try {
      const response = await axios.get('/support-tickets/bearbeiter/liste', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBearbeiterListe(response.data || []);
    } catch (err) {
      console.error('Fehler bei Bearbeitern:', err);
    }
  };

  const loadTicketDetails = async (ticketId) => {
    try {
      const response = await axios.get(`/support-tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedTicket(response.data);
    } catch (err) {
      console.error('Fehler beim Laden des Tickets:', err);
      setError('Fehler beim Laden des Tickets');
    }
  };

  // Neues Ticket erstellen
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');

    try {
      const response = await axios.post('/support-tickets', newTicket, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess(`Ticket ${response.data.ticket_nummer} erfolgreich erstellt`);
      setShowNewTicketModal(false);
      setNewTicket({
        kategorie: '',
        betreff: '',
        nachricht: '',
        prioritaet: 'mittel',
        bereich: bereich
      });
      loadTickets();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Erstellen');
    } finally {
      setSending(false);
    }
  };

  // Nachricht senden
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    setSending(true);
    try {
      await axios.post(`/support-tickets/${selectedTicket.id}/nachrichten`, {
        nachricht: newMessage,
        ist_intern: isIntern
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Dateien hochladen falls vorhanden
      for (const file of uploadFiles) {
        const formData = new FormData();
        formData.append('datei', file);
        await axios.post(`/support-tickets/${selectedTicket.id}/anhaenge`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      }

      setNewMessage('');
      setIsIntern(false);
      setUploadFiles([]);
      loadTicketDetails(selectedTicket.id);
      loadTickets();
    } catch (err) {
      setError('Fehler beim Senden');
    } finally {
      setSending(false);
    }
  };

  // Status ändern
  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await axios.put(`/support-tickets/${ticketId}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadTicketDetails(ticketId);
      loadTickets();
      if (isAdmin) loadStats();
    } catch (err) {
      setError('Fehler beim Ändern des Status');
    }
  };

  // Ticket zuweisen
  const handleAssign = async (ticketId, userId) => {
    try {
      await axios.put(`/support-tickets/${ticketId}/zuweisen`, { user_id: userId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadTicketDetails(ticketId);
      loadTickets();
    } catch (err) {
      setError('Fehler beim Zuweisen');
    }
  };

  // Datei-Upload Handler
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(f => f.size <= 5 * 1024 * 1024);
    setUploadFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Formatierung
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  // Gefilterte Tickets
  const filteredTickets = tickets.filter(t =>
    !searchTerm ||
    t.ticket_nummer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.betreff?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.ersteller_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Render Funktionen
  const renderStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.offen;
    const Icon = config.icon;
    return (
      <span className="status-badge" style={{ background: config.bgColor, color: config.color }}>
        <Icon size={14} />
        {config.label}
      </span>
    );
  };

  const renderBereichBadge = (bereichKey) => {
    const config = BEREICH_CONFIG[bereichKey] || BEREICH_CONFIG.dojo;
    const Icon = config.icon;
    return (
      <span className="bereich-badge" style={{ background: config.bgColor, color: config.color }}>
        <Icon size={12} />
        {config.label}
      </span>
    );
  };

  const renderPrioritaetBadge = (prioritaet) => {
    const config = PRIORITAET_CONFIG[prioritaet] || PRIORITAET_CONFIG.mittel;
    return (
      <span
        className={`prioritaet-badge ${config.pulse ? 'pulse' : ''}`}
        style={{ color: config.color }}
      >
        {config.label}
      </span>
    );
  };

  // Kompakte Ansicht für Dashboard-Widget
  if (compact) {
    return (
      <div className="support-tickets compact">
        <div className="compact-header">
          <div className="compact-title">
            <Ticket size={18} />
            <span>Support-Tickets</span>
          </div>
          <button className="btn-icon" onClick={() => setShowNewTicketModal(true)}>
            <Plus size={18} />
          </button>
        </div>

        {stats && (
          <div className="compact-stats">
            <div className="stat-item offen">
              <span className="stat-value">{stats.offen || 0}</span>
              <span className="stat-label">Offen</span>
            </div>
            <div className="stat-item bearbeitung">
              <span className="stat-value">{stats.in_bearbeitung || 0}</span>
              <span className="stat-label">In Arbeit</span>
            </div>
            {stats.kritisch_offen > 0 && (
              <div className="stat-item kritisch pulse">
                <span className="stat-value">{stats.kritisch_offen}</span>
                <span className="stat-label">Kritisch</span>
              </div>
            )}
          </div>
        )}

        <div className="compact-list">
          {filteredTickets.slice(0, 5).map(ticket => (
            <div
              key={ticket.id}
              className="compact-ticket"
              onClick={() => loadTicketDetails(ticket.id)}
            >
              <div className="compact-ticket-info">
                <span className="ticket-nummer">{ticket.ticket_nummer}</span>
                <span className="ticket-betreff">{ticket.betreff}</span>
              </div>
              {renderStatusBadge(ticket.status)}
            </div>
          ))}
        </div>

        {showNewTicketModal && renderNewTicketModal()}
      </div>
    );
  }

  // Vollständige Ansicht
  return (
    <div className="support-tickets">
      {/* Header */}
      <div className="support-header">
        <div className="support-title">
          <Ticket size={24} style={{ color: BEREICH_CONFIG[bereich]?.color }} />
          <div>
            <h2>Support-Tickets</h2>
            <span className="support-subtitle">
              {showAllBereiche ? 'Alle Bereiche' : BEREICH_CONFIG[bereich]?.label}
            </span>
          </div>
        </div>

        <div className="support-actions">
          <button className="btn-refresh" onClick={loadTickets} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn-primary" onClick={() => setShowNewTicketModal(true)}>
            <Plus size={18} />
            Neues Ticket
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="message error">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="message success">
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      {/* Statistiken für Admins */}
      {isAdmin && stats && (
        <div className="support-stats">
          <div className="stat-card" onClick={() => setFilters({...filters, status: 'offen'})}>
            <CircleDot size={20} style={{ color: '#f59e0b' }} />
            <div className="stat-info">
              <span className="stat-value">{stats.offen || 0}</span>
              <span className="stat-label">Offen</span>
            </div>
          </div>
          <div className="stat-card" onClick={() => setFilters({...filters, status: 'in_bearbeitung'})}>
            <Clock size={20} style={{ color: '#3b82f6' }} />
            <div className="stat-info">
              <span className="stat-value">{stats.in_bearbeitung || 0}</span>
              <span className="stat-label">In Bearbeitung</span>
            </div>
          </div>
          <div className="stat-card" onClick={() => setFilters({...filters, status: 'warten_auf_antwort'})}>
            <MessageCircle size={20} style={{ color: '#8b5cf6' }} />
            <div className="stat-info">
              <span className="stat-value">{stats.warten_auf_antwort || 0}</span>
              <span className="stat-label">Wartend</span>
            </div>
          </div>
          {showAllBereiche && (
            <>
              <div className="stat-card bereich-dojo" onClick={() => setFilters({...filters, bereich: 'dojo'})}>
                <Building2 size={20} />
                <div className="stat-info">
                  <span className="stat-value">{stats.dojo_tickets || 0}</span>
                  <span className="stat-label">Dojo</span>
                </div>
              </div>
              <div className="stat-card bereich-verband" onClick={() => setFilters({...filters, bereich: 'verband'})}>
                <Users size={20} />
                <div className="stat-info">
                  <span className="stat-value">{stats.verband_tickets || 0}</span>
                  <span className="stat-label">Verband</span>
                </div>
              </div>
              <div className="stat-card bereich-org" onClick={() => setFilters({...filters, bereich: 'org'})}>
                <Globe size={20} />
                <div className="stat-info">
                  <span className="stat-value">{stats.org_tickets || 0}</span>
                  <span className="stat-label">Org</span>
                </div>
              </div>
            </>
          )}
          {stats.kritisch_offen > 0 && (
            <div className="stat-card kritisch pulse" onClick={() => setFilters({...filters, prioritaet: 'kritisch'})}>
              <AlertOctagon size={20} />
              <div className="stat-info">
                <span className="stat-value">{stats.kritisch_offen}</span>
                <span className="stat-label">Kritisch</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter & Suche */}
      <div className="support-toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Suchen nach Nummer, Betreff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button
          className={`btn-filter ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={18} />
          Filter
          {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {showFilters && (
        <div className="filter-panel">
          <div className="filter-group">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
            >
              <option value="">Alle</option>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Kategorie</label>
            <select
              value={filters.kategorie}
              onChange={(e) => setFilters({...filters, kategorie: e.target.value})}
            >
              <option value="">Alle</option>
              {Object.entries(KATEGORIE_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          {showAllBereiche && (
            <div className="filter-group">
              <label>Bereich</label>
              <select
                value={filters.bereich}
                onChange={(e) => setFilters({...filters, bereich: e.target.value})}
              >
                <option value="">Alle</option>
                {Object.entries(BEREICH_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="filter-group">
            <label>Priorität</label>
            <select
              value={filters.prioritaet}
              onChange={(e) => setFilters({...filters, prioritaet: e.target.value})}
            >
              <option value="">Alle</option>
              {Object.entries(PRIORITAET_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <div className="filter-group">
              <label>Zuweisung</label>
              <select
                value={filters.zugewiesen}
                onChange={(e) => setFilters({...filters, zugewiesen: e.target.value})}
              >
                <option value="">Alle</option>
                <option value="mir">Mir zugewiesen</option>
                <option value="niemand">Nicht zugewiesen</option>
              </select>
            </div>
          )}

          <button
            className="btn-reset-filter"
            onClick={() => setFilters({
              status: '',
              kategorie: '',
              bereich: showAllBereiche ? '' : bereich,
              prioritaet: '',
              zugewiesen: ''
            })}
          >
            Filter zurücksetzen
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="support-content">
        {/* Ticket Liste */}
        <div className={`ticket-list ${selectedTicket ? 'with-detail' : ''}`}>
          {loading ? (
            <div className="loading-state">
              <Loader2 className="spin" size={32} />
              <span>Lade Tickets...</span>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="empty-state">
              <Ticket size={48} />
              <h3>Keine Tickets gefunden</h3>
              <p>Es gibt keine Tickets mit den aktuellen Filtereinstellungen.</p>
              <button className="btn-primary" onClick={() => setShowNewTicketModal(true)}>
                <Plus size={18} />
                Neues Ticket erstellen
              </button>
            </div>
          ) : (
            filteredTickets.map(ticket => (
              <div
                key={ticket.id}
                className={`ticket-card ${selectedTicket?.id === ticket.id ? 'selected' : ''} bereich-${ticket.bereich}`}
                onClick={() => loadTicketDetails(ticket.id)}
              >
                <div className="ticket-card-header">
                  <span className="ticket-nummer">{ticket.ticket_nummer}</span>
                  {showAllBereiche && renderBereichBadge(ticket.bereich)}
                  {renderStatusBadge(ticket.status)}
                </div>

                <h4 className="ticket-betreff">{ticket.betreff}</h4>

                <div className="ticket-card-meta">
                  <span className="meta-item">
                    <User size={14} />
                    {ticket.ersteller_name}
                  </span>
                  <span className="meta-item">
                    <Calendar size={14} />
                    {formatDateShort(ticket.created_at)}
                  </span>
                  {ticket.nachrichten_count > 0 && (
                    <span className="meta-item">
                      <MessageCircle size={14} />
                      {ticket.nachrichten_count}
                    </span>
                  )}
                  {ticket.anhaenge_count > 0 && (
                    <span className="meta-item">
                      <Paperclip size={14} />
                      {ticket.anhaenge_count}
                    </span>
                  )}
                </div>

                <div className="ticket-card-footer">
                  <span className={`kategorie-tag ${ticket.kategorie}`}>
                    {KATEGORIE_CONFIG[ticket.kategorie]?.label || ticket.kategorie}
                  </span>
                  {renderPrioritaetBadge(ticket.prioritaet)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Ticket Detail */}
        {selectedTicket && (
          <div className="ticket-detail">
            <div className="detail-header">
              <div className="detail-title">
                <span className="ticket-nummer">{selectedTicket.ticket_nummer}</span>
                {showAllBereiche && renderBereichBadge(selectedTicket.bereich)}
              </div>
              <button className="btn-close" onClick={() => setSelectedTicket(null)}>
                <X size={20} />
              </button>
            </div>

            <h3 className="detail-betreff">{selectedTicket.betreff}</h3>

            <div className="detail-meta">
              <div className="meta-row">
                <span className="meta-label">Status:</span>
                {isAdmin ? (
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => handleStatusChange(selectedTicket.id, e.target.value)}
                    className="status-select"
                    style={{ color: STATUS_CONFIG[selectedTicket.status]?.color }}
                  >
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                ) : (
                  renderStatusBadge(selectedTicket.status)
                )}
              </div>

              <div className="meta-row">
                <span className="meta-label">Kategorie:</span>
                <span className={`kategorie-tag ${selectedTicket.kategorie}`}>
                  {KATEGORIE_CONFIG[selectedTicket.kategorie]?.label}
                </span>
              </div>

              <div className="meta-row">
                <span className="meta-label">Priorität:</span>
                {renderPrioritaetBadge(selectedTicket.prioritaet)}
              </div>

              <div className="meta-row">
                <span className="meta-label">Erstellt von:</span>
                <span>{selectedTicket.ersteller_name}</span>
              </div>

              <div className="meta-row">
                <span className="meta-label">Erstellt am:</span>
                <span>{formatDate(selectedTicket.created_at)}</span>
              </div>

              {isAdmin && (
                <div className="meta-row">
                  <span className="meta-label">Zugewiesen an:</span>
                  <select
                    value={selectedTicket.zugewiesen_an || ''}
                    onChange={(e) => handleAssign(selectedTicket.id, e.target.value || null)}
                    className="assign-select"
                  >
                    <option value="">Nicht zugewiesen</option>
                    {bearbeiterListe.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.vorname} {b.nachname}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Anhänge */}
            {selectedTicket.anhaenge?.length > 0 && (
              <div className="detail-attachments">
                <h4><Paperclip size={16} /> Anhänge</h4>
                <div className="attachment-list">
                  {selectedTicket.anhaenge.map(a => (
                    <a
                      key={a.id}
                      href={`/api/support-tickets/anhaenge/${a.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="attachment-item"
                    >
                      <Download size={14} />
                      {a.original_name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Nachrichten */}
            <div className="detail-messages">
              <h4><MessageCircle size={16} /> Verlauf</h4>
              <div className="messages-list">
                {selectedTicket.nachrichten?.map(msg => (
                  <div
                    key={msg.id}
                    className={`message-item ${msg.absender_typ} ${msg.ist_intern ? 'intern' : ''}`}
                  >
                    <div className="message-header">
                      <span className="message-author">
                        {msg.absender_typ === 'system' ? 'System' : msg.absender_name}
                      </span>
                      <span className="message-time">{formatDate(msg.created_at)}</span>
                      {msg.ist_intern && <span className="intern-badge">Intern</span>}
                    </div>
                    <div className="message-content">{msg.nachricht}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Neue Nachricht */}
            {selectedTicket.status !== 'geschlossen' && (
              <div className="message-input">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Nachricht schreiben..."
                  rows={3}
                />

                {uploadFiles.length > 0 && (
                  <div className="upload-preview">
                    {uploadFiles.map((file, idx) => (
                      <div key={idx} className="upload-file">
                        <Paperclip size={14} />
                        <span>{file.name}</span>
                        <button onClick={() => removeFile(idx)}><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="message-actions">
                  <div className="left-actions">
                    <button
                      className="btn-attach"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip size={18} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx"
                      style={{ display: 'none' }}
                      onChange={handleFileSelect}
                    />

                    {isAdmin && (
                      <label className="intern-toggle">
                        <input
                          type="checkbox"
                          checked={isIntern}
                          onChange={(e) => setIsIntern(e.target.checked)}
                        />
                        Interne Notiz
                      </label>
                    )}
                  </div>

                  <button
                    className="btn-send"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sending}
                  >
                    {sending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                    Senden
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Neues Ticket Modal */}
      {showNewTicketModal && renderNewTicketModal()}
    </div>
  );

  function renderNewTicketModal() {
    return (
      <div className="modal-overlay" onClick={() => setShowNewTicketModal(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3><Ticket size={20} /> Neues Support-Ticket</h3>
            <button className="btn-close" onClick={() => setShowNewTicketModal(false)}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleCreateTicket}>
            <div className="form-group">
              <label>Kategorie *</label>
              <div className="kategorie-buttons">
                {Object.entries(KATEGORIE_CONFIG).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`kategorie-btn ${newTicket.kategorie === key ? 'selected' : ''}`}
                      onClick={() => setNewTicket({...newTicket, kategorie: key})}
                      style={{ '--kategorie-color': cfg.color }}
                    >
                      <Icon size={20} />
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label>Betreff *</label>
              <input
                type="text"
                value={newTicket.betreff}
                onChange={(e) => setNewTicket({...newTicket, betreff: e.target.value})}
                placeholder="Kurze Beschreibung des Anliegens"
                required
              />
            </div>

            <div className="form-group">
              <label>Nachricht *</label>
              <textarea
                value={newTicket.nachricht}
                onChange={(e) => setNewTicket({...newTicket, nachricht: e.target.value})}
                placeholder="Beschreiben Sie Ihr Anliegen ausführlich..."
                rows={5}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Priorität</label>
                <select
                  value={newTicket.prioritaet}
                  onChange={(e) => setNewTicket({...newTicket, prioritaet: e.target.value})}
                >
                  {Object.entries(PRIORITAET_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>

              {showAllBereiche && (
                <div className="form-group">
                  <label>Bereich</label>
                  <select
                    value={newTicket.bereich}
                    onChange={(e) => setNewTicket({...newTicket, bereich: e.target.value})}
                  >
                    {Object.entries(BEREICH_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowNewTicketModal(false)}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={!newTicket.kategorie || !newTicket.betreff || !newTicket.nachricht || sending}
              >
                {sending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                Ticket erstellen
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
};

export default SupportTickets;
