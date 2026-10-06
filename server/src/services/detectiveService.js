import { DetectiveCase } from '../models/DetectiveCase.js';
import { DetectiveClue } from '../models/DetectiveClue.js';
import { DetectiveQuestion } from '../models/DetectiveQuestion.js';
import { DetectiveHint } from '../models/DetectiveHint.js';
import { DetectiveAttempt } from '../models/DetectiveAttempt.js';
import { Team } from '../models/Team.js';
import { isDbConnected, getMemoryStore, saveDiskBackup, findTeamById, findUserById } from './store.js';
import { verifyRoundEligibility } from './roundSessionService.js';

// Pre-seeded Detective Case Data for Memory Store / Fallback
const DEFAULT_SEED_CASE = {
  _id: 'seed_det_case_1',
  title: 'The Stark Laboratory Security Breach',
  description: 'A breach occurred in the Quantum Vault at 08:42 PM. Analyze the access logs, CCTV surveillance snapshots, and biometric override notes to identify the culprit and retrieve the stolen Vibranium core.',
  difficulty: 'Detective',
  timeLimitSeconds: 1800, // 30 mins
  maximumScore: 500,
  status: 'PUBLISHED',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const DEFAULT_SEED_CLUES = [
  {
    _id: 'seed_clue_1',
    caseId: 'seed_det_case_1',
    order: 1,
    title: 'Clue 1: Vault Access Log Fragment',
    description: 'Automated access records captured at the main laboratory doorway between 08:30 PM and 09:00 PM.',
    evidence: `TIMESTAMP | BADGE ID | ACCESS STATUS | LOGGED BY
08:32 PM  | STARK-01  | AUTHORIZED    | Tony Stark
08:42 PM  | BANNER-04 | AUTHORIZED    | Bruce Banner
08:45 PM  | UNKNOWN   | ALERT BYPASS  | System Sensor
08:50 PM  | ROGERS-02 | LOGOUT        | Steve Rogers`,
    evidenceType: 'document',
    createdAt: new Date(),
  },
  {
    _id: 'seed_clue_2',
    caseId: 'seed_det_case_1',
    order: 2,
    title: 'Clue 2: CCTV Camera 4 Surveillance Snapshot',
    description: 'High-resolution frame captured at 08:42:15 PM showing a suspect entering the quantum vault corridor.',
    evidence: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800',
    evidenceType: 'image',
    createdAt: new Date(),
  },
  {
    _id: 'seed_clue_3',
    caseId: 'seed_det_case_1',
    order: 3,
    title: 'Clue 3: Biometric Sensor Override Report',
    description: 'Security Analysis: The biometric sensor registered badge BANNER-04, but physical gait analysis matched agent Arjun’s movement patterns. Badge BANNER-04 was reported stolen 1 hour prior to breach.',
    evidence: 'Analysis Result: Badge ID BANNER-04 was stolen. Biometric gait analysis matched Agent Arjun.',
    evidenceType: 'text',
    createdAt: new Date(),
  },
];

const DEFAULT_SEED_QUESTIONS = [
  {
    _id: 'seed_q_1',
    caseId: 'seed_det_case_1',
    clueId: 'seed_clue_1',
    order: 1,
    question: 'Which badge ID was used to breach the vault at 08:42 PM according to the access log?',
    options: ['STARK-01', 'BANNER-04', 'ROGERS-02', 'UNKNOWN-GUEST'],
    correctAnswerIndex: 1, // BANNER-04
    points: 100,
    createdAt: new Date(),
  },
  {
    _id: 'seed_q_2',
    caseId: 'seed_det_case_1',
    clueId: 'seed_clue_3',
    order: 2,
    question: 'Based on the biometric gait analysis and stolen badge report, who actually breached the vault?',
    options: ['Rahul', 'Arjun', 'Karthik', 'Aman'],
    correctAnswerIndex: 1, // Arjun
    points: 150,
    createdAt: new Date(),
  },
  {
    _id: 'seed_q_3',
    caseId: 'seed_det_case_1',
    clueId: 'seed_clue_1',
    order: 3,
    question: 'At what time was the automated ALERT BYPASS recorded?',
    options: ['08:32 PM', '08:42 PM', '08:45 PM', '08:50 PM'],
    correctAnswerIndex: 2, // 08:45 PM
    points: 100,
    createdAt: new Date(),
  },
];

const DEFAULT_SEED_HINTS = [
  {
    _id: 'seed_h_1',
    caseId: 'seed_det_case_1',
    questionId: 'seed_q_2',
    order: 1,
    hintText: 'Cross-reference the biometric sensor override note with the stolen badge report.',
    penalty: 20,
    enabled: true,
    createdAt: new Date(),
  },
];

/**
 * Initializes in-memory detective store if MongoDB is not connected
 */
function ensureMemoryStore() {
  const mem = getMemoryStore();
  if (!mem.detectiveCases) mem.detectiveCases = [DEFAULT_SEED_CASE];
  if (!mem.detectiveClues) mem.detectiveClues = [...DEFAULT_SEED_CLUES];
  if (!mem.detectiveQuestions) mem.detectiveQuestions = [...DEFAULT_SEED_QUESTIONS];
  if (!mem.detectiveHints) mem.detectiveHints = [...DEFAULT_SEED_HINTS];
  if (!mem.detectiveAttempts) mem.detectiveAttempts = [];
  return mem;
}

/**
 * Seeds default detective case in MongoDB if empty
 */
export async function seedDefaultDetectiveCaseIfNeeded() {
  if (!isDbConnected()) {
    ensureMemoryStore();
    return;
  }

  try {
    const caseCount = await DetectiveCase.countDocuments();
    if (caseCount === 0) {
      const { _id: seedId, ...casePayload } = DEFAULT_SEED_CASE;
      const createdCase = await DetectiveCase.create(casePayload);
      const caseId = createdCase._id;

      const clueMap = {};
      for (const clue of DEFAULT_SEED_CLUES) {
        const { _id, ...rest } = clue;
        const c = await DetectiveClue.create({ ...rest, caseId });
        clueMap[_id] = c._id;
      }

      const questionMap = {};
      for (const q of DEFAULT_SEED_QUESTIONS) {
        const { _id, clueId, ...rest } = q;
        const createdQ = await DetectiveQuestion.create({
          ...rest,
          caseId,
          clueId: clueMap[clueId] || null,
        });
        questionMap[_id] = createdQ._id;
      }

      for (const h of DEFAULT_SEED_HINTS) {
        const { _id, questionId, ...rest } = h;
        await DetectiveHint.create({
          ...rest,
          caseId,
          questionId: questionMap[questionId] || null,
        });
      }

      console.log('[Detective Engine] Pre-seeded default Detective Case into MongoDB.');
    }
  } catch (err) {
    console.warn('[Detective Seed Warning]:', err.message);
  }
}

/**
 * GET published case details for participant (WITH BACKEND QUALIFICATION GUARD)
 */
export async function getPublishedCaseForParticipant(teamId, user) {
  // 1. Backend Qualification Guard Check
  const eligibility = await verifyRoundEligibility(teamId, 2);
  if (!eligibility.isEligible) {
    return {
      isEligible: false,
      code: eligibility.code || 'UNQUALIFIED',
      reason: eligibility.reason || 'Your team is not qualified for Round 2.',
    };
  }

  let caseDoc = null;
  let clues = [];
  let questions = [];
  let hints = [];

  if (isDbConnected()) {
    caseDoc = await DetectiveCase.findOne({ status: 'PUBLISHED' }).sort({ createdAt: -1 });
    if (caseDoc) {
      clues = await DetectiveClue.find({ caseId: caseDoc._id }).sort({ order: 1 });
      questions = await DetectiveQuestion.find({ caseId: caseDoc._id }).sort({ order: 1 });
      hints = await DetectiveHint.find({ caseId: caseDoc._id, enabled: true }).sort({ order: 1 });
    }
  } else {
    const mem = ensureMemoryStore();
    caseDoc = mem.detectiveCases.find((c) => c.status === 'PUBLISHED') || mem.detectiveCases[0];
    if (caseDoc) {
      const cId = String(caseDoc._id);
      clues = (mem.detectiveClues || [])
        .filter((c) => String(c.caseId) === cId)
        .sort((a, b) => (a.order || 1) - (b.order || 1));
      questions = (mem.detectiveQuestions || [])
        .filter((q) => String(q.caseId) === cId)
        .sort((a, b) => (a.order || 1) - (b.order || 1));
      hints = (mem.detectiveHints || [])
        .filter((h) => String(h.caseId) === cId && h.enabled !== false)
        .sort((a, b) => (a.order || 1) - (b.order || 1));
    }
  }

  if (!caseDoc) {
    return {
      isEligible: true,
      caseAvailable: false,
      message: 'No published Detective Case is currently available.',
    };
  }

  // 2. Fetch or initialize team attempt
  const attempt = await getOrStartAttempt(caseDoc._id, teamId, user._id);

  // 3. SECURITY: Sanitize questions - NEVER send correct answers to client!
  const sanitizedQuestions = questions.map((q) => ({
    id: q._id,
    _id: q._id,
    order: q.order,
    question: q.question,
    options: q.options,
    points: q.points,
    clueId: q.clueId,
  }));

  // 4. Sanitize hints - omit hintText unless unlocked in hintsUsed
  const sanitizedHints = hints.map((h) => {
    const hId = String(h._id);
    const isUsed = (attempt.hintsUsed || []).includes(hId);
    return {
      id: h._id,
      _id: h._id,
      questionId: h.questionId,
      order: h.order,
      penalty: h.penalty,
      isUsed,
      hintText: isUsed ? h.hintText : undefined, // Only reveal text if already unlocked
    };
  });

  return {
    isEligible: true,
    caseAvailable: true,
    case: {
      id: caseDoc._id,
      _id: caseDoc._id,
      title: caseDoc.title,
      description: caseDoc.description,
      difficulty: caseDoc.difficulty,
      timeLimitSeconds: caseDoc.timeLimitSeconds,
      maximumScore: caseDoc.maximumScore,
    },
    clues: clues.map((c) => ({
      id: c._id,
      _id: c._id,
      order: c.order,
      title: c.title,
      description: c.description,
      evidence: c.evidence,
      evidenceType: c.evidenceType,
    })),
    questions: sanitizedQuestions,
    hints: sanitizedHints,
    attempt: {
      id: attempt._id,
      _id: attempt._id,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      currentQuestionIndex: attempt.currentQuestionIndex,
      score: attempt.score,
      hintsUsed: attempt.hintsUsed || [],
      status: attempt.status,
      completedAt: attempt.completedAt,
    },
  };
}

/**
 * Get active team attempt or create a new one
 */
export async function getOrStartAttempt(caseId, teamId, participantId) {
  const caseIdStr = String(caseId);
  const teamIdStr = String(teamId);
  const pIdStr = String(participantId);

  let caseDoc = null;
  if (isDbConnected()) {
    caseDoc = await DetectiveCase.findById(caseId);
  } else {
    const mem = ensureMemoryStore();
    caseDoc = mem.detectiveCases.find((c) => String(c._id) === caseIdStr);
  }
  const durationSec = caseDoc?.timeLimitSeconds || 1800;

  if (isDbConnected()) {
    let attempt = await DetectiveAttempt.findOne({ caseId: caseDoc._id, teamId });
    if (!attempt) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + durationSec * 1000);
      attempt = await DetectiveAttempt.create({
        caseId: caseDoc._id,
        teamId,
        participantId,
        startedAt: now,
        expiresAt,
        currentQuestionIndex: 0,
        score: 0,
        hintsUsed: [],
        answersSubmitted: [],
        status: 'CASE_STARTED',
      });
    } else {
      // Check timer expiration
      if (['CASE_STARTED', 'IN_PROGRESS'].includes(attempt.status) && new Date() > attempt.expiresAt) {
        attempt.status = 'TIME_EXPIRED';
        attempt.completedAt = attempt.expiresAt;
        await attempt.save();
      }
    }
    return attempt;
  } else {
    const mem = ensureMemoryStore();
    let attempt = mem.detectiveAttempts.find(
      (a) => String(a.caseId) === caseIdStr && String(a.teamId) === teamIdStr
    );

    if (!attempt) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + durationSec * 1000);
      attempt = {
        _id: `mem_det_attempt_${teamIdStr}`,
        caseId: caseIdStr,
        teamId: teamIdStr,
        participantId: pIdStr,
        startedAt: now,
        expiresAt,
        currentQuestionIndex: 0,
        score: 0,
        hintsUsed: [],
        answersSubmitted: [],
        status: 'CASE_STARTED',
        completedAt: null,
      };
      mem.detectiveAttempts.push(attempt);
      saveDiskBackup();
    } else {
      if (['CASE_STARTED', 'IN_PROGRESS'].includes(attempt.status) && new Date() > new Date(attempt.expiresAt)) {
        attempt.status = 'TIME_EXPIRED';
        attempt.completedAt = attempt.expiresAt;
        saveDiskBackup();
      }
    }
    return attempt;
  }
}

