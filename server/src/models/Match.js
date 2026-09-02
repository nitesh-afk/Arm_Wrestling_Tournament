import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true,
    index: true,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true,
  },
  bracketType: {
    type: String,
    enum: [
      'WINNERS_BRACKET',
      'LOSERS_BRACKET',
      'GRAND_FINALS',
      'GRAND_FINALS_RESET',
    ],
    required: true,
  },
  roundNumber: {
    type: Number,
    required: true,
  },
  matchIndex: {
    type: Number,
    required: true,
  },
  athleteA: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Athlete',
    default: null,
  },
  athleteB: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Athlete',
    default: null,
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Athlete',
    default: null,
  },
  loser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Athlete',
    default: null,
  },
  nextWinnerMatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    default: null,
  },
  nextLoserMatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    default: null,
  },
  assignedTable: {
    type: Number,
    default: null,
  },
  status: {
    type: String,
    enum: ['WAITING', 'CALLED', 'ON_TABLE', 'COMPLETED', 'BYE'],
    default: 'WAITING',
  },
  callTime: {
    type: Date,
    default: null,
  },
  startedAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  scoringData: {
    athleteAFouls: { type: Number, default: 0 },
    athleteBFouls: { type: Number, default: 0 },
    athleteAWarnings: { type: Number, default: 0 },
    athleteBWarnings: { type: Number, default: 0 },
    wentToStraps: { type: Boolean, default: false },
    inRefereesGrip: { type: Boolean, default: false },
    winMethod: {
      type: String,
      enum: ['PIN', 'FOULS', 'FORFEIT', 'DISQUALIFICATION', 'BYE', null],
      default: null,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for high-speed multi-table staging queues
matchSchema.index({ tournamentId: 1, assignedTable: 1, status: 1 });

export const Match = mongoose.model('Match', matchSchema);
