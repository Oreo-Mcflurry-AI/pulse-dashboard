import { Router } from 'express';
import { getNews } from '../services/newsService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const q = req.query.q || 'US Iran war Middle East markets';
    const data = await getNews(q);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