/**
 * Submit answer for a question in active attempt
 */
export async function submitQuestionAnswer(teamId, questionId, selectedOptionIndex, user) {
  const team = await findTeamById(teamId);
  if (!team) throw new Error('Team not found.');

  // Check Round 1 Qualification Guard
  const eligibility = await verifyRoundEligibility(teamId, 2);
  if (!eligibility.isEligible) {
    throw new Error(eligibility.reason || 'Team is not qualified for Round 2.');
  }

  let qDoc = null;
  let caseDoc = null;
  const qIdStr = String(questionId);

  if (isDbConnected()) {
    qDoc = await DetectiveQuestion.findById(questionId);
    if (qDoc) caseDoc = await DetectiveCase.findById(qDoc.caseId);
  } else {
    const mem = ensureMemoryStore();
    qDoc = mem.detectiveQuestions.find((q) => String(q._id) === qIdStr);
    if (qDoc) caseDoc = mem.detectiveCases.find((c) => String(c._id) === String(qDoc.caseId));
  }

  if (!qDoc || !caseDoc) throw new Error('Question or Detective Case not found.');

  const attempt = await getOrStartAttempt(caseDoc._id, team._id, user._id);

  if (['COMPLETED', 'TIME_EXPIRED'].includes(attempt.status)) {
    throw new Error(`Investigation session is ${attempt.status.toLowerCase()}. Further answer submissions are rejected.`);
  }

  if (new Date() > new Date(attempt.expiresAt)) {
    attempt.status = 'TIME_EXPIRED';
    if (isDbConnected() && typeof attempt.save === 'function') await attempt.save();
    else saveDiskBackup();
    throw new Error('Timer has expired. Investigation time is over.');
  }

  // Calculate correctness on server
  const isCorrect = Number(selectedOptionIndex) === Number(qDoc.correctAnswerIndex);
  const pointsAwarded = isCorrect ? (qDoc.points || 100) : 0;

  // Record submission
  attempt.status = 'IN_PROGRESS';
  attempt.score = (attempt.score || 0) + pointsAwarded;
  attempt.currentQuestionIndex = (attempt.currentQuestionIndex || 0) + 1;

  if (!attempt.answersSubmitted) attempt.answersSubmitted = [];
  attempt.answersSubmitted.push({
    questionId: String(qDoc._id),
    selectedOptionIndex: Number(selectedOptionIndex),
    isCorrect,
    pointsAwarded,
    answeredAt: new Date(),
  });

  // Check total questions count for case
  let totalQuestionsCount = 0;
  if (isDbConnected()) {
    totalQuestionsCount = await DetectiveQuestion.countDocuments({ caseId: caseDoc._id });
  } else {
    const mem = ensureMemoryStore();
    totalQuestionsCount = mem.detectiveQuestions.filter((q) => String(q.caseId) === String(caseDoc._id)).length;
  }

  const isCaseCompleted = attempt.currentQuestionIndex >= totalQuestionsCount;
  if (isCaseCompleted) {
    attempt.status = 'COMPLETED';
    attempt.completedAt = new Date();
  }

  if (isDbConnected()) {
    if (typeof attempt.save === 'function') await attempt.save();
  } else {
    saveDiskBackup();
  }

  // Update Team qualifications score record for Round 2
  if (!team.qualifications) team.qualifications = [];
  let r2Qual = team.qualifications.find((q) => q.roundNumber === 2);
  if (!r2Qual) {
    team.qualifications.push({
      roundNumber: 2,
      status: isCaseCompleted ? 'QUALIFIED' : 'PENDING',
      score: attempt.score,
      puzzlesCompleted: attempt.currentQuestionIndex,
      completionTimeSeconds: attempt.completedAt
        ? Math.floor((new Date(attempt.completedAt) - new Date(attempt.startedAt)) / 1000)
        : Math.floor((new Date() - new Date(attempt.startedAt)) / 1000),
      qualifiedAt: isCaseCompleted ? new Date() : null,
    });
  } else {
    r2Qual.score = attempt.score;
    r2Qual.puzzlesCompleted = attempt.currentQuestionIndex;
    if (isCaseCompleted) {
      r2Qual.status = 'QUALIFIED';
      r2Qual.qualifiedAt = new Date();
    }
  }

  if (isDbConnected()) {
    if (typeof team.save === 'function') await team.save();
  } else {
    saveDiskBackup();
  }

  return {
    success: true,
    isCorrect,
    pointsAwarded,
    newScore: attempt.score,
    currentQuestionIndex: attempt.currentQuestionIndex,
    isCaseCompleted,
    status: attempt.status,
  };
}

