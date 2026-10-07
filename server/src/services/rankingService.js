import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { GameSession } from '../models/GameSession.js';
import { LeaderboardSnapshot } from '../models/LeaderboardSnapshot.js';
import { isDbConnected, getMemoryStore, saveDiskBackup, setLeaderboardFreeze, setLeaderboardPublish } from './store.js';

// Default tie-break ordering specified by competition rules
export const DEFAULT_TIE_BREAK_RULES = [
  'puzzlesCompleted',
  'totalScore',
  'completionTime',
  'finalPuzzleTimestamp',
];

/**
 * Computes live or cached rankings for a specified round number
 * @param {number} roundNumber - Round 1, 2, 3, or 4
 * @param {object} options - { qualifyingCount: 50, tieBreakRules: [] }
 */
export const computeRoundRankings = async (roundNumber = 1, options = {}) => {
  const roundNum = parseInt(roundNumber) || 1;
  const qualifyingCount = options.qualifyingCount !== undefined ? parseInt(options.qualifyingCount) : 50;
  const tieBreakRules = Array.isArray(options.tieBreakRules) && options.tieBreakRules.length > 0
    ? options.tieBreakRules
    : DEFAULT_TIE_BREAK_RULES;

  // 1. Fetch all teams and their game sessions for this round
  let teams = [];
  let sessions = [];
  let users = [];

  if (isDbConnected()) {
    try {
      teams = await Team.find({ isDisqualified: false }).populate('memberIds leaderId');
      sessions = await GameSession.find({ roundNumber: roundNum });
      users = await User.find();
    } catch (e) {
      console.warn('[RankingService DB Error, fallback to memory]:', e.message);
      const mem = getMemoryStore();
      teams = mem.teams || [];
      sessions = (mem.gameSessions || []).filter((s) => (s.roundNumber || 1) === roundNum);
      users = mem.users || [];
    }
  } else {
    const mem = getMemoryStore();
    teams = mem.teams || [];
    sessions = (mem.gameSessions || []).filter((s) => (s.roundNumber || 1) === roundNum);
    users = mem.users || [];
  }

  // 2. Build map of team sessions
  const sessionByTeamId = new Map();
  sessions.forEach((s) => {
    const tId = String(s.teamId?._id || s.teamId);
    // Prefer COMPLETED sessions, or session with higher score / more attempts
    if (!sessionByTeamId.has(tId) || s.status === 'COMPLETED') {
      sessionByTeamId.set(tId, s);
    }
  });

  // 3. Build ranking metrics for each team
  const rawEntries = teams.map((team) => {
    const teamIdStr = String(team._id || team.id);
    const session = sessionByTeamId.get(teamIdStr);

    let puzzlesCompleted = 0;
    let totalScore = 0;
    let completionTimeSeconds = 0;
    let finalPuzzleTimestamp = null;
    let isCompleted = false;

    // Check if team has existing qualification record or manual override
    const qual = team.qualifications?.find((q) => q.roundNumber === roundNum);
    const manualUnlock = team.manualRoundUnlocks?.find((u) => u.roundNumber === roundNum);
    const isManualOverride = Boolean(manualUnlock || qual?.isManualOverride);

    if (session) {
      puzzlesCompleted = session.completedPuzzleIds?.length || session.currentPuzzleIndex || 0;
      totalScore = session.score || 0;
      isCompleted = session.status === 'COMPLETED' || session.isCompleted === true;

      if (session.attempts && session.attempts.length > 0) {
        const correctAttempts = session.attempts.filter((a) => a.isCorrect);
        if (correctAttempts.length > 0) {
          const lastAttempt = correctAttempts[correctAttempts.length - 1];
          finalPuzzleTimestamp = lastAttempt.submittedAt ? new Date(lastAttempt.submittedAt) : null;
        }
      }

      if (isCompleted && session.endTime && session.startTime) {
        completionTimeSeconds = Math.max(0, Math.floor((new Date(session.endTime) - new Date(session.startTime)) / 1000));
      } else if (session.attempts && session.attempts.length > 0) {
        completionTimeSeconds = session.attempts.reduce((acc, a) => acc + (a.timeSpentSeconds || 0), 0);
      }
    } else if (qual && qual.score) {
      totalScore = qual.score;
      puzzlesCompleted = qual.puzzlesCompleted || 0;
      completionTimeSeconds = qual.completionTimeSeconds || 0;
    }

    // Extract member emails
    const memberEmails = (team.memberIds || []).map((m) => m?.email || (typeof m === 'string' ? m : '')).filter(Boolean);

    return {
      teamId: team._id || team.id,
      teamName: team.name,
      teamCode: team.code || '',
      memberCount: (team.memberIds || []).length,
      memberEmails,
      puzzlesCompleted,
      totalScore,
      completionTimeSeconds,
      finalPuzzleTimestamp,
      isCompleted,
      isManualOverride,
      overrideReason: manualUnlock?.reason || qual?.overrideReason || '',
    };
  });

  // 4. Sort entries using configurable tie-break rules
  // Default order:
  // 1. Number of puzzles completed (DESC)
  // 2. Total score (DESC)
  // 3. Total completion time (ASC)
  // 4. Final puzzle completion timestamp (ASC)
  const compareEntries = (a, b) => {
    for (const rule of tieBreakRules) {
      if (rule === 'puzzlesCompleted') {
        if (b.puzzlesCompleted !== a.puzzlesCompleted) {
          return b.puzzlesCompleted - a.puzzlesCompleted;
        }
      } else if (rule === 'totalScore') {
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
      } else if (rule === 'completionTime') {
        // Lower completion time is better (ASC)
        // Teams with 0 puzzles / 0 time who didn't finish should be after completed ones
        const timeA = a.completionTimeSeconds || (a.puzzlesCompleted > 0 ? 999999 : 9999999);
        const timeB = b.completionTimeSeconds || (b.puzzlesCompleted > 0 ? 999999 : 9999999);
        if (timeA !== timeB) {
          return timeA - timeB;
        }
      } else if (rule === 'finalPuzzleTimestamp') {
        // Earlier timestamp is better (ASC)
        if (a.finalPuzzleTimestamp && b.finalPuzzleTimestamp) {
          const diff = new Date(a.finalPuzzleTimestamp).getTime() - new Date(b.finalPuzzleTimestamp).getTime();
          if (diff !== 0) return diff;
        } else if (a.finalPuzzleTimestamp && !b.finalPuzzleTimestamp) {
          return -1;
        } else if (!a.finalPuzzleTimestamp && b.finalPuzzleTimestamp) {
          return 1;
        }
      }
    }
    // Fallback alphabetical
    return a.teamName.localeCompare(b.teamName);
  };

  rawEntries.sort(compareEntries);

  // 5. Assign rank and qualification status
  let qualifiedCount = 0;
  const rankedEntries = rawEntries.map((entry, index) => {
    const rank = index + 1;
    // Team qualifies if rank <= qualifyingCount AND they have completed at least some puzzle / score > 0 OR have manual override
    const isTopRanked = rank <= qualifyingCount && (entry.puzzlesCompleted > 0 || entry.totalScore > 0);
    const isQualified = isTopRanked || entry.isManualOverride;

    if (isQualified) qualifiedCount++;

    return {
      ...entry,
      rank,
      isQualified,
      status: isQualified ? 'QUALIFIED' : 'ELIMINATED',
    };
  });

  return {
    roundNumber: roundNum,
    qualifyingCount,
    tieBreakRules,
    totalTeamsEvaluated: rankedEntries.length,
    totalQualifiedTeams: qualifiedCount,
    entries: rankedEntries,
    computedAt: new Date(),
  };
};

