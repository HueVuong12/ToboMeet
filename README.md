# ToboMeet

Real-time online meeting and video conferencing platform featuring collaborative whiteboard, breakout rooms, meeting recording, and multi-platform support (Web, Desktop, Mobile).

---

## 📑 Table of Contents
1. [Project Structure](#-project-structure)
2. [Infrastructure Management (Docker & Docker Compose)](#-infrastructure-management-docker--docker-compose)
3. [Startup Commands from Root (`package.json`)](#-startup-commands-from-root-packagejson)
4. [Mobile App Build & Run Guide (EAS & Expo)](#-mobile-app-build--run-guide-eas--expo)

---

## 📂 Project Structure

```text
ToboMeet/
├── apps/
│   ├── web/          # Next.js App Router (Frontend Web & API Proxy / Auth Bridge)
│   ├── server/       # NestJS Server (Backend API, Socket.IO, BullMQ)
│   ├── desktop/      # Electron Desktop Application
│   ├── mobile/       # React Native / Expo Application
│   └── whiteboard/   # Tldraw Sync WebSocket Server (SQLite)
├── packages/         # Shared libraries & types (@tobomeet/shared)
├── docker-compose.yml# Docker services (Redis, LiveKit, Egress, Whiteboard)
└── package.json      # Workspace root package.json
```

---

## 🐳 Infrastructure Management (Docker & Docker Compose)

The system utilizes Docker Compose to manage platform infrastructure services.

### List of Services in `docker-compose.yml`:
- **`redis`** (`redis-dev`): Port `6379` - Caching & message queues (BullMQ, LiveKit Egress).
- **`livekit`** (`livekit-dev`): Ports `7880` (HTTP/WS API), `7881` (TCP), `7882/udp` (UDP) - LiveKit SFU Media Server.
- **`egress`** (`egress-dev`): Meeting session recording service.
- **`whiteboard`** (`whiteboard-dev`): Port `3002` - Tldraw WebSocket Sync Server.

---

### 1. Start and Build All Services

- **Start all containers running in the background (detach mode):**
  ```bash
  docker compose up -d
  ```

- **Rebuild images and start all containers:**
  ```bash
  docker compose up -d --build
  ```

- **Stop and remove all containers and networks for the project:**
  ```bash
  docker compose down
  ```

- **Stop and remove containers along with volumes (clears all Redis data):**
  ```bash
  docker compose down -v
  ```

---

### 2. Operations on Individual Services

| Operation | Syntax | Concrete Example |
| :--- | :--- | :--- |
| **Start container** | `docker compose up -d <service_name>` | `docker compose up -d whiteboard` |
| **Rebuild single image** | `docker compose build <service_name>` | `docker compose build whiteboard` |
| **Rebuild & restart** | `docker compose up -d --build <service_name>` | `docker compose up -d --build whiteboard` |
| **Restart container** | `docker compose restart <service_name>` | `docker compose restart livekit` |
| **Stop container** | `docker compose stop <service_name>` | `docker compose stop egress` |
| **View logs in real time** | `docker compose logs -f <service_name>` | `docker compose logs -f whiteboard` |

- **Start multiple specific services at once:**
  ```bash
  docker compose up -d redis livekit whiteboard
  ```

---

### 3. Status Checking and Logs

- **Check status of running containers:**
  ```bash
  docker compose ps
  ```

- **View real-time logs for all services:**
  ```bash
  docker compose logs -f
  ```

- **View the latest 100 log lines for a specific service:**
  ```bash
  docker compose logs -f --tail=100 whiteboard
  ```

---

## 🚀 Startup Commands from Root (`package.json`)

From the root directory of the project (`ToboMeet/`), you can use the following npm workspace commands:

### Development Mode:

- **Start NestJS Backend Server (`apps/server` - Port 3001):**
  ```bash
  npm run dev:server
  ```

- **Start Next.js Web App (`apps/web` - Port 3000):**
  ```bash
  npm run dev:web
  ```

- **Start Electron Desktop App (`apps/desktop`):**
  ```bash
  npm run dev:desktop
  ```

- **Start Expo Mobile App (`apps/mobile`):**
  ```bash
  npm run dev:mobile
  ```

### Production Build Mode:

- **Build Next.js Web App:**
  ```bash
  npm run build:web
  ```

- **Build NestJS Server:**
  ```bash
  npm run build:server
  ```

---

## 📱 Mobile App Build & Run Guide (EAS & Expo)

Before running any mobile-related commands, make sure to navigate to the `apps/mobile` directory:

```bash
cd apps/mobile
```

### 1. Build APK / Dev Client using EAS Build

To create an Android Development Client installation package (with native libraries such as WebRTC, WebView, etc.) with a freshly cleared cache:

```bash
cd apps/mobile
eas build --profile development --platform android --clear-cache
```

> **Note:**
> - EAS CLI is required: `npm install -g eas-cli`
> - Log in to your Expo account using: `eas login`

---

### 2. Launch Development Server for Mobile

After installing the built `.apk` file onto a physical device or Android emulator:

- **Launch Dev Client while clearing Metro bundler cache:**
  ```bash
  cd apps/mobile
  npx expo start --dev-client -c
  ```

- **Launch Dev Client over LAN (recommended for testing on physical devices on the same Wi-Fi network):**
  ```bash
  cd apps/mobile
  npx expo start --dev-client --lan -c
  ```