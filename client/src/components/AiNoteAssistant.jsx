import { useState } from 'react';
import { api } from '../lib/api';

const ACTIONS = [
  { id: 'generate', label: 'Generate note', icon: '✦', placeholder: 'Describe what you want to write…' },
  { id: 'improve', label: 'Improve', icon: '↑', placeholder: 'Optional instruction (leave blank to auto-improve)…' },
  { id: 'summarize', label: 'Summarize', icon: '≡', placeholder: null },
];

export default function AiNoteAssistant({ note, onCreate, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [activeAction, setActiveAction] = useState('generate');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const action = ACTIONS.find((a) => a.id === activeAction);

  async function run() {
    setError('');
    setLoading(true);
    try {
      if (activeAction === 'generate') {
        if (!prompt.trim()) return;
        const result = await api.aiGenerateNote(prompt);
        await onCreate({ title: result.title, content: result.content });
        setPrompt('');
        setOpen(false);
      } else if (activeAction === 'improve' && note) {
        const result = await api.aiImproveNote(note.title, note.content, prompt || undefined);
        await onUpdate(note.id, { title: result.title, content: result.content });
        setPrompt('');
        setOpen(false);
      } else if (activeAction === 'summarize' && note) {
        const result = await api.aiSummarize(note.content);
        await onCreate({ title: `Summary: ${note.title}`, content: result.summary });
        setOpen(false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // When used as a global generate button (no note prop), only show 'generate'
  const availableActions = note ? ACTIONS : ACTIONS.filter((a) => a.id === 'generate');

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
        title="AI Assistant"
      >
        <span className="text-base leading-none">✦</span>
        AI
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-600">
              AI Assistant
            </p>

            {availableActions.length > 1 && (
              <div className="mb-3 flex rounded-lg bg-zinc-900 p-1 gap-1">
                {availableActions.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { setActiveAction(a.id); setError(''); }}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                      activeAction === a.id
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <span>{a.icon}</span> {a.label}
                  </button>
                ))}
              </div>
            )}

            {action?.placeholder && (
              <textarea
                autoFocus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run();
                  if (e.key === 'Escape') setOpen(false);
                }}
                placeholder={action.placeholder}
                rows={3}
                className="mb-3 w-full resize-none rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600 placeholder:text-zinc-600"
              />
            )}

            {activeAction === 'summarize' && (
              <p className="mb-3 text-xs text-zinc-500">
                Creates a new summary note from the current note's content.
              </p>
            )}

            {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

            <button
              onClick={run}
              disabled={loading || (activeAction === 'generate' && !prompt.trim())}
              className="w-full rounded-lg bg-white py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-40"
            >
              {loading ? 'Thinking…' : action?.label}
            </button>
            <p className="mt-2 text-center text-xs text-zinc-700">⌘↵ to run</p>
          </div>
        </>
      )}
    </div>
  );
}
