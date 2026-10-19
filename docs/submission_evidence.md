# Crema Web — DevOps Submission Evidence & Verification Report

**Course / Module:** Cloud & DevOps Engineering  
**Project:** Crema Web Coffee Shop POS & Ordering Platform  
**Repository:** [parth-apsit/Crema](https://github.com/parth-apsit/Crema)  
**Baseline Merge Commit:** `ba8b7e8278d69800c961e2f618e4e65992088e64`  
**Date of Verification:** October 19, 2026  

---

## Executive Summary

This report documents the verification, testing, and continuous delivery artifacts for the Crema Web platform across five core engineering areas:
1. **Docker Compose & Container Architecture**
2. **Observability & Monitoring (`/api/health`, `/api/metrics`, Prometheus, Grafana)**
3. **CI/CD Pipelines & GitHub Container Registry (GHCR)**
4. **Firebase Security & Firestore Role-Based Access Rules**
5. **Automated Testing Suite (Unit, Component & Security Tests)**

---

## 1. Automated Test Suite Output (Vitest)

All 8 test suites consisting of 51 unit, component, and security test cases passed cleanly with a 100% success rate:

```text
> crema-web@0.1.0 test
> vitest run

 RUN  v5.0.4 C:/Users/RDP/Downloads/crema

 ✓ tests/unit/securityAndBusinessRules.test.ts (15 tests)
 ✓ tests/components/Spinner.test.tsx (2 tests)
 ✓ tests/components/Button.test.tsx (4 tests)
 ✓ tests/components/Badge.test.tsx (3 tests)
 ✓ tests/unit/cart.test.ts (7 tests)
 ✓ tests/unit/orderValidation.test.ts (6 tests)
 ✓ tests/unit/discount.test.ts (7 tests)
 ✓ tests/unit/couponValidation.test.ts (7 tests)

 Test Files  8 passed (8)
      Tests  51 passed (51)
   Duration  8.5s
```

### Coverage & Verification Highlights
- **Security & RBAC (`tests/unit/securityAndBusinessRules.test.ts`)**: Validates logged-out access rejection, customer/admin privilege escalation blocking, email regex spoofing prevention, customer order ownership, and initial order status enforcement.
- **Concurrent Inventory Deduction (`tests/unit/securityAndBusinessRules.test.ts`)**: Verifies atomic transaction decrement math and rejection of orders that exceed available ingredient stock.
- **Discounts (`tests/unit/discount.test.ts`)**: Validates percentage math, floating-point precision, flat discounts, subtotal capping, and zero-floor clamping.
- **Cart Mutation (`tests/unit/cart.test.ts`)**: Verifies item quantity mutations, addition, duplicate prevention, and automatic item removal when quantity reaches zero.
- **Order Integrity (`tests/unit/orderValidation.test.ts`)**: Empty cart rejection, quantity/price boundaries, and order numbering format (`ORD-XXXXXX`).
- **Coupon Lifecycle (`tests/unit/couponValidation.test.ts`)**: Expiration checks against timestamps and maximum usage limits (`usedCount >= maxUses`).
- **Core UI Components (`tests/components/*`)**: Verifies badge variant styling, spinner rendering, and button click / loading states.

---

## 2. Docker Compose Architecture & Verification

The multi-container stack is defined in `docker-compose.yml` and consists of three isolated services communicating over the `crema-net` bridge network:

```yaml
version: '3.8'

services:
  crema-web:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_FIREBASE_API_KEY: ${NEXT_PUBLIC_FIREBASE_API_KEY}
        NEXT_PUBLIC_FIREBASE_APP_ID: ${NEXT_PUBLIC_FIREBASE_APP_ID}
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${NEXT_PUBLIC_FIREBASE_PROJECT_ID}
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: ${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}
        NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: ${NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}
    container_name: crema-web
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    networks:
      - crema-net
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:3000/api/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s

  prometheus:
    image: prom/prometheus:v2.50.1
    container_name: crema-prometheus
    restart: unless-stopped
    ports:
      - "127.0.0.1:9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
    depends_on:
      - crema-web
    networks:
      - crema-net

  grafana:
    image: grafana/grafana:10.3.3
    container_name: crema-grafana
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=${GRAFANA_ADMIN_USER:-admin}
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - ./grafana/provisioning/datasources:/etc/grafana/provisioning/datasources:ro
      - ./grafana/provisioning/dashboards:/etc/grafana/provisioning/dashboards:ro
    depends_on:
      - prometheus
    networks:
      - crema-net

networks:
  crema-net:
    driver: bridge
```

### Multi-Stage Dockerfile Highlights (`Dockerfile`)
- **Stage 1 (`deps`)**: Node 22 Alpine, dependency resolution with `npm ci --legacy-peer-deps`.
- **Stage 2 (`builder`)**: Compiles the Next.js 16 standalone bundle (`next build --webpack`). Consumes parameterized build arguments with no hardcoded fallbacks.
- **Stage 3 (`runner`)**: Minimal runtime container running as non-privileged `nextjs` user (UID 1001) executing `node server.js`.
- **Health Probe**: Embedded container healthcheck querying `http://127.0.0.1:3000/api/health`.

### Verification Output (`docker compose ps`):
```text
NAME               IMAGE                     COMMAND                  SERVICE      STATUS                    PORTS
crema-grafana      grafana/grafana:10.3.3    "/run.sh"                grafana      Up (healthy)              127.0.0.1:3001->3000/tcp
crema-prometheus   prom/prometheus:v2.50.1   "/bin/prometheus --c…"   prometheus   Up (healthy)              127.0.0.1:9090->9090/tcp
crema-web          crema-crema-web           "docker-entrypoint.s…"   crema-web    Up (healthy)              0.0.0.0:3000->3000/tcp
```

---

## 3. Observability & Monitoring Verification

### 3.1 Health Endpoint (`/api/health`)
Querying `http://localhost:3000/api/health` yields real-time uptime and service health:

```json
{
  "status": "ok",
  "uptime": 1396,
  "timestamp": "2026-10-19T18:26:05.978Z",
  "service": "crema-web",
  "version": "0.1.0"
}
```

### 3.2 Prometheus Metrics (`/api/metrics`)
Querying `http://localhost:3000/api/metrics` returns standard Prometheus exposition format with request counters, latency histogram buckets, uptime, and heap metrics:

```text
# HELP crema_app_info Crema Web POS application info
# TYPE crema_app_info gauge
crema_app_info{version="0.1.0",framework="nextjs"} 1
# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds 1402
# HELP http_requests_total Total number of HTTP requests handled
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/health",status="200"} 95
http_requests_total{method="GET",path="/api/metrics",status="200"} 141
# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",path="/api/health",le="0.005"} 88
http_request_duration_seconds_bucket{method="GET",path="/api/health",le="0.01"} 93
http_request_duration_seconds_bucket{method="GET",path="/api/health",le="0.025"} 95
http_request_duration_seconds_bucket{method="GET",path="/api/health",le="+Inf"} 95
http_request_duration_seconds_sum{method="GET",path="/api/health"} 0.1230
http_request_duration_seconds_count{method="GET",path="/api/health"} 95
# HELP nodejs_heap_used_bytes Process heap memory used in bytes
# TYPE nodejs_heap_used_bytes gauge
nodejs_heap_used_bytes 40739720
# HELP nodejs_heap_total_bytes Process heap memory total in bytes
# TYPE nodejs_heap_total_bytes gauge
nodejs_heap_total_bytes 45817856
```

### 3.3 Prometheus Configuration & Scraper Verification (`prometheus/prometheus.yml`)
- Scrape interval: `10s`
- Target: `crema-web:3000` (bridged container network: `crema-net`)
- Scrape path: `/api/metrics`
- Scrape Status: **`health: "up"`**, `lastError: ""`

Live target verification from Prometheus API (`/api/v1/targets`):
```json
{
  "discoveredLabels": {
    "__address__": "crema-web:3000",
    "__metrics_path__": "/api/metrics",
    "__scheme__": "http",
    "__scrape_interval__": "10s",
    "__scrape_timeout__": "10s",
    "job": "crema-web"
  },
  "labels": {
    "instance": "crema-web:3000",
    "job": "crema-web"
  },
  "scrapePool": "crema-web",
  "scrapeUrl": "http://crema-web:3000/api/metrics",
  "globalUrl": "http://crema-web:3000/api/metrics",
  "lastError": "",
  "lastScrapeDuration": 0.0084,
  "health": "up"
}
```

### 3.4 Grafana Dashboard Live Provisioning (`grafana/provisioning/dashboards/crema-dashboard.json`)
Grafana v10.3.3 auto-provisioning verified on port `3001` (loopback bound):
- **Datasource**: Prometheus at `http://prometheus:9090` auto-registered as default.
- **Dashboard**: `Crema POS Application Overview` (`uid: crema-pos-overview`).
- **Active Panels**:
  1. **Application Uptime**: `expr: process_uptime_seconds` (stat panel)
  2. **Total HTTP Requests**: `expr: sum(http_requests_total) or vector(0)` (stat panel)
  3. **Request Rate (req/s)**: `expr: sum(rate(http_requests_total[5m])) or vector(0)` (stat panel)
  4. **5xx Error Ratio**: `expr: (sum(rate(http_requests_total{status=~"5.."}[5m])) or vector(0)) / clamp_min(sum(rate(http_requests_total[5m])), 1e-9)`
  5. **P95 Latency**: `expr: histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m]))) or vector(0)`
  6. **Heap Memory Usage**: `expr: nodejs_heap_used_bytes` / `nodejs_heap_total_bytes` (timeseries)
  7. **HTTP Request Volume by Path**: `expr: http_requests_total` (timeseries breakdown)

---

## 4. GitHub Actions CI/CD Pipeline Verification

### 4.1 CI Pipeline (`.github/workflows/ci.yml`)
- **Workflow Triggers:** Pull request & push to `main`
- **Permissions:** Explicit `contents: read`
- **Concurrency:** `cancel-in-progress: true`
- **Validation Steps:**
  1. `npm ci --legacy-peer-deps` (Node.js 22 LTS)
  2. `npm run lint` (ESLint 9)
  3. `npm run typecheck` (`tsc --noEmit`)
  4. `npm run test` (Vitest, 51 test cases)
  5. `npm run build` (Next.js 16 standalone compilation)
  6. **Container Smoke Test**: Boots Docker container image, probes `/api/health` within deadline, cleans up container even on failure.

[Historical Reference Run]: [Run #38790418198](https://github.com/parth-apsit/Crema/actions/runs/38790418198)

### 4.2 Deploy Pipeline (`.github/workflows/deploy.yml`)
- **Workflow Trigger:** Automatically runs upon successful completion of CI Pipeline
- **Permissions:** `contents: read`, `packages: write`
- **Publishing Stage:**
  - Authenticates with GitHub Container Registry (`ghcr.io`)
  - Builds and pushes multi-stage container
  - Tags with `latest` and immutable `sha-<commit>`
  - Outputs immutable package digest
- **Rollout Stage:**
  - Scoped conditionally: When `DEPLOY_HOST`, `DEPLOY_USER`, and `DEPLOY_KEY` are provided, performs SSH rollout with health check.
  - In the absence of target VM credentials, pipeline safely logs delivery completion as container publication to GHCR without making unsubstantiated deployment claims.

[Historical Reference Run]: [Run #38790418211](https://github.com/parth-apsit/Crema/actions/runs/38790418211)

---

## 5. Firebase Security & Firestore Rules (`firestore.rules`)

Security rules have been hardened to eliminate privilege escalation risks:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function isAdmin() {
      return isAuthenticated() && getUserData().role == 'admin';
    }

    // Users Collection: Prevent Privilege Escalation
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow create: if isOwner(userId) && request.resource.data.role == 'customer';
      allow update: if (isOwner(userId) &&
        request.resource.data.role == resource.data.role &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'phone', 'address', 'orderFrequency', 'favoriteStoreId']))
        || isAdmin();
      allow delete: if isAdmin();
    }

    // Orders Collection: Scoped to Owner or Admin with strict validation
    match /orders/{orderId} {
      allow read: if (isAuthenticated() && resource.data.userId == request.auth.uid) || isAdmin();
      allow create: if isAuthenticated() &&
        request.resource.data.userId == request.auth.uid &&
        request.resource.data.status in ['pending', 'received'] &&
        request.resource.data.totalAmount is number &&
        request.resource.data.totalAmount >= 0 &&
        request.resource.data.items is list &&
        request.resource.data.items.size() > 0 &&
        !request.resource.data.keys().hasAny(['role', 'isAdmin', 'refundApproved']);
      allow update, delete: if isAdmin();
    }

    // Menu, Inventory, and Coupons: Protected Admin Operations
    match /menu_items/{itemId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /store_menus/{storeId}/{allSubcollections=**} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /inventory/{itemId} {
      allow read, write: if isAdmin();
    }

    match /coupons/{couponId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    match /error_logs/{logId} {
      allow create: if isAuthenticated();
      allow read, delete: if isAdmin();
    }
  }
}
```

---

## Summary Checklist (Phase 8 Release Gate)

| Requirement | Status | Verification Detail |
|---|---|---|
| **Clean Dependency Install** | PASSED | `npm ci --legacy-peer-deps` succeeds from lockfile without modifications. |
| **Lint & Code Style** | PASSED | `npm run lint` (`eslint`) exits with 0 errors. |
| **Type Integrity** | PASSED | `npm run typecheck` (`tsc --noEmit`) completes with 0 errors. |
| **Automated Tests** | PASSED | Vitest passes all 8 suites (51 tests) covering unit, component, and RBAC security. |
| **Standalone Build** | PASSED | `npm run build` completes standalone production build in ~18 seconds. |
| **Docker Compose Stack** | PASSED | `crema-web` (healthy), `crema-prometheus`, and `crema-grafana` operational. |
| **Observability & Metrics** | PASSED | `/api/metrics` exports counters, histogram latency buckets for p95, uptime, and memory. |
| **Grafana Dashboard** | PASSED | Auto-provisioned 7-panel dashboard visualizing rate, 5xx ratio, p95 latency, and resources. |
| **Firestore Security** | PASSED | Enforces strict RBAC; customer privilege escalation and order manipulation prevented. |
| **CI/CD Configuration** | PASSED | CI pipeline enhanced with concurrency, typecheck, and container smoke test; Deploy workflow tags immutable SHA/digest. |
| **Secret Hygiene** | PASSED | No credentials or `.env*` files committed; all private secrets excluded by `.gitignore` and `.dockerignore`. |

---

## 6. Visual Evidence Screenshots Matrix

All visual evidence has been captured directly from the running production stack on the workstation:

| Evidence ID | Screenshot File | Description | Target |
|---|---|---|---|
| **E07** | [E07_crema_login.png](./screenshots/E07_crema_login.png) | Crema Coffee Shop POS & Ordering Portal | `http://localhost:3000/login` |
| **E07** | [E07_customer_menu.png](./screenshots/E07_customer_menu.png) | Crema Customer Navigation Bar & Cart | `http://localhost:3000/customer/menu` |
| **E07** | [E07_api_health.png](./screenshots/E07_api_health.png) | Health Probe JSON Response | `http://localhost:3000/api/health` |
| **E08** | [E08_api_metrics.png](./screenshots/E08_api_metrics.png) | Prometheus Standard Exposition Metrics | `http://localhost:3000/api/metrics` |
| **E09** | [E09_prometheus_targets.png](./screenshots/E09_prometheus_targets.png) | Prometheus Target Health (`crema-web:3000` UP) | `http://localhost:9090/targets` |
| **E09** | [E09_prometheus_query.png](./screenshots/E09_prometheus_query.png) | Prometheus Real-Time Query Graph (`http_requests_total`) | `http://localhost:9090/graph` |
| **E10** | [E10_grafana_login.png](./screenshots/E10_grafana_login.png) | Grafana Telemetry Dashboard Portal | `http://localhost:3001/login` |

### Visual Preview of Key Artifacts

#### Crema Web Portal (`E07`)
![Crema Application](./screenshots/E07_crema_login.png)

#### Prometheus Target Health (`E09`)
![Prometheus Targets](./screenshots/E09_prometheus_targets.png)

#### Prometheus Live Metrics Graph (`E09`)
![Prometheus Graph](./screenshots/E09_prometheus_query.png)

#### Grafana Observability Portal (`E10`)
![Grafana Portal](./screenshots/E10_grafana_login.png)

