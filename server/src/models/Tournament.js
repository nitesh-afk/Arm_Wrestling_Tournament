import mongoose from 'mongoose';

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  venue: { type: String, required: true, trim: true },
  eventDate: { type: Date, required: true },
  tablesCount: { type: Number, default: 2, min: 1 },
  status: {
    type: String,
    enum: ['REGISTRATION', 'WEIGH_IN', 'IN_PROGRESS', 'COMPLETED'],
    default: 'REGISTRATION',
  },
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

export const Tournament = mongoose.model('Tournament', tournamentSchema);
