/**
 * In-memory Prometheus metrics collector for Next.js.
 * Implements bounded labels, histogram buckets for latency quantiles (p95),
 * and standard Prometheus exposition format.
 */

export interface RequestMetric {
  method: string;
  path: string;
  status: number;
  durationMs: number;
}

const HISTOGRAM_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export function normalizeMetricPath(rawPath: string): string {
  if (!rawPath) return '/';
  const clean = rawPath.split('?')[0].split('#')[0];
  if (clean.startsWith('/api/health')) return '/api/health';
  if (clean.startsWith('/api/metrics')) return '/api/metrics';
  if (clean.startsWith('/customer/')) return clean;
  if (clean.startsWith('/admin/')) return clean;
  if (clean === '/login' || clean === '/signup' || clean === '/') return clean;
  return clean.replace(/\/[a-zA-Z0-9_-]{16,}/g, '/:id');
}

class MetricsCollector {
  private startTime: number = Date.now();
  private requestCounts: Map<string, number> = new Map();
  private histogramBuckets: Map<string, Map<number, number>> = new Map();
  private durationSummary: Map<string, { sumMs: number; count: number }> = new Map();
  private totalDurationMs: number = 0;
  private totalRequests: number = 0;

  public recordRequest(metric: RequestMetric) {
    const method = metric.method.toUpperCase();
    const path = normalizeMetricPath(metric.path);
    const status = metric.status;
    const durationMs = Math.max(0, metric.durationMs);
    const durationSec = durationMs / 1000;

    // 1. Counter: http_requests_total
    const counterKey = `method="${method}",path="${path}",status="${status}"`;
    this.requestCounts.set(counterKey, (this.requestCounts.get(counterKey) || 0) + 1);

    this.totalRequests += 1;
    this.totalDurationMs += durationMs;

    // 2. Histogram: http_request_duration_seconds
    const routeKey = `method="${method}",path="${path}"`;
    let buckets = this.histogramBuckets.get(routeKey);
    if (!buckets) {
      buckets = new Map();
      for (const le of HISTOGRAM_BUCKETS) {
        buckets.set(le, 0);
      }
      this.histogramBuckets.set(routeKey, buckets);
    }

    for (const le of HISTOGRAM_BUCKETS) {
      if (durationSec <= le) {
        buckets.set(le, (buckets.get(le) || 0) + 1);
      }
    }

    const summary = this.durationSummary.get(routeKey) || { sumMs: 0, count: 0 };
    summary.sumMs += durationMs;
    summary.count += 1;
    this.durationSummary.set(routeKey, summary);
  }

  public getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  public toPrometheusFormat(): string {
    const lines: string[] = [];

    // App info
    lines.push('# HELP crema_app_info Crema Web POS application info');
    lines.push('# TYPE crema_app_info gauge');
    lines.push('crema_app_info{version="0.1.0",framework="nextjs"} 1');

    // Uptime
    lines.push('# HELP process_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${this.getUptimeSeconds()}`);

    // Request total counter
    lines.push('# HELP http_requests_total Total number of HTTP requests handled');
    lines.push('# TYPE http_requests_total counter');
    if (this.requestCounts.size === 0) {
      lines.push('http_requests_total{method="GET",path="/api/health",status="200"} 0');
    } else {
      for (const [labels, count] of this.requestCounts.entries()) {
        lines.push(`http_requests_total{${labels}} ${count}`);
      }
    }

    // Request duration histogram (with finite buckets, +Inf, sum, and count)
    lines.push('# HELP http_request_duration_seconds HTTP request duration in seconds');
    lines.push('# TYPE http_request_duration_seconds histogram');
    if (this.histogramBuckets.size === 0) {
      for (const le of HISTOGRAM_BUCKETS) {
        lines.push(`http_request_duration_seconds_bucket{le="${le}"} 0`);
      }
      lines.push('http_request_duration_seconds_bucket{le="+Inf"} 0');
      lines.push('http_request_duration_seconds_sum 0');
      lines.push('http_request_duration_seconds_count 0');
    } else {
      for (const [routeLabels, buckets] of this.histogramBuckets.entries()) {
        const summary = this.durationSummary.get(routeLabels) || { sumMs: 0, count: 0 };
        for (const le of HISTOGRAM_BUCKETS) {
          const count = buckets.get(le) || 0;
          lines.push(`http_request_duration_seconds_bucket{${routeLabels},le="${le}"} ${count}`);
        }
        lines.push(`http_request_duration_seconds_bucket{${routeLabels},le="+Inf"} ${summary.count}`);
        lines.push(`http_request_duration_seconds_sum{${routeLabels}} ${(summary.sumMs / 1000).toFixed(4)}`);
        lines.push(`http_request_duration_seconds_count{${routeLabels}} ${summary.count}`);
      }
    }

    // Memory stats
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const mem = process.memoryUsage();
      lines.push('# HELP nodejs_heap_used_bytes Process heap memory used in bytes');
      lines.push('# TYPE nodejs_heap_used_bytes gauge');
      lines.push(`nodejs_heap_used_bytes ${mem.heapUsed}`);

      lines.push('# HELP nodejs_heap_total_bytes Process heap memory total in bytes');
      lines.push('# TYPE nodejs_heap_total_bytes gauge');
      lines.push(`nodejs_heap_total_bytes ${mem.heapTotal}`);
    }

    return lines.join('\n') + '\n';
  }
}

// Global singleton across hot reloads in Node
const globalForMetrics = globalThis as unknown as { __cremaMetrics?: MetricsCollector };
export const metrics = globalForMetrics.__cremaMetrics || new MetricsCollector();
if (process.env.NODE_ENV !== 'production') {
  globalForMetrics.__cremaMetrics = metrics;
}
