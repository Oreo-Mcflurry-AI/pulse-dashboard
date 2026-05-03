import { Router } from 'express';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const startedAt = Date.now();

// Read server version from package.json once at startup
let serverVersion = 'unknown';
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
  serverVersion = pkg.version || 'unknown';
} catch { /* ignore */ }

router.get('/', (req, res) => {
  const uptime = Math.floor((Date.now() - startedAt) / 1000);
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const mins = Math.floor((uptime % 3600) / 60);
  const mem = process.memoryUsage();

  res.json({
    status: 'ok',
    version: serverVersion,
    node: process.version,
    uptime: `${days}d ${hours}h ${mins}m`,
    uptimeSeconds: uptime,
    memoryMB: Math.round(mem.rss / 1024 / 1024),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    timestamp: new Date().toISOString(),
  });
});

export default router;
