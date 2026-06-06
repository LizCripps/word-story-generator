import Anthropic from '@anthropic-ai/sdk';

// ── Anthropic client ────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── CORS helper ─────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Length guidance ─────────────────────────────────────────
const LENGTH_GUIDE = {
  short: '4–6 sentences (approximately 80–130 words)',
  long:  '7–12 sentences (approximately 150–280 words)',
};

// ── Main handler ─────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const {
    words    = [],
    genre    = 'general',
    tone     = 'engaging',
    length   = 'short',
    maxWords = null,
  } = req.body ?? {};

  if (!Array.isArray(words) || words.length === 0) {
    res.status(400).json({ error: 'A non-empty "words" array is required.' });
    return;
  }

  const wordList    = words.slice(0, 30).join(', ');
  const lengthGuide = LENGTH_GUIDE[length] ?? LENGTH_GUIDE.short;
  const maxLine     = maxWords
    ? `- The story body must not exceed ${maxWords} words.\n`
    : '';

  const userPrompt = `Write a ${genre} story with a ${tone} tone. Use ALL of the following vocabulary words: ${wordList}

Formatting rules (follow exactly):
- The very first line must be: Title: [Your Creative Title Here]
- Story length: ${lengthGuide}
${maxLine}- Bold EVERY vocabulary word using double asterisks: **word** — every single time it appears
- After the story body write a blank line, then exactly this header: QUESTIONS:
- Then list exactly 3 numbered comprehension questions WITH answers in this format:
  1. [Question here]? Answer: [Answer here].
  2. [Question here]? Answer: [Answer here].
  3. [Question here]? Answer: [Answer here].

Do not include any extra commentary before the Title line or after the questions.`;

  try {
    const message = await anthropic.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 1500,
      messages:   [{ role: 'user', content: userPrompt }],
    });

    const story = message.content[0]?.text ?? '';

    res.status(200).json({
      story,
      genre,
      tone,
      length,
      maxWords: maxWords ?? null,
      wordsUsed: words,
    });

  } catch (err) {
    console.error('[api/story.js] Anthropic error:', err);
    res.status(500).json({ error: err.message ?? 'Failed to generate story. Please try again.' });
  }
}
