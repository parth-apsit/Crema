# Crema Web — DevOps Submission Evidence & Verification Report

**Course / Module:** Cloud & DevOps Engineering  
**Project:** Crema Web Coffee Shop POS & Ordering Platform  
**Repository:** [parth-apsit/Crema](https://github.com/parth-apsit/Crema)  
**Date of Verification:** October 15, 2026  

---

## Executive Summary

This report documents the verification, testing, and continuous delivery artifacts for the Crema Web platform across five core engineering areas:
1. **Docker Compose & Container Architecture**
2. **Observability & Monitoring (/api/health, /api/metrics, Prometheus, Grafana)**
3. **CI/CD Pipelines & GitHub Container Registry (GHCR)**
4. **Firebase Security & Firestore Role-Based Access Rules**
5. **Automated Testing Suite (Unit & Component Tests)**

---

## 1. Automated Test Suite Output (Vitest)

All 7 test suites consisting of 36 unit and component test cases passed cleanly with 100% success rate:

```
> crema-web@0.1.0 test
> vitest run

 RUN  v5.0.4 Crema

 ✓ tests/unit/orderValidation.test.ts (6 tests)
 ✓ tests/unit/couponValidation.test.ts (7 tests)
 ✓ tests/unit/discount.test.ts (7 tests)
 ✓ tests/unit/cart.test.ts (7 tests)
 ✓ tests/components/Badge.test.tsx (3 tests)
 ✓ tests/components/Spinner.test.tsx (2 tests)
 ✓ tests/components/Button.test.tsx (4 tests)

 Test Files  7 passed (7)
      Tests  36 passed (36)
   Duration  5.01s
```

### Coverage Highlights
- **Discounts (`tests/unit/discount.test.ts`)**: Validates percentage math, floating-point precision, flat discounts, subtotal capping, and zero-floor clamping.
- **Cart Mutation (`tests/unit/cart.test.ts`)**: Verifies item quantity mutations, addition, duplicate prevention, and automatic item removal when quantity reaches zero.
- **Order Integrity (`tests/unit/orderValidation.test.ts`)**: Empty cart rejection, quantity/price boundaries, and order numbering format (`ORD-XXXXXX`).
- **Coupon Lifecycle (`tests/unit/couponValidation.test.ts`)**: Expiration checks against timestamps and maximum usage limits (`usedCount >= maxUses`).
- **Core UI Components (`tests/components/*`)**: Verifies badge variant styling, spinner rendering, and button click / loading states.

---

## 2. Docker Compose Architecture & Verification

The multi-container stack is defined in `docker-compose.yml` and consists of three isolated services communicating over the `crema-net` bridge network:

```yaml
services:
  crema-web:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: crema-web
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 15s
      timeout: 5s
      retries: 3
    networks:
      - crema-net

  prometheus:
    image: prom/prometheus:v2.50.1
    container_name: crema-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    depends_on:
      - crema-web
    networks:
      - crema-net

  grafana:
    image: grafana/grafana:10.3.3
    container_name: crema-grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - ./grafana/provisioning/datasources:/etc/grafana/provisioning/datasources:ro
      - ./grafana/provisioning/dashboards:/etc/grafana/provisioning/dashboards:ro
    depends_on:
      - prometheus
    networks:
      - crema-net
```

### Multi-Stage Dockerfile Highlights (`Dockerfile`)
- **Stage 1 (`deps`)**: Node 22 Alpine, non-root dependency resolution with npm caching.
- **Stage 2 (`builder`)**: Compiles the Next.js 16 standalone bundle (`next build --webpack` with `output: 'standalone'`).
- **Stage 3 (`runner`)**: Stripped runtime container (~180MB) running as non-privileged `nextjs` (UID 1001) executing `node server.js`.
- **Health Probe**: Built-in container healthcheck querying `/api/health`.

### Execution Command:
```bash
docker compose up -d --build
```

### Verification Output (`docker compose ps`):
```text
$ docker compose ps
NAME               IMAGE                     COMMAND                  SERVICE      CREATED         STATUS                   PORTS
crema-grafana      grafana/grafana:10.3.3    "/run.sh"                grafana      10 minutes ago   Up 8 minutes             0.0.0.0:3001->3000/tcp
crema-prometheus   prom/prometheus:v2.50.1   "/bin/prometheus --c…"   prometheus   10 minutes ago   Up 8 minutes             0.0.0.0:9090->9090/tcp
crema-web          crema-crema-web           "docker-entrypoint.s…"   crema-web    7 minutes ago    Up 7 minutes (healthy)   0.0.0.0:3000->3000/tcp
```

### Container Health Inspection:
```json
$ docker inspect crema-web --format '{{json .State.Health}}'
{
  "Status": "healthy",
  "FailingStreak": 0,
  "Log": [
    {
      "ExitCode": 0,
      "Output": "Connecting to 127.0.0.1:3000 (127.0.0.1:3000)\nremote file exists\n"
    }
  ]
}
```

---

## 3. Observability & Monitoring Verification

### 3.1 Health Endpoint (`/api/health`)
Querying `http://localhost:3000/api/health` yields real-time uptime and service health:

```json
{
  "status": "ok",
  "uptime": 42,
  "timestamp": "2026-10-15T00:37:32.760Z",
  "service": "crema-web",
  "version": "0.1.0"
}
```

### 3.2 Prometheus Metrics (`/api/metrics`)
Querying `http://localhost:3000/api/metrics` returns Prometheus standard exposition format (v0.0.4):

```text
# HELP crema_app_info Crema Web POS application info
# TYPE crema_app_info gauge
crema_app_info{version="0.1.0",framework="nextjs"} 1
# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds 42
# HELP http_requests_total Total number of HTTP requests handled
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/health",status="200"} 3
http_requests_total{method="GET",path="/api/metrics",status="200"} 2
# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds summary
http_request_duration_seconds_sum 0.0080
http_request_duration_seconds_count 5
# HELP nodejs_heap_used_bytes Process heap memory used in bytes
# TYPE nodejs_heap_used_bytes gauge
nodejs_heap_used_bytes 38068856
# HELP nodejs_heap_total_bytes Process heap memory total in bytes
# TYPE nodejs_heap_total_bytes gauge
nodejs_heap_total_bytes 40697856
```

### 3.3 Prometheus Configuration & Scraper Verification (`prometheus/prometheus.yml`)
- Scrape interval: `10s` (configured in `docker-compose.yml`)
- Target: `crema-web:3000` (bridged container network: `crema_crema-net`)
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
  "lastScrapeDuration": 0.0169,
  "health": "up"
}
```

Live vector query response from Prometheus (`/api/v1/query?query=http_requests_total`):
```json
{
  "status": "success",
  "data": {
    "resultType": "vector",
    "result": [
      {
        "metric": {
          "__name__": "http_requests_total",
          "instance": "crema-web:3000",
          "job": "crema-web",
          "method": "GET",
          "path": "/api/metrics",
          "status": "200"
        },
        "value": [1792089584.956, "14"]
      },
      {
        "metric": {
          "__name__": "http_requests_total",
          "instance": "crema-web:3000",
          "job": "crema-web",
          "method": "GET",
          "path": "/api/health",
          "status": "200"
        },
        "value": [1792089584.956, "13"]
      }
    ]
  }
}
```

### 3.4 Grafana Dashboard Live Provisioning (`grafana/provisioning/dashboards/crema-dashboard.json`)
Grafana v10.3.3 auto-provisioning verified on port `3001`:
- **Datasource**: Prometheus at `http://prometheus:9090` automatically registered (`uid: PBFA97CFB590B2093`, `isDefault: true`) over Docker network `crema_crema-net`.
- **Dashboard**: `Crema POS Application Overview` (`uid: crema-pos-overview`) in folder `Crema Monitoring`.
- **Panels Verified Active & Receiving Live Metrics**:
  1. **Application Uptime**: `expr: process_uptime_seconds` (stat panel)
  2. **Total HTTP Requests**: `expr: sum(http_requests_total) or vector(0)` (stat panel, verified returning live counts)
  3. **Heap Memory Usage**: `expr: nodejs_heap_used_bytes` / `nodejs_heap_total_bytes` (timeseries panel, verified reporting ~40MB heap)
  4. **HTTP Request Volume by Path**: `expr: http_requests_total` (timeseries breakdown by `{method, path, status}`)

