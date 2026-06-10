const router = require('express').Router();
const auth = require('../middleware/auth');
const pool = require('../db/pool');

router.use(auth);

const OPENROUTER_BASE = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const MODEL = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';

async function chat(messages) {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.CLIENT_URLS || 'http://localhost:5173',
      'X-Title': 'Notes &',
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 1024 }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// Auto-generate a note from a prompt
router.post('/generate-note', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  try {
    const content = await chat([
      {
        role: 'system',
        content:
          'You are a note-taking assistant. Given the user\'s prompt, generate a clear, well-structured note. ' +
          'Respond with a JSON object: { "title": "...", "content": "..." }. ' +
          'The title should be concise (max 60 chars). The content should be in plain text, use line breaks for structure.',
      },
      { role: 'user', content: prompt },
    ]);

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] || content);
    } catch {
      parsed = { title: 'AI Note', content };
    }

    res.json({ title: parsed.title || 'AI Note', content: parsed.content || content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// Improve / rewrite an existing note
router.post('/improve-note', async (req, res) => {
  const { title, content, instruction } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });
  try {
    const userMsg = instruction
      ? `Instruction: ${instruction}\n\nNote title: ${title}\n\nNote content:\n${content}`
      : `Improve this note. Make it clearer and better structured.\n\nNote title: ${title}\n\nNote content:\n${content}`;

    const result = await chat([
      {
        role: 'system',
        content:
          'You are a note-editing assistant. Return a JSON object: { "title": "...", "content": "..." }. ' +
          'Keep the same general topic. Only improve the writing.',
      },
      { role: 'user', content: userMsg },
    ]);

    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] || result);
    } catch {
      parsed = { title, content: result };
    }

    res.json({ title: parsed.title || title, content: parsed.content || result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// Summarize a note
router.post('/summarize', async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });
  try {
    const summary = await chat([
      {
        role: 'system',
        content: 'Summarize the following note in 2-3 sentences. Return only the summary text.',
      },
      { role: 'user', content },
    ]);
    res.json({ summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// Generate a meeting agenda from a title + description
router.post('/meeting-agenda', async (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const agenda = await chat([
      {
        role: 'system',
        content:
          'You are a meeting assistant. Given a meeting title and optional description, ' +
          'generate a structured agenda. Return plain text with numbered items.',
      },
      {
        role: 'user',
        content: `Meeting: ${title}\n${description ? `Description: ${description}` : ''}`,
      },
    ]);
    res.json({ agenda });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/workspace-insights', async (req, res) => {
  const { workspace_id, prompt } = req.body;
  if (!workspace_id || !prompt) return res.status(400).json({ error: 'workspace_id and prompt required' });
  try {
    const access = await pool.query('SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2', [workspace_id, req.user.id]);
    if (!access.rows[0]) return res.status(403).json({ error: 'Access denied' });
    const { rows } = await pool.query(
      `SELECT title,content,updated_at FROM notes WHERE workspace_id=$1 AND (NOT is_private OR created_by=$2) ORDER BY updated_at DESC LIMIT 80`,
      [workspace_id, req.user.id]
    );
    const context = rows.map((note) => `# ${note.title}\n${note.content}`).join('\n\n').slice(0, 40000);
    const answer = await chat([
      { role: 'system', content: 'Answer using only the supplied workspace notes. Clearly say when the notes do not contain the answer. Also identify related notes and useful next actions.' },
      { role: 'user', content: `Workspace notes:\n${context}\n\nQuestion: ${prompt}` },
    ]);
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/extract-tasks', async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });
  try {
    const result = await chat([
      { role: 'system', content: 'Extract actionable tasks. Return only a JSON array of objects with title, description, priority (low, medium, high).' },
      { role: 'user', content },
    ]);
    const match = result.match(/\[[\s\S]*\]/);
    res.json({ tasks: JSON.parse(match?.[0] || '[]') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI request failed' });
  }
});

module.exports = router;
