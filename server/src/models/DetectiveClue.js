import mongoose from 'mongoose';

const detectiveClueSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'DetectiveCase', required: true },
    order: { type: Number, required: true, default: 1 },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    evidence: { type: String, default: '' }, // text, image URL, or document snippet
    evidenceType: { type: String, enum: ['text', 'image', 'document'], default: 'text' },
    classification: { type: String, enum: ['supporting', 'neutral', 'misleading', 'critical'], default: 'supporting' },
  },
  { timestamps: true }
);

export const DetectiveClue = mongoose.models.DetectiveClue || mongoose.model('DetectiveClue', detectiveClueSchema);
