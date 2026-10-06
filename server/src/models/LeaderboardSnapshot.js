import mongoose from 'mongoose';

const leaderboardEntrySchema = new mongoose.Schema(
  {
    rank: { type: Number, required: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    teamName: { type: String, required: true },
    teamCode: { type: String, default: '' },
    memberCount: { type: Number, default: 0 },
    memberEmails: [String],
    puzzlesCompleted: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    completionTimeSeconds: { type: Number, default: 0 },
    finalPuzzleTimestamp: { type: Date, default: null },
    isQualified: { type: Boolean, default: false },
    isManualOverride: { type: Boolean, default: false },
    overrideReason: { type: String, default: '' },
    status: {
      type: String,
      enum: ['QUALIFIED', 'ELIMINATED', 'IN_PROGRESS', 'PENDING'],
      default: 'PENDING',
    },
  },
  { _id: false }
);

const leaderboardSnapshotSchema = new mongoose.Schema(
  {
    roundNumber: {
      type: Number,
      required: true,
      default: 1,
      index: true,
    },
    qualifyingCount: {
      type: Number,
      default: 50,
    },
    tieBreakRules: {
      type: [String],
      default: ['puzzlesCompleted', 'totalScore', 'completionTime', 'finalPuzzleTimestamp'],
    },
    isFrozen: {
      type: Boolean,
      default: false,
      index: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    frozenAt: {
      type: Date,
      default: null,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    frozenBy: {
      type: String,
      default: null,
    },
    publishedBy: {
      type: String,
      default: null,
    },
    entries: [leaderboardEntrySchema],
    totalTeamsEvaluated: {
      type: Number,
      default: 0,
    },
    totalQualifiedTeams: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const LeaderboardSnapshot = mongoose.model('LeaderboardSnapshot', leaderboardSnapshotSchema);
