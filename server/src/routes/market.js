import { Router } from 'express';
import { getMarketData, getSparklines, getWeek52, getVolume } from '../services/marketService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const [data, sparklines, week52, volume] = await Promise.all([
      getMarketData(),
      getSparklines(),
      getWeek52(),
      getVolume(),
    ]);
    res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
    res.json({ ...data, sparklines, week52, volume });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
