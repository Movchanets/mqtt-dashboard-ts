// WiFi credentials - ЗАМІНІТЬ НА СВОЇ
#define WIFI_SSID "TP-Link_Slavik"
#define WIFI_PASSWORD "Password01072005"

// MQTT HiveMQ Cloud credentials - ЗАМІНІТЬ НА СВОЇ
#define MQTT_SERVER "5748ea66407f483d9e153b77e9105b77.s1.eu.hivemq.cloud"
#define MQTT_PORT 8883
#define MQTT_CLIENT_ID "ESP32-DHT11"
#define MQTT_TOPIC "esp32/dht11"
#define MQTT_USER "Slavik"
#define MQTT_PASSWORD "Sl123456"

// NTP Configuration
#define NTP_SERVER "pool.ntp.org"
#define GMT_OFFSET_SEC (3 * 3600) // GMT+3 для України
#define DAYLIGHT_OFFSET_SEC 0

// Firebase Realtime Database
#define FIREBASE_HOST "https://mqtt-dashboard-2945b-default-rtdb.europe-west1.firebasedatabase.app/" // Firebase project URL (without https://)
#define FIREBASE_AUTH "twaqt7WycdgP71bZhwkudpNAIfwMcYAhCAMXQO1A"									 // Database secret (Project Settings -> Service accounts -> Database secrets)