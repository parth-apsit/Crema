# Crema DevOps — Implementation & Delivery Report

## Project Details
- **Project Name:** Crema Web POS & Customer Portal
- **Repository:** `Nextjs/crema-web`
- **Course / Assignment:** Cloud & DevOps Engineering
- **Date:** October 2026

---

## 1. Git Workflow & Version Control
Crema Web adopts a feature-branch and trunk-based workflow with automated CI validation:
- **`main` Branch:** Protected production branch. All merges require passing CI (lint, tests, build).
- **Commit Conventions:** Conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `ci:`, `docs:`).
- **PR Checks:** GitHub Actions triggers on all PRs targeting `main` to prevent breaking changes.

---

## 2. CI Pipeline Implementation
Continuous Integration is orchestrated via `.github/workflows/ci.yml`.

### Key Pipeline Stages:
1. **Dependency Resolution:** Utilizes `npm ci` with caching on Node.js 20.
2. **Linting & Code Quality:** ESLint with React 19 and Next.js 16 core web vitals.
3. **Automated Unit & Component Tests:** Vitest runner with 7 test suites (36 test cases) covering:
   - Discount calculations (percentage, flat, subtotal bounds).
   - Cart item mutation and quantity updates.
   - Order validation and order numbering.
   - Coupon lifecycle, expirations, and max usage thresholds.
   - Core UI component rendering and interactions (Badge, Button, Spinner).
4. **Standalone Production Build:** Compiles the complete Next.js app with `next build --webpack` and `output: 'standalone'`.

### Screenshot Placeholder: CI Pipeline Execution
```
[Insert Screenshot: GitHub Actions CI workflow run showing green checks for lint, test, and build]
```

---

## 3. Containerization (Docker)
The application is packaged using a multi-stage Dockerfile based on `node:20-alpine`:
- **Stage 1 (`deps`):** Downloads and caches production npm packages.
- **Stage 2 (`builder`):** Compiles the Next.js standalone server and bundles client assets.
- **Stage 3 (`runner`):** Minimal runtime container running as a non-privileged `nextjs` user on port 3000.
- **Healthcheck:** Embedded `wget --spider http://127.0.0.1:3000/api/health` probe.

### Multi-Container Orchestration (`docker-compose.yml`)
- **`crema-web`:** Port `3000` (Next.js Application, container healthcheck enabled)
- **`prometheus`:** Port `9090` (Scrapes `/api/metrics` every 10s over `crema-net`)
- **`grafana`:** Port `3001` (Pre-provisioned Prometheus datasource & dashboards)

### Local Launch Command:
```bash
docker compose up -d --build
```

### Verified Multi-Container Status (`docker compose ps`):
```text
$ docker compose ps
NAME               IMAGE                     COMMAND                  SERVICE      CREATED          STATUS                   PORTS
crema-grafana      grafana/grafana:10.3.3    "/run.sh"                grafana      15 minutes ago   Up 13 minutes            0.0.0.0:3001->3000/tcp
crema-prometheus   prom/prometheus:v2.50.1   "/bin/prometheus --c…"   prometheus   15 minutes ago   Up 13 minutes            0.0.0.0:9090->9090/tcp
crema-web          crema-crema-web           "docker-entrypoint.s…"   crema-web    12 minutes ago   Up 12 minutes (healthy)  0.0.0.0:3000->3000/tcp
```

---

## 4. Deployment Pipeline
The continuous delivery workflow is codified in `.github/workflows/deploy.yml`:
- Triggered automatically on push to `main`.
- Authenticates with GitHub Container Registry (`ghcr.io`).
- Builds and tags the multi-stage image with the commit SHA and `latest`.
- Pushes the image to `ghcr.io/<owner>/crema-web:latest`.
- Provides an automated deployment hook to pull the new image onto production VMs via SSH.

### Screenshot Placeholder: GHCR Package Published
```
[Insert Screenshot: GitHub Packages UI displaying the pushed crema-web container image]
```

---

## 5. Monitoring & Observability
A real-time telemetry stack was embedded directly into the application:
1. **Health Endpoint (`/api/health`):** Returns uptime, service status, and current timestamp.
2. **Prometheus Metrics (`/api/metrics`):**
   - `http_requests_total`: Request counter tagged by HTTP method, route, and status code.
   - `http_request_duration_seconds`: Latency summary.
   - `process_uptime_seconds`: Application uptime gauge.
   - `nodejs_heap_used_bytes` / `nodejs_heap_total_bytes`: Memory consumption metrics.
3. **Grafana Dashboards:** Auto-provisioned dashboard displaying app health, request volume, latency curves, and heap allocation.

### Verified Grafana Telemetry Dashboard:
The dashboard `Crema POS Application Overview` (`uid: crema-pos-overview`) is auto-provisioned at `http://localhost:3001/d/crema-pos-overview/crema-pos-application-overview` with four active panels querying Prometheus over `http://prometheus:9090`:
- **Application Uptime (`expr: process_uptime_seconds`)**: Stat panel displaying live application uptime.
- **Total HTTP Requests (`expr: sum(http_requests_total) or vector(0)`)**: Counter tracking live request throughput across routes (`/api/health`, `/api/metrics`, `/login`, `/customer/menu`).
- **Heap Memory Usage (`expr: nodejs_heap_used_bytes` / `nodejs_heap_total_bytes`)**: Real-time memory allocation graph.
- **HTTP Request Volume by Path (`expr: http_requests_total`)**: Grouped time-series breakdown of requests by HTTP status, path, and method.

---

## 6. Team Contributions Matrix

| Member Name | Role / Focus Area | Key Contributions |
|-------------|-------------------|-------------------|
| *Team Member 1* | *Full-Stack / Next.js* | *State management, cart/checkout flows, UI styling* |
| *Team Member 2* | *DevOps & CI/CD* | *GitHub Actions pipelines, Docker multi-stage build* |
| *Team Member 3* | *QA & Testing* | *Vitest suites, calculation test cases, edge cases* |
| *Team Member 4* | *Observability & Deployment*| *Prometheus scraping, Grafana provisioning, VM rollout* |
