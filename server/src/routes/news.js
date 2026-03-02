import { Router } from 'express';
import { getNews } from '../services/newsService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = await getNews();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
