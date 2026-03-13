import { Router } from 'express';
import { getCache, setCache } from '../db.js';

const router = Router();
const CACHE_TTL = 30 * 60_000; // 30min

const WEATHER_CODES = {
  0: { desc: '맑음', icon: '☀️' },
  1: { desc: '대체로 맑음', icon: '🌤️' },
  2: { desc: '구름 조금', icon: '⛅' },
  3: { desc: '흐림', icon: '☁️' },
  45: { desc: '안개', icon: '🌫️' },
  48: { desc: '서리 안개', icon: '🌫️' },
  51: { desc: '이슬비', icon: '🌦️' },
  53: { desc: '이슬비', icon: '🌦️' },
  55: { desc: '이슬비', icon: '🌦️' },
  61: { desc: '비', icon: '🌧️' },
  63: { desc: '비', icon: '🌧️' },
  65: { desc: '폭우', icon: '⛈️' },
  71: { desc: '눈', icon: '🌨️' },
  73: { desc: '눈', icon: '🌨️' },
  75: { desc: '폭설', icon: '❄️' },
  77: { desc: '싸락눈', icon: '🌨️' },
  80: { desc: '소나기', icon: '🌦️' },
  81: { desc: '소나기', icon: '🌧️' },
  82: { desc: '폭우', icon: '⛈️' },
  85: { desc: '눈소나기', icon: '🌨️' },
  86: { desc: '폭설', icon: '❄️' },
  95: { desc: '뇌우', icon: '⛈️' },
  96: { desc: '우박 뇌우', icon: '⛈️' },
  99: { desc: '우박 뇌우', icon: '⛈️' },
};

router.get('/', async (req, res) => {
  try {
    // Check cache
    const cached = getCache('weather:seoul');
    if (cached) {
      res.set('Cache-Control', 'public, max-age=600');
      return res.json(cached);
    }

    const url = 'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia/Seoul&forecast_days=4';
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await r.json();

    const currentCode = data.current?.weather_code ?? 0;
    const currentWeather = WEATHER_CODES[currentCode] || { desc: '알 수 없음', icon: '❓' };

    const result = {
      city: '서울',
      current: {
        temp: data.current?.temperature_2m,
        feelsLike: data.current?.apparent_temperature,
        humidity: data.current?.relative_humidity_2m,
        windSpeed: data.current?.wind_speed_10m,
        code: currentCode,
        desc: currentWeather.desc,
        icon: currentWeather.icon,
      },
      daily: (data.daily?.time || []).map((date, i) => {
        const code = data.daily.weather_code[i];
        const w = WEATHER_CODES[code] || { desc: '알 수 없음', icon: '❓' };
        return {
          date,
          dayOfWeek: new Date(date + 'T00:00:00+09:00').toLocaleDateString('ko-KR', { weekday: 'short' }),
          high: data.daily.temperature_2m_max[i],
          low: data.daily.temperature_2m_min[i],
          precipProb: data.daily.precipitation_probability_max?.[i] ?? null,
          code,
          desc: w.desc,
          icon: w.icon,
        };
      }),
      updatedAt: new Date().toISOString(),
    };

    setCache('weather:seoul', result, CACHE_TTL);
    res.set('Cache-Control', 'public, max-age=600');
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
