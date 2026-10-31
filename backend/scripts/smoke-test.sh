#!/bin/bash
# KitchenSync API smoke test
BASE="${BASE:-http://localhost:5000}/api"
PASS=0; FAIL=0

check() {
  local name="$1" expected="$2" actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    PASS=$((PASS+1)); echo "PASS: $name"
  else
    FAIL=$((FAIL+1)); echo "FAIL: $name -> $actual" | head -c 400; echo
  fi
}

TOKEN=$(curl -s -X POST $BASE/auth/demo | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
AUTH="Authorization: Bearer $TOKEN"
echo "token: ${TOKEN:0:25}..."

R=$(curl -s $BASE/pantry -H "$AUTH"); check "GET /pantry" '"stats"' "$R"
R=$(curl -s $BASE/pantry -H "$AUTH"); check "pantry has alerts" '"expiringSoon"' "$R"
R=$(curl -s "$BASE/recipes?cookable=1" -H "$AUTH"); check "GET /recipes cookable" '"coverage"' "$R"
R=$(curl -s "$BASE/recipes/dal-tadka" -H "$AUTH"); check "GET recipe detail" '"youtubeUrl"' "$R"
R=$(curl -s "$BASE/recipes/dal-tadka" -H "$AUTH"); check "recipe scaled servings" '"forHousehold"' "$R"
R=$(curl -s -X POST $BASE/planner/generate -H "$AUTH" -H 'Content-Type: application/json' -d '{}'); check "POST planner/generate" '"avgCoverage"' "$R"
R=$(curl -s $BASE/planner -H "$AUTH"); check "GET planner" '"summary"' "$R"
R=$(curl -s $BASE/planner -H "$AUTH"); check "planner needs" '"toBuyCount"' "$R"
R=$(curl -s -X POST $BASE/planner/order -H "$AUTH" -H 'Content-Type: application/json' -d '{}'); check "POST planner/order cart" '"providerName"' "$R"
R=$(curl -s $BASE/shopping/list -H "$AUTH"); check "GET shopping list auto" '"Out of stock"' "$R"
R=$(curl -s -X POST $BASE/shopping/compare -H "$AUTH" -H 'Content-Type: application/json' -d '{"items":[{"key":"milk","name":"Milk","qty":2000,"unit":"ml"},{"key":"paneer","name":"Paneer","qty":500,"unit":"g"}]}'); check "POST compare basket" '"bestProvider"' "$R"
CART=$(curl -s -X POST $BASE/shopping/cart -H "$AUTH" -H 'Content-Type: application/json' -d '{"providerId":"zepto","items":[{"key":"milk","name":"Milk","qty":2000,"unit":"ml"}]}'); check "POST cart" '"total"' "$CART"
R=$(curl -s -X POST $BASE/shopping/cart/checkout -H "$AUTH"); check "POST checkout" '"orderId"' "$R"
R=$(curl -s -X POST $BASE/shopping/cart/receive -H "$AUTH"); check "POST receive delivery" '"added"' "$R"
R=$(curl -s $BASE/receipts/accuracy -H "$AUTH"); check "receipt self-test (items + units)" '"unitTests"' "$R"
R=$(curl -s -X POST $BASE/receipts/demo -H "$AUTH" -H 'Content-Type: application/json' -d '{"text":"KIRANA STORE\nAmul Butter 500G 275.00\nMilk 1L 66.00\nTOTAL 341.00"}'); check "receipt scan -> review" '"receiptId"' "$R"
R=$(curl -s -X POST $BASE/shopping/handoff -H "$AUTH" -H 'Content-Type: application/json' -d '{"providerId":"instamart","items":[{"name":"Milk","qty":1000,"unit":"ml"}]}'); check "deep-link handoff" 'swiggy.com/instamart/search' "$R"
R=$(curl -s $BASE/notifications -H "$AUTH"); check "GET notifications" '"severity"' "$R"
R=$(curl -s $BASE/analytics/summary -H "$AUTH"); check "GET analytics" '"spendTrend"' "$R"
R=$(curl -s -X POST $BASE/pantry/reconcile -H "$AUTH" -H 'Content-Type: application/json' -d '{"counts":[]}'); check "reconcile empty" '"accuracy"' "$R"
R=$(curl -s -X PUT $BASE/auth/me -H "$AUTH" -H 'Content-Type: application/json' -d '{"household":{"adults":2,"children":2,"diet":"veg"}}'); check "PUT profile" '"children":2' "$R"
R=$(curl -s -X POST $BASE/pantry -H "$AUTH" -H 'Content-Type: application/json' -d '{"name":"Honey","quantity":500,"unit":"g"}'); check "add custom item" '"Honey"' "$R"

echo "-------------------------"
echo "PASS=$PASS FAIL=$FAIL"
