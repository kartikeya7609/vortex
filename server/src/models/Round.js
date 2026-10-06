import mongoose from 'mongoose';

const roundSchema = new mongoose.Schema(
  {
    roundNumber: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
      max: 4,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    mechanicType: {
      type: String,
      enum: ['SEQUENTIAL_PUZZLE', 'MCQ_QUIZ', 'MEDIA_SUBMISSION', 'CODE_CHALLENGE'],
      required: true,
    },
    status: {
      type: String,
      enum: ['LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'ELIMINATED'],
      default: 'LOCKED',
    },
    durationSeconds: {
      type: Number,
      default: 1800, // 30 mins
    },
    minTeamSize: {
      type: Number,
      default: 2,
    },
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const Round = mongoose.model('Round', roundSchema);
