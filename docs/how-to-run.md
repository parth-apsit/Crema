# Crema — How to Run & Operate the System

This guide provides end-to-end instructions for launching, verifying, and troubleshooting the Crema application stack.

---

## Quick Reference: Service URLs & Credentials

| Service | Host URL | Port | Default Credentials | Description |
|---|---|---|---|---|
| **Crema Web Application** | [http://localhost:3000](http://localhost:3000) | `3000` | Firebase Auth | Customer & Admin POS portals |
| **App Health Probe** | [http://localhost:3000/api/health](http://localhost:3000/api/health) | `3000` | None | JSON health status & uptime |
| **Prometheus Metrics** | [http://localhost:3000/api/metrics](http://localhost:3000/api/metrics) | `3000` | None | Raw Prometheus exposition format |
| **Prometheus Dashboard** | [http://localhost:9090](http://localhost:9090) | `9090` | None | Scrape targets, TSDB & query UI |
| **Grafana Monitoring** | [http://localhost:3001](http://localhost:3001) | `3001` | `admin` / `admin` | Real-time observability dashboard |

> **Direct Dashboard Link:** [http://localhost:3001/d/crema-pos-overview/crema-pos-application-overview](http://localhost:3001/d/crema-pos-overview/crema-pos-application-overview)

---

## Method 1: Production Multi-Container Stack (Docker Compose) — Recommended

This method runs the entire production-grade topology: Next.js standalone container, Prometheus scraper, and Grafana telemetry.

### 1. Prerequisites Check
Make sure Docker CLI and the Linux Docker engine are available:
```powershell
docker info
```
If using the Windows RDP / WSL2 setup configured on this machine:
- The Linux Docker Engine runs inside WSL2 Ubuntu (`tcp://localhost:2376`).
- Your PowerShell environment should have `$env:DOCKER_HOST = "tcp://localhost:2376"` (configured automatically in PowerShell profile).
- If the Docker daemon is ever inactive, launch it with:
  ```powershell
  wsl -u root systemctl start docker
  ```

### 2. Build and Start the Full Stack
From the project root (`c:\Users\RDP\crema\Crema`):

```powershell
# Build container images and start all 3 services in detached mode
docker compose up -d --build
```

*Note: On this WSL2 setup, you can also trigger builds directly within WSL:*
```powershell
wsl -u root bash -c "cd /mnt/c/Users/RDP/crema/Crema && docker compose up -d --build"
```

### 3. Verify Container Status
Run:
```powershell
docker compose ps
```
Expected output:
```text
NAME               IMAGE                     COMMAND                  SERVICE      CREATED          STATUS                    PORTS
crema-grafana      grafana/grafana:10.3.3    "/run.sh"                grafana      15 minutes ago   Up 15 minutes             0.0.0.0:3001->3000/tcp, [::]:3001->3000/tcp
crema-prometheus   prom/prometheus:v2.50.1   "/bin/prometheus --c…"   prometheus   15 minutes ago   Up 15 minutes             0.0.0.0:9090->9090/tcp, [::]:9090->9090/tcp
crema-web          crema-crema-web           "docker-entrypoint.s…"   crema-web    15 minutes ago   Up 15 minutes (healthy)   0.0.0.0:3000->3000/tcp, [::]:3000->3000/tcp
```
> Notice that `crema-web` displays **`(healthy)`**.

### 4. Verify Health and Telemetry Endpoints

**Test Application Health:**
```powershell
curl http://localhost:3000/api/health
```
Expected response:
```json
{"status":"ok","uptime":300,"timestamp":"2026-10-15T18:45:00.000Z","service":"crema-web","version":"0.1.0"}
```

**Test Prometheus Scraping:**
```powershell
curl http://localhost:9090/api/v1/targets
```
Verify `crema-web:3000` reports `"health": "up"`.

**Test Grafana Telemetry Query:**
```powershell
curl -u admin:admin "http://localhost:3001/api/datasources/proxy/1/api/v1/query?query=http_requests_total"
```

### 5. Inspect Service Logs
```powershell
# Follow all container logs in real time
docker compose logs -f

# Follow specific container logs
docker compose logs -f crema-web
docker compose logs -f prometheus
docker compose logs -f grafana
```

### 6. Stop or Restart the Stack
```powershell
# Stop all containers (preserves container volumes and state)
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
- Node.js `20.x` or `22.x`
- npm `10.x` or higher

### 2. Configure Environment Variables
Verify `.env.local` exists in the repository root with valid Firebase credentials:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAIXAiNC0qKQDkt5G-XaQj0hFAN4MCrEl8
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=coffee-1919.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=coffee-1919
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=coffee-1919.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=369807633070
NEXT_PUBLIC_FIREBASE_APP_ID=1:369807633070:web:b0cf0378d9ee167154db3f
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-45HZ2TR4TK
```

### 3. Install Dependencies
```powershell
npm install --legacy-peer-deps
```

### 4. Start Development Server
```powershell
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. Changes to `.tsx` and `.css` files will trigger hot module replacement.

### 5. Compile and Run Production Build Locally
```powershell
# Compile Next.js 16 standalone production bundle
npm run build

# Start the compiled production server
npm run start
```

---

## Running Quality Assurance & Verification Commands

| Goal | Command | Description |
|---|---|---|
| **Run Unit & Component Tests** | `npm test` | Executes 4 test suites across 20 test cases with Vitest |
| **Watch Mode Tests** | `npm run test:watch` | Re-runs tests automatically upon file changes |
| **Coverage Report** | `npm run test:coverage` | Generates branch, function, and line coverage |
| **Lint Codebase** | `npm run lint` | Runs Next.js ESLint rules |
| **TypeScript Typecheck** | `npx tsc --noEmit` | Strict type verification without emitting build artifacts |
| **Validate Firestore Rules** | `firebase-tools` | Simulates security rule permissions (or CI automated run) |

---

## Troubleshooting & Common Issues

### 1. `docker: Cannot connect to the Docker daemon`
- **Cause:** The WSL2 Linux Docker engine is stopped or `$env:DOCKER_HOST` is unset.
- **Fix:**
  ```powershell
  # Start Docker daemon in WSL2
  wsl -u root systemctl start docker

  # Ensure DOCKER_HOST points to TCP socket
  $env:DOCKER_HOST = "tcp://localhost:2376"
  docker ps
  ```

### 2. `no matching manifest for windows/amd64 in the image cache`
- **Cause:** Docker CLI is communicating with the Windows native engine (`tcp://127.0.0.1:2375`) instead of the Linux engine (`tcp://localhost:2376`).
- **Fix:** Set `$env:DOCKER_HOST = "tcp://localhost:2376"` in your PowerShell session.

### 3. Container Healthcheck shows `(unhealthy)`
- **Cause:** Healthcheck probe connecting to `localhost:3000` which resolved to IPv6 `[::1]:3000` inside Alpine, while the node server listens on IPv4.
- **Fix:** Verify `docker-compose.yml` and `Dockerfile` use explicit IPv4: `http://127.0.0.1:3000/api/health`. Re-deploy with `docker compose up -d --no-build crema-web`.

### 4. Port Conflict (`Port 3000/3001/9090 is already allocated`)
- **Cause:** Another process or background development server is already bound to that port.
- **Fix:**
  ```powershell
  Get-NetTCPConnection -LocalPort 3000, 3001, 9090 -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess
  Stop-Process -Id <OwningProcessId> -Force
  ```

### 5. Grafana Asks for Password Change
- **Fix:** Default credentials are `admin` / `admin`. You can click **Skip** when prompted to set a new password, or update `GF_SECURITY_ADMIN_PASSWORD` in `docker-compose.yml`.
