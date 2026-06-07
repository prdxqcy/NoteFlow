import { useEffect, useMemo, useState } from 'react';
import { addMinutes, setMilliseconds, setSeconds } from 'date-fns';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth.jsx';

const NOTE_COLORS = [
  { value: '#ffffff', label: 'Default' },
  { value: '#f6d365', label: 'Amber' },
  { value: '#93c5fd', label: 'Blue' },
  { value: '#86efac', label: 'Green' },
  { value: '#f9a8d4', label: 'Rose' },
  { value: '#c4b5fd', label: 'Violet' },
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
  return <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{children}</span>;
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
    <div className="min-h-screen overflow-hidden bg-[#0b0c0f] p-3 text-zinc-100">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[540px] items-center justify-center">
        <div className="w-full rounded-[28px] border border-zinc-800 bg-[linear-gradient(180deg,#171922_0%,#11131a_100%)] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <div className="rounded-[22px] border border-zinc-800/90 bg-zinc-950/75">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 px-5 pb-4 pt-4 [webkit-app-region:drag]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/12 text-amber-300">
                    {isMeeting ? <CalendarIcon /> : <SparkIcon />}
                  </span>
                  Quick Capture
                </div>
                <h1 className="mt-3 text-[24px] font-semibold tracking-tight text-zinc-50">
                  {isMeeting ? 'New meeting' : 'New note'}
                </h1>
                <p className="mt-1 text-sm text-zinc-400">
                  {isMeeting ? 'Plan the meeting and drop it into the right workspace.' : 'Capture the idea fast and file it where it belongs.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.close()}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100 [webkit-app-region:no-drag]"
                aria-label="Close quick capture"
                title="Close"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="px-5 pt-4">
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-zinc-900 p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setType('note');
                    setError('');
                    setMessage('');
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    !isMeeting ? 'bg-zinc-50 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-100'
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
                  className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    isMeeting ? 'bg-zinc-50 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <CalendarIcon />
                  Meeting
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                <FieldLabel>Workspace</FieldLabel>
                <select
                  value={workspaceId}
                  onChange={(event) => setWorkspaceId(event.target.value)}
                  disabled={loading || workspaces.length === 0}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-amber-400"
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
                <p className="mt-2 text-xs text-zinc-500">
                  {activeWorkspace ? `Saving to ${activeWorkspace.name}` : 'Pick where this should go.'}
                </p>
              </div>

              <div className="space-y-4">
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
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-amber-400"
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
                    rows={isMeeting ? 3 : 5}
                    placeholder={isMeeting ? 'Agenda, links, or prep notes' : 'Write the note body here'}
                    className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-amber-400"
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
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-amber-400"
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>End</FieldLabel>
                      <input
                        type="datetime-local"
                        value={meetingForm.end_time}
                        onChange={(event) => setMeetingForm((prev) => ({ ...prev, end_time: event.target.value }))}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-amber-400"
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
                            noteForm.color === color.value ? 'scale-110 border-zinc-50' : 'border-zinc-700 hover:border-zinc-400'
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

              <div className="flex items-center justify-between gap-3 border-t border-zinc-800 pt-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-300">{user?.display_name || 'Cove'}</p>
                  <p className="text-xs text-zinc-500">Press Esc to close</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => window.close()}
                    className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || loading || !workspaceId}
                    className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : isMeeting ? 'Create meeting' : 'Create note'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
