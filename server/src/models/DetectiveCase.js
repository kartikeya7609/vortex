import mongoose from 'mongoose';

const detectiveCaseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard', 'Expert', 'Novice', 'Detective', 'Inspector', 'Mastermind'], default: 'Medium' },
    timeLimitSeconds: { type: Number, default: 1800 }, // 30 mins
    maximumScore: { type: Number, default: 500 },
    status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'UNPUBLISHED'], default: 'DRAFT' },
    suspects: [{ name: String, role: String, statement: String }],
  },
  { timestamps: true }
);

export const DetectiveCase = mongoose.models.DetectiveCase || mongoose.model('DetectiveCase', detectiveCaseSchema);
