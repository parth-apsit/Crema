import { NextRequest, NextResponse } from 'next/server';
import { metrics } from '@/lib/metricsCollector';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const start = Date.now();
  const searchParams = request.nextUrl.searchParams;

  // Support controlled test error for observability validation
  if (searchParams.get('simulate_error') === '500') {
    const durationMs = Math.max(1, Date.now() - start);
    metrics.recordRequest({
      method: 'GET',
      path: '/api/health',
      status: 500,
      durationMs,
    });
    return NextResponse.json(
      { status: 'error', message: 'Simulated 500 error for observability testing' },
      { status: 500 }
    );
  }

  const uptime = metrics.getUptimeSeconds();
  const durationMs = Math.max(1, Date.now() - start);
  metrics.recordRequest({
    method: 'GET',
    path: '/api/health',
    status: 200,
    durationMs,
  });

  return NextResponse.json({
    status: 'ok',
    uptime,
    timestamp: new Date().toISOString(),
    service: 'crema-web',
    version: '0.1.0',
  });
}
