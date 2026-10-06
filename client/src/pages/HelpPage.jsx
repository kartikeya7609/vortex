import React, { useState, useEffect } from 'react';
import { AppShell } from '../components/AppShell';
import { HelpCircle, ChevronDown, ChevronUp, Mail, MessageCircle, RefreshCw } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../services/api';

const FALLBACK_FAQS = [
  {
    id: 'faq-1',
    category: 'Teams',
    question: 'How do I join or create a team?',
    answer: 'Go to "My Team" in the sidebar. You can create a new team and share the team code with your friends, or enter a code to join an existing team.',
  },
  {
    id: 'faq-2',
    category: 'Gameplay',
    question: 'Only the team leader submitted an answer — why?',
    answer: 'By design, only the team leader can start the game session and submit answers. Other members can observe progress in real-time.',
  },
  {
    id: 'faq-3',
    category: 'Rules',
    question: 'What happens if I answer incorrectly?',
    answer: 'An incorrect answer does not unlock the next puzzle. You can retry, but each attempt is recorded and factored into tie-breaking algorithms.',
  },
  {
    id: 'faq-4',
    category: 'Scoring',
    question: 'How is qualification determined for subsequent rounds?',
    answer: 'Qualification ranks teams by number of puzzles completed, total score, completion time, and final completion timestamp based on the round configuration.',
  },
];

function FaqItem({ question, answer, category }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: open ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.6)',
        border: open ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(56, 189, 248, 0.15)',
        borderRadius: 14,
        marginBottom: 12,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none',
          border: 'none',
          color: open ? '#38bdf8' : '#e2e8f0',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: 15,
          fontWeight: 600,
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {category && (
            <span
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                fontWeight: 700,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.12)',
                padding: '2px 8px',
                borderRadius: 999,
                letterSpacing: '0.05em',
              }}
            >
              {category}
            </span>
          )}
          <span>{question}</span>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-sky-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div
          style={{
            padding: '0 20px 18px 20px',
            color: '#94a3b8',
            fontSize: 14,
            lineHeight: 1.6,
            borderTop: '1px solid rgba(56, 189, 248, 0.08)',
            paddingTop: 14,
          }}
        >
          {answer}
        </div>
      )}
    </div>
  );
}

export function HelpPage() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFAQs = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/help`);
      const data = await res.json();
      if (data.status === 'success' && data.data?.faqs?.length) {
        setFaqs(data.data.faqs);
      } else {
        setFaqs(FALLBACK_FAQS);
      }
    } catch {
      setFaqs(FALLBACK_FAQS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFAQs();
  }, []);

  return (
    <AppShell>
      <div className="page-title-row" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 28, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            Help &amp; Support
          </h1>
          <p className="page-subtitle" style={{ color: '#94a3b8', marginTop: 4 }}>
            Explore official rules, FAQs, guidelines, or reach out to IEEE event coordinators
          </p>
        </div>
        <button
          onClick={fetchFAQs}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            color: '#38bdf8',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* FAQ Section */}
      <section
        style={{
          background: '#091322',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: 20,
          padding: 28,
          marginBottom: 24,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Frequently Asked Questions</h2>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.12)',
              padding: '4px 12px',
              borderRadius: 999,
              letterSpacing: '0.05em',
            }}
          >
            {faqs.length} TOPICS
          </span>
        </div>

        <div className="faq-list">
          {faqs.map((item) => (
            <FaqItem
              key={item.id}
              question={item.question || item.q}
              answer={item.answer || item.a}
              category={item.category}
            />
          ))}
        </div>
      </section>

      {/* Contact Section */}
      <section
        style={{
          background: '#091322',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: 20,
          padding: 28,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 20 }}>Contact Support</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(56, 189, 248, 0.15)',
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                shrink: 0,
              }}
            >
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <small style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Email Us
              </small>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginTop: 2 }}>
                ieee@nitdgp.ac.in
              </div>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Official IEEE Student Branch Durgapur desk.</p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(56, 189, 248, 0.15)',
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                shrink: 0,
              }}
            >
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <small style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Community Desk
              </small>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginTop: 2 }}>
                Participants Portal Chat
              </div>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Real-time announcements and discord updates.</p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(56, 189, 248, 0.15)',
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                shrink: 0,
              }}
            >
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <small style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Venue Support
              </small>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginTop: 2 }}>
                IEEE Coordinators
              </div>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>On-site IEEE SB student leaders available at control desk.</p>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
