# KitchenSync REST API

Base URL: `/api` · Auth: `Authorization: Bearer <JWT>` (all routes except `/auth/*` and `/health`)

**Data conventions**

- Quantities are stored in **base units**: `g` (weight), `ml` (volume), `pc` (count).
- Dates are `YYYY-MM-DD` strings. `_id` values are opaque strings.
- Errors: `{ "error": "message" }` with proper HTTP status.

## Account workspaces

Registration accepts `accountType: "household" | "commercial" | "service"`. New accounts return `onboardingComplete: false` and must save a profile before entering the app. Existing accounts without this field are treated as already onboarded.

| Method | Path | Body / query | Notes |
|---|---|---|---|
| PUT | `/auth/me` | `{accountType?, onboardingComplete?, household?, members?, businessProfile?}` | Saves household members, diet/allergy preferences, regional cuisines, address and nutrition targets; commercial/service type, outlet, address, daily servings and vendor contact. |
| GET | `/diet/today?memberId=` | `memberId` optional | Selected member’s daily calorie/protein targets, food logs, consumed amounts and remaining amounts. |
| POST | `/diet/log` | `{memberId?, name, calories, protein?, source?}` | Logs a meal or outside food for today. |
| DELETE | `/diet/log/:id` | - | Removes a food log owned by the current account. |
| GET | `/vendors` | - | Lists vendors for commercial and food-service accounts. |
| POST | `/vendors` | `{name, phone, notes?}` | Saves supplier contact details for WhatsApp restocking. |
| PATCH | `/vendors/:id` | `{name?, phone?, notes?}` | Updates an owned vendor. |
| DELETE | `/vendors/:id` | - | Removes an owned vendor. |
| GET | `/shopping/live-compare/status` | - | Reports whether `MULTISTOREAPI` is configured. |
| POST | `/shopping/live-compare` | `{pincode, items:[{name, qty, unit}], forceRefresh?}` | Compares collected offers using required quantity, pack size, needed packs, total price and unit price. |

Household recipe filtering uses `?compatible=1&memberId=<member>` for the selected person; without `memberId`, the shared planner requires every household member’s diet and allergy restrictions to be satisfied.

---

