// api/chat.js
// CROPX AI Assistant — protected serverless endpoint.
// The Gemini API key lives ONLY in process.env.GEMINI_API_KEY on Vercel
// and is never sent to, or readable by, the browser.

const { getAuthedUser } = require('./_lib/auth');
const { rateLimit, clientIdentifier } = require('./_lib/rateLimit');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const LANGUAGE_NAMES = {
  en: 'English',
  gu: 'Gujarati (ગુજરાતી)',
  hi: 'Hindi (हिन्दी)'
};

const SYSTEM_PROMPT = `You are CROPX AI, a cautious, helpful farming assistant embedded in the CROPX
agri-tech prototype. You help farmers reason about crop health, pests, disease
symptoms, soil, irrigation and weather.

Rules you must always follow:
- Structure every answer with these exact section headers, each on its own line:
  🔎 Possible causes
  🌱 What to check
  💡 Suggested next steps
  ⚠️ When to seek expert help
- Be concise: 1-4 short bullet points per section.
- Never claim certainty you don't have. Use cautious, qualified language.
- Never give dangerous, unsupported, or overconfident instructions (e.g. exact
  pesticide dosages). Recommend consulting a local agricultural extension
  officer or expert for anything safety-critical or high-stakes.
- If the question is unrelated to farming/agriculture, gently redirect the
  user back to crop, soil, pest, disease, irrigation or weather topics.
- CROPX is a student prototype, not a certified diagnostic system. Never
  claim scientific validation.
- Respond entirely in the requested language.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const session = getAuthedUser(req);
  if (!session) {
    return res.status(401).json({ error: 'Please sign in to use CROPX AI.' });
  }

  const limit = rateLimit(`chat:${session.sub}`, { windowMs: 60_000, max: 15 });
  if (!limit.allowed) {
    return res.status(429).json({ error: `You're sending messages quickly. Please wait ${limit.resetInSeconds}s and try again.` });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'CROPX AI is not configured on this deployment yet. Try Demo Mode instead.' });
  }

  try {
    const { message, history, language, farmContext } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Please enter a question.' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message is too long. Please shorten your question.' });
    }

    const lang = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.en;
    const contextLine = farmContext
      ? `\n\nUser's farm context (may be partial): ${JSON.stringify(farmContext).slice(0, 800)}`
      : '';

    const contents = [];
    if (Array.isArray(history)) {
      for (const turn of history.slice(-8)) {
        if (turn && (turn.role === 'user' || turn.role === 'model') && typeof turn.text === 'string') {
          contents.push({ role: turn.role, parts: [{ text: turn.text.slice(0, 2000) }] });
        }
      }
    }
    contents.push({ role: 'user', parts: [{ text: `${message.trim()}\n\nRespond in: ${lang}.${contextLine}` }] });

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 700 }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => '');
      console.error('Gemini chat error', geminiRes.status, errText);
      return res.status(502).json({ error: 'CROPX AI is temporarily unable to respond. Please try again.' });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';

    if (!text) {
      return res.status(502).json({ error: 'CROPX AI could not generate a response. Please rephrase your question.' });
    }

    return res.status(200).json({ reply: text.trim() });
  } catch (err) {
    console.error('chat error', err);
    return res.status(500).json({ error: 'CROPX is temporarily unable to complete this request. Please try again.' });
  }
};
