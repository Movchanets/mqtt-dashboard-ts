# 🔧 Інструкція з налаштування Arduino для ESP32

## 📋 Необхідні компоненти

### Hardware

- ESP32 Dev Module (або сумісний)
- DHT11 або DHT22 сенсор
- RGB LED (спільний катод)
- OLED дисплей SSD1306 (128x64, I2C)
- Резистори:
  - 3x 220Ω (для RGB LED)
  - 1x 10kΩ (pull-up для DHT, опційно)
- Breadboard та дроти
- USB кабель для програмування

### Software

- Arduino IDE 2.x або новіше
- Драйвери CP210x або CH340 (залежить від вашого ESP32)

## 🔌 Схема підключення

```
┌─────────────────────────────────────────────┐
│                    ESP32                     │
├─────────────────────────────────────────────┤
│                                              │
│  3.3V ──┬─→ DHT11 VCC                       │
│         ├─→ OLED VCC                        │
│         │                                    │
│  GND  ──┼─→ DHT11 GND                       │
│         ├─→ OLED GND                        │
│         ├─→ RGB LED GND (через резистори)   │
│         │                                    │
│  GPIO13 ──→ DHT11 DATA (+ pull-up 10kΩ)    │
│                                              │
│  GPIO18 ──→ RGB LED Red   (через 220Ω)     │
│  GPIO19 ──→ RGB LED Green (через 220Ω)     │
│  GPIO5  ──→ RGB LED Blue  (через 220Ω)     │
│                                              │
│  GPIO21 ──→ OLED SDA                        │
│  GPIO22 ──→ OLED SCL                        │
│                                              │
└─────────────────────────────────────────────┘

УВАГА: Номери GPIO не змінювати!
```

### Детальне підключення DHT11

```
DHT11:
  Pin 1 (VCC)  → ESP32 3.3V
  Pin 2 (DATA) → ESP32 GPIO13 + pull-up 10kΩ до 3.3V
  Pin 3 (NC)   → Не підключено
  Pin 4 (GND)  → ESP32 GND
```

### Детальне підключення RGB LED (Спільний Катод)

```
RGB LED (спільний катод):
  Катод (-) → ESP32 GND
  Red   (+) → Резистор 220Ω → ESP32 GPIO18
  Green (+) → Резистор 220Ω → ESP32 GPIO19
  Blue  (+) → Резистор 220Ω → ESP32 GPIO5

⚠️ Якщо у вас RGB зі спільним АНОДОМ:
   Змініть в коді:
   analogWrite(RED_PIN, 255 - r);  // Інверсія
```

### Детальне підключення OLED SSD1306

```
OLED Display:
  VCC → ESP32 3.3V
  GND → ESP32 GND
  SDA → ESP32 GPIO21
  SCL → ESP32 GPIO22
```

## 📥 Встановлення Arduino IDE

### Windows

1. Завантажте з https://www.arduino.cc/en/software
2. Запустіть інсталятор
3. Встановіть драйвери CP210x/CH340

### macOS

```bash
brew install --cask arduino
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install arduino
```

## 🔧 Налаштування Arduino IDE для ESP32

### 1. Додати підтримку ESP32

1. Відкрийте Arduino IDE
2. Меню: **File → Preferences**
3. Знайдіть **"Additional Board Manager URLs"**
4. Додайте:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
5. Натисніть **OK**

### 2. Встановити плату ESP32

1. Меню: **Tools → Board → Boards Manager**
2. Знайдіть `esp32` від **Espressif Systems**
3. Натисніть **Install** (може тривати 5-10 хвилин)
4. Зачекайте завершення

### 3. Вибрати правильну плату

1. Меню: **Tools → Board → ESP32 Arduino**
2. Виберіть **ESP32 Dev Module** (або вашу конкретну модель)

### 4. Налаштування параметрів плати

```
Board: "ESP32 Dev Module"
Upload Speed: "921600"
CPU Frequency: "240MHz (WiFi/BT)"
Flash Frequency: "80MHz"
Flash Mode: "QIO"
Flash Size: "4MB (32Mb)"
Partition Scheme: "Default 4MB with spiffs"
Core Debug Level: "None"
Port: [Ваш COM-порт]
```

