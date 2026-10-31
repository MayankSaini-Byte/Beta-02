/** Reconciliation model - history of physical stock counts (accuracy over time). */
const { Schema } = require('mongoose');

const ReconciliationSchema = new Schema(
  {
    ownerId: { type: String, index: true },
    at: { type: String },
    accuracy: { type: Number },
    checked: { type: Number, default: 0 },
    changes: { type: [Schema.Types.Mixed], default: [] } // {id,name,before,after,gap}
  },
  { minimize: false }
);

module.exports = { ReconciliationSchema };
