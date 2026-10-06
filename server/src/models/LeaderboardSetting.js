import mongoose from 'mongoose';

const leaderboardSettingSchema = new mongoose.Schema(
  {
    isFrozen: {
      type: Boolean,
      default: false,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    frozenAt: {
      type: Date,
      default: null,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    lastUpdatedBy: {
      type: String,
      default: 'system',
    },
  },
  {
    timestamps: true,
  }
);

export const LeaderboardSetting = mongoose.model('LeaderboardSetting', leaderboardSettingSchema);
