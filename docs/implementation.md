# Crema DevOps — Implementation & Delivery Report

## Project Details
- **Project Name:** Crema Web POS & Customer Portal
- **Repository:** `parth-apsit/Crema` (https://github.com/parth-apsit/Crema)
- **Course / Assignment:** Cloud & DevOps Engineering
- **Date:** October 2026

---

## 1. Git Workflow & Version Control
Crema Web adopts a feature-branch and trunk-based workflow with automated CI validation:
- **`main` Branch:** Protected production branch. All merges require passing CI (lint, typecheck, tests, build, container smoke test).
- **Commit Conventions:** Conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `ci:`, `docs:`).
- **PR Checks:** GitHub Actions triggers on all PRs targeting `main` to prevent breaking changes.
- **Secret Protection:** `.env*` files and local secrets strictly ignored by `.gitignore` and `.dockerignore`.

---

## 2. CI Pipeline Implementation
Continuous Integration is orchestrated via `.github/workflows/ci.yml`.

### Key Pipeline Stages:
1. **Dependency Resolution:** Utilizes `npm ci --legacy-peer-deps` with caching on Node.js 22 LTS.
2. **Linting & Code Quality:** ESLint 9 with Next.js core web vitals and React 19 rules.
3. **TypeScript Typecheck:** `npm run typecheck` (`tsc --noEmit`) verifying type correctness across all modules.
4. **Automated Unit & Component Tests:** Vitest runner with 8 test suites (51 test cases) covering:
   - Security & RBAC: Customer/admin role separation, order ownership, privilege escalation defense.
   - Atomic inventory deductions: Concurrency safety and stock exhaustion rejection.
   - Discount calculations (percentage, flat, subtotal bounds).
   - Cart item mutation and quantity updates.
   - Order validation and order numbering (`ORD-XXXXXX`).
   - Coupon lifecycle, expirations, and max usage thresholds.
   - Core UI component rendering and interactions (Badge, Button, Spinner).
5. **Standalone Production Build:** Compiles the complete Next.js app with `next build --webpack` and `output: 'standalone'`.
6. **Container Smoke Test:** Builds the production container image, boots the container, verifies the `/api/health` and `/api/metrics` endpoints within a 60-second deadline, and tears down cleanly.

---

## 3. Containerization (Docker)
The application is packaged using a multi-stage Dockerfile based on `node:22-alpine`:
- **Stage 1 (`deps`):** Downloads and caches production npm packages.
- **Stage 2 (`builder`):** Compiles the Next.js standalone server and bundles client assets. Accepts build arguments without hardcoded fallback credentials.
- **Stage 3 (`runner`):** Minimal runtime container running as a non-privileged `nextjs` user (UID 1001) on port 3000.
- **Healthcheck:** Embedded `wget --spider http://127.0.0.1:3000/api/health` probe.

### Multi-Container Orchestration (`docker-compose.yml`)
- **`crema-web`:** Port `3000:3000` (Next.js Application, container healthcheck enabled)
- **`prometheus`:** Port `127.0.0.1:9090:9090` (Scrapes `/api/metrics` every 10s over `crema-net`, loopback bound)
- **`grafana`:** Port `127.0.0.1:3001:3000` (Pre-provisioned Prometheus datasource & dashboards, loopback bound, authenticated via environment variables)

### Local Launch Command:
```bash
docker compose config --quiet
docker compose build --no-cache
docker compose up -d
```

### Verified Multi-Container Status (`docker compose ps`):
```text
NAME               IMAGE                     COMMAND                  SERVICE      STATUS                    PORTS
crema-grafana      grafana/grafana:10.3.3    "/run.sh"                grafana      Up (healthy)              127.0.0.1:3001->3000/tcp
crema-prometheus   prom/prometheus:v2.50.1   "/bin/prometheus --c…"   prometheus   Up (healthy)              127.0.0.1:9090->9090/tcp
crema-web          crema-crema-web           "docker-entrypoint.s…"   crema-web    Up (healthy)              0.0.0.0:3000->3000/tcp
```

---

## 4. Deployment Pipeline
The continuous delivery workflow is codified in `.github/workflows/deploy.yml`:
- Triggered automatically upon successful completion of the CI Pipeline.
- Authenticates with GitHub Container Registry (`ghcr.io`).
- Builds and tags the multi-stage image with the immutable commit SHA (`sha-<commit>`) and `latest`.
- Pushes the image to `ghcr.io/parth-apsit/crema`.
- Records immutable image digest in pipeline execution logs.
- Automated VM Rollout Status: When `DEPLOY_HOST`, `DEPLOY_USER`, and `DEPLOY_KEY` secrets are configured, an SSH step performs zero-downtime container rollout with healthcheck validation. In the absence of target VM secrets, delivery is accurately scoped and reported as container artifact publication to GHCR.

---

## 5. Monitoring & Observability
A real-time telemetry stack is embedded directly into the application:
1. **Health Endpoint (`/api/health`):** Returns uptime, service status, and current timestamp. Supports controlled simulation of 5xx errors for alert and metric verification.
2. **Prometheus Metrics (`/api/metrics`):**
   - `http_requests_total`: Request counter partitioned by HTTP method, route, and status code.
   - `http_request_duration_seconds`: Histogram with finite buckets (`0.005s` to `10s`), sum, and count enabling exact p95 latency quantile computation.
   - `process_uptime_seconds`: Application uptime gauge.
   - `nodejs_heap_used_bytes` / `nodejs_heap_total_bytes`: Process heap memory allocation metrics.
   - `crema_app_info`: Application metadata and version.
3. **Grafana Dashboards:** Auto-provisioned dashboard displaying:
   - Application Uptime (`process_uptime_seconds`)
   - Total HTTP Requests (`sum(http_requests_total)`)
   - Request Rate (`sum(rate(http_requests_total[5m]))`)
   - 5xx Error Ratio (`sum(rate(http_requests_total{status=~"5.."}[5m])) / clamp_min(...)`)
   - P95 Request Latency (`histogram_quantile(0.95, sum by (le) (rate(...)))`)
   - Heap Memory Usage (`nodejs_heap_used_bytes`, `nodejs_heap_total_bytes`)
   - Request Volume Breakdown by Path

---

## 6. Team Contributions Matrix

| Member Name | Role / Focus Area | Key Contributions |
|---|---|---|
| **Parth (Lead)** | *Lead DevOps & CI/CD* | Multi-stage Docker containerization, GitHub Actions CI & deploy pipelines, GHCR delivery, zero-error remediation. |
| **Observability Lead** | *SRE & Telemetry* | Custom Prometheus exposition metrics, histogram latency buckets, p95 calculation, Grafana dashboard auto-provisioning. |
| **Security Engineer** | *Cloud Security & Governance* | Firestore RBAC rules hardening, customer/admin privilege escalation defense, secret hygiene, non-root container user enforcement. |
| **QA Automation Lead** | *Software Quality & Testing* | Vitest test suites (51 tests), order/coupon calculation validation, concurrency deduction testing, TypeScript strict typechecking. |
