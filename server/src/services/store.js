import fs from 'fs';
import path from 'path';
import { User } from '../models/User.js';
import { Team } from '../models/Team.js';
import { Round } from '../models/Round.js';
import { Puzzle } from '../models/Puzzle.js';
import { LeaderboardSetting } from '../models/LeaderboardSetting.js';
import { AdminAuditLog } from '../models/AdminAuditLog.js';
import { GameSession } from '../models/GameSession.js';
import { processGridSections } from './imageProcessor.js';

const DATA_DIR = path.resolve('server', 'data');
const BACKUP_FILE = path.join(DATA_DIR, 'db_store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to build pre-seeded puzzle object
const buildSeedPuzzle = (id, title, description, imageUrl, solution, points, timeLimitSeconds, hint, displayOrder) => {
  const gridRows = 3;
  const gridCols = 3;
  const processedSections = processGridSections(imageUrl, gridRows, gridCols);
  return {
    _id: id,
    roundNumber: 1,
    title,
    description,
    imageUrl,
    gridRows,
    gridCols,
    processedSections,
    solution,
    points,
    timeLimitSeconds,
    hint,
    displayOrder,
    isPublished: false,
    puzzleStatus: 'DRAFT',
    isLockedForGame: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

// In-Memory & File-Backed Data Store Fallback
let memoryStore = {
  users: [],
  teams: [],
  rounds: [
    {
      _id: 'mem_r1',
      roundNumber: 1,
      title: 'Tile Puzzle',
      description: 'Sequential Image Puzzle challenge with dynamic grid slicing, piece tray drag/swap mechanics, and time-attack scoring.',
      mechanicType: 'SEQUENTIAL_PUZZLE',
      status: 'AVAILABLE',
      durationSeconds: 1800,
      minTeamSize: 2,
    },
    {
      _id: 'mem_r2',
      roundNumber: 2,
      title: 'Mystery Solver',
      description: 'Investigate crime scene evidence, CCTV logs, suspect statements, and decode encrypted clues to solve the mystery.',
      mechanicType: 'DETECTIVE_CASE',
      status: 'AVAILABLE',
      durationSeconds: 1800,
      minTeamSize: 2,
    },
  ],
  puzzles: [
    buildSeedPuzzle('mem_p1', 'Stark Tower Arc Reactor Blueprint', 'Reassemble the arc reactor schematic fragments into their precise geometric layout.', 'https://images.unsplash.com/photo-1635863138275-d9b33299680b?w=800', 'ARC-REACTOR-2026', 100, 300, 'Look for the glowing central energy core in tile 5.', 1),
    buildSeedPuzzle('mem_p2', 'Quantum Realm Sub-Atomic Matrix', 'Solve the sub-atomic matrix alignment to unlock the quantum portal entry keys.', 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800', 'QUANTUM-88-ALPHA', 120, 360, 'Align blue flux lines along the horizontal axis first.', 2),
    buildSeedPuzzle('mem_p3', 'Wakandan Vibranium Sonic Shield', 'Connect the sonic stabilization nodes to restore shield energy integrity.', 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800', 'VIBRANIUM-KEY-99', 140, 400, 'Check the peripheral purple nodes.', 3),
    buildSeedPuzzle('mem_p4', 'Mjolnir Asgardian Lightning Pattern', 'Align the electrical discharge vectors to harness Thor hammer power.', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800', 'MJOLNIR-THUNDER-77', 150, 420, 'Follow the central blue lightning arc.', 4),
    buildSeedPuzzle('mem_p5', 'Eye of Agamotto Temporal Grid', 'Reconstruct the mystic rune ring alignment to stabilize local timeline flux.', 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800', 'AGAMOTTO-TIME-GEM', 160, 450, 'Green temporal rings match outer corners.', 5),
    buildSeedPuzzle('mem_p6', 'S.H.I.E.L.D. Helicarrier Flight Matrix', 'Assemble navigation system coordinates for carrier takeoff alignment.', 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800', 'HELICARRIER-ALT-40', 180, 480, 'Rotor turbines are located on the left and right wings.', 6),
    buildSeedPuzzle('mem_p7', 'Nano-Tech Iron Mark-85 Armor', 'Calibrate nanite cell density across chest plate and repulsor nodes.', 'https://images.unsplash.com/photo-1563089145-599997674d42?w=800', 'MARK-85-SUIT', 200, 500, 'Chest unibeam goes directly in the center tile.', 7),
    buildSeedPuzzle('mem_p8', 'Web-Shooter Tensile Frequency', 'Synthesize high-tensile web formula lattice for maximum structural hold.', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800', 'SPIDER-WEB-LINE', 220, 520, 'Radial spider threads emanate from section 5.', 8),
    buildSeedPuzzle('mem_p9', 'Bifrost Bifurcated Portal Array', 'Synchronize rainbow bridge energy frequency for inter-dimensional transit.', 'https://images.unsplash.com/photo-1550684848-bac1c5b4e853?w=800', 'BIFROST-999-KEY', 240, 540, 'Prismatic light spectrum forms a vertical column.', 9),
    buildSeedPuzzle('mem_p10', 'Tesseract Cosmic Energy Node', 'Contain spatial cube energy fluctuations within containment field.', 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800', 'SPACE-STONE-BLUE', 250, 560, 'Bright blue cubic edges delineate outer bounds.', 10),
    buildSeedPuzzle('mem_p11', 'Kree Fleet Navigation Map', 'Map interstellar jump point coordinates through Andromeda galaxy cluster.', 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800', 'HALA-NAV-COMMAND', 280, 580, 'Star map constellation cluster centers in tile 2.', 11),
    buildSeedPuzzle('mem_p12', 'Infinity Gauntlet Snap Sequence', 'Position all 6 infinity stones in harmonic order to unleash full cosmic power.', 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?w=800', 'INFINITY-SNAP-2026', 300, 600, 'Mind stone rests atop the center knuckle.', 12),
  ],
  leaderboardSetting: {
    isFrozen: false,
    isPublished: true,
    frozenAt: null,
    publishedAt: new Date(),
    lastUpdatedBy: 'system',
  },
  auditLogs: [],
  gameSessions: [],
  adminWhitelist: [],
  faqs: [
    {
      _id: 'faq_1',
      question: 'What is AAROhan 2026?',
      answer: 'AAROhan 2026 is the premier annual multi-round technical and problem-solving competition organized by the IEEE Student Branch of NIT Durgapur.',
      category: 'General',
      displayOrder: 1,
      createdAt: new Date(),
    },
    {
      _id: 'faq_2',
      question: 'How do team formations and qualifications work?',
      answer: 'Teams consist of 2–3 members. The top 50 qualifying teams from Round 1 advance to Round 2. All registered members of a qualifying team inherit qualification automatically.',
      category: 'Teams & Qualification',
      displayOrder: 2,
      createdAt: new Date(),
    },
    {
      _id: 'faq_3',
      question: 'Who can submit puzzle answers in Round 1?',
      answer: 'Only the designated Team Leader can start the team session and submit puzzle answers. All team members can view progress in real-time.',
      category: 'Game Rules',
      displayOrder: 3,
      createdAt: new Date(),
    },
    {
      _id: 'faq_4',
      question: 'What are the tie-break criteria on the leaderboard?',
      answer: 'Teams are ranked by: 1. Number of Puzzles Completed (DESC), 2. Total Score (DESC), 3. Total Completion Time (ASC), 4. Final Puzzle Completion Timestamp (ASC).',
      category: 'Scoring',
      displayOrder: 4,
      createdAt: new Date(),
    },
  ],
};

// Initial administrator emails are deployment configuration, not source code.
export const DEFAULT_ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);

// Load backup file on startup if available
try {
  if (fs.existsSync(BACKUP_FILE)) {
    const raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.users) memoryStore.users = parsed.users;
    if (parsed.teams) memoryStore.teams = parsed.teams;
    if (parsed.auditLogs) memoryStore.auditLogs = parsed.auditLogs;
    if (parsed.adminWhitelist) memoryStore.adminWhitelist = parsed.adminWhitelist;
    if (parsed.faqs) memoryStore.faqs = parsed.faqs;
    if (parsed.rounds) memoryStore.rounds = parsed.rounds;
    console.log('[Resilient Store] Loaded persisted local data store from disk.');
  }
} catch (e) {
  console.warn('[Resilient Store] Failed to read disk backup:', e.message);
}

export const saveDiskBackup = () => {
  try {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(memoryStore, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Resilient Store] Failed to save disk backup:', e.message);
  }
};

export const getMemoryStore = () => memoryStore;

export const unpublishMalformedRoundOnePuzzles = async () => {
  if (isDbConnected()) {
    const candidates = await Puzzle.find({ roundNumber: 1, isPublished: true });
    for (const puzzle of candidates) {
      const pieces = puzzle.pieces || [];
      const order = [...pieces].sort((a, b) => a.originalIndex - b.originalIndex).map((piece) => piece.pieceId);
      const valid = pieces.length === puzzle.gridRows * puzzle.gridCols &&
        new Set(pieces.map((piece) => piece.pieceId)).size === pieces.length &&
        pieces.every((piece, index) => piece.imageUrl && piece.cloudinaryPublicId && piece.originalIndex === index) &&
        puzzle.correctOrder?.length === pieces.length && puzzle.correctOrder.every((pieceId, index) => pieceId === order[index]);
      if (!valid) {
        puzzle.isPublished = false;
        puzzle.puzzleStatus = 'DRAFT';
        await puzzle.save();
        console.warn(`[Puzzle Migration] Unpublished malformed legacy Round 1 puzzle ${puzzle._id}.`);
      }
    }
  }
  for (const puzzle of memoryStore.puzzles || []) {
    if (puzzle.roundNumber === 1 && puzzle.isPublished && (!puzzle.pieces?.length || puzzle.pieces.length !== puzzle.gridRows * puzzle.gridCols)) {
      puzzle.isPublished = false;
      puzzle.puzzleStatus = 'DRAFT';
    }
  }
};

export const isDbConnected = () => {
  return global.isMongoConnected === true;
};

// ==================== USER OPERATIONS ====================

export const findUserById = async (id) => {
  if (isDbConnected()) {
    try {
      const u = await User.findById(id);
      if (u) return u;
    } catch {}
  }
  return memoryStore.users.find((u) => String(u._id) === String(id)) || null;
};

export const findUserByGoogleIdOrEmail = async (googleId, email) => {
  if (isDbConnected()) {
    try {
      const u = await User.findOne({ $or: [{ googleId }, { email }] });
      if (u) return u;
    } catch {}
  }
  return memoryStore.users.find((u) => u.googleId === googleId || (email && u.email === email.toLowerCase())) || null;
};

export const createUser = async (userData) => {
  if (isDbConnected()) {
    try {
      return await User.create(userData);
    } catch (e) {
      console.warn('[DB Error] User create fallback to memory:', e.message);
      if (process.env.NODE_ENV === 'production') throw e;
    }
  }

  const newUser = {
    _id: `mem_u_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    googleId: userData.googleId,
    email: userData.email.toLowerCase(),
    name: userData.name,
    avatar: userData.avatar || '',
    role: userData.role || 'participant',
    isProfileComplete: userData.isProfileComplete || false,
    profile: userData.profile || { fullName: userData.name },
    teamId: null,
    teamName: '',
    stats: {
      totalScore: 0,
      gamesAttempted: 0,
      gamesCompleted: 0,
      currentRound: 1,
      eventStatus: 'REGISTERED',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  memoryStore.users.push(newUser);
  saveDiskBackup();
  return newUser;
};

export const updateUserProfile = async (userId, profileData) => {
  const user = await findUserById(userId);
  if (!user) return null;

  if (isDbConnected() && typeof user.save === 'function') {
    try {
      user.profile = { ...user.profile, ...profileData };
      user.isProfileComplete = true;
      user.name = profileData.fullName || user.name;
      await user.save();
      return user;
    } catch (error) { if (process.env.NODE_ENV === 'production') throw error; }
  }

  user.profile = { ...user.profile, ...profileData };
  user.isProfileComplete = true;
  user.name = profileData.fullName || user.name;
  user.updatedAt = new Date();
  saveDiskBackup();
  return user;
};

export const updateUserRole = async (userId, newRole) => {
  const user = await findUserById(userId);
  if (!user) return null;

  const oldRole = user.role;

  if (isDbConnected() && typeof user.save === 'function') {
    try {
      user.role = newRole;
      await user.save();
      // If user belongs to a team and is being set as team_leader, or being demoted from team_leader
      if (user.teamId) {
        const team = await Team.findById(user.teamId);
        if (team) {
          if (newRole === 'team_leader') {
            const oldLeaderId = team.leaderId;
            team.leaderId = user._id;
            await team.save();
            if (oldLeaderId && String(oldLeaderId) !== String(user._id)) {
              await User.findByIdAndUpdate(oldLeaderId, { role: 'participant' });
              const oldLeaderMem = memoryStore.users.find((u) => String(u._id) === String(oldLeaderId));
              if (oldLeaderMem) oldLeaderMem.role = 'participant';
            }
          } else if (oldRole === 'team_leader' && newRole !== 'team_leader' && String(team.leaderId) === String(user._id)) {
            // Find another member to assign as leader if available
            const otherMemberId = team.memberIds.find((mId) => String(mId) !== String(user._id));
            if (otherMemberId) {
              team.leaderId = otherMemberId;
              await team.save();
              await User.findByIdAndUpdate(otherMemberId, { role: 'team_leader' });
              const newLeaderMem = memoryStore.users.find((u) => String(u._id) === String(otherMemberId));
              if (newLeaderMem) newLeaderMem.role = 'team_leader';
            }
          }
        }
      }
      return user;
    } catch {}
  }

  // Memory store fallback logic
  user.role = newRole;
  user.updatedAt = new Date();

  if (user.teamId) {
    const memTeam = memoryStore.teams.find((t) => String(t._id) === String(user.teamId));
    if (memTeam) {
      if (newRole === 'team_leader') {
        const oldLeaderId = memTeam.leaderId;
        memTeam.leaderId = user._id;
        if (oldLeaderId && String(oldLeaderId) !== String(user._id)) {
          const oldLeaderMem = memoryStore.users.find((u) => String(u._id) === String(oldLeaderId));
          if (oldLeaderMem) oldLeaderMem.role = 'participant';
        }
      } else if (oldRole === 'team_leader' && newRole !== 'team_leader' && String(memTeam.leaderId) === String(user._id)) {
        const otherMemberId = memTeam.memberIds.find((mId) => String(mId) !== String(user._id));
        if (otherMemberId) {
          memTeam.leaderId = otherMemberId;
          const newLeaderMem = memoryStore.users.find((u) => String(u._id) === String(otherMemberId));
          if (newLeaderMem) newLeaderMem.role = 'team_leader';
        }
      }
    }
  }

  saveDiskBackup();
  return user;
};

export const toggleUserAccessBlock = async (userId, isBlocked, reason = '') => {
  const user = await findUserById(userId);
  if (!user) return null;

  user.isAccessBlocked = Boolean(isBlocked);
  user.blockReason = reason ? String(reason).trim() : '';

  if (isDbConnected() && typeof user.save === 'function') {
    try {
      await user.save();
      return user;
    } catch (e) {
      console.error('[Store] Failed to toggle user access block:', e.message);
    }
  }

  saveDiskBackup();
  return user;
};

export const toggleTeamDisqualification = async (teamId, isDisqualified, reason = '') => {
  const team = await findTeamById(teamId);
  if (!team) return null;

  team.isDisqualified = Boolean(isDisqualified);
  team.disqualificationReason = reason ? String(reason).trim() : '';

  if (isDbConnected() && typeof team.save === 'function') {
    try {
      await team.save();
      return team;
    } catch (e) {
      console.error('[Store] Failed to toggle team disqualification:', e.message);
    }
  }

  saveDiskBackup();
  return team;
};

export const getAllUsers = async () => {
  if (isDbConnected()) {
    try { return await User.find().select('-__v').sort({ createdAt: -1 }); } catch {}
  }
  return memoryStore.users;
};

// ==================== TEAM OPERATIONS ====================

export const findTeamById = async (id) => {
  if (isDbConnected()) {
    try {
      const t = await Team.findById(id).populate('leaderId memberIds', 'name email avatar role profile stats');
      if (t) return t;
    } catch {}
  }

  const t = memoryStore.teams.find((tm) => String(tm._id) === String(id));
  if (!t) return null;

  const leaderObj = memoryStore.users.find((u) => String(u._id) === String(t.leaderId)) || { _id: t.leaderId, name: 'Leader' };
  const membersObj = t.memberIds.map((mid) => memoryStore.users.find((u) => String(u._id) === String(mid)) || { _id: mid, name: 'Member' });
  return { ...t, leaderId: leaderObj, memberIds: membersObj };
};

export const findTeamByCode = async (code) => {
  if (!code || !code.trim()) return null;
  let cleanInput = code.trim().toUpperCase();

  // If user enters 4-character code without prefix e.g. "9042", auto-format to "ARH-9042"
  if (!cleanInput.startsWith('ARH-') && cleanInput.length === 4) {
    cleanInput = `ARH-${cleanInput}`;
  }

  const escapeRegex = cleanInput.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const codeRegex = new RegExp(`^${escapeRegex}$`, 'i');

  if (isDbConnected()) {
    try {
      const t = await Team.findOne({
        $or: [{ code: codeRegex }, { code: new RegExp(cleanInput.replace('ARH-', ''), 'i') }],
      }).populate('leaderId memberIds', 'name email avatar role profile');
      if (t) return t;
    } catch {}
  }

  const t = memoryStore.teams.find(
    (tm) => tm.code && (tm.code.toUpperCase() === cleanInput || tm.code.toUpperCase().endsWith(cleanInput.replace('ARH-', '')))
  );
  if (!t) return null;

  const leaderObj = memoryStore.users.find((u) => String(u._id) === String(t.leaderId)) || { _id: t.leaderId, name: 'Leader' };
  const membersObj = (t.memberIds || []).map((mid) => memoryStore.users.find((u) => String(u._id) === String(mid)) || { _id: mid, name: 'Member' });
  return { ...t, leaderId: leaderObj, memberIds: membersObj };
};

export const findTeamByName = async (name) => {
  const normalizedName = name.trim();
  if (isDbConnected()) {
    try {
      const t = await Team.findOne({ name: normalizedName });
      if (t) return t;
    } catch {}
  }

  return memoryStore.teams.find((tm) => tm.name.toLowerCase() === normalizedName.toLowerCase()) || null;
};

export const createTeam = async (teamData, leaderUser) => {
  const leaderId = leaderUser._id || leaderUser.id;
  const fullPayload = {
    name: teamData.name,
    code: teamData.code,
    leaderId: leaderId,
    memberIds: [leaderId],
    maxSize: Math.min(Math.max(parseInt(teamData.maxSize) || 3, 1), 3),
    minSizeRequired: 2,
    qualifications: [
      { roundNumber: 1, status: 'QUALIFIED', score: 0, qualifiedAt: new Date() },
      { roundNumber: 2, status: 'PENDING', score: 0 },
      { roundNumber: 3, status: 'PENDING', score: 0 },
      { roundNumber: 4, status: 'PENDING', score: 0 },
    ],
  };

  if (isDbConnected()) {
    try {
      const newTeam = await Team.create(fullPayload);
      const newRole = leaderUser.role === 'admin' || leaderUser.role === 'super_admin' ? leaderUser.role : 'team_leader';
      await User.findByIdAndUpdate(leaderId, {
        teamId: newTeam._id,
        teamName: newTeam.name,
        role: newRole,
      });

      leaderUser.teamId = newTeam._id;
      leaderUser.teamName = newTeam.name;
      leaderUser.role = newRole;

      const memTeam = { ...newTeam.toObject(), _id: newTeam._id };
      memoryStore.teams.push(memTeam);
      saveDiskBackup();

      return newTeam;
    } catch (err) {
      console.error('[createTeam DB Error]:', err.message);
      if (process.env.NODE_ENV === 'production') throw err;
    }
  }

  const newTeam = {
    _id: `mem_t_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    ...fullPayload,
    allowAdminBypass: false,
    isDisqualified: false,
    disqualificationReason: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  memoryStore.teams.push(newTeam);
  leaderUser.teamId = newTeam._id;
  leaderUser.teamName = newTeam.name;
  if (leaderUser.role !== 'admin' && leaderUser.role !== 'super_admin') {
    leaderUser.role = 'team_leader';
  }

  saveDiskBackup();
  return newTeam;
};

export const joinTeam = async (teamId, userObj) => {
  if (userObj.teamId) throw new Error('You are already a member of a team.');

  if (isDbConnected()) {
    const dbTeam = await Team.findOneAndUpdate(
      { _id: teamId, memberIds: { $ne: userObj._id }, $expr: { $lt: [{ $size: '$memberIds' }, { $min: [{ $ifNull: ['$maxSize', 3] }, 3] }] } },
      { $addToSet: { memberIds: userObj._id } }, { new: true }
    );
    if (!dbTeam) throw new Error('Team is full, not found, or unavailable to join.');
    const updatedUser = await User.findOneAndUpdate(
      { _id: userObj._id, teamId: null }, { $set: { teamId: dbTeam._id, teamName: dbTeam.name } }, { new: true }
    );
    if (!updatedUser) {
      await Team.updateOne({ _id: dbTeam._id }, { $pull: { memberIds: userObj._id } });
      throw new Error('You are already a member of a team.');
    }
    return dbTeam;
  }

  const team = memoryStore.teams.find((t) => String(t._id) === String(teamId));
  if (!team) throw new Error('Team not found.');
  if ((team.memberIds || []).length >= Math.min(team.maxSize || 3, 3)) throw new Error('Team is full.');
  if (team) {
    if (!team.memberIds.some((id) => String(id) === String(userObj._id))) {
      team.memberIds.push(userObj._id);
    }
    userObj.teamId = team._id;
    userObj.teamName = team.name;
    saveDiskBackup();
    return team;
  }
  return null;
};

export const leaveTeam = async (userObj) => {
  if (!userObj.teamId) return;

  const teamId = userObj.teamId;
  userObj.teamId = null;
  userObj.teamName = '';
  if (userObj.role === 'team_leader') userObj.role = 'participant';

  if (isDbConnected()) {
    try {
      const dbTeam = await Team.findById(teamId);
      if (dbTeam) {
        dbTeam.memberIds = dbTeam.memberIds.filter((id) => String(id) !== String(userObj._id));
        if (dbTeam.memberIds.length === 0) {
          await Team.findByIdAndDelete(dbTeam._id);
        } else if (String(dbTeam.leaderId) === String(userObj._id)) {
          dbTeam.leaderId = dbTeam.memberIds[0];
          await dbTeam.save();
          await User.findByIdAndUpdate(dbTeam.leaderId, { role: 'team_leader' });
        } else {
          await dbTeam.save();
        }
      }
      await User.findByIdAndUpdate(userObj._id, { teamId: null, teamName: '', role: userObj.role });
    } catch {}
  }

  const team = memoryStore.teams.find((t) => String(t._id) === String(teamId));
  if (team) {
    team.memberIds = team.memberIds.filter((id) => String(id) !== String(userObj._id));
    if (team.memberIds.length === 0) {
      memoryStore.teams = memoryStore.teams.filter((t) => String(t._id) !== String(teamId));
    } else if (String(team.leaderId) === String(userObj._id)) {
      team.leaderId = team.memberIds[0];
      const newLeader = memoryStore.users.find((u) => String(u._id) === String(team.leaderId));
      if (newLeader && newLeader.role !== 'admin' && newLeader.role !== 'super_admin') {
        newLeader.role = 'team_leader';
      }
    }
    saveDiskBackup();
  }
};

export const getAllTeams = async () => {
  if (isDbConnected()) {
    try { return await Team.find().populate('leaderId memberIds', 'name email avatar role profile').sort({ createdAt: -1 }); } catch {}
  }
  return memoryStore.teams.map((t) => {
    const leaderObj = memoryStore.users.find((u) => String(u._id) === String(t.leaderId)) || { _id: t.leaderId, name: 'Leader' };
    const membersObj = t.memberIds.map((mid) => memoryStore.users.find((u) => String(u._id) === String(mid)) || { _id: mid, name: 'Member' });
    return { ...t, leaderId: leaderObj, memberIds: membersObj };
  });
};

// ==================== ROUND OPERATIONS ====================

export const getAllRounds = async () => {
  if (isDbConnected()) {
    try {
      // Clean any legacy rounds > 2
      await Round.deleteMany({ roundNumber: { $gt: 2 } });

      // Update or seed Round 1 with title "Tile Puzzle"
      await Round.findOneAndUpdate(
        { roundNumber: 1 },
        { title: 'Tile Puzzle', mechanicType: 'SEQUENTIAL_PUZZLE' },
        { upsert: true, new: true }
      );

      // Update or seed Round 2 with title "Mystery Solver"
      await Round.findOneAndUpdate(
        { roundNumber: 2 },
        { title: 'Mystery Solver', mechanicType: 'DETECTIVE_CASE' },
        { upsert: true, new: true }
      );

      const dbRounds = await Round.find({ roundNumber: { $lte: 2 } }).sort({ roundNumber: 1 });
      if (dbRounds && dbRounds.length > 0) return dbRounds;
    } catch {}
  }

  return memoryStore.rounds.filter((r) => r.roundNumber <= 2);
};

export const getRoundByNumber = async (roundNumber) => {
  const num = parseInt(roundNumber);
  if (isDbConnected()) {
    try {
      let found = await Round.findOne({ roundNumber: num });
      if (found) return found;
      // Fallback to memoryStore and seed DB if missing
      const memRound = memoryStore.rounds.find((r) => r.roundNumber === num);
      if (memRound) {
        try {
          found = await Round.create(memRound);
          return found;
        } catch {
          return memRound;
        }
      }
    } catch {}
  }
  return memoryStore.rounds.find((r) => r.roundNumber === num) || null;
};

export const updateRoundStatus = async (roundNumber, status) => {
  const num = parseInt(roundNumber);
  let round = await getRoundByNumber(num);
  if (!round) return null;

  if (typeof round.toObject === 'function') {
    round.status = status;
  } else {
    round.status = status;
  }

  if (isDbConnected()) {
    try {
      const updated = await Round.findOneAndUpdate(
        { roundNumber: num },
        { $set: { status } },
        { upsert: true, new: true }
      );
      if (updated) round = updated;
    } catch (e) {
      console.warn('[updateRoundStatus DB Warning]:', e.message);
    }
  }

  const memIndex = memoryStore.rounds.findIndex((r) => r.roundNumber === num);
  if (memIndex !== -1) {
    memoryStore.rounds[memIndex].status = status;
  } else {
    memoryStore.rounds.push({
      _id: `mem_r${num}`,
      roundNumber: num,
      title: `Round ${num}`,
      description: '',
      mechanicType: 'SEQUENTIAL_PUZZLE',
      status,
      durationSeconds: 1800,
      minTeamSize: 2,
    });
  }
  saveDiskBackup();
  return round;
};

export const updateRoundConfig = async (roundNumber, configData) => {
  const num = parseInt(roundNumber);
  let round = await getRoundByNumber(num);

  const updateFields = {};
  if (configData.title !== undefined) updateFields.title = configData.title;
  if (configData.description !== undefined) updateFields.description = configData.description;
  if (configData.durationSeconds !== undefined) updateFields.durationSeconds = parseInt(configData.durationSeconds);
  if (configData.minTeamSize !== undefined) updateFields.minTeamSize = parseInt(configData.minTeamSize);
  if (configData.status !== undefined) updateFields.status = configData.status;
  if (configData.mechanicType !== undefined) updateFields.mechanicType = configData.mechanicType;

  if (isDbConnected()) {
    try {
      const updated = await Round.findOneAndUpdate(
        { roundNumber: num },
        { $set: updateFields, $setOnInsert: { roundNumber: num } },
        { upsert: true, new: true }
      );
      if (updated) round = updated;
    } catch (e) {
      console.warn('[updateRoundConfig DB Warning]:', e.message);
    }
  }

  if (!round) {
    round = { roundNumber: num, ...updateFields };
  } else {
    Object.assign(round, updateFields);
  }

  const memIndex = memoryStore.rounds.findIndex((r) => r.roundNumber === num);
  if (memIndex !== -1) {
    Object.assign(memoryStore.rounds[memIndex], updateFields);
  } else {
    memoryStore.rounds.push({ _id: `mem_r${num}`, roundNumber: num, ...updateFields });
  }
  saveDiskBackup();
  return round;
};

export const createRound = async (roundData) => {
  const roundNumber = parseInt(roundData.roundNumber) || (memoryStore.rounds.length + 1);
  const newRound = {
    _id: `round_${roundNumber}_${Date.now()}`,
    roundNumber,
    title: roundData.title || `Round ${roundNumber}`,
    description: roundData.description || '',
    mechanicType: roundData.mechanicType || 'SEQUENTIAL_PUZZLE',
    status: roundData.status || 'LOCKED',
    durationSeconds: parseInt(roundData.durationSeconds) || 1800,
    minTeamSize: parseInt(roundData.minTeamSize) || 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (isDbConnected()) {
    try {
      return await Round.create(newRound);
    } catch {}
  }

  if (!memoryStore.rounds) memoryStore.rounds = [];
  memoryStore.rounds.push(newRound);
  memoryStore.rounds.sort((a, b) => a.roundNumber - b.roundNumber);
  saveDiskBackup();
  return newRound;
};

export const deleteRound = async (roundNumber) => {
  const num = parseInt(roundNumber);
  if (isDbConnected()) {
    try {
      await Round.deleteOne({ roundNumber: num });
    } catch {}
  }

  if (!memoryStore.rounds) memoryStore.rounds = [];
  memoryStore.rounds = memoryStore.rounds.filter((r) => r.roundNumber !== num);
  saveDiskBackup();
  return true;
};

// ==================== ADMIN WHITELIST OPERATIONS ====================

export const getAdminWhitelist = async () => {
  if (!memoryStore.adminWhitelist) {
    memoryStore.adminWhitelist = [...DEFAULT_ADMIN_EMAILS];
  }
  return Array.from(new Set([...DEFAULT_ADMIN_EMAILS, ...memoryStore.adminWhitelist]));
};

export const isAdminEmail = (email) => {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  if (DEFAULT_ADMIN_EMAILS.includes(normalized)) return true;
  const list = memoryStore.adminWhitelist || [];
  return list.map((e) => e.toLowerCase().trim()).includes(normalized);
};

export const addAdminWhitelistEmail = async (email) => {
  if (!email) throw new Error('Email is required');
  const normalized = email.toLowerCase().trim();
  if (!memoryStore.adminWhitelist) memoryStore.adminWhitelist = [...DEFAULT_ADMIN_EMAILS];

  if (!memoryStore.adminWhitelist.includes(normalized)) {
    memoryStore.adminWhitelist.push(normalized);
  }

  // Update existing user role if already registered
  const user = memoryStore.users.find((u) => u.email.toLowerCase() === normalized);
  if (user) {
    user.role = 'super_admin';
  }

  if (isDbConnected()) {
    try {
      await User.findOneAndUpdate({ email: normalized }, { role: 'super_admin' });
    } catch {}
  }

  saveDiskBackup();
  return memoryStore.adminWhitelist;
};

export const removeAdminWhitelistEmail = async (email) => {
  const normalized = email.toLowerCase().trim();
  if (DEFAULT_ADMIN_EMAILS.includes(normalized)) {
    throw new Error('Default system super-admin email cannot be removed.');
  }

  if (!memoryStore.adminWhitelist) memoryStore.adminWhitelist = [...DEFAULT_ADMIN_EMAILS];
  memoryStore.adminWhitelist = memoryStore.adminWhitelist.filter((e) => e.toLowerCase() !== normalized);

  const user = memoryStore.users.find((u) => u.email.toLowerCase() === normalized);
  if (user) {
    user.role = 'participant';
  }

  if (isDbConnected()) {
    try {
      await User.findOneAndUpdate({ email: normalized }, { role: 'participant' });
    } catch {}
  }

  saveDiskBackup();
  return memoryStore.adminWhitelist;
};

// ==================== FAQ / HELP & SUPPORT OPERATIONS ====================

export const getAllFAQs = async () => {
  if (!memoryStore.faqs) {
    memoryStore.faqs = [];
  }
  return memoryStore.faqs.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
};

export const createFAQ = async (faqData) => {
  const newFAQ = {
    _id: `faq_${Date.now()}`,
    question: faqData.question,
    answer: faqData.answer,
    category: faqData.category || 'General',
    displayOrder: parseInt(faqData.displayOrder) || (memoryStore.faqs?.length || 0) + 1,
    createdAt: new Date(),
  };

  if (!memoryStore.faqs) memoryStore.faqs = [];
  memoryStore.faqs.push(newFAQ);
  saveDiskBackup();
  return newFAQ;
};

export const updateFAQ = async (id, data) => {
  if (!memoryStore.faqs) memoryStore.faqs = [];
  const faq = memoryStore.faqs.find((f) => String(f._id) === String(id));
  if (!faq) return null;

  if (data.question !== undefined) faq.question = data.question;
  if (data.answer !== undefined) faq.answer = data.answer;
  if (data.category !== undefined) faq.category = data.category;
  if (data.displayOrder !== undefined) faq.displayOrder = parseInt(data.displayOrder);

  saveDiskBackup();
  return faq;
};

export const deleteFAQ = async (id) => {
  if (!memoryStore.faqs) memoryStore.faqs = [];
  memoryStore.faqs = memoryStore.faqs.filter((f) => String(f._id) !== String(id));
  saveDiskBackup();
  return true;
};

// ==================== PUZZLE OPERATIONS ====================

export const getAllPuzzles = async (roundNumber = null) => {
  if (isDbConnected()) {
    try {
      const filter = roundNumber ? { roundNumber: parseInt(roundNumber) } : {};
      return await Puzzle.find(filter).sort({ roundNumber: 1, displayOrder: 1, createdAt: 1 });
    } catch {}
  }
  if (!memoryStore.puzzles) memoryStore.puzzles = [];
  let result = memoryStore.puzzles;
  if (roundNumber) {
    result = result.filter((p) => p.roundNumber === parseInt(roundNumber));
  }
  return result.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
};

export const getPuzzleById = async (id) => {
  if (isDbConnected()) {
    try { return await Puzzle.findById(id); } catch {}
  }
  return memoryStore.puzzles.find((p) => String(p._id) === String(id)) || null;
};

export const createPuzzle = async (puzzleData) => {
  const gridRows = parseInt(puzzleData.gridRows) || 3;
  const gridCols = parseInt(puzzleData.gridCols) || 3;
  const imageUrl = puzzleData.imageUrl || 'https://images.unsplash.com/photo-1635863138275-d9b33299680b?w=800';
  const pieces = puzzleData.pieces || [];
  const processedSections = puzzleData.processedSections || (pieces.length
    ? pieces.map((piece) => ({ sectionIndex: piece.originalIndex, row: piece.row, col: piece.column, imageUrl: piece.imageUrl }))
    : processGridSections(imageUrl, gridRows, gridCols));

  const payload = {
    ...puzzleData,
    gridRows,
    gridCols,
    imageUrl,
    processedSections,
    pieces,
    correctOrder: puzzleData.correctOrder || pieces.slice().sort((a, b) => a.originalIndex - b.originalIndex).map((p) => p.pieceId),
    puzzleCode: puzzleData.puzzleCode,
    originalPublicId: puzzleData.originalPublicId || '',
    solution: puzzleData.solution || puzzleData.puzzleCode || 'GRID_MATCH',
    puzzleStatus: pieces.length ? 'READY' : 'DRAFT',
    isLockedForGame: Boolean(puzzleData.isLockedForGame),
  };

  if (isDbConnected()) {
    try {
      return await Puzzle.create(payload);
    } catch (e) {
      console.warn('[DB Error] Puzzle create fallback to memory:', e.message);
      if (process.env.NODE_ENV === 'production') throw e;
    }
  }

  const newPuzzle = {
    _id: `mem_p_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    roundNumber: parseInt(puzzleData.roundNumber) || 1,
    title: puzzleData.title,
    description: puzzleData.description || '',
    imageUrl,
    gridRows,
    gridCols,
    processedSections,
    pieces,
    correctOrder: payload.correctOrder,
    puzzleCode: puzzleData.puzzleCode || `PZL-${Date.now()}`,
    originalPublicId: puzzleData.originalPublicId || '',
    puzzleStatus: pieces.length ? 'READY' : 'DRAFT',
    solution: puzzleData.solution,
    points: parseInt(puzzleData.points) || 100,
    timeLimitSeconds: parseInt(puzzleData.timeLimitSeconds) || 300,
    hint: puzzleData.hint || '',
    displayOrder: parseInt(puzzleData.displayOrder) || (memoryStore.puzzles.length + 1),
    isPublished: puzzleData.isPublished !== undefined ? Boolean(puzzleData.isPublished) : true,
    isLockedForGame: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (!memoryStore.puzzles) memoryStore.puzzles = [];
  memoryStore.puzzles.push(newPuzzle);
  saveDiskBackup();
  return newPuzzle;
};

export const updatePuzzle = async (id, updateData, allowLockedOverride = false) => {
  const puzzle = await getPuzzleById(id);
  if (!puzzle) return null;

  const activeSession = isDbConnected()
    ? await GameSession.findOne({ roundNumber: puzzle.roundNumber, status: 'IN_PROGRESS', $or: [{ currentPuzzleId: String(id) }, { puzzleIds: String(id) }] })
    : (memoryStore.gameSessions || []).find((session) => session.roundNumber === puzzle.roundNumber && session.status === 'IN_PROGRESS' && (session.currentPuzzleId === String(id) || session.puzzleIds?.includes(String(id))));
  if (activeSession) throw new Error('Puzzle configuration is locked while a team is playing this round.');

  // Immutability Guard: Published puzzles locked during active game
  if (puzzle.isLockedForGame && !allowLockedOverride) {
    throw new Error('Puzzle is locked during an active game session. Perform a controlled reset or set override flag to edit.');
  }

  const mutableFields = ['title', 'description', 'points', 'timeLimitSeconds', 'hint', 'solution'];
  const safeUpdates = Object.fromEntries(mutableFields.filter((key) => updateData[key] !== undefined).map((key) => [key, updateData[key]]));
  if (puzzle.pieces?.length && ['imageUrl', 'gridRows', 'gridCols', 'pieces', 'correctOrder', 'puzzleCode', 'originalPublicId'].some((key) => updateData[key] !== undefined)) {
    throw new Error('Generated image pieces and their IDs are immutable. Generate a new puzzle to change its source image or grid.');
  }
  const gridRows = parseInt(puzzle.gridRows || 3);
  const gridCols = parseInt(puzzle.gridCols || 3);
  const imageUrl = puzzle.imageUrl;

  // Re-generate grid sections if image or grid parameters change
  if (isDbConnected() && typeof puzzle.save === 'function') {
    try {
      Object.assign(puzzle, safeUpdates);
      await puzzle.save();
      return puzzle;
    } catch (error) { if (process.env.NODE_ENV === 'production') throw error; }
  }

  Object.assign(puzzle, safeUpdates, { updatedAt: new Date() });
  saveDiskBackup();
  return puzzle;
};

export const deletePuzzle = async (id) => {
  const puzzle = await getPuzzleById(id);
  if (!puzzle) return null;

  if (isDbConnected()) {
    const activeSession = await GameSession.findOne({ roundNumber: puzzle.roundNumber, status: 'IN_PROGRESS', $or: [{ currentPuzzleId: String(id) }, { puzzleIds: String(id) }] });
    if (activeSession) throw new Error('Puzzle cannot be deleted while a team is playing this round.');
  } else if ((memoryStore.gameSessions || []).some((session) => session.roundNumber === puzzle.roundNumber && session.status === 'IN_PROGRESS' && (session.currentPuzzleId === String(id) || session.puzzleIds?.includes(String(id))))) {
    throw new Error('Puzzle cannot be deleted while a team is playing this round.');
  }

  if (isDbConnected()) {
    try {
      await Puzzle.findByIdAndDelete(id);
    } catch (error) { if (process.env.NODE_ENV === 'production') throw error; }
  }

  memoryStore.puzzles = memoryStore.puzzles.filter((p) => String(p._id) !== String(id));
  saveDiskBackup();
  return puzzle;
};

export const reorderPuzzles = async (puzzleOrders) => {
  // puzzleOrders = [{ id: 'p1', displayOrder: 1 }, { id: 'p2', displayOrder: 2 }]
  const updatedList = [];
  for (const item of puzzleOrders) {
    const p = await getPuzzleById(item.id || item._id);
    if (p) {
      if (isDbConnected() && typeof p.save === 'function') {
        try {
          p.displayOrder = item.displayOrder;
          await p.save();
        } catch (error) { if (process.env.NODE_ENV === 'production') throw error; }
      } else {
        p.displayOrder = item.displayOrder;
      }
      updatedList.push(p);
    }
  }
  saveDiskBackup();
  return updatedList;
};

export const togglePuzzlePublish = async (id, isPublished) => {
  const puzzle = await getPuzzleById(id);
  const orderedPieces = [...(puzzle?.pieces || [])].sort((a, b) => a.originalIndex - b.originalIndex);
  const expectedOrder = orderedPieces.map((p) => p.pieceId);
  if (isPublished && (!puzzle?.imageUrl || !puzzle?.originalPublicId || !puzzle?.pieces?.length || puzzle.pieces.length !== puzzle.gridRows * puzzle.gridCols ||
      puzzle.pieces.some((p, index) => !p.pieceId || !p.imageUrl || !p.cloudinaryPublicId || p.originalIndex !== index || p.row !== Math.floor(index / puzzle.gridCols) || p.column !== index % puzzle.gridCols) ||
      puzzle.correctOrder?.length !== puzzle.pieces.length || new Set(puzzle.pieces.map((p) => p.pieceId)).size !== puzzle.pieces.length ||
      puzzle.correctOrder.some((id, index) => id !== expectedOrder[index]))) {
    throw new Error('Puzzle cannot be published until all generated pieces and their order are valid.');
  }
  const updated = await updatePuzzle(id, { title: puzzle.title });
  if (!updated) return null;
  updated.isPublished = Boolean(isPublished);
  updated.puzzleStatus = isPublished ? 'PUBLISHED' : 'READY';
  if (isDbConnected() && typeof updated.save === 'function') {
    try { await updated.save(); } catch (error) { if (process.env.NODE_ENV === 'production') throw error; }
  } else {
    updated.updatedAt = new Date();
    saveDiskBackup();
  }
  return updated;
};

// ==================== SESSION RESET & SCORE ADJUSTMENT ====================

export const resetTeamSession = async (teamId) => {
  const team = await findTeamById(teamId);
  if (!team) return null;

  const previousState = {
    qualifications: team.qualifications ? JSON.parse(JSON.stringify(team.qualifications)) : [],
  };

  // Reset active game state flags
  if (team.qualifications) {
    team.qualifications = team.qualifications.map((q) => ({
      ...q,
      score: q.status === 'QUALIFIED' ? q.score : 0,
    }));
  }

  // Remove active game sessions for team
  if (isDbConnected()) {
    try {
      await GameSession.deleteMany({ teamId: team._id });
    } catch {}
  }

  if (memoryStore.gameSessions) {
    memoryStore.gameSessions = memoryStore.gameSessions.filter((s) => String(s.teamId) !== String(teamId));
  }

  if (isDbConnected() && typeof team.save === 'function') {
    try {
      await team.save();
    } catch {}
  }

  saveDiskBackup();
  return { team, previousState, newState: { qualifications: team.qualifications } };
};

// ==================== ROUND 1 SEQUENTIAL GAME SESSION OPERATIONS ====================

const teamGameLocks = new Map();
const withTeamGameLock = async (teamId, operation) => {
  const key = String(teamId);
  const previous = teamGameLocks.get(key) || Promise.resolve();
  let unlock;
  const current = new Promise((resolve) => { unlock = resolve; });
  teamGameLocks.set(key, current);
  await previous;
  try { return await operation(); }
  finally {
    unlock();
    if (teamGameLocks.get(key) === current) teamGameLocks.delete(key);
  }
};

const updateTeamMemberStats = async (team, { score = 0, completed = false, qualifiedRound = null } = {}) => {
  const memberIds = (team.memberIds || []).map((member) => member?._id || member).filter(Boolean);
  if (isDbConnected()) {
    const update = { $inc: {} };
    if (score) update.$inc['stats.totalScore'] = score;
    if (completed) update.$inc['stats.gamesCompleted'] = 1;
    if (qualifiedRound) update.$addToSet = { 'stats.qualifiedRounds': qualifiedRound };
    if (qualifiedRound) update.$set = { 'stats.eventStatus': 'QUALIFIED' };
    if (Object.keys(update.$inc).length || update.$addToSet) {
      await User.updateMany({ _id: { $in: memberIds } }, update);
    }
  }
  for (const memberId of memberIds) {
    const member = memoryStore.users.find((u) => String(u._id) === String(memberId));
    if (!member) continue;
    member.stats = member.stats || {};
    member.stats.totalScore = (member.stats.totalScore || 0) + score;
    if (completed) member.stats.gamesCompleted = (member.stats.gamesCompleted || 0) + 1;
    if (qualifiedRound) {
      member.stats.qualifiedRounds = Array.from(new Set([...(member.stats.qualifiedRounds || []), qualifiedRound]));
      member.stats.eventStatus = 'QUALIFIED';
    }
  }
};

export const findActiveGameSession = async (teamId, roundNumber = 1) => {
  if (isDbConnected()) {
    try {
      const session = await GameSession.findOne({
        teamId,
        roundNumber: parseInt(roundNumber),
        status: { $in: ['IN_PROGRESS', 'TIME_EXPIRED', 'EXPIRED', 'COMPLETED'] },
      });
      if (session) return session;
    } catch {}
  }
  if (!memoryStore.gameSessions) memoryStore.gameSessions = [];
  return (
    memoryStore.gameSessions.find(
      (s) => String(s.teamId) === String(teamId) && s.roundNumber === parseInt(roundNumber) && ['IN_PROGRESS', 'TIME_EXPIRED', 'EXPIRED', 'COMPLETED'].includes(s.status)
    ) || null
  );
};

export const expireDueRound1Sessions = async () => {
  const now = new Date();
  let modifiedCount = 0;
  if (isDbConnected()) {
    const result = await GameSession.updateMany(
      { roundNumber: 1, status: 'IN_PROGRESS', expiresAt: { $lte: now } },
      { $set: { status: 'TIME_EXPIRED', endTime: now } },
    );
    modifiedCount += result.modifiedCount || 0;
  }
  for (const session of memoryStore.gameSessions || []) {
    if (session.roundNumber === 1 && session.status === 'IN_PROGRESS' && session.expiresAt && new Date(session.expiresAt) <= now) {
      session.status = 'TIME_EXPIRED';
      session.endTime = now;
      modifiedCount += 1;
    }
  }
  if (modifiedCount) saveDiskBackup();
  return modifiedCount;
};

const startTeamGameSessionImpl = async (teamId, leaderUser, roundNumber = 1) => {
  const team = await findTeamById(teamId);
  if (!team) throw new Error('Associated team record not found.');

  const isLeader = String(team.leaderId?._id || team.leaderId) === String(leaderUser._id);

  if (!isLeader) {
    const error = new Error('ONLY_LEADER_CAN_START: Only the Team Leader can start Round 1.');
    error.code = 'ONLY_LEADER_CAN_START';
    throw error;
  }

  let activeSession = await findActiveGameSession(teamId, roundNumber);
  if (activeSession) {
    if (activeSession.status !== 'IN_PROGRESS') throw new Error('This team has already used its game session for this round.');
    return activeSession;
  }

  const publishedPuzzles = await getAllPuzzles(roundNumber);
  const activePuzzles = publishedPuzzles.filter((p) => p.isPublished !== false);
  if (activePuzzles.length === 0) {
    throw new Error('No published puzzles available for Round 1 yet. Please notify event administrators.');
  }
  if (parseInt(roundNumber) === 1 && activePuzzles.some((p) => !p.pieces?.length || p.pieces.length !== p.gridRows * p.gridCols || p.correctOrder?.length !== p.pieces.length)) {
    throw new Error('Round 1 contains a puzzle without valid generated pieces. Correct it in the admin panel before starting.');
  }

  const firstPuzzle = activePuzzles[0];

  const startedAt = new Date();
  const configuredRound = await getRoundByNumber(roundNumber);
  const sessionData = {
    teamId: team._id,
    teamName: team.name,
    roundNumber: parseInt(roundNumber),
    startedBy: leaderUser._id,
    startedByEmail: leaderUser.email,
    startTime: startedAt,
    expiresAt: new Date(startedAt.getTime() + Math.max(60, configuredRound?.durationSeconds || 1800) * 1000),
    status: 'IN_PROGRESS',
    currentPuzzleIndex: 0,
    currentPuzzleId: String(firstPuzzle._id),
    puzzleIds: activePuzzles.map((puzzle) => String(puzzle._id)),
    score: 0,
    completedPuzzleIds: [],
    attempts: [],
    isCompleted: false,
  };

  if (isDbConnected()) {
    try {
      const created = await GameSession.create(sessionData);
      await User.updateMany({ _id: { $in: team.memberIds.map((member) => member?._id || member) } }, { $inc: { 'stats.gamesAttempted': 1 } });
      return created;
    } catch (e) {
      if (e.code === 11000) {
        const racedSession = await findActiveGameSession(teamId, roundNumber);
        if (racedSession) return racedSession;
      }
      console.warn('[DB Error] GameSession create fallback to memory:', e.message);
      if (process.env.NODE_ENV === 'production') throw e;
    }
  }

  const newSession = {
    _id: `mem_session_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    ...sessionData,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (!memoryStore.gameSessions) memoryStore.gameSessions = [];
  memoryStore.gameSessions.push(newSession);
  for (const memberId of team.memberIds || []) {
    const member = memoryStore.users.find((u) => String(u._id) === String(memberId?._id || memberId));
    if (member) {
      member.stats = member.stats || {};
      member.stats.gamesAttempted = (member.stats.gamesAttempted || 0) + 1;
    }
  }
  saveDiskBackup();
  return newSession;
};

export const startTeamGameSession = (teamId, leaderUser, roundNumber = 1) =>
  withTeamGameLock(teamId, () => startTeamGameSessionImpl(teamId, leaderUser, roundNumber));

const submitTeamGameAttemptImpl = async (teamId, userObj, submittedAnswer, timeSpentSeconds = 0, roundNumber = 1) => {
  const team = await findTeamById(teamId);
  if (!team) throw new Error('Associated team record not found.');

  const isLeader = String(team.leaderId?._id || team.leaderId) === String(userObj._id);

  if (!isLeader) {
    const error = new Error('ONLY_LEADER_CAN_SUBMIT: Only the Team Leader can submit puzzle answers.');
    error.code = 'ONLY_LEADER_CAN_SUBMIT';
    throw error;
  }

  const session = await findActiveGameSession(teamId, roundNumber);
  if (!session) {
    throw new Error('No active game session found for your team. Please start Round 1 first.');
  }

  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    session.status = 'TIME_EXPIRED';
    session.endTime = new Date();
    if (typeof session.save === 'function') await session.save();
    saveDiskBackup();
    const error = new Error('The team game session has expired.');
    error.code = 'SESSION_EXPIRED';
    throw error;
  }

  const activePuzzles = (session.puzzleIds?.length
    ? await Promise.all(session.puzzleIds.map((puzzleId) => getPuzzleById(puzzleId)))
    : (await getAllPuzzles(roundNumber)).filter((p) => p.isPublished !== false).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
  ).filter(Boolean);

  if (activePuzzles.length === 0) {
    throw new Error('No published puzzles available.');
  }

  if (session.currentPuzzleIndex >= activePuzzles.length) {
    throw new Error('All Round 1 puzzles have already been completed by your team.');
  }

  const currentPuzzle = await getPuzzleById(session.currentPuzzleId) || activePuzzles[session.currentPuzzleIndex];
  if (String(session.currentPuzzleId) !== String(currentPuzzle._id)) {
    const error = new Error('The active puzzle state changed. Reload the game and try again.');
    error.code = 'STALE_PUZZLE';
    throw error;
  }
  const expected = currentPuzzle.correctOrder || [];
  const validIds = new Set((currentPuzzle.pieces || []).map((piece) => piece.pieceId));
  if (!Array.isArray(submittedAnswer) || !submittedAnswer.length || submittedAnswer.length !== expected.length ||
      submittedAnswer.some((id) => typeof id !== 'string' || !validIds.has(id)) ||
      new Set(submittedAnswer).size !== submittedAnswer.length || expected.some((id) => !submittedAnswer.includes(id))) {
    const error = new Error('The submitted piece list is invalid. Include every puzzle piece exactly once.');
    error.code = 'INVALID_PIECE_ORDER';
    throw error;
  }
  const isCorrect = submittedAnswer.every((id, index) => id === expected[index]);

  const attemptLog = {
    attemptNumber: (session.attempts ? session.attempts.length : 0) + 1,
    puzzleId: String(currentPuzzle._id),
    puzzleTitle: currentPuzzle.title,
    puzzleIndex: session.currentPuzzleIndex,
    submittedBy: userObj._id,
    submittedByEmail: userObj.email,
    submittedAnswer: '',
    submittedPieceOrder: submittedAnswer,
    isCorrect,
    startedAt: session.updatedAt || session.startTime,
    submittedAt: new Date(),
    pointsAwarded: isCorrect ? currentPuzzle.points || 100 : 0,
    timeSpentSeconds: Math.max(0, Math.floor((Date.now() - new Date(session.startTime).getTime()) / 1000)),
  };

  if (!session.attempts) session.attempts = [];
  session.attempts.push(attemptLog);

  let isRoundCompleted = false;
  let nextPuzzleUnlocked = false;

  if (isCorrect) {
    session.score = (session.score || 0) + (currentPuzzle.points || 100);
    if (!session.completedPuzzleIds) session.completedPuzzleIds = [];
    session.completedPuzzleIds.push(String(currentPuzzle._id));

    session.currentPuzzleIndex += 1;

    if (session.currentPuzzleIndex >= activePuzzles.length) {
      session.status = 'COMPLETED';
      session.isCompleted = true;
      session.endTime = new Date();
      isRoundCompleted = true;

      if (!team.qualifications) team.qualifications = [];
      let qual = team.qualifications.find((q) => q.roundNumber === parseInt(roundNumber));
      if (!qual) {
        qual = { roundNumber: parseInt(roundNumber), status: 'COMPLETED', score: session.score, puzzlesCompleted: activePuzzles.length, completedAt: new Date() };
        team.qualifications.push(qual);
      } else {
        qual.status = qual.status === 'QUALIFIED' ? 'QUALIFIED' : 'COMPLETED';
        qual.score = session.score;
        qual.puzzlesCompleted = activePuzzles.length;
        qual.completedAt = new Date();
      }
    } else {
      session.currentPuzzleId = String(activePuzzles[session.currentPuzzleIndex]._id);
      nextPuzzleUnlocked = true;
    }
  }

  if (isDbConnected() && typeof session.save === 'function') {
    try {
      await session.save();
      if (typeof team.save === 'function') await team.save();
    } catch (error) { if (process.env.NODE_ENV === 'production') throw error; }
  }
  if (isCorrect) await updateTeamMemberStats(team, {
    score: attemptLog.pointsAwarded,
    completed: isRoundCompleted,
    qualifiedRound: isRoundCompleted ? parseInt(roundNumber) : null,
  });

  saveDiskBackup();

  return {
    session,
    isCorrect,
    pointsAwarded: attemptLog.pointsAwarded,
    isRoundCompleted,
    nextPuzzleUnlocked,
    currentPuzzleIndex: session.currentPuzzleIndex,
    totalPuzzles: activePuzzles.length,
    nextPuzzle: !isRoundCompleted && session.currentPuzzleIndex < activePuzzles.length
      ? {
          id: activePuzzles[session.currentPuzzleIndex]._id,
          roundNumber: activePuzzles[session.currentPuzzleIndex].roundNumber,
          title: activePuzzles[session.currentPuzzleIndex].title,
          description: activePuzzles[session.currentPuzzleIndex].description,
          imageUrl: activePuzzles[session.currentPuzzleIndex].imageUrl,
          gridRows: activePuzzles[session.currentPuzzleIndex].gridRows || 3,
          gridCols: activePuzzles[session.currentPuzzleIndex].gridCols || 3,
          points: activePuzzles[session.currentPuzzleIndex].points,
          timeLimitSeconds: activePuzzles[session.currentPuzzleIndex].timeLimitSeconds,
          hint: activePuzzles[session.currentPuzzleIndex].hint,
          processedSections: activePuzzles[session.currentPuzzleIndex].processedSections,
        }
      : null,
  };
};

export const submitTeamGameAttempt = (teamId, userObj, pieceOrder, timeSpentSeconds = 0, roundNumber = 1) =>
  withTeamGameLock(teamId, () => submitTeamGameAttemptImpl(teamId, userObj, pieceOrder, timeSpentSeconds, roundNumber));

export const adjustTeamScore = async (teamId, roundNumber, scoreDelta, reason) => {
  const team = await findTeamById(teamId);
  if (!team) return null;

  if (!team.qualifications) team.qualifications = [];
  let qual = team.qualifications.find((q) => q.roundNumber === parseInt(roundNumber));
  if (!qual) {
    qual = { roundNumber: parseInt(roundNumber), status: 'PENDING', score: 0 };
    team.qualifications.push(qual);
  }

  const previousScore = qual.score || 0;
  const newScore = Math.max(0, previousScore + parseInt(scoreDelta));
  qual.score = newScore;

  if (isDbConnected() && typeof team.save === 'function') {
    try {
      await team.save();
    } catch {}
  }

  saveDiskBackup();
  return { team, previousScore, newScore, reason };
};

// ==================== LEADERBOARD CONTROL ====================

export const getLeaderboardStatus = async () => {
  if (isDbConnected()) {
    try {
      let setting = await LeaderboardSetting.findOne();
      if (!setting) {
        setting = await LeaderboardSetting.create({
          isFrozen: false,
          isPublished: true,
          frozenAt: null,
          publishedAt: new Date(),
        });
      }
      return setting;
    } catch {}
  }
  if (!memoryStore.leaderboardSetting) {
    memoryStore.leaderboardSetting = { isFrozen: false, isPublished: true, frozenAt: null, publishedAt: new Date() };
  }
  return memoryStore.leaderboardSetting;
};

export const setLeaderboardFreeze = async (isFrozen, adminEmail = 'admin') => {
  let setting = await getLeaderboardStatus();
  const previousState = { isFrozen: setting.isFrozen, frozenAt: setting.frozenAt };

  const updatedData = {
    isFrozen: Boolean(isFrozen),
    frozenAt: isFrozen ? new Date() : null,
    lastUpdatedBy: adminEmail,
  };

  if (isDbConnected()) {
    try {
      const updated = await LeaderboardSetting.findOneAndUpdate({}, updatedData, { upsert: true, new: true });
      if (updated) setting = updated;
    } catch {}
  }

  if (memoryStore.leaderboardSetting) {
    Object.assign(memoryStore.leaderboardSetting, updatedData);
    saveDiskBackup();
  }
  return { setting, previousState, newState: updatedData };
};

export const setLeaderboardPublish = async (isPublished, adminEmail = 'admin') => {
  let setting = await getLeaderboardStatus();
  const previousState = { isPublished: setting.isPublished, publishedAt: setting.publishedAt };

  const updatedData = {
    isPublished: Boolean(isPublished),
    publishedAt: isPublished ? new Date() : null,
    lastUpdatedBy: adminEmail,
  };

  if (isDbConnected()) {
    try {
      const updated = await LeaderboardSetting.findOneAndUpdate({}, updatedData, { upsert: true, new: true });
      if (updated) setting = updated;
    } catch {}
  }

  if (memoryStore.leaderboardSetting) {
    Object.assign(memoryStore.leaderboardSetting, updatedData);
    saveDiskBackup();
  }
  return { setting, previousState, newState: updatedData };
};

// ==================== AUDIT LOG OPERATIONS ====================

export const logAdminAudit = async (adminUser, action, targetType, targetId, targetName, previousValue = null, newValue = null, req = null) => {
  const logObj = {
    adminId: adminUser._id,
    adminEmail: adminUser.email,
    action,
    targetType,
    targetId: String(targetId || ''),
    targetName: targetName || '',
    previousValue: previousValue !== null ? previousValue : null,
    newValue: newValue !== null ? newValue : null,
    changes: { before: previousValue, after: newValue },
    ipAddress: req ? (req.ip || req.headers['x-forwarded-for'] || '') : '',
    createdAt: new Date(),
  };

  if (isDbConnected()) {
    try { await AdminAuditLog.create(logObj); } catch (e) { console.warn('[Audit Log Error]:', e.message); }
  }

  if (!memoryStore.auditLogs) memoryStore.auditLogs = [];
  memoryStore.auditLogs.unshift({ _id: `mem_audit_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, ...logObj });
  saveDiskBackup();
};

export const getAuditLogs = async () => {
  if (isDbConnected()) {
    try { return await AdminAuditLog.find().sort({ createdAt: -1 }).limit(100); } catch {}
  }
  return memoryStore.auditLogs || [];
};
