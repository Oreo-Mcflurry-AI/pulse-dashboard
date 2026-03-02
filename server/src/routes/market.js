import { Router } from 'express';
import { getMarketData, getSparklines } from '../services/marketService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = await getMarketData();
    const sparklines = await getSparklines();
    res.json({ ...data, sparklines });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
