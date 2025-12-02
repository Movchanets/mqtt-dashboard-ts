# Firebase Realtime Database Examples

This folder contains examples showing how to use Firebase Realtime Database so that:

- The ESP32 device can write telemetry directly (no custom server required)
- The frontend (browser) can read data directly (no server required)

## Setup (Firebase Console)

### 1. Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Add project" and follow the wizard
3. No need to enable Google Analytics for IoT projects

### 2. Create Realtime Database

1. In the Firebase console, go to "Build" → "Realtime Database"
2. Click "Create Database"
3. Choose your region (e.g., `europe-west1`)
4. Start in **test mode** for development (allows read/write for 30 days)
5. Note your database URL: `https://your-project-id-default-rtdb.europe-west1.firebasedatabase.app`

### 3. Get Database Secret (for ESP32)

1. Go to Project Settings (gear icon) → "Service accounts"
2. Click "Database secrets" (may need to show deprecated options)
3. Click "Show" and copy the secret
4. This is your `FIREBASE_AUTH` value

### 4. Configure Security Rules

For production, set proper rules. Example allowing authenticated writes:

```json
{
  "rules": {
    "measurements": {
      ".read": true,
      ".write": "auth != null",
      ".indexOn": ["timestamp"]
    }
  }
}
```

For development/testing (less secure):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

## ESP32 Example

See `ESP32_firebase_post_example.ino` for a simple POST to Firebase REST API.

Replace in the sketch:

- `WIFI_SSID`, `WIFI_PASSWORD` - Your WiFi credentials
- `FIREBASE_HOST` - Your database URL (without `https://`)
- `FIREBASE_AUTH` - Your database secret

## Frontend Example

See `frontend_read_example.js` for a minimal fetch-based example using Firebase REST API.

Replace:

- `FIREBASE_URL` - Full database URL with `https://`
- `FIREBASE_AUTH` - Database secret (or omit if rules allow public read)

## Environment Variables

### ESP32 (`secrets.h`)

```cpp
#define FIREBASE_HOST "your-project-id-default-rtdb.europe-west1.firebasedatabase.app"
#define FIREBASE_AUTH "your-database-secret"
```

### React (`.env`)

```env
VITE_FIREBASE_URL=https://your-project-id-default-rtdb.europe-west1.firebasedatabase.app
VITE_FIREBASE_AUTH=your-database-secret
```

### GitHub Secrets

Add these to your repository secrets:

- `VITE_FIREBASE_URL`
- `VITE_FIREBASE_AUTH`

## Data Structure

Data is stored as:

```
/measurements
  /-randomKey1
    device_id: "esp32-dht11"
    temperature: 23.5
    humidity: 55.0
    timestamp: "2025-12-02 14:30:00"
  /-randomKey2
    ...
```

## Security Notes

- **Database secrets** are deprecated but still work. For production, consider using Firebase Authentication with custom tokens.
- Never expose write-capable secrets in client-side code.
- Use security rules to restrict access.
- For read-only public access, configure rules to allow `.read: true` but `.write: false` (or auth-only).

## Advantages of Firebase

✅ Free tier: 1GB storage, 10GB/month download  
✅ Simple REST API (works with ESP32 HTTPClient)  
✅ Real-time sync capability  
✅ No server needed  
✅ Easy to set up

## Further Reading

- [Firebase Realtime Database REST API](https://firebase.google.com/docs/reference/rest/database)
- [Firebase Security Rules](https://firebase.google.com/docs/database/security)
- [ESP32 + Firebase Tutorial](https://randomnerdtutorials.com/esp32-firebase-realtime-database/)
