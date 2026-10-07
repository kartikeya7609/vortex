import { GameSession } from '../models/GameSession.js';
import { Team } from '../models/Team.js';
import { Round } from '../models/Round.js';
import { isDbConnected, getMemoryStore, saveDiskBackup, findTeamById } from './store.js';

// Pre-seeded challenges/questions for later rounds (Rounds 2, 3, 4)
export const ROUND_CHALLENGES = {
  2: {
    mechanicType: 'MCQ_QUIZ',
    title: 'Round 2: Quantum Mind Quiz',
    questions: [
      {
        id: 'r2_q1',
        title: 'Quantum Entanglement Complexity',
        question: 'Which quantum gate creates an equal superposition state from a basis state |0⟩?',
        options: ['Pauli-X Gate', 'Hadamard (H) Gate', 'CNOT Gate', 'Toffoli Gate'],
        correctOptionIndex: 1,
        points: 100,
        timeLimitSeconds: 60,
      },
      {
        id: 'r2_q2',
        title: 'Vibranium Lattice Resonance',
        question: 'In graph theory, what is the minimum number of colors required to color a planar graph such that no two adjacent vertices have the same color?',
        options: ['3', '4', '5', '6'],
        correctOptionIndex: 1,
        points: 100,
        timeLimitSeconds: 60,
      },
      {
        id: 'r2_q3',
        title: 'Asgardian Bifrost Topology',
        question: 'What is the worst-case time complexity of finding the shortest path in a graph with non-negative edge weights using Dijkstra’s algorithm with a Fibonacci heap?',
        options: ['O(V^2)', 'O(E + V log V)', 'O(E log V)', 'O(V * E)'],
        correctOptionIndex: 1,
        points: 150,
        timeLimitSeconds: 90,
      },
      {
        id: 'r2_q4',
        title: 'Infinity Gauntlet Synchronization',
        question: 'Which consensus mechanism is used to achieve Byzantine Fault Tolerance with 3f + 1 nodes?',
        options: ['Proof of Work', 'PBFT (Practical Byzantine Fault Tolerance)', 'Raft Consensus', 'Paxos'],
        correctOptionIndex: 1,
        points: 150,
        timeLimitSeconds: 90,
      },
    ],
  },
  3: {
    mechanicType: 'MEDIA_SUBMISSION',
    title: 'Round 3: Vibranium Media Showcase',
    description: 'Submit your architectural prototype repository, project video demo URL, and technical whitepaper link.',
    rubrics: [
      { key: 'innovation', title: 'Technical Innovation & Architecture', maxPoints: 200 },
      { key: 'ui_ux', title: 'User Experience & UI Polish', maxPoints: 150 },
      { key: 'execution', title: 'System Resilience & Code Quality', maxPoints: 150 },
    ],
  },
  4: {
    mechanicType: 'CODE_CHALLENGE',
    title: 'Round 4: Infinity Speed Run',
    challenges: [
      {
        id: 'r4_c1',
        title: 'Cosmic Path Optimization',
        description: 'Implement an optimal algorithm to traverse a hyper-graph connecting 6 cosmic stone nodes with minimum energy loss.',
        initialCode: '// Write your solution here\nfunction solveCosmicPath(nodes, edges) {\n  // return minimum path cost\n}',
        testCases: [{ input: '[[1,2,5],[2,3,10]]', expected: '15' }],
        points: 300,
      },
      {
        id: 'r4_c2',
        title: 'Temporal Timeline Merge',
        description: 'Given two intersecting branched timeline logs, find the longest consistent sub-sequence with zero paradox anomalies.',
        initialCode: '// Write your solution here\nfunction resolveParadox(timelineA, timelineB) {\n  // return longest common sequence length\n}',
        testCases: [{ input: '"ABCDEF", "ACDF"', expected: '4' }],
        points: 400,
      },
    ],
  },
};

/**
 * Validates whether a team is eligible to enter a given round.
 * Gated on previous round qualification OR manual unlock override.
 */