## 📚 Встановлення бібліотек

### Через Library Manager (рекомендовано)

1. Меню: **Sketch → Include Library → Manage Libraries**
2. Встановіть наступні бібліотеки:

#### 1. Adafruit SSD1306

```
Пошук: "Adafruit SSD1306"
Автор: Adafruit
Версія: Остання
```

**Install** → також встановить залежності:

- Adafruit GFX Library
- Adafruit BusIO

#### 2. DHT sensor library

```
Пошук: "DHT sensor library"
Автор: Adafruit
Версія: Остання
```

#### 3. PubSubClient

```
Пошук: "PubSubClient"
Автор: Nick O'Leary
Версія: Остання (2.8+)
```

### Перевірка встановлених бібліотек

Меню: **Sketch → Include Library** → Повинні бути:

- ✅ Adafruit SSD1306
- ✅ Adafruit GFX Library
- ✅ DHT sensor library
- ✅ PubSubClient
- ✅ WiFi (вбудована)
- ✅ WiFiClientSecure (вбудована)
- ✅ Wire (вбудована)

## 📝 Налаштування коду

### 1. Створити secrets.h

Створіть файл `secrets.h` у папці `Arduino/`:

```cpp
// WiFi credentials
#define WIFI_SSID "Your_WiFi_Name"
#define WIFI_PASSWORD "Your_WiFi_Password"

// MQTT HiveMQ Cloud
#define MQTT_SERVER "your-cluster.s1.eu.hivemq.cloud"
#define MQTT_PORT 8883
#define MQTT_CLIENT_ID "ESP32-DHT11-001"  // Унікальний ID
#define MQTT_TOPIC "esp32/dht11"
#define MQTT_USER "esp32-device"
#define MQTT_PASSWORD "YourSecurePassword"

// NTP Configuration
#define NTP_SERVER "pool.ntp.org"
#define GMT_OFFSET_SEC (3 * 3600)  // GMT+3 для України
#define DAYLIGHT_OFFSET_SEC 0
```

### 2. Відкрити program.ino

1. Відкрийте `Arduino/program.ino` в Arduino IDE
2. Переконайтеся, що файл `secrets.h` знаходиться в тій же папці

## 🚀 Завантаження коду

### 1. Підключити ESP32

1. Підключіть ESP32 до комп'ютера через USB
2. Зачекайте встановлення драйверів

### 2. Вибрати порт

1. Меню: **Tools → Port**
2. Виберіть порт:
   - Windows: `COM3`, `COM4`, тощо
   - macOS: `/dev/cu.usbserial-*`
   - Linux: `/dev/ttyUSB0`, `/dev/ttyACM0`

### 3. Компіляція та завантаження

1. Натисніть **Verify** (✓) для перевірки коду
2. Якщо компіляція успішна, натисніть **Upload** (→)
3. Зачекайте "Hard resetting via RTS pin..."
4. Готово! ✅

### 4. Моніторинг Serial

1. Меню: **Tools → Serial Monitor**
2. Встановіть **115200 baud**
3. Ви побачите:
   ```
   ESP32 DHT11 + MQTT
   WiFi: Your_WiFi_Name
   .....
   WiFi OK
   Чекаємо на синхронізацію часу (NTP)...
   Час синхронізовано!
   Підключення до MQTT (спроба 1/5)...OK
   Зчитано: T=23.5, H=65.0
   Дані ЗМІНИЛИСЯ. Публікація MQTT...
   MQTT publish SUCCESS
   ```

## 🐛 Усунення проблем

### ❌ "Port not found" або "Serial port not found"

**Причина**: Драйвери не встановлені

**Рішення**:

1. Визначте чіп USB-to-Serial на вашому ESP32:
   - CP2102/CP210x: Завантажте з https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers
   - CH340/CH341: Завантажте з http://www.wch.cn/downloads/CH341SER_ZIP.html
2. Встановіть драйвери
3. Перезавантажте комп'ютер
4. Перепідключіть ESP32

### ❌ "A fatal error occurred: Failed to connect to ESP32"

