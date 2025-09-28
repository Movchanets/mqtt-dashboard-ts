import { useEffect, useState } from "react";
import mqtt, { MqttClient } from "mqtt";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// 🔹 Тип даних для кожного повідомлення
interface DataPoint {
  time: string;
  temperature: number;
  humidity: number;
}

function App() {
  const [data, setData] = useState<DataPoint[]>([]);

  useEffect(() => {
    const client: MqttClient = mqtt.connect(
      "wss://5748ea66407f483d9e153b77e9105b77.s1.eu.hivemq.cloud:8884/mqtt",
      {
        username: "mqtt-front", 
        password: "Qwerty-1", 
        clientId: "react-dashboard-" + Math.random().toString(16).slice(2),
        protocol: "wss",
      }
    );

    client.on("connect", () => {
      console.log("✅ Connected to HiveMQ Cloud");
      client.subscribe("esp32/dht22"); // топік ESP32
    });

    client.on("message", (topic: string, message: Buffer) => {
      try {
        // 🔹 Парсимо JSON з ESP32
        const payload: DataPoint = JSON.parse(message.toString());
        const newPoint: DataPoint = {
          time: new Date(payload.timestamp).toLocaleTimeString(),
          temperature: payload.temperature,
          humidity: payload.humidity,
        };

        // Зберігаємо лише останні 20 точок
        setData((prev) => [...prev.slice(-19), newPoint]);
      } catch (err) {
        console.error("❌ Error parsing MQTT message:", err);
      }
    });

    return () => client.end();
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h2>📊 ESP32 DHT22 Live Data (TypeScript + SWC)</h2>
      <LineChart width={800} height={400} data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="temperature"
          stroke="red"
          name="Температура (°C)"
        />
        <Line
          type="monotone"
          dataKey="humidity"
          stroke="blue"
          name="Вологість (%)"
        />
      </LineChart>
    </div>
  );
}

export default App;
