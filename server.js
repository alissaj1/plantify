const express = require('express');
const path = require('path');

// Simple Express server that serves the static Plantify UI
// and proxies recipe generation requests to OpenAI on the server side.

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static files (index.html, config files, etc.)
app.use(express.static(path.join(__dirname), { index: 'index.html' }));

// Explicit fallback to serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/recipes', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res
      .status(500)
      .json({ error: 'OPENAI_API_KEY environment variable is not set.' });
  }

  const {
    produce = '',
    pantry = '',
    preferences = '',
    servings = 2,
    prompt: incomingPrompt,
  } = req.body || {};

  const servingsNum =
    typeof servings === 'number' && !Number.isNaN(servings) && servings > 0
      ? servings
      : 2;

  const prompt =
    incomingPrompt ||
    [
      'You are Plantify, a vegetarian recipe assistant.',
      'Using ONLY the listed fresh produce and pantry staples (plus basic pantry items like salt, pepper, and water),',
      'create EXACTLY 3 distinct vegetarian recipes.',
      '',
      `Each recipe should serve roughly ${servingsNum} people.`,
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

  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(
        'Plantify server: OpenAI error',
        response.status,
        response.statusText,
        text,
      );
      return res.status(502).json({
        error: `OpenAI request failed with status ${response.status} (${response.statusText})`,
      });
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      console.error('Plantify server: JSON parse error from OpenAI', err);
      return res
        .status(502)
        .json({ error: 'Unable to parse OpenAI response as JSON.' });
    }

    const textContent =
      data?.output?.[0]?.content?.[0]?.text?.trim?.() ||
      data?.choices?.[0]?.message?.content?.trim?.() ||
      data?.text?.trim?.() ||
      '';

    if (!textContent) {
      return res
        .status(502)
        .json({ error: 'OpenAI returned an empty response.' });
    }

    return res.json({ text: textContent });
  } catch (error) {
    console.error('Plantify server error:', error);
    return res
      .status(500)
      .json({ error: 'Failed to generate recipes on the server.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Plantify server listening on port ${PORT}`);
});