/**
 * Unlock hint for participant attempt (Deducts penalty, records hint usage)
 */
export async function unlockHint(teamId, hintId, user) {
  const team = await findTeamById(teamId);
  if (!team) throw new Error('Team not found.');

  const eligibility = await verifyRoundEligibility(teamId, 2);
  if (!eligibility.isEligible) throw new Error(eligibility.reason || 'Not qualified for Round 2.');

  let hintDoc = null;
  let caseDoc = null;
  const hIdStr = String(hintId);

  if (isDbConnected()) {
    hintDoc = await DetectiveHint.findById(hintId);
    if (hintDoc) caseDoc = await DetectiveCase.findById(hintDoc.caseId);
  } else {
    const mem = ensureMemoryStore();
    hintDoc = mem.detectiveHints.find((h) => String(h._id) === hIdStr);
    if (hintDoc) caseDoc = mem.detectiveCases.find((c) => String(c._id) === String(hintDoc.caseId));
  }

  if (!hintDoc || !caseDoc) throw new Error('Hint or Case not found.');
  if (hintDoc.enabled === false) throw new Error('This hint is disabled by an administrator.');

  const attempt = await getOrStartAttempt(caseDoc._id, team._id, user._id);

  if (['COMPLETED', 'TIME_EXPIRED'].includes(attempt.status)) {
    throw new Error(`Attempt is ${attempt.status}. Hints cannot be unlocked.`);
  }

  if (!attempt.hintsUsed) attempt.hintsUsed = [];
  if (attempt.hintsUsed.includes(hIdStr)) {
    return {
      success: true,
      alreadyUnlocked: true,
      hintText: hintDoc.hintText,
      penalty: hintDoc.penalty || 20,
      currentScore: attempt.score,
    };
  }

  // Deduct penalty
  const penalty = Number(hintDoc.penalty || 20);
  attempt.score = Math.max(0, (attempt.score || 0) - penalty);
  attempt.hintsUsed.push(hIdStr);

  if (isDbConnected()) {
    if (typeof attempt.save === 'function') await attempt.save();
  } else {
    saveDiskBackup();
  }

  return {
    success: true,
    alreadyUnlocked: false,
    hintText: hintDoc.hintText,
    penaltyDeducted: penalty,
    currentScore: attempt.score,
    hintsUsed: attempt.hintsUsed,
  };
}

