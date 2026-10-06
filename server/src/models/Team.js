import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true, // 6-character unique team code e.g. ARH-904
    },
    leaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    memberIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    maxSize: {
      type: Number,
      default: 3, // Configurable team size, default 3
      min: 1,
      max: 3,
    },
    minSizeRequired: {
      type: Number,
      default: 2, // Required team size to start games
      min: 1,
    },
    allowAdminBypass: {
      type: Boolean,
      default: false, // Admin exception flag to bypass min team size check
    },
    qualifications: [
      {
        roundNumber: { type: Number, required: true },
        status: {
          type: String,
          enum: ['QUALIFIED', 'ELIMINATED', 'PENDING'],
          default: 'PENDING',
        },
        rank: { type: Number },
        score: { type: Number, default: 0 },
        puzzlesCompleted: { type: Number, default: 0 },
        completionTimeSeconds: { type: Number, default: 0 },
        qualifiedAt: { type: Date },
        isManualOverride: { type: Boolean, default: false },
        overrideReason: { type: String, default: '' },
        overrideBy: { type: String, default: '' },
      },
    ],
    manualRoundUnlocks: [
      {
        roundNumber: { type: Number, required: true },
        unlockedAt: { type: Date, default: Date.now },
        unlockedBy: { type: String, default: '' },
        reason: { type: String, default: '' },
      },
    ],
    isDisqualified: {
      type: Boolean,
      default: false,
    },
    disqualificationReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const Team = mongoose.model('Team', teamSchema);
