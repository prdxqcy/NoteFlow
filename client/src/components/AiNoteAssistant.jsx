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
        className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-white"
        title="AI Assistant"
      >
        <span className="text-base leading-none">✦</span>
        AI
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
              AI Assistant
            </p>

            {availableActions.length > 1 && (
              <div className="mb-3 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
                {availableActions.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { setActiveAction(a.id); setError(''); }}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                      activeAction === a.id
                        ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
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
                className="mb-3 w-full resize-none rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200 focus:ring-zinc-400 placeholder:text-zinc-400 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800 dark:placeholder:text-zinc-600 dark:focus:ring-zinc-600"
              />
            )}

            {activeAction === 'summarize' && (
              <p className="mb-3 text-xs text-zinc-500">
                Creates a new summary note from the current note's content.
              </p>
            )}

            {error && <p className="mb-2 text-xs text-red-500">{error}</p>}

            <button
              onClick={run}
              disabled={loading || (activeAction === 'generate' && !prompt.trim())}
              className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {loading ? 'Thinking…' : action?.label}
            </button>
            <p className="mt-2 text-center text-xs text-zinc-400 dark:text-zinc-700">⌘↵ to run</p>
          </div>
        </>
      )}
    </div>
  );
}
