const { generateWeek } = require('./plannerService');
const { todayISO } = require('../utils/dates');

async function getOrCreatePlan(db, user, force = false) {
  if (!user) throw new Error('User not found');
  const plans = db.col('mealplans');
  let plan = await plans.findOne({ ownerId: user._id });
  const today = todayISO();
  const dates = (plan?.days || []).map((day) => day.date).filter(Boolean).sort();
  const missingToday = dates.length > 0 && !dates.includes(today);

  if (!plan || force || missingToday) {
    const pantryItems = await db.col('pantries').find({ ownerId: user._id });
    const recipes = await db.col('recipes').find({});
    const generated = generateWeek({
      user, pantryItems, recipes, startISO: today, days: 7,
      existingPlan: plan || null
    });
    if (plan) plan = await plans.updateOne({ _id: plan._id }, generated);
    else plan = await plans.insertOne({ ownerId: user._id, ...generated });
  }
  return plan;
}

module.exports = { getOrCreatePlan };
