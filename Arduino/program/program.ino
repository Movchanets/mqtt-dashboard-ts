#include <Adafruit_SSD1306.h>
#include <Adafruit_GFX.h>
#include <DHT.h>
#include <Wire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include "time.h"
#include "secrets.h" // Файл з приватними даними (WiFi, MQTT, Firebase)

// === Піни для RGB LED ===
#define RED_PIN 18
#define GREEN_PIN 19
#define BLUE_PIN 5

// ---------------- Налаштування сенсора ----------------
#define DHTPIN 13	  // Ваш пін
#define DHTTYPE DHT11 // Ваш тип сенсора
DHT dht(DHTPIN, DHTTYPE);

// ---------------- OLED ----------------
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ---------------- Використання констант з secrets.h ----------------
// WiFi credentials are now in wifiNetworks[] array from secrets.h
const char *mqtt_server = MQTT_SERVER;
const int mqtt_port = MQTT_PORT;
const char *mqtt_client_id = MQTT_CLIENT_ID;
const char *mqtt_topic = MQTT_TOPIC;
const char *mqtt_user = MQTT_USER;
const char *mqtt_pass = MQTT_PASSWORD;
const char *ntpServer = NTP_SERVER;
const long gmtOffset_sec = GMT_OFFSET_SEC;
const int daylightOffset_sec = DAYLIGHT_OFFSET_SEC;

