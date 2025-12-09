
// The device will try to connect to each network in order until successful
struct WiFiCredentials
{
	const char *ssid;
	const char *password;
};

// Add as many networks as you need
const WiFiCredentials wifiNetworks[] = {

	{"slavikModem", "mzjt3672"},
	{"TP-Link_Slavik", "Password01072005"},
	{"Your_Work_WiFi_SSID", "Your_Work_Password"},
};

const int wifiNetworkCount = sizeof(wifiNetworks) / sizeof(wifiNetworks[0]);
// MQTT HiveMQ Cloud credentials - ЗАМІНІТЬ НА СВОЇ
#define MQTT_SERVER "5748ea66407f483d9e153b77e9105b77.s1.eu.hivemq.cloud"
#define MQTT_PORT 8883
#define MQTT_CLIENT_ID "ESP32-DHT11"
#define MQTT_TOPIC "esp32/dht11"
#define MQTT_USER "Slavik"
#define MQTT_PASSWORD "Sl123456"

// NTP Configuration
#define NTP_SERVER "pool.ntp.org"
#define GMT_OFFSET_SEC (2 * 3600) // GMT+3 для України
#define DAYLIGHT_OFFSET_SEC 0

// Firebase Realtime Database
#define FIREBASE_HOST "mqtt-dashboard-2945b-default-rtdb.europe-west1.firebasedatabase.app" // Firebase project URL (without https://)
#define FIREBASE_AUTH "twaqt7WycdgP71bZhwkudpNAIfwMcYAhCAMXQO1A"							// Database secret (Project Settings -> Service accounts -> Database secrets)