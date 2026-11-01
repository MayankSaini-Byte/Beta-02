# KitchenSync physical sensor station

The Devices page accepts readings from a physical ESP32 + HX711 load cell + DHT22, as well as the existing simulator. The ESP32 sends one authenticated JSON reading to the existing Express API; React reads it from KitchenSync and never connects directly to the board. Sensor readings are stored as history and do not change pantry stock by themselves.

Firmware: [`esp32_scale/esp32_scale.ino`](esp32_scale/esp32_scale.ino).

For an **ESP8266 NodeMCU (ESP-12E)** with HX711 and a 5 kg load cell, use [`esp8266_scale/esp8266_scale.ino`](esp8266_scale/esp8266_scale.ino). This variant sends weight and stability only; the ESP8266 setup described here does not include DHT22 readings.

## ESP8266 NodeMCU setup

- HX711 DOUT/DT → GPIO12 (D6); SCK/CLK → GPIO14 (D5); VCC → 3V3; GND → GND.
- Install the **ESP8266** board package and **HX711** by bogde in Arduino IDE. Select **NodeMCU 1.0 (ESP-12E Module)**.
- Copy `esp8266_scale/secrets.example.h` to `esp8266_scale/secrets.h`; fill in the hotspot name/password, laptop IPv4, and the matching KitchenSync device key and ID. `secrets.h` is ignored by Git.
- Open the matching `esp8266_scale.ino` sketch folder, upload, then open Serial Monitor at **115200 baud**. `204` means the API accepted a reading; `401` means the backend has not loaded the matching key or the firmware key differs.
- Calibrate `CALIBRATION_FACTOR` using a known weight before relying on measurements. Keep the platform unloaded during startup tare.

## Parts and wiring

- ESP32 DevKit V1
- HX711 24-bit load-cell amplifier and a 5 kg bar load cell
- DHT22 3-pin module
- 2-pin active buzzer
- Stable base/top platform and spacers for the bar load cell

| Part | Pin / wire | Connect to |
|---|---|---|
| HX711 | DT | ESP32 GPIO16 |
| HX711 | SCK | ESP32 GPIO4 |
| HX711 | VCC | ESP32 3V3 |
| HX711 | GND | ESP32 GND |
| DHT22 module | DATA | ESP32 GPIO22 |
| DHT22 module | VCC | ESP32 3V3 |
| DHT22 module | GND | ESP32 GND |
| Active buzzer | positive | ESP32 GPIO21 |
| Active buzzer | negative | ESP32 GND |

Load cell to HX711: **red → E+**, **black → E−**, **green → A+**, **white → A−**. Check the markings on the DHT22 module because its physical pin order varies. All grounds must be common. There is no tare button or LED in this wiring plan.

The load cell must flex between the base and top plate. Attach one end to each plate with spacers, keep the top plate clear of the base, and center the load. A buzzer that draws more current than the ESP32 GPIO can safely provide must use a transistor driver (and a flyback diode if the buzzer is inductive); do not power a high-current buzzer directly from GPIO21.

## Install the Arduino dependencies

In Arduino IDE, install the Espressif ESP32 board package and these libraries:

- **HX711** by bogde
- **DHT sensor library** by Adafruit
- **Adafruit Unified Sensor** (dependency of the DHT library)

Select the ESP32 Dev Module board and the correct USB port.

## Configure the local server and device

1. Start KitchenSync on the laptop with `npm start` from the KitchenSync project root. The API listens on port 5000 by default; set `PORT` in `backend/.env` only if you intentionally use another port.
2. Put the laptop and ESP32 on the same Wi-Fi network or phone hotspot. The ESP32 cannot use `localhost` to reach the laptop.
3. Find the laptop's private LAN address with `ipconfig` on Windows or `ip addr` on Linux. Allow Node.js through the laptop firewall on the **Private** network if the board cannot connect.
4. In `backend/.env`, set a private key, for example `DEVICE_KEY=<long-random-secret>`. Do not commit or share this value. If unset, KitchenSync currently uses its development fallback `secret-device-key`; set your own before connecting hardware.
5. Open **Devices** in a commercial/service account. Add a storage point name and a **Physical Device ID**, for example `rice-scale-01`. This ID must be unique and must match `DEVICE_ID` in the firmware. Leaving the ID blank creates a simulator device.
6. In `esp32_scale.ino`, replace `WIFI_SSID`, `WIFI_PASS`, `SERVER_HOST` (the laptop LAN IP), `DEVICE_KEY`, and `DEVICE_ID`. Keep port `5000` unless the backend is configured to use another port.
7. Upload the firmware. Open Serial Monitor at **115200 baud**. The Devices page should report the sensor online within 10 seconds and show the last weight, stable state, temperature, and relative humidity.

