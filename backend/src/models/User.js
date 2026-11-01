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
    diet: { type: String, enum: ['inherit', 'veg', 'egg', 'nonveg', 'vegan', 'jain', 'custom'], default: 'inherit' },
    allergies: { type: [String], default: [] },
    calorieTarget: { type: Number, default: 2000 },
    proteinTarget: { type: Number, default: 75 }
  },
  { _id: false, minimize: false }
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    username: { type: String, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // The account owner is the workspace admin; non-admin access can be assigned explicitly.
    role: { type: String, enum: ['admin', 'member'], default: 'admin' },
    accountType: { type: String, enum: ['household', 'commercial', 'service'], default: 'household' },
    onboardingComplete: { type: Boolean, default: true },
    businessProfile: {
      businessType: { type: String, default: '' },
      outletName: { type: String, default: '' },
      address: { type: String, default: '' },
      dailyServings: { type: Number, default: 0 },
      vendorContact: { type: String, default: '' }
    },
    household: {
      kitchenType: { type: String, enum: ['household', 'hostel', 'commercial'], default: 'household' },
      residents: { type: Number, default: 2 },
      adults: { type: Number, default: 2 },
      children: { type: Number, default: 0 },
      address: { type: String, default: '' },
      pincode: { type: String, default: '' },
      diet: { type: String, default: 'veg' }, // veg | egg | nonveg | vegan | jain
      foodPractice: { type: String, default: 'none' },
      calorieTarget: { type: Number, default: 2000 },
      proteinTarget: { type: Number, default: 75 },
      cuisines: { type: [String], default: [] },
      allergies: { type: [String], default: [] },
      tastes: { type: [String], default: [] },
      weeklyBudget: { type: Number, default: 1500 },
      goal: { type: String, default: 'none' } // gym goal: none | cut | bulk | maintain
    },
    members: { type: [MemberSchema], default: [] },
    messPoll: {
      question: { type: String, default: '' },
      options: [{ id: String, text: String }],
      votes: [{ userId: String, optionId: String }],
      closed: { type: Boolean, default: false },
      demo: { type: Boolean, default: false },
      updatedAt: { type: Date, default: null }
    },
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
