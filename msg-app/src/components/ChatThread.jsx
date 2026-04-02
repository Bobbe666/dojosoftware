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
        setMessages(prev => [...prev, msg])
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
    const socket = getSocket()
    socket.emit('chat:message', { room_id: room.id, content: text }, (ack) => {
      if (ack?.success) {
        // Socket-Event kommt über 'chat:message' zurück → wird oben hinzugefügt
      } else {
        // Fallback: REST
        api.post(`/chat/rooms/${room.id}/messages`, { content: text })
          .then(r => {
            setMessages(prev => [...prev, r.data])
            onMessageSent?.({ room_id: room.id, content: text, sent_at: new Date().toISOString() })
          })
          .catch(() => {})
      }
    })
    onMessageSent?.({ room_id: room.id, content: text, sent_at: new Date().toISOString() })
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
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} isMine={isMine(msg)} />
            ))}
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
