import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
  name: { type: String, required: true, trim: true },
  arm: { type: String, enum: ['RIGHT', 'LEFT'], required: true },
  weightClassLimitKg: { type: Number, required: true },
  bracketStatus: {
    type: String,
    enum: ['DRAFT', 'GENERATED', 'IN_PROGRESS', 'FINALIZED'],
    default: 'DRAFT',
  },
  athletes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Athlete' }],
  matches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Match' }],
  podium: {
    gold: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete', default: null },
    silver: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete', default: null },
    bronze: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete', default: null },
    fourth: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete', default: null },
  },
  createdAt: { type: Date, default: Date.now },
});

export const Category = mongoose.model('Category', categorySchema);
