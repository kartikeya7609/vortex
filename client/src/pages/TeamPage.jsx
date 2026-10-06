import React from 'react';
import { AppShell } from '../components/AppShell';
import { TeamManagement } from '../components/TeamManagement';

export function TeamPage() {
  return (
    <AppShell>
      {/* ── Page Title ── */}
      <div className="page-title-row">
        <div>
          <h1 className="page-title">My Team</h1>
          <p className="page-subtitle">Manage your team membership and view your roster</p>
        </div>
      </div>

      {/* Full-featured team management widget */}
      <TeamManagement />
    </AppShell>
  );
}
