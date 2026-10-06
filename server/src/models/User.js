import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['participant', 'team_leader', 'admin', 'super_admin'],
      default: 'participant',
    },
    // Onboarding & Profile Details
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    profile: {
      fullName: {
        type: String,
        trim: true,
      },
      username: { type: String, trim: true, lowercase: true },
      registrationNumber: {
        type: String,
        trim: true,
      },
      rollNumber: {
        type: String,
        trim: true,
      },
      phoneNumber: {
        type: String,
        trim: true,
      },
      paymentStatus: {
        type: String,
        enum: ['PENDING', 'VERIFIED', 'NOT_REQUIRED'],
        default: 'NOT_REQUIRED',
      },
      paymentReference: {
        type: String,
        trim: true,
        default: '',
      },
    },
    // Team Association
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    teamName: {
      type: String,
      default: '',
    },
    // Stats & Progress
    stats: {
      totalScore: {
        type: Number,
        default: 0,
      },
      gamesAttempted: {
        type: Number,
        default: 0,
      },
      gamesCompleted: {
        type: Number,
        default: 0,
      },
      currentRound: {
        type: Number,
        default: 1,
      },
      qualifiedRounds: {
        type: [Number],
        default: [1], // Round 1 is open by default to all registered users
      },
      eventStatus: {
        type: String,
        enum: ['REGISTERED', 'ROUND_1_ACTIVE', 'QUALIFIED', 'ELIMINATED', 'DISQUALIFIED'],
        default: 'REGISTERED',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Prevent exposing sensitive schema internals in JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

export const User = mongoose.model('User', userSchema);
