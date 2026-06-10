import { useEffect, useMemo, useState } from 'react';
import { addMinutes, setMilliseconds, setSeconds } from 'date-fns';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth.jsx';

const NOTE_COLORS = [
  { value: '#ffffff', label: 'Default' },
  { value: '#fbbf24', label: 'Amber' },
  { value: '#60a5fa', label: 'Blue' },
  { value: '#4ade80', label: 'Green' },
  { value: '#f87171', label: 'Red' },
  { value: '#a78bfa', label: 'Violet' },
];

function toLocalInputValue(date) {
  const nextDate = new Date(date);
  nextDate.setMinutes(nextDate.getMinutes() - nextDate.getTimezoneOffset());
  return nextDate.toISOString().slice(0, 16);
}

function getDefaultMeetingTimes() {
  const now = new Date();
  const rounded = new Date(now);
  rounded.setMinutes(Math.ceil(now.getMinutes() / 30) * 30);
  const start = setMilliseconds(setSeconds(rounded, 0), 0);
  const end = addMinutes(start, 30);
  return {
    start_time: toLocalInputValue(start),
    end_time: toLocalInputValue(end),
  };
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}

function FieldLabel({ children }) {
  return <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{children}</span>;
}

export default function QuickCapturePage({ initialType = 'note' }) {
  const { user } = useAuth();
  const [type, setType] = useState(initialType === 'meeting' ? 'meeting' : 'note');
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [noteForm, setNoteForm] = useState({
    title: '',
    content: '',
    color: '#ffffff',
  });
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    description: '',
    ...getDefaultMeetingTimes(),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api
      .getWorkspaces()
      .then((nextWorkspaces) => {
        setWorkspaces(nextWorkspaces);
        const rememberedId = window.localStorage.getItem('quickCaptureWorkspaceId');
        const defaultWorkspace =
          nextWorkspaces.find((workspace) => workspace.id === rememberedId) || nextWorkspaces[0] || null;
        setWorkspaceId(defaultWorkspace?.id || '');
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') window.close();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId) || null,
    [workspaceId, workspaces]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    if (!workspaceId) {
      setError('Choose a workspace first');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      window.localStorage.setItem('quickCaptureWorkspaceId', workspaceId);

      if (type === 'note') {
        await api.createNote({
          workspace_id: workspaceId,
          title: noteForm.title.trim(),
          content: noteForm.content.trim(),
          color: noteForm.color,
        });
      } else {
        await api.createMeeting({
          workspace_id: workspaceId,
          title: meetingForm.title.trim(),
          description: meetingForm.description.trim(),
          start_time: meetingForm.start_time,
          end_time: meetingForm.end_time || null,
        });
      }

      setMessage(type === 'note' ? 'Note created' : 'Meeting created');
      window.setTimeout(() => window.close(), 380);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const isMeeting = type === 'meeting';

  return (
    <div className="h-screen overflow-hidden bg-[#0c0f14] p-4 text-zinc-100">
      <div className="mx-auto flex h-full max-w-[560px] items-center justify-center">
        <section className="flex max-h-full w-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#151820] shadow-[0_24px_70px_rgba(0,0,0,0.42)]">
          <header className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4 [webkit-app-region:drag]">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/12 text-emerald-300 ring-1 ring-emerald-300/20">
                {isMeeting ? <CalendarIcon /> : <SparkIcon />}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Quick Capture</p>
                <h1 className="mt-1 truncate text-xl font-semibold text-zinc-50">{isMeeting ? 'New meeting' : 'New note'}</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.close()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-100 [webkit-app-region:no-drag]"
              aria-label="Close quick capture"
              title="Close"
            >
              <CloseIcon />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="rounded-xl bg-zinc-950/55 p-1">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setType('note');
                    setError('');
                    setMessage('');
                  }}
                  className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${
                    !isMeeting ? 'bg-zinc-50 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                  }`}
                >
                  <SparkIcon />
                  Note
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType('meeting');
                    setError('');
                    setMessage('');
                  }}
                  className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${
                    isMeeting ? 'bg-zinc-50 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                  }`}
                >
                  <CalendarIcon />
                  Meeting
                </button>
              </div>
            </div>

            <form id="quick-capture-form" onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <FieldLabel>Workspace</FieldLabel>
                <select
                  value={workspaceId}
                  onChange={(event) => setWorkspaceId(event.target.value)}
                  disabled={loading || workspaces.length === 0}
                  className="h-11 w-full rounded-xl border border-zinc-700 bg-[#0a111c] px-3 text-sm font-medium text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15"
                >
                  {workspaces.length === 0 ? (
                    <option value="">No workspaces available</option>
                  ) : (
                    workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name}
                        {workspace.is_solo ? '' : ' (team)'}
                      </option>
                    ))
                  )}
                </select>
                <p className="mt-2 truncate text-xs text-zinc-500">
                  {activeWorkspace ? `Saving to ${activeWorkspace.name}` : 'Pick where this should go.'}
                </p>
              </div>

              <div className="grid gap-4">
                <label className="block">
                  <FieldLabel>Title</FieldLabel>
                  <input
                    required
                    autoFocus
                    value={isMeeting ? meetingForm.title : noteForm.title}
                    onChange={(event) =>
                      isMeeting
                        ? setMeetingForm((prev) => ({ ...prev, title: event.target.value }))
                        : setNoteForm((prev) => ({ ...prev, title: event.target.value }))
                    }
                    placeholder={isMeeting ? 'Weekly planning, client review, product sync' : 'Sprint ideas, launch checklist, call notes'}
                    className="h-11 w-full rounded-xl border border-zinc-700 bg-[#0a111c] px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15"
                  />
                </label>

                <label className="block">
                  <FieldLabel>{isMeeting ? 'Details' : 'Description'}</FieldLabel>
                  <textarea
                    value={isMeeting ? meetingForm.description : noteForm.content}
                    onChange={(event) =>
                      isMeeting
                        ? setMeetingForm((prev) => ({ ...prev, description: event.target.value }))
                        : setNoteForm((prev) => ({ ...prev, content: event.target.value }))
                    }
                    rows={isMeeting ? 4 : 6}
                    placeholder={isMeeting ? 'Agenda, links, or prep notes' : 'Write the note body here'}
                    className="w-full resize-none rounded-xl border border-zinc-700 bg-[#0a111c] px-3 py-3 text-sm leading-6 text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15"
                  />
                </label>

                {isMeeting ? (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <FieldLabel>Start</FieldLabel>
                      <input
                        type="datetime-local"
                        required
                        value={meetingForm.start_time}
                        onChange={(event) => setMeetingForm((prev) => ({ ...prev, start_time: event.target.value }))}
                        className="h-11 w-full rounded-xl border border-zinc-700 bg-[#0a111c] px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15"
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>End</FieldLabel>
                      <input
                        type="datetime-local"
                        value={meetingForm.end_time}
                        onChange={(event) => setMeetingForm((prev) => ({ ...prev, end_time: event.target.value }))}
                        className="h-11 w-full rounded-xl border border-zinc-700 bg-[#0a111c] px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15"
                      />
                    </label>
                  </div>
                ) : (
                  <div>
                    <FieldLabel>Color</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {NOTE_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setNoteForm((prev) => ({ ...prev, color: color.value }))}
                          aria-label={`Set note color to ${color.label}`}
                          title={color.label}
                          className={`h-8 w-8 rounded-full border transition ${
                            noteForm.color === color.value ? 'scale-110 border-zinc-50 ring-2 ring-emerald-300/50' : 'border-zinc-700 hover:border-zinc-400'
                          }`}
                          style={{ backgroundColor: color.value }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {(error || message) && (
                <div className={`rounded-xl border px-3 py-2 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
                  {error || message}
                </div>
              )}
            </form>
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-zinc-800 bg-[#11141b] px-5 py-4">
            <p className="min-w-0 truncate text-sm font-medium text-zinc-400">{user?.display_name || 'Cove'}</p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => window.close()}
                className="h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="quick-capture-form"
                disabled={saving || loading || !workspaceId}
                className="h-10 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving...' : isMeeting ? 'Create meeting' : 'Create note'}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
