import mongoose from 'mongoose';

const detectiveQuestionSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'DetectiveCase', required: true },
    clueId: { type: mongoose.Schema.Types.ObjectId, ref: 'DetectiveClue', default: null },
    order: { type: Number, required: true, default: 1 },
    question: { type: String, required: true, trim: true },
    options: { type: [String], required: true }, // e.g. ["Aman", "Rahul", "Arjun", "Karthik"]
    correctAnswerIndex: { type: Number, required: true }, // 0-indexed integer representing correct option (stored ONLY on backend)
    points: { type: Number, default: 100 },
  },
  { timestamps: true }
);

export const DetectiveQuestion = mongoose.models.DetectiveQuestion || mongoose.model('DetectiveQuestion', detectiveQuestionSchema);
