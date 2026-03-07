import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import marketRouter from './routes/market.js';
import newsRouter from './routes/news.js';
import briefingRouter from './routes/briefing.js';
import streamRouter from './routes/stream.js';
import healthRouter from './routes/health.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 4100;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/market', marketRouter);
app.use('/api/news', newsRouter);
app.use('/api/briefings', briefingRouter);
app.use('/api/stream', streamRouter);
app.use('/api/health', healthRouter);

// Serve static frontend in production
app.use(express.static(join(__dirname, '../../client/dist')));
app.get('/{*path}', (req, res) => {
  res.sendFile(join(__dirname, '../../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`🔴 Pulse Dashboard API running on :${PORT}`);
});