// Month names for human-readable display
const char *MONTH_NAMES[12] = {
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December"};

// Firebase Realtime Database
const char *firebase_host = FIREBASE_HOST; // e.g. "your-project.firebaseio.com"
const char *firebase_auth = FIREBASE_AUTH; // Database secret or Auth token

WiFiClientSecure secureClient;
PubSubClient client(secureClient);

// === Змінні для покращеної логіки ===
unsigned long lastSensorReadTime = 0;
unsigned long lastOledUpdateTime = 0;
unsigned long lastSuccessfulMQTT = 0;
const long sensorReadInterval = 5000;
const long oledUpdateInterval = 1000;
const long mqttTimeoutInterval = 300000; // 5 хвилин без MQTT = перезавантаження
float lastTemp = -999.0;
float lastHum = -999.0;
int consecutiveErrors = 0;
const int maxConsecutiveErrors = 10;

// === Відстеження uptime та перезавантажень ===
unsigned long bootTime = 0; // Час запуску в Unix timestamp

// === Температурні пороги для LED ===
// 5-точкові пороги для "теплової карти"
const float TEMP_BLUE = 18.0;	// Починаємо з синього
const float TEMP_CYAN = 20.5;	// Перехід до блакитного
const float TEMP_GREEN = 23.0;	// Комфортний зелений
const float TEMP_YELLOW = 25.5; // Перехід до жовтого
const float TEMP_RED = 28.0;	// Закінчуємо червоним

// === Функція для керування кольором ===
void setRGB(int r, int g, int b)
{
	// Припускаємо "Спільний Катод" (найдовша ніжка на GND)
	analogWrite(RED_PIN, r);
	analogWrite(GREEN_PIN, g);
	analogWrite(BLUE_PIN, b);
}

// === Функція для розрахунку кольору по температурі (ОНОВЛЕНА) ===
void updateLedColor(float temp)
{
	if (temp == -999.0)
	{
		setRGB(0, 0, 0);
		return;
	}

	int r, g, b;

	if (temp <= TEMP_BLUE)
	{
		// Холодно = чистий Синій
		r = 0;
		g = 0;
		b = 255;
	}
	else if (temp > TEMP_BLUE && temp <= TEMP_CYAN)
	{
		// Перехід Синій -> Блакитний (Cyan)
		r = 0;
		// (використовуємо пряму математику замість map() для плавності з float)
		g = (int)((temp - TEMP_BLUE) * 255 / (TEMP_CYAN - TEMP_BLUE));
		b = 255;
	}
	else if (temp > TEMP_CYAN && temp <= TEMP_GREEN)
	{
		// Перехід Блакитний -> Зелений
		r = 0;
		g = 255;
		b = 255 - (int)((temp - TEMP_CYAN) * 255 / (TEMP_GREEN - TEMP_CYAN));
	}
	else if (temp > TEMP_GREEN && temp <= TEMP_YELLOW)
	{
		// Перехід Зелений -> Жовтий
		r = (int)((temp - TEMP_GREEN) * 255 / (TEMP_YELLOW - TEMP_GREEN));
		g = 255;
		b = 0;
	}
	else if (temp > TEMP_YELLOW && temp <= TEMP_RED)
	{
		// Перехід Жовтий -> Червоний
		r = 255;
		g = 255 - (int)((temp - TEMP_YELLOW) * 255 / (TEMP_RED - TEMP_YELLOW));
		b = 0;
	}
	else
	{ // (temp > TEMP_RED)
		// Спекотно = чистий Червоний
		r = 255;
		g = 0;
		b = 0;
	}

	setRGB(r, g, b);
}

// ---------------- Firebase Realtime Database POST ----------------
void sendToFirebase(float temperature, float humidity, String timestamp)
{
	// Перевіряємо WiFi з'єднання
	if (WiFi.status() != WL_CONNECTED)
	{
		Serial.println("✗ Firebase skipped: WiFi not connected");
		return;
	}

	WiFiClientSecure firebaseClient;
	firebaseClient.setInsecure(); // Для спрощення; у production використовуйте сертифікати

	HTTPClient https;

	// Firebase REST API: POST to /measurements.json creates a new entry with auto-generated key
	String url;

	url = String("https://") + firebase_host + "/measurements.json";

	// Якщо є auth token, додаємо його
	if (String(firebase_auth).length() > 0)
	{
		url += "?auth=" + String(firebase_auth);
	}

	// Формуємо JSON payload
	String json = "{";
	json += "\"device_id\":\"esp32-dht11\",";
	json += "\"temperature\":" + String(temperature, 1) + ",";
	json += "\"humidity\":" + String(humidity, 1) + ",";
	json += "\"timestamp\":\"" + timestamp + "\"";
	json += "}";

	Serial.println("=== Firebase POST ===");
	Serial.println("URL: " + url);
	Serial.println("JSON: " + json);

	if (https.begin(firebaseClient, url))
	{
		https.addHeader("Content-Type", "application/json");
		https.setTimeout(15000); // 15 секунд таймаут

		int httpCode = https.POST(json);
		if (httpCode > 0)
		{
			String response = https.getString();
			Serial.printf("Firebase response code: %d\n", httpCode);
			Serial.println("Firebase response body: " + response);

			// Firebase повертає 200 для успішного POST
			if (httpCode == 200 || httpCode == 201)
			{
				Serial.println("✓ Firebase insert SUCCESS!");
			}
			else if (httpCode == 401)
			{
				Serial.println("✗ Firebase AUTH ERROR: Перевірте FIREBASE_AUTH token");
			}
			else if (httpCode == 403)
			{
				Serial.println("✗ Firebase PERMISSION ERROR: Перевірте Database Rules");
			}
			else if (httpCode == 404)
			{
				Serial.println("✗ Firebase NOT FOUND: Перевірте FIREBASE_HOST");
			}
			else
			{
				Serial.printf("✗ Firebase unexpected code: %d\n", httpCode);
			}
		}
		else
		{
			Serial.printf("✗ Firebase POST failed: %s\n", https.errorToString(httpCode).c_str());
		}
		https.end();
	}
	else
	{
		Serial.println("✗ Firebase HTTPS connection failed");
	}
}

// ---------------- WiFi reconnect - спроба підключитися до доступної мережі ----------------
bool reconnectWiFi()
{
	Serial.println("=== Спроба перепідключення WiFi ===");
	WiFi.disconnect();
	delay(1000);

	for (int i = 0; i < wifiNetworkCount; i++)
	{
		Serial.print("Пробую мережу: ");
		Serial.println(wifiNetworks[i].ssid);

		display.clearDisplay();
		display.setCursor(0, 0);
		display.setTextSize(1);
		display.println("WiFi reconnecting:");
		display.println(wifiNetworks[i].ssid);
		display.display();

		WiFi.begin(wifiNetworks[i].ssid, wifiNetworks[i].password);

		int attempts = 0;
		while (WiFi.status() != WL_CONNECTED && attempts < 20)
		{
			delay(500);
			Serial.print(".");
			attempts++;
		}

		if (WiFi.status() == WL_CONNECTED)
		{
			Serial.println("\n✓ WiFi перепідключено: " + String(wifiNetworks[i].ssid));
			Serial.print("IP: ");
			Serial.println(WiFi.localIP());
			return true;
		}
		else
		{
			Serial.println("\n✗ Не вдалося");
			WiFi.disconnect();
		}
	}

	Serial.println("✗ Жодна WiFi мережа не доступна!");
	return false;
}

// ---------------- MQTT reconnect ----------------
void reconnect()
{
	// Перевіряємо WiFi з'єднання перед MQTT
	if (WiFi.status() != WL_CONNECTED)
	{
		Serial.println("WiFi відключено! Спроба перепідключення...");
		setRGB(255, 150, 0); // Помаранчевий = проблема з WiFi

		if (!reconnectWiFi())
		{
			Serial.println("Не вдалося відновити WiFi. Перезавантаження...");
			delay(5000);
			ESP.restart();
			return;
		}

		// Після перепідключення WiFi, ресинхронізуємо час
		configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
		delay(2000);
	}

	// === ЧЕРВОНИЙ = Помилка MQTT ===
	setRGB(255, 0, 0);
	int attempts = 0;
	const int maxAttempts = 5;

	while (!client.connected() && attempts < maxAttempts)
	{
		attempts++;
		Serial.printf("Підключення до MQTT (спроба %d/%d)...", attempts, maxAttempts);
		if (client.connect(mqtt_client_id, mqtt_user, mqtt_pass))
		{
			Serial.println("OK");
			lastSuccessfulMQTT = millis();
			consecutiveErrors = 0;
			return;
		}
		else
		{
			Serial.print("Помилка, код = ");
			Serial.print(client.state());
			Serial.println(" , повтор через 5с");
			delay(5000);
		}
	}

	// Якщо не вдалося підключитися після maxAttempts спроб
	if (!client.connected())
	{
		consecutiveErrors++;
		Serial.printf("Не вдалося підключитися. Послідовних помилок: %d\n", consecutiveErrors);

		// Перезавантаження після багатьох невдалих спроб
		if (consecutiveErrors >= maxConsecutiveErrors)
		{
			Serial.println("КРИТИЧНА ПОМИЛКА! Перезавантаження через 5 секунд...");
			delay(5000);
			ESP.restart();
		}
	}
}

String getTimeString()
{
	time_t now;
	time(&now);
	struct tm timeinfo;
	// UTC to avoid DST/offset issues; explicit Z suffix
	gmtime_r(&now, &timeinfo);
	char buffer[25];
	strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
	return String(buffer);
}

String getUptimeString()
{
	unsigned long uptimeSeconds = millis() / 1000;
	unsigned long days = uptimeSeconds / 86400;
	unsigned long hours = (uptimeSeconds % 86400) / 3600;
	unsigned long minutes = (uptimeSeconds % 3600) / 60;
	unsigned long seconds = uptimeSeconds % 60;

	String uptime = "";
	if (days > 0)
		uptime += String(days) + "d ";
	uptime += String(hours) + "h " + String(minutes) + "m " + String(seconds) + "s";
	return uptime;
}

// Human-readable date/time for OLED: e.g. "December 8" and "21:21:20"
void getDisplayDateTime(String &dateLine, String &timeLine)
{
	time_t now;
	time(&now);
	struct tm timeinfo;
	// Use localtime so offsets from configTime are respected
	localtime_r(&now, &timeinfo);

	char dateBuf[24];
	snprintf(dateBuf, sizeof(dateBuf), "%s %d", MONTH_NAMES[timeinfo.tm_mon], timeinfo.tm_mday);

	char timeBuf[12];
	strftime(timeBuf, sizeof(timeBuf), "%H:%M:%S", &timeinfo);

	dateLine = String(dateBuf);
	timeLine = String(timeBuf);
}

void setup()
{
	Serial.begin(9600);
	delay(1000); // Даємо Serial Monitor час підключитися

	Serial.println("\n\n==========================");
	Serial.println("  ESP32 DHT11 + MQTT");
	Serial.println("==========================");

	// Виводимо причину перезавантаження
	esp_reset_reason_t reset_reason = esp_reset_reason();
	Serial.print("Причина запуску: ");
	switch (reset_reason)
	{
	case ESP_RST_POWERON:
		Serial.println("Power-on reset");
		break;
	case ESP_RST_SW:
		Serial.println("Software reset");
		break;
	case ESP_RST_PANIC:
		Serial.println("Exception/panic");
		break;
	case ESP_RST_INT_WDT:
		Serial.println("Interrupt watchdog");
		break;
	case ESP_RST_TASK_WDT:
		Serial.println("Task watchdog");
		break;
	case ESP_RST_WDT:
		Serial.println("Other watchdog");
		break;
	case ESP_RST_DEEPSLEEP:
		Serial.println("Deep sleep wake");
		break;
	case ESP_RST_BROWNOUT:
		Serial.println("Brownout reset");
		break;
	case ESP_RST_SDIO:
		Serial.println("SDIO reset");
		break;
	default:
		Serial.println("Unknown");
		break;
	}
	Serial.println("==========================");
	Serial.println();

	dht.begin();

	// === ЗМІНА 2: Ініціалізуємо LED піни на самому початку ===
	pinMode(RED_PIN, OUTPUT);
	pinMode(GREEN_PIN, OUTPUT);
	pinMode(BLUE_PIN, OUTPUT);
	setRGB(0, 0, 0); // Починаємо з вимкненого

	// OLED
	if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C))
	{
		Serial.println(F("OLED не знайдено"));
		// === БІЛИЙ = Критична помилка заліза ===
		setRGB(255, 255, 255);
		for (;;)
			; // Зупиняємо програму
	}

	display.clearDisplay();
	display.setTextSize(1);
	display.setTextColor(SSD1306_WHITE);
	display.setCursor(0, 0);
	display.println("ESP32 DHT11 + MQTT");
	display.println("Connecting...");
	display.display();
	delay(1000);

	// Жовтий = підключення до WiFi
	setRGB(255, 200, 0);

	// WiFi - спроба підключення до кожної мережі з масиву
	bool wifiConnected = false;
	for (int i = 0; i < wifiNetworkCount && !wifiConnected; i++)
	{
		Serial.print("Спроба підключення до WiFi: ");
		Serial.println(wifiNetworks[i].ssid);

		display.clearDisplay();
		display.setCursor(0, 0);
		display.println("Connecting to:");
		display.println(wifiNetworks[i].ssid);
		display.display();

		WiFi.begin(wifiNetworks[i].ssid, wifiNetworks[i].password);

		// Чекаємо до 10 секунд на підключення
		int attempts = 0;
		while (WiFi.status() != WL_CONNECTED && attempts < 20)
		{
			delay(500);
			Serial.print(".");
			attempts++;
		}

		if (WiFi.status() == WL_CONNECTED)
		{
			wifiConnected = true;
			Serial.println("\nWiFi OK: " + String(wifiNetworks[i].ssid));
			Serial.print("IP адреса: ");
			Serial.println(WiFi.localIP());
		}
		else
		{
			Serial.println("\nНе вдалося підключитися до " + String(wifiNetworks[i].ssid));
			WiFi.disconnect();
		}
	}

	if (!wifiConnected)
	{
		Serial.println("ПОМИЛКА: Не вдалося підключитися до жодної WiFi мережі!");
		display.clearDisplay();
		display.setCursor(0, 0);
		display.println("WiFi Failed!");
		display.println("Check networks");
		display.display();
		setRGB(255, 0, 0);
		delay(5000);
		ESP.restart();
	}

	// Синій = підключення до MQTT/NTP
	setRGB(0, 0, 255);

	// NTP
	configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
	// === НОВИЙ БЛОК: Чекаємо на синхронізацію часу ===
	Serial.print("Чекаємо на синхронізацію часу (NTP)...");
	display.clearDisplay();
	display.setCursor(0, 10);
	display.setTextSize(1);
	display.println("Syncing time (NTP)...");
	display.display();

	struct tm timeinfo;
	while (!getLocalTime(&timeinfo))
	{
		Serial.print(".");
		delay(500);
	}
	Serial.println("\nЧас синхронізовано!");

	// Зберігаємо час запуску (Unix timestamp)
	time_t now;
	time(&now);
	bootTime = now;

	// Виводимо інформацію про запуск
	Serial.print("Час запуску: ");
	Serial.println(getTimeString());
	Serial.println();

	// MQTT
	secureClient.setInsecure();
	client.setServer(mqtt_server, mqtt_port);

	lastSensorReadTime = millis();
	display.clearDisplay();
	setRGB(0, 0, 0);
}

