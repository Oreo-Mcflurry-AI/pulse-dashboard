import { Router } from 'express';
import { createHash } from 'crypto';
import { getOgImage, setOgImage } from '../db.js';

const router = Router();

// In-flight dedup to avoid hammering the same URL
const inFlight = new Map();

function hashUrl(url) {
  return createHash('md5').update(url).digest('hex');
}

async function fetchOgImageUrl(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PulseBot/1.0)' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    // Only read first 32KB for meta tags
    const reader = res.body.getReader();
    let html = '';
    const decoder = new TextDecoder();
    while (html.length < 32768) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel();

    // Extract og:image
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogMatch) return ogMatch[1];

    // Fallback: twitter:image
    const twMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    if (twMatch) return twMatch[1];

    return null;
  } catch {
    return null;
  }
}

// GET /api/og?url=https://...
router.get('/', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  const hash = hashUrl(url);

  // Check cache
  const cached = getOgImage(hash);
  if (cached !== null) {
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json({ image: cached || null });
  }

  // Check if already fetching
  if (inFlight.has(hash)) {
    try {
      const image = await inFlight.get(hash);
      return res.json({ image });
    } catch {
      return res.json({ image: null });
    }
  }

  // Fetch OG image
  const promise = fetchOgImageUrl(url).then(ogUrl => {
    setOgImage(hash, ogUrl);
    inFlight.delete(hash);
    return ogUrl;
  }).catch(() => {
    setOgImage(hash, null);
    inFlight.delete(hash);
    return null;
  });

  inFlight.set(hash, promise);

  const image = await promise;
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ image: image || null });
});

export default router;
