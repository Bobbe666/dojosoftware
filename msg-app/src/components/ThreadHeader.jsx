import React from 'react'

const TYPE_LABEL = { announcement: '📢 Ankündigung', group: '🥋 Kurs-Chat', direct: '💬 Direktnachricht' }

export default function ThreadHeader({ room, memberCount, onBack }) {
  return (
    <div className="thread-header">
      <button className="thread-back-btn" onClick={onBack} aria-label="Zurück">
        ←
      </button>
      <div className="thread-header-info">
        <span className="thread-header-name">{room.name || 'Gespräch'}</span>
        <span className="thread-header-sub">
          {TYPE_LABEL[room.type] || ''}
          {memberCount > 0 && ` · ${memberCount} Teilnehmer`}
        </span>
      </div>
    </div>
  )
}
