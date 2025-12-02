import { useEffect, useState, useMemo } from "react";
import mqtt, { MqttClient } from "mqtt";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  ScatterChart,
  Scatter,
} from "recharts";
import { format, subMinutes, isAfter } from "date-fns";
import {
  Thermometer,
  Droplets,
  Activity,
  Database,
  Wifi,
  WifiOff,
  Clock,
  CloudDownload,
  AlertCircle,
  BarChart3,
  LineChartIcon,
  AreaChartIcon,
  ScatterChartIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Тип даних для кожного повідомлення
interface MqttPayload {
  temperature: number;
  humidity: number;
  timestamp: string;
  fullTimestamp: Date;
}

// Firebase document type (key from Firebase, data inside)
interface FirebaseDocument {
  device_id: string;
  temperature: number;
  humidity: number;
  timestamp: string;
}

interface FirebaseResponse {
  [key: string]: FirebaseDocument;
}

// Опції для вибору діапазону часу
const timeRangeOptions = [
  { id: '5m', name: 'Останні 5 хвилин', minutes: 5 },
  { id: '15m', name: 'Останні 15 хвилин', minutes: 15 },
  { id: '30m', name: 'Останні 30 хвилин', minutes: 30 },
  { id: '1h', name: 'Остання година', minutes: 60 },
  { id: '3h', name: 'Останні 3 години', minutes: 180 },
  { id: '6h', name: 'Останні 6 годин', minutes: 360 },
  { id: '12h', name: 'Останні 12 годин', minutes: 720 },
  { id: '24h', name: 'Останні 24 години', minutes: 1440 },
  { id: 'all', name: 'Всі дані', minutes: -1 },
];

// Типи графіків
const chartTypes = [
  { id: 'line', name: 'Лінійний графік', icon: '📈' },
  { id: 'area', name: 'Площинний графік', icon: '📊' },
  { id: 'bar', name: 'Стовпчастий графік', icon: '📊' },
  { id: 'composed', name: 'Комбінований', icon: '📈' },
  { id: 'scatter', name: 'Точковий графік', icon: '🔸' },
];


// Компонент для рендерингу різних типів графіків
const ChartRenderer = ({ chartType, data }: { chartType: string, data: MqttPayload[] }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Немає даних для відображення</p>
      </div>
    );
  }

  const renderContent = () => {
    switch (chartType) {
      case 'area':
        return (
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="temperature"
              stroke="#ef4444"
              fill="#fecaca"
              name="Температура (°C)"
            />
            <Area
              type="monotone"
              dataKey="humidity"
              stroke="#3b82f6"
              fill="#bfdbfe"
              name="Вологість (%)"
            />
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="temperature"
              fill="#ef4444"
              name="Температура (°C)"
            />
            <Bar
              dataKey="humidity"
              fill="#3b82f6"
              name="Вологість (%)"
            />
          </BarChart>
        );

      case 'scatter':
        return (
          <ScatterChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="temperature" name="Температура" />
            <YAxis type="number" dataKey="humidity" name="Вологість" />
            <Tooltip />
            <Scatter name="Дані датчика" data={data} fill="#ef4444" />
          </ScatterChart>
        );

      case 'composed':
        return (
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="humidity"
              fill="#bfdbfe"
              stroke="#3b82f6"
              name="Вологість (%)"
            />
            <Line
              type="monotone"
              dataKey="temperature"
              stroke="#ef4444"
              strokeWidth={2}
              name="Температура (°C)"
            />
          </ComposedChart>
        );

      default: // line chart
        return (
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="temperature"
              stroke="#ef4444"
              strokeWidth={2}
              name="Температура (°C)"
            />
            <Line
              type="monotone"
              dataKey="humidity"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Вологість (%)"
            />
          </LineChart>
        );
    }
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height={350}>
        {renderContent()}
      </ResponsiveContainer>
    </div>
  );
};

