import React, { useState, useRef, useEffect } from 'react'
import ConversationItem from './ConversationItem.jsx'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = (now - d) / 1000
  if (diff < 60) return 'Jetzt'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  if (diff < 604800) return d.toLocaleDateString('de-DE', { weekday: 'short' })
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

export default function ConversationList({ rooms, visitorSessions, activeRoom, unreadMap, isAdmin, onSelectRoom, onSelectVisitor, onPin, onArchive, onLeave, onVisitorPin, onVisitorArchive, onVisitorDelete }) {
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [showArchivedVisitors, setShowArchivedVisitors] = useState(false)

  const safeRooms = Array.isArray(rooms) ? rooms : []
  const safeVisitorSessions = Array.isArray(visitorSessions) ? visitorSessions : []

  const filtered = search.trim()
    ? safeRooms.filter(r => (r.name || '').toLowerCase().includes(search.toLowerCase()))
    : safeRooms

  // Gepinnte Chats (nicht archiviert)
  const pinned = filtered.filter(r => r.pinned && !r.archived)

  // Normale Chats nach Typ (nicht gepinnt, nicht archiviert)
  const active_ = filtered.filter(r => !r.pinned && !r.archived)
  const announcements = active_.filter(r => r.type === 'announcement')
  const groups = active_.filter(r => r.type === 'group')
  const directs = active_.filter(r => r.type === 'direct')

  // Archivierte Chats
  const archived = filtered.filter(r => r.archived)

  const activeVisitors = safeVisitorSessions.filter(s => !s.archived && s.status !== 'archived')
  const archivedVisitors = safeVisitorSessions.filter(s => s.archived || s.status === 'archived')
  const pinnedVisitors = activeVisitors.filter(s => s.pinned)
  const unpinnedVisitors = activeVisitors.filter(s => !s.pinned)
  const totalVisitorUnread = activeVisitors.reduce((acc, s) => acc + (s.unread_count || 0), 0)
  const isRoomActive = (r) => activeRoom?.type === 'chat' && activeRoom.data?.id === r.id

  const renderVisitorItem = (s) => (
    <VisitorItem
      key={s.id}
      session={s}
      active={activeRoom?.type === 'visitor' && activeRoom.data?.id === s.id}
      onClick={() => onSelectVisitor(s)}
      onPin={() => onVisitorPin?.(s)}
      onArchive={() => onVisitorArchive?.(s)}
      onDelete={() => onVisitorDelete?.(s)}
    />
  )

  const renderItem = (r) => (
    <ConversationItem
      key={r.id}
      room={r}
      unread={unreadMap[r.id] || 0}
      active={isRoomActive(r)}
      timeStr={timeAgo(r.last_message_at)}
      onClick={() => onSelectRoom(r)}
      onPin={() => onPin(r)}
      onArchive={() => onArchive(r)}
      onLeave={() => onLeave(r)}
    />
  )

  return (
    <div className="conv-list">
      {/* Suche */}
      <div className="conv-search">
        <span className="conv-search-icon">🔍</span>
        <input
          type="text"
          placeholder="Suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="conv-search-input"
        />
        {search && (
          <button className="conv-search-clear" onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      <div className="conv-sections">
        {/* Gepinnte Chats */}
        {pinned.length > 0 && (
          <section>
            <div className="conv-section-header">📌 GEPINNT</div>
            {pinned.map(renderItem)}
          </section>
        )}

        {/* Ankündigungen */}
        {announcements.length > 0 && (
          <section>
            <div className="conv-section-header">📢 ANKÜNDIGUNGEN</div>
            {announcements.map(renderItem)}
          </section>
        )}

        {/* Kurs-Chats / Gruppen */}
        {groups.length > 0 && (
          <section>
            <div className="conv-section-header">🥋 KURS-CHATS</div>
            {groups.map(renderItem)}
          </section>
        )}

        {/* Direktnachrichten */}
        {directs.length > 0 && (
          <section>
            <div className="conv-section-header">💬 DIREKTNACHRICHTEN</div>
            {directs.map(renderItem)}
          </section>
        )}

        {/* Besucher-Chat (nur Admin) */}
        {isAdmin && activeVisitors.length > 0 && (
          <section>
            <div className="conv-section-header">
              🌐 BESUCHER
              {totalVisitorUnread > 0 && <span className="section-badge">{totalVisitorUnread}</span>}
            </div>
            {[...pinnedVisitors, ...unpinnedVisitors].map(s => renderVisitorItem(s))}
          </section>
        )}

        {/* Archivierte Besucher (nur Admin) */}
        {isAdmin && archivedVisitors.length > 0 && (
          <section>
            <div
              className="conv-section-header conv-section-header--clickable"
              onClick={() => setShowArchivedVisitors(v => !v)}
            >
              📦 BESUCHER ARCHIVIERT ({archivedVisitors.length}) {showArchivedVisitors ? '▲' : '▼'}
            </div>
            {showArchivedVisitors && archivedVisitors.map(s => renderVisitorItem(s))}
          </section>
        )}

        {/* Archiviert (einklappbar) */}
        {archived.length > 0 && (
          <section>
            <div
              className="conv-section-header conv-section-header--clickable"
              onClick={() => setShowArchived(v => !v)}
            >
              📦 ARCHIVIERT ({archived.length}) {showArchived ? '▲' : '▼'}
            </div>
            {showArchived && archived.map(renderItem)}
          </section>
        )}

        {/* Leer-Zustand */}
        {pinned.length === 0 && announcements.length === 0 && groups.length === 0 && directs.length === 0 && !search && (
          <div className="conv-empty">
            <p>Noch keine Gespräche.</p>
            <p>Tippe auf ✏️ um ein neues Gespräch zu starten.</p>
          </div>
        )}
        {search && filtered.filter(r => !r.archived).length === 0 && archived.length === 0 && (
          <div className="conv-empty">Keine Ergebnisse für „{search}"</div>
        )}
      </div>
    </div>
  )
}

function VisitorItem({ session: s, active, onClick, onPin, onArchive, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const handle = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [menuOpen])

  const handleAction = (e, fn) => {
    e.stopPropagation()
    setMenuOpen(false)
    fn?.()
  }

  return (
    <div
      className={`conv-item${active ? ' conv-item--active' : ''}`}
      onClick={onClick}
    >
      <div className="conv-item-avatar conv-item-avatar--visitor">🌐</div>
      <div className="conv-item-body">
        <div className="conv-item-row">
          <span className="conv-item-name">
            {s.pinned ? <span className="conv-pin-icon">📌</span> : null}
            {s.visitor_name || 'Besucher'}
          </span>
          <span className="conv-item-time">{timeAgo(s.updated_at)}</span>
        </div>
        <div className="conv-item-row">
          <span className="conv-item-preview">{s.source_site || 'Website'} · {s.status}</span>
          {s.unread_count > 0 && <span className="conv-badge">{s.unread_count}</span>}
        </div>
      </div>
      <div className="conv-item-actions" ref={menuRef}>
        <button
          className="conv-action-btn"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
          title="Optionen"
        >⋯</button>
        {menuOpen && (
          <div className="conv-action-menu">
            <button onClick={(e) => handleAction(e, onPin)}>
              {s.pinned ? '📌 Lösen' : '📌 Anpinnen'}
            </button>
            <button onClick={(e) => handleAction(e, onArchive)}>
              {s.status === 'archived' ? '📤 Wiederherstellen' : '📦 Archivieren'}
            </button>
            <button className="conv-action-menu--danger" onClick={(e) => handleAction(e, onDelete)}>
              🗑️ Löschen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
