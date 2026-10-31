/**
 * Activity service - "who added, used or changed what, and when".
 * One tiny helper every mutating route calls so the feed is complete.
 */
async function logActivity(db, ownerId, { actor = 'Owner', action, target, detail = '', icon = 'activity' }) {
  try {
    await db.col('activitylogs').insertOne({
      ownerId,
      actor,
      action,
      target,
      detail,
      icon,
      at: new Date().toISOString()
    });
  } catch (err) {
    console.error('[activity] log failed:', err.message); // never break the main flow
  }
}

function shape(a) {
  return {
    id: a._id,
    actor: a.actor,
    action: a.action,
    target: a.target,
    detail: a.detail,
    icon: a.icon,
    at: a.at
  };
}

module.exports = { logActivity, shape };