## Auth

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/demo` | - | `{token, user, mode}` - one-click demo household |
| POST | `/auth/register` | `{name, email, password, accountType?}` | `201 {token, user, mode}`; new accounts start with onboarding incomplete |
| POST | `/auth/login` | `{email, password}` | `{token, user, mode}` |
| GET | `/auth/me` | - | `{user, mode}` |
| PUT | `/auth/me` | `{name?, accountType?, household?, members?, businessProfile?, onboardingComplete?}` | `{user}` - saves profile details and marks onboarding complete when requested |

```bash
TOKEN=$(curl -s -X POST localhost:5000/api/auth/demo | jq -r .token)
```

`user.household` drives portion scaling: `factor = adults + children * 0.5`.

## Pantry (kitchen stock)

| Method | Path | Notes |
|---|---|---|
| GET | `/pantry` | All items enriched with `state` (ok/low/out), `daysToExpiry`, `expiryState`, `remindOn`, plus `alerts` and `stats` |
| POST | `/pantry` | `{name, quantity, unit, threshold?, expiryDate?, mode?: 'add'\|'set'}` - upserts by matched catalog key; Hindi synonyms resolve (`aloo` → Potato) |
| PATCH | `/pantry/:id` | Update any of `quantity, threshold, expiryDate, unit, name, category` |
| DELETE | `/pantry/:id` | Remove item |
| POST | `/pantry/:id/adjust` | `{delta, reason?}` - quick +/- with audit log entry |
| POST | `/pantry/reconcile` | `{counts: [{id, physical}]}` → `{accuracy, changes, at}` - stock accuracy feature |
| GET | `/pantry/catalog` | 56-item catalog for autocomplete |
| GET | `/pantry/export` | CSV download |

Example - add + restock in one call:

```bash
curl -X POST localhost:5000/api/pantry -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"paneer","quantity":200,"unit":"g","mode":"add"}'
```

## Recipes

| Method | Path | Notes |
|---|---|---|
| GET | `/recipes?q=&diet=&meal=&cookable=1` | List with `availability.coverage`, `missingCount`, sorted by cookability then rating |
| GET | `/recipes/:key` | Detail: steps, `youtubeUrl`, ingredients scaled to your household with `needDisplay/haveDisplay`, alternates for missing items |
| GET | `/recipes/favorites` | Favourites list |
| POST | `/recipes/:key/favorite` | `{on: true\|false}` |

## Meal planner

| Method | Path | Notes |
|---|---|---|
| GET | `/planner` | This week's plan (auto-generates + persists on first visit). Days → slots → `{key, name, coverage, missing[], usesExpiring[]}` + `summary.needs` |
| POST | `/planner/generate` | Re-optimize from scratch (seeded, stable per user+week) |
| PUT | `/planner/slot` | `{date, slot, key\|null}` - manual swap |
| POST | `/planner/order` | Builds the cheapest 4-store cart for everything the week's plan is missing |

Optimizer scoring: `2.0·coverage + 0.8·tasteMatch + 1.1·usesExpiring + 0.7·variety + 0.3·rating + ε`, with virtual ingredient consumption across the week.

## Shopping & price comparison

| Method | Path | Notes |
|---|---|---|
| GET | `/shopping/list` | `{auto[] (out-of-stock + below-threshold with suggested buy qty), saved[] (manual/planner/recipe), providers[]}` |
| POST | `/shopping/items` | `{key?, name, qty, unit, source?}` |
| PATCH | `/shopping/items/:id` | `{done}` |
| DELETE | `/shopping/items/:id` | |
| POST | `/shopping/compare` | `{items:[{key?,name,qty,unit}]}` → per-item quotes for 4 stores, basket totals, fees, ETAs, `bestProvider`, `savings` |
| GET | `/shopping/live-compare/status` | `{configured, provider, cacheDays}`; does not expose the API key |
| POST | `/shopping/live-compare` | `{pincode, forceRefresh?, items:[{name,qty,unit}]}` → live Rewalto listings, fresh stock signals, compatible pack totals, purchase URLs, and best baskets |
| GET | `/shopping/location/search?q=` | Search Indian localities/PINs for the delivery-area map |
| GET | `/shopping/location/reverse?lat=&lon=` | Resolve a clicked Indian map point to its delivery PIN |
| GET | `/shopping/quotes?name=&qty=&unit=` | Single-item quick check |
| GET | `/shopping/cart` | Active cart + last order |
| POST | `/shopping/cart` | `{providerId, items}` → cart with totals |
| POST | `/shopping/cart/checkout` | Places (simulated) order → `{order:{orderId,total,etaMin,...}}` |
| POST | `/shopping/cart/receive` | Simulated delivery → adds ordered items into pantry stock |
| POST | `/shopping/handoff` | `{providerId, items}` → **deep-link hand-off**: per-item pre-filled search URLs on the real store, copy-ready `listText`, `openUrl` |

Providers: `instamart`, `blinkit`, `zepto`, `bigbasket` (see honesty note in README - prices are deterministic simulations behind a pluggable adapter).

## Receipts (phone camera → model → review → stock)

| Method | Path | Notes |
|---|---|---|
| POST | `/receipts/scan` | multipart `receipt` (photo) or JSON `{text}` → standard JSON `{receiptId, engine, items:[{raw_name, name, qty, unit, price, confidence, matched_stock_id, flag}]}`. SHA-256 duplicate guard → `duplicate:true` + earlier review. Model down/blurry → `{ok:false, message:"Couldn't read this receipt…"}` - never crashes, never invents |
| POST | `/receipts/confirm` | `{receiptId, items}` → adds/merges into stock (unit-aware, audited). Confirmed receipts rejected twice (`409`) unless `force:true` |
| POST | `/receipts/demo` | optional `{text}` - deterministic demo receipt through the exact same pipeline |
| GET | `/receipts/accuracy` | measured self-test: item extraction + unit parsing ("500G", "1 LTR", "2 PCS") |

Pipeline details: unit regex + table (same converter as recipes), fuzzy match (Dice bigrams) to existing stock + catalog, confidence < 0.7 flagged `low-confidence` (amber in the review table), line price > ₹5,000 flagged `check-price`.

## Expiry date checker (image capture)

| Method | Path | Notes |
|---|---|---|
| POST | `/receipts/expiry/scan` | multipart `photo` → `{ok, productName, expiryDate, confidence, lowConfidence, daysLeft}`. No readable date → `{ok:false, needsManual:true}` (retake or type manually - never guesses) |
| POST | `/receipts/expiry/confirm` | `{itemId\|name, expiryDate}` → sets the item's expiry, arms the 7-days-before reminder, audit + activity entry |

## Weighing station (ESP8266/ESP32 + HX711 load cell + DHT22)

| Method | Path | Notes |
|---|---|---|
| POST | `/scale/reading` | **device auth** (`x-device-key` header) `{device_id, grams, stable, temperature_c?, humidity_percent?, timestamp_ms?, reading_id?}` → 204. `device_id` must be paired in Devices first; explicit legacy `scale1` remains supported. `grams` is finite, non-negative and <50,000; `stable` is a required boolean; optional temperature is −40–80 °C and humidity is 0–100% RH. Missing/wrong key → 401; invalid fields or unknown physical ID → 400; duplicate ID → 204; stale/out-of-order → 409. Environmental fields may be omitted or null when the DHT22 has no valid sample. |
| GET | `/scale/latest?device_id=` | JWT + commercial/service account; `{deviceId, grams, stable, temperatureC, humidityPercent, source, timestamp, online, readings, rejected}`. `device_id` defaults to legacy `scale1` |
| POST | `/scale/simulate` | venue fallback: fabricates a fresh **server-side** stable reading |
| POST | `/scale/stock/:id/weigh` | `{mode:"set"\|"add", deviceId?, containerWeight?}` - fresh (<3 s) + stable required (409s); uses paired device tare if containerWeight omitted; net ≥ 0 (400) → stock updated + audit |
| GET | `/scale/reweigh/:itemId?device_id=` | expected (app) vs measured net scale weight diff + last meal deduction - the post-cook accuracy check |

Physical ESP8266/ESP32 firmware posts weights and DHT22 environment data through the same device-key-authenticated route. The server persists timestamped history using the selected database driver; readings do not change pantry stock without the existing user-confirmed tare / set-total / add-to-stock flow. Firmware, exact wiring, calibration and local-network setup: [`hardware/README.md`](../hardware/README.md). Express listens on `0.0.0.0` on the configured port (default `5000`) for LAN/hotspot access; the normal local frontend URL remains unchanged.

Example physical payload (the two DHT22 fields can be omitted when no environment sample is available):

```json
{
  "device_id": "kitchensync-scale-01",
  "grams": 123.4,
  "stable": true,
  "temperature_c": 27.5,
  "humidity_percent": 61.2
}
```

## Analytics & notifications

| Method | Path | Notes |
|---|---|---|
| GET | `/analytics/summary` | Counts, est. value, accuracy, spend trend (6w), category split, top depleted, wastage |
| GET | `/analytics/logs` | Audit trail (last 50) |
| GET | `/notifications` | Computed reminders: expired / expiring ≤7d / out / low / planner gaps / budget |
| POST | `/notifications/read-all` | Mark all read |

## Misc

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{ok, app, version, time}` (no auth) |

