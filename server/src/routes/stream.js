import { Router } from 'express';
import { getMarketData, getSparklines } from '../services/marketService.js';
import { getNews } from '../services/newsService.js';

const router = Router();

// Shared state: server polls once, pushes to all SSE clients
let clients = [];
let cachedData = null;
let intervalId = null;

async function fetchAll() {
  try {
    const [market, sparklines, news] = await Promise.all([
      getMarketData(),
      getSparklines(),
      getNews(),
    ]);
    cachedData = { market: { ...market, sparklines }, news };
    broadcast(cachedData);
  } catch (e) {
    console.error('[SSE] fetch error:', e.message);
  }
}

function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach((res) => {
    try { res.write(payload); } catch { /* client gone */ }
  });
}

function startPolling() {
  if (intervalId) return;
  fetchAll(); // immediate first fetch
  intervalId = setInterval(fetchAll, 30000);
  console.log('[SSE] polling started (30s)');
}

function stopPolling() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[SSE] polling stopped (no clients)');
  }
}

router.get('/', (req, res) => {
  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx compat
  });

  // Send cached data immediately so client doesn't wait
  if (cachedData) {
    res.write(`data: ${JSON.stringify(cachedData)}\n\n`);
  }

  clients.push(res);
  console.log(`[SSE] client connected (${clients.length} total)`);

  // Start polling if first client
  if (clients.length === 1) startPolling();

  // Heartbeat every 15s to keep connection alive
  const hb = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { /* */ }
  }, 15000);

  req.on('close', () => {
    clearInterval(hb);
    clients = clients.filter((c) => c !== res);
    console.log(`[SSE] client disconnected (${clients.length} remaining)`);
    if (clients.length === 0) stopPolling();
  });
});

export default router;
