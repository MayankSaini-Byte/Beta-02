/** Model registry - single source of truth for Mongoose schemas. */
const { UserSchema } = require('./User');
const { PantryItemSchema } = require('./PantryItem');
const { RecipeSchema } = require('./Recipe');
const { MealPlanSchema } = require('./MealPlan');
const { ShoppingListSchema } = require('./ShoppingList');
const { CartSchema } = require('./Cart');
const { AuditLogSchema } = require('./AuditLog');
const { ActivityLogSchema } = require('./ActivityLog');
const { DeviceSchema } = require('./Device');
const { DeviceReadingSchema } = require('./DeviceReading');
const { ReconciliationSchema } = require('./Reconciliation');
const { ReceiptSchema } = require('./Receipt');
const { ScaleStateSchema } = require('./ScaleState');

const SCHEMAS = {
  users: UserSchema,
  pantries: PantryItemSchema,
  recipes: RecipeSchema,
  mealplans: MealPlanSchema,
  shoppinglists: ShoppingListSchema,
  carts: CartSchema,
  auditlogs: AuditLogSchema,
  activitylogs: ActivityLogSchema,
  devices: DeviceSchema,
  devicereadings: DeviceReadingSchema,
  reconciliations: ReconciliationSchema,
  receipts: ReceiptSchema,
  scalestate: ScaleStateSchema
};

module.exports = { SCHEMAS };
