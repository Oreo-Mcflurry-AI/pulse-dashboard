import { Router } from 'express';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getSseClientCount } from './stream.js';
import { execSync } from 'child_process';
import os from 'os';

const router = Router();
const startedAt = Date.now();
let peakHeapMB = 0;
let peakRssMB = 0;

// Track peak memory every 30s
setInterval(() => {
  const mem = process.memoryUsage();
  const heap = Math.round(mem.heapUsed / 1024 / 1024);
  const rss = Math.round(mem.rss / 1024 / 1024);
  if (heap > peakHeapMB) peakHeapMB = heap;
  if (rss > peakRssMB) peakRssMB = rss;
}, 30000);

// Lazy import to avoid circular dependency
let getIndexMod;
async function loadIndex() {
  if (!getIndexMod) {
    getIndexMod = await import('../index.js');
  }
  return getIndexMod;
}

// Read server version from package.json once at startup
let serverVersion = 'unknown';
let gitCommit = 'unknown';
let gitBranch = 'unknown';
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
  serverVersion = pkg.version || 'unknown';
  gitCommit = execSync('git rev-parse --short HEAD', { cwd: join(__dirname, '../..') }).toString().trim();
  gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: join(__dirname, '../..') }).toString().trim();
} catch { /* ignore */ }

router.get('/', async (req, res) => {
  const uptime = Math.floor((Date.now() - startedAt) / 1000);
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const mins = Math.floor((uptime % 3600) / 60);
  const mem = process.memoryUsage();

  let stats = null;
  let visitors = null;
  try {
    const mod = await loadIndex();
    const s = mod.apiStats;
    const avgMs = s.totalRequests > 0 ? Math.round(s.totalTimeMs / s.totalRequests) : 0;
    const routeAvg = {};
    for (const [k, v] of Object.entries(s.routes)) {
      routeAvg[k] = { count: v.count, avgMs: Math.round(v.totalMs / v.count) };
    }
    stats = { totalRequests: s.totalRequests, avgResponseMs: avgMs, routes: routeAvg };
    const v = mod.visitorStats;
    visitors = { date: v.date, uniqueIPs: v.ips.size, totalHits: v.total };
  } catch { /* ignore */ }

  const currentHeap = Math.round(mem.heapUsed / 1024 / 1024);
  const currentRss = Math.round(mem.rss / 1024 / 1024);
  if (currentHeap > peakHeapMB) peakHeapMB = currentHeap;
  if (currentRss > peakRssMB) peakRssMB = currentRss;

  res.json({
    status: 'ok',
    version: serverVersion,
    commit: gitCommit,
    branch: gitBranch,
    env: process.env.NODE_ENV || 'development',
    pid: process.pid,
    platform: process.platform,
    arch: process.arch,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    hostname: process.env.HOSTNAME || 'unknown',
    cpuCount: os.cpus().length,
    totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
    freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
    memoryUsagePercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
    node: process.version,
    uptime: `${days}d ${hours}h ${mins}m`,
    uptimeSeconds: uptime,
    memoryMB: currentRss,
    heapUsedMB: currentHeap,
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    peakRssMB,
    peakHeapMB,
    sseClients: getSseClientCount(),
    ...(stats && { apiStats: stats }),
    ...(visitors && { visitors }),
    timestamp: new Date().toISOString(),
  });
});

export default router;
