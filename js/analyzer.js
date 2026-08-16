/* js/analyzer.js
   The CROPX Crop Analyzer: image upload, optional context, mode selection,
   and the call to the protected /api/analyze endpoint. Demo Mode returns a
   clearly-labeled prepared example without using the Gemini API, so a
   class presentation survives flaky wifi or an exhausted quota.
*/
window.CROPX = window.CROPX || {};

CROPX.analyzerModule = (function () {
  let selectedFile = null;
  let selectedMode = 'general';
  let prefillCrop = null;

  const DEMO_RESULT = {
    sufficientEvidence: true,
    possibleIssue: 'Possible pest-related leaf damage',
    confidence: 'moderate',
    observedIndicators: [
      'Irregular chewed patches along the leaf edge',
      'Scattered small discolored spots on the leaf surface',
      'No clear fungal growth pattern visible'
    ],
    recommendedChecks: [
      'Inspect the undersides of nearby leaves for insects or eggs',
      'Compare several plants to see how widespread the damage is',
      'Check for insect activity in the early morning or evening'
    ],
    nextSteps: 'Monitor the affected plants over the next few days and compare against healthy plants nearby. If damage spreads quickly, consult a local agricultural extension officer before choosing a treatment.',
    additionalImagesNeeded: ['Underside of an affected leaf', 'Wider photo of the plant']
  };

  function setMode(mode) { selectedMode = mode; }

  function analyzerView(prefill) {
    prefillCrop = prefill || null;
    selectedFile = null;
    return `
    <div class="container section-tight view-enter">
      <div class="dash-header">
        <div><h1>CROPX Crop Analyzer</h1><p class="muted">Upload a photo for AI-assisted, qualitative crop-health analysis.</p></div>
        <button class="btn btn-secondary" id="launchDemoBtn">🧪 Launch Demo</button>
      </div>

      <div class="analyzer-layout">
        <div>
          <div id="dropzoneWrap">${dropzoneHtml()}</div>

          <div class="mode-select" role="group" aria-label="Analysis mode">
            <button type="button" class="mode-btn active" data-mode="general">🌿 General Health</button>
            <button type="button" class="mode-btn" data-mode="pest">🐛 Pest Scan</button>
            <button type="button" class="mode-btn" data-mode="disease">🍃 Disease Scan</button>
          </div>

          <div class="card" style="margin-top:1rem;">
            <h3 style="font-size:1rem;">Optional context</h3>
            <div class="grid grid-2">
              <div class="field"><label for="ctxCrop">Crop</label>
                <select id="ctxCrop">
                  <option value="">Select crop</option>
                  ${['Cotton', 'Wheat', 'Rice', 'Banana', 'Vegetables', 'Other'].map((c) => `<option ${prefillCrop && prefillCrop.toLowerCase() === c.toLowerCase() ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
              </div>
              <div class="field"><label for="ctxLocation">Location</label><input type="text" id="ctxLocation" placeholder="Auto from farm"/></div>
              <div class="field"><label for="ctxTemp">Temperature (°C)</label><input type="number" id="ctxTemp" placeholder="Optional"/></div>
              <div class="field"><label for="ctxHumidity">Humidity (%)</label><input type="number" id="ctxHumidity" placeholder="Optional"/></div>
              <div class="field"><label for="ctxRainfall">Recent rainfall</label><input type="text" id="ctxRainfall" placeholder="Optional"/></div>
              <div class="field"><label for="ctxSoil">Soil type</label><input type="text" id="ctxSoil" placeholder="Optional"/></div>
            </div>
          </div>

          <button class="btn btn-primary btn-block" id="analyzeBtn" style="margin-top:1.2rem;" disabled>Analyze with CROPX</button>
        </div>

        <div id="analyzerResultWrap">
          <div class="card empty-state">
            <div class="e-icon">🔬</div>
            <p>Your crop-health assessment will appear here.</p>
          </div>
        </div>
      </div>
    </div>`;
  }

  function dropzoneHtml() {
    return `
    <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Upload crop image">
      <div class="dz-icon">📷</div>
      <p><strong>Drag &amp; drop a crop photo</strong><br/>or click to upload from your device</p>
      <p class="small-text muted">JPG, PNG or WEBP · up to 6MB</p>
      <input type="file" id="fileInput" accept="image/jpeg,image/png,image/webp"/>
    </div>`;
  }

  function previewHtml(dataUrl) {
    return `
    <div class="preview-wrap">
      <img src="${dataUrl}" alt="Uploaded crop photo preview"/>
      <button class="preview-remove" id="removeImageBtn" aria-label="Remove image">✕</button>
    </div>`;
  }

  function bindUploadEvents() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    if (!dropzone) return;

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault(); dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
  }

  function handleFile(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      CROPX.app.toast('Please upload a JPG, PNG or WEBP image.', 'error'); return;
    }
    if (file.size > 6 * 1024 * 1024) {
      CROPX.app.toast('Image is too large. Please upload an image under 6MB.', 'error'); return;
    }
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById('dropzoneWrap').innerHTML = previewHtml(reader.result);
      document.getElementById('removeImageBtn').addEventListener('click', () => {
        selectedFile = null;
        document.getElementById('dropzoneWrap').innerHTML = dropzoneHtml();
        bindUploadEvents();
        document.getElementById('analyzeBtn').disabled = true;
      });
      document.getElementById('analyzeBtn').disabled = false;
    };
    reader.readAsDataURL(file);
  }

  function bindModeButtons() {
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        setMode(btn.dataset.mode);
      });
    });
  }

  function bindAnalyzeButton() {
    const btn = document.getElementById('analyzeBtn');
    if (!btn) return;
    btn.addEventListener('click', runAnalysis);
    const demoBtn = document.getElementById('launchDemoBtn');
    if (demoBtn) demoBtn.addEventListener('click', runDemoAnalysis);
  }

  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function runAnalysis() {
    if (!selectedFile) { CROPX.app.toast('Please upload an image first.', 'error'); return; }
    const resultWrap = document.getElementById('analyzerResultWrap');
    resultWrap.innerHTML = `<div class="card loading-block"><div class="spinner"></div><p class="muted">CROPX AI is analyzing your image…</p></div>`;

    try {
      const imageBase64 = await fileToBase64(selectedFile);
      const payload = {
        imageBase64, mimeType: selectedFile.type, mode: selectedMode,
        crop: document.getElementById('ctxCrop').value,
        location: document.getElementById('ctxLocation').value,
        temperature: document.getElementById('ctxTemp').value,
        humidity: document.getElementById('ctxHumidity').value,
        rainfall: document.getElementById('ctxRainfall').value,
        soilType: document.getElementById('ctxSoil').value
      };
      const r = await fetch('/api/analyze', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...CROPX.auth.authHeader() },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Analysis failed.');
      resultWrap.innerHTML = renderResult(data.result, false);
      CROPX.farmModule.logActivity('📷', `Crop scan: ${payload.crop || 'crop'} — ${data.result.possibleIssue}`);
    } catch (err) {
      resultWrap.innerHTML = `<div class="card"><p class="muted">${CROPX.farmModule.escapeHtml(err.message)}</p><button class="btn btn-secondary btn-sm" id="launchDemoInline">Try Demo Mode instead</button></div>`;
      const inline = document.getElementById('launchDemoInline');
      if (inline) inline.addEventListener('click', runDemoAnalysis);
    }
  }

  function runDemoAnalysis() {
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
    const pestBtn = document.querySelector('.mode-btn[data-mode="pest"]');
    if (pestBtn) pestBtn.classList.add('active');
    document.getElementById('dropzoneWrap').innerHTML = `
      <div class="preview-wrap">
        <img src="assets/demo/cotton-demo.svg" alt="Demonstration cotton leaf image"/>
      </div>`;
    const resultWrap = document.getElementById('analyzerResultWrap');
    resultWrap.innerHTML = `<div class="card loading-block"><div class="spinner"></div><p class="muted">Loading demonstration analysis…</p></div>`;
    setTimeout(() => {
      resultWrap.innerHTML = renderResult(DEMO_RESULT, true);
    }, 900);
  }

  function confidenceMeta(level) {
    if (level === 'high') return { icon: '🟢', label: 'High' };
    if (level === 'low') return { icon: '🔴', label: 'Low' };
    return { icon: '🟡', label: 'Moderate' };
  }

  function renderResult(result, isDemo) {
    const c = confidenceMeta(result.confidence);
    return `
    <div class="card result-card">
      ${isDemo ? `<div class="demo-banner">🧪 DEMONSTRATION DATA — not a live analysis</div>` : ''}
      <div class="panel-title"><h2>Crop Health Assessment</h2><span class="confidence-badge">${c.icon} ${c.label}</span></div>
      ${result.sufficientEvidence === false ? `
        <p><strong>CROPX could not obtain enough visual evidence for a reliable assessment.</strong></p>
        <p class="muted">${CROPX.farmModule.escapeHtml(result.possibleIssue || 'Please upload a clearer image.')}</p>
      ` : `
        <p><strong>Possible issue:</strong> ${CROPX.farmModule.escapeHtml(result.possibleIssue)}</p>
        <h3 style="font-size:.95rem; margin-top:1rem;">Observed indicators</h3>
        <div class="chip-list">${(result.observedIndicators || []).map((i) => `<span class="chip">${CROPX.farmModule.escapeHtml(i)}</span>`).join('')}</div>
        <h3 style="font-size:.95rem;">Recommended checks</h3>
        <ul style="margin:0 0 1rem; padding-left:1.2rem;">${(result.recommendedChecks || []).map((i) => `<li>${CROPX.farmModule.escapeHtml(i)}</li>`).join('')}</ul>
        <h3 style="font-size:.95rem;">Next steps</h3>
        <p>${CROPX.farmModule.escapeHtml(result.nextSteps || '')}</p>
      `}
      ${(result.additionalImagesNeeded || []).length ? `
        <h3 style="font-size:.95rem;">For a stronger assessment, consider uploading</h3>
        <div class="chip-list">${result.additionalImagesNeeded.map((i) => `<span class="chip">${CROPX.farmModule.escapeHtml(i)}</span>`).join('')}</div>` : ''}
      <p class="disclaimer">CROPX provides AI-assisted information and does not replace professional agricultural diagnosis.</p>
    </div>`;
  }

  return { analyzerView, bindUploadEvents, bindModeButtons, bindAnalyzeButton, dropzoneHtml };
})();