---

## v2 additions

### Dashboard (one-shot home payload)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/dashboard` | today's meals (+stock chips, done state), pre-meal alert ("Breakfast: missing Paneer"), use-soon strip (≤3d, ₹ value), stats, budget snapshot |

### Planner v2
| Method | Path | Notes |
|---|---|---|
| GET | `/api/planner` | rolling plan starting TODAY; per-meal `why` explainers, `stockChip`, `locked`, `done`, `deductions`; summary has `budget {budget,totalCost,fits,pct,message}`, `cheaperSwaps`, needs only for today→future |
| POST | `/api/planner/generate` | re-optimize; **locked slots survive** |
| PUT | `/api/planner/slot` | manual swap `{date,slot,key}` |
| POST | `/api/planner/lock` | `{date,slot,locked}` |
| POST | `/api/planner/copy-day` | `{from,to}` |
| POST | `/api/planner/mark-done` | **idempotent**; deducts clamped-to-stock amounts; returns `deductions[]` + `shortfall[]` |
| POST | `/api/planner/unmark` | **Undo** - restores deducted quantities |
| POST | `/api/planner/sync-shopping` | pushes plan shortages into the shopping list (merged/deduped) |

### Shopping v2
| Method | Path | Notes |
|---|---|---|
| GET | `/api/shopping/list` | now returns `auto`, `saved` (merged by key with `sources[]`), `planNeeds` |
| POST | `/api/shopping/sync-plan` | same sync from the shopping side |
| POST | `/api/shopping/items/:id/bought` | **Mark bought → adds to kitchen stock** + audit log |
| POST | `/api/shopping/share` | WhatsApp-ready text + `whatsappUrl` |
| POST | `/api/shopping/compare` | per-item quotes now carry `sanity` flags; per-unit price capped at ₹2,000 |

