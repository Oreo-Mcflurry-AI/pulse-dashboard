import { Router } from 'express';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const startedAt = Date.now();

// Lazy import to avoid circular dependency
let getApiStats;
async function loadStats() {
  if (!getApiStats) {
    const mod = await import('../index.js');
    getApiStats = () => mod.apiStats;
  }
  return getApiStats();
}

// Read server version from package.json once at startup
let serverVersion = 'unknown';
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
  serverVersion = pkg.version || 'unknown';
} catch { /* ignore */ }

router.get('/', async (req, res) => {
  const uptime = Math.floor((Date.now() - startedAt) / 1000);
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const mins = Math.floor((uptime % 3600) / 60);
  const mem = process.memoryUsage();

  let stats = null;
  try {
    const s = await loadStats();
    const avgMs = s.totalRequests > 0 ? Math.round(s.totalTimeMs / s.totalRequests) : 0;
    const routeAvg = {};
    for (const [k, v] of Object.entries(s.routes)) {
      routeAvg[k] = { count: v.count, avgMs: Math.round(v.totalMs / v.count) };
    }
    stats = { totalRequests: s.totalRequests, avgResponseMs: avgMs, routes: routeAvg };
  } catch { /* ignore */ }

  res.json({
    status: 'ok',
    version: serverVersion,
    node: process.version,
    uptime: `${days}d ${hours}h ${mins}m`,
    uptimeSeconds: uptime,
    memoryMB: Math.round(mem.rss / 1024 / 1024),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    ...(stats && { apiStats: stats }),
    timestamp: new Date().toISOString(),
  });
});

export default router;
