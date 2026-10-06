import mongoose from 'mongoose';
import crypto from 'crypto';

const processedSectionSchema = new mongoose.Schema(
  {
    sectionIndex: { type: Number, required: true },
    row: { type: Number, required: true },
    col: { type: Number, required: true },
    imageUrl: { type: String, required: true },
  },
  { _id: false }
);

const puzzlePieceSchema = new mongoose.Schema({
  pieceId: { type: String, required: true },
  originalIndex: { type: Number, required: true },
  row: { type: Number, required: true },
  column: { type: Number, required: true },
  imageUrl: { type: String, required: true },
  cloudinaryPublicId: { type: String, required: true },
}, { _id: false });

const puzzleSchema = new mongoose.Schema(
  {
    puzzleCode: { type: String, unique: true, sparse: true, index: true },
    originalPublicId: { type: String, default: '' },
    correctOrder: { type: [String], default: [] },
    puzzleStatus: { type: String, enum: ['DRAFT', 'READY', 'PUBLISHED'], default: 'DRAFT', index: true },
    pieces: { type: [puzzlePieceSchema], default: [] },
    roundNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
      index: true,
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    imageUrl: {
      type: String,
      default: 'https://images.unsplash.com/photo-1635863138275-d9b33299680b?w=800',
    },
    gridRows: {
      type: Number,
      default: 3,
      min: 2,
      max: 8,
    },
    gridCols: {
      type: Number,
      default: 3,
      min: 2,
      max: 8,
    },
    processedSections: [processedSectionSchema],
    solution: {
      type: String,
      required: false,
      default: 'GRID_MATCH',
      trim: true,
    },
    points: {
      type: Number,
      default: 100,
      min: 0,
    },
    timeLimitSeconds: {
      type: Number,
      default: 300,
    },
    hint: {
      type: String,
      default: '',
    },
    displayOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    isLockedForGame: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

puzzleSchema.pre('validate', function () {
  if (!this.puzzleCode) this.puzzleCode = `PZL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  if (this.pieces?.length && !this.correctOrder?.length) {
    this.correctOrder = [...this.pieces].sort((a, b) => a.originalIndex - b.originalIndex).map((piece) => piece.pieceId);
  }
  if (this.pieces?.length && this.processedSections?.length === 0) {
    this.processedSections = this.pieces.map((piece) => ({
      sectionIndex: piece.originalIndex, row: piece.row, col: piece.column, imageUrl: piece.imageUrl,
    }));
  }
});

// Strip answer solution data when serializing for non-admin viewers
puzzleSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.solution;
  delete obj.__v;
  return obj;
};

export const Puzzle = mongoose.model('Puzzle', puzzleSchema);
