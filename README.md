# Crema — Coffee Shop Management System

Crema is a modern, responsive coffee shop ordering and operations management web platform built with Next.js, React, TypeScript, and Firebase Firestore. It includes a customer portal for browsing items, placing orders, and earning loyalty points, along with an administrative back-office for inventory tracking, order fulfillment, coupon generation, and sales reporting.

---

## Architecture Overview

```
                      +-----------------------------+
                      |   Client Browser (Next.js)  |
                      |   Customer & Admin Portals  |
                      +--------------+--------------+
                                     |
              +----------------------+----------------------+
              |                                             |
              v                                             v
+-----------------------------+               +-----------------------------+
|    Firebase Authentication  |               |      Cloud Firestore        |
|  - Email/Password Auth      |               |  - orders / users           |
|  - Role-based Access        |               |  - menu / inventory         |
+-----------------------------+               |  - coupons / categories     |
                                              +-----------------------------+
                                                             |
+-----------------------------+               +-----------------------------+
|      Next.js Middleware     |               |      Prometheus & Grafana   |
|  - /api/metrics collection  | ------------> |  - /api/metrics scrape      |
|  - /api/health endpoint     |               |  - Real-time dashboards     |
+-----------------------------+               +-----------------------------+
```

### Core Technologies
- **Frontend / Framework**: Next.js 16 (App Router), React 19, TypeScript
- **State Management & Auth**: React Context (`AuthContext`, `OrderContext`, `ToastContext`, `ReportContext`), Firebase Auth
- **Database**: Cloud Firestore (NoSQL, transactions for atomic inventory deductions)
- **Styling**: Vanilla CSS Modules & theme tokens (warm coffee aesthetic)
- **Analytics & Visualizations**: Recharts, Lucide Icons, SheetJS (xlsx export)
- **Containerization**: Multi-stage Docker (`node:22-alpine`) with standalone output
- **Observability**: Prometheus metrics exposition (`/api/metrics`), health endpoint (`/api/health`), Grafana dashboard
- **CI/CD**: GitHub Actions (lint, typecheck, unit & security tests, Docker smoke test, GHCR build & push)

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 22 (LTS) and npm 10+
- Firebase project credentials

### 1. Environment Setup
Copy the example environment file and configure your credentials:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your Firebase project keys and Grafana admin password:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=your_secure_password
```

### 2. Install Dependencies
```bash
npm ci --legacy-peer-deps
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `next dev --webpack` | Start local development server |
| `npm run build` | `next build --webpack` | Compile standalone production build |
| `npm run start` | `next start` | Launch production server |
| `npm run lint` | `eslint` | Execute ESLint checks across codebase |
| `npm run typecheck` | `tsc --noEmit` | Strict TypeScript compiler check without emitting artifacts |
| `npm test` | `vitest run` | Run all unit, component, and security test suites |
| `npm run test:watch` | `vitest` | Run tests in interactive watch mode |

---

## Running with Docker Compose

Crema includes a full Docker stack containing the application, Prometheus metrics scraper, and Grafana monitoring dashboard.

```bash
# Validate compose configuration
docker compose config --quiet

# Build container images without stale cache
docker compose build --no-cache

# Start the entire stack in detached mode
docker compose up -d

# Check service status and health
docker compose ps

# View application logs
docker compose logs --tail=100 crema-web
```

### Stack Endpoints & Port Bindings
- **Crema Web Application**: [http://localhost:3000](http://localhost:3000) (Ingress: `0.0.0.0:3000`)
- **Application Health Check**: [http://localhost:3000/api/health](http://localhost:3000/api/health)
- **Prometheus Metrics**: [http://localhost:3000/api/metrics](http://localhost:3000/api/metrics)
- **Prometheus UI**: [http://localhost:9090](http://localhost:9090) (Bound to loopback `127.0.0.1:9090`)
- **Grafana Dashboard**: [http://localhost:3001](http://localhost:3001) (Bound to loopback `127.0.0.1:3001`, authentication via `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`)

---

## Observability & Monitoring

The application surfaces standard Prometheus exposition metrics at `/api/metrics`:
- `http_requests_total`: Counter partitioned by HTTP method, route, and status code
- `http_request_duration_seconds`: Histogram with finite buckets (`0.005s` to `10s`), `+Inf`, sum, and count enabling p95 latency quantiles
- `process_uptime_seconds`: Process uptime in seconds
- `nodejs_heap_used_bytes` / `nodejs_heap_total_bytes`: Process heap memory usage in bytes
- `crema_app_info`: System metadata and application version

Pre-configured Grafana dashboards are automatically provisioned under `grafana/provisioning/` to visualize request rates (`sum(rate(http_requests_total[5m]))`), 5xx error ratios, p95 latency (`histogram_quantile(0.95, ...)`), heap allocation, and uptime out-of-the-box.

---

## Automated CI/CD Pipeline

The repository integrates two GitHub Actions workflows:

1. **Continuous Integration (`.github/workflows/ci.yml`)**:
   - Triggers on pull requests and pushes to `main`
   - Runs ESLint validation
   - Executes TypeScript typechecking (`npm run typecheck`)
   - Executes Vitest unit, component, and security test suites (51 tests)
   - Executes Next.js standalone production build (`npm run build`)
   - Runs container smoke test: builds Docker image, boots container, verifies `/api/health`, and tears down cleanly

2. **Continuous Deployment (`.github/workflows/deploy.yml`)**:
   - Triggers upon successful completion of the CI Pipeline
   - Builds production Docker image and publishes tagged artifacts (`latest` and immutable `sha-<commit>`) to GitHub Container Registry (GHCR)
   - Records immutable image digest
   - Supports automated SSH VM rollout when `DEPLOY_HOST`, `DEPLOY_USER`, and `DEPLOY_KEY` secrets are supplied; otherwise scopes delivery to verified GHCR publication
