module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }
  body = body || {};

  /* ── Pull API key from environment variable ── */
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server is missing OPENAI_API_KEY. Set it in Vercel Environment Variables.',
    });
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

  /* ── Parse inputs ── */
  const produce = typeof body.produce === 'string' ? body.produce.trim() : '';
  const pantry = typeof body.pantry === 'string' ? body.pantry.trim() : '';
  const preferences = typeof body.preferences === 'string' ? body.preferences.trim() : '';
  const servingsRaw = body.servings;
  const servings =
    typeof servingsRaw === 'number' && Number.isFinite(servingsRaw) && servingsRaw > 0
      ? servingsRaw
      : 2;

  const prompt =
    (typeof body.prompt === 'string' && body.prompt.trim()) ||
    [
      'You are Plantify, a vegetarian recipe assistant.',
      'Using ONLY the listed fresh produce and pantry staples (plus basic pantry items like salt, pepper, and water),',
      'create EXACTLY 3 distinct vegetarian recipes.',
      '',
      `Each recipe should serve roughly ${servings} people.`,
      'Make the recipes approachable for home cooks.',
      '',
      'Fresh produce:',
      produce || '(none provided)',
      '',
      'Pantry staples:',
      pantry || '(none provided)',
      '',
      'Taste preferences:',
      preferences || '(none provided)',
      '',
      'Format the response as clearly labeled sections starting with:',
      'Recipe 1: <title>',
      'Recipe 2: <title>',
      'Recipe 3: <title>',
      'Follow each title with a short description, ingredients list, and steps.',
    ].join('\n');

  /* ── Call OpenAI ── */
  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: prompt }),
    });

    if (!upstream.ok) {
      const errorText = await upstream.text().catch(() => '');
      console.error('OpenAI error:', upstream.status, upstream.statusText, errorText);
      return res.status(502).json({
        error: `OpenAI request failed (${upstream.status}): ${errorText}`,
      });
    }

    const data = await upstream.json();

    const text =
      data?.output?.[0]?.content?.[0]?.text?.trim?.() ||
      data?.choices?.[0]?.message?.content?.trim?.() ||
      data?.text?.trim?.() ||
      '';

    if (!text) {
      return res.status(502).json({ error: 'OpenAI returned an empty response' });
    }

    return res.status(200).json({ text });
  } catch (error) {
    console.error('Generate API error:', error);
    return res.status(500).json({ error: 'Server error while generating recipes.' });
  }
}
