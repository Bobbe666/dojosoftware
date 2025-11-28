import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, CreditCard } from "lucide-react";
import Lastschriftlauf from "./Lastschriftlauf";
import Zahllaeufe from "./Zahllaeufe";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/LastschriftManagement.css";

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

        <div className="tabs-container">
          <button
            className={`tab-button ${activeTab === 'lastschriftlauf' ? 'active' : ''}`}
            onClick={() => setActiveTab('lastschriftlauf')}
          >
            <CreditCard size={20} />
            <span>Neuer Lastschriftlauf</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'zahllaeufe' ? 'active' : ''}`}
            onClick={() => setActiveTab('zahllaeufe')}
          >
            <FileText size={20} />
            <span>Zahlläufe-Übersicht</span>
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
