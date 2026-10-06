import mongoose from 'mongoose';

const attemptLogSchema = new mongoose.Schema(
  {
    attemptNumber: { type: Number, required: true },
    puzzleId: { type: String, required: true },
    puzzleTitle: { type: String, default: '' },
    puzzleIndex: { type: Number, required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    submittedByEmail: { type: String, required: true },
    submittedAnswer: { type: String, default: '' },
    submittedPieceOrder: { type: [String], default: [] },
    isCorrect: { type: Boolean, required: true },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: Date.now },
    pointsAwarded: { type: Number, default: 0 },
    timeSpentSeconds: { type: Number, default: 0 },
  },
  { _id: false }
);

const gameSessionSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    teamName: {
      type: String,
      required: true,
    },
    roundNumber: {
      type: Number,
      default: 1,
      required: true,
      index: true,
    },
    startedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startedByEmail: {
      type: String,
      required: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    expiresAt: { type: Date, default: null, index: true },
    endTime: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'TIME_EXPIRED', 'ABORTED'],
      default: 'IN_PROGRESS',
      index: true,
    },
    currentPuzzleIndex: {
      type: Number,
      default: 0,
    },
    currentPuzzleId: {
      type: String,
      default: '',
    },
    puzzleIds: { type: [String], default: [] },
    score: {
      type: Number,
      default: 0,
    },
    completedPuzzleIds: [String],
    attempts: [attemptLogSchema],
    isCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

gameSessionSchema.index({ teamId: 1, roundNumber: 1 }, {
  unique: true,
  partialFilterExpression: { status: 'IN_PROGRESS' },
});

export const GameSession = mongoose.model('GameSession', gameSessionSchema);
