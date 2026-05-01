import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx';
import CommunityBoard from './CommunityBoard.jsx';
import MemberHeader from './MemberHeader.jsx';

export default function MemberCommunityPage() {
  const { user } = useAuth();
  const { activeDojo } = useDojoContext();

  const dojoId = user?.dojo_id || activeDojo?.id;
  const mitgliedId = user?.mitglied_id;
  const isAdmin = user?.rolle === 'admin' || user?.role === 'admin';

  return (
    <div className="dashboard-container">
      <MemberHeader />
      <div className="dashboard-content" style={{ padding: '0' }}>
        <main className="dashboard-main" style={{ padding: '0' }}>
          {dojoId ? (
            <CommunityBoard
              dojoId={dojoId}
              currentMitgliedId={mitgliedId}
              isAdmin={isAdmin}
              onOpenChat={(userId, mitgliedId, name) => {
                window.dispatchEvent(new CustomEvent('open-chat-with', {
                  detail: { userId, mitgliedId, name },
                }));
              }}
            />
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              Kein Dojo zugewiesen.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
