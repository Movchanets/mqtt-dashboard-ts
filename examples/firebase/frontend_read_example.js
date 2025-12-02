// Simple frontend example: read measurements from Firebase Realtime Database
// Firebase REST API is public-read if you configure rules, or use auth token

const FIREBASE_URL = "https://your-project-id.firebaseio.com";
const FIREBASE_AUTH = "YOUR_DATABASE_SECRET"; // Optional if rules allow public read

async function fetchLatest(limit = 50) {
  // Firebase REST API with orderBy and limitToLast
  let url = `${FIREBASE_URL}/measurements.json?orderBy="timestamp"&limitToLast=${limit}`;

  // Add auth if needed
  if (FIREBASE_AUTH) {
    url += `&auth=${FIREBASE_AUTH}`;
  }

  const res = await fetch(url);

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();

  if (!data) return [];

  // Convert Firebase object to array
  const docs = Object.entries(data).map(([key, value]) => ({
    id: key,
    ...value,
  }));

  // Sort by timestamp
  docs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return docs;
}

// Usage example
fetchLatest(20)
  .then((docs) => console.log("latest", docs))
  .catch(console.error);
