import mongoose from 'mongoose';

const detectiveAttemptSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'DetectiveCase', required: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    participantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    currentQuestionIndex: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    hintsUsed: [{ type: String }], // hint IDs or indices used
    answersSubmitted: [
      {
        questionId: String,
        selectedOptionIndex: Number,
        isCorrect: Boolean,
        pointsAwarded: Number,
        answeredAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ['NOT_STARTED', 'CASE_STARTED', 'IN_PROGRESS', 'COMPLETED', 'TIME_EXPIRED'],
      default: 'IN_PROGRESS',
    },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const DetectiveAttempt = mongoose.models.DetectiveAttempt || mongoose.model('DetectiveAttempt', detectiveAttemptSchema);
