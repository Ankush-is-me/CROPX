/* js/assistant.js
   CROPX AI Assistant — modern chat UI that calls the protected /api/chat
   endpoint. If the endpoint is unavailable (no key configured / offline),
   falls back to a clearly-labeled canned response so the demo still works.
*/
window.CROPX = window.CROPX || {};

CROPX.assistantModule = (function () {
  let history = [];

  const SUGGESTIONS = [
    'Why are my cotton leaves turning yellow?',
    'How do I reduce pest risk before monsoon?',
    'What does high humidity mean for disease risk?',
    'Best irrigation timing for wheat?'
  ];

  function assistantView(prefillQuestion) {
    history = [];
    return `
    <div class="container section-tight view-enter">
      <div class="dash-header">
        <div><h1>CROPX AI</h1><p class="muted">Your AI-powered farming assistant.</p></div>
        <select id="chatLangSelect" style="border-radius:999px; border:1.5px solid var(--line); padding:.55rem 1rem; font-weight:700;">
          <option value="en">English</option>
          <option value="gu">ગુજરાતી</option>
          <option value="hi">हिन्दी</option>
        </select>
      </div>
      <div class="chat-shell">
        <div class="chat-log" id="chatLog">
          <div class="msg msg-ai">Hi! I'm CROPX AI. Ask me about crop health, pests, disease symptoms, soil, irrigation, or weather. I'll always note when to bring in an expert.</div>
        </div>
        <div class="chat-suggestions" id="chatSuggestions">
          ${SUGGESTIONS.map((s) => `<button class="chat-suggestion" data-q="${CROPX.farmModule.escapeAttr(s)}">${s}</button>`).join('')}
        </div>
        <form class="chat-input-row" id="chatForm">
          <textarea id="chatInput" rows="1" placeholder="Ask CROPX AI a farming question…" aria-label="Message CROPX AI">${prefillQuestion ? CROPX.farmModule.escapeHtml(prefillQuestion) : ''}</textarea>
          <button class="btn btn-primary" type="submit">Send</button>
        </form>
      </div>
    </div>`;
  }

  function appendMessage(role, text) {
    const log = document.getElementById('chatLog');
    if (!log) return;
    const div = document.createElement('div');
    div.className = 'msg ' + (role === 'user' ? 'msg-user' : 'msg-ai');
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function showTyping() {
    const log = document.getElementById('chatLog');
    if (!log) return;
    const div = document.createElement('div');
    div.className = 'msg-typing'; div.id = 'typingIndicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }
  function hideTyping() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  function demoReply(question) {
    return `🔎 Possible causes\n• Common environmental or early pest/disease factors related to your question\n\n🌱 What to check\n• Inspect affected plants closely, including leaf undersides\n• Compare with nearby healthy plants\n\n💡 Suggested next steps\n• Monitor over the next few days and keep notes\n• Use the Crop Analyzer to check a photo\n\n⚠️ When to seek expert help\n• If symptoms spread quickly or affect many plants, consult a local agricultural extension officer\n\n(This is a Demo Mode response — CROPX AI is not connected on this deployment.)`;
  }

  async function sendMessage(text) {
    if (!text.trim()) return;
    appendMessage('user', text.trim());
    history.push({ role: 'user', text: text.trim() });
    showTyping();

    const lang = document.getElementById('chatLangSelect').value;
    const farm = CROPX.farmModule.getActiveFarm();

    try {
      const r = await fetch('/api/chat', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...CROPX.auth.authHeader() },
        body: JSON.stringify({ message: text.trim(), history, language: lang, farmContext: farm ? { name: farm.name, location: farm.location, crops: farm.crops.map((c) => c.name) } : null })
      });
      const data = await r.json();
      hideTyping();
      if (!r.ok) throw new Error(data.error || 'CROPX AI could not respond.');
      appendMessage('ai', data.reply);
      history.push({ role: 'model', text: data.reply });
      CROPX.farmModule.logActivity('🤖', `Asked CROPX AI: "${text.trim().slice(0, 60)}"`);
    } catch (err) {
      hideTyping();
      const reply = demoReply(text);
      appendMessage('ai', reply);
      history.push({ role: 'model', text: reply });
    }
  }

  function bindChat() {
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value;
      input.value = '';
      sendMessage(text);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });
    document.querySelectorAll('.chat-suggestion').forEach((btn) => {
      btn.addEventListener('click', () => sendMessage(btn.dataset.q));
    });
    if (input.value.trim()) sendMessage(input.value.trim());
  }

  return { assistantView, bindChat };
})();
