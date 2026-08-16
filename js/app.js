/* js/app.js
   App shell: hash router, toast/modal system, header state, and the
   landing / research / concept marketing views. Ties together auth.js,
   farm.js, analyzer.js, assistant.js and weather.js.
*/
window.CROPX = window.CROPX || {};

CROPX.app = (function () {
  const appEl = document.getElementById('main');

  /* ---------------- Toasts ---------------- */
  function toast(message, type) {
    const root = document.getElementById('toastRoot');
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  /* ---------------- Modal ---------------- */
  function openModal(innerHtml) {
    const root = document.getElementById('modalRoot');
    root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal-box" role="dialog" aria-modal="true">${innerHtml}</div></div>`;
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'modalOverlay') closeModal();
    });
    document.addEventListener('keydown', escCloseOnce);
  }
  function escCloseOnce(e) { if (e.key === 'Escape') closeModal(); }
  function closeModal() {
    document.getElementById('modalRoot').innerHTML = '';
    document.removeEventListener('keydown', escCloseOnce);
  }

  /* ---------------- Router ---------------- */
  const routes = {
    '/': landingView,
    '/login': () => CROPX.auth.loginView(),
    '/register': () => CROPX.auth.registerView(),
    '/dashboard': protect(() => CROPX.farmModule.dashboardView()),
    '/farm': protect(() => CROPX.farmModule.farmView()),
    '/analyzer': protect(() => CROPX.analyzerModule.analyzerView()),
    '/assistant': protect(() => CROPX.assistantModule.assistantView()),
    '/weather': protect(() => CROPX.weatherModule.weatherView()),
    '/soil': protect(() => CROPX.farmModule.soilView()),
    '/research': researchView,
    '/concept': conceptView
  };

  function protect(viewFn) {
    return (...args) => {
      if (!CROPX.auth.isLoggedIn()) {
        toast('Please log in to access this page.', 'error');
        setTimeout(() => navigate('/login'), 0);
        return `<div class="container section-tight"><div class="card loading-block"><div class="spinner"></div><p class="muted">Redirecting to login…</p></div></div>`;
      }
      return viewFn(...args);
    };
  }

  function parseHash() {
    const hash = location.hash.slice(1) || '/';
    const parts = hash.split('/').filter(Boolean);
    return { hash, parts };
  }

  function navigate(path) { location.hash = '#' + path; }

  function render() {
    const { hash, parts } = parseHash();
    window.scrollTo(0, 0);
    closeModal();

    let html = '';
    let bindFn = null;

    if (parts[0] === 'crop' && parts[1] && parts[2]) {
      html = protect(() => CROPX.farmModule.cropDetailView(parts[1], parts[2]))();
      bindFn = bindCropDetail;
    } else if (routes[hash]) {
      html = routes[hash]();
      bindFn = viewBinders[hash];
    } else {
      html = notFoundView();
    }

    appEl.innerHTML = html;
    updateNavActive(hash);
    if (bindFn) bindFn();
  }

  const viewBinders = {
    '/login': () => CROPX.auth.bindLoginForm(),
    '/register': () => CROPX.auth.bindRegisterForm(),
    '/dashboard': bindDashboard,
    '/farm': bindFarm,
    '/analyzer': bindAnalyzer,
    '/assistant': () => CROPX.assistantModule.bindChat(),
    '/weather': bindWeather,
    '/soil': bindSoil
  };

  function updateNavActive(hash) {
    document.querySelectorAll('.main-nav a').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('data-route') === hash);
    });
    document.getElementById('mainNav').classList.remove('open');
  }

  /* ---------------- View binders ---------------- */

  function bindDashboard() {
    // feature tiles are plain links; nothing extra needed
  }

  function bindWeather() {
    const form = document.getElementById('weatherLocationForm');
    const farm = CROPX.farmModule.getActiveFarm();
    CROPX.weatherModule.loadInto('weatherResult', farm ? farm.location : 'Vadodara, Gujarat');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const loc = document.getElementById('weatherLocationInput').value.trim();
        if (loc) CROPX.weatherModule.loadInto('weatherResult', loc);
      });
    }
  }

  function bindAnalyzer() {
    CROPX.analyzerModule.bindUploadEvents();
    CROPX.analyzerModule.bindModeButtons();
    CROPX.analyzerModule.bindAnalyzeButton();
  }

  function bindSoil() {
    const form = document.getElementById('soilForm');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = Number(document.getElementById('soilN').value);
      const p = Number(document.getElementById('soilP').value);
      const k = Number(document.getElementById('soilK').value);
      const ph = Number(document.getElementById('soilPH').value);
      const notes = CROPX.farmModule.interpretSoil(n, p, k, ph);
      document.getElementById('soilResult').innerHTML = `
        <div class="soil-grid" style="margin-bottom:1rem;">
          ${CROPX.farmModule.bar('Nitrogen', n, 300)}
        </div>
        ${CROPX.farmModule.bar('Phosphorus', p, 200)}
        ${CROPX.farmModule.bar('Potassium', k, 300)}
        ${CROPX.farmModule.bar('pH', ph, 14)}
        <h3 style="font-size:.95rem; margin-top:1rem;">Interpretation</h3>
        <ul style="padding-left:1.2rem;">${notes.map((n2) => `<li>${n2}</li>`).join('')}</ul>
        <p class="small-text muted">Digital Soil Analysis Prototype — general interpretive guidance, not a certified lab analysis.</p>
      `;
      CROPX.farmModule.logActivity('🧪', 'Ran a soil analysis interpretation');
      toast('Soil data interpreted.', 'success');
    });
  }

  function bindFarm() {
    const openBtn = document.getElementById('openAddFarmModal') || document.getElementById('openAddFarmModal2');
    if (openBtn) openBtn.addEventListener('click', showAddFarmModal);

    const addCropBtn = document.getElementById('openAddCropModal');
    if (addCropBtn) addCropBtn.addEventListener('click', showAddCropModal);

    const switcher = document.getElementById('farmSwitcher');
    if (switcher) switcher.addEventListener('change', () => { CROPX.farmModule.setActiveFarm(switcher.value); render(); });

    document.querySelectorAll('.field-plot').forEach((plot) => {
      plot.addEventListener('click', () => navigate(`/crop/${plot.dataset.farmId}/${plot.dataset.cropId}`));
    });
  }

  function bindCropDetail() {
    const analyzeBtn = document.getElementById('analyzeThisCrop');
    if (analyzeBtn) analyzeBtn.addEventListener('click', () => {
      const crop = CROPX.farmModule.getCrop(analyzeBtn.dataset.farmId, analyzeBtn.dataset.cropId);
      navigate('/analyzer');
      setTimeout(() => { appEl.innerHTML = CROPX.analyzerModule.analyzerView(crop ? crop.name : null); bindAnalyzer(); }, 0);
    });
    const askBtn = document.getElementById('askAboutCrop');
    if (askBtn) askBtn.addEventListener('click', () => {
      const q = `What should I look out for with my ${askBtn.dataset.cropName}?`;
      navigate('/assistant');
      setTimeout(() => { appEl.innerHTML = CROPX.assistantModule.assistantView(q); CROPX.assistantModule.bindChat(); }, 0);
    });
  }

  function showAddFarmModal() {
    openModal(`
      <div class="modal-head"><h2 style="margin:0;">Add Farm</h2><button class="modal-close" id="modalCloseBtn">✕</button></div>
      <form id="addFarmForm">
        <div class="field"><label for="farmName">Farm name</label><input type="text" id="farmName" required placeholder="e.g. Shree Farm"/></div>
        <div class="field"><label for="farmLocation">Location</label><input type="text" id="farmLocation" required placeholder="e.g. Vadodara, Gujarat"/></div>
        <div class="grid grid-2">
          <div class="field"><label for="farmArea">Total farm area</label><input type="number" id="farmArea" min="0.1" step="0.1" required placeholder="e.g. 10"/></div>
          <div class="field"><label for="farmUnit">Unit</label>
            <select id="farmUnit"><option value="acres">Acres</option><option value="hectares">Hectares</option></select>
          </div>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Add Farm</button>
      </form>
    `);
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    document.getElementById('addFarmForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const farm = CROPX.farmModule.createFarm({
        name: document.getElementById('farmName').value.trim(),
        location: document.getElementById('farmLocation').value.trim(),
        totalArea: document.getElementById('farmArea').value,
        unit: document.getElementById('farmUnit').value
      });
      CROPX.farmModule.logActivity('🌾', `Added farm "${farm.name}"`);
      closeModal();
      toast('Farm added!', 'success');
      render();
      setTimeout(showAddCropModal, 250);
    });
  }

  function showAddCropModal() {
    const farm = CROPX.farmModule.getActiveFarm();
    if (!farm) { toast('Add a farm first.', 'error'); return; }
    const remaining = CROPX.farmModule.remainingArea(farm);
    openModal(`
      <div class="modal-head"><h2 style="margin:0;">Add Crops</h2><button class="modal-close" id="modalCloseBtn">✕</button></div>
      <p class="muted small-text">Remaining allocatable area: <strong id="remainingLabel">${remaining}</strong> ${farm.unit}</p>
      <form id="addCropForm">
        <div id="cropRows"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="addAnotherCropRow">+ Add another crop</button>
        <div class="form-error-banner" id="cropError" style="margin-top:1rem;"></div>
        <button class="btn btn-primary btn-block" type="submit" style="margin-top:1rem;">Save Crops</button>
      </form>
    `);
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    const rowsEl = document.getElementById('cropRows');

    function addRow() {
      const row = document.createElement('div');
      row.className = 'crop-row-form';
      row.innerHTML = `
        <div class="field" style="margin:0;"><label>Crop name</label><input type="text" class="cropNameInput" required placeholder="e.g. Cotton"/></div>
        <div class="field" style="margin:0;"><label>Area (${farm.unit})</label><input type="number" class="cropAreaInput" min="0.1" step="0.1" required/></div>
        <div class="field" style="margin:0;"><label>Planted</label><input type="date" class="cropDateInput"/></div>
      `;
      rowsEl.appendChild(row);
    }
    addRow();
    document.getElementById('addAnotherCropRow').addEventListener('click', addRow);

    document.getElementById('addCropForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const names = [...document.querySelectorAll('.cropNameInput')].map((i) => i.value.trim());
      const areas = [...document.querySelectorAll('.cropAreaInput')].map((i) => Number(i.value));
      const dates = [...document.querySelectorAll('.cropDateInput')].map((i) => i.value);
      const errBox = document.getElementById('cropError');
      const totalNew = areas.reduce((a, b) => a + b, 0);
      const currentAllocated = CROPX.farmModule.allocatedArea(farm);

      if (names.some((n) => !n) || areas.some((a) => !a || a <= 0)) {
        errBox.textContent = 'Please fill in a crop name and a positive area for every row.';
        errBox.classList.add('show');
        return;
      }
      if (currentAllocated + totalNew > farm.totalArea + 1e-9) {
        errBox.textContent = `Allocated area (${(currentAllocated + totalNew).toFixed(2)} ${farm.unit}) would exceed the total farm area (${farm.totalArea} ${farm.unit}). Reduce the crop areas.`;
        errBox.classList.add('show');
        return;
      }
      errBox.classList.remove('show');
      const crops = names.map((name, i) => ({ name, area: areas[i], plantingDate: dates[i] }));
      CROPX.farmModule.addCropsToFarm(farm.id, crops);
      CROPX.farmModule.logActivity('🌱', `Added ${crops.length} crop${crops.length > 1 ? 's' : ''} to ${farm.name}`);
      closeModal();
      toast('Crops added!', 'success');
      render();
    });
  }

  /* ---------------- Marketing views ---------------- */

  function landingView() {
    return `
    <section class="hero">
      <div class="hero-inner">
        <div>
          <span class="eyebrow">🌱 AI Agriculture Prototype</span>
          <h1>CROPX</h1>
          <div class="tagline">"Intelligence That Grows."</div>
          <p class="lede">AI-powered crop intelligence designed to help farmers understand their fields and make better-informed decisions.</p>
          <div class="hero-ctas">
            <a href="#/analyzer" class="btn btn-primary">Analyze a Crop</a>
            <a href="#/assistant" class="btn btn-secondary">Meet CROPX AI</a>
          </div>
        </div>
        <div class="field-scan">
          <svg viewBox="0 0 480 372" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="fieldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#1E5B3C"/><stop offset="1" stop-color="#123524"/>
              </linearGradient>
            </defs>
            <rect width="480" height="372" fill="url(#fieldGrad)"/>
            ${Array.from({ length: 8 }).map((_, i) => `<line x1="${20 + i * 58}" y1="20" x2="${20 + i * 58}" y2="352" stroke="#2F8F5B" stroke-width="10" opacity="0.35"/>`).join('')}
            ${Array.from({ length: 8 }).map((_, i) => Array.from({ length: 10 }).map((__, j) => `<circle cx="${20 + i * 58}" cy="${28 + j * 33}" r="3.4" fill="#8FD8A8" opacity="0.7"/>`).join('')).join('')}
            <g class="scan-line"><rect x="0" y="60" width="480" height="46" fill="#BFF2CE" opacity="0.18"/><rect x="0" y="60" width="480" height="2" fill="#BFF2CE"/></g>
            <g font-family="Manrope, sans-serif" font-size="12" font-weight="700" fill="#EAF4EC">
              <rect x="24" y="24" width="120" height="30" rx="15" fill="rgba(255,255,255,.12)"/><text x="40" y="43">📡 Scanning field…</text>
              <rect x="316" y="300" width="140" height="30" rx="15" fill="rgba(255,255,255,.12)"/><text x="330" y="319">🧠 CROPX AI ready</text>
            </g>
          </svg>
          <div class="field-scan-caption">Conceptual crop-scan visualization</div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow">Capabilities</span>
          <h2>What CROPX explores</h2>
        </div>
        <div class="grid grid-3">
          <div class="card cap-card"><div class="cap-icon">📷</div><h3>Crop Intelligence</h3><p>AI-assisted analysis of crop images and visible crop-health symptoms.</p></div>
          <div class="card cap-card"><div class="cap-icon">🤖</div><h3>AI Farming Assistant</h3><p>Ask CROPX questions about crops, pests, diseases, soil and farming.</p></div>
          <div class="card cap-card"><div class="cap-icon">🌦️</div><h3>Field Intelligence</h3><p>Combine field information and real weather data to provide useful context.</p></div>
        </div>
      </div>
    </section>

    <section class="section section-sage">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow">How it flows</span>
          <h2>From field data to intelligent insight.</h2>
        </div>
        <div class="flow">
          ${['FARM', 'FIELD', 'CROP', 'IMAGE', 'WEATHER', 'CROPX AI', 'FARMER ADVISORY'].map((s, i, arr) => `<span class="flow-step">${s}</span>${i < arr.length - 1 ? '<span class="flow-arrow">→</span>' : ''}`).join('')}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow">Why CROPX?</span>
          <h2>Built around how farmers actually work</h2>
        </div>
        <div class="why-grid">
          <div class="why-item"><div class="num">01</div><h3>Cautious by design</h3><p class="muted small-text">Qualitative confidence, never invented certainty.</p></div>
          <div class="why-item"><div class="num">02</div><h3>Real weather data</h3><p class="muted small-text">Live conditions, not AI-generated guesses.</p></div>
          <div class="why-item"><div class="num">03</div><h3>Multilingual</h3><p class="muted small-text">English, Gujarati and Hindi support.</p></div>
          <div class="why-item"><div class="num">04</div><h3>Farm-first layout</h3><p class="muted small-text">See your fields the way you actually plan them.</p></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container" style="text-align:center;">
        <h2>Ready to explore your field?</h2>
        <p class="muted" style="max-width:480px; margin:0 auto 1.6rem;">Set up your farm, allocate crops, and get your first AI-assisted crop assessment.</p>
        <a href="#/register" class="btn btn-primary">Get Started</a>
      </div>
    </section>`;
  }

  function researchView() {
    return `
    <div class="container section view-enter">
      <div class="section-head">
        <span class="eyebrow">Our Research</span>
        <h2>A Social Science project on crop pest &amp; disease damage</h2>
      </div>

      <div class="timeline">
        <div class="timeline-item">
          <div class="timeline-num">1</div>
          <div class="card">
            <h3>Problem Identification</h3>
            <p>Our selected problem is <strong>Crop Pest &amp; Disease Damage</strong>, grounded in survey evidence from the Baseline Survey under the On-line Pest Monitoring and Advisory Services Project in Vadodara District, Gujarat. The survey recorded pest and crop-health issues and was designed specifically around online pest monitoring and advisory services.</p>
            <div class="survey-stats">
              <div class="survey-stat"><div class="n">180</div><div class="small-text muted">Farmers surveyed</div></div>
              <div class="survey-stat"><div class="n">9</div><div class="small-text muted">Villages</div></div>
              <div class="survey-stat"><div class="n">3</div><div class="small-text muted">Talukas</div></div>
              <div class="survey-stat"><div class="n">1</div><div class="small-text muted">District: Vadodara</div></div>
            </div>
          </div>
        </div>

        <div class="timeline-item">
          <div class="timeline-num">2</div>
          <div class="card">
            <h3>AI Exploration</h3>
            <p>We surveyed several agricultural AI applications before choosing our direction:</p>
            <div class="grid grid-3">
              <div class="why-item">📷<p class="small-text">Crop disease detection</p></div>
              <div class="why-item">🌦️<p class="small-text">Weather prediction</p></div>
              <div class="why-item">💧<p class="small-text">Smart irrigation</p></div>
              <div class="why-item">🧪<p class="small-text">Soil analysis</p></div>
              <div class="why-item">📊<p class="small-text">Yield prediction</p></div>
              <div class="why-item">🛰️<p class="small-text">Drone/satellite monitoring</p></div>
            </div>
          </div>
        </div>

        <div class="timeline-item">
          <div class="timeline-num">3</div>
          <div class="card">
            <h3>Why Crop Pest &amp; Disease Damage?</h3>
            <p>This problem offers strong scope for computer vision, multimodal AI, environmental data, risk assessment, farmer advisory, and multilingual AI — all directly explored in CROPX.</p>
          </div>
        </div>

        <div class="timeline-item">
          <div class="timeline-num">4</div>
          <div class="card">
            <h3>Innovation Design</h3>
            <p class="tagline" style="font-family:var(--font-display); font-style:italic; color:var(--green);">CROPX — "Intelligence That Grows."</p>
            <p><strong>Problem:</strong> Crop pest and disease damage.<br/><strong>Solution:</strong> An AI-powered crop-health and farming assistant.</p>
          </div>
        </div>
      </div>

      <div class="section-head" style="margin-top:3rem;">
        <span class="eyebrow">Sources</span>
        <h2>Primary source</h2>
      </div>
      <div class="source-box">
        M. B. Zala, R. K. Thumar &amp; T. M. Bharpoda (2017). "Baseline Survey under On-line Pest Monitoring and Advisory Services Project in Vadodara District of Gujarat." <em>Gujarat Journal of Extension Education</em>, Special Issue.
        <br/><a href="https://www.google.com/search?q=Baseline+Survey+under+On-line+Pest+Monitoring+and+Advisory+Services+Project+in+Vadodara+District+of+Gujarat" target="_blank" rel="noopener" style="color:var(--green); font-weight:700;">Search this source →</a>
      </div>
    </div>`;
  }

  function conceptView() {
    const nodes = [
      { icon: '🌾', label: 'Farm' }, { icon: '📷', label: 'Crop Camera' }, { icon: '🧪', label: 'Soil Sensor' },
      { icon: '🌦️', label: 'Weather Data' }, { icon: '🛰️', label: 'Drone (Future)' }
    ];
    return `
    <div class="container section view-enter">
      <div class="section-head">
        <span class="eyebrow">How CROPX Works</span>
        <h2>From field signals to farmer advisory</h2>
      </div>

      <div class="concept-stage">
        <div class="iso-grid">
          ${nodes.map((n) => `<div class="iso-node"><div class="iso-icon">${n.icon}</div><div class="iso-label">${n.label}</div></div>`).join('')}
        </div>
        <div style="text-align:center; color:var(--green-bright); font-size:1.6rem; margin:1.4rem 0;">↓</div>
        <div class="iso-grid">
          <div class="iso-node" style="background:rgba(63,174,110,.22); border-color:var(--green-bright);"><div class="iso-icon">🧠</div><div class="iso-label">CROPX AI</div></div>
        </div>
        <div style="text-align:center; color:var(--green-bright); font-size:1.6rem; margin:1.4rem 0;">↓</div>
        <div class="iso-grid">
          <div class="iso-node"><div class="iso-icon">🩺</div><div class="iso-label">Crop Health Assessment</div></div>
          <div class="iso-node"><div class="iso-icon">👨‍🌾</div><div class="iso-label">Farmer Advisory</div></div>
        </div>
      </div>

      <div class="grid grid-3" style="margin-top:2.5rem;">
        <div class="card"><h3>Real today</h3><p class="muted small-text">Authentication, weather data, Gemini-powered image &amp; chat analysis, farm/crop calculations.</p></div>
        <div class="card"><h3>Prototype</h3><p class="muted small-text">Farm top-down visualization, soil interpretation, and risk indicators — conceptual, not scientifically validated.</p></div>
        <div class="card"><h3>Future Development</h3><p class="muted small-text">Physical soil sensors and drone/satellite monitoring integration.</p></div>
      </div>
    </div>`;
  }

  function notFoundView() {
    return `<div class="container section-tight view-enter"><div class="card empty-state"><div class="e-icon">🌾</div><h3>Page not found</h3><a class="btn btn-primary" href="#/">Back home</a></div></div>`;
  }

  /* ---------------- Header / init ---------------- */

  function refreshHeader() {
    const loggedIn = CROPX.auth.isLoggedIn();
    document.getElementById('authAreaLoggedOut').classList.toggle('hidden', loggedIn);
    document.getElementById('authAreaLoggedIn').classList.toggle('hidden', !loggedIn);
    document.querySelectorAll('.requires-auth').forEach((el) => el.classList.toggle('hidden', !loggedIn));
    if (loggedIn) {
      const user = CROPX.auth.currentUser();
      document.getElementById('userChip').textContent = (user.name || user.email || '?').trim()[0].toUpperCase();
      document.getElementById('userChip').title = user.name;
    }
  }

  function initGlobalUI() {
    document.getElementById('year').textContent = new Date().getFullYear();

    document.getElementById('navToggle').addEventListener('click', () => {
      const nav = document.getElementById('mainNav');
      const open = nav.classList.toggle('open');
      document.getElementById('navToggle').setAttribute('aria-expanded', String(open));
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await CROPX.auth.logout();
      refreshHeader();
      toast('Logged out.', 'success');
      navigate('/');
    });

    document.getElementById('langSelect').addEventListener('change', (e) => {
      localStorage.setItem('cropx_lang', e.target.value);
    });
    const savedLang = localStorage.getItem('cropx_lang');
    if (savedLang) document.getElementById('langSelect').value = savedLang;

    window.addEventListener('hashchange', () => { refreshHeader(); render(); });
  }

  async function init() {
    initGlobalUI();
    await CROPX.auth.refreshSession();
    refreshHeader();
    render();
  }

  return { navigate, toast, openModal, closeModal, init };
})();

document.addEventListener('DOMContentLoaded', () => CROPX.app.init());
