import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getSocket } from '../socket.js'
import api from '../api.js'
import ConversationList from '../components/ConversationList.jsx'
import ChatThread from '../components/ChatThread.jsx'
import NewRoomModal from '../components/NewRoomModal.jsx'

export default function MainPage() {
  const { isAdmin, dojoId, memberType, memberId, logout, displayName } = useAuth()
  const [rooms, setRooms] = useState([])
  const [visitorSessions, setVisitorSessions] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)   // { type: 'chat'|'visitor', data }
  const [showMobileThread, setShowMobileThread] = useState(false)
  const [showNewRoom, setShowNewRoom] = useState(false)
  const [unreadMap, setUnreadMap] = useState({})  // roomId → unreadCount

  // Räume laden
  const loadRooms = useCallback(async () => {
    try {
      const params = dojoId ? `?dojo_id=${dojoId}` : ''
      const res = await api.get(`/chat/rooms${params}`)
      const data = res.data?.rooms || res.data || []
      setRooms(Array.isArray(data) ? data : [])
      // Unread-Map aufbauen
      const map = {}
      data.forEach(r => { map[r.id] = r.unread_count || 0 })
      setUnreadMap(map)
    } catch {}
  }, [dojoId])

  // Besucher-Sessions laden (nur Admin)
  const loadVisitorSessions = useCallback(async () => {
    if (!isAdmin) return
    try {
      const res = await api.get('/visitor-chat/sessions')
      const sessions = res.data?.sessions || res.data || []
      setVisitorSessions(Array.isArray(sessions) ? sessions : [])
    } catch {}
  }, [isAdmin])

  useEffect(() => {
    loadRooms()
    loadVisitorSessions()
  }, [loadRooms, loadVisitorSessions])

  // Socket: neue Nachrichten → unread hochzählen
  useEffect(() => {
    const socket = getSocket()

    const handleNewMsg = (msg) => {
      // Wenn aktiver Raum = dieser Raum → nicht hochzählen
      setUnreadMap(prev => {
        const currentActive = activeRoom?.type === 'chat' ? activeRoom.data?.id : null
        if (msg.room_id === currentActive) return prev
        return { ...prev, [msg.room_id]: (prev[msg.room_id] || 0) + 1 }
      })
      // Zuletzt gesendete Nachricht in Raumliste aktualisieren
      setRooms(prev => prev.map(r =>
        r.id === msg.room_id
          ? { ...r, last_message: msg.content, last_message_at: msg.sent_at }
          : r
      ))
    }

    const handleVisitorMsg = () => { loadVisitorSessions() }

    socket.on('chat:message', handleNewMsg)
    socket.on('visitor-chat:new-message', handleVisitorMsg)
    socket.on('visitor-chat:new-session', handleVisitorMsg)

    return () => {
      socket.off('chat:message', handleNewMsg)
      socket.off('visitor-chat:new-message', handleVisitorMsg)
      socket.off('visitor-chat:new-session', handleVisitorMsg)
    }
  }, [activeRoom, loadVisitorSessions])

  const selectRoom = (room) => {
    setActiveRoom({ type: 'chat', data: room })
    setShowMobileThread(true)
    // Unread zurücksetzen
    setUnreadMap(prev => ({ ...prev, [room.id]: 0 }))
    // Als gelesen markieren
    api.put(`/chat/rooms/${room.id}/read`).catch(() => {})
    // Socket beitreten
    getSocket().emit('chat:join', room.id)
  }

  const selectVisitor = (session) => {
    setActiveRoom({ type: 'visitor', data: session })
    setShowMobileThread(true)
  }

  const handleBack = () => {
    setShowMobileThread(false)
    setActiveRoom(null)
  }

  const handleRoomCreated = (newRoom) => {
    setShowNewRoom(false)
    setRooms(prev => [newRoom, ...prev])
    selectRoom(newRoom)
  }

  const handleMessageSent = (msg) => {
    setRooms(prev => prev.map(r =>
      r.id === msg.room_id
        ? { ...r, last_message: msg.content, last_message_at: msg.sent_at }
        : r
    ))
  }

  const handlePin = async (room) => {
    try {
      const res = await api.put(`/chat/rooms/${room.id}/pin`)
      setRooms(prev => prev.map(r => r.id === room.id ? { ...r, pinned: res.data.pinned ? 1 : 0 } : r))
    } catch {}
  }

  const handleArchive = async (room) => {
    try {
      const res = await api.put(`/chat/rooms/${room.id}/archive`)
      setRooms(prev => prev.map(r => r.id === room.id ? { ...r, archived: res.data.archived ? 1 : 0 } : r))
      // Aktiven Chat schließen wenn archiviert
      if (res.data.archived && activeRoom?.data?.id === room.id) handleBack()
    } catch {}
  }

  const handleLeave = async (room) => {
    if (!window.confirm(`„${room.name || 'Gespräch'}" wirklich löschen?`)) return
    try {
      await api.delete(`/chat/rooms/${room.id}/leave`)
      setRooms(prev => prev.filter(r => r.id !== room.id))
      if (activeRoom?.data?.id === room.id) handleBack()
    } catch {}
  }

  const handleVisitorPin = async (session) => {
    try {
      const res = await api.put(`/visitor-chat/sessions/${session.id}/pin`)
      setVisitorSessions(prev => prev.map(s => s.id === session.id ? { ...s, pinned: res.data.pinned ? 1 : 0 } : s))
    } catch {}
  }

  const handleVisitorArchive = async (session) => {
    try {
      const newStatus = (session.status === 'archived') ? 'closed' : 'archived'
      await api.put(`/visitor-chat/sessions/${session.id}/status`, { status: newStatus })
      setVisitorSessions(prev => prev.map(s => s.id === session.id ? { ...s, status: newStatus } : s))
      if (newStatus === 'archived' && activeRoom?.data?.id === session.id) handleBack()
    } catch {}
  }

  const handleVisitorDelete = async (session) => {
    if (!window.confirm(`Besucher-Chat mit „${session.visitor_name || 'Besucher'}" wirklich löschen?`)) return
    try {
      await api.delete(`/visitor-chat/sessions/${session.id}`)
      setVisitorSessions(prev => prev.filter(s => s.id !== session.id))
      if (activeRoom?.data?.id === session.id) handleBack()
    } catch {}
  }

  return (
    <div className="main-layout">
      {/* Linke Seite: Konversationsliste */}
      <div className={`panel-list${showMobileThread ? ' panel-list--hidden' : ''}`}>
        <div className="list-header">
          <div className="list-header-left">
            <span className="app-name">💬 Dojo MSG</span>
          </div>
          <div className="header-actions">
            <button className="btn-new-chat" onClick={() => setShowNewRoom(true)} title="Neues Gespräch">✏️</button>
            <button className="btn-logout" onClick={logout} title={`Abmelden (${displayName})`}>⏻</button>
          </div>
        </div>

        <ConversationList
          rooms={rooms}
          visitorSessions={visitorSessions}
          activeRoom={activeRoom}
          unreadMap={unreadMap}
          isAdmin={isAdmin}
          onSelectRoom={selectRoom}
          onSelectVisitor={selectVisitor}
          onPin={handlePin}
          onArchive={handleArchive}
          onLeave={handleLeave}
          onVisitorPin={handleVisitorPin}
          onVisitorArchive={handleVisitorArchive}
          onVisitorDelete={handleVisitorDelete}
        />
      </div>

      {/* Rechte Seite: Chat-Thread */}
      <div className={`panel-thread${showMobileThread ? ' panel-thread--visible' : ''}`}>
        {activeRoom ? (
          activeRoom.type === 'chat' ? (
            <ChatThread
              room={activeRoom.data}
              onBack={handleBack}
              onMessageSent={handleMessageSent}
            />
          ) : (
            // Visitor-Thread — wird über VisitorThread-Komponente gerendert
            <VisitorThreadWrapper
              session={activeRoom.data}
              onBack={handleBack}
              onSessionUpdated={loadVisitorSessions}
            />
          )
        ) : (
          <div className="thread-empty">
            <div className="thread-empty-icon">💬</div>
            <p>Wähle ein Gespräch aus</p>
          </div>
        )}
      </div>

      {showNewRoom && (
        <NewRoomModal
          onClose={() => setShowNewRoom(false)}
          onCreated={handleRoomCreated}
          dojoId={dojoId}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}

// Inline-Wrapper um zirkulären Import zu vermeiden
function VisitorThreadWrapper({ session, onBack, onSessionUpdated }) {
  const [VisitorThread, setVisitorThread] = React.useState(null)
  React.useEffect(() => {
    import('../components/VisitorThread.jsx').then(m => setVisitorThread(() => m.default))
  }, [])
  if (!VisitorThread) return <div className="thread-loading">⏳</div>
  return <VisitorThread session={session} onBack={onBack} onSessionUpdated={onSessionUpdated} />
}
