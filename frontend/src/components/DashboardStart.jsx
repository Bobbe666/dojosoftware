import React from "react";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/DashboardStart.css"; // Relativer Pfad
import dojoLogo from "../assets/dojo-logo.png";
import { Users, CalendarClock, BookOpenCheck, UserCog, Ticket } from "lucide-react";
import MemberDashboard from "./MemberDashboard";
import AgbStatusWidget from "./AgbStatusWidget";
import ZieleEntwicklung from "./ZieleEntwicklung";
import SupportTickets from "./SupportTickets";

const DashboardStart = () => {
  const { user } = useAuth();
  
  // Prüfe die Rolle
  const role = user?.role || 'mitglied';
  
  // Wenn Mitglied, zeige MemberDashboard
  if (role !== 'admin') {
    return <MemberDashboard />;
  }

  // Wenn Admin, zeige das normale Admin-Dashboard
  const vereinName = localStorage.getItem("verein") || "Dein Verein";

  return (
    <div className="dashboard-start">
      <img src={dojoLogo} alt="Dojo Logo" className="dojo-logo" />

      <h1>Willkommen, {vereinName}!</h1>
      <p className="slogan">Effiziente Verwaltung. Klare Übersicht. Voller Fokus aufs Training.</p>

      <div className="cta-grid">
        <a href="/dashboard/mitglieder" className="cta-tile">
          <Users size={32} /> <span>Mitglieder</span>
        </a>
        <a href="/dashboard/uebersicht" className="cta-tile">
          <BookOpenCheck size={32} /> <span>Uebersicht</span>
        </a>
        <a href="/dashboard/kursplan" className="cta-tile">
          <CalendarClock size={32} /> <span>Kursplan</span>
        </a>
        <a href="/dashboard/trainer" className="cta-tile">
          <UserCog size={32} /> <span>Trainer</span>
        </a>
        <a href="/dashboard/support" className="cta-tile support-tile">
          <Ticket size={32} /> <span>Support</span>
        </a>
      </div>

      {/* Support-Tickets Widget */}
      <SupportTickets bereich="dojo" compact={true} />

      {/* Ziele & Entwicklung Widget */}
      <ZieleEntwicklung bereich="dojo" />

      {/* AGB/DSGVO Status Widget */}
      <AgbStatusWidget />
    </div>
  );
};

export default DashboardStart;
