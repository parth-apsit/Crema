# Crema — How to Run & Operate the System

This guide provides end-to-end instructions for launching, verifying, and operating the Crema application stack.

---

## Quick Reference: Service URLs & Credentials

| Service | Host URL | Port / Ingress | Authentication | Description |
|---|---|---|---|---|
| **Crema Web Application** | [http://localhost:3000](http://localhost:3000) | `0.0.0.0:3000` | Firebase Auth | Customer & Admin POS portals |
| **App Health Probe** | [http://localhost:3000/api/health](http://localhost:3000/api/health) | `0.0.0.0:3000` | None | JSON health status, uptime, & liveness |
| **Prometheus Metrics** | [http://localhost:3000/api/metrics](http://localhost:3000/api/metrics) | `0.0.0.0:3000` | None | Raw Prometheus exposition format (v0.0.4) |
| **Prometheus Dashboard** | [http://localhost:9090](http://localhost:9090) | `127.0.0.1:9090` (Loopback) | None | Scrape targets, TSDB & PromQL query UI |
| **Grafana Monitoring** | [http://localhost:3001](http://localhost:3001) | `127.0.0.1:3001` (Loopback) | Configured in `.env.local` | Real-time observability dashboard |

> **Direct Dashboard Link:** [http://localhost:3001/d/crema-pos-overview/crema-pos-application-overview](http://localhost:3001/d/crema-pos-overview/crema-pos-application-overview)

---

## Method 1: Production Multi-Container Stack (Docker Compose) — Recommended

This method runs the entire production-grade topology: Next.js standalone container, Prometheus scraper, and Grafana telemetry.

### 1. Prerequisites Check
Make sure Docker CLI and Docker engine are operational:
```powershell
# In PowerShell (Windows):
docker version
```
```bash
# In Linux / WSL2:
docker version
```

### 2. Configuration Setup
Ensure your local environment configuration file (`.env.local`) exists with required Firebase and Grafana configuration:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAIXAiNC0qKQDkt5G-XaQj0hFAN4MCrEl8
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=coffee-1919.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=coffee-1919
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=coffee-1919.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=369807633070
NEXT_PUBLIC_FIREBASE_APP_ID=1:369807633070:web:b0cf0378d9ee167154db3f
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-45HZ2TR4TK
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=your_secure_password
```

### 3. Build and Start the Full Stack
From the project root:

```bash
# Validate Compose configuration syntax
docker compose config --quiet

# Build container images cleanly without stale cache
docker compose build --no-cache

# Start all 3 services in detached mode
docker compose up -d
```

### 4. Verify Container Status
Run:
```bash
docker compose ps
```
Expected output:
```text
NAME               IMAGE                     COMMAND                  SERVICE      STATUS                    PORTS
crema-grafana      grafana/grafana:10.3.3    "/run.sh"                grafana      Up (healthy)              127.0.0.1:3001->3000/tcp
crema-prometheus   prom/prometheus:v2.50.1   "/bin/prometheus --c…"   prometheus   Up (healthy)              127.0.0.1:9090->9090/tcp
crema-web          crema-crema-web           "docker-entrypoint.s…"   crema-web    Up (healthy)              0.0.0.0:3000->3000/tcp
```
> Notice that `crema-web` displays **`(healthy)`**.

### 5. Verify Health and Telemetry Endpoints
*(Use `curl.exe` on Windows PowerShell to bypass built-in PowerShell alias behavior)*

**Test Application Health:**
```powershell
curl.exe -fsS http://localhost:3000/api/health
```
Expected response:
```json
{"status":"ok","uptime":300,"timestamp":"2026-10-19T18:45:00.000Z","service":"crema-web","version":"0.1.0"}
```

**Test Prometheus Scraping:**
```powershell
curl.exe -fsS http://localhost:9090/api/v1/targets
```
Verify `crema-web:3000` reports `"health": "up"` with empty `lastError`.

**Test Application Metrics Exposition (Prometheus Format):**
```powershell
curl.exe -fsS http://localhost:3000/api/metrics
```

**Test Observability Queries (Prometheus API):**
```powershell
# Active target check
curl.exe -fsS "http://localhost:9090/api/v1/query?query=up"

# Total request counter
curl.exe -fsS "http://localhost:9090/api/v1/query?query=http_requests_total"

# P95 latency calculation from histogram
curl.exe -fsS "http://localhost:9090/api/v1/query?query=histogram_quantile(0.95,sum+by(le)(rate(http_request_duration_seconds_bucket[5m])))"
```

**Test Controlled Observability 5xx Error:**
```powershell
curl.exe -fsS "http://localhost:3000/api/health?simulate_error=500"
```

### 6. Inspect Service Logs
```bash
# View recent application logs
docker compose logs --tail=100 crema-web

# Follow all container logs in real time
docker compose logs -f
```

### 7. Stop or Restart the Stack
```bash
# Stop all containers (preserves volume data)
docker compose stop

# Restart stopped containers
docker compose start

# Tear down all containers and networks
docker compose down

# Full clean teardown including volumes
docker compose down -v
```

---

## Method 2: Local Bare-Metal Development (Node.js / npm)

For active frontend/backend development with hot-reloading:

### 1. Prerequisites
- Node.js `22.x` (CI and Docker parity)
- npm `10.x` or higher

### 2. Configure Environment Variables
Verify `.env.local` exists in the repository root.

### 3. Install Dependencies
```bash
npm ci --legacy-peer-deps
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. Changes to `.tsx` and `.css` files trigger hot module replacement.

### 5. Compile and Run Production Standalone Build Locally
```bash
# Compile Next.js 16 standalone production bundle
npm run build

# Start the compiled production server
npm run start
```

---

## Running Quality Assurance & Verification Commands

| Goal | Command | Description |
|---|---|---|
| **Run Complete Test Suite** | `npm test` | Executes 8 test suites across 51 test cases with Vitest (unit, component, security/RBAC) |
| **Interactive Watch Mode** | `npm run test:watch` | Re-runs tests automatically upon file changes |
| **Lint Codebase** | `npm run lint` | Runs ESLint 9 with Next.js rules |
| **TypeScript Typecheck** | `npm run typecheck` | Strict compiler type verification (`tsc --noEmit`) without emitting build artifacts |
| **Standalone Build** | `npm run build` | Compiles Next.js standalone bundle |

---

## Troubleshooting & Common Issues

### 1. `docker: Cannot connect to the Docker daemon`
- **Cause:** Docker daemon is stopped or Docker desktop/WSL2 integration is not active.
- **Fix:** Start the Docker daemon or service, or check `docker version`.

### 2. Container Healthcheck shows `(unhealthy)`
- **Cause:** Healthcheck probe connecting to `localhost:3000` which resolved to IPv6 `[::1]:3000` inside Alpine, while the node server listens on IPv4.
- **Fix:** Both `Dockerfile` and `docker-compose.yml` use explicit IPv4: `http://127.0.0.1:3000/api/health`.

### 3. Port Conflict (`Port 3000/3001/9090 is already allocated`)
- **Cause:** Another process or background development server is already bound to that port.
- **Fix:**
  ```powershell
  # Windows PowerShell:
  Get-NetTCPConnection -LocalPort 3000, 3001, 9090 -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess
  Stop-Process -Id <OwningProcessId> -Force
  ```

### 4. Grafana Admin Authentication
- **Fix:** Admin user and password are provided securely via `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD` in `.env.local` (or container environment variables). Hardcoded repository defaults have been removed.