function App() {
  // Завантаження налаштувань з localStorage
  const [allData, setAllData] = useState<MqttPayload[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState(() => {
    const saved = localStorage.getItem('selectedTimeRange');
    if (saved) {
      const found = timeRangeOptions.find(opt => opt.id === saved);
      if (found) return found;
    }
    return timeRangeOptions[2]; // 30 хвилин за замовчуванням
  });
  const [selectedChartType, setSelectedChartType] = useState(() => {
    const saved = localStorage.getItem('selectedChartType');
    if (saved) {
      const found = chartTypes.find(type => type.id === saved);
      if (found) return found;
    }
    return chartTypes[0]; // Лінійний графік за замовчуванням
  });
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Firebase Realtime Database config
  const FIREBASE_URL = import.meta.env.VITE_FIREBASE_URL;
  const FIREBASE_AUTH = import.meta.env.VITE_FIREBASE_AUTH;

  // Завантаження історичних даних з Firebase при старті
  useEffect(() => {
    const fetchHistoricalData = async () => {
      if (!FIREBASE_URL) {
        console.log('Firebase URL not configured, skipping history fetch');
        return;
      }

      setIsLoadingHistory(true);
      try {
        // Firebase REST API: GET /measurements.json returns all data
        // We'll fetch all and sort/limit on client side (simpler, no index needed)
        let url = `${FIREBASE_URL}/measurements.json`;
        if (FIREBASE_AUTH) {
          url += `?auth=${FIREBASE_AUTH}`;
        }

        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`Firebase API error: ${res.status}`);
        }

        const data: FirebaseResponse | null = await res.json();
        console.log('Firebase historical data fetched:', data);
        if (!data) {
          console.log('No historical data in Firebase');
          setHistoryLoaded(true);
          return;
        }

        // Конвертуємо Firebase об'єкт в масив MqttPayload
        const historicalData: MqttPayload[] = Object.values(data)
          .map((doc: FirebaseDocument) => {
            const fullTimestamp = new Date(doc.timestamp);
            return {
              temperature: doc.temperature,
              humidity: doc.humidity,
              timestamp: format(fullTimestamp, 'HH:mm:ss'),
              fullTimestamp
            };
          })
          .sort((a, b) => a.fullTimestamp.getTime() - b.fullTimestamp.getTime()) // Сортуємо від старіших до новіших
          .slice(-500); // Беремо останні 500 записів

        setAllData(historicalData);
        setHistoryLoaded(true);
        console.log(`✅ Loaded ${historicalData.length} historical records from Firebase`);
      } catch (err) {
        console.error('❌ Error fetching historical data:', err);
        // Не показуємо помилку користувачу, продовжуємо без історії
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchHistoricalData();
  }, [FIREBASE_URL, FIREBASE_AUTH]);

  // Збереження налаштувань при зміні
  useEffect(() => {
    localStorage.setItem('selectedTimeRange', selectedTimeRange.id);
  }, [selectedTimeRange]);

  useEffect(() => {
    localStorage.setItem('selectedChartType', selectedChartType.id);
  }, [selectedChartType]);

  // Фільтрація даних за обраним діапазоном часу
  const filteredData = useMemo(() => {
    if (selectedTimeRange.minutes === -1) {
      return allData; // Всі дані
    }

    const cutoffTime = subMinutes(new Date(), selectedTimeRange.minutes);
    return allData.filter(point => isAfter(point.fullTimestamp, cutoffTime));
  }, [allData, selectedTimeRange]);

  // Статистика для відображення
  const stats = useMemo(() => {
    if (filteredData.length === 0) {
      return { avgTemp: 0, avgHumidity: 0, minTemp: 0, maxTemp: 0, minHumidity: 0, maxHumidity: 0 };
    }

    const temps = filteredData.map(d => d.temperature);
    const humidities = filteredData.map(d => d.humidity);

    return {
      avgTemp: temps.reduce((a, b) => a + b, 0) / temps.length,
      avgHumidity: humidities.reduce((a, b) => a + b, 0) / humidities.length,
      minTemp: Math.min(...temps),
      maxTemp: Math.max(...temps),
      minHumidity: Math.min(...humidities),
      maxHumidity: Math.max(...humidities),
    };
  }, [filteredData]);

  useEffect(() => {
    const MQTT_BROKER = import.meta.env.VITE_MQTT_BROKER || "wss://5748ea66407f483d9e153b77e9105b77.s1.eu.hivemq.cloud:8884/mqtt";
    const MQTT_USERNAME = import.meta.env.VITE_MQTT_USERNAME || "mqtt-front";
    const MQTT_PASSWORD = import.meta.env.VITE_MQTT_PASSWORD || "Qwerty-1";
    const MQTT_TOPIC = import.meta.env.VITE_MQTT_TOPIC || "esp32/dht11";
    
    const connectToMQTT = () => {
      const client: MqttClient = mqtt.connect(
        MQTT_BROKER,
        {
          username: MQTT_USERNAME,
          password: MQTT_PASSWORD,
          clientId: "react-dashboard-" + Math.random().toString(16).slice(2),
          protocol: "wss",
          reconnectPeriod: 5000, // Автоматичне перепідключення кожні 5 секунд
          connectTimeout: 30000, // Таймаут підключення 30 секунд
        }
      );

      client.on("connect", () => {
        console.log("✅ Connected to HiveMQ Cloud");
        setConnectionStatus('connected');
        setError(null);
        client.subscribe(MQTT_TOPIC, (err) => {
          if (err) {
            console.error("❌ Subscription error:", err);
            setError("Помилка підписки на топік");
          }
        });
      });

      client.on("reconnect", () => {
        console.log("🔄 Reconnecting to MQTT...");
        setConnectionStatus('connecting');
      });

      client.on("disconnect", () => {
        console.log("❌ Disconnected from HiveMQ Cloud");
        setConnectionStatus('disconnected');
      });

      client.on("offline", () => {
        console.log("📴 MQTT client offline");
        setConnectionStatus('disconnected');
      });

      client.on("error", (err) => {
        console.error("❌ MQTT Connection error:", err);
        setError(`Помилка підключення: ${err.message}`);
        setConnectionStatus('disconnected');
      });

      client.on("message", (_topic: string, message: Buffer) => {
        try {
          const payload: MqttPayload = JSON.parse(message.toString());
          const fullTimestamp = new Date(payload.timestamp);
          const newPoint: MqttPayload = {
            timestamp: format(fullTimestamp, 'HH:mm:ss'),
            fullTimestamp,
            temperature: payload.temperature,
            humidity: payload.humidity,
          };
          
          setAllData((prev) => {
            // Зберігаємо до 1000 точок для покращеної продуктивності
            const updated = [...prev, newPoint];
            return updated.length > 1000 ? updated.slice(-1000) : updated;
          });
          setLastUpdate(new Date());
          setError(null); // Очищаємо помилку при успішному отриманні даних
        } catch (err) {
          console.error("❌ Error parsing MQTT message:", err);
          setError("Помилка обробки даних");
        }
      });

      return client;
    };

    const client = connectToMQTT();

    return () => {
      client.end(true); // Форсоване закриття при розмонтуванні
    };
  }, []);

  const getConnectionBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <Badge variant="success" className="gap-1.5">
            <Wifi className="h-3 w-3" />
            Підключено
          </Badge>
        );
      case 'connecting':
        return (
          <Badge variant="warning" className="gap-1.5 animate-pulse">
            <Activity className="h-3 w-3" />
            Підключення...
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive" className="gap-1.5">
            <WifiOff className="h-3 w-3" />
            Відключено
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 tracking-tight mb-2">
            🌡️ ESP32 DHT11 Dashboard
          </h1>
          <p className="text-slate-500 text-lg mb-6">
            Real-time temperature and humidity monitoring
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-3">
            {getConnectionBadge()}
            
            {lastUpdate && (
              <Badge variant="outline" className="gap-1.5 text-slate-600 bg-white">
                <Clock className="h-3 w-3" />
                {format(lastUpdate, 'HH:mm:ss')}
              </Badge>
            )}

            {isLoadingHistory && (
              <Badge variant="secondary" className="gap-1.5 animate-pulse bg-white">
                <CloudDownload className="h-3 w-3" />
                Завантаження...
              </Badge>
            )}
            
            {historyLoaded && !isLoadingHistory && (
              <Badge variant="secondary" className="gap-1.5 bg-white">
                <Database className="h-3 w-3" />
                {allData.length} записів
              </Badge>
            )}
          </div>
          
          {/* Error Alert */}
          {error && (
            <div className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 max-w-xl mx-auto">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Середня температура
              </CardTitle>
              <Thermometer className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.avgTemp.toFixed(1)}°C
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {stats.minTemp.toFixed(1)}°C — {stats.maxTemp.toFixed(1)}°C
              </p>
            </CardContent>
          </Card>
          
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Середня вологість
              </CardTitle>
              <Droplets className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.avgHumidity.toFixed(1)}%
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {stats.minHumidity.toFixed(1)}% — {stats.maxHumidity.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Точок даних
              </CardTitle>
              <Activity className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">
                {filteredData.length}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                за обраний період
              </p>
            </CardContent>
          </Card>
          
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Всього даних
              </CardTitle>
              <Database className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {allData.length}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                збережено
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <Card className="mb-8 shadow-md">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">⚙️ Налаштування візуалізації</CardTitle>
            <CardDescription>Оберіть діапазон часу та тип графіка</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  🕐 Діапазон часу
                </label>
                <Select
                  value={selectedTimeRange.id}
                  onValueChange={(value: string) => 
                    setSelectedTimeRange(timeRangeOptions.find(opt => opt.id === value) || timeRangeOptions[2])
                  }
                >
                  <SelectTrigger className="bg-white text-slate-900 border-slate-300">
                    <SelectValue placeholder="Оберіть період" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 shadow-lg">
                    {timeRangeOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id} className="text-slate-900 hover:bg-slate-100">
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  📊 Тип графіка
                </label>
                <Select
                  value={selectedChartType.id}
                  onValueChange={(value: string) =>
                    setSelectedChartType(chartTypes.find(type => type.id === value) || chartTypes[0])
                  }
                >
                  <SelectTrigger className="bg-white text-slate-900 border-slate-300">
                    <SelectValue placeholder="Оберіть тип" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 shadow-lg">
                    {chartTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id} className="text-slate-900 hover:bg-slate-100">
                        <span className="flex items-center gap-2">
                          {type.id === 'line' && <LineChartIcon className="h-4 w-4" />}
                          {type.id === 'area' && <AreaChartIcon className="h-4 w-4" />}
                          {type.id === 'bar' && <BarChart3 className="h-4 w-4" />}
                          {type.id === 'composed' && <LineChartIcon className="h-4 w-4" />}
                          {type.id === 'scatter' && <ScatterChartIcon className="h-4 w-4" />}
                          {type.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart */}
        <Card className="shadow-md">
          <CardHeader className="text-center border-b border-slate-100 pb-4">
            <div className="flex flex-col items-center gap-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                {selectedChartType.id === 'line' && <LineChartIcon className="h-5 w-5" />}
                {selectedChartType.id === 'area' && <AreaChartIcon className="h-5 w-5" />}
                {selectedChartType.id === 'bar' && <BarChart3 className="h-5 w-5" />}
                {selectedChartType.id === 'composed' && <LineChartIcon className="h-5 w-5" />}
                {selectedChartType.id === 'scatter' && <ScatterChartIcon className="h-5 w-5" />}
                {selectedChartType.name}
              </CardTitle>
              <CardDescription>
                Відображає дані за {selectedTimeRange.name.toLowerCase()}
              </CardDescription>
              
              <div className="flex items-center gap-6 text-sm mt-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <span className="text-slate-600 font-medium">Температура</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <span className="text-slate-600 font-medium">Вологість</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-72 sm:h-80 lg:h-96 w-full rounded-xl bg-white border border-slate-100 p-4 sm:p-6">
              {filteredData.length > 0 ? (
                <ChartRenderer 
                  chartType={selectedChartType.id}
                  data={filteredData}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-lg text-slate-500 font-medium mb-1">
                      Очікування даних...
                    </p>
                    <p className="text-sm text-slate-400">
                      Переконайтеся, що ESP32 підключений
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default App;
