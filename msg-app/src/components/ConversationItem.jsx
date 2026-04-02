import React, { useState, useRef, useEffect } from 'react'

const TYPE_ICON = { announcement: '📢', group: '🥋', direct: '👤' }

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function ConversationItem({ room, unread, active, timeStr, onClick, onPin, onArchive, onLeave }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const icon = TYPE_ICON[room.type] || '💬'
  const name = room.name || (room.type === 'direct' ? 'Direktnachricht' : 'Gespräch')

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
    fn()
  }

  return (
    <div className={`conv-item${active ? ' conv-item--active' : ''}${unread > 0 ? ' conv-item--unread' : ''}`} onClick={onClick}>
      <div className="conv-item-avatar">
        <span className="conv-item-initials">{getInitials(name)}</span>
        <span className="conv-item-type-icon">{icon}</span>
      </div>
      <div className="conv-item-body">
        <div className="conv-item-row">
          <span className="conv-item-name">
            {room.pinned ? <span className="conv-pin-icon">📌</span> : null}
            {name}
          </span>
          <span className="conv-item-time">{timeStr}</span>
        </div>
        <div className="conv-item-row">
          <span className="conv-item-preview">{room.last_message || 'Noch keine Nachrichten'}</span>
          {unread > 0 && <span className="conv-badge">{unread > 99 ? '99+' : unread}</span>}
        </div>
      </div>

      {/* Aktionsmenü */}
      <div className="conv-item-actions" ref={menuRef}>
        <button
          className="conv-action-btn"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
          title="Optionen"
        >⋯</button>
        {menuOpen && (
          <div className="conv-action-menu">
            <button onClick={(e) => handleAction(e, onPin)}>
              {room.pinned ? '📌 Lösen' : '📌 Anpinnen'}
            </button>
            <button onClick={(e) => handleAction(e, onArchive)}>
              {room.archived ? '📤 Wiederherstellen' : '📦 Archivieren'}
            </button>
            <button className="conv-action-menu--danger" onClick={(e) => handleAction(e, onLeave)}>
              🗑️ Löschen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
