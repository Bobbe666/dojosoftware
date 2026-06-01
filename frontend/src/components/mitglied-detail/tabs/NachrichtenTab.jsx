import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { createSafeHtml } from '../../../utils/sanitizer';

const NachrichtenTab = ({ mitglied }) => {
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsArticles, setNewsArticles] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [memberNotifications, setMemberNotifications] = useState([]);
  const [expandedNews, setExpandedNews] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadNews = async () => {
      setNewsLoading(true);
      try {
        const res = await axios.get('/news/public', { signal: controller.signal });
        if (res.data.news) setNewsArticles(res.data.news);
      } catch (e) {
        if (e.name !== 'AbortError' && e.code !== 'ERR_CANCELED') {
          console.error('News laden fehlgeschlagen:', e);
        }
      } finally {
        setNewsLoading(false);
      }
    };

    const loadNotifications = async () => {
      if (!mitglied?.email) return;
      setNotificationsLoading(true);
      try {
        const res = await axios.get('/notifications/history', {
          params: { recipient: mitglied.email, limit: 100 },
          signal: controller.signal,
        });
        if (res.data.success) setMemberNotifications(res.data.notifications || []);
      } catch (e) {
        if (e.name !== 'AbortError' && e.code !== 'ERR_CANCELED') {
          console.error('Benachrichtigungen laden fehlgeschlagen:', e);
        }
      } finally {
        setNotificationsLoading(false);
      }
    };

    loadNews();
    loadNotifications();

    return () => controller.abort();
  }, [mitglied?.email]);

  return (
    <div className="nachrichten-content mds-nachrichten-content">

      {/* News-Artikel */}
      <div className="mds-news-section">
        <h3 className="mds-news-title">📰 Aktuelle News</h3>

        {newsLoading ? (
          <div className="mds-news-loading">Lade News...</div>
        ) : newsArticles.length === 0 ? (
          <div className="mds-news-empty">
            <p className="mds-news-empty-text">Keine aktuellen News vorhanden</p>
          </div>
        ) : (
          <div className="mds-news-list">
            {newsArticles.map((news) => (
              <div
                key={news.id}
                className="mds-news-card"
                onClick={() => setExpandedNews(expandedNews === news.id ? null : news.id)}
              >
                <div className="mds-news-card-header">
                  <div className="mds-news-card-body">
                    <h4 className="mds-news-card-title">{news.titel}</h4>
                    {news.kurzbeschreibung && expandedNews !== news.id && (
                      <p className="mds-news-card-preview">{news.kurzbeschreibung}</p>
                    )}
                  </div>
                  <div className="mds-news-card-date">
                    {new Date(news.veroeffentlicht_am || news.created_at).toLocaleDateString('de-DE')}
                  </div>
                </div>

                {expandedNews === news.id && (
                  <div className="mds-news-card-expanded">
                    <div className="mds-news-expanded-content">{news.inhalt}</div>
                  </div>
                )}

                <div className="mds-news-card-toggle-row">
                  <span className="mds-news-toggle-btn-text">
                    {expandedNews === news.id ? '▲ Weniger anzeigen' : '▼ Mehr lesen'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Benachrichtigungsarchiv */}
      <div className="mds-nachrichten-section">
        <h3 className="mds-nachrichten-title">📬 Nachrichtenarchiv</h3>
        <p className="mds-nachrichten-subtitle">
          Alle Benachrichtigungen die an {mitglied?.vorname} {mitglied?.nachname} ({mitglied?.email}) gesendet wurden
        </p>
      </div>

      {notificationsLoading ? (
        <div className="mds-notifications-loading">Lade Benachrichtigungen...</div>
      ) : memberNotifications.length === 0 ? (
        <div className="mds-notifications-empty">
          <div className="mds-notifications-empty-icon">📭</div>
          <p className="mds-notifications-empty-text">Noch keine Benachrichtigungen erhalten</p>
        </div>
      ) : (
        <div className="mds-notifications-list">
          {memberNotifications.map((notification, index) => (
            <div key={index} className="mds-notification-card">
              <div className="mds-notification-header">
                <div className="mds-notification-icon">
                  {notification.type === 'email' ? '📧' : '📱'}
                </div>
                <div className="mds-notification-body">
                  <h4 className="mds-notification-subject">{notification.subject}</h4>
                  <div className="mds-notification-date">
                    {new Date(notification.created_at).toLocaleString('de-DE')}
                  </div>
                </div>
                <div className={`mds-notif-status mds-notif-status--${notification.status}`}>
                  {notification.status === 'sent' ? '✅ Gesendet'
                    : notification.status === 'failed' ? '❌ Fehlgeschlagen'
                    : '⏳ Ausstehend'}
                </div>
              </div>

              {notification.message && (
                <div className="mds-notification-message-box">
                  <div className="mds-notification-message-label">Nachricht</div>
                  <div
                    className="mds-notification-message-content"
                    dangerouslySetInnerHTML={createSafeHtml(notification.message)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NachrichtenTab;
