import React from 'react';
import { AppShell } from '../components/AppShell';
import { Bell, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

const ANNOUNCEMENTS = [
  {
    id: 1,
    type: 'info',
    title: 'Welcome to AAROhan 2026!',
    body: 'Registrations are now open. Complete your profile and form a team to compete. Good luck to all participants!',
    date: 'October 5, 2026',
  },
  {
    id: 2,
    type: 'warning',
    title: 'Team Formation Deadline',
    body: 'All teams must be formed before Round 1 begins. Make sure your team has at least 2 members to be eligible.',
    date: 'October 6, 2026',
  },
  {
    id: 3,
    type: 'success',
    title: 'Round 1 Puzzles are Live',
    body: 'The image puzzles for Round 1 have been uploaded and verified. Complete your team setup to access them.',
    date: 'October 7, 2026',
  },
];

const TYPE_CONFIG = {
  info:    { icon: Info,          cls: 'ann-info',    label: 'INFO' },
  warning: { icon: AlertTriangle, cls: 'ann-warning', label: 'IMPORTANT' },
  success: { icon: CheckCircle2,  cls: 'ann-success', label: 'UPDATE' },
};

export function AnnouncementsPage() {
  return (
    <AppShell>
      <div className="page-title-row">
        <div>
          <h1 className="page-title">Announcements</h1>
          <p className="page-subtitle">Official updates from the IEEE NIT Durgapur team</p>
        </div>
        <span className="ieee-role-tag">{ANNOUNCEMENTS.length} POSTS</span>
      </div>

      <div className="ann-list">
        {ANNOUNCEMENTS.map(({ id, type, title, body, date }) => {
          const { icon: Icon, cls, label } = TYPE_CONFIG[type] || TYPE_CONFIG.info;
          return (
            <article key={id} className={`ann-card ${cls}`}>
              <div className="ann-card-icon">
                <Icon className="w-5 h-5" />
              </div>
              <div className="ann-card-body">
                <div className="ann-card-top">
                  <span className={`ann-badge ${cls}`}>{label}</span>
                  <span className="ann-date">{date}</span>
                </div>
                <h3 className="ann-title">{title}</h3>
                <p className="ann-body">{body}</p>
              </div>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
