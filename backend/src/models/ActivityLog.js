/** ActivityLog model - "who added, used or changed what, and when" (flatmates bonus). */
const { Schema } = require('mongoose');

const ActivityLogSchema = new Schema(
  {
    ownerId: { type: String, index: true },
    actor: { type: String, default: 'Owner' },      // member name
    action: { type: String },                        // added | used | changed | removed | planned | ordered | reconciled | detected
    target: { type: String },                        // item / meal / list name
    detail: { type: String, default: '' },
    icon: { type: String, default: 'activity' },
    at: { type: String }
  },
  { minimize: false }
);

module.exports = { ActivityLogSchema };
