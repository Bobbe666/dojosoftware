// =====================================================================================
// BESUCHER CHAT – Dashboard-Komponente für Staff
// Zeigt eingehende Besucher-Chat-Sessions und ermöglicht Antworten in Echtzeit
// =====================================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext.jsx';
import { useChatContext } from '../../context/ChatContext.jsx';
import '../../styles/Chat.css';

// Zeitformat
function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
    + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtTimeShort(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function isToday(ts) {
  if (!ts) return false;
  const d = new Date(ts);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function dateSeparatorLabel(ts) {
  const d = new Date(ts);
  if (isToday(ts)) return 'Heute';
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function msgDateKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Status-Badge
function StatusBadge({ status }) {
  const map = {
    open:   { label: 'Offen',   color: '#e53e3e' },
    active: { label: 'Aktiv',   color: '#38a169' },
    closed: { label: 'Geschl.', color: '#718096' }
  };
  const { label, color } = map[status] || { label: status, color: '#718096' };
  return (
    <span style={{
      background: color + '22',
      color,
      border: `1px solid ${color}44`,
      borderRadius: '6px',
      padding: '2px 7px',
      fontSize: '11px',
      fontWeight: 600,
      whiteSpace: 'nowrap'
    }}>
      {label}
    </span>
  );
}

// Site-Icon
function siteIcon(site) {
  if (!site) return '🌐';
  if (site.includes('intl')) return '🌍';
  if (site.includes('hof')) return '🌟';
  if (site.includes('events')) return '🗓️';
  return '🏠';
}

// ─── Haupt-Komponente ──────────────────────────────────────────────────────────

const BesucherChat = () => {
  const { token } = useAuth();
  const { socket } = useChatContext();

  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadSessions, setUnreadSessions] = useState(new Set());
  const [aiMode, setAiMode] = useState(false);
  const [aiModeLoading, setAiModeLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textRef = useRef(null);

  // Sessions laden
  const loadSessions = useCallback(async () => {
    if (!token) return;
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const res = await axios.get('/visitor-chat/sessions', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      if (res.data.success) {
        setSessions(res.data.sessions || []);
      }
    } catch (err) {
      console.error('BesucherChat: Sessions laden fehlgeschlagen', err);
    }
  }, [token, statusFilter]);

  // Session-Details + Nachrichten laden
  const loadSession = useCallback(async (sessionId) => {
    if (!token || !sessionId) return;
    setLoading(true);
    try {
      const res = await axios.get(`/visitor-chat/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setActiveSession(res.data.session);
        setMessages(res.data.messages || []);
        // Unread aus Set entfernen
        setUnreadSessions(prev => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
        // Session-Liste aktualisieren (unread_count reset)
        setSessions(prev =>
          prev.map(s => s.id === sessionId ? { ...s, unread_count: 0 } : s)
        );
      }
    } catch (err) {
      console.error('BesucherChat: Session laden fehlgeschlagen', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial + bei Filter-Änderung laden
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // AI-Modus Status laden
  useEffect(() => {
    if (!token) return;
    axios.get('/visitor-chat/ai-mode', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setAiMode(res.data.enabled === true))
      .catch(() => {});
  }, [token]);

  const toggleAiMode = async () => {
    setAiModeLoading(true);
    try {
      const res = await axios.post('/visitor-chat/ai-mode',
        { enabled: !aiMode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAiMode(res.data.enabled);
    } catch (err) {
      console.error('AI-Modus konnte nicht geändert werden', err);
    } finally {
      setAiModeLoading(false);
    }
  };

  // Auto-scroll zu letzter Nachricht
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket.io: Staff-Room beitreten + Echtzeit-Events
  useEffect(() => {
    if (!socket) return;

    // Dojo-ID aus JWT lesen (null = super-admin)
    let dojoId = null;
    try {
      const stored = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (stored) {
        const payload = JSON.parse(atob(stored.split('.')[1]));
        dojoId = payload.dojo_id || null;
      }
    } catch {}

    socket.emit('visitor-chat:staff-join', { dojoId });

    // Neue Session eingetroffen — direkt in Liste einfügen (Aktiv-Filter zeigt sie nach erster Nachricht)
    const onNewSession = (data) => {
      setSessions(prev => {
        if (prev.find(s => s.id === data.sessionId)) return prev;
        const newSession = {
          id: data.sessionId,
          visitor_name: data.visitor_name,
          source_site: data.source_site,
          dojo_id: data.dojo_id,
          status: 'active',
          unread_count: 1,
          message_count: 0,
          last_message: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        return [newSession, ...prev];
      });
      setUnreadSessions(prev => new Set([...prev, data.sessionId]));
    };

    // Neue Nachricht von Besucher
    const onNewMessage = (data) => {
      const { sessionId, message } = data;
      // Falls aktive Session → direkt anhängen
      if (activeSession && activeSession.id === sessionId) {
        setMessages(prev => [...prev, message]);
      } else {
        // Unread markieren
        setUnreadSessions(prev => new Set([...prev, sessionId]));
        setSessions(prev =>
          prev.map(s => s.id === sessionId
            ? { ...s, unread_count: (s.unread_count || 0) + 1, last_message: message.message, updated_at: new Date().toISOString() }
            : s
          )
        );
      }
    };

    socket.on('visitor-chat:new-session', onNewSession);
    socket.on('visitor-chat:new-message', onNewMessage);

    return () => {
      socket.off('visitor-chat:new-session', onNewSession);
      socket.off('visitor-chat:new-message', onNewMessage);
      socket.emit('visitor-chat:staff-leave', { dojoId });
    };
  }, [socket, activeSession]);

  // Antwort senden
  const sendReply = async () => {
    if (!reply.trim() || !activeSession || sending) return;
    setSending(true);
    const msgText = reply.trim();
    setReply('');
    try {
      const res = await axios.post(
        `/visitor-chat/sessions/${activeSession.id}/reply`,
        { message: msgText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setMessages(prev => [...prev, res.data.message]);
        // Session-Liste aktualisieren
        setSessions(prev =>
          prev.map(s => s.id === activeSession.id
            ? { ...s, last_message: msgText, updated_at: new Date().toISOString() }
            : s
          )
        );
      }
    } catch (err) {
      console.error('BesucherChat: Antwort senden fehlgeschlagen', err);
    } finally {
      setSending(false);
      textRef.current?.focus();
    }
  };

  // Status ändern
  const changeStatus = async (newStatus) => {
    if (!activeSession) return;
    try {
      await axios.put(
        `/visitor-chat/sessions/${activeSession.id}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActiveSession(prev => ({ ...prev, status: newStatus }));
      setSessions(prev =>
        prev.map(s => s.id === activeSession.id ? { ...s, status: newStatus } : s)
      );
      // Wenn auf "closed" und Filter nur offene/aktive → aus Liste entfernen
      if ((statusFilter === 'open' || statusFilter === 'active') && newStatus === 'closed') {
        setSessions(prev => prev.filter(s => s.id !== activeSession.id));
        setActiveSession(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('BesucherChat: Status ändern fehlgeschlagen', err);
    }
  };

  // Session löschen
  const deleteSession = async () => {
    if (!activeSession || !window.confirm('Session wirklich löschen?')) return;
    try {
      await axios.delete(`/visitor-chat/sessions/${activeSession.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessions(prev => prev.filter(s => s.id !== activeSession.id));
      setActiveSession(null);
      setMessages([]);
    } catch (err) {
      console.error('BesucherChat: Löschen fehlgeschlagen', err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="chat-page chat-page--admin" style={{ height: '100%', minHeight: 500 }}>
      <div className="chat-layout" style={{ height: '100%' }}>

        {/* ── Linke Sidebar: Session-Liste ──────────────────────────────────── */}
        <div className="chat-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid var(--chat-separator)',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                💬 Besucher-Chat
                {unreadSessions.size > 0 && (
                  <span style={{
                    background: '#e53e3e', color: '#fff',
                    borderRadius: '50%', width: 20, height: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700
                  }}>{unreadSessions.size}</span>
                )}
              </h3>
              {/* AI-Modus Toggle */}
              <button
                onClick={toggleAiMode}
                disabled={aiModeLoading}
                title={aiMode ? 'KI antwortet automatisch – klicken um zu deaktivieren' : 'Manuell antworten – klicken um KI zu aktivieren'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 20,
                  border: `1.5px solid ${aiMode ? '#d69e2e' : '#4a5568'}`,
                  background: aiMode ? '#744210' : 'transparent',
                  color: aiMode ? '#fefcbf' : '#a0aec0',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.2s', whiteSpace: 'nowrap'
                }}
              >
                <span>{aiMode ? '🤖' : '👤'}</span>
                <span>{aiMode ? 'Abwesend' : 'Verfügbar'}</span>
              </button>
            </div>
            {/* Status-Filter */}
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { key: 'active', label: 'Aktiv' },
                { key: 'open',   label: 'Offen' },
                { key: 'closed', label: 'Geschl.' },
                { key: 'all',    label: 'Alle' }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    fontSize: '11px',
                    fontWeight: statusFilter === f.key ? 700 : 400,
                    border: 'none',
                    borderRadius: 6,
                    background: statusFilter === f.key ? 'var(--chat-accent)' : 'var(--bg-secondary, #f4f6fb)',
                    color: statusFilter === f.key ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              onClick={loadSessions}
              style={{
                marginTop: 8, width: '100%', padding: '6px',
                fontSize: '12px', border: '1px solid var(--border-color)',
                borderRadius: 6, background: 'none', color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              ↻ Aktualisieren
            </button>
          </div>

          {/* Session-Liste */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sessions.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                Keine Sessions gefunden
              </div>
            ) : (
              sessions.map(session => {
                const isActive = activeSession?.id === session.id;
                const hasUnread = unreadSessions.has(session.id) || session.unread_count > 0;
                return (
                  <div
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--chat-separator)',
                      cursor: 'pointer',
                      background: isActive
                        ? 'var(--chat-active-bg)'
                        : hasUnread
                          ? 'rgba(229,62,62,0.06)'
                          : 'transparent',
                      borderLeft: isActive ? '3px solid var(--chat-accent)' : '3px solid transparent',
                      transition: 'background .15s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ fontWeight: hasUnread ? 700 : 600, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {siteIcon(session.source_site)} {session.visitor_name}
                      </span>
                      <StatusBadge status={session.status} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {session.last_message || session.visitor_email}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                      <span>{session.source_site || 'Website'}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {hasUnread && session.unread_count > 0 && (
                          <span style={{ background: '#e53e3e', color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                            {session.unread_count}
                          </span>
                        )}
                        {fmtTime(session.updated_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Rechts: Chat-Fenster ───────────────────────────────────────────── */}
        <div className="chat-main" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {!activeSession ? (
            <div className="chat-placeholder">
              <div className="chat-placeholder-icon">💬</div>
              <div className="chat-placeholder-title">Besucher-Chat</div>
              <div className="chat-placeholder-hint">
                Wähle links eine Session aus, um die Konversation zu sehen und zu antworten.
              </div>
            </div>
          ) : (
            <>
              {/* Chat-Header */}
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--chat-separator)',
                background: 'var(--bg-card)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <div style={{
                  width: 40, height: 40,
                  background: 'var(--chat-avatar-bg)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18
                }}>
                  {siteIcon(activeSession.source_site)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{activeSession.visitor_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeSession.visitor_email} · {activeSession.source_site || 'Website'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <StatusBadge status={activeSession.status} />
                  {/* Status-Aktionen */}
                  {activeSession.status !== 'closed' && (
                    <button
                      onClick={() => changeStatus('closed')}
                      title="Session schließen"
                      style={{
                        background: 'none', border: '1px solid var(--border-color)',
                        borderRadius: 6, padding: '4px 10px',
                        fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)'
                      }}
                    >
                      ✕ Schließen
                    </button>
                  )}
                  {activeSession.status === 'closed' && (
                    <button
                      onClick={() => changeStatus('open')}
                      title="Session wieder öffnen"
                      style={{
                        background: 'none', border: '1px solid var(--border-color)',
                        borderRadius: 6, padding: '4px 10px',
                        fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)'
                      }}
                    >
                      ↩ Wieder öffnen
                    </button>
                  )}
                  <button
                    onClick={deleteSession}
                    title="Session löschen"
                    style={{
                      background: 'none', border: 'none',
                      color: '#e53e3e', cursor: 'pointer', fontSize: 16, padding: '2px 4px'
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>

              {/* Nachrichten */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loading ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>Lade Nachrichten…</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                    Noch keine Nachrichten
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const prevMsg = messages[idx - 1];
                    const showSep = msgDateKey(msg.created_at) !== msgDateKey(prevMsg?.created_at);
                    const today = isToday(msg.created_at);
                    return (
                      <React.Fragment key={msg.id}>
                        {showSep && (
                          <div className={`chat-date-separator${today ? ' chat-date-separator--today' : ''}`}>
                            <span className="chat-date-separator-label">{dateSeparatorLabel(msg.created_at)}</span>
                          </div>
                        )}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: msg.sender_type === 'staff' ? 'flex-end' : 'flex-start'
                          }}
                        >
                          {msg.sender_type === 'staff' && (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2, paddingRight: 4 }}>
                              {msg.sender_name || 'Team'}
                            </div>
                          )}
                          <div style={{
                            maxWidth: '75%',
                            padding: '9px 14px',
                            borderRadius: msg.sender_type === 'staff' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            background: msg.sender_type === 'staff'
                              ? 'var(--chat-bubble-own)'
                              : 'var(--bg-card, #fff)',
                            color: msg.sender_type === 'staff' ? '#fff' : 'var(--text-primary)',
                            border: msg.sender_type === 'visitor' ? '1px solid var(--border-color)' : 'none',
                            fontSize: 14,
                            lineHeight: 1.45,
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap'
                          }}>
                            {msg.message}
                          </div>
                          <div style={{
                            fontSize: 10,
                            color: today ? 'var(--chat-accent)' : 'var(--text-secondary)',
                            fontWeight: today ? 600 : 400,
                            marginTop: 2,
                            paddingLeft: msg.sender_type === 'visitor' ? 4 : 0,
                            paddingRight: msg.sender_type === 'staff' ? 4 : 0
                          }}>
                            {fmtTimeShort(msg.created_at)}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Eingabe-Zeile */}
              {activeSession.status !== 'closed' ? (
                <div style={{
                  padding: '10px 14px',
                  borderTop: '1px solid var(--chat-separator)',
                  background: 'var(--bg-card)',
                  display: 'flex',
                  gap: 10,
                  flexShrink: 0
                }}>
                  <textarea
                    ref={textRef}
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Antwort schreiben… (Enter zum Senden, Shift+Enter für neue Zeile)"
                    rows={2}
                    style={{
                      flex: 1,
                      resize: 'none',
                      border: '1px solid var(--border-color)',
                      borderRadius: 10,
                      padding: '9px 12px',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      background: 'var(--bg-secondary, #f4f6fb)',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={sendReply}
                    disabled={!reply.trim() || sending}
                    style={{
                      background: 'var(--chat-accent)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '0 20px',
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: 'pointer',
                      opacity: (!reply.trim() || sending) ? 0.5 : 1,
                      flexShrink: 0,
                      transition: 'opacity .2s'
                    }}
                  >
                    {sending ? '…' : '➤'}
                  </button>
                </div>
              ) : (
                <div style={{
                  padding: '12px 16px',
                  borderTop: '1px solid var(--chat-separator)',
                  background: 'var(--bg-card)',
                  textAlign: 'center',
                  fontSize: 13,
                  color: 'var(--text-secondary)'
                }}>
                  Diese Session ist geschlossen.{' '}
                  <button
                    onClick={() => changeStatus('open')}
                    style={{ background: 'none', border: 'none', color: 'var(--chat-accent)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Wieder öffnen
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BesucherChat;
