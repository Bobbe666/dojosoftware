import React, { useState } from 'react';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/Events.css';

const Events = () => {
  const [events, setEvents] = useState([]);

  return (
    <div className="events-container">
      <div className="page-header">
        <h1 className="page-title">Events verwalten</h1>
        <p className="page-subtitle">Veranstaltungen, Wettkämpfe und besondere Termine</p>
      </div>

      <div className="events-content">
        <div className="glass-card">
          <div className="card-header">
            <h2>Events</h2>
            <button className="btn btn-primary">
              ➕ Neues Event erstellen
            </button>
          </div>

          <div className="card-body">
            <p className="info-text">
              Hier können Sie Events wie Turniere, Lehrgänge, Prüfungen und andere Veranstaltungen verwalten.
            </p>

            {events.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">📅</div>
                <h3>Noch keine Events vorhanden</h3>
                <p>Erstellen Sie Ihr erstes Event, um loszulegen.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Events;
