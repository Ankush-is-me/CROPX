/* js/farm.js
   Farm & crop data model, allocation math, the proportional top-down farm
   visualization, dashboard view and the Digital Soil Analysis Prototype.

   Storage note (prototype-level): farm & crop records are persisted in the
   browser via localStorage, scoped to the signed-in user's id. This keeps
   the architecture simple for a school prototype. A production build would
   move this into the same store as user accounts (Vercel KV / a database).
*/
window.CROPX = window.CROPX || {};

CROPX.farmModule = (function () {

  const PLOT_COLORS = ['#2F8F5B', '#5C8F3D', '#3F7A63', '#7A9A45', '#2A6E52', '#8C7A3B', '#4A8F76', '#6B8E3F'];

  function colorFor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return PLOT_COLORS[hash % PLOT_COLORS.length];
  }

  function storeKey(userId) { return `cropx_farms_${userId}`; }

  function getFarms() {
    const user = CROPX.auth.currentUser();
    if (!user) return [];
    try {
      return JSON.parse(localStorage.getItem(storeKey(user.id)) || '[]');
    } catch (e) { return []; }
  }

  function saveFarms(farms) {
    const user = CROPX.auth.currentUser();
    if (!user) return;
    localStorage.setItem(storeKey(user.id), JSON.stringify(farms));
  }

  function getActiveFarm() {
    const farms = getFarms();
    const activeId = localStorage.getItem('cropx_active_farm');
    return farms.find((f) => f.id === activeId) || farms[0] || null;
  }

  function setActiveFarm(id) { localStorage.setItem('cropx_active_farm', id); }

  function allocatedArea(farm) {
    return farm.crops.reduce((sum, c) => sum + Number(c.area || 0), 0);
  }

  function remainingArea(farm) {
    return Math.max(0, Number(farm.totalArea) - allocatedArea(farm));
  }

  // Deterministic, clearly-labeled prototype "AI-assisted" risk indicators —
  // seeded from the crop name so the demo stays stable across renders,
  // not scientifically validated measurements (see spec section 17).
  function seededRisk(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 17 + seed.charCodeAt(i)) >>> 0;
    const levels = [
      { label: 'Good', tone: 'good' }, { label: 'Moderate', tone: 'moderate' }, { label: 'Low', tone: 'good' }
    ];
    return {
      health: ['Good', 'Fair', 'Good'][hash % 3],
      healthTone: ['good', 'moderate', 'good'][hash % 3],
      pest: ['Low', 'Moderate', 'Low', 'Moderate'][hash % 4],
      pestTone: ['good', 'moderate', 'good', 'moderate'][hash % 4],
      disease: ['Low', 'Low', 'Moderate'][hash % 3],
      diseaseTone: ['good', 'good', 'moderate'][hash % 3]
    };
  }

  function pillClass(tone) {
    return tone === 'good' ? 'pill-good' : tone === 'moderate' ? 'pill-moderate' : 'pill-risk';
  }

  function createFarm({ name, location, totalArea, unit }) {
    const farms = getFarms();
    const farm = {
      id: `farm_${Date.now().toString(36)}`,
      name, location, totalArea: Number(totalArea), unit: unit || 'acres',
      crops: [], createdAt: new Date().toISOString()
    };
    farms.push(farm);
    saveFarms(farms);
    setActiveFarm(farm.id);
    return farm;
  }

  function addCropsToFarm(farmId, crops) {
    const farms = getFarms();
    const farm = farms.find((f) => f.id === farmId);
    if (!farm) return;
    crops.forEach((c) => {
      const risk = seededRisk(c.name + farmId);
      farm.crops.push({
        id: `crop_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: c.name, area: Number(c.area), plantingDate: c.plantingDate || '', notes: c.notes || '',
        ...risk, lastScan: null
      });
    });
    saveFarms(farms);
  }

  function getCrop(farmId, cropId) {
    const farm = getFarms().find((f) => f.id === farmId);
    if (!farm) return null;
    return farm.crops.find((c) => c.id === cropId) || null;
  }

  function recordScan(farmId, cropId) {
    const farms = getFarms();
    const farm = farms.find((f) => f.id === farmId);
    if (!farm) return;
    const crop = farm.crops.find((c) => c.id === cropId);
    if (crop) crop.lastScan = new Date().toISOString();
    saveFarms(farms);
  }

  /* ---------------- Views ---------------- */

  function dashboardView() {
    const user = CROPX.auth.currentUser();
    const farms = getFarms();
    const farm = getActiveFarm();
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    const activity = JSON.parse(localStorage.getItem('cropx_activity_' + (user ? user.id : '')) || '[]').slice(0, 5);

    return `
    <div class="container section-tight view-enter">
      <div class="dash-header">
        <div>
          <h1>${greeting}, ${escapeHtml(user.name.split(' ')[0])} 👋</h1>
          <p class="muted">How can CROPX help your farm today?</p>
        </div>
        ${farm ? `<span class="pill pill-info">🌾 ${escapeHtml(farm.name)}</span>` : ''}
      </div>

      <div class="feature-grid">
        <a class="feature-tile" href="#/analyzer">
          <span class="f-icon">📷</span><h3>Crop Analyzer</h3><p>Upload a photo for AI-assisted crop health analysis.</p>
        </a>
        <a class="feature-tile" href="#/assistant">
          <span class="f-icon">🤖</span><h3>CROPX AI</h3><p>Ask about pests, disease, soil, irrigation and weather.</p>
        </a>
        <a class="feature-tile" href="#/weather">
          <span class="f-icon">🌦️</span><h3>Weather</h3><p>Real, location-based conditions and a 7-day outlook.</p>
        </a>
        <a class="feature-tile" href="#/soil">
          <span class="f-icon">🧪</span><h3>Soil Analysis</h3><p>Log NPK &amp; pH readings for a quick interpretation.</p>
        </a>
      </div>

      <div class="dash-grid">
        <div>
          <div class="card" style="margin-bottom:1.5rem;">
            <div class="panel-title">
              <h2>My Farm</h2>
              <a href="#/farm" class="btn btn-secondary btn-sm">${farm ? 'Manage Farm' : '+ Add Farm'}</a>
            </div>
            ${farm ? farmSummaryBlock(farm) : `
              <div class="empty-state">
                <div class="e-icon">🌱</div>
                <p>You haven't added a farm yet.</p>
                <a href="#/farm" class="btn btn-primary btn-sm">Add your first farm</a>
              </div>`}
          </div>

          <div class="card">
            <div class="panel-title"><h2>Farm Health Overview</h2><span class="pill pill-info">AI-assisted</span></div>
            ${farm && farm.crops.length ? healthOverviewBlock(farm) : `<div class="empty-state"><p>Add crops to see a health overview.</p></div>`}
          </div>
        </div>

        <div class="card">
          <div class="panel-title"><h2>Recent Activity</h2></div>
          ${activity.length ? activity.map(activityRow).join('') : `
            <div class="empty-state"><div class="e-icon">🕓</div><p>No activity yet. Try the Crop Analyzer or ask CROPX AI a question.</p></div>`}
        </div>
      </div>
    </div>`;
  }

  function farmSummaryBlock(farm) {
    const allocated = allocatedArea(farm);
    const remaining = remainingArea(farm);
    const pct = Math.min(100, Math.round((allocated / farm.totalArea) * 100));
    return `
      <p style="margin-bottom:.3rem;"><strong>${escapeHtml(farm.name)}</strong> · ${escapeHtml(farm.location)}</p>
      <div class="farm-summary">
        <div class="stat-chip"><div class="stat-value">${farm.totalArea}</div><div class="stat-label">Total ${farm.unit}</div></div>
        <div class="stat-chip"><div class="stat-value">${allocated}</div><div class="stat-label">Allocated</div></div>
        <div class="stat-chip"><div class="stat-value">${remaining}</div><div class="stat-label">Remaining</div></div>
      </div>
      <div class="area-bar">${farm.crops.map((c) => `<span style="width:${(c.area / farm.totalArea) * 100}%; background:${colorFor(c.name)}"></span>`).join('')}<span style="width:${100 - pct}%; background:var(--sage)"></span></div>
    `;
  }

  function healthOverviewBlock(farm) {
    const anyModerate = farm.crops.some((c) => c.pestTone === 'moderate');
    const anyDisease = farm.crops.some((c) => c.diseaseTone === 'moderate');
    const rows = [
      { label: 'Crop health', tone: farm.crops.every((c) => c.healthTone === 'good') ? 'good' : 'moderate', text: farm.crops.every((c) => c.healthTone === 'good') ? 'Good' : 'Fair' },
      { label: 'Pest risk', tone: anyModerate ? 'moderate' : 'good', text: anyModerate ? 'Moderate' : 'Low' },
      { label: 'Disease risk', tone: anyDisease ? 'moderate' : 'good', text: anyDisease ? 'Moderate' : 'Low' },
      { label: 'Weather risk', tone: 'info', text: 'See Weather tab' }
    ];
    return rows.map((r) => `
      <div class="health-row">
        <span>${r.label}</span>
        <span class="pill ${r.tone === 'info' ? 'pill-info' : pillClass(r.tone)}">${r.text}</span>
      </div>`).join('');
  }

  function activityRow(a) {
    return `<div class="activity-item">
      <span class="activity-dot">${a.icon || '📝'}</span>
      <div><div>${escapeHtml(a.text)}</div><div class="activity-meta">${a.time || ''}</div></div>
    </div>`;
  }

  function farmView() {
    const farms = getFarms();
    const farm = getActiveFarm();
    return `
    <div class="container section-tight view-enter">
      <div class="dash-header">
        <div><h1>My Farm</h1><p class="muted">Add your farm, allocate crop areas, and see a proportional field map.</p></div>
        <div style="display:flex; gap:.6rem;">
          ${farms.length > 1 ? `<select id="farmSwitcher" class="field-select" style="border-radius:999px; border:1.5px solid var(--line); padding:.6rem 1rem;">
            ${farms.map((f) => `<option value="${f.id}" ${farm && f.id === farm.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}
          </select>` : ''}
          <button class="btn btn-primary" id="openAddFarmModal">+ Add Farm</button>
        </div>
      </div>

      ${!farm ? `
        <div class="card empty-state">
          <div class="e-icon">🌾</div>
          <h3>No farm yet</h3>
          <p>Add your farm's name, location and total area to get started — then allocate crops.</p>
          <button class="btn btn-primary" id="openAddFarmModal2">+ Add Farm</button>
        </div>` : `
        <div class="card" style="margin-bottom:1.5rem;">
          ${farmSummaryBlock(farm)}
          <div style="display:flex; justify-content:flex-end; margin-top:.8rem;">
            <button class="btn btn-secondary btn-sm" id="openAddCropModal">+ Add Crop</button>
          </div>
        </div>

        <div class="card" style="margin-bottom:1.5rem;">
          <div class="panel-title"><h2>Farm Map <span class="pill pill-info">Prototype visualization</span></h2></div>
          ${farm.crops.length ? renderFieldMap(farm) : `<div class="empty-state"><div class="e-icon">🗺️</div><p>Add crops to generate your farm's proportional field map.</p></div>`}
          <p class="map-caption">Field sizes are proportional to allocated area — a conceptual layout, not a satellite map.</p>
        </div>

        <div class="card">
          <div class="panel-title"><h2>Crops</h2></div>
          ${farm.crops.length ? `<div class="crop-list">${farm.crops.map((c) => cropRow(farm, c)).join('')}</div>` : `<div class="empty-state"><p>No crops added yet.</p></div>`}
        </div>
      `}
    </div>`;
  }

  function renderFieldMap(farm) {
    return `<div class="field-map">
      ${farm.crops.map((c) => {
        const pct = Math.round((c.area / farm.totalArea) * 100);
        return `<button class="field-plot" style="background:${colorFor(c.name)}" data-crop-id="${c.id}" data-farm-id="${farm.id}" aria-label="View ${escapeHtml(c.name)} field details">
          <span class="fp-name">${cropIcon(c.name)} ${escapeHtml(c.name)}</span>
          <span>
            <span class="fp-meta">${c.area} ${farm.unit} · ${pct}%</span><br/>
            <span class="pill ${pillClass(c.healthTone)} fp-health">${c.health}</span>
          </span>
        </button>`;
      }).join('')}
    </div>`;
  }

  function cropRow(farm, c) {
    return `<div class="crop-row">
      <div class="crop-row-left">
        <span class="crop-swatch" style="background:${colorFor(c.name)}"></span>
        <div>
          <div><strong>${escapeHtml(c.name)}</strong></div>
          <div class="activity-meta">${c.area} ${farm.unit}${c.plantingDate ? ' · Planted ' + c.plantingDate : ''}</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:.6rem;">
        <span class="pill ${pillClass(c.healthTone)}">${c.health}</span>
        <a href="#/crop/${farm.id}/${c.id}" class="btn btn-ghost btn-sm">View →</a>
      </div>
    </div>`;
  }

  function cropIcon(name) {
    const n = name.toLowerCase();
    if (n.includes('cotton')) return '☁️';
    if (n.includes('wheat')) return '🌾';
    if (n.includes('banana')) return '🍌';
    if (n.includes('rice')) return '🌾';
    if (n.includes('vegetable')) return '🥦';
    return '🌱';
  }

  function cropDetailView(farmId, cropId) {
    const farms = getFarms();
    const farm = farms.find((f) => f.id === farmId);
    const crop = farm ? farm.crops.find((c) => c.id === cropId) : null;
    if (!farm || !crop) {
      return `<div class="container section-tight view-enter"><div class="card empty-state"><div class="e-icon">🔍</div><h3>Field not found</h3><a class="btn btn-primary" href="#/farm">Back to My Farm</a></div></div>`;
    }
    return `
    <div class="container section-tight view-enter">
      <a href="#/farm" class="btn btn-ghost btn-sm" style="margin-bottom:1rem;">← Back to My Farm</a>
      <div class="card">
        <div class="panel-title">
          <h2>${cropIcon(crop.name)} ${escapeHtml(crop.name).toUpperCase()}</h2>
          <span class="pill pill-info">${escapeHtml(farm.name)}</span>
        </div>
        <div class="crop-detail-grid">
          <div class="kv-box"><div class="k">Area</div><div class="v">${crop.area} ${farm.unit}</div></div>
          <div class="kv-box"><div class="k">Health</div><div class="v"><span class="pill ${pillClass(crop.healthTone)}">${crop.health}</span></div></div>
          <div class="kv-box"><div class="k">Pest Risk</div><div class="v"><span class="pill ${pillClass(crop.pestTone)}">${crop.pest}</span></div></div>
          <div class="kv-box"><div class="k">Disease Risk</div><div class="v"><span class="pill ${pillClass(crop.diseaseTone)}">${crop.disease}</span></div></div>
          <div class="kv-box"><div class="k">Last Scan</div><div class="v" style="font-size:.95rem;">${crop.lastScan ? new Date(crop.lastScan).toLocaleDateString() : 'No scans yet'}</div></div>
          <div class="kv-box"><div class="k">Planted</div><div class="v" style="font-size:.95rem;">${crop.plantingDate || 'Not recorded'}</div></div>
        </div>
        ${crop.notes ? `<p class="muted">${escapeHtml(crop.notes)}</p>` : ''}
        <p class="small-text muted">Health and risk indicators are AI-assisted, contextual estimates for this prototype — not scientifically validated measurements.</p>
        <div style="display:flex; gap:.8rem; flex-wrap:wrap; margin-top:1rem;">
          <button class="btn btn-primary" id="analyzeThisCrop" data-farm-id="${farm.id}" data-crop-id="${crop.id}">Analyze This Crop</button>
          <button class="btn btn-secondary" id="askAboutCrop" data-crop-name="${escapeAttr(crop.name)}">Ask CROPX AI</button>
        </div>
      </div>
    </div>`;
  }

  /* ---------------- Digital Soil Analysis Prototype ---------------- */

  function soilView() {
    return `
    <div class="container section-tight view-enter">
      <div class="dash-header">
        <div><h1>Soil Analysis</h1><p class="muted">Digital Soil Analysis Prototype — manual entry &amp; interpretation.</p></div>
        <span class="pill pill-info">Prototype</span>
      </div>
      <div class="card" style="max-width:640px;">
        <form id="soilForm">
          <div class="grid grid-2">
            <div class="field"><label for="soilN">Nitrogen (N) — kg/ha</label><input type="number" id="soilN" min="0" max="300" value="60" required/></div>
            <div class="field"><label for="soilP">Phosphorus (P) — kg/ha</label><input type="number" id="soilP" min="0" max="200" value="30" required/></div>
            <div class="field"><label for="soilK">Potassium (K) — kg/ha</label><input type="number" id="soilK" min="0" max="300" value="40" required/></div>
            <div class="field"><label for="soilPH">Soil pH</label><input type="number" step="0.1" id="soilPH" min="0" max="14" value="6.5" required/></div>
          </div>
          <button class="btn btn-primary btn-block" type="submit">Interpret Soil Data</button>
        </form>
        <div id="soilResult" style="margin-top:1.5rem;"></div>
        <p class="small-text muted" style="margin-top:1rem;">This prototype does not connect to a physical soil sensor. Future versions could connect CROPX to physical soil sensors for automatic readings.</p>
      </div>
    </div>`;
  }

  function interpretSoil(n, p, k, ph) {
    const notes = [];
    notes.push(n < 40 ? 'Nitrogen appears low — leafy growth may be limited.' : n > 120 ? 'Nitrogen appears high — monitor for excess vegetative growth.' : 'Nitrogen is in a commonly adequate range.');
    notes.push(p < 15 ? 'Phosphorus appears low — root and flowering development may be affected.' : 'Phosphorus is in a commonly adequate range.');
    notes.push(k < 20 ? 'Potassium appears low — this can affect disease resistance and fruit quality.' : 'Potassium is in a commonly adequate range.');
    if (ph < 5.5) notes.push('Soil is on the acidic side — some crops may show nutrient uptake issues.');
    else if (ph > 7.8) notes.push('Soil is on the alkaline side — this can limit micronutrient availability.');
    else notes.push('Soil pH is in a commonly workable range for most crops.');
    return notes;
  }

  function bar(label, value, max) {
    const pct = Math.min(100, Math.round((value / max) * 100));
    return `<div class="soil-bar-row"><div class="lbl"><span>${label}</span><span>${value}</span></div><div class="soil-bar"><span style="width:${pct}%"></span></div></div>`;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
  function escapeAttr(str) { return escapeHtml(str).replace(/"/g, '&quot;'); }

  function logActivity(icon, text) {
    const user = CROPX.auth.currentUser();
    if (!user) return;
    const key = 'cropx_activity_' + user.id;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.unshift({ icon, text, time: new Date().toLocaleString() });
    localStorage.setItem(key, JSON.stringify(list.slice(0, 15)));
  }

  return {
    getFarms, saveFarms, getActiveFarm, setActiveFarm, createFarm, addCropsToFarm,
    getCrop, recordScan, allocatedArea, remainingArea, colorFor, pillClass, cropIcon,
    dashboardView, farmView, cropDetailView, soilView, interpretSoil, bar,
    escapeHtml, escapeAttr, logActivity
  };
})();
