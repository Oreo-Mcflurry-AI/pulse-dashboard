import { Router } from 'express';
import { getMarketData } from '../services/marketService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = await getMarketData();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
