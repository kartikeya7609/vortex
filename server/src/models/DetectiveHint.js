import mongoose from 'mongoose';

const detectiveHintSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'DetectiveCase', required: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DetectiveQuestion', default: null },
    order: { type: Number, default: 1 },
    hintText: { type: String, required: true, trim: true },
    penalty: { type: Number, default: 20 },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const DetectiveHint = mongoose.models.DetectiveHint || mongoose.model('DetectiveHint', detectiveHintSchema);
