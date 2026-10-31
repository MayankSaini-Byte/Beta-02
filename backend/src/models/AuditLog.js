/** AuditLog model - stock quantity changes (stock accuracy trail). */
const { Schema } = require('mongoose');

const AuditLogSchema = new Schema(
  {
    ownerId: { type: String, index: true },
    itemId: { type: String, default: null },
    name: String,
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    delta: { type: Schema.Types.Mixed },
    unit: String,
    reason: String,
    type: { type: String, default: 'adjust' }, // adjust | reconcile | delivery | meal | waste
    at: { type: String }
  },
  { minimize: false }
);

module.exports = { AuditLogSchema };
