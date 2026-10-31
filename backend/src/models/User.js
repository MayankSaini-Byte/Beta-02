/**
 * User model - account, household profile, preferences and app state.
 */
const { Schema } = require('mongoose');

const MemberSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    type: { type: String, enum: ['adult', 'child'], default: 'adult' },
    calorieTarget: { type: Number, default: 2000 }
  },
  { _id: false, minimize: false }
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    household: {
      adults: { type: Number, default: 2 },
      children: { type: Number, default: 0 },
      diet: { type: String, default: 'veg' }, // veg | nonveg | vegan | egg
      allergies: { type: [String], default: [] },
      tastes: { type: [String], default: [] },
      weeklyBudget: { type: Number, default: 1500 },
      goal: { type: String, default: 'none' } // gym goal: none | cut | bulk | maintain
    },
    members: { type: [MemberSchema], default: [] },
    prefs: {
      lang: { type: String, enum: ['en', 'hi'], default: 'en' },
      theme: { type: String, default: 'dark' }
    },
    favorites: { type: [String], default: [] },
    lastReconcile: {
      at: { type: String, default: null },
      accuracy: { type: Number, default: null }
    },
    notificationsReadAt: { type: String, default: null }
  },
  { minimize: false }
);

module.exports = { UserSchema };
