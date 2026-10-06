import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { API_BASE_URL, apiFetch } from '../services/api';
import {
  ShieldAlert, Lock, Search, Clock, Award, CheckCircle2, AlertCircle,
  HelpCircle, ChevronRight, FileText, Image as ImageIcon, Send, Loader2,
  Trophy, RotateCcw, ArrowLeft, Lightbulb, ExternalLink
} from 'lucide-react';

const formatClock = (secs) => {
  const n = Number(secs);
  if (!Number.isFinite(n)) return '00:00';
  const t = Math.max(0, Math.floor(n));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export function DetectiveGamePage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [errorData, setErrorData] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [clues, setClues] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [hints, setHints] = useState([]);
  const [attempt, setAttempt] = useState(null);

  const [selectedOption, setSelectedOption] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [unlockingHint, setUnlockingHint] = useState(false);
  const [hintModal, setHintModal] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const timerRef = useRef(null);

  // Fetch Detective Case & Attempt State from Backend
  const fetchCaseData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorData(null);
      const res = await apiFetch(`${API_BASE_URL}/detective/case`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorData({
          title: 'Round 2 Access Restricted',
          message: data.message || 'You do not have access to Round 2: Detective Case.',
          code: data.code || 'LOCKED',
        });
        return;
      }

      setCaseData(data.case);
      setClues(data.clues || []);
      setQuestions(data.questions || []);
      setHints(data.hints || []);
      setAttempt(data.attempt || null);

      if (data.attempt?.expiresAt) {
        const expires = new Date(data.attempt.expiresAt).getTime();
        const diff = Math.max(0, Math.floor((expires - Date.now()) / 1000));
        setRemainingSeconds(diff);
      }
    } catch (err) {
      setErrorData({
        title: 'Connection Error',
        message: err.message || 'Could not connect to the server.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCaseData();
  }, [fetchCaseData]);

  // Live Authoritative Countdown Timer
  useEffect(() => {
    if (!attempt || ['COMPLETED', 'TIME_EXPIRED'].includes(attempt.status)) {
      clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      if (attempt?.expiresAt) {
        const expires = new Date(attempt.expiresAt).getTime();
        const diff = Math.max(0, Math.floor((expires - Date.now()) / 1000));
        setRemainingSeconds(diff);

        if (diff <= 0) {
          clearInterval(timerRef.current);
          setAttempt((prev) => prev ? { ...prev, status: 'TIME_EXPIRED' } : prev);
        }
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [attempt]);

  // Submit MCQ Answer
  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    if (selectedOption === null || submitting) return;

    const currentQ = questions[attempt?.currentQuestionIndex || 0];
    if (!currentQ) return;

    try {
      setSubmitting(true);
      setFeedback(null);

      const res = await apiFetch(`${API_BASE_URL}/detective/submit-answer`, {
        method: 'POST',
        body: JSON.stringify({
          questionId: currentQ.id || currentQ._id,
          selectedOptionIndex: selectedOption,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit answer.');
      }

      if (data.isCorrect) {
        setFeedback({ type: 'success', message: `Correct! +${data.pointsAwarded} Points Awarded.` });
      } else {
        setFeedback({ type: 'error', message: 'Incorrect answer. Points not awarded.' });
      }

      setAttempt((prev) => ({
        ...prev,
        score: data.newScore,
        currentQuestionIndex: data.currentQuestionIndex,
        status: data.status,
      }));

      setSelectedOption(null);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Unlock Hint
  const handleConfirmUnlockHint = async (hint) => {
    try {
      setUnlockingHint(true);
      const res = await apiFetch(`${API_BASE_URL}/detective/use-hint`, {
        method: 'POST',
        body: JSON.stringify({ hintId: hint.id || hint._id }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to unlock hint.');
      }

      // Update local hints list to show hintText
      setHints((prev) =>
        prev.map((h) =>
          (h.id || h._id) === (hint.id || hint._id)
            ? { ...h, isUsed: true, hintText: data.hintText }
            : h
        )
      );

      setAttempt((prev) => ({
        ...prev,
        score: data.currentScore,
        hintsUsed: data.hintsUsed || [...(prev?.hintsUsed || []), hint.id || hint._id],
      }));

      setHintModal(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setUnlockingHint(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
          <span style={{ color: '#94a3b8', fontSize: 14, fontWeight: 600 }}>Loading Detective Case & Investigation Files…</span>
        </div>
      </AppShell>
    );
  }

  // Access Denied / Unqualified / Locked View
  if (errorData) {
    return (
      <AppShell>
        <div style={{ maxWidth: 540, margin: '60px auto', textAlign: 'center', padding: 32, background: '#0d1627', border: '1px solid #1d2a44', borderRadius: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(248, 113, 113, 0.12)', border: '1px solid rgba(248, 113, 113, 0.3)', display: 'grid', placeItems: 'center', margin: '0 auto 20px', color: '#f87171' }}>
            <Lock size={28} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', margin: '0 0 10px' }}>{errorData.title}</h2>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>{errorData.message}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="ieee-portal-btn"
            style={{ margin: '0 auto', display: 'inline-flex', padding: '12px 24px', fontSize: 13 }}
          >
            <ArrowLeft className="w-4 h-4" /> Return to Participant Dashboard
          </button>
        </div>
      </AppShell>
    );
  }

  const currentQIndex = attempt?.currentQuestionIndex || 0;
  const currentQ = questions[currentQIndex];
  const currentClue = clues.find((c) => (c.id || c._id) === currentQ?.clueId) || clues[currentQIndex] || clues[0];
  const isCompleted = attempt?.status === 'COMPLETED';
  const isTimeExpired = attempt?.status === 'TIME_EXPIRED';
  const isFinished = isCompleted || isTimeExpired;

  // Active question hints
  const currentQHints = hints.filter((h) => !h.questionId || (h.questionId || h._id) === (currentQ?.id || currentQ?._id));

  return (
    <AppShell>
      <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>
        {/* Header HUD Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20, padding: '16px 22px', background: '#0d1627', border: '1px solid #1d2a44', borderRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'grid', placeItems: 'center', color: '#38bdf8' }}>
              <Search size={22} />
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>ROUND 2: DETECTIVE CASE</span>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', margin: 0 }}>{caseData?.title}</h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)', color: '#fbbf24', fontSize: 13, fontWeight: 700 }}>
              <Award size={15} />
              <span>Score: {attempt?.score || 0} pts</span>
            </div>

            {!isFinished && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: remainingSeconds <= 180 ? 'rgba(248, 113, 113, 0.12)' : 'rgba(56, 189, 248, 0.1)', border: `1px solid ${remainingSeconds <= 180 ? 'rgba(248, 113, 113, 0.35)' : 'rgba(56, 189, 248, 0.3)'}`, color: remainingSeconds <= 180 ? '#f87171' : '#38bdf8', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
                <Clock size={15} />
                <span>{formatClock(remainingSeconds)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Finished / Completed Screen */}
        {isFinished ? (
          <div style={{ textAlign: 'center', padding: '40px 24px', background: '#0d1627', border: '1px solid #1d2a44', borderRadius: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: isCompleted ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)', border: `1px solid ${isCompleted ? 'rgba(52, 211, 153, 0.4)' : 'rgba(248, 113, 113, 0.4)'}`, display: 'grid', placeItems: 'center', margin: '0 auto 20px', color: isCompleted ? '#34d399' : '#f87171' }}>
              {isCompleted ? <Trophy size={32} /> : <Clock size={32} />}
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', margin: '0 0 8px' }}>
              {isCompleted ? 'Detective Case Solved!' : 'Investigation Time Expired'}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 500, margin: '0 auto 24px', lineHeight: 1.6 }}>
              {isCompleted
                ? 'Congratulations! Your team successfully analyzed the evidence and completed the detective investigation.'
                : 'The time limit for this investigation expired. Your progress and final score have been recorded.'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 30 }}>
              <div style={{ padding: '16px 24px', background: '#070d1a', border: '1px solid #1d2a44', borderRadius: 12, minWidth: 140 }}>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>FINAL SCORE</span>
                <strong style={{ fontSize: 26, color: '#38bdf8', fontWeight: 800 }}>{attempt?.score || 0}</strong>
              </div>
              <div style={{ padding: '16px 24px', background: '#070d1a', border: '1px solid #1d2a44', borderRadius: 12, minWidth: 140 }}>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>QUESTIONS SOLVED</span>
                <strong style={{ fontSize: 26, color: '#34d399', fontWeight: 800 }}>{currentQIndex} / {questions.length}</strong>
              </div>
              <div style={{ padding: '16px 24px', background: '#070d1a', border: '1px solid #1d2a44', borderRadius: 12, minWidth: 140 }}>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block' }}>HINTS UNLOCKED</span>
                <strong style={{ fontSize: 26, color: '#fbbf24', fontWeight: 800 }}>{(attempt?.hintsUsed || []).length}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/dashboard')} className="ieee-portal-btn" style={{ padding: '12px 24px' }}>
                Return to Dashboard
              </button>
              <button onClick={() => navigate('/leaderboard')} className="ieee-outline-btn" style={{ padding: '12px 24px' }}>
                View Leaderboard
              </button>
            </div>
          </div>
        ) : (
          /* Active Investigation View */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Left Column: Clue & Evidence */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 20, background: '#0d1627', border: '1px solid #1d2a44', borderRadius: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', padding: '3px 10px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 999 }}>
                    EVIDENCE FILE #{currentClue?.order || (currentQIndex + 1)}
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                    TYPE: {currentClue?.evidenceType || 'TEXT'}
                  </span>
                </div>

                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f8fafc', margin: '0 0 8px' }}>{currentClue?.title || 'Case Evidence'}</h2>
                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.55, margin: '0 0 16px' }}>{currentClue?.description}</p>

                {/* Evidence Render */}
                <div style={{ padding: 14, background: '#070d1a', border: '1px solid #1d2a44', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={13} /> INVESTIGATION EXHIBIT
                  </div>

                  {currentClue?.evidenceType === 'image' ? (
                    <div>
                      <img
                        src={currentClue.evidence}
                        alt={currentClue.title}
                        style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 8, border: '1px solid #1d2a44' }}
                      />
                    </div>
                  ) : currentClue?.evidenceType === 'document' ? (
                    <pre style={{ margin: 0, fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                      {currentClue.evidence}
                    </pre>
                  ) : (
                    <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {currentClue?.evidence}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Investigation Question & Hints */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 20, background: '#0d1627', border: '1px solid #1d2a44', borderRadius: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399', padding: '3px 10px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.25)', borderRadius: 999 }}>
                    QUESTION {currentQIndex + 1} OF {questions.length}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>
                    +{currentQ?.points || 100} PTS
                  </span>
                </div>

                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', margin: '0 0 16px', lineHeight: 1.5 }}>
                  {currentQ?.question}
                </h2>

                {/* MCQ Options */}
                <form onSubmit={handleSubmitAnswer} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(currentQ?.options || []).map((opt, idx) => {
                    const isSelected = selectedOption === idx;
                    const letter = String.fromCharCode(65 + idx);
                    return (
                      <label
                        key={idx}
                        onClick={() => setSelectedOption(idx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 14px',
                          borderRadius: 10,
                          background: isSelected ? 'rgba(56, 189, 248, 0.12)' : '#070d1a',
                          border: `1px solid ${isSelected ? '#38bdf8' : '#1d2a44'}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{ width: 26, height: 26, borderRadius: 6, background: isSelected ? '#0ea5e9' : '#1e293b', color: isSelected ? '#02131f' : '#94a3b8', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          {letter}
                        </span>
                        <span style={{ fontSize: 13.5, color: isSelected ? '#ffffff' : '#cbd5e1', fontWeight: isSelected ? 600 : 400, flex: 1 }}>
                          {opt}
                        </span>
                      </label>
                    );
                  })}

                  {/* Feedback Banner */}
                  {feedback && (
                    <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, background: feedback.type === 'success' ? 'rgba(52, 211, 153, 0.12)' : 'rgba(248, 113, 113, 0.12)', border: `1px solid ${feedback.type === 'success' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`, color: feedback.type === 'success' ? '#34d399' : '#f87171' }}>
                      {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      <span>{feedback.message}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={selectedOption === null || submitting}
                    className="ieee-enter-btn"
                    style={{ marginTop: 8, width: '100%', padding: '12px', fontSize: 13, justifyContent: 'center' }}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Investigation Answer'}
                  </button>
                </form>

                {/* Hints Box */}
                {currentQHints.length > 0 && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #1d2a44' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
                      INVESTIGATION HINTS
                    </span>
                    {currentQHints.map((h) => (
                      <div key={h.id || h._id} style={{ padding: 12, borderRadius: 8, background: '#070d1a', border: '1px solid #1d2a44', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Lightbulb size={16} style={{ color: h.isUsed ? '#fbbf24' : '#64748b' }} />
                          <span style={{ fontSize: 12.5, color: h.isUsed ? '#f8fafc' : '#94a3b8' }}>
                            {h.isUsed ? h.hintText : `Hint Available (Penalty: -${h.penalty || 20} pts)`}
                          </span>
                        </div>
                        {!h.isUsed && (
                          <button
                            type="button"
                            onClick={() => setHintModal(h)}
                            style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, background: 'rgba(251, 191, 36, 0.12)', border: '1px solid rgba(251, 191, 36, 0.3)', color: '#fbbf24', cursor: 'pointer' }}
                          >
                            Unlock
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hint Unlock Modal Confirmation */}
        {hintModal && (
          <div className="ieee-modal-overlay">
            <div className="ieee-modal-box">
              <div className="ieee-modal-icon warning" style={{ background: 'rgba(251, 191, 36, 0.12)', border: '1px solid rgba(251, 191, 36, 0.3)', color: '#fbbf24' }}>
                <Lightbulb className="w-6 h-6" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>Unlock Investigation Hint?</h3>
              <p className="ieee-modal-msg" style={{ fontSize: 13.5, color: '#94a3b8' }}>
                Unlocking this hint will deduct <strong>{hintModal.penalty || 20} points</strong> from your investigation score.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button onClick={() => setHintModal(null)} className="ieee-outline-btn" style={{ padding: '8px 16px', fontSize: 12 }}>
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirmUnlockHint(hintModal)}
                  disabled={unlockingHint}
                  className="ieee-enter-btn"
                  style={{ padding: '8px 16px', fontSize: 12 }}
                >
                  {unlockingHint ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Unlock'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default DetectiveGamePage;
