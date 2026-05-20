import React, { useState, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarDays, Zap, Loader2, Users, Gift,
  Megaphone, Sparkles, Mail, Share2, Tag, ShoppingBag
} from 'lucide-react';
import '../styles/MarketingZentrale.css';

const MarketingJahresplan  = lazy(() => import('./MarketingJahresplan'));
const FreundeWerbenFreunde = lazy(() => import('./FreundeWerbenFreunde'));
const FreieAktionen        = lazy(() => import('./FreieAktionen'));
const MarketingKiContent   = lazy(() => import('./MarketingKiContent'));
const MarketingGeburtstage = lazy(() => import('./MarketingGeburtstage'));
const MarketingNewsletter  = lazy(() => import('./MarketingNewsletter'));
const MarketingAktionen    = lazy(() => import('./MarketingAktionen'));
const SonderaktionenTab    = lazy(() => import('./SonderaktionenTab'));
const MarketingArtikelTab  = lazy(() => import('./MarketingArtikelTab'));

const NAV = [
  {
    group: 'Inhalte & Kampagnen',
    items: [
      { id: 'jahresplan',    label: 'Jahresplan',     icon: CalendarDays, desc: 'Geplante Aktionen & Kampagnen' },
      { id: 'ki-content',    label: 'KI-Content',     icon: Sparkles,     desc: 'Posts mit KI erstellen',       badge: 'KI', badgeClass: 'ki' },
      { id: 'social-media',  label: 'Social Media',   icon: Share2,       desc: 'Facebook & Instagram Posts' },
      { id: 'newsletter',    label: 'Newsletter',     icon: Mail,         desc: 'E-Mails an Mitglieder' },
      { id: 'geburtstage',   label: 'Geburtstage',    icon: Gift,         desc: 'Geburtstags-Kampagnen' },
      { id: 'freunde-werben',label: 'Freunde werben', icon: Users,        desc: 'Empfehlungs-Programm' },
      { id: 'freie-aktionen',label: 'Freie Aktionen', icon: Zap,          desc: 'Spontane Kampagnen' },
    ],
  },
  {
    group: 'Angebote & Shop',
    items: [
      { id: 'sonderaktionen',label: 'Aktionen',       icon: Tag,          desc: 'Rabatte & Sonderaktionen' },
      { id: 'artikel',       label: 'Artikel & Shop', icon: ShoppingBag,  desc: 'Vorverkauf & Bestellungen',    badge: 'NEU', badgeClass: 'neu' },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap(g => g.items);

const LazyFallback = () => (
  <div className="mz-lazy-fallback">
    <Loader2 className="mz-spinner" size={28} />
    <span>Wird geladen…</span>
  </div>
);

export default function MarketingZentrale({ embedded = false }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'jahresplan';
  const [activeTab, setActiveTab] = useState(initialTab);

  const active = ALL_ITEMS.find(t => t.id === activeTab);
  const ActiveIcon = active?.icon;

  return (
    <div className="mz-root">

      {/* Topbar */}
      {!embedded && (
        <div className="mz-topbar">
          <button className="mz-topbar-back" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={14} /> Zurück
          </button>
          <div className="mz-topbar-logo">
            <div className="mz-topbar-icon"><Megaphone size={17} /></div>
            <span className="mz-topbar-title">Marketing-Zentrale</span>
          </div>
          <span className="mz-topbar-sub">KI-Content · Social Media · Newsletter · Aktionen · Shop</span>
        </div>
      )}

      {/* Sidebar + Content */}
      <div className="mz-body">

        {/* Sidebar Navigation */}
        <nav className="mz-sidebar">
          {NAV.map(group => (
            <React.Fragment key={group.group}>
              <div className="mz-sidebar-group">{group.group}</div>
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    className={`mz-nav-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveTab(item.id)}
                    title={item.desc}
                  >
                    <span className="mz-nav-icon"><Icon size={15} /></span>
                    <span className="mz-nav-label">{item.label}</span>
                    {item.badge && (
                      <span className={`mz-nav-badge ${item.badgeClass || ''}`}>{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </nav>

        {/* Content-Bereich */}
        <div className="mz-content-wrap">
          {active && (
            <div className="mz-content-header">
              <div className="mz-content-header-icon">
                {ActiveIcon && <ActiveIcon size={18} />}
              </div>
              <span className="mz-content-header-title">{active.label}</span>
              {active.desc && (
                <span className="mz-content-header-desc">— {active.desc}</span>
              )}
            </div>
          )}

          <div className="mz-content">
            <Suspense fallback={<LazyFallback />}>
              {activeTab === 'jahresplan'    && <MarketingJahresplan />}
              {activeTab === 'ki-content'    && <MarketingKiContent />}
              {activeTab === 'social-media'  && <MarketingAktionen />}
              {activeTab === 'newsletter'    && <MarketingNewsletter />}
              {activeTab === 'geburtstage'   && <MarketingGeburtstage />}
              {activeTab === 'freunde-werben'&& <FreundeWerbenFreunde />}
              {activeTab === 'freie-aktionen'&& <FreieAktionen onSwitchToJahresplan={() => setActiveTab('jahresplan')} />}
              {activeTab === 'sonderaktionen'&& <SonderaktionenTab nurMarketing={true} />}
              {activeTab === 'artikel'       && <MarketingArtikelTab />}
            </Suspense>
          </div>
        </div>

      </div>
    </div>
  );
}