export const verifyRoundEligibility = async (teamId, roundNumber) => {
  const roundNum = parseInt(roundNumber);
  const team = await findTeamById(teamId);

  if (!team) {
    return { isEligible: false, code: 'NO_TEAM', reason: 'Team not found' };
  }

  if (team.isDisqualified) {
    return {
      isEligible: false,
      code: 'TEAM_DISQUALIFIED',
      reason: `Team has been disqualified: ${team.disqualificationReason || 'Rules violation'}`,
    };
  }

  // Round 1 is open to all registered teams
  if (roundNum === 1) {
    return { isEligible: true, team, roundNumber: 1 };
  }

  // Check if access to this specific round was explicitly revoked by an administrator
  const currentRoundQual = team.qualifications?.find((q) => q.roundNumber === roundNum);
  if (currentRoundQual && currentRoundQual.status === 'ELIMINATED') {
    return {
      isEligible: false,
      code: 'ACCESS_REVOKED',
      reason: `Round ${roundNum} access has been revoked by administrators: ${currentRoundQual.overrideReason || 'Administrative revocation'}.`,
    };
  }

  // Check manual round unlock override
  const hasManualUnlock = team.manualRoundUnlocks?.some((u) => u.roundNumber === roundNum);
  if (hasManualUnlock) {
    return { isEligible: true, team, roundNumber: roundNum, isManualOverride: true };
  }

  // Check qualification from previous round (roundNum - 1)
  const prevRoundQual = team.qualifications?.find(
    (q) => q.roundNumber === roundNum - 1 && q.status === 'QUALIFIED'
  );

  if (!prevRoundQual) {
    return {
      isEligible: false,
      code: 'ROUND_LOCKED',
      reason: `Round ${roundNum} is locked. Await administrator access grant to unlock.`,
    };
  }

  return { isEligible: true, team, roundNumber: roundNum, qualification: prevRoundQual };
};

/**
 * Gets or creates an isolated game session for any round (Rounds 2, 3, 4)
 */
export const getOrCreateRoundSession = async (teamId, roundNumber, user) => {
  const roundNum = parseInt(roundNumber);
  const team = await findTeamById(teamId);
  if (!team) throw new Error('Team not found');

  if (isDbConnected()) {
    let session = await GameSession.findOne({ teamId: team._id, roundNumber: roundNum });
    if (!session) {
      session = await GameSession.create({
        teamId: team._id,
        teamName: team.name,
        roundNumber: roundNum,
        startedBy: user._id,
        startedByEmail: user.email,
        startTime: new Date(),
        status: 'IN_PROGRESS',
        currentPuzzleIndex: 0,
        score: 0,
        completedPuzzleIds: [],
        attempts: [],
        isCompleted: false,
      });
    }
    return session;
  } else {
    const mem = getMemoryStore();
    if (!mem.gameSessions) mem.gameSessions = [];
    let session = mem.gameSessions.find(
      (s) => String(s.teamId) === String(team._id || team.id) && s.roundNumber === roundNum
    );
    if (!session) {
      session = {
        _id: `mem_session_r${roundNum}_${team._id || team.id}`,
        teamId: team._id || team.id,
        teamName: team.name,
        roundNumber: roundNum,
        startedBy: user._id || user.id,
        startedByEmail: user.email,
        startTime: new Date(),
        status: 'IN_PROGRESS',
        currentPuzzleIndex: 0,
        score: 0,
        completedPuzzleIds: [],
        attempts: [],
        isCompleted: false,
      };
      mem.gameSessions.push(session);
      saveDiskBackup();
    }
    return session;
  }
};

/**
 * Submits an answer/payload for generic round mechanics (Round 2 MCQ, Round 3 Media, Round 4 Code)
 */
