import React from 'react';
import { AppShell } from '../components/AppShell';
import { FileText, ExternalLink, Download, BookOpen, PlayCircle, Globe } from 'lucide-react';

const RESOURCES = [
  {
    category: 'Event Documents',
    items: [
      { title: 'AAROhan 2026 Rulebook', desc: 'Official rules, scoring rubrics, and eligibility criteria.', icon: FileText, link: null },
      { title: 'Puzzle Format Guide', desc: 'Round-by-round breakdown of puzzle types and mechanics.', icon: BookOpen, link: null },
    ],
  },
  {
    category: 'Useful Links',
    items: [
      { title: 'IEEE NIT Durgapur Website', desc: 'Official IEEE Student Branch portal.', icon: Globe, link: 'https://www.ieee.org' },
      { title: 'YouTube Channel', desc: 'Watch tutorials and past event highlights.', icon: PlayCircle, link: null },
    ],
  },
];

export function ResourcesPage() {
  return (
    <AppShell>
      <div className="page-title-row">
        <div>
          <h1 className="page-title">Resources</h1>
          <p className="page-subtitle">Event documents, guides, and useful links</p>
        </div>
      </div>

      {RESOURCES.map((section) => (
        <section className="ieee-panel" key={section.category} style={{ marginBottom: 20 }}>
          <div className="ieee-panel-heading">
            <h2>{section.category}</h2>
            <span className="ieee-role-tag">{section.items.length} ITEMS</span>
          </div>
          <div className="resources-grid">
            {section.items.map(({ title, desc, icon: Icon, link }) => (
              <div key={title} className="resource-card">
                <div className="resource-icon">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="resource-body">
                  <strong>{title}</strong>
                  <p>{desc}</p>
                </div>
                <div className="resource-actions">
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ieee-outline-btn"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Visit
                    </a>
                  ) : (
                    <button className="ieee-outline-btn" disabled style={{ opacity: 0.4 }}>
                      <Download className="w-3.5 h-3.5" /> Coming Soon
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </AppShell>
  );
}
