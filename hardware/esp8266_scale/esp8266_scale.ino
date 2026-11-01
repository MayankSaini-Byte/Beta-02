/*
 * KitchenSync physical weighing scale
 * Board: ESP8266 NodeMCU (ESP-12E)
 * Hardware: HX711 + 5 kg load cell
 *
 * HX711 wiring (GPIO numbers):
 *   DT/DOUT -> GPIO12 (D6), SCK/CLK -> GPIO14 (D5)
 *   VCC -> 3V3, GND -> GND
 * Load cell: red -> E+, black -> E-, green -> A+, white -> A-
 *
 * Put local Wi-Fi and device values in secrets.h. Do not commit that file.
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include "HX711.h"
#include "secrets.h"

constexpr uint16_t SERVER_PORT = 5000;
const char* API_PATH = "/api/scale/reading";

#define HX711_DOUT 12  // GPIO12 / D6
#define HX711_SCK  14  // GPIO14 / D5

// Calibrate this value with a known mass before relying on the readings.
constexpr float CALIBRATION_FACTOR = 420.0f;
constexpr uint32_t SEND_INTERVAL_MS = 2000;
constexpr uint32_t WIFI_RETRY_INTERVAL_MS = 10000;
constexpr uint8_t STABILITY_SAMPLES = 10;
constexpr float STABILITY_RANGE_GRAMS = 2.0f;

HX711 scale;
WiFiClient wifiClient;

float samples[STABILITY_SAMPLES] = {};
uint8_t sampleIndex = 0;
uint8_t samplesCollected = 0;
uint32_t lastSendMs = 0;
uint32_t lastWifiAttemptMs = 0;
bool scaleTared = false;

void maintainWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - lastWifiAttemptMs < WIFI_RETRY_INTERVAL_MS) return;

  lastWifiAttemptMs = millis();
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("[WiFi] Connecting/reconnecting to %s...\n", WIFI_SSID);
}

bool isStable() {
  if (samplesCollected < STABILITY_SAMPLES) return false;
  float lowest = samples[0];
  float highest = samples[0];
  for (uint8_t i = 1; i < STABILITY_SAMPLES; ++i) {
    if (samples[i] < lowest) lowest = samples[i];
    if (samples[i] > highest) highest = samples[i];
  }
  return (highest - lowest) <= STABILITY_RANGE_GRAMS;
}

String makePayload(float grams, bool stable) {
  String payload;
  payload.reserve(100);
  payload = "{\"device_id\":\"";
  payload += DEVICE_ID;
  payload += "\",\"grams\":";
  payload += String(grams, 1);
  payload += ",\"stable\":";
  payload += stable ? "true" : "false";
  payload += "}";
  return payload;
}

void postReading(float grams, bool stable) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Not sent: Wi-Fi is offline.");
    return;
  }

  HTTPClient http;
  http.setTimeout(3000);
  const String url = String("http://") + SERVER_HOST + ":" +
                     String(SERVER_PORT) + API_PATH;

  if (!http.begin(wifiClient, url)) {
    Serial.println("[HTTP] Could not open KitchenSync URL.");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);
  const int status = http.POST(makePayload(grams, stable));

  if (status == 204) {
    Serial.println("[HTTP] Reading accepted by KitchenSync (204).");
  } else if (status > 0) {
    Serial.printf("[HTTP] KitchenSync returned %d\n", status);
    const String response = http.getString();
    if (response.length()) Serial.println(response);
  } else {
    Serial.printf("[HTTP] Request failed: %s\n", http.errorToString(status).c_str());
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("[KitchenSync] ESP8266 scale starting.");

  scale.begin(HX711_DOUT, HX711_SCK);
  scale.set_scale(CALIBRATION_FACTOR);
  Serial.println("[HX711] Leave the platform empty for startup tare.");

  const uint32_t tareStartedMs = millis();
  while (!scale.is_ready() && millis() - tareStartedMs < 8000) delay(20);
  if (scale.is_ready()) {
    scale.tare(15);
    scaleTared = true;
    Serial.println("[HX711] Startup tare complete.");
  } else {
    Serial.println("[HX711] Not ready; tare will retry when it responds.");
  }

  WiFi.persistent(false);
  WiFi.setSleepMode(WIFI_NONE_SLEEP);
  lastWifiAttemptMs = millis() - WIFI_RETRY_INTERVAL_MS;
  maintainWiFi();
  Serial.println("[KitchenSync] Setup complete. Serial Monitor: 115200 baud.");
}

void loop() {
  maintainWiFi();

  if (!scale.is_ready()) {
    delay(10);
    return;
  }

  if (!scaleTared) {
    Serial.println("[HX711] Retrying tare; keep platform empty.");
    scale.tare(15);
    scaleTared = true;
    Serial.println("[HX711] Tare complete.");
    return;
  }

  if (millis() - lastSendMs < SEND_INTERVAL_MS) {
    delay(5);
    return;
  }
  lastSendMs = millis();

  float grams = scale.get_units(3);
  if (grams < 0.0f && grams > -2.0f) grams = 0.0f;
  samples[sampleIndex] = grams;
  sampleIndex = (sampleIndex + 1) % STABILITY_SAMPLES;
  if (samplesCollected < STABILITY_SAMPLES) ++samplesCollected;

  const bool stable = isStable();
  Serial.printf("[SCALE] %.1f g | %s\n", grams, stable ? "STABLE" : "SETTLING");
  postReading(grams, stable);
}
