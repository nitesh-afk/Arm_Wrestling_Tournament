import mongoose from 'mongoose';

const athleteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Athlete name is required'],
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  club: {
    type: String,
    default: 'Independent',
    trim: true,
  },
  country: {
    type: String,
    default: 'Nepal',
    trim: true,
  },
  armDominance: {
    type: String,
    enum: ['RIGHT', 'LEFT', 'BOTH'],
    default: 'RIGHT',
  },
  officialWeightKg: {
    type: Number,
    default: null,
  },
  isWeighedIn: {
    type: Boolean,
    default: false,
  },
  registeredCategories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Athlete = mongoose.model('Athlete', athleteSchema);
