// ============================================================================
// FUNKTIONS-ÜBERSICHT — was die Software alles kann, inkl. Plan-Zuordnung
// Plan-Tiers aus plan_feature_mapping abgeleitet (Standard→Professional→Premium→Enterprise)
// ============================================================================
import React from 'react';
import { useSubscription } from '../context/SubscriptionContext';

const RANK = { standard: 1, professional: 2, premium: 3, enterprise: 4 };
const PLAN_META = {
  standard:     { label: 'Standard',     color: '#64748b' },
  professional: { label: 'Professional', color: '#3b82f6' },
  premium:      { label: 'Premium',      color: '#8b5cf6' },
  enterprise:   { label: 'Enterprise',   color: '#DAA520' },
};

const BEREICHE = [
  { titel: 'Mitglieder & Verwaltung', icon: '👥', items: [
    ['Mitgliederverwaltung', 'Stammdaten, Gurte/Grade, Stile, Foto, Notfallkontakt', 'standard'],
    ['Trainerverwaltung', 'Trainer anlegen & Kursen zuordnen', 'standard'],
    ['Digitale Verträge', 'Mitgliedsverträge inkl. PDF & Unterschrift', 'standard'],
    ['Dokumente', 'Dokumente je Mitglied/Dojo verwalten', 'standard'],
    ['Familienverbund', 'Familienmitglieder & Familienrabatte', 'standard'],
    ['Online-Registrierung & Probetraining', 'Selbst-Anmeldung über die Website', 'standard'],
    ['Mitglieder-Portal / App', 'Eigener Bereich für Mitglieder', 'standard'],
    ['Eltern-Portal', 'Zugang für Eltern minderjähriger Mitglieder', 'professional'],
    ['Ruhepause & Kündigung', 'Vertragspausen und Kündigungen verwalten', 'professional'],
  ]},
  { titel: 'Training & Prüfungen', icon: '🥋', items: [
    ['Check-in System', 'Anwesenheit erfassen (App/Terminal)', 'standard'],
    ['Stundenplan', 'Kurse & Trainingszeiten', 'standard'],
    ['Prüfungswesen', 'Gürtelprüfungen planen, durchführen, bewerten, Urkunden', 'standard'],
    ['Entwicklungsziele', 'Ziele & Fortschritt je Mitglied', 'professional'],
    ['Auszeichnungen / Badges', 'Motivation durch Abzeichen', 'professional'],
    ['Ausrüstung', 'Ausrüstungs-/Material-Verwaltung', 'professional'],
    ['Lernplattform', 'Lerninhalte & Videos für Mitglieder', 'premium'],
    ['Wettbewerb / Turniere', 'Wettkampf-Funktionen', 'premium'],
    ['Eigene Urkunden-Vorlagen', 'Urkunden-Designs selbst per Editor hinterlegen', 'enterprise'],
  ]},
  { titel: 'Finanzen', icon: '💰', items: [
    ['Rechnungen', 'Rechnungen erstellen & verwalten', 'professional'],
    ['SEPA-Lastschrift', 'Mandate, Zahlläufe, Einzugsgruppen', 'professional'],
    ['Beitragsabrechnung', 'Wiederkehrende Beiträge abrechnen', 'professional'],
    ['Verkauf / Kasse', 'Direktverkauf & Kassenfunktion', 'professional'],
    ['Finanzcockpit', 'Auswertungen, offene Posten, Prognose', 'premium'],
    ['Shop', 'Online-Shop / Ticketverkauf', 'premium'],
    ['Bank-Import & EÜR', 'Kontoauszug-Import + Einnahmen-Überschuss', 'enterprise'],
    ['Businessplan', 'Finanzplanung & Rentabilität', 'enterprise'],
  ]},
  { titel: 'Kommunikation', icon: '💬', items: [
    ['Benachrichtigungen', 'E-Mail / In-App / Push', 'professional'],
    ['Chat (intern)', 'Nachrichten mit Team & Mitgliedern', 'premium'],
    ['Facebook Messenger', 'Messenger als Chat-Kanal', 'enterprise'],
    ['WhatsApp', 'WhatsApp Business als Chat-Kanal', 'enterprise'],
  ]},
  { titel: 'Marketing & Wachstum', icon: '📣', items: [
    ['Marketing-Zentrale', 'Aktionen, Social Media, Geburtstage', 'professional'],
    ['Interessenten / Akquise', 'Leads erfassen & nachverfolgen', 'professional'],
    ['Freunde werben', 'Empfehlungsprogramm', 'professional'],
    ['Homepage-Builder', 'Eigene Website bauen', 'premium'],
  ]},
  { titel: 'Events & Kalender', icon: '📅', items: [
    ['Events', 'Veranstaltungen & Anmeldungen', 'professional'],
    ['Kalender-Abo', 'Termine ins eigene Kalender-Programm', 'professional'],
    ['Wallet-Pass', 'Mitgliedsausweis in Apple/Google Wallet', 'professional'],
  ]},
  { titel: 'Trainer-Apps', icon: '🧑‍🏫', items: [
    ['Trainer-Stunden', 'Trainer sehen ihre Stunden & Vertretungen', 'professional'],
    ['Coach-App', 'Eigene Trainer-PWA: Schnell-Ansage, Vertretung suchen, Check-in, Chat', 'enterprise'],
  ]},
  { titel: 'System & Auswertung', icon: '⚙️', items: [
    ['Dashboard & Berichte', 'Kennzahlen & Auswertungen', 'standard'],
    ['Mitglieder-Statistiken', 'Wachstum, Bestand, Prognosen', 'professional'],
    ['API-Zugang', 'Schnittstelle für eigene Anbindungen', 'premium'],
    ['Multi-Dojo', 'Mehrere Standorte zentral verwalten', 'enterprise'],
    ['Priority Support', 'Bevorzugter Support', 'enterprise'],
  ]},
];