**Причина**: ESP32 не в режимі завантаження

**Рішення**:

1. **Метод 1** (рекомендовано):

   - Утримуйте кнопку **BOOT** на ESP32
   - Натисніть кнопку **RESET**
   - Відпустіть **RESET**, потім **BOOT**
   - Спробуйте завантажити знову

2. **Метод 2**:
   - Зменшіть швидкість завантаження: **Tools → Upload Speed → 115200**

### ❌ Compilation errors

**"Adafruit_SSD1306.h: No such file or directory"**

- Встановіть бібліотеку Adafruit SSD1306

**"DHT.h: No such file or directory"**

- Встановіть бібліотеку DHT sensor library

**"PubSubClient.h: No such file or directory"**

- Встановіть бібліотеку PubSubClient

### ❌ ESP32 підключається до WiFi, але не до MQTT

**Перевірка**:

1. Serial Monitor: Яка помилка? (код -2, -4, тощо)
2. Креденшли MQTT правильні?
3. HiveMQ Cloud кластер активний?
4. Порт 8883 відкритий у вашій мережі?

**Коди помилок PubSubClient**:

- `-4`: Timeout
- `-3`: Connection lost
- `-2`: Connect failed
- `-1`: Disconnected
- `5`: Connection refused (bad credentials)

### ❌ DHT sensor повертає NaN

**Причини та рішення**:

1. **Неправильне підключення**:

   - Перевірте VCC, GND, DATA піни
   - Використовуйте мультиметр

2. **Відсутній pull-up резистор**:

   - Додайте 10kΩ резистор між DATA та 3.3V

3. **Недостатнє живлення**:

   - Використовуйте зовнішнє живлення 5V для DHT22
   - Або живіть від ESP32 5V (якщо є)

4. **Пошкоджений сенсор**:
   - Спробуйте інший DHT11/DHT22

### ❌ OLED не відображає дані

1. **Перевірте адресу I2C**:

   ```cpp
   // Спробуйте 0x3D замість 0x3C
   if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3D)) {
   ```

2. **Скануйте I2C шину**:

   - Використайте I2C Scanner sketch
   - https://playground.arduino.cc/Main/I2cScanner/

3. **Перевірте підключення**:
   - SDA → GPIO21
   - SCL → GPIO22

## 📊 Тестування Hardware

### Тест 1: RGB LED

```cpp
void setup() {
  pinMode(18, OUTPUT);  // Red
  pinMode(19, OUTPUT);  // Green
  pinMode(5, OUTPUT);   // Blue

  digitalWrite(18, HIGH); delay(1000); digitalWrite(18, LOW);  // Red
  digitalWrite(19, HIGH); delay(1000); digitalWrite(19, LOW);  // Green
  digitalWrite(5, HIGH);  delay(1000); digitalWrite(5, LOW);   // Blue
}
```

### Тест 2: DHT Sensor

```cpp
#include <DHT.h>
DHT dht(13, DHT11);

void setup() {
  Serial.begin(115200);
  dht.begin();
}

void loop() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  Serial.printf("Temp: %.1f C, Humidity: %.1f %%\n", t, h);
  delay(2000);
}
```

### Тест 3: OLED Display

```cpp
#include <Adafruit_SSD1306.h>
Adafruit_SSD1306 display(128, 64, &Wire, -1);

void setup() {
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED failed!");
    while(1);
  }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(0, 0);
  display.println("Hello!");
  display.display();
}
```

## 🔄 Оновлення прошивки

1. Внесіть зміни в код
2. Натисніть **Upload** (→)
3. ESP32 автоматично перезавантажиться

## 🔒 Безпека

- ✅ Використовуйте `secrets.h` для креденшлів
- ✅ Не комітьте `secrets.h` в git
- ✅ Використовуйте різні паролі для WiFi та MQTT
- ✅ Регулярно оновлюйте бібліотеки

## 📞 Допомога

- ESP32 Arduino: https://github.com/espressif/arduino-esp32
- Arduino Forum: https://forum.arduino.cc/
- ESP32 Documentation: https://docs.espressif.com/

---

✅ Після налаштування ESP32 має публікувати дані в MQTT!
