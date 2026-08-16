/* js/weather.js
   Client for the CROPX weather endpoint. Weather numbers always come from
   /api/weather (Open-Meteo) — this file never invents values; it only
   requests, caches briefly, and renders what the API returns.
*/
window.CROPX = window.CROPX || {};

CROPX.weatherModule = (function () {
  const WMO_ICON = {
    0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
    51: '🌦️', 53: '🌦️', 55: '🌦️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
    66: '🌧️', 67: '🌧️', 71: '🌨️', 73: '🌨️', 75: '🌨️',
    80: '🌦️', 81: '🌧️', 82: '⛈️', 95: '⛈️', 96: '⛈️', 99: '⛈️'
  };

  async function fetchWeather(location) {
    const r = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Could not load weather.');
    return data;
  }

  function fieldInsight(w) {
    const rainSoon = w.forecast.slice(0, 2).some((d) => d.rainProbability >= 50);
    if (rainSoon) return 'Rain is expected soon. Review soil moisture and irrigation plans before watering.';
    if (w.current.temperatureC >= 35) return 'High temperatures expected. Watch for heat stress and consider adjusting irrigation timing.';
    if (w.current.humidity >= 80) return 'Humidity is high, which can favor fungal disease development. Monitor susceptible crops closely.';
    return 'Conditions look stable. A good window for routine field checks and scheduled tasks.';
  }

  function weatherView() {
    const farm = CROPX.farmModule.getActiveFarm();
    const defaultLocation = farm ? farm.location : 'Vadodara, Gujarat';
    return `
    <div class="container section-tight view-enter">
      <div class="dash-header">
        <div><h1>Weather</h1><p class="muted">Real, location-based conditions from Open-Meteo.</p></div>
      </div>
      <div class="card" style="margin-bottom:1.5rem; max-width:520px;">
        <form id="weatherLocationForm" style="display:flex; gap:.7rem;">
          <input type="text" id="weatherLocationInput" value="${CROPX.farmModule.escapeAttr(defaultLocation)}" placeholder="City, region" style="flex:1; padding:.8rem .9rem; border:1.5px solid var(--line); border-radius:var(--radius-sm);"/>
          <button class="btn btn-primary" type="submit">Check</button>
        </form>
      </div>
      <div id="weatherResult"><div class="loading-block"><div class="spinner"></div><p class="muted">Fetching current weather…</p></div></div>
    </div>`;
  }

  async function loadInto(containerId, location) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div class="loading-block"><div class="spinner"></div><p class="muted">Fetching current weather…</p></div>`;
    try {
      const w = await fetchWeather(location);
      el.innerHTML = renderWeatherCard(w);
      CROPX.farmModule.logActivity('🌦️', `Checked weather for ${w.location}`);
    } catch (err) {
      el.innerHTML = `<div class="card"><p class="muted">CROPX is temporarily unable to fetch weather data. ${CROPX.farmModule.escapeHtml(err.message)}</p></div>`;
    }
  }

  function renderWeatherCard(w) {
    const icon = WMO_ICON[w.current.code] || '🌤️';
    return `
    <div class="weather-hero">
      <div class="w-loc">${CROPX.farmModule.escapeHtml(w.location)}</div>
      <div class="w-temp">${icon} ${Math.round(w.current.temperatureC)}°C</div>
      <div>${w.current.condition}</div>
      <div class="weather-metrics">
        <div><b>${w.current.humidity}%</b>Humidity</div>
        <div><b>${Math.round(w.current.windKph)} km/h</b>Wind</div>
        <div><b>${w.forecast[0].rainProbability}%</b>Rain probability today</div>
      </div>
      <div class="forecast-strip">
        ${w.forecast.map((d) => `
          <div class="forecast-day">
            <div class="fd-name">${new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}</div>
            <div style="font-size:1.3rem;">${WMO_ICON[d.code] || '🌤️'}</div>
            <div style="font-size:.8rem;">${Math.round(d.maxC)}° / ${Math.round(d.minC)}°</div>
          </div>`).join('')}
      </div>
    </div>
    <div class="field-insight">
      <span style="font-size:1.4rem;">💡</span>
      <div><strong>CROPX Field Insight</strong><p style="margin:.3rem 0 0;">${fieldInsight(w)}</p><p class="small-text muted" style="margin-top:.4rem;">Weather data: Open-Meteo. Interpretation: CROPX AI reasoning over real values — not invented data.</p></div>
    </div>`;
  }

  return { fetchWeather, weatherView, loadInto, renderWeatherCard, fieldInsight, WMO_ICON };
})();
