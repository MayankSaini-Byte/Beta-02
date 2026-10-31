# Load-cell weighing station (ESP32 + HX711)

Turns one grocery container into a live-tracked stock item. Firmware:
[`esp32_scale/esp32_scale.ino`](esp32_scale/esp32_scale.ino) (Arduino IDE, library **"HX711" by bogde**).

## Parts

| Part | Notes |
|---|---|
| ESP32 dev board | any common 30-pin board |
| HX711 amplifier module | the green breakout |
| Load cell | 5 kg bar-type to start (1 kg for better precision on small items) |
| Two platforms | acrylic / wood / 3D-printed |
| 4 bolts + spacers, jumper wires, USB cable | optional push button for tare |

## Mechanical build (the part people get wrong)

A bar load cell must **flex**:

1. Bolt one end to the **base plate** using a spacer so the cell can bend.
2. Bolt the other end to the **top plate**, also with a spacer.
3. The top plate must **not touch the base anywhere** - any contact ruins the readings.
4. The arrow printed on the cell points in the direction of the applied load.
5. Put the container in the **middle** of the top plate.

## Wiring

**Load cell -> HX711** (colors are common but not universal - check your datasheet):

| Load cell wire | HX711 pin |
|---|---|
| Red | E+ |
| Black | E- |
| White | A- |
| Green | A+ |

**HX711 -> ESP32:**

| HX711 | ESP32 |
|---|---|
| VCC | 3.3V |
| GND | GND |
| DT | GPIO 16 |
| SCK | GPIO 4 |

Tare button (optional): one leg to **GPIO 13**, the other to **GND**.

If the weight goes DOWN when you press, swap A+ and A- (or use a negative calibration factor).

## Calibration (once)

1. Upload with `CAL_FACTOR = 1.0`, tare with the platform empty.
2. Place a known weight (500 g, or a packet with a printed weight) and read `scale.get_units(10)` over Serial.
3. `CAL_FACTOR = raw_reading / known_weight_in_grams`.
4. Verify with 2-3 other known weights; aim for **±2 g**.

## Backend contract

| Endpoint | Who | Notes |
|---|---|---|
| `POST /api/scale/reading` | ESP32 | header `x-device-key`, body `{device_id, grams, stable}` -> 204 / 401 / 422 |
| `GET /api/scale/latest` | browser | live weight + `online` badge (fresh < 5 s) |
| `POST /api/scale/stock/:id/weigh` | browser | `{mode: "set"\|"add", containerWeight}` - server applies **its own** latest reading |
| `GET /api/scale/reweigh/:itemId` | browser | expected (app) vs measured (scale) for the post-cook check |

Guards baked into the server: reading older than 3 s -> "Scale offline"; unstable -> "Weight not stable yet";
net below container weight -> rejected; implausible values (e.g. -999 g) counted as rejected, never applied.

## Things that will bite you at the venue

- **Venue Wi-Fi blocks device-to-server traffic** -> use your phone's hotspot for the laptop, the ESP32 and the phone.
- **Local backend** -> use the laptop's **LAN IP** in the firmware, not `localhost`. Over HTTPS use `WiFiClientSecure`.
- **Drift** -> let the HX711 warm up ~1 min; keep wires short and away from the Wi-Fi antenna; don't touch the platform while reading.
- **Overload** -> never lean on a 5 kg cell.
- **Power** -> run the ESP32 from a power bank; bring a spare USB cable.
- **Fallback** -> the "Simulate sensor" button in the UI posts a server-side fake reading, so the demo survives hardware failure.
