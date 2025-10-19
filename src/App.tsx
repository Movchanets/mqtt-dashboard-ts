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
import { ClockIcon, WifiIcon, SignalIcon } from "@heroicons/react/24/outline";
import { format, subMinutes, isAfter } from "date-fns";

// Тип даних для кожного повідомлення
interface MqttPayload {
  temperature: number;
  humidity: number;
  timestamp: string;
  fullTimestamp: Date;
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
const ChartRenderer = ({ chartType, data }: { chartType: string, data: any[] }) => {
  // Debug info
  console.log('ChartRenderer:', { chartType, dataLength: data.length, sampleData: data.slice(0, 2) });
  
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
  const [allData, setAllData] = useState<MqttPayload[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRangeOptions[2]); // 30 хвилин за замовчуванням
  const [selectedChartType, setSelectedChartType] = useState(chartTypes[0]); // Лінійний графік за замовчуванням
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

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
      setConnectionStatus('connected');
      client.subscribe("esp32/dht11");
    });

    client.on("disconnect", () => {
      console.log("❌ Disconnected from HiveMQ Cloud");
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
      } catch (err) {
        console.error("❌ Error parsing MQTT message:", err);
      }
    });

    return () => {
      client.end();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100  flex items-center justify-center">
      {/* Centered container */}
      <div className="w-full max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        {/* Header - Mobile First */}
        <div className="mb-6">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              📊 ESP32 DHT11 Dashboard
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              Real-time temperature and humidity monitoring
            </p>
          </div>
          
          {/* Status indicators - Mobile friendly */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Connection Status */}
            <div className={`inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium ${
              connectionStatus === 'connected' ? 'bg-green-100 text-green-800 border border-green-200' :
              connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
              'bg-red-100 text-red-800 border border-red-200'
            }`}>
              {connectionStatus === 'connected' && <WifiIcon className="w-3 h-3 mr-1 flex-shrink-0" style={{maxWidth: '12px', maxHeight: '12px'}} />}
              {connectionStatus === 'connecting' && <SignalIcon className="w-3 h-3 mr-1 flex-shrink-0 animate-pulse" style={{maxWidth: '12px', maxHeight: '12px'}} />}
              {connectionStatus === 'disconnected' && <WifiIcon className="w-3 h-3 mr-1 flex-shrink-0" style={{maxWidth: '12px', maxHeight: '12px'}} />}
              {connectionStatus === 'connected' ? 'Підключено' : 
               connectionStatus === 'connecting' ? 'Підключення...' : 'Відключено'}
            </div>
            
            {/* Last Update */}
            {lastUpdate && (
              <div className="flex items-center justify-center sm:justify-start text-sm text-gray-500">
                <ClockIcon className="w-3 h-3 mr-1 flex-shrink-0" style={{maxWidth: '12px', maxHeight: '12px'}} />
                Останнє оновлення: {format(lastUpdate, 'HH:mm:ss')}
              </div>
            )}
          </div>
        </div>
        

        {/* Stats Cards - Mobile First Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-600">Середня температура</div>
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-red-600 mb-1">
              {stats.avgTemp.toFixed(1)}°C
            </div>
            <div className="text-xs text-gray-500">
              {stats.minTemp.toFixed(1)}°C - {stats.maxTemp.toFixed(1)}°C
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-600">Середня вологість</div>
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-1">
              {stats.avgHumidity.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">
              {stats.minHumidity.toFixed(1)}% - {stats.maxHumidity.toFixed(1)}%
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-600">Точок даних</div>
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-indigo-600 mb-1">
              {filteredData.length}
            </div>
            <div className="text-xs text-gray-500">за обраний період</div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-600">Всього даних</div>
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-purple-600 mb-1">
              {allData.length}
            </div>
            <div className="text-xs text-gray-500">збережено</div>
          </div>
        </div>


        {/* Controls - Mobile First */}
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border border-gray-200 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center sm:text-left">
            Налаштування візуалізації
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Time Range Selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🕰️ Діапазон часу
              </label>
              <select 
                value={selectedTimeRange.id}
                onChange={(e) => setSelectedTimeRange(timeRangeOptions.find(opt => opt.id === e.target.value) || timeRangeOptions[2])}
                className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 font-medium text-base appearance-none cursor-pointer transition-all duration-200"
                style={{backgroundImage: "url(\"data:image/svg+xml;charset=utf8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23374151' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 5 6 6 6-6'/%3e%3c/svg%3e\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '16px 12px'}}
              >
                {timeRangeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Chart Type Selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📊 Тип графіка
              </label>
              <select 
                value={selectedChartType.id}
                onChange={(e) => setSelectedChartType(chartTypes.find(type => type.id === e.target.value) || chartTypes[0])}
                className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 font-medium text-base appearance-none cursor-pointer transition-all duration-200"
                style={{backgroundImage: "url(\"data:image/svg+xml;charset=utf8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23374151' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 5 6 6 6-6'/%3e%3c/svg%3e\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '16px 12px'}}
              >
                {chartTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.icon} {type.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Chart - Mobile First */}
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border border-gray-200">
          {/* Chart Header */}
          <div className="mb-4 sm:mb-6">
            <div className="text-center sm:text-left">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                {selectedChartType.icon} {selectedChartType.name}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Відображає дані за {selectedTimeRange.name.toLowerCase()}
              </p>
            </div>
            
            {/* Legend - Mobile friendly */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                <span className="font-medium">Температура</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span className="font-medium">Вологість</span>
              </div>
              <div className="text-gray-500 font-medium">
                Точок: {filteredData.length}
              </div>
            </div>
          </div>
          
          {/* Chart Container - Mobile responsive */}
          <div className="h-64 sm:h-80 lg:h-96 w-full bg-gray-50 rounded-xl p-2 sm:p-4">
            {filteredData.length > 0 ? (
              <ChartRenderer 
                chartType={selectedChartType.id}
                data={filteredData}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <SignalIcon className="w-8 h-8 text-gray-400 mx-auto mb-4" style={{maxWidth: '32px', maxHeight: '32px'}} />
                  <p className="text-base sm:text-lg text-gray-500 font-medium mb-2">Очікування даних...</p>
                  <p className="text-sm text-gray-400 px-4">
                    Переконайтеся, що ESP32 підключений
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    

  );
}

export default App;
