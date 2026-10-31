<div align="center">

# KitchenSync (PS-5)

**Your kitchen, perfectly in sync.**

Smart kitchen inventory · optimized meal planning · multi-store price comparison · IoT containers
Node.js + Express + MongoDB (Mongoose models) · React (Vite) · FastAPI model service · ESP32 + HX711 load cell

</div>

---

## Account-specific workspaces (current)

New accounts choose one workspace at sign-up: **Household**, **Commercial kitchen** (restaurant, cloud kitchen, or café), or **Food service** (tiffin centre or PG). New accounts complete a short profile before reaching the dashboard; existing accounts keep their saved workspace and go straight to the app.

- **Household:** onboarding collects adult/child counts, each person’s diet and allergies, regional cuisine, food practice (Jain, Satvik, or Halal), address, and nutrition targets. The workspace has Dashboard, Recipes, Meal Planner, Shopping, Scan & Detect (marked Premium), and Profile. Household inventory hides estimated kitchen value and storage devices; categories scroll horizontally and stock cards live in a bounded scroll panel. Premium Insights & Accuracy and Wastage Watch are presented as premium features.
- **Commercial kitchen:** onboarding collects restaurant/cloud kitchen/café type, outlet name, location, and daily servings. It has Dashboard, Recipes, Shopping, Scan & Detect, Storage (weighing and storage points), Insights & Accuracy, Vendor Restocking, and Profile. Store comparison is not offered; low stock and saved shopping items can be prepared as a WhatsApp message for a saved supplier.
- **Food service:** onboarding is tailored to tiffin centres and PGs, then opens the commercial operations workspace with the service type and daily servings in the profile.
- **Household nutrition:** log an outside meal’s calories and protein for a selected person. Remaining daily targets update immediately, and recipe suggestions respect that person’s food preferences and calorie budget. Profile changes regenerate the household plan.
- **Price comparison:** household comparisons show required quantities, pack counts, estimated basket cost, and unit price together. The inventory freshness index uses expiry dates for fruit and vegetables. Shopping-list copy writes to the clipboard without displaying the copied text.

Premium labels in this local prototype are UI classifications; subscription billing and entitlement checks are not implemented.

---

## What's new in v3 (latest changes)

1. **Price comparison** - use Rewalto live listings by delivery PIN to compare collected store offers by pack quantity and effective price, then open the retailer's product page.
2. **Barcode is gone.** The Scan page now has exactly two tools, both camera-only:
   - **Expiry date checker** - photograph the date printed on the pack → the model reads it → you review → it lands on the right stock item with a 7-day reminder armed. Can't read it? "Retake or type the date manually" - it never guesses.
   - **Receipt scanner** - the full real flow: `phone camera → POST /api/receipts/scan → model service (Python/FastAPI, hard timeout) → unit parsing + fuzzy match → review screen → POST /api/receipts/confirm → stock`. SHA-256 duplicate protection (the same bill can never double your stock), amber rows under 0.7 confidence, editable qty/unit/price/match, and honest failure cards ("Couldn't read this receipt. Retake, or add items manually.").
3. **Load-cell weighing station is a first-class citizen** - ESP32 + HX711 firmware ships in `hardware/`; the backend keeps the **server-side latest reading** (`POST /api/scale/reading` with `x-device-key`), the Devices page shows the live weight with Stable ✅ / Settling… badges, and "Add weight to stock" (Set total / Add to existing, container tare) is rejected if the reading is stale or unstable. "Simulate sensor" keeps the demo alive without hardware. Post-cook re-weigh check: expected vs measured, diff in grams.
4. **Models for everything new** - `Receipt` (duplicate guard + review trail) and `ScaleState` join the Mongoose schema registry; every stock change still lands in the audit log.

---

## What's new in v2 (mapped to the review notes)

### P0 — fixed before anything else