void loop()
{
	// Перевіряємо WiFi з'єднання на початку кожного циклу
	if (WiFi.status() != WL_CONNECTED)
	{
		Serial.println("⚠ WiFi втрачено в loop()!");
		reconnect(); // reconnect() тепер сам перепідключить WiFi
	}

	if (!client.connected())
	{
		reconnect();
	}
	client.loop();

	unsigned long currentTime = millis();

	// Якщо MQTT зараз підключений, оновлюємо "heartbeat" щоб не перезапускати дарма
	if (client.connected())
	{
		lastSuccessfulMQTT = currentTime;
	}

	// Watchdog: перевірка чи MQTT працює
	if (!client.connected() && lastSuccessfulMQTT > 0 && (currentTime - lastSuccessfulMQTT > mqttTimeoutInterval))
	{
		Serial.println("MQTT Watchdog: Довго немає зв'язку. Перезавантаження...");
		delay(1000);
		ESP.restart();
	}

	// --- Блок 1: Читання сенсора (кожні 5 секунд) ---
	if (currentTime - lastSensorReadTime >= sensorReadInterval)
	{
		lastSensorReadTime = currentTime;

		float h = dht.readHumidity();
		float t = dht.readTemperature();

		if (isnan(h) || isnan(t))
		{
			Serial.println(F("Помилка DHT11!"));
			// === ЗМІНА 3: ФІОЛЕТОВИЙ = Помилка сенсора ===
			setRGB(255, 0, 255);
		}
		else
		{
			Serial.printf("Зчитано: T=%.1f°C, H=%.1f%% | Uptime: %s\n", t, h, getUptimeString().c_str());

			if (t != lastTemp || h != lastHum)
			{
				Serial.println("┌─── Дані ЗМІНИЛИСЯ - Публікація ───");
				Serial.printf("│ ΔT: %.1f → %.1f°C\n", lastTemp, t);
				Serial.printf("│ ΔH: %.1f → %.1f%%\n", lastHum, h);

				lastTemp = t;
				lastHum = h;

				String timestr = getTimeString();
				String payload = "{ \"temperature\": " + String(t, 1) +
								 ", \"humidity\": " + String(h, 1) +
								 ", \"timestamp\": \"" + timestr + "\" }";

				if (client.publish(mqtt_topic, payload.c_str()))
				{
					Serial.println("│ ✓ MQTT publish SUCCESS");
					lastSuccessfulMQTT = millis();
					consecutiveErrors = 0;

					// Також відправляємо в Firebase
					sendToFirebase(t, h, timestr);
				}
				else
				{
					Serial.println("│ ✗ MQTT publish FAIL");
					consecutiveErrors++;
				}
				Serial.println("└────────────────────────────────────");
			}
			else
			{
				Serial.println("Дані не змінилися.");
			}
		}
	}

	// --- Блок 2: Оновлення OLED (кожну 1 секунду) ---
	if (currentTime - lastOledUpdateTime >= oledUpdateInterval)
	{
		lastOledUpdateTime = currentTime;

		// Оновлюємо колір LED, ЛИШЕ ЯКЩО НЕМАЄ ПОМИЛКИ СЕНСОРА
		if (!isnan(lastTemp))
		{
			updateLedColor(lastTemp);
		}
		// (Якщо була помилка сенсора, колір залишиться фіолетовим)
		// (Якщо була помилка MQTT, колір залишиться червоним до наступного
		//  вдалого зчитування сенсора)

		String dateLine, timeLine;
		getDisplayDateTime(dateLine, timeLine);

		display.clearDisplay();
		display.setTextSize(1);
		display.setCursor(0, 0);

		// === Рядок 1: WiFi статус та назва мережі ===
		display.print("WiFi:");
		if (WiFi.status() == WL_CONNECTED)
		{
			display.print(WiFi.SSID());
		}
		else
		{
			display.print("DISCONNECTED");
		}
		display.println();

		// === Рядок 2: MQTT статус ===
		display.print("MQTT:");
		if (client.connected())
		{
			display.println("OK");
		}
		else
		{
			display.println("FAIL");
		}

		// === Рядок 3: Температура (трохи менший шрифт) ===
		display.setTextSize(1);
		if (lastTemp == -999.0)
			display.println("--.- C");
		else
		{
			display.print(lastTemp, 1);
			display.println(" C");
		}

		// === Рядок 4: Вологість (трохи менший шрифт) ===
		if (lastHum == -999.0)
			display.println("--.- %");
		else
		{
			display.print(lastHum, 1);
			display.println(" %");
		}

		// === Рядок 5-6: Дата та час (менший час, щоб влізав) ===
		display.setTextSize(1);
		display.println(dateLine);
		display.println(timeLine);
		display.setTextSize(1);

		// Uptime
		unsigned long uptimeSeconds = millis() / 1000;
		unsigned long hours = uptimeSeconds / 3600;
		unsigned long minutes = (uptimeSeconds % 3600) / 60;
		display.print("Up:");
		display.print(hours);
		display.print("h ");
		display.print(minutes);
		display.print("m");

		display.display();
	}
}