/**
 * Propagates qualification status to Teams and all team Member Users
 * All members of a qualifying team inherit qualification.
 * @param {number} roundNumber
 * @param {Array} rankedEntries
 */
export const propagateQualifications = async (roundNumber, rankedEntries) => {
  const roundNum = parseInt(roundNumber);
  const nextRoundNum = roundNum + 1;

  for (const entry of rankedEntries) {
    const teamId = entry.teamId;

    if (isDbConnected()) {
      try {
        const team = await Team.findById(teamId);
        if (team) {
          if (!team.qualifications) team.qualifications = [];
          let qual = team.qualifications.find((q) => q.roundNumber === roundNum);
          if (!qual) {
            qual = {
              roundNumber: roundNum,
              status: entry.isQualified ? 'QUALIFIED' : 'ELIMINATED',
              rank: entry.rank,
              score: entry.totalScore,
              puzzlesCompleted: entry.puzzlesCompleted,
              completionTimeSeconds: entry.completionTimeSeconds,
              qualifiedAt: entry.isQualified ? new Date() : null,
              isManualOverride: entry.isManualOverride || false,
              overrideReason: entry.overrideReason || '',
            };
            team.qualifications.push(qual);
          } else {
            qual.status = entry.isQualified ? 'QUALIFIED' : 'ELIMINATED';
            qual.rank = entry.rank;
            qual.score = entry.totalScore;
            qual.puzzlesCompleted = entry.puzzlesCompleted;
            qual.completionTimeSeconds = entry.completionTimeSeconds;
            if (entry.isQualified && !qual.qualifiedAt) qual.qualifiedAt = new Date();
            if (entry.isManualOverride) qual.isManualOverride = true;
          }

          await team.save();

          // Propagate qualification to ALL team members (inheritance)
          if (team.memberIds && team.memberIds.length > 0) {
            const memberIds = team.memberIds.map((m) => (m._id ? m._id : m));
            for (const memberId of memberIds) {
              const user = await User.findById(memberId);
              if (user) {
                if (!user.stats) user.stats = {};
                if (!user.stats.qualifiedRounds) user.stats.qualifiedRounds = [1];

                if (entry.isQualified) {
                  if (!user.stats.qualifiedRounds.includes(nextRoundNum) && nextRoundNum <= 4) {
                    user.stats.qualifiedRounds.push(nextRoundNum);
                  }
                  user.stats.eventStatus = 'QUALIFIED';
                  user.stats.currentRound = Math.max(user.stats.currentRound || 1, nextRoundNum);
                } else if (!user.stats.qualifiedRounds.includes(roundNum)) {
                  user.stats.eventStatus = 'ELIMINATED';
                }
                await user.save();
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[Propagation Error for Team ${teamId}]:`, err.message);
      }
    } else {
      // Memory Store propagation
      const mem = getMemoryStore();
      const team = (mem.teams || []).find((t) => String(t._id || t.id) === String(teamId));
      if (team) {
        if (!team.qualifications) team.qualifications = [];
        let qual = team.qualifications.find((q) => q.roundNumber === roundNum);
        if (!qual) {
          qual = {
            roundNumber: roundNum,
            status: entry.isQualified ? 'QUALIFIED' : 'ELIMINATED',
            rank: entry.rank,
            score: entry.totalScore,
            puzzlesCompleted: entry.puzzlesCompleted,
            completionTimeSeconds: entry.completionTimeSeconds,
            qualifiedAt: entry.isQualified ? new Date() : null,
            isManualOverride: entry.isManualOverride || false,
            overrideReason: entry.overrideReason || '',
          };
          team.qualifications.push(qual);
        } else {
          qual.status = entry.isQualified ? 'QUALIFIED' : 'ELIMINATED';
          qual.rank = entry.rank;
          qual.score = entry.totalScore;
          qual.puzzlesCompleted = entry.puzzlesCompleted;
          qual.completionTimeSeconds = entry.completionTimeSeconds;
          if (entry.isQualified && !qual.qualifiedAt) qual.qualifiedAt = new Date();
        }

        // Update members
        (team.memberIds || []).forEach((m) => {
          const mId = String(m._id || m.id || m);
          const u = (mem.users || []).find((usr) => String(usr._id || usr.id) === mId);
          if (u) {
            if (!u.stats) u.stats = {};
            if (!u.stats.qualifiedRounds) u.stats.qualifiedRounds = [1];
            if (entry.isQualified && !u.stats.qualifiedRounds.includes(nextRoundNum) && nextRoundNum <= 4) {
              u.stats.qualifiedRounds.push(nextRoundNum);
              u.stats.eventStatus = 'QUALIFIED';
            }
          }
        });
      }
    }
  }

  saveDiskBackup();
};

/**
 * Freeze the leaderboard for a round:
 * Saves the frozen snapshot to LeaderboardSnapshot and propagates qualifications.
 * Once frozen, qualification does NOT change automatically.
 */
export const freezeLeaderboard = async (roundNumber, adminUser, options = {}) => {
  const roundNum = parseInt(roundNumber) || 1;
  const computed = await computeRoundRankings(roundNum, options);

  const snapshotData = {
    roundNumber: roundNum,
    qualifyingCount: computed.qualifyingCount,
    tieBreakRules: computed.tieBreakRules,
    isFrozen: true,
    isPublished: options.isPublished !== undefined ? options.isPublished : true,
    frozenAt: new Date(),
    frozenBy: adminUser?.email || 'admin',
    entries: computed.entries,
    totalTeamsEvaluated: computed.totalTeamsEvaluated,
    totalQualifiedTeams: computed.totalQualifiedTeams,
  };

  let savedSnapshot = null;

  if (isDbConnected()) {
    try {
      savedSnapshot = await LeaderboardSnapshot.findOneAndUpdate(
        { roundNumber: roundNum },
        snapshotData,
        { upsert: true, new: true }
      );
    } catch (e) {
      console.warn('[LeaderboardSnapshot DB Save Error]:', e.message);
    }
  }

  if (!savedSnapshot) {
    const mem = getMemoryStore();
    if (!mem.leaderboardSnapshots) mem.leaderboardSnapshots = {};
    mem.leaderboardSnapshots[roundNum] = { _id: `mem_snap_${roundNum}`, ...snapshotData, updatedAt: new Date() };
    savedSnapshot = mem.leaderboardSnapshots[roundNum];
    saveDiskBackup();
  }

  // Propagate qualification to all teams and members
  await propagateQualifications(roundNum, computed.entries);

  // Synchronize global leaderboard settings for admin console status
  try {
    await setLeaderboardFreeze(true, adminUser?.email || 'admin');
    await setLeaderboardPublish(options.isPublished !== undefined ? options.isPublished : true, adminUser?.email || 'admin');
  } catch {}

  return savedSnapshot;
};

/**
 * Unfreeze the leaderboard to allow live dynamic updates again
 */
export const unfreezeLeaderboard = async (roundNumber, adminUser) => {
  const roundNum = parseInt(roundNumber) || 1;

  if (isDbConnected()) {
    try {
      const snap = await LeaderboardSnapshot.findOne({ roundNumber: roundNum });
      if (snap) {
        snap.isFrozen = false;
        snap.frozenAt = null;
        snap.frozenBy = null;
        await snap.save();
        return snap;
      }
    } catch (e) {}
  }

  try {
    await setLeaderboardFreeze(false, adminUser?.email || 'admin');
  } catch {}

  const mem = getMemoryStore();
  if (mem.leaderboardSnapshots && mem.leaderboardSnapshots[roundNum]) {
    mem.leaderboardSnapshots[roundNum].isFrozen = false;
    mem.leaderboardSnapshots[roundNum].frozenAt = null;
    mem.leaderboardSnapshots[roundNum].frozenBy = null;
    saveDiskBackup();
    return mem.leaderboardSnapshots[roundNum];
  }

  return { roundNumber: roundNum, isFrozen: false };
};

/**
 * Publish or unpublish leaderboard results
 */
export const setLeaderboardPublishState = async (roundNumber, isPublished, adminUser) => {
  const roundNum = parseInt(roundNumber) || 1;

  try {
    await setLeaderboardPublish(Boolean(isPublished), adminUser?.email || 'admin');
  } catch {}

  if (isDbConnected()) {
    try {
      let snap = await LeaderboardSnapshot.findOne({ roundNumber: roundNum });
      if (!snap) {
        // If no snapshot exists yet, compute and create one
        const computed = await computeRoundRankings(roundNum);
        snap = await LeaderboardSnapshot.create({
          roundNumber: roundNum,
          qualifyingCount: computed.qualifyingCount,
          tieBreakRules: computed.tieBreakRules,
          isFrozen: false,
          isPublished: Boolean(isPublished),
          publishedAt: isPublished ? new Date() : null,
          publishedBy: adminUser?.email || 'admin',
          entries: computed.entries,
          totalTeamsEvaluated: computed.totalTeamsEvaluated,
          totalQualifiedTeams: computed.totalQualifiedTeams,
        });
      } else {
        snap.isPublished = Boolean(isPublished);
        snap.publishedAt = isPublished ? new Date() : snap.publishedAt;
        snap.publishedBy = adminUser?.email || 'admin';
        await snap.save();
      }
      return snap;
    } catch (e) {}
  }

  const mem = getMemoryStore();
  if (!mem.leaderboardSnapshots) mem.leaderboardSnapshots = {};
  if (!mem.leaderboardSnapshots[roundNum]) {
    const computed = await computeRoundRankings(roundNum);
    mem.leaderboardSnapshots[roundNum] = {
      roundNumber: roundNum,
      qualifyingCount: computed.qualifyingCount,
      tieBreakRules: computed.tieBreakRules,
      isFrozen: false,
      isPublished: Boolean(isPublished),
      publishedAt: isPublished ? new Date() : null,
      publishedBy: adminUser?.email || 'admin',
      entries: computed.entries,
      totalTeamsEvaluated: computed.totalTeamsEvaluated,
      totalQualifiedTeams: computed.totalQualifiedTeams,
    };
  } else {
    mem.leaderboardSnapshots[roundNum].isPublished = Boolean(isPublished);
    mem.leaderboardSnapshots[roundNum].publishedAt = isPublished ? new Date() : mem.leaderboardSnapshots[roundNum].publishedAt;
    mem.leaderboardSnapshots[roundNum].publishedBy = adminUser?.email || 'admin';
  }
  saveDiskBackup();
  return mem.leaderboardSnapshots[roundNum];
};

/**
 * Fetch leaderboard snapshot (frozen snapshot if frozen/published, or live ranking if active and unpublished/unfrozen)
 */
export const getLeaderboardData = async (roundNumber = 1, options = {}) => {
  const roundNum = parseInt(roundNumber) || 1;

  // Check if there is an existing snapshot in DB or Memory
  let snapshot = null;
  if (isDbConnected()) {
    try {
      snapshot = await LeaderboardSnapshot.findOne({ roundNumber: roundNum });
    } catch (e) {}
  }

  if (!snapshot) {
    const mem = getMemoryStore();
    snapshot = mem.leaderboardSnapshots?.[roundNum] || null;
  }

  // If frozen, return the immutable snapshot
  if (snapshot && snapshot.isFrozen) {
    return {
      roundNumber: snapshot.roundNumber,
      isFrozen: true,
      isPublished: snapshot.isPublished,
      frozenAt: snapshot.frozenAt,
      publishedAt: snapshot.publishedAt,
      qualifyingCount: snapshot.qualifyingCount,
      tieBreakRules: snapshot.tieBreakRules,
      totalTeamsEvaluated: snapshot.totalTeamsEvaluated,
      totalQualifiedTeams: snapshot.totalQualifiedTeams,
      entries: snapshot.entries,
    };
  }

  // If not frozen, compute live rankings
  const live = await computeRoundRankings(roundNum, options);
  return {
    roundNumber: roundNum,
    isFrozen: false,
    isPublished: snapshot ? snapshot.isPublished : true,
    frozenAt: null,
    publishedAt: snapshot ? snapshot.publishedAt : new Date(),
    qualifyingCount: live.qualifyingCount,
    tieBreakRules: live.tieBreakRules,
    totalTeamsEvaluated: live.totalTeamsEvaluated,
    totalQualifiedTeams: live.totalQualifiedTeams,
    entries: live.entries,
  };
};

/**
 * Manually unlocks a round for a team (admin exception override)
 * @param {string} teamId
 * @param {number} roundNumber
 * @param {string} reason
 * @param {object} adminUser
 */
export const grantManualRoundUnlock = async (teamId, roundNumber, reason, adminUser) => {
  const roundNum = parseInt(roundNumber);

  if (isDbConnected()) {
    const team = await Team.findById(teamId);
    if (!team) throw new Error('Team not found');

    if (!team.manualRoundUnlocks) team.manualRoundUnlocks = [];
    const existingUnlock = team.manualRoundUnlocks.find((u) => u.roundNumber === roundNum);
    if (!existingUnlock) {
      team.manualRoundUnlocks.push({
        roundNumber: roundNum,
        unlockedAt: new Date(),
        unlockedBy: adminUser.email,
        reason: reason || 'Administrative exception override',
      });
    }

    if (!team.qualifications) team.qualifications = [];
    let qual = team.qualifications.find((q) => q.roundNumber === roundNum);
    if (!qual) {
      team.qualifications.push({
        roundNumber: roundNum,
        status: 'QUALIFIED',
        isManualOverride: true,
        overrideReason: reason || 'Administrative exception override',
        overrideBy: adminUser.email,
        qualifiedAt: new Date(),
      });
    } else {
      qual.status = 'QUALIFIED';
      qual.isManualOverride = true;
      qual.overrideReason = reason || 'Administrative exception override';
      qual.overrideBy = adminUser.email;
      qual.qualifiedAt = new Date();
    }

    await team.save();

    // Propagate to members
    if (team.memberIds && team.memberIds.length > 0) {
      for (const mId of team.memberIds) {
        const user = await User.findById(mId);
        if (user) {
          if (!user.stats) user.stats = {};
          if (!user.stats.qualifiedRounds) user.stats.qualifiedRounds = [1];
          if (!user.stats.qualifiedRounds.includes(roundNum)) {
            user.stats.qualifiedRounds.push(roundNum);
          }
          user.stats.eventStatus = 'QUALIFIED';
          await user.save();
        }
      }
    }

    return team;
  } else {
    const mem = getMemoryStore();
    const team = (mem.teams || []).find((t) => String(t._id || t.id) === String(teamId));
    if (!team) throw new Error('Team not found');

    if (!team.manualRoundUnlocks) team.manualRoundUnlocks = [];
    team.manualRoundUnlocks.push({
      roundNumber: roundNum,
      unlockedAt: new Date(),
      unlockedBy: adminUser.email,
      reason: reason || 'Administrative exception override',
    });

    if (!team.qualifications) team.qualifications = [];
    let qual = team.qualifications.find((q) => q.roundNumber === roundNum);
    if (!qual) {
      team.qualifications.push({
        roundNumber: roundNum,
        status: 'QUALIFIED',
        isManualOverride: true,
        overrideReason: reason || 'Administrative exception override',
        overrideBy: adminUser.email,
        qualifiedAt: new Date(),
      });
    } else {
      qual.status = 'QUALIFIED';
      qual.isManualOverride = true;
      qual.overrideReason = reason;
    }

    saveDiskBackup();
    return team;
  }
};

/**
 * Manually revokes/locks a round for a team (admin exception override)
 * @param {string} teamId
 * @param {number} roundNumber
 * @param {string} reason
 * @param {object} adminUser
 */
export const revokeManualRoundUnlock = async (teamId, roundNumber, reason, adminUser) => {
  const roundNum = parseInt(roundNumber);

  if (isDbConnected()) {
    const team = await Team.findById(teamId);
    if (!team) throw new Error('Team not found');

    if (team.manualRoundUnlocks) {
      team.manualRoundUnlocks = team.manualRoundUnlocks.filter((u) => u.roundNumber !== roundNum);
    }

    if (!team.qualifications) team.qualifications = [];
    let qual = team.qualifications.find((q) => q.roundNumber === roundNum);
    if (!qual) {
      team.qualifications.push({
        roundNumber: roundNum,
        status: 'ELIMINATED',
        isManualOverride: true,
        overrideReason: reason || 'Access revoked by administrator',
        overrideBy: adminUser.email,
        qualifiedAt: new Date(),
      });
    } else {
      qual.status = 'ELIMINATED';
      qual.isManualOverride = true;
      qual.overrideReason = reason || 'Access revoked by administrator';
      qual.overrideBy = adminUser.email;
    }

    await team.save();

    // Propagate to members
    if (team.memberIds && team.memberIds.length > 0) {
      for (const mId of team.memberIds) {
        const user = await User.findById(mId);
        if (user && user.stats?.qualifiedRounds) {
          user.stats.qualifiedRounds = user.stats.qualifiedRounds.filter((r) => r !== roundNum);
          await user.save();
        }
      }
    }

    return team;
  } else {
    const mem = getMemoryStore();
    const team = (mem.teams || []).find((t) => String(t._id || t.id) === String(teamId));
    if (!team) throw new Error('Team not found');

    if (team.manualRoundUnlocks) {
      team.manualRoundUnlocks = team.manualRoundUnlocks.filter((u) => u.roundNumber !== roundNum);
    }

    if (!team.qualifications) team.qualifications = [];
    let qual = team.qualifications.find((q) => q.roundNumber === roundNum);
    if (!qual) {
      team.qualifications.push({
        roundNumber: roundNum,
        status: 'ELIMINATED',
        isManualOverride: true,
        overrideReason: reason || 'Access revoked by administrator',
      });
    } else {
      qual.status = 'ELIMINATED';
      qual.isManualOverride = true;
      qual.overrideReason = reason;
    }

    saveDiskBackup();
    return team;
  }
};
