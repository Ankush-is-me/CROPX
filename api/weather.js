// api/weather.js
// Fetches REAL current + forecast weather data from Open-Meteo
// (https://open-meteo.com — free, no API key required). CROPX never
// invents weather values; Gemini is only ever given these numbers to
// interpret, never to generate them.

const { rateLimit, clientIdentifier } = require('./_lib/rateLimit');

const WEATHER_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail'
};

async function geocode(location) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Geocoding lookup failed.');
  const data = await r.json();
  if (!data.results || !data.results.length) return null;
  const first = data.results[0];
  return {
    lat: first.latitude,
    lon: first.longitude,
    label: [first.name, first.admin1, first.country].filter(Boolean).join(', ')
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const limit = rateLimit(`weather:${clientIdentifier(req)}`, { windowMs: 60_000, max: 30 });
  if (!limit.allowed) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }

  try {
    let { lat, lon, location } = req.query;
    let label = location || null;

    if ((!lat || !lon) && location) {
      const geo = await geocode(location);
      if (!geo) {
        return res.status(404).json({ error: `CROPX could not find a location matching "${location}".` });
      }
      lat = geo.lat;
      lon = geo.lon;
      label = geo.label;
    }

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Provide a location name, or lat & lon coordinates.' });
    }

    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,precipitation` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&forecast_days=7`;

    const r = await fetch(forecastUrl);
    if (!r.ok) {
      return res.status(502).json({ error: 'CROPX is temporarily unable to reach the weather service. Please try again.' });
    }
    const data = await r.json();

    const current = {
      temperatureC: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      windKph: data.current.wind_speed_10m,
      precipitationMm: data.current.precipitation,
      condition: WEATHER_CODES[data.current.weather_code] || 'Unknown',
      code: data.current.weather_code
    };

    const forecast = data.daily.time.map((date, i) => ({
      date,
      maxC: data.daily.temperature_2m_max[i],
      minC: data.daily.temperature_2m_min[i],
      rainProbability: data.daily.precipitation_probability_max[i],
      condition: WEATHER_CODES[data.daily.weather_code[i]] || 'Unknown',
      code: data.daily.weather_code[i]
    }));

    return res.status(200).json({
      location: label || `${lat}, ${lon}`,
      lat: Number(lat),
      lon: Number(lon),
      source: 'Open-Meteo',
      current,
      forecast
    });
  } catch (err) {
    console.error('weather error', err);
    return res.status(500).json({ error: 'CROPX is temporarily unable to fetch weather data. Please try again.' });
  }
};
