import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import marketRouter from './routes/market.js';
import newsRouter from './routes/news.js';
import briefingRouter from './routes/briefing.js';
import streamRouter from './routes/stream.js';
import healthRouter from './routes/health.js';
import historyRouter from './routes/history.js';
import sectorsRouter from './routes/sectors.js';
import calendarRouter from './routes/calendar.js';
import stockRouter from './routes/stock.js';
import ogRouter from './routes/og.js';
import weatherRouter from './routes/weather.js';
import rssRouter from './routes/rss.js';
import { startMarketPrefetch } from './services/marketService.js';
import { startNewsPrefetch } from './services/newsService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 4100;

app.use(helmet({
  contentSecurityPolicy: false,  // CSP handled by frontend build
  crossOriginEmbedderPolicy: false,  // allow cross-origin images (OG thumbnails)
}));
app.use(cors());
app.use(compression());
app.use(express.json());

// ─── API request stats (exposed via /api/health) ───
export const apiStats = { totalRequests: 0, totalTimeMs: 0, routes: {} };
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/stream') return next(); // skip self + SSE
  const start = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    apiStats.totalRequests++;
    apiStats.totalTimeMs += elapsed;
    const key = req.originalUrl.replace('/api/', '').split(/[/?]/)[0] || 'unknown';
    if (!apiStats.routes[key]) apiStats.routes[key] = { count: 0, totalMs: 0 };
    apiStats.routes[key].count++;
    apiStats.routes[key].totalMs += elapsed;
  });
  next();
});

// Rate limiting for API routes (100 req/min per IP)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', apiLimiter);

// API routes
app.use('/api/market', marketRouter);
app.use('/api/news', newsRouter);
app.use('/api/briefings', briefingRouter);
app.use('/api/stream', streamRouter);
app.use('/api/health', healthRouter);
app.use('/api/history', historyRouter);
app.use('/api/sectors', sectorsRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/stock', stockRouter);
app.use('/api/og', ogRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/rss', rssRouter);

// Global error handler for API routes
app.use('/api', (err, req, res, _next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  console.error(`[ERROR] ${req.method} ${req.originalUrl} → ${status}: ${message}`);
  if (status === 500) console.error(err.stack);
  res.status(status).json({ error: message });
});

// Serve static frontend in production
app.use(express.static(join(__dirname, '../../client/dist')));
app.get('/{*path}', (req, res) => {
  res.sendFile(join(__dirname, '../../client/dist/index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`🔴 Pulse Dashboard API running on :${PORT}`);
  startMarketPrefetch();
  console.log(`📊 Market prefetch started (30s interval)`);
  startNewsPrefetch();
  console.log(`📰 News prefetch started (5min interval)`);
});

// Graceful shutdown (PM2 sends SIGINT)
process.on('SIGINT', () => {
  console.log('\n⏹️  Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
  // Force exit after 5s if connections linger
  setTimeout(() => process.exit(1), 5000);
});
