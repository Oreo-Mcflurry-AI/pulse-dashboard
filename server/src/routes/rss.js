import { Router } from 'express';

const router = Router();

// Simple XML→JSON RSS/Atom parser (no deps)
function parseRSSItems(xml) {
  const items = [];
  // Try RSS <item> first, then Atom <entry>
  const isAtom = !xml.includes('<item') && xml.includes('<entry');
  const tag = isAtom ? 'entry' : 'item';
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const block = match[1];
    const get = (t) => {
      const m = block.match(new RegExp(`<${t}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${t}>`, 'i'))
        || block.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, 'i'));
      return m ? m[1].trim() : '';
    };
    const getAttr = (t, attr) => {
      const m = block.match(new RegExp(`<${t}[^>]*?${attr}=["']([^"']+)["']`, 'i'));
      return m ? m[1] : '';
    };

    const title = get('title').replace(/<[^>]+>/g, '');
    const link = isAtom ? (getAttr('link', 'href') || get('link')) : get('link');
    const pubDate = get('pubDate') || get('published') || get('updated') || get('dc:date');
    const source = get('source') || get('author') || get('dc:creator') || '';

    if (title) {
      items.push({ title, url: link, pubDate, source: source.replace(/<[^>]+>/g, '').trim() });
    }
  }
  return items;
}

// GET /api/rss?url=<encoded_rss_url>
router.get('/', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url parameter required' });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'PulseDashboard/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    const items = parseRSSItems(xml);

    // Extract feed title
    const feedTitleMatch = xml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const feedTitle = feedTitleMatch ? feedTitleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({ title: feedTitle, items: items.slice(0, 30), count: items.length });
  } catch (e) {
    res.status(502).json({ error: `Failed to fetch RSS: ${e.message}` });
  }
});

export default router;
