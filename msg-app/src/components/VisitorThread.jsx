import React, { useState, useEffect, useRef } from 'react'
import api from '../api.js'
import MessageInput from './MessageInput.jsx'

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

export default function VisitorThread({ session, onBack, onSessionUpdated }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [sessionData, setSessionData] = useState(session)
  const bottomRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    api.get(`/visitor-chat/sessions/${session.id}`)
      .then(r => {
        setMessages(r.data.messages || [])
        setSessionData(r.data.session || session)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session.id])

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (text) => {
    try {
      const res = await api.post(`/visitor-chat/sessions/${session.id}/reply`, { message: text })
      setMessages(prev => [...prev, res.data])
      onSessionUpdated?.()
    } catch {}
  }

  const handleStatusChange = async (status) => {
    try {
      await api.put(`/visitor-chat/sessions/${session.id}/status`, { status })
      setSessionData(prev => ({ ...prev, status }))
      onSessionUpdated?.()
    } catch {}
  }

  return (
    <div className="thread">
      {/* Header */}
      <div className="thread-header">
        <button className="thread-back-btn" onClick={onBack}>←</button>
        <div className="thread-header-info">
          <span className="thread-header-name">
            🌐 {sessionData.visitor_name || 'Besucher'}
          </span>
          <span className="thread-header-sub">
            {sessionData.source_site} · {sessionData.visitor_email}
          </span>
        </div>
        <div className="visitor-status-btns">
          {sessionData.status !== 'closed' && (
            <button className="visitor-close-btn" onClick={() => handleStatusChange('closed')}>
              ✓ Schließen
            </button>
          )}
        </div>
      </div>

      {/* Nachrichten */}
      <div className="thread-messages">
        {loading ? (
          <div className="thread-loading">⏳ Laden…</div>
        ) : (
          <>
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`bubble-wrap${msg.sender_type === 'staff' ? ' bubble-wrap--mine' : ''}`}
              >
                {msg.sender_type !== 'staff' && (
                  <span className="bubble-sender">{sessionData.visitor_name}</span>
                )}
                <div className={`bubble${msg.sender_type === 'staff' ? ' bubble--mine' : ' bubble--theirs'}`}>
                  <span className="bubble-text">{msg.message}</span>
                  <span className="bubble-time">{formatTime(msg.sent_at || msg.created_at)}</span>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {sessionData.status === 'closed' ? (
        <div className="thread-readonly">Gespräch wurde geschlossen.</div>
      ) : (
        <MessageInput onSend={handleSend} placeholder={`Antwort an ${sessionData.visitor_name}…`} />
      )}
    </div>
  )
}
