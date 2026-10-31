/*
 * KitchenSync load-cell weighing station
 * ESP32 + HX711 + bar load cell -> POSTs stable net weight to the Node backend.
 *
 * Library: "HX711" by bogde (Arduino Library Manager)
 * Board:   any common 30-pin ESP32 dev board
 *
 * The backend keeps the latest reading server-side; the browser only reads it,
 * so the value applied to stock can't be faked by the client or go stale.
 * Backend endpoint contract (see backend/src/routes/scale.routes.js):
 *   POST /api/scale/reading   header x-device-key   body { device_id, grams, stable }
 *   -> 204 on accepted, 401 bad key, 422 implausible reading
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include "HX711.h"

// ---- Wi-Fi (venue tip: use your phone's hotspot for laptop + ESP32 + phone) ----
const char* WIFI_SSID  = "YOUR_WIFI";
const char* WIFI_PASS  = "YOUR_PASS";

// ---- Backend (LAN IP of the laptop running the backend, NOT localhost) ----
const char* SERVER     = "http://192.168.1.20:5000/api/scale/reading";
const char* DEVICE_KEY = "secret-device-key";   // must match backend DEVICE_KEY env

// ---- Pins (HX711 -> ESP32) ----
const int DT       = 16;   // HX711 DT  -> GPIO 16
const int SCK_PIN  = 4;    // HX711 SCK -> GPIO 4
const int TARE_BTN = 13;   // optional push button to GND

float CAL_FACTOR = 420.0;  // set after calibration (see hardware/README.md)

HX711 scale;
float buf[10];
int bi = 0;

void setup() {
  Serial.begin(115200);
  pinMode(TARE_BTN, INPUT_PULLUP);
  scale.begin(DT, SCK_PIN);
  scale.set_scale(CAL_FACTOR);
  scale.tare();                       // assume the empty platform is zero
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(300); Serial.print('.'); }
  Serial.println("\n[WiFi] connected");
}

void loop() {
  // physical tare button (one leg GPIO 13, other leg GND)
  if (digitalRead(TARE_BTN) == LOW) { scale.tare(); delay(500); }

  float g = scale.get_units(5);       // average of 5 reads
  if (g < 0 && g > -2) g = 0;         // absorb tiny negative drift
  buf[bi++ % 10] = g;

  // stability: within 2 g over the last 10 reads
  float mn = buf[0], mx = buf[0];
  for (int i = 1; i < 10; i++) { mn = min(mn, buf[i]); mx = max(mx, buf[i]); }
  bool stable = (mx - mn) < 2.0 && bi >= 10;

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SERVER);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-key", DEVICE_KEY);
    String body = "{\"device_id\":\"scale1\",\"grams\":" + String(g, 1) +
                  ",\"stable\":" + (stable ? "true" : "false") + "}";
    int code = http.POST(body);
    http.end();
    if (code != 204) Serial.printf("[http] POST -> %d\n", code);
  }
  delay(500);
}

/*
 * CALIBRATION (do this once - full walkthrough in hardware/README.md):
 *   1. Upload with CAL_FACTOR = 1.0, tare with the platform empty.
 *   2. Read the raw value over Serial with a known weight on it (e.g. 500 g).
 *   3. CAL_FACTOR = raw_reading / known_weight_in_grams.
 *   4. Verify with 2-3 other known weights; aim for ±2 g.
 *
 * If weight goes DOWN when you press: swap A+ and A- on the HX711,
 * or just use a negative CAL_FACTOR.
 */
