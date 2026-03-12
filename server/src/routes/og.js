import { Router } from 'express';
import { createHash } from 'crypto';
import { getOgData, setOgData } from '../db.js';

const router = Router();

// In-flight dedup to avoid hammering the same URL
const inFlight = new Map();

function hashUrl(url) {
  return createHash('md5').update(url).digest('hex');
}

function extractMeta(html, property, attr = 'property') {
  const r1 = new RegExp(`<meta[^>]*${attr}=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
  const r2 = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*${attr}=["']${property}["']`, 'i');
  return (html.match(r1) || html.match(r2))?.[1] || null;
}

async function fetchOgData(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PulseBot/1.0)' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return { image: null, description: null };

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

    const image = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image', 'name');
    const description = extractMeta(html, 'og:description')
      || extractMeta(html, 'description', 'name')
      || extractMeta(html, 'twitter:description', 'name');

    // Decode HTML entities in description
    const desc = description?.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x3D;/g, '=').replace(/&#39;/g, "'") || null;

    return { image, description: desc?.slice(0, 200) || null };
  } catch {
    return { image: null, description: null };
  }
}

// GET /api/og?url=https://...
router.get('/', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  const hash = hashUrl(url);

  // Check cache
  const cached = getOgData(hash);
  if (cached !== undefined) {
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json(cached || { image: null, description: null });
  }

  // Check if already fetching
  if (inFlight.has(hash)) {
    try {
      const data = await inFlight.get(hash);
      return res.json(data);
    } catch {
      return res.json({ image: null, description: null });
    }
  }

  // Fetch OG data
  const promise = fetchOgData(url).then(data => {
    setOgData(hash, data);
    inFlight.delete(hash);
    return data;
  }).catch(() => {
    setOgData(hash, { image: null, description: null });
    inFlight.delete(hash);
    return { image: null, description: null };
  });

  inFlight.set(hash, promise);

  const data = await promise;
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(data);
});

export default router;
