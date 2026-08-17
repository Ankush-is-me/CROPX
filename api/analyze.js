// api/analyze.js
// CROPX Crop Analyzer — protected serverless endpoint. Sends the uploaded
// image + optional context to Gemini's multimodal model and returns a
// structured, qualitative assessment. The API key never leaves this file.

const { getAuthedUser } = require('./_lib/auth');
const { rateLimit, clientIdentifier } = require('./_lib/rateLimit');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const ANALYSIS_PROMPT = `You are CROPX, an AI crop-health assistant for a student agri-tech
prototype. You will be shown one photo of a crop/plant, optionally with
farmer-provided context (crop type, location, temperature, humidity, recent
rainfall, soil type, and which analysis mode was requested: general health,
pest scan, or disease scan).

Study the image carefully, then respond with STRICT JSON only — no markdown
fences, no commentary before or after — matching exactly this shape:

{
  "sufficientEvidence": boolean,
  "possibleIssue": string,          // short phrase, e.g. "Possible pest-related leaf damage". If sufficientEvidence is false, explain why briefly instead.
  "confidence": "high" | "moderate" | "low",
  "observedIndicators": string[],   // 2-5 short bullet phrases of what is visible
  "recommendedChecks": string[],    // 2-5 short cautious next checks for the farmer to do themselves
  "nextSteps": string,              // 1-3 sentences, cautious and general, never a specific chemical dosage
  "additionalImagesNeeded": string[] // e.g. ["Whole plant photo","Close-up of affected leaf","Underside of leaf"], empty array if not needed
}

Rules:
- If the image is too blurry, dark, distant, or simply does not show enough
  of the plant to assess, set sufficientEvidence to false, confidence to
  "low", and explain what's missing in possibleIssue.
- NEVER invent a numeric accuracy percentage. Only use the three qualitative
  confidence levels above.
- Be cautious and never claim certainty. This is decision-support, not a
  diagnosis.
- Never suggest a specific pesticide/fungicide name, brand, or dosage.
  Recommend general safe practices and consulting a local agricultural
  extension officer for treatment decisions.
- Output valid JSON only.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const session = getAuthedUser(req);
  if (!session) {
    return res.status(401).json({ error: 'Please sign in to use the Crop Analyzer.' });
  }

  const limit = rateLimit(`analyze:${session.sub}`, { windowMs: 60_000, max: 8 });
  if (!limit.allowed) {
    return res.status(429).json({ error: `You're analyzing quickly. Please wait ${limit.resetInSeconds}s and try again.` });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'CROPX AI is not configured on this deployment yet. Try Demo Mode instead.' });
  }

  try {
    const { imageBase64, mimeType, mode, crop, location, temperature, humidity, rainfall, soilType } = req.body || {};

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'Please upload a crop image.' });
    }
    if (!ALLOWED_MIME.includes(mimeType)) {
      return res.status(400).json({ error: 'Please upload a JPG, PNG or WEBP image.' });
    }

    const approxBytes = Math.ceil((imageBase64.length * 3) / 4);
    if (approxBytes > MAX_IMAGE_BYTES) {
      return res.status(400).json({ error: 'Image is too large. Please upload an image under 6MB.' });
    }

    const contextParts = [];
    if (mode) contextParts.push(`Analysis mode requested: ${mode}`);
    if (crop) contextParts.push(`Crop: ${crop}`);
    if (location) contextParts.push(`Location: ${location}`);
    if (temperature) contextParts.push(`Temperature: ${temperature}`);
    if (humidity) contextParts.push(`Humidity: ${humidity}`);
    if (rainfall) contextParts.push(`Recent rainfall: ${rainfall}`);
    if (soilType) contextParts.push(`Soil type: ${soilType}`);
    const contextText = contextParts.length ? `Farmer-provided context:\n${contextParts.join('\n')}` : 'No additional context provided.';

   const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 25000);

let geminiRes;

try {
  geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: ANALYSIS_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: contextText },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
  temperature: 0.2,
  maxOutputTokens: 1500,
  responseMimeType: 'application/json',
  responseSchema: {
    type: "OBJECT",
    properties: {
      sufficientEvidence: {
        type: "BOOLEAN"
      },
      possibleIssue: {
        type: "STRING"
      },
      confidence: {
        type: "STRING",
        enum: ["high", "moderate", "low"]
      },
      observedIndicators: {
        type: "ARRAY",
        items: {
          type: "STRING"
        }
      },
      recommendedChecks: {
        type: "ARRAY",
        items: {
          type: "STRING"
        }
      },
      nextSteps: {
        type: "STRING"
      },
      additionalImagesNeeded: {
        type: "ARRAY",
        items: {
          type: "STRING"
        }
      }
    },
    required: [
      "sufficientEvidence",
      "possibleIssue",
      "confidence",
      "observedIndicators",
      "recommendedChecks",
      "nextSteps",
      "additionalImagesNeeded"
    ]
  }
}
      }),
      signal: controller.signal
    }
  );
} catch (err) {
  if (err.name === 'AbortError') {
    console.error('Gemini request timed out');
    return res.status(504).json({
      error: 'CROPX AI took too long to respond. Please try again or use Demo Mode.'
    });
  }
  throw err;
} finally {
  clearTimeout(timeout);
}

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => '');
      console.error('Gemini analyze error', geminiRes.status, errText);
      return res.status(502).json({ error: 'CROPX is temporarily unable to complete this analysis. Please try again.' });
    }

    const data = await geminiRes.json();
    const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    console.log('Gemini raw response:', raw);

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error('Could not parse Gemini JSON', raw);
      return res.status(502).json({ error: 'CROPX could not interpret the analysis result. Please try again.' });
    }

    return res.status(200).json({ result: parsed, model: MODEL });
  } catch (err) {
    console.error('analyze error', err);
    return res.status(500).json({ error: 'CROPX is temporarily unable to complete this analysis. Please try again.' });
  }
};
