import { Router } from 'express';

const router = Router();
const startedAt = Date.now();

router.get('/', (req, res) => {
  const uptime = Math.floor((Date.now() - startedAt) / 1000);
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const mins = Math.floor((uptime % 3600) / 60);

  res.json({
    status: 'ok',
    uptime: `${days}d ${hours}h ${mins}m`,
    uptimeSeconds: uptime,
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    timestamp: new Date().toISOString(),
  });
});

export default router;
