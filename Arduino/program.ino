#include <Adafruit_SSD1306.h>
#include <Adafruit_GFX.h>
#include <DHT.h>
#include <Wire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include "time.h"
#include "secrets.h" // Файл з приватними даними (WiFi, MQTT)

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
const char *ssid = WIFI_SSID;
const char *password = WIFI_PASSWORD;
const char *mqtt_server = MQTT_SERVER;
const int mqtt_port = MQTT_PORT;
const char *mqtt_client_id = MQTT_CLIENT_ID;
const char *mqtt_topic = MQTT_TOPIC;
const char *mqtt_user = MQTT_USER;
const char *mqtt_pass = MQTT_PASSWORD;
const char *ntpServer = NTP_SERVER;
const long gmtOffset_sec = GMT_OFFSET_SEC;
const int daylightOffset_sec = DAYLIGHT_OFFSET_SEC;

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

// ---------------- MQTT reconnect ----------------
void reconnect()
{
	// === ЗМІНА 1: ЧЕРВОНИЙ = Помилка мережі/MQTT ===
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
	struct tm timeinfo;
	if (!getLocalTime(&timeinfo))
		return "NoTime";
	char buffer[25];
	strftime(buffer, sizeof(buffer), "%Y-%m-%d %T", &timeinfo);
	return String(buffer);
}

void setup()
{
	Serial.begin(9600);
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

	// WiFi
	Serial.print("WiFi: ");
	Serial.println(ssid);
	WiFi.begin(ssid, password);
	while (WiFi.status() != WL_CONNECTED)
	{
		delay(500);
		Serial.print(".");
	}
	Serial.println("\nWiFi OK");

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
	// MQTT
	secureClient.setInsecure();
	client.setServer(mqtt_server, mqtt_port);

	lastSensorReadTime = millis();
	display.clearDisplay();
	setRGB(0, 0, 0);
}

void loop()
{
	if (!client.connected())
	{
		reconnect();
	}
	client.loop();

	unsigned long currentTime = millis();

	// Watchdog: перевірка чи MQTT працює
	if (lastSuccessfulMQTT > 0 && (currentTime - lastSuccessfulMQTT > mqttTimeoutInterval))
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
			Serial.printf("Зчитано: T=%.1f, H=%.1f\n", t, h);

			if (t != lastTemp || h != lastHum)
			{
				Serial.println("Дані ЗМІНИЛИСЯ. Публікація MQTT...");

				lastTemp = t;
				lastHum = h;

				String timestr = getTimeString();
				String payload = "{ \"temperature\": " + String(t, 1) +
								 ", \"humidity\": " + String(h, 1) +
								 ", \"timestamp\": \"" + timestr + "\" }";

				if (client.publish(mqtt_topic, payload.c_str()))
				{
					Serial.println("MQTT publish SUCCESS");
					lastSuccessfulMQTT = millis();
					consecutiveErrors = 0;
				}
				else
				{
					Serial.println("MQTT publish FAIL");
					consecutiveErrors++;
				}
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

		String timestr = getTimeString();

		display.clearDisplay();
		display.setCursor(0, 0);
		display.setTextSize(1);

		display.print("Temp: ");
		if (lastTemp == -999.0)
			display.println("--.- C");
		else
		{
			display.print(lastTemp, 1);
			display.println(" C");
		}

		display.print("Hum : ");
		if (lastHum == -999.0)
			display.println("--.- %");
		else
		{
			display.print(lastHum, 1);
			display.println(" %");
		}

		display.println("-----------------");
		display.println(timestr);
		display.display();
	}
}