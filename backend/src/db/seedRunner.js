/**
 * Idempotent seeding for all drivers (v2 - realistic demo dataset):
 *  - 38-recipe library (veg / egg / non-veg / gym)
 *  - demo household user: 2 adults + 1 child members with roles, prefs, gym goal
 *  - realistic pantry (~28 items: low / out / expiring / one expired)
 *  - 3 days of usage history (audit logs), 2 past orders (spend history)
 *  - 2 reconciliations (accuracy over time), favorites
 *  - 3 IoT containers with readings (one offline/stale, one conflict)
 *  - an activity feed so "who did what" is alive from minute one
 */
const RECIPES = require('../data/recipes');
const CATALOG = require('../data/catalog');
const { todayISO, addDaysISO } = require('../utils/dates');
const { hash } = require('../utils/text');

const catByKey = new Map(CATALOG.map((c) => [c.key, c]));

// [catalogKey, qtyInBaseUnit, threshold, expiryOffsetDays|null]
const PANTRY_SEED = [
  ['wheat-flour', 5000, 1000, null], ['rice', 3000, 1000, null], ['basmati-rice', 1000, 500, null],
  ['toor-dal', 1200, 400, null], ['moong-dal', 600, 300, null], ['chickpeas', 150, 500, null],
  ['rajma', 200, 500, null], ['sugar', 900, 500, null], ['salt', 500, 200, null],
  ['turmeric', 90, 50, null], ['red-chilli-powder', 120, 50, null], ['coriander-powder', 150, 50, null],
  ['cumin', 60, 50, null], ['mustard-seeds', 80, 50, null], ['garam-masala', 70, 50, null],
  ['sunflower-oil', 1800, 1000, null], ['ghee', 400, 250, null],
  ['milk', 900, 1000, 1], ['curd', 500, 250, 2], ['paneer', 200, 200, 3], ['butter', 90, 100, 6],
  ['cheese-slices', 0, 200, null], ['bread', 1, 2, 2], ['egg', 6, 6, 9],
  ['onion', 1500, 500, null], ['tomato', 800, 500, 2], ['potato', 2000, 1000, null],
  ['garlic', 90, 100, null], ['ginger', 150, 100, null], ['green-chilli', 40, 50, 6],
  ['coriander-leaves', 30, 50, -1], ['lemon', 4, 3, null], ['capsicum', 200, 250, 3],
  ['peas', 400, 250, null], ['poha', 500, 250, null], ['sooji', 400, 250, null],
  ['spinach', 250, 200, 2], ['mushroom', 200, 200, 3], ['soya-chunks', 500, 250, null],
  ['tea-leaves', 250, 100, null], ['noodles', 4, 2, null], ['hakka-noodles', 400, 200, null],
  ['banana', 3, 3, 2], ['apple', 1200, 500, null], ['oats', 800, 300, null],
  ['dosa-batter', 0, 500, null] // coriander-leaves seeded expired (wastage demo)
];

function capacityFor(threshold, quantity) {
  return Math.max(threshold * 3, Math.ceil(quantity * 1.25), threshold + 1);
}

async function seed(db) {
  const recipes = db.col('recipes');
  const users = db.col('users');

  // refresh recipe library if empty
  if ((await recipes.count()) === 0) {
    await recipes.insertMany(RECIPES.map(({ key, ...r }) => ({ key, ...r })));
    console.log(`[seed] ${RECIPES.length} recipes loaded`);
  }

  const demo = await users.findOne({ email: 'demo@kitchensync.app' });

  // ---- fresh install: create demo user + everything ----
  if (!demo) {
    const bcrypt = require('bcryptjs');
    const user = await users.insertOne({
      name: 'Demo Family',
      email: 'demo@kitchensync.app',
      passwordHash: bcrypt.hashSync('demo1234', 10),
      household: { adults: 2, children: 1, diet: 'veg', allergies: [], tastes: ['comfort', 'spicy'], weeklyBudget: 1500, goal: 'cut' },
      members: [
        { id: 'm-demo-1', name: 'Aarav (you)', role: 'admin', type: 'adult', calorieTarget: 2200 },
        { id: 'm-demo-2', name: 'Priya', role: 'admin', type: 'adult', calorieTarget: 1900 },
        { id: 'm-demo-3', name: 'Ansh (8 yrs)', role: 'member', type: 'child', calorieTarget: 1500 }
      ],
      prefs: { lang: 'en', theme: 'dark' },
      favorites: ['dal-tadka', 'poha'],
      lastReconcile: { at: null, accuracy: null },
      notificationsReadAt: null
    });
    console.log('[seed] demo user created: demo@kitchensync.app / demo1234');
    await seedUserWorld(db, user);
    return;
  }

  // ---- upgrade path: pre-v2 persistent store (user exists, world data missing) ----
  if (!(demo.members || []).length) {
    await users.updateOne({ _id: demo._id }, {
      members: [
        { id: 'm-demo-1', name: 'Aarav (you)', role: 'admin', type: 'adult', calorieTarget: 2200 },
        { id: 'm-demo-2', name: 'Priya', role: 'admin', type: 'adult', calorieTarget: 1900 },
        { id: 'm-demo-3', name: 'Ansh (8 yrs)', role: 'member', type: 'child', calorieTarget: 1500 }
      ],
      prefs: demo.prefs || { lang: 'en', theme: 'dark' },
      'household.goal': (demo.household && demo.household.goal) || 'cut'
    });
    console.log('[seed] demo user upgraded to v2 (members, prefs)');
    const refreshed = await users.findOne({ _id: demo._id });
    await seedUserWorld(db, refreshed);
  }
}

