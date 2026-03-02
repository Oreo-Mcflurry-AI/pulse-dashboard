import { Router } from 'express';
import { saveBriefing, getBriefingDates, getBriefingByDate } from '../db.js';

const router = Router();

// GET /api/briefings — 날짜 목록
router.get('/', (req, res) => {
  const dates = getBriefingDates();
  res.json({ dates });
});

// GET /api/briefings/:date — 특정 날짜 브리핑
router.get('/:date', (req, res) => {
  const { summary, articles } = getBriefingByDate(req.params.date);
  if (!summary && !articles.length) {
    return res.status(404).json({ error: 'No briefing for this date' });
  }
  res.json({ date: req.params.date, summary, articles });
});

// POST /api/briefings — 브리핑 저장 (cron에서 호출)
router.post('/', (req, res) => {
  try {
    const { date, summary, articles } = req.body;
    if (!date || !summary) {
      return res.status(400).json({ error: 'date and summary required' });
    }
    saveBriefing(date, summary, articles || []);
    res.json({ message: 'Saved', date, articleCount: (articles || []).length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