export default function FunktionsUebersicht() {
  const sub = useSubscription();
  const planTyp = (sub?.subscription?.plan_type || sub?.subscription?.plan_name || sub?.subscription?.plan || '').toString().toLowerCase();
  const effektiv = planTyp === 'trial' ? 'enterprise' : planTyp; // Trial = alles
  const meinRank = RANK[effektiv] || 0;

  return (
    <div style={{ padding: '24px', color: 'var(--ds-text, #e2e8f0)', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 24 }}>🧭 Funktionsübersicht</h1>
      <p style={{ opacity: 0.7, marginTop: 0 }}>Alles, was die Software kann — mit Plan-Zuordnung.</p>

      {/* Plan-Status + Legende */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', margin: '14px 0 22px', padding: '12px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}>
        {meinRank > 0 && <div style={{ fontSize: 14 }}>Dein Plan: <strong style={{ color: PLAN_META[effektiv]?.color }}>{PLAN_META[effektiv]?.label || effektiv}</strong></div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
          {Object.entries(PLAN_META).map(([k, m]) => <span key={k} style={badge(m.color)}>{m.label}</span>)}
        </div>
      </div>

      {BEREICHE.map((b) => (
        <div key={b.titel} style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 17, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}><span>{b.icon}</span>{b.titel}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 10 }}>
            {b.items.map(([name, desc, plan]) => {
              const m = PLAN_META[plan];
              const enthalten = meinRank > 0 ? meinRank >= RANK[plan] : null;
              return (
                <div key={name} style={{ display: 'flex', gap: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, opacity: enthalten === false ? 0.62 : 1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{name}</div>
                    <div style={{ fontSize: 12.5, opacity: 0.7, lineHeight: 1.35 }}>{desc}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flex: '0 0 auto' }}>
                    <span style={badge(m.color)}>{m.label}</span>
                    {enthalten === true && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>✓ enthalten</span>}
                    {enthalten === false && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>🔒 ab {m.label}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p style={{ opacity: 0.5, fontSize: 12, marginTop: 8 }}>
        Hinweis: Plan-Zuordnung kann sich ändern. Für ein Upgrade wende dich an den Support / siehe Einstellungen → Abo.
      </p>
    </div>
  );
}

const badge = (color) => ({ display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, color, background: `${color}22`, border: `1px solid ${color}55`, whiteSpace: 'nowrap' });
