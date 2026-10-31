/**
 * KitchenSync v2 API test - covers the P0 fixes, new endpoints and edge cases.
 * Run: node scripts/v2-test.js  (against a server on :5055)
 */
const BASE = process.env.BASE || 'http://localhost:5055/api';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`PASS: ${name}`); }
  else { fail++; console.log(`FAIL: ${name} ${extra}`.slice(0, 300)); }
};

async function req(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// Like req() but with raw custom headers (device-key auth) and no token default
async function raw(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

(async () => {
  // 0) demo login
  const { data: auth } = await req('POST', '/auth/demo');
  const T = auth.token;
  ok('demo login', !!T && auth.user.household.adults >= 1);
  ok('members seeded', (auth.user.members || []).length === 3, JSON.stringify(auth.user.members));
  ok('prefs present', !!auth.user.prefs);

  // 1) dashboard one-shot
  const { data: dash } = await req('GET', '/dashboard', null, T);
  ok('dashboard: 3 meals', (dash.meals || []).length === 3);
  ok('dashboard: today meals have chips', dash.meals.every((m) => !m.recipe || m.recipe.stockChip));
  ok('dashboard: useSoon strip', Array.isArray(dash.useSoon) && dash.useSoon.length >= 2, `len=${(dash.useSoon || []).length}`);
  ok('dashboard: budget snapshot', !!dash.budget && dash.budget.budget === 1500);

  // 2) planner: starts today, budget constraint, explainers
  const { data: pl } = await req('GET', '/planner', null, T);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  ok('planner starts today', pl.plan.days[0].date === today, pl.plan.days[0].date);
  ok('no past days', pl.plan.days.every((d) => d.date >= today));
  ok('budget check present', !!pl.plan.summary.budget && typeof pl.plan.summary.budget.fits === 'boolean');
  ok('budget line sane (< 5000)', pl.plan.summary.totalCost < 5000, `totalCost=${pl.plan.summary.totalCost}`);
  ok('per-meal explainer', pl.plan.days[0].meals.breakfast && pl.plan.days[0].meals.breakfast.why.length > 0);
  ok('needs have category', pl.plan.summary.needs.every((n) => !!n.category));
  ok('no implausible need lines', pl.plan.summary.needs.every((n) => !n.flag), JSON.stringify(pl.plan.summary.needs.filter((n) => n.flag)));

  // 3) hakka noodles price sanity (was 400pc/₹24000)
  const hakka = pl.plan.summary.needs.find((n) => n.key === 'hakka-noodles');
  if (hakka) ok('hakka noodles line sane', hakka.toBuy <= 2000 && hakka.estCost < 1500, JSON.stringify(hakka));
  else ok('hakka noodles not needed (stock covers)', true);

  // 4) mark done -> deductions -> idempotent -> undo
  const slot = pl.plan.days[0].meals.breakfast && !pl.plan.days[0].meals.breakfast.done ? 'breakfast' : 'lunch';
  const date = pl.plan.days[0].date;
  const { data: done1 } = await req('POST', '/planner/mark-done', { date, slot }, T);
  ok('mark-done works', done1.alreadyDone === false && Array.isArray(done1.deductions), JSON.stringify(done1).slice(0, 120));
  const { data: done2 } = await req('POST', '/planner/mark-done', { date, slot }, T);
  ok('mark-done idempotent', done2.alreadyDone === true, JSON.stringify(done2).slice(0, 100));
  const { data: undo1 } = await req('POST', '/planner/unmark', { date, slot }, T);
  ok('undo restores', undo1.ok === true && undo1.restored >= 0, JSON.stringify(undo1).slice(0, 100));

  // 4b) over-deduction clamping: pick recipe with missing items
  const { data: pantryBefore } = await req('GET', '/pantry', null, T);
  const eggItem = pantryBefore.items.find((i) => i.key === 'egg');
  const eggQtyBefore = eggItem ? eggItem.quantity : 0;
  // temporarily zero out an ingredient of today's lunch to test clamp
  const lunch = pl.plan.days[0].meals.lunch;
  if (lunch) {
    const firstIng = (lunch.missingKeys || [])[0];
    if (firstIng) {
      const item = pantryBefore.items.find((i) => i.key === firstIng.key);
      if (item) {
        await req('PATCH', `/pantry/${item._id}`, { quantity: 0 }, T);
        const { data: done3 } = await req('POST', '/planner/mark-done', { date: pl.plan.days[1].date, slot: 'lunch' }, T);
        const clamped = done3.deductions.every((d) => d.take <= d.have + 0.001);
        ok('over-deduction clamped to stock', clamped, JSON.stringify(done3.shortfall).slice(0, 100));
        ok('shortfall flagged', Array.isArray(done3.shortfall));
        await req('POST', '/planner/unmark', { date: pl.plan.days[1].date, slot: 'lunch' }, T);
        await req('PATCH', `/pantry/${item._id}`, { quantity: item.quantity }, T); // restore
      }
    }
  }
  if (eggItem && eggQtyBefore !== undefined) {
    const { data: pantryAfter } = await req('GET', '/pantry', null, T);
    const eggAfter = pantryAfter.items.find((i) => i.key === 'egg');
    ok('egg stock restored after undo', Math.abs((eggAfter ? eggAfter.quantity : 0) - eggQtyBefore) < 0.001, `${eggQtyBefore} -> ${eggAfter ? eggAfter.quantity : '?'}`);
  }

  // 5) the loop: plan shortages -> shopping list -> compare works
  const { data: sync } = await req('POST', '/planner/sync-shopping', {}, T);
  ok('sync-shopping adds needs', sync.added > 0 || sync.merged > 0, JSON.stringify(sync).slice(0, 100));
  const { data: list } = await req('GET', '/shopping/list', null, T);
  ok('list has plan-sourced items', (list.saved || []).some((i) => (i.sources || []).includes('plan') || i.source === 'plan'));
  ok('planNeeds surfaced', Array.isArray(list.planNeeds));
  const cmpItems = (list.saved || []).filter((i) => !i.done).slice(0, 3).map((i) => ({ key: i.key, name: i.name, qty: i.toBuy || i.qty, unit: i.unit }));
  if (cmpItems.length) {
    const { data: cmp } = await req('POST', '/shopping/compare', { items: cmpItems }, T);
    ok('compare works from synced list', !!cmp.bestProvider && cmp.baskets.length === 4, JSON.stringify(cmp.bestProvider));
    ok('compare has sanity flags', ('perItem' in cmp));
  }

  // 6) recipes: nutrition + gym + AI estimate
  const { data: recs } = await req('GET', '/recipes?gym=1', null, T);
  ok('gym filter returns recipes', recs.count >= 5, `count=${recs.count}`);
  ok('nutrition present', recs.recipes.every((r) => r.nutrition && typeof r.nutrition.protein === 'number'));
  const { data: gym } = await req('GET', '/recipes/gym?goal=cut', null, T);
  ok('gym endpoint sorted by protein density', gym.recipes.length >= 3 && gym.recipes[0].proteinPer100 !== undefined);
  ok('38+ recipes in library', (await req('GET', '/recipes', null, T)).data.count >= 38);
  const { data: est } = await req('POST', '/recipes/estimate', { name: 'Chicken Fried Rice', ingredients: [{ name: 'rice' }, { name: 'chicken' }, { name: 'egg' }], servings: 2, diet: 'nonveg' }, T);
  ok('estimate returns ingredients', est.ingredients.length === 3 && est.engine, `engine=${est.engine}`);
  const { data: created } = await req('POST', '/recipes', { name: 'My Test Protein Bowl', diet: 'veg', meal: ['snack'], ingredients: est.ingredients.slice(0, 2), steps: ['Mix'], kcal: 300, nutrition: { protein: 20, carbs: 30, fat: 8, fiber: 4 } }, T);
  ok('add custom recipe', !!created.recipe && created.recipe.source === 'custom', JSON.stringify(created).slice(0, 100));

  // 7) receipts v3: scan (text/demo pipeline) -> confirm -> duplicate guard + accuracy
  const { data: acc } = await req('GET', '/receipts/accuracy', null, T);
  ok('receipt accuracy measured', acc.accuracy >= 75 && acc.unitTests.passed >= 4, JSON.stringify(acc).slice(0, 120));
  const scanText = `KIRANA ${Date.now()}\nAmul Butter 500G 275.00\nMilk 1L 66.00\nAnda 6pc 42.00\nTOTAL 383.00`;
  const { data: scan1 } = await req('POST', '/receipts/demo', { text: scanText }, T);
  ok('receipt scan -> review payload', scan1.ok === true && scan1.items.length >= 3, `items=${scan1.items && scan1.items.length}`);
  ok('unit parsed 500G / 1L', scan1.items.some((i) => i.qty === 500 && i.unit === 'g') && scan1.items.some((i) => i.qty === 1000 && i.unit === 'ml'));
  const { data: conf1 } = await req('POST', '/receipts/confirm', { receiptId: scan1.receiptId, items: scan1.items.map((i) => ({ ...i, checked: true })) }, T);
  ok('receipt confirm adds to stock', conf1.ok === true && conf1.added >= 3, JSON.stringify(conf1).slice(0, 100));
  const { data: scan2 } = await req('POST', '/receipts/demo', { text: scanText }, T);
  ok('duplicate scan guarded', scan2.duplicate === true);
  const { data: conf2 } = await req('POST', '/receipts/confirm', { receiptId: scan1.receiptId, items: [{ name: 'Milk', qty: 1000, unit: 'ml', checked: true }] }, T);
  ok('double confirm rejected', conf2.error && String(conf2.error).includes('already'), JSON.stringify(conf2).slice(0, 80));
  // deep-link handoff
  const { data: handoff } = await req('POST', '/shopping/handoff', { providerId: 'blinkit', items: [{ name: 'Tomato', qty: 1000, unit: 'g' }] }, T);
  ok('handoff deep links', handoff.items.length === 1 && String(handoff.items[0].url).includes('blinkit.com'));

  // 7b) weighing station: reading -> guards -> weigh -> reweigh
  // Scale and storage routes are intentionally limited to commercial/service workspaces.
  const { data: commercialProfile } = await req('PUT', '/auth/me', { accountType: 'commercial' }, T);
  ok('device tools require a commercial workspace', commercialProfile.user.accountType === 'commercial');
  const bad = await raw('POST', '/scale/reading', { device_id: 'scale1', grams: -999, stable: true }, { 'x-device-key': 'wrong' });
  ok('scale bad key -> 401', bad.status === 401);
  const junk = await raw('POST', '/scale/reading', { device_id: 'scale1', grams: -999, stable: true }, { 'x-device-key': 'secret-device-key' });
  ok('scale nonsense -> 422', junk.status === 422);
  await raw('POST', '/scale/reading', { device_id: 'scale1', grams: 1240, stable: true }, { 'x-device-key': 'secret-device-key' });
  const latest = await req('GET', '/scale/latest', null, T);
  ok('scale latest online+stable', latest.data.online === true && latest.data.stable === true, JSON.stringify(latest.data).slice(0, 80));
  const { data: pantryNow } = await req('GET', '/pantry', null, T);
  const weighItem = (pantryNow.items.find((p) => p.unit === 'g') || pantryNow.items[0]);
  const { data: weighed } = await req('POST', `/scale/stock/${weighItem._id}/weigh`, { mode: 'set', containerWeight: 40 }, T);
  ok('weigh set applies net', weighed.applied && weighed.applied.netGrams === 1200, JSON.stringify(weighed).slice(0, 100));
  const rw = await req('GET', `/scale/reweigh/${weighItem._id}`, null, T);
  ok('reweigh diff', rw.data && typeof rw.data.diffGrams === 'number');
  const { data: simw } = await req('POST', '/scale/simulate', { itemId: weighItem._id }, T);
  ok('simulate sensor works', simw.ok === true);

  // 8) IoT devices
  const { data: devs } = await req('GET', '/devices', null, T);
  ok('devices listed with status', devs.devices.length === 3 && devs.devices.every((d) => d.status));
  ok('conflict detected', devs.conflicts.length >= 1, `conflicts=${devs.conflicts.length}`);
  const d0 = devs.devices.find((d) => d.status !== 'stale') || devs.devices[0];
  const { data: hist } = await req('GET', `/devices/${d0.id}/history`, null, T);
  ok('device history series', hist.series.length >= 8);
  const { data: nonsense } = await req('POST', `/devices/${d0.id}/simulate`, { mode: 'nonsense' }, T);
  ok('nonsense reading rejected', nonsense.flagged === true, JSON.stringify(nonsense).slice(0, 100));
  const { data: drift } = await req('POST', `/devices/${d0.id}/simulate`, { mode: 'drift' }, T);
  ok('drift reading accepted', drift.ok === true);
  const { data: tare } = await req('POST', `/devices/${d0.id}/tare`, {}, T);
  ok('tare works', tare.ok === true);
  if (devs.conflicts.length) {
    const { data: resolved } = await req('POST', `/devices/conflicts/${devs.conflicts[0].deviceId}/resolve`, { use: 'sensor' }, T);
    ok('conflict resolves to sensor', resolved.ok === true, JSON.stringify(resolved).slice(0, 100));
  }

  // 9) analytics v2
  const { data: an } = await req('GET', '/analytics/summary', null, T);
  ok('category value has rupees', an.categoryValue.length > 0 && an.categoryValue[0].value > 0, JSON.stringify(an.categoryValue[0]));
  ok('wastage money figure', an.wastage && an.wastage.wastedValue > 0, `wasted=${an.wastage && an.wastage.wastedValue}`);
  ok('accuracy history', Array.isArray(an.accuracyHistory) && an.accuracyHistory.length >= 2, `len=${(an.accuracyHistory || []).length}`);
  const { data: act } = await req('GET', '/analytics/activity', null, T);
  ok('activity feed', act.activity.length >= 3, `len=${act.activity.length}`);

  // 10) members CRUD
  const { data: members1 } = await req('GET', '/members', null, T);
  const { data: mem2 } = await req('POST', '/members', { name: 'Rohit', role: 'member', type: 'adult' }, T);
  ok('member added', mem2.members.length === members1.members.length + 1);
  const { data: mem3 } = await req('DELETE', `/members/${mem2.member.id}`, null, T);
  ok('member removed', mem3.members.length === members1.members.length);

  // 11) shopping: mark bought -> stock; share text
  const { data: added1 } = await req('POST', '/shopping/items', { name: 'Curd', qty: 500, unit: 'g', source: 'manual' }, T);
  const itemId = added1.item.id;
  const { data: bought } = await req('POST', `/shopping/items/${itemId}/bought`, {}, T);
  ok('mark bought updates stock', bought.ok === true && !!bought.item, JSON.stringify(bought).slice(0, 100));
  const { data: share } = await req('POST', '/shopping/share', {}, T);
  ok('share text + whatsapp url', share.text.includes('KitchenSync shopping list') && share.whatsappUrl.startsWith('https://wa.me/'));

  // 12) persistence across restart is Mongo-backed (file/memory independent): sanity check db mode
  const { data: me } = await req('GET', '/auth/me', null, T);
  ok('auth/me works without exposing email', !!me.user && me.user.name === 'Demo Family' && me.user.email === undefined);

  console.log('-------------------------');
  console.log(`PASS=${pass} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
