# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is an MQTT Dashboard built with React + TypeScript + Vite that connects to ESP32 devices via HiveMQ Cloud. The application receives real-time DHT22 sensor data (temperature and humidity) over MQTT WebSocket and displays it in live charts using Recharts.

## Development Commands

### Core Development
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production (TypeScript compilation + Vite build)
- `npm run preview` - Preview production build locally

### Code Quality
- `npm run lint` - Run ESLint on all files
- `tsc -b` - Run TypeScript type checking (included in build)

### Deployment
- `npm run deploy` - Deploy to GitHub Pages (runs predeploy + gh-pages)
- `npm run predeploy` - Build before deployment

## Architecture & Key Components

### MQTT Integration
- **Connection**: WebSocket secure connection to HiveMQ Cloud (`wss://...`)
- **Topic**: Subscribes to `esp32/dht11` for sensor data
- **Data Flow**: MQTT → JSON parsing → React state → Recharts visualization
- **Client Management**: Unique client IDs generated with random suffix

### Data Structure
```typescript
interface MqttPayload {
  temperature: number;
  humidity: number;
  timestamp: string;
}
```

### State Management
- Uses React's `useState` for storing sensor data array
- Maintains sliding window of last 20 data points (`data.slice(-19)`)
- Real-time updates via MQTT message callbacks

### Visualization
- **Library**: Recharts LineChart component
- **Axes**: X-axis shows formatted timestamps, Y-axis shows sensor values
- **Lines**: Red line for temperature, blue line for humidity
- **Features**: Grid, tooltip, legend, responsive design

## Technical Configuration

### Build Tools
- **Bundler**: Vite (using rolldown-vite fork for performance)
- **React Transform**: SWC for fast refresh
- **TypeScript**: Strict mode with comprehensive linting rules

### ESLint Configuration
- Extends: JS recommended + TypeScript + React Hooks + React Refresh
- Target: ES2020 with browser globals
- Strict TypeScript rules enabled

### Dependencies
- **Runtime**: React 19, MQTT.js 5.x, Recharts 3.x
- **Dev**: TypeScript 5.8, ESLint 9.x, Vite with SWC plugin

## Development Notes

### MQTT Connection Details
- **Broker**: HiveMQ Cloud WebSocket endpoint
- **Authentication**: Username/password based (credentials in source)
- **Protocol**: WebSocket Secure (WSS) over port 8884
- **Reconnection**: Handled by MQTT.js client

### Data Processing
- **JSON Parsing**: Robust error handling for malformed messages
- **Timestamp Formatting**: Converts to locale time string for display
- **Memory Management**: Automatic data window trimming to prevent memory leaks

### Deployment
- **Target**: GitHub Pages with custom base path `/mqtt-dashboard-ts/`
- **Build Output**: Static files in `dist/` directory
- **CI/CD**: Manual deployment via npm scripts

## File Structure Patterns

- `src/App.tsx` - Main application component with MQTT logic
- `src/main.tsx` - React application entry point
- `package.json` - Contains all development and deployment scripts
- `vite.config.ts` - Build configuration with GitHub Pages base path
- `eslint.config.js` - Comprehensive linting rules for TypeScript/React