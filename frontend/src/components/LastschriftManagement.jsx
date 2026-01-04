import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, CreditCard } from "lucide-react";
import Lastschriftlauf from "./Lastschriftlauf";
import Zahllaeufe from "./Zahllaeufe";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/LastschriftManagement.css";
import "../styles/MitgliedDetail.css";

const LastschriftManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('lastschriftlauf'); // 'lastschriftlauf' or 'zahllaeufe'

  return (
    <div className="lastschrift-management-container">
      {/* Header mit Tabs */}
      <div className="management-header">
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard/beitraege')}>
          <ArrowLeft size={20} />
          Zurück zu Beiträge
        </button>

        <div className="sub-tabs-sidebar-style">
          <button
            className={`tab-vertical-btn ${activeTab === 'lastschriftlauf' ? 'active' : ''}`}
            onClick={() => setActiveTab('lastschriftlauf')}
          >
            <span className="tab-icon"><CreditCard size={20} /></span>
            <span className="tab-label">Neuer Lastschriftlauf</span>
          </button>
          <button
            className={`tab-vertical-btn ${activeTab === 'zahllaeufe' ? 'active' : ''}`}
            onClick={() => setActiveTab('zahllaeufe')}
          >
            <span className="tab-icon"><FileText size={20} /></span>
            <span className="tab-label">Zahlläufe-Übersicht</span>
          </button>
        </div>
      </div>

      {/* Content basierend auf aktivem Tab */}
      <div className="tab-content">
        {activeTab === 'lastschriftlauf' && (
          <Lastschriftlauf embedded={true} />
        )}
        {activeTab === 'zahllaeufe' && (
          <Zahllaeufe embedded={true} />
        )}
      </div>
    </div>
  );
};

export default LastschriftManagement;