The firmware contains placeholders only. Do not paste real Wi-Fi credentials, the backend key, or a real laptop address into a checked-in copy of the source. Keep your configured firmware file private or restore the placeholders before sharing the repository.

## Calibrate the load cell

1. Secure the cell and platform; remove all weight from the platform before powering up. The ESP32 automatically tares at startup, so restart it with the platform unloaded.
2. Upload once with a conservative calibration factor, then place a known mass (for example, 500 g) on the platform and read the reported grams.
3. Adjust `CALIBRATION_FACTOR` until the reported value matches the known mass. With the bogde HX711 library, the factor is based on the averaged raw count divided by the known mass. Verify at two or three different masses and keep below the 5 kg cell rating.
4. If weight changes in the wrong direction, swap A+ and A− or use the corresponding negative calibration factor.
5. To tare an empty storage container after startup, use **Tare** on its device card while a fresh stable reading is available. The server stores this container offset; stock weighing subtracts it from the measured gross grams.

The buzzer threshold is configured in firmware by `BUZZER_THRESHOLD_GRAMS`. Its default is 1000 g. There is no separate threshold API or web control yet.

## API and data handling

The authenticated hardware request is:

```http
POST /api/scale/reading
Content-Type: application/json
x-device-key: <DEVICE_KEY>
```

```json
{
  "device_id": "rice-scale-01",
  "reading_id": "boot-sequence",
  "grams": 1240.5,
  "stable": true,
  "temperature_c": 23.8,
  "humidity_percent": 48.2,
  "timestamp_ms": 1793550000000
}
```

`timestamp_ms` is optional when the ESP32 has not synchronized its clock. The API rejects timestamps more than 30 seconds old or more than 30 seconds in the future, unknown device IDs (except legacy `scale1`), invalid environmental ranges, implausible weight, and out-of-order/duplicate readings. Valid unstable readings are retained for display/history but cannot be applied to stock. Expected responses: `204` accepted (or already-seen duplicate), `401` wrong device key, `404` unpaired device ID, `409` out of order, `422` invalid reading.

Weight, temperature and humidity history are stored through KitchenSync's existing database abstraction (MongoDB or persistent JSON file store). `GET /api/devices` returns each paired storage point's last reading and connectivity; `GET /api/devices/:id/history` returns up to 200 recorded samples for all three charts. The Devices page polls the API; no cloud service or WebSocket server is used.

## Apply sensor weight to stock

Pair the sensor and, optionally, link its storage point to a pantry item. In **Load-cell weighing station**, select the physical sensor, select a pantry item, choose **Set total** or **Add to existing**, and apply the reading. Applying requires a fresh (under 3 seconds) stable reading and subtracts the configured container tare. The device only measures and records; it never silently overwrites stock.

The simulator remains available for unpaired/demo devices. It is clearly labeled and cannot be used to simulate readings for a physical device.

## Troubleshooting

- **Device stays offline:** check that the API runs on the laptop's LAN, both devices share a network, `SERVER_HOST` is the laptop IP, port 5000 is reachable, and the firewall allows Node.js on Private networks.
- **401:** `DEVICE_KEY` in firmware must exactly match `DEVICE_KEY` in `backend/.env`; restart the backend after changing `.env`.
- **404 unknown device:** pair the sensor in Devices and make `DEVICE_ID` exactly match its Physical Device ID.
- **Timestamp rejected:** allow NTP access or omit `timestamp_ms` until the ESP32 clock is synchronized.
- **No temperature/humidity:** verify DHT22 VCC, common GND, GPIO22, the DHT22 library installation, and module pin labels. DHT22 samples are limited to one every 2.5 seconds.
- **Weight unstable or drifting:** secure the platform, keep it untouched, warm up the HX711, shorten its wires, keep them away from the ESP32 antenna, and recalibrate.
- **Buzzer does not sound / board resets:** verify GPIO21 and use a suitable transistor driver when the buzzer current exceeds GPIO limits.

Physical sensor testing requires the actual board and sensors. The code and API checks alone do not prove that a particular physical setup is wired or calibrated correctly.