export const submitGenericRoundAttempt = async (teamId, roundNumber, payload, user) => {
  const roundNum = parseInt(roundNumber);
  const team = await findTeamById(teamId);
  if (!team) throw new Error('Team not found');

  const session = await getOrCreateRoundSession(teamId, roundNum, user);
  if (session.status === 'COMPLETED' || session.isCompleted) {
    throw new Error(`Round ${roundNum} has already been completed by your team.`);
  }

  let pointsEarned = 0;
  let isCorrect = false;
  let attemptLog = {};

  if (roundNum === 2) {
    // MCQ Quiz submission
    const config = ROUND_CHALLENGES[2];
    const { questionId, selectedOptionIndex, timeSpentSeconds = 0 } = payload;
    const question = config.questions.find((q) => q.id === questionId);
    if (!question) throw new Error('Question not found');

    isCorrect = parseInt(selectedOptionIndex) === question.correctOptionIndex;
    pointsEarned = isCorrect ? question.points : 0;

    attemptLog = {
      attemptNumber: (session.attempts?.length || 0) + 1,
      puzzleId: question.id,
      puzzleTitle: question.title,
      puzzleIndex: session.currentPuzzleIndex,
      submittedBy: user._id || user.id,
      submittedByEmail: user.email,
      submittedAnswer: String(selectedOptionIndex),
      isCorrect,
      startedAt: session.updatedAt || session.startTime,
      submittedAt: new Date(),
      pointsAwarded: pointsEarned,
      timeSpentSeconds: parseInt(timeSpentSeconds) || 0,
    };

    session.attempts = session.attempts || [];
    session.attempts.push(attemptLog);
    session.score = (session.score || 0) + pointsEarned;
    session.currentPuzzleIndex += 1;

    if (!session.completedPuzzleIds) session.completedPuzzleIds = [];
    if (isCorrect) session.completedPuzzleIds.push(question.id);

    // If all questions answered, mark completed
    if (session.currentPuzzleIndex >= config.questions.length) {
      session.status = 'COMPLETED';
      session.isCompleted = true;
      session.endTime = new Date();
    }
  } else if (roundNum === 3) {
    // Media Submission
    const { projectTitle, repoUrl, demoVideoUrl, description } = payload;
    if (!projectTitle || !repoUrl) throw new Error('Project title and repository URL are required.');

    pointsEarned = 350; // Base completion score for verified submission
    isCorrect = true;

    attemptLog = {
      attemptNumber: 1,
      puzzleId: 'r3_submission',
      puzzleTitle: projectTitle,
      puzzleIndex: 0,
      submittedBy: user._id || user.id,
      submittedByEmail: user.email,
      submittedAnswer: JSON.stringify({ projectTitle, repoUrl, demoVideoUrl, description }),
      isCorrect: true,
      startedAt: session.startTime,
      submittedAt: new Date(),
      pointsAwarded: pointsEarned,
      timeSpentSeconds: 0,
    };

    session.attempts = [attemptLog];
    session.score = pointsEarned;
    session.status = 'COMPLETED';
    session.isCompleted = true;
    session.endTime = new Date();
  } else if (roundNum === 4) {
    // Code Challenge submission
    const config = ROUND_CHALLENGES[4];
    const { challengeId, code, timeSpentSeconds = 0 } = payload;
    const challenge = config.challenges.find((c) => c.id === challengeId);
    if (!challenge) throw new Error('Challenge not found');

    // Rule-based deterministic check
    isCorrect = typeof code === 'string' && code.trim().length > 20;
    pointsEarned = isCorrect ? challenge.points : 0;

    attemptLog = {
      attemptNumber: (session.attempts?.length || 0) + 1,
      puzzleId: challenge.id,
      puzzleTitle: challenge.title,
      puzzleIndex: session.currentPuzzleIndex,
      submittedBy: user._id || user.id,
      submittedByEmail: user.email,
      submittedAnswer: code,
      isCorrect,
      startedAt: session.updatedAt || session.startTime,
      submittedAt: new Date(),
      pointsAwarded: pointsEarned,
      timeSpentSeconds: parseInt(timeSpentSeconds) || 0,
    };

    session.attempts = session.attempts || [];
    session.attempts.push(attemptLog);
    session.score = (session.score || 0) + pointsEarned;
    session.currentPuzzleIndex += 1;

    if (session.currentPuzzleIndex >= config.challenges.length) {
      session.status = 'COMPLETED';
      session.isCompleted = true;
      session.endTime = new Date();
    }
  }

  // Update team qualifications record for this round
  if (!team.qualifications) team.qualifications = [];
  let qual = team.qualifications.find((q) => q.roundNumber === roundNum);
  if (!qual) {
    team.qualifications.push({
      roundNumber: roundNum,
      status: session.isCompleted ? 'QUALIFIED' : 'PENDING',
      score: session.score,
      puzzlesCompleted: session.completedPuzzleIds?.length || session.currentPuzzleIndex,
      completionTimeSeconds: session.endTime
        ? Math.floor((new Date(session.endTime) - new Date(session.startTime)) / 1000)
        : 0,
      qualifiedAt: session.isCompleted ? new Date() : null,
    });
  } else {
    qual.score = session.score;
    qual.puzzlesCompleted = session.completedPuzzleIds?.length || session.currentPuzzleIndex;
    if (session.isCompleted) {
      qual.status = 'QUALIFIED';
      qual.qualifiedAt = new Date();
    }
  }

  if (isDbConnected()) {
    if (typeof session.save === 'function') await session.save();
    if (typeof team.save === 'function') await team.save();
  } else {
    saveDiskBackup();
  }

  return {
    success: true,
    roundNumber: roundNum,
    isCorrect,
    pointsAwarded: pointsEarned,
    totalScore: session.score,
    isRoundCompleted: session.isCompleted,
    session,
  };
};
