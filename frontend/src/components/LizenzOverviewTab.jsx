import React from "react";
import { Building2, Clock, CheckCircle, XCircle, ChevronRight, Users, CreditCard, TrendingUp, AlertTriangle, Globe, Activity, Target, DollarSign, UserPlus, Info } from "lucide-react";


const LizenzOverviewTab = ({ dojos, handleSelectDojo, stats, getPlanBadge, getStatusBadge }) => {
  return (
          <div className="overview-tab">
            {/* Compact metrics bar */}
            <div className="lm-bar">
              <div className="lm-item">
                <span className="lm-val">{stats.total}</span>
                <span className="lm-lbl"><Building2 size={11} /> Dojos gesamt</span>
              </div>
              <div className="lm-sep" />
              <div className="lm-item lm-item--green">
                <span className="lm-val">{stats.active}</span>
                <span className="lm-lbl"><CheckCircle size={11} /> Aktiv</span>
              </div>
              <div className="lm-sep" />
              <div className="lm-item lm-item--yellow">
                <span className="lm-val">{stats.trials}</span>
                <span className="lm-lbl"><Clock size={11} /> Trial</span>
              </div>
              <div className="lm-sep" />
              <div className="lm-item">
                <span className="lm-val">{stats.free}</span>
                <span className="lm-lbl">Free</span>
              </div>
              <div className="lm-sep" />
              <div className="lm-item lm-item--blue">
                <span className="lm-val">{stats.paid}</span>
                <span className="lm-lbl"><CreditCard size={11} /> Zahlend</span>
              </div>
              <div className="lm-sep" />
              <div className="lm-item">
                <span className="lm-val">{stats.totalMembers.toLocaleString('de-DE')}</span>
                <span className="lm-lbl"><Users size={11} /> Mitglieder</span>
              </div>
              <div className="lm-sep" />
              <div
                className="lm-item lm-item--gold lm-item--tooltip"
                title={`Potenzielle MRR = Ziel bei 100% Konvertierung. Aktuell: €${stats.mrr.toLocaleString('de-DE')}`}
              >
                <span className="lm-val">€{stats.potentialMrr.toLocaleString('de-DE')}</span>
                <span className="lm-lbl"><DollarSign size={11} /> pot. MRR <Info size={10} /></span>
              </div>
              {stats.mrr > 0 && stats.mrr !== stats.potentialMrr && (
                <>
                  <div className="lm-sep" />
                  <div className="lm-item lm-item--gold">
                    <span className="lm-val">€{stats.mrr.toLocaleString('de-DE')}</span>
                    <span className="lm-lbl">Akt. MRR</span>
                  </div>
                </>
              )}
            </div>

            {/* Wachstum & Trends */}
            <div className="overview-row">
              <div className="overview-card growth-card">
                <h3><TrendingUp size={18} /> Wachstum</h3>
                <div className="growth-stats">
                  <div className="growth-item">
                    <div className="growth-value">
                      <UserPlus size={20} />
                      <span>{stats.newThisMonth}</span>
                    </div>
                    <div className="growth-label">Neue Dojos diesen Monat</div>
                  </div>
                  <div className="growth-item">
                    <div className="growth-value">
                      <Activity size={20} />
                      <span className={Number(stats.growthRate) >= 0 ? 'positive' : 'negative'}>
                        {Number(stats.growthRate) >= 0 ? '+' : ''}{stats.growthRate}%
                      </span>
                    </div>
                    <div className="growth-label">vs. Vormonat ({stats.newLastMonth})</div>
                  </div>
                  <div className="growth-item">
                    <div className="growth-value">
                      <Target size={20} />
                      <span>{stats.conversionRate}%</span>
                    </div>
                    <div className="growth-label">Trial → Paid Rate</div>
                  </div>
                </div>
              </div>

              <div className="overview-card alerts-card">
                <h3><AlertTriangle size={18} /> Handlungsbedarf</h3>
                <div className="alerts-list">
                  {stats.expiringTrials > 0 && (
                    <div className="alert-item warning">
                      <Clock size={16} />
                      <span>{stats.expiringTrials} Trial(s) laufen in 7 Tagen ab</span>
                    </div>
                  )}
                  {stats.expiredTrials > 0 && (
                    <div className="alert-item danger">
                      <XCircle size={16} />
                      <span>{stats.expiredTrials} Trial(s) bereits abgelaufen</span>
                    </div>
                  )}
                  {stats.expiringTrials === 0 && stats.expiredTrials === 0 && (
                    <div className="alert-item success">
                      <CheckCircle size={16} />
                      <span>Keine dringenden Aktionen erforderlich</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Neueste Dojos */}
            <div className="recent-section">
              <h3>Neueste Dojos</h3>
              <div className="recent-list">
                {dojos
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .slice(0, 5)
                  .map(dojo => (
                  <div
                    key={dojo.id}
                    className="recent-item"
                    onClick={() => handleSelectDojo(dojo)}
                  >
                    <div className="item-main">
                      <span className="item-name">{dojo.dojoname}</span>
                      <span className="item-info">
                        {dojo.subdomain && <><Globe size={12} /> {dojo.subdomain}.dojo.tda-intl.org • </>}
                        {dojo.mitglieder_count || 0} Mitglieder
                      </span>
                    </div>
                    <div className="item-badges">
                      {getPlanBadge(dojo.subscription_plan || dojo.plan_type)}
                      {getStatusBadge(dojo)}
                    </div>
                    <ChevronRight size={16} className="item-arrow" />
                  </div>
                ))}
              </div>
            </div>
          </div>
  );
};

export default LizenzOverviewTab;
