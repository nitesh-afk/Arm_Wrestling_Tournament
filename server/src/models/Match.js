import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  bracketType: {
    type: String,
    enum: ['WINNERS_BRACKET', 'LOSERS_BRACKET', 'GRAND_FINALS', 'GRAND_FINALS_RESET'],
    required: true,
  },
  roundNumber: { type: Number, required: true },
  matchIndex: { type: Number, required: true },
  athleteA: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete', default: null },
  athleteB: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete', default: null },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete', default: null },
  loser: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete', default: null },
  nextWinnerMatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', default: null },
  nextLoserMatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', default: null },
  assignedTable: { type: Number, default: null },
  status: {
    type: String,
    enum: ['WAITING', 'CALLED', 'ON_TABLE', 'COMPLETED', 'BYE'],
    default: 'WAITING',
  },
  callTime: { type: Date, default: null },
  scoringData: {
    athleteAFouls: { type: Number, default: 0 },
    athleteBFouls: { type: Number, default: 0 },
    athleteAWarnings: { type: Number, default: 0 },
    athleteBWarnings: { type: Number, default: 0 },
    wentToStraps: { type: Boolean, default: false },
    winMethod: { type: String, enum: ['PIN', 'FOULS', 'FORFEIT', 'DISQUALIFICATION', null], default: null },
  },
  completedAt: { type: Date, default: null },
});

export const Match = mongoose.model('Match', matchSchema);