/** Seeds pantry + history + devices + activity for a user (idempotent per collection). */
async function seedUserWorld(db, user) {
  const uid = user._id;
  const pantries = db.col('pantries');

  if ((await pantries.count({ ownerId: uid })) === 0) {
    const docs = PANTRY_SEED.map(([key, quantity, threshold, expiryOffset]) => {
      const c = catByKey.get(key);
      return {
        ownerId: uid,
        key,
        name: c.name,
        category: c.category,
        quantity,
        unit: c.unit,
        threshold,
        capacity: capacityFor(threshold, quantity),
        expiryDate: expiryOffset == null ? addDaysISO(todayISO(), c.shelfLifeDays) : addDaysISO(todayISO(), expiryOffset),
        addedBy: 'Owner',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });
    await pantries.insertMany(docs);
    console.log(`[seed] demo pantry loaded (${docs.length} items)`);
  }

  // --- 3 days of past usage history (audit logs) so Insights has real data ---
  const auditlogs = db.col('auditlogs');
  if ((await auditlogs.count({ ownerId: uid, type: 'meal' })) === 0) {
    const usage = [
      // [daysAgo, itemKey, grams used, reason]
      [3, 'rice', 300, 'Cooked Veg Pulao'], [3, 'onion', 100, 'Cooked Veg Pulao'], [3, 'sunflower-oil', 30, 'Cooked Veg Pulao'],
      [3, 'milk', 300, 'Morning chai + oats'], [3, 'tea-leaves', 12, 'Morning chai + oats'],
      [2, 'wheat-flour', 350, 'Cooked Aloo Paratha'], [2, 'potato', 400, 'Cooked Aloo Paratha'], [2, 'curd', 150, 'Cooked Aloo Paratha'],
      [2, 'toor-dal', 250, 'Cooked Dal Tadka'], [2, 'tomato', 200, 'Cooked Dal Tadka'], [2, 'ghee', 20, 'Cooked Dal Tadka'],
      [1, 'bread', 2, 'Cooked Grilled Sandwich'], [1, 'cheese-slices', 60, 'Cooked Grilled Sandwich'],
      [1, 'egg', 4, 'Cooked Egg Bhurji'], [1, 'onion', 80, 'Cooked Egg Bhurji'],
      [1, 'banana', 2, 'Smoothies']
    ];
    const items = await pantries.find({ ownerId: uid });
    const byKey = new Map(items.filter((i) => i.key).map((i) => [i.key, i]));
    for (const [daysAgo, key, delta, reason] of usage) {
      const item = byKey.get(key);
      if (!item) continue;
      await auditlogs.insertOne({
        ownerId: uid, itemId: item._id, name: item.name,
        before: item.quantity + delta, after: item.quantity, delta: -delta, unit: item.unit,
        reason, type: 'meal',
        at: new Date(Date.now() - daysAgo * 86400000).toISOString()
      });
    }
    await auditlogs.insertOne({
      ownerId: uid, itemId: (byKey.get('spinach') || {})._id || null, name: 'Spinach',
      before: 100, after: 0, delta: -100, unit: 'g',
      reason: 'expired - removed', type: 'waste',
      at: new Date(Date.now() - 2 * 86400000).toISOString()
    });
    console.log('[seed] 3-day usage history loaded');
  }

  // --- past orders (spend history) ---
  const carts = db.col('carts');
  if ((await carts.count({ ownerId: uid, status: 'received' })) === 0) {
    const providers = [
      { id: 'zepto', name: 'Zepto', total: 1122, fee: 25, eta: 11 },
      { id: 'instamart', name: 'Swiggy Instamart', total: 1348, fee: 0, eta: 14 }
    ];
    for (const [i, p] of providers.entries()) {
      await carts.insertOne({
        ownerId: uid,
        providerId: p.id,
        providerName: p.name,
        items: [
          { key: 'milk', name: 'Milk', qty: 2, unit: 'L', price: 132 },
          { key: 'bread', name: 'Bread', qty: 1, unit: 'pc', price: 45 },
          { key: 'egg', name: 'Eggs', qty: 6, unit: 'pc', price: 42 }
        ],
        subtotal: p.total - p.fee,
        fee: p.fee,
        total: p.total,
        savings: i === 0 ? 34 : 0,
        etaMin: p.eta,
        status: 'received',
        orderId: `KS${10000001 + i}`,
        createdAt: new Date(Date.now() - (i + 2) * 86400000).toISOString(),
        orderedAt: new Date(Date.now() - (i + 2) * 86400000).toISOString()
      });
    }
    console.log('[seed] past order history loaded');
  }

  // --- reconciliation history (accuracy over time) ---
  const reconciliations = db.col('reconciliations');
  if ((await reconciliations.count({ ownerId: uid })) === 0) {
    await reconciliations.insertMany([
      { ownerId: uid, at: new Date(Date.now() - 6 * 86400000).toISOString(), accuracy: 91.5, checked: 20, changes: [{ name: 'Milk', before: 500, after: 420, gap: -80 }, { name: 'Onion', before: 2000, after: 1900, gap: -100 }] },
      { ownerId: uid, at: new Date(Date.now() - 2 * 86400000).toISOString(), accuracy: 96.3, checked: 24, changes: [{ name: 'Sugar', before: 1000, after: 940, gap: -60 }] }
    ]);
    await db.col('users').updateOne({ _id: uid }, { lastReconcile: { at: new Date(Date.now() - 2 * 86400000).toISOString(), accuracy: 96.3 } });
    console.log('[seed] reconciliation history loaded');
  }

  // --- IoT containers ---
  const devices = db.col('devices');
  if ((await devices.count({ ownerId: uid })) === 0) {
    const items = await pantries.find({ ownerId: uid });
    const rice = items.find((i) => i.key === 'basmati-rice');
    const wheat = items.find((i) => i.key === 'wheat-flour');
    const milk = items.find((i) => i.key === 'milk');

    const seedDevices = [
      { name: 'Rice Jar (Basmati)', item: rice, battery: 84, stale: false, drift: -420 },
      { name: 'Atta Container', item: wheat, battery: 61, stale: false, drift: 90 },
      { name: 'Milk Chiller Pack', item: milk, battery: 12, stale: true, drift: 0 }
    ];
    for (const sd of seedDevices) {
      if (!sd.item) continue;
      const dev = await devices.insertOne({
        ownerId: uid,
        name: sd.name,
        kind: 'load-cell-container',
        pantryItemId: sd.item._id,
        linkedKey: sd.item.key,
        battery: sd.battery,
        wifi: sd.stale ? 'venue-wifi' : 'home-wifi',
        tareGrams: 0,
        lastSeen: sd.stale ? new Date(Date.now() - 47 * 60000).toISOString() : new Date(Date.now() - 2 * 60000).toISOString(),
        createdAt: new Date(Date.now() - 8 * 86400000).toISOString()
      });
      // 12 readings over the last day: gradual drain, ending near the app value + drift
      const start = Math.max(200, sd.item.quantity + 700);
      for (let i = 11; i >= 0; i--) {
        const progress = (11 - i) / 11;
        const grams = Math.max(0, Math.round(start - progress * (start - Math.max(0, sd.item.quantity + sd.drift))));
        await db.col('devicereadings').insertOne({
          ownerId: uid, deviceId: dev._id, grams,
          at: new Date(Date.now() - i * 2 * 3600 * 1000).toISOString()
        });
      }
    }
    console.log('[seed] 3 IoT containers with readings loaded');
  }

  // --- activity feed ---
  const activitylogs = db.col('activitylogs');
  if ((await activitylogs.count({ ownerId: uid })) === 0) {
    const acts = [
      { actor: 'Aarav (you)', action: 'added', target: 'Milk', detail: '1 L added via barcode scan', icon: 'barcode', at: new Date(Date.now() - 26 * 3600 * 1000).toISOString() },
      { actor: 'Priya', action: 'used', target: 'Dal Tadka', detail: 'Deducted 250 g Toor Dal, 200 g Tomato', icon: 'cooking', at: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
      { actor: 'Priya', action: 'ordered', target: 'Zepto', detail: 'Order KS10000001 - 3 items, ₹1,122', icon: 'truck', at: new Date(Date.now() - 46 * 3600 * 1000).toISOString() },
      { actor: 'Aarav (you)', action: 'reconciled', target: 'Physical stock', detail: '24 items counted - 1 correction, accuracy 96.3%', icon: 'scale', at: new Date(Date.now() - 2 * 86400000).toISOString() },
      { actor: 'System', action: 'detected', target: 'Tomato', detail: 'Auto-detect (camera): tomato, 92% confidence', icon: 'camera', at: new Date(Date.now() - 3 * 3600 * 1000).toISOString() }
    ];
    for (const a of acts) await activitylogs.insertOne({ ownerId: uid, ...a });
  }
}

module.exports = { seed };
