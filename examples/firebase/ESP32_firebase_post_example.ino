/*
  ESP32 example: POST sensor data to Firebase Realtime Database
  - Uses WiFiClientSecure + HTTPClient
  - Requires: set WIFI_SSID, WIFI_PASSWORD, FIREBASE_HOST, FIREBASE_AUTH below

  Notes:
  - Create a Firebase project at https://console.firebase.google.com
  - Enable Realtime Database
  - Get your database URL (e.g., your-project.firebaseio.com)
  - Get database secret from Project Settings -> Service accounts -> Database secrets
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// --- Configure these ---
const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Firebase Realtime Database settings
const char *FIREBASE_HOST = "your-project-id.firebaseio.com"; // Without https://
const char *FIREBASE_AUTH = "YOUR_DATABASE_SECRET";			  // Database secret

// Example reading (replace with real sensor reads)
float readTemperature() { return 23.7; }
float readHumidity() { return 55.2; }

String getTimestamp()
{
	// In real code, use NTP time
	return "2025-12-02T12:00:00";
}

void setup()
{
	Serial.begin(115200);
	delay(1000);
	WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
	Serial.print("Connecting WiFi");
	while (WiFi.status() != WL_CONNECTED)
	{
		delay(500);
		Serial.print('.');
	}
	Serial.println("\nWiFi connected");

	sendMeasurement();
}

void loop()
{
	// Send periodically
	delay(60 * 1000); // 60s
	sendMeasurement();
}

void sendMeasurement()
{
	float temperature = readTemperature();
	float humidity = readHumidity();
	String timestamp = getTimestamp();

	WiFiClientSecure client;
	client.setInsecure(); // For simplicity; in production use proper certs

	HTTPClient https;

	// Firebase REST API: POST to /measurements.json creates entry with auto-key
	String url = String("https://") + FIREBASE_HOST + "/measurements.json?auth=" + FIREBASE_AUTH;

	// Build JSON payload
	String json = "{";
	json += "\"device_id\":\"esp32-01\",";
	json += "\"temperature\":" + String(temperature, 2) + ",";
	json += "\"humidity\":" + String(humidity, 2) + ",";
	json += "\"timestamp\":\"" + timestamp + "\"";
	json += "}";

	Serial.println("POST " + url);
	https.begin(client, url);
	https.addHeader("Content-Type", "application/json");

	int httpResponseCode = https.POST(json);
	if (httpResponseCode > 0)
	{
		String payload = https.getString();
		Serial.printf("Response code: %d\n", httpResponseCode);
		Serial.println(payload);
	}
	else
	{
		Serial.printf("Error on sending POST: %s\n", https.errorToString(httpResponseCode).c_str());
	}
	https.end();
}