/* ============================================================================
   ADMIN OPERATIONS (CASES, CLUES, QUESTIONS, HINTS, ATTEMPTS)
   ============================================================================ */

export async function getAllAdminCases() {
  if (isDbConnected()) {
    return await DetectiveCase.find().sort({ createdAt: -1 });
  }
  const mem = ensureMemoryStore();
  return mem.detectiveCases || [];
}

export async function createAdminCase(caseData) {
  if (isDbConnected()) {
    return await DetectiveCase.create(caseData);
  }
  const mem = ensureMemoryStore();
  const newCase = {
    _id: `mem_case_${Date.now()}`,
    ...caseData,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mem.detectiveCases.unshift(newCase);
  saveDiskBackup();
  return newCase;
}

export async function updateAdminCase(caseId, caseData) {
  if (isDbConnected()) {
    return await DetectiveCase.findByIdAndUpdate(caseId, caseData, { new: true });
  }
  const mem = ensureMemoryStore();
  const c = mem.detectiveCases.find((x) => String(x._id) === String(caseId));
  if (c) Object.assign(c, caseData, { updatedAt: new Date() });
  saveDiskBackup();
  return c;
}

export async function togglePublishAdminCase(caseId, status) {
  if (isDbConnected()) {
    if (status === 'PUBLISHED') {
      await DetectiveCase.updateMany({ _id: { $ne: caseId } }, { status: 'UNPUBLISHED' });
    }
    return await DetectiveCase.findByIdAndUpdate(caseId, { status }, { new: true });
  }
  const mem = ensureMemoryStore();
  if (status === 'PUBLISHED') {
    mem.detectiveCases.forEach((c) => { if (String(c._id) !== String(caseId)) c.status = 'UNPUBLISHED'; });
  }
  const c = mem.detectiveCases.find((x) => String(x._id) === String(caseId));
  if (c) c.status = status;
  saveDiskBackup();
  return c;
}

export async function deleteAdminCase(caseId) {
  const cIdStr = String(caseId);
  if (isDbConnected()) {
    await DetectiveCase.findByIdAndDelete(caseId);
    await DetectiveClue.deleteMany({ caseId });
    await DetectiveQuestion.deleteMany({ caseId });
    await DetectiveHint.deleteMany({ caseId });
    await DetectiveAttempt.deleteMany({ caseId });
  } else {
    const mem = ensureMemoryStore();
    mem.detectiveCases = mem.detectiveCases.filter((x) => String(x._id) !== cIdStr);
    mem.detectiveClues = mem.detectiveClues.filter((x) => String(x.caseId) !== cIdStr);
    mem.detectiveQuestions = mem.detectiveQuestions.filter((x) => String(x.caseId) !== cIdStr);
    mem.detectiveHints = mem.detectiveHints.filter((x) => String(x.caseId) !== cIdStr);
    mem.detectiveAttempts = mem.detectiveAttempts.filter((x) => String(x.caseId) !== cIdStr);
    saveDiskBackup();
  }
  return true;
}

// Clues
export async function getAdminClues(caseId) {
  const cIdStr = String(caseId);
  if (isDbConnected()) {
    return await DetectiveClue.find({ caseId }).sort({ order: 1 });
  }
  const mem = ensureMemoryStore();
  return mem.detectiveClues.filter((x) => String(x.caseId) === cIdStr).sort((a, b) => a.order - b.order);
}

export async function createAdminClue(clueData) {
  if (isDbConnected()) {
    return await DetectiveClue.create(clueData);
  }
  const mem = ensureMemoryStore();
  const newClue = {
    _id: `mem_clue_${Date.now()}`,
    ...clueData,
    createdAt: new Date(),
  };
  mem.detectiveClues.push(newClue);
  saveDiskBackup();
  return newClue;
}

export async function updateAdminClue(clueId, clueData) {
  if (isDbConnected()) {
    return await DetectiveClue.findByIdAndUpdate(clueId, clueData, { new: true });
  }
  const mem = ensureMemoryStore();
  const c = mem.detectiveClues.find((x) => String(x._id) === String(clueId));
  if (c) Object.assign(c, clueData);
  saveDiskBackup();
  return c;
}

export async function deleteAdminClue(clueId) {
  const idStr = String(clueId);
  if (isDbConnected()) {
    await DetectiveClue.findByIdAndDelete(clueId);
  } else {
    const mem = ensureMemoryStore();
    mem.detectiveClues = mem.detectiveClues.filter((x) => String(x._id) !== idStr);
    saveDiskBackup();
  }
  return true;
}

// Questions
export async function getAdminQuestions(caseId) {
  const cIdStr = String(caseId);
  if (isDbConnected()) {
    return await DetectiveQuestion.find({ caseId }).sort({ order: 1 });
  }
  const mem = ensureMemoryStore();
  return mem.detectiveQuestions.filter((x) => String(x.caseId) === cIdStr).sort((a, b) => a.order - b.order);
}

export async function createAdminQuestion(qData) {
  if (isDbConnected()) {
    return await DetectiveQuestion.create(qData);
  }
  const mem = ensureMemoryStore();
  const newQ = {
    _id: `mem_q_${Date.now()}`,
    ...qData,
    createdAt: new Date(),
  };
  mem.detectiveQuestions.push(newQ);
  saveDiskBackup();
  return newQ;
}

export async function updateAdminQuestion(qId, qData) {
  if (isDbConnected()) {
    return await DetectiveQuestion.findByIdAndUpdate(qId, qData, { new: true });
  }
  const mem = ensureMemoryStore();
  const q = mem.detectiveQuestions.find((x) => String(x._id) === String(qId));
  if (q) Object.assign(q, qData);
  saveDiskBackup();
  return q;
}

export async function deleteAdminQuestion(qId) {
  const idStr = String(qId);
  if (isDbConnected()) {
    await DetectiveQuestion.findByIdAndDelete(qId);
  } else {
    const mem = ensureMemoryStore();
    mem.detectiveQuestions = mem.detectiveQuestions.filter((x) => String(x._id) !== idStr);
    saveDiskBackup();
  }
  return true;
}

// Hints
export async function getAdminHints(caseId) {
  const cIdStr = String(caseId);
  if (isDbConnected()) {
    return await DetectiveHint.find({ caseId }).sort({ order: 1 });
  }
  const mem = ensureMemoryStore();
  return mem.detectiveHints.filter((x) => String(x.caseId) === cIdStr).sort((a, b) => a.order - b.order);
}

export async function createAdminHint(hData) {
  if (isDbConnected()) {
    return await DetectiveHint.create(hData);
  }
  const mem = ensureMemoryStore();
  const newH = {
    _id: `mem_hint_${Date.now()}`,
    ...hData,
    createdAt: new Date(),
  };
  mem.detectiveHints.push(newH);
  saveDiskBackup();
  return newH;
}

export async function updateAdminHint(hId, hData) {
  if (isDbConnected()) {
    return await DetectiveHint.findByIdAndUpdate(hId, hData, { new: true });
  }
  const mem = ensureMemoryStore();
  const h = mem.detectiveHints.find((x) => String(x._id) === String(hId));
  if (h) Object.assign(h, hData);
  saveDiskBackup();
  return h;
}

export async function deleteAdminHint(hId) {
  const idStr = String(hId);
  if (isDbConnected()) {
    await DetectiveHint.findByIdAndDelete(hId);
  } else {
    const mem = ensureMemoryStore();
    mem.detectiveHints = mem.detectiveHints.filter((x) => String(x._id) !== idStr);
    saveDiskBackup();
  }
  return true;
}

// Attempts & Participant Results
export async function getAdminAttempts() {
  let attempts = [];
  if (isDbConnected()) {
    attempts = await DetectiveAttempt.find().sort({ updatedAt: -1 }).lean();
  } else {
    const mem = ensureMemoryStore();
    attempts = mem.detectiveAttempts || [];
  }

  // Populate team name and participant name
  const enriched = await Promise.all(
    attempts.map(async (att) => {
      const team = await findTeamById(att.teamId);
      const user = await findUserById(att.participantId);
      return {
        ...att,
        id: att._id,
        teamName: team ? team.name : 'Unknown Team',
        teamCode: team ? team.code : '—',
        participantName: user ? user.name : 'Participant',
        participantEmail: user ? user.email : '—',
      };
    })
  );

  return enriched;
}
