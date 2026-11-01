/*
 * KitchenSync physical sensor node: ESP32 + HX711 + 5 kg load cell + DHT22.
 *
 * Wiring (ESP32 DevKit V1):
 *   HX711 DT -> GPIO16, SCK -> GPIO4, VCC -> 3V3, GND -> GND
 *   DHT22 DATA -> GPIO22, VCC -> 3V3, GND -> GND
 *   Active buzzer + -> GPIO21, - -> GND
 *   Load cell: Red E+, Black E-, Green A+, White A-
 *
 * Pair a physical device in KitchenSync's Devices page and set DEVICE_ID to
 * the same Physical Device ID. Configure Wi-Fi, laptop LAN IP and DEVICE_KEY
 * below before uploading. Never commit real credentials to the repository.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>
#include "HX711.h"
#include <DHT.h>
#include "secrets.h"

// -------- Local network configuration --------
constexpr uint16_t SERVER_PORT = 5000;
const char* API_PATH = "/api/scale/reading";

// -------- Exact GPIO map --------
constexpr uint8_t HX711_DT = 16;
constexpr uint8_t HX711_SCK = 4;
constexpr uint8_t BUZZER_PIN = 21;
constexpr uint8_t DHT_PIN = 22;
constexpr uint8_t DHT_TYPE = DHT22;

// Set after calibration with a known weight. Keep the sign that makes weight rise.
constexpr float CALIBRATION_FACTOR = 420.0f;
constexpr float BUZZER_THRESHOLD_GRAMS = 1000.0f;

// The DHT22 should not be sampled more frequently than every 2 seconds.
constexpr uint32_t DHT_INTERVAL_MS = 2500;
constexpr uint32_t SEND_INTERVAL_MS = 2000;
constexpr uint32_t WIFI_RETRY_INTERVAL_MS = 10000;
constexpr uint8_t STABILITY_SAMPLES = 10;
constexpr float STABILITY_RANGE_GRAMS = 2.0f;

HX711 scale;
DHT dht(DHT_PIN, DHT_TYPE);
WiFiClient wifiClient;

float samples[STABILITY_SAMPLES] = {};
uint8_t sampleIndex = 0;
uint8_t samplesCollected = 0;
float temperatureC = NAN;
float humidityPercent = NAN;
uint32_t lastDhtMs = 0;
uint32_t lastSendMs = 0;
uint32_t lastWifiAttemptMs = 0;
uint32_t readingSequence = 0;
uint32_t bootId = 0;
bool scaleTared = false;
bool ntpStarted = false;

void maintainWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!ntpStarted) {
      configTime(0, 0, "pool.ntp.org", "time.nist.gov");
      ntpStarted = true;
    }
    return;
  }

  if (millis() - lastWifiAttemptMs < WIFI_RETRY_INTERVAL_MS) return;
  lastWifiAttemptMs = millis();
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS); // asynchronous; the sensor loop keeps running
  Serial.printf("[WiFi] Reconnecting to %s...\n", WIFI_SSID);
}

bool isStable() {
  if (samplesCollected < STABILITY_SAMPLES) return false;
  float lowest = samples[0];
  float highest = samples[0];
  for (uint8_t i = 1; i < STABILITY_SAMPLES; ++i) {
    lowest = min(lowest, samples[i]);
    highest = max(highest, samples[i]);
  }
  return highest - lowest <= STABILITY_RANGE_GRAMS;
}

void readEnvironmentIfDue() {
  if (millis() - lastDhtMs < DHT_INTERVAL_MS) return;
  lastDhtMs = millis();
  const float nextHumidity = dht.readHumidity();
  const float nextTemperature = dht.readTemperature();
  if (isnan(nextHumidity) || isnan(nextTemperature) || nextHumidity < 0 || nextHumidity > 100 || nextTemperature < -40 || nextTemperature > 80) {
    Serial.println("[DHT22] Read failed; keeping the last valid environmental sample.");
    return;
  }
  temperatureC = nextTemperature;
  humidityPercent = nextHumidity;
}

String makePayload(float grams, bool stable) {
  String payload;
  payload.reserve(240);
  payload = "{\"device_id\":\"";
  payload += DEVICE_ID;
  payload += "\",\"reading_id\":\"";
  payload += String(bootId, HEX);
  payload += "-";
  payload += String(++readingSequence);
  payload += "\",\"grams\":";
  payload += String(grams, 1);
  payload += ",\"stable\":";
  payload += stable ? "true" : "false";
  payload += ",\"temperature_c\":";
  payload += isnan(temperatureC) ? "null" : String(temperatureC, 1);
  payload += ",\"humidity_percent\":";
  payload += isnan(humidityPercent) ? "null" : String(humidityPercent, 1);

  // Include device time when NTP has synchronized. The server validates its age.
  const time_t epoch = time(nullptr);
  if (epoch > 1700000000) {
    const uint64_t timestampMs = (static_cast<uint64_t>(epoch) * 1000ULL) + (millis() % 1000);
    char timestampBuffer[24];
    snprintf(timestampBuffer, sizeof(timestampBuffer), "%llu", static_cast<unsigned long long>(timestampMs));
    payload += ",\"timestamp_ms\":";
    payload += timestampBuffer;
  }
  payload += "}";
  return payload;
}

void postReading(float grams, bool stable) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Not sent; Wi-Fi is offline. The next sample will retry.");
    return;
  }

  HTTPClient http;
  http.setConnectTimeout(800);
  http.setTimeout(1200); // bound a slow local network so sampling resumes promptly
  const String url = String("http://") + SERVER_HOST + ":" + String(SERVER_PORT) + API_PATH;
  if (!http.begin(wifiClient, url)) {
    Serial.println("[HTTP] Could not open the KitchenSync URL.");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);
  const String payload = makePayload(grams, stable);
  const int status = http.POST(payload);
  if (status == 204) {
    Serial.println("[HTTP] Sensor reading accepted by KitchenSync.");
  } else if (status > 0) {
    Serial.printf("[HTTP] KitchenSync returned %d: %s\n", status, http.getString().c_str());
  } else {
    Serial.printf("[HTTP] Request failed: %s\n", http.errorToString(status).c_str());
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  bootId = esp_random();

  dht.begin();
  scale.begin(HX711_DT, HX711_SCK);
  scale.set_scale(CALIBRATION_FACTOR);
  Serial.println("[HX711] Keep the empty platform unloaded for startup auto-tare.");
  const uint32_t tareStarted = millis();
  while (!scale.is_ready() && millis() - tareStarted < 8000) delay(20);
  if (scale.is_ready()) {
    scale.tare(15);
    scaleTared = true;
    Serial.println("[HX711] Startup tare complete.");
  } else {
    Serial.println("[HX711] Not ready yet; startup tare will retry when it responds.");
  }

  WiFi.setSleep(false);
  lastWifiAttemptMs = millis() - WIFI_RETRY_INTERVAL_MS;
  maintainWiFi();
  Serial.println("[KitchenSync] Sensor node started. Serial Monitor: 115200 baud.");
}

void loop() {
  maintainWiFi();
  readEnvironmentIfDue();

  if (!scale.is_ready()) {
    digitalWrite(BUZZER_PIN, LOW);
    return;
  }
  if (!scaleTared) {
    scale.tare(15); // one-time recovery calibration after an HX711 startup delay
    scaleTared = true;
    Serial.println("[HX711] Startup tare complete.");
    return;
  }
  if (millis() - lastSendMs < SEND_INTERVAL_MS) return;
  lastSendMs = millis();

  float grams = scale.get_units(3);
  if (grams < 0 && grams > -2) grams = 0;
  samples[sampleIndex] = grams;
  sampleIndex = (sampleIndex + 1) % STABILITY_SAMPLES;
  if (samplesCollected < STABILITY_SAMPLES) ++samplesCollected;
  const bool stable = isStable();

  digitalWrite(BUZZER_PIN, grams >= BUZZER_THRESHOLD_GRAMS ? HIGH : LOW);
  Serial.printf("[SCALE] %.1f g | %s | ", grams, stable ? "STABLE" : "SETTLING");
  if (!isnan(temperatureC) && !isnan(humidityPercent)) Serial.printf("%.1f C | %.1f %% RH\n", temperatureC, humidityPercent);
  else Serial.println("environment sensors waiting");

  postReading(grams, stable);
}