| # | Issue | Fix |
|---|---|---|
| 1 | **Persistence** — in-memory store wiped on restart | **Real MongoDB** (Mongoose models in `backend/src/models/`). Sandbox runs a persistent `mongod` (data on disk in `db/mongo-data`); local dev: Atlas SRV string, local mongod, or the zero-config **persistent file driver** fallback. `MONGODB LIVE` badge in the sidebar tells the truth. |
| 2 | **Unit/price bug** — Hakka Noodles "400 pc @ ₹24,000" | Root cause: recipe used `g` while catalog said `pc`. Catalog units corrected, all 38 recipes validated against catalog unit families (0 mismatches, enforced by test), plus **price sanity guards**: per-unit cap (₹2,000), per-line cap (₹5,000) with "check unit" flags in UI + capped estimates. |
| 3 | **Budget contradiction** — ₹1,500 budget vs ₹27,395 plan | Budget is now a **first-class planner constraint**: "Plan fits budget ✅ ₹1,340 / ₹1,500" or an over-budget warning with a progress bar and **cheaper-swap suggestions** ("Swap Chicken Biryani → Dal Tadka on Sat - saves ~₹310"). |
| 4 | **Plan started Monday** while today was Saturday | Planner generates **from today**, always. Past days render greyed out, are excluded from "to buy", and cooked meals are excluded too. |
| 5 | **Broken loop** — planner shortages never reached the shopping list | "Sync shortages to list" on the planner AND "Shortages from your meal plan" card on Shopping (one tap adds all). Compare-prices works straight from the synced list. |
| 6 | **Empty demo data** | Seed v2: 46 pantry items (low/out/expiring/**one expired**), 3 days of usage history, 2 past orders, 2 reconciliations, 3 IoT containers with 24h of readings, favorites and an activity feed - every chart is alive on first boot. |
| 7 | **Mark meal done → auto-deduct** | Baseline done right: **Mark done** (dashboard + planner) deducts per-ingredient amounts, **shows exactly what was deducted**, flags shortfalls, **clamps at 0** and is **idempotent** (double-tap can't double-deduct). **Undo** restores everything. |

### P1 — core features

- **Dashboard**: Today's Meals card (stock chips + Mark done + Undo), **Use soon** strip (≤3 days, with ₹ value), **pre-meal alert** ("Breakfast: missing Paneer" with a Fix it button), animated stat cards.
- **Recipes**: protein/carbs/fat/fiber on every recipe (library + detail), **Gym mode** (protein sort, protein-density, cut/bulk/maintain advice), **Add recipe** flow with **AI quantity estimation** (z-ai SDK; labeled "estimated, editable" with heuristic fallback), ratings labeled **(editorial)**.
- **Planner**: manual **swap** modal (with coverage badges), **copy day**, **lock** (re-optimize keeps locked meals), per-meal stock chips, per-meal **"Why this meal"** explainers, budget bar, sync to list.
- **Stock**: edit + delete with units/conversion, expiry + category filters, threshold markers (already in v1, kept + polished).
- **Shopping**: grouped by category, duplicates merged, **Mark bought → stock update**, **WhatsApp share + copy list**, plus a separate **Price Compare** page for Rewalto live listings by PIN with availability signals and retailer links.
- **Profile**: account and kitchen details, household members with roles (admin/member, adult/child), language, theme, inventory export, budget and fitness goal.
- **Kitchen profiles (earlier version)**: profile edits support kitchen preferences and household members; the current account-specific workspace flow above replaces the earlier sign-up questionnaire.

### P2 — bonus points

1. **Storage page** (`#/devices` for commercial and food-service workspaces): per-container live weight, battery, Wi-Fi, last seen, sensor-vs-app conflict cards, weight-over-time chart, Tare calibration, simulated sensor readings, and sensor-to-stock linking.
2. **Stock accuracy**: accuracy % from physical counts, **accuracy-over-time chart**, biggest-gap items in the audit trail, reconciliation history seeded, sensor-vs-expected evidence trail.
3. **Scan & Detect**: barcode → stock (USB HID + camera + Open Food Facts), **receipt scan** (local PaddleOCR image extraction or local text parsing → review → stock), produce auto-detect (on-device MobileNet), and clear retry/manual-entry feedback.
4. **Insights**: Stock-by-category **₹ value chart**, **wastage watch with money wasted**, spend trend (labeled simulated), activity feed.
5. **Activity log**: "who added, used or changed what, and when" - members' actions are attributed (flatmates bonus).

### Edge cases handled (all covered by `backend/scripts/v2-test.js`)

Double mark-done (idempotent) · over-deduction clamps to 0 + flags shortfall · undo restores exactly · recipe/stock unit families validated (g vs pc impossible now) · household rescale on change · AI down → heuristic fallback · nonsense sensor reading → rejected + device marked stale · plan shortages always reach the shopping list.

---

## Tech stack

**Backend** - Node.js, Express 4, MongoDB via Mongoose 8 (schema-per-file in `src/models/`), JWT (bcryptjs + jsonwebtoken), driver abstraction: mongo (persistent) / **file** (persistent, zero-config) / memory (demo). **Vision**: receipts + expiry dates via a Python/FastAPI model service (`model-service/`) with local PaddleOCR PP-OCRv5 mobile CPU weights; receipt photos are not sent to cloud vision. **Hardware**: ESP32 + HX711 load-cell station (`hardware/`).
**Frontend** - React 18 (Vite), React Router (hash), Framer Motion, Recharts, i18n (EN/हिं), hand-rolled CSS design system (Fraunces + Inter, dark + cream-light).
**ML** - `ml/train-produce-model/` Keras transfer-learning pipeline with TFJS export.

## Folder structure

```
kitchensync/
├── backend/
│   ├── scripts/
│   │   ├── ensure-mongo.sh        # persistent mongod bootstrap (sandbox + local)
│   │   ├── dev-mongo.js           # ephemeral mongo for quick local dev
│   │   ├── v2-test.js             # 48-check API suite incl. edge cases
│   │   └── smoke-test.sh          # smoke test
│   ├── .env.example               # MONGO_URI / MODEL_SERVICE_URL / DEVICE_KEY
│   └── src/
│       ├── server.js              # boot + static frontend serving
│       ├── app.js                 # routes + middleware wiring
│       ├── config/env.js
│       ├── models/                # ← Mongoose schemas, one per file (source of truth)
│       │   ├── index.js           #    registry
│       │   ├── User.js  PantryItem.js  Recipe.js  MealPlan.js
│       │   ├── ShoppingList.js  Cart.js  AuditLog.js  ActivityLog.js
│       │   ├── Device.js  DeviceReading.js  Reconciliation.js
│       │   └── Receipt.js  ScaleState.js   # v3: scan trail + weighing station
│       ├── db/                    # driver layer (same tiny collection API)
│       │   ├── index.js           #    mongo → file → memory selection
│       │   ├── mongoDriver.js     #    Mongoose, uses models/
│       │   ├── fileDriver.js      #    persistent JSON store (atomic writes)
│       │   ├── memoryDriver.js    #    in-memory demo
│       │   └── seedRunner.js      #    realistic v2 seed + history
│       ├── data/                  # catalog (87 items), recipes (38), nutrition
│       ├── middleware/            # JWT auth (+ ObjectId guard), errors
│       ├── services/              # planner (optimizer+deductions+budget), price (4 stores + sanity),
│       │                          # receipt (units + fuzzy match + confirm), model client (timeout),
│       │                          # availability, analytics, ai (z-ai), iot, activity
│       ├── routes/                # auth, dashboard, pantry, recipes, planner, shopping (+deep-link handoff),
│       │                          # receipts (scan/confirm/expiry), scale (reading/latest/weigh/reweigh),
│       │                          # analytics, notifications, devices, members
│       └── utils/                 # dates, units (g/kg/ml/l/pc), text (Hindi+English synonyms), fuzzy (Dice)
├── frontend/
│   └── src/
│       ├── api/client.js          # axios + JWT interceptor (+ gateway port shim)
│       ├── i18n.js                # EN/हिं dictionary
│       ├── context/AppContext.jsx # auth, theme, language, toasts, notifications
│       ├── components/            # Layout, StockCard, AddItemModal, PriceTable, NotificationBell…
│       ├── pages/                 # Login, Dashboard, Recipes, RecipeDetail, Planner, Shopping (deep-link handoff),
│       │                          # Scan (expiry checker + receipt scanner), Devices (+weighing station), Analytics, Profile
│       └── styles/global.css      # design system (dark + cream-light, Fraunces/Inter)
├── model-service/                 # Local Python/FastAPI PaddleOCR service (receipts + expiry)
├── hardware/                      # ESP32 + HX711 firmware, wiring, calibration, venue tips
├── docs/API.md                    # REST reference
├── ml/train-produce-model/        # custom produce-model training pipeline
```

## Run locally with `runner.bat` (Windows)

KitchenSync runs entirely on your laptop. The Node.js backend serves the built website and API together at `http://localhost:5000`, and the local PaddleOCR service runs alongside it on `127.0.0.1:8000`. No cloud deployment or external database is required. The default JSON database persists at `db/kitchensync-store.json` and is local-only.

### One-time setup

Install **Node.js 18+** and **Python 3.11–3.13**. From Command Prompt in the repository folder, run:

```bat
npm --prefix backend ci --omit=dev --ignore-scripts
npm --prefix frontend ci
npm --prefix frontend run build
py -3 -m venv model-service\.venv
model-service\.venv\Scripts\python.exe -m pip install --upgrade pip
model-service\.venv\Scripts\python.exe -m pip install -r model-service\requirements.txt
model-service\.venv\Scripts\python.exe model-service\setup_models.py
```

The final command downloads the pretrained PaddleOCR detector and English recognizer once. They are stored under `model-service/.receipt-models/`; after setup, receipt OCR runs locally without sending receipt images to a cloud OCR service.

### Start the app

In Command Prompt, from the repository folder:

```bat
runner.bat
```

The launcher opens separate Command Prompt windows for the OCR model and KitchenSync API, then opens `http://localhost:5000` in your browser. Keep both service windows open while using the app. To stop it, press **Ctrl+C** in both windows. Stop any previous KitchenSync windows before running `runner.bat` again.

Demo login: **demo@kitchensync.app / demo1234** (or choose **Explore the demo kitchen**). Receipt scans show editable results for review; stock changes only after you confirm them.

### Troubleshooting

- If `runner.bat` reports a missing dependency, rerun the matching one-time setup command above.
- If the UI build is missing or stale, run `npm --prefix frontend run build` again.
- If port 5000 or 8000 is already in use, stop the older KitchenSync service windows before restarting.
- To use MongoDB instead of the default persistent local JSON database, configure `MONGO_URI` in `backend/.env` before launch. The launcher does not require MongoDB.

### Optional development mode

For frontend hot reload, use two Command Prompt windows after the one-time dependency setup:

```bat
npm --prefix backend run dev
npm --prefix frontend run dev
```

The Vite development UI runs on port 5173 and proxies API requests to the backend on port 5000.

## The honest bits (for judges)

| Component | Status |
|---|---|
| Sample basket estimates (Instamart/Blinkit/Zepto/BigBasket) | Deterministic simulator for the demo cart; it stays labelled simulated. |
| Live grocery listings | Rewalto Core listing search, keyed by a delivery PIN, cached for 7 days in the backend process. Only compatible packs contribute to basket totals; unknown stock is not represented as confirmed in stock. Product links open the retailer listing where provided. Configure `MULTISTOREAPI` in `backend/.env`. |
| **Ordering on the real stores** | **Deep-link hand-off** - each list item opens its pre-filled search page on the store; there is no public cart API, so the cart tap happens in the store's own app. Copy-ready list text included. |
| **Receipt scan** | Photo → local PaddleOCR PP-OCRv5 mobile CPU model → unit parsing + fuzzy matching → **human review** → stock. SHA-256 duplicate guard. Receipt images are not sent to cloud OCR/vision APIs. |
| **Expiry date checker** | Photo → model/vision → **editable review** → item expiry + reminder. Refuses to guess: no readable date → "retake or type it manually". |
| **Load-cell weighing station** | **Real hardware path**: ESP32 + HX711 firmware in `hardware/`, server-side latest reading, stability + freshness + plausibility guards, audit trail. No hardware at the venue? "Simulate sensor" posts a server-side reading - labeled as such. |
| Recipe quantity estimation | **AI (z-ai SDK)** with deterministic fallback, flagged "estimated, editable". |
| IoT smart containers | **Simulated hardware**, real API surface (`/api/devices/*`), nonsense-guard, conflicts, audit. |
| Meal planner, portions, budget, alternates, thresholds, expiry reminders, accuracy, activity | **Real** - computed from your actual data in MongoDB. |
| Spend trend | Simulated (deterministic) until real order history accumulates - labeled. |

## Slide: "What we deliberately did not build"

- **Real quick-commerce checkout** - the live comparison links to store listings where Rewalto returns a URL; the app does not place an order for you. The separate simulated cart remains a demo, and the deep-link hand-off still opens item searches in Instamart/Blinkit/Zepto/BigBasket.
- **Real scraped prices** - ToS + geo-fragile. Deterministic simulator behind one swappable file, clearly labeled everywhere.
- **Barcode scanning** - dropped on purpose: barcodes identify the *product*, not *your* pack's freshness. The phone-camera **expiry date checker** + **receipt scanner** cover the actual jobs (what is it, how much, until when) with zero extra hardware.
- **Fridge camera item recognition** - beyond scope for the demo window; the model-service contract is ready if you want to add it.
- **Full nutrition tracking (micros, BMR math)** - we ship protein/carbs/fat/fiber per recipe + gym goals; a full dietitian engine is a separate product.
- **A proprietary receipt OCR model trained from scratch** - KitchenSync uses an official pretrained PP-OCRv5 mobile model locally; no custom model training is claimed.

## API

Full reference: **docs/API.md**. 45+ endpoints under `/api` (JWT Bearer), plus `backend/scripts/v2-test.js` (48 checks incl. edge cases) and `scripts/smoke-test.sh` (22 checks).

## Hardware notes

- **Load-cell weighing station**: ESP32 + HX711 + bar load cell → firmware in `hardware/esp32_scale/esp32_scale.ino` (library "HX711" by bogde) POSTs `{device_id, grams, stable}` to `/api/scale/reading` with the `x-device-key` header every 0.5 s. Wiring, mechanical build, calibration and venue tips: `hardware/README.md`. The Devices page shows the live weight with Stable ✅ / Settling… badges and "Set total / Add to existing" weigh-ins; "Simulate sensor" is the no-hardware fallback.
- **Receipt + expiry capture**: plain `<input type="file" accept="image/*" capture="environment">` - opens the rear camera on Android/iPhone without HTTPS. Images go to `/api/receipts/*`; nothing enters stock without the review + Confirm tap.
- **Venue Wi-Fi**: use your phone's hotspot; put the backend's LAN IP in the firmware. If the ESP32 can't reach the server, the UI shows "scale offline" and Simulate keeps the demo alive.

---

### Bonus features beyond the problem statement

1. JWT auth + multi-user **households with roles** 2. Expiry reminders + **notification center** 3. **Stock accuracy** (reconciliations + accuracy-over-time + post-cook re-weigh) 4. Wastage & spend **analytics in ₹** 5. Budget **constraint in the planner** with cheaper swaps 6. Diet/taste/allergy personalization 7. FIFO use-first scheduling 8. Units engine (g/kg/ml/L/pc + sanity caps) 9. Hindi + English synonym matching 10. CSV export 11. **Dark + cream-light themes**, Fraunces editorial type 12. Zero-config **persistent** demo mode + dev-mongo + ensure-mongo 13. **Deep-link order hand-off** to 4 real stores 14. Pluggable price-provider adapters 15. Simulated delivery loop 16. **Activity log** (who did what) 17. **Hindi/English UI toggle** 18. **Gym corner** with macro intelligence 19. **Receipt scanner + expiry date checker** with review-before-apply 20. REST API docs + automated checks