### Recipes v2
| Method | Path | Notes |
|---|---|---|
| GET | `/api/recipes` | every recipe now has `nutrition {protein,carbs,fat,fiber}`, `ratingLabel:"editorial"`, `source`; supports `?gym=1&sort=protein` |
| GET | `/api/recipes/gym` | goal-aware (`?goal=cut|bulk|maintain`), protein-density ranking + advice |
| POST | `/api/recipes/estimate` | **AI quantity estimation** (z-ai SDK; heuristic fallback labeled `engine:"heuristic"`) |
| POST | `/api/recipes` | create custom recipe; ingredients can carry `estimated:true` (editable) |

### IoT / Devices
| Method | Path | Notes |
|---|---|---|
| GET | `/api/devices` | paired containers + latest gross/net weight, stability, temperature, humidity, physical/simulator source, last reading, connectivity, conflicts |
| POST | `/api/devices` | pair container `{name, hardwareId?, pantryItemId?}`. Set `hardwareId` equal to firmware `device_id` for physical sensors; omit for simulator |
| POST | `/api/devices/:id/link` | `{pantryItemId}` |
| POST | `/api/devices/:id/tare` | zero the scale |
| POST | `/api/devices/:id/simulate` | `{mode:"drift|empty|refill|nonsense"}` - venue fallback; nonsense readings are rejected and flagged |
| GET | `/api/devices/:id/history` | up to 200 persisted readings: weight, stability, temperature and humidity time-series |
| POST | `/api/devices/conflicts/:deviceId/resolve` | `{use:"sensor"|"app"}` |

### Members, activity, receipts
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/members` | household members with `role: admin|member`, `type: adult|child` |
| PATCH/DELETE | `/api/members/:id` | update/remove |
| GET | `/api/analytics/activity` | "who added/used/changed what, when" feed |
| GET | `/api/analytics/summary` | + `categoryValue[].value` (₹), `wastage.wastedValue`, `accuracyHistory[]` |
| POST | `/api/receipts/*` | receipt scan + expiry checker moved to `/api/receipts/*` (see top) |
| POST | `/api/scale/*` | load-cell weighing station endpoints (see top) |

### Auth
| Method | Path | Notes |
|---|---|---|
| PUT | `/api/auth/me` | now also accepts `prefs {lang:"en"|"hi", theme}` and `household.goal` |

**Persistence modes** (selected by `db/index.js`): `MONGO_URI` → MongoDB/Mongoose (persistent) · `KS_DEMO_MEMORY=1` → in-memory demo · default → **persistent file store** (`db/kitchensync-store.json`). Sandbox bootstrap: `bash scripts/ensure-mongo.sh` starts a persistent mongod (data in `db/mongo-data`).
