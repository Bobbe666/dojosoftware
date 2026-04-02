import React from 'react'

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export default function MessageBubble({ msg, isMine }) {
  return (
    <div className={`bubble-wrap${isMine ? ' bubble-wrap--mine' : ''}`}>
      {!isMine && (
        <span className="bubble-sender">{msg.sender_name || 'Unbekannt'}</span>
      )}
      <div className={`bubble${isMine ? ' bubble--mine' : ' bubble--theirs'}`}>
        <span className="bubble-text">{msg.content}</span>
        <span className="bubble-time">{formatTime(msg.sent_at)}</span>
      </div>
    </div>
  )
}
