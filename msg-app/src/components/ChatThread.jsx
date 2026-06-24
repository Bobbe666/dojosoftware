import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getSocket } from '../socket.js'
import api from '../api.js'
import ThreadHeader from './ThreadHeader.jsx'
import MessageBubble from './MessageBubble.jsx'
import MessageInput from './MessageInput.jsx'

export default function ChatThread({ room, onBack, onMessageSent }) {
  const { memberType, memberId, isAdmin, isTrainer } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [memberCount, setMemberCount] = useState(0)
  const bottomRef = useRef(null)
  const joinedRef = useRef(false)

  // Nur Admin kann in Ankündigungen schreiben; Trainer + Admin in Gruppen; alle in DMs
  const canWrite =
    room.type === 'direct' ||
    (room.type === 'group' && (isAdmin || isTrainer)) ||
    (room.type === 'announcement' && isAdmin)

  // Nachrichten laden
  const loadMessages = useCallback(async () => {
    try {
      const res = await api.get(`/chat/rooms/${room.id}/messages?limit=50`)
      const msgs = res.data?.messages || res.data || []
      setMessages(Array.isArray(msgs) ? msgs : [])
      setMemberCount(msgs[0]?.member_count || 0)
    } catch {}
    setLoading(false)
  }, [room.id])

  useEffect(() => {
    setLoading(true)
    setMessages([])
    loadMessages()
  }, [room.id, loadMessages])

  // Socket: Raum beitreten + Nachrichten empfangen
  useEffect(() => {
    const socket = getSocket()
    if (!joinedRef.current) {
      socket.emit('chat:join', room.id)
      joinedRef.current = true
    }

    const handleMsg = (msg) => {
      if (msg.room_id === room.id) {
        // Dedupe per id (Nachricht kann via REST-Antwort UND Socket-Broadcast kommen)
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        // Als gelesen markieren
        socket.emit('chat:read', { room_id: room.id })
      }
    }

    socket.on('chat:message', handleMsg)
    return () => {
      socket.off('chat:message', handleMsg)
      socket.emit('chat:leave', room.id)
      joinedRef.current = false
    }
  }, [room.id])

  // Mitgliederanzahl laden
  useEffect(() => {
    api.get(`/chat/rooms/${room.id}/members`).then(r => {
      setMemberCount(r.data?.length || 0)
    }).catch(() => {})
  }, [room.id])

  // Auto-Scroll nach unten
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = (text) => {
    // Zuverlässig per REST senden (persistiert + broadcastet serverseitig).
    // Der Server schickt die Nachricht via Socket an den Raum zurück (inkl. Absender),
    // daher hier nur ergänzen, falls noch nicht vorhanden (Dedupe per id).
    // Kein Socket-Ack-Pfad mehr: bei fehlender Socket-Verbindung ging die Nachricht
    // sonst lautlos verloren, weil der REST-Fallback im nie feuernden Ack-Callback steckte.
    api.post(`/chat/rooms/${room.id}/messages`, { content: text })
      .then(r => {
        const msg = r.data?.message || r.data
        if (msg && msg.id) {
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        }
        onMessageSent?.({ room_id: room.id, content: text, sent_at: new Date().toISOString() })
      })
      .catch(err => {
        const m = err?.response?.data?.message || 'Nachricht konnte nicht gesendet werden. Bitte erneut versuchen.'
        alert('⚠️ ' + m)
      })
  }

  const isMine = (msg) =>
    msg.sender_id === memberId && msg.sender_type === memberType

  return (
    <div className="thread">
      <ThreadHeader room={room} memberCount={memberCount} onBack={onBack} />

      <div className="thread-messages">
        {loading ? (
          <div className="thread-loading">⏳ Laden…</div>
        ) : messages.length === 0 ? (
          <div className="thread-no-messages">Noch keine Nachrichten. Schreibe die erste!</div>
        ) : (
          <>
            {messages.map((msg, index) => {
              const d = new Date(msg.sent_at)
              const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
              const prev = messages[index - 1] ? new Date(messages[index - 1].sent_at) : null
              const prevKey = prev ? `${prev.getFullYear()}-${prev.getMonth()}-${prev.getDate()}` : null
              const showSep = key !== prevKey
              const today = new Date()
              const isToday = d.getFullYear() === today.getFullYear() &&
                d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
              const label = isToday
                ? 'Heute'
                : d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
              return (
                <React.Fragment key={msg.id}>
                  {showSep && (
                    <div className={`thread-date-sep${isToday ? ' thread-date-sep--today' : ''}`}>
                      <span className="thread-date-sep-label">{label}</span>
                    </div>
                  )}
                  <MessageBubble msg={msg} isMine={isMine(msg)} />
                </React.Fragment>
              )
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {canWrite ? (
        <MessageInput onSend={handleSend} />
      ) : (
        <div className="thread-readonly">
          {room.type === 'announcement'
            ? '📢 Nur Admins können in Ankündigungs-Kanälen schreiben.'
            : '🔒 Du kannst hier nicht schreiben.'}
        </div>
      )}
    </div>
  )
}