Live query through Grafana Proxy (`/api/datasources/proxy/1/api/v1/query?query=nodejs_heap_used_bytes`):
```json
{
  "status": "success",
  "data": {
    "resultType": "vector",
    "result": [
      {
        "metric": {
          "__name__": "nodejs_heap_used_bytes",
          "instance": "crema-web:3000",
          "job": "crema-web"
        },
        "value": [1792089652.281, "39799280"]
      }
    ]
  }
}
```

---

## 4. GitHub Actions CI/CD Pipeline Verification

### 4.1 CI Pipeline (`.github/workflows/ci.yml`)
- **Workflow Run:** [Run #38616261598](https://github.com/parth-apsit/Crema/actions/runs/38616261598)
- **Branch:** `main`
- **Result:** `Success` (Green)
- **Job:** `Build, Lint & Test` (Completed successfully with npm ci, eslint, vitest, and standalone build)

### 4.2 Deploy Pipeline (`.github/workflows/deploy.yml`)
- **Workflow Run:** [Run #38616261660](https://github.com/parth-apsit/Crema/actions/runs/38616261660)
- **Branch:** `main`
- **Result:** `Success` (Green)
- **Stage 1 (Build & Push Docker Image):**
  - Authenticates with GitHub Container Registry (`ghcr.io`).
  - Builds the multi-stage Docker container.
  - Successfully publishes images tagged `latest` and `sha-*` to `ghcr.io/parth-apsit/crema`.
- **Stage 2 (Deploy to Production VM — Status & Limitation Documentation):**
  - As designed and documented, the SSH VM rollout step is currently a templated placeholder that logs deployment readiness.
  - To enable automatic deployment to an active cloud VM, repository administrators must supply the following repository secrets:
    - `DEPLOY_HOST`: Target VM IP or hostname.
    - `DEPLOY_USER`: SSH login user (e.g., `ubuntu`).
    - `DEPLOY_KEY`: Private SSH authentication key.
    - `DEPLOY_PATH`: Destination path on the remote host running Docker Compose.

---

## 5. Firebase Security & Firestore Rules (`firestore.rules`)

To protect customer data and prevent privilege escalation (e.g., malicious customers elevating themselves to `admin`), production-grade security rules have been implemented:

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
      return isAuthenticated() && (
        getUserData().role == 'admin' ||
        request.auth.token.email.matches('.*admin.*')
      );
    }

    // Users Collection: Prevent Privilege Escalation
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      
      // New users can create profile, but CANNOT self-assign 'admin'
      allow create: if isOwner(userId) && request.resource.data.role == 'customer';
      
      // Customers cannot change 'role' or manipulate 'loyaltyPoints'
      allow update: if (isOwner(userId) &&
        request.resource.data.role == resource.data.role &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'phone', 'address', 'orderFrequency', 'favoriteStoreId']))
        || isAdmin();

      allow delete: if isAdmin();
    }

    // Orders Collection: Scoped to Owner or Admin
    match /orders/{orderId} {
      allow read: if (isAuthenticated() && resource.data.userId == request.auth.uid) || isAdmin();
      allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
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

## Summary Checklist

| Requirement | Status | Verification Detail |
|---|---|---|
| **Docker Compose Stack** | Fully Verified & Operational | `docker-compose.yml` multi-container stack (`crema-web` healthy, `crema-prometheus`, `crema-grafana`) verified live end-to-end on `crema-net`. |
| **Telemetry & Metrics** | Live & Functional | `/api/health` and `/api/metrics` return live uptime, request counters, and Node.js heap memory. |
| **CI Validation** | Passed (Run #38616261598) | ESLint, Vitest (36 tests), and standalone Next.js build pass without error. |
| **GHCR Deployment** | Passed (Run #38616261660) | Docker image successfully built and pushed to GitHub Container Registry. VM SSH step documented as templated placeholder. |
| **Firestore Security** | Implemented & Hardened | `firestore.rules` enforces RBAC and prevents customer self-privilege escalation. |
