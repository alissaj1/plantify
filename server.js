const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve the static front-end (index.html, config files, etc.)
app.use(express.static(__dirname));

app.post('/api/recipes', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY environment variable is not set on the server.',
    });
  }

  try {
    const {
      produce = '',
      pantry = '',
      preferences = '',
      servings = 2,
    } = req.body || {};

    const prompt = [
      'You are Plantify, a helpful vegetarian recipe generator.',
      'Using ONLY the ingredients provided in "produce" and "pantry" (plus common household basics like salt, pepper, water, and oil), create exactly 3 plant-forward recipes.',
      'Each recipe should be clearly separated and include:',
      '- A short, enticing title.',
      '- 1–2 sentence description.',
      '- Key steps as a concise list.',
      '',
      `Produce: ${produce || 'None specified.'}`,
      `Pantry: ${pantry || 'None specified.'}`,
      `Preferences or constraints: ${preferences || 'None specified.'}`,
      `Target servings per recipe: ${servings || 2}`,
      '',
      'Respond in plain text formatted as three sections, each starting with "Recipe X:" on its own line.',
    ].join('\n');

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('Plantify upstream OpenAI error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return res.status(response.status).json({
        error: 'Upstream OpenAI error',
        status: response.status,
        statusText: response.statusText,
      });
    }

    const data = await response.json();
    const textContent =
      data?.output?.[0]?.content?.[0]?.text?.trim?.() ||
      data?.choices?.[0]?.message?.content?.trim?.() ||
      '';

    res.json({ text: textContent });
  } catch (error) {
    console.error('Plantify API error:', error);
    res.status(500).json({
      error: 'Server error while talking to OpenAI.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Plantify server listening at http://localhost:${PORT}`);
});

