import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7l.7 11.1A2 2 0 0 0 10.2 20h3.6a2 2 0 0 0 2-1.9L16.5 7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v5M14 11v5" />
    </svg>
  );
}

function CreateMeetingModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ title: '', description: '', start_time: '', end_time: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await onCreate(form);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-100">New meeting</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required
            placeholder="Title"
            className="w-full rounded-lg bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-1 ring-zinc-300 placeholder:text-zinc-400 focus:ring-amber-400 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:placeholder:text-zinc-600 dark:focus:ring-zinc-500"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            placeholder="Description (optional)"
            className="w-full resize-none rounded-lg bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-1 ring-zinc-300 placeholder:text-zinc-400 focus:ring-amber-400 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:placeholder:text-zinc-600 dark:focus:ring-zinc-500"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-500">Start</label>
              <input
                type="datetime-local"
                required
                className="w-full rounded-lg bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-1 ring-zinc-300 focus:ring-amber-400 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:focus:ring-zinc-500"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-500">End</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-1 ring-zinc-300 focus:ring-amber-400 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:focus:ring-zinc-500"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-zinc-100 py-2 text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-zinc-950 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200">
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const STATUS_STYLES = {
  scheduled: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  ongoing: 'bg-green-500/10 text-green-600 dark:text-green-400',
  completed: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function MeetingsList({ meetings, onCreate, onDelete, forceComposerToken = 0 }) {
  const [showModal, setShowModal] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('upcoming');

  useEffect(() => {
    if (forceComposerToken > 0) setShowModal(true);
  }, [forceComposerToken]);

  const filteredMeetings = useMemo(() => {
    const term = query.trim().toLowerCase();
    const now = Date.now();

    return [...meetings]
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
      .filter((meeting) => {
        const matchesTerm = !term || `${meeting.title} ${meeting.description || ''} ${meeting.creator_name || ''}`.toLowerCase().includes(term);
        const meetingTime = new Date(meeting.start_time).getTime();
        const matchesFilter =
          filter === 'all' ||
          (filter === 'upcoming' && meetingTime >= now) ||
          (filter === 'past' && meetingTime < now);
        return matchesTerm && matchesFilter;
      });
  }, [filter, meetings, query]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-zinc-200 px-4 py-4 sm:px-6 dark:border-zinc-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Meetings</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              Track upcoming sessions and filter old ones quickly.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search meetings"
              className="w-full rounded-lg bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-1 ring-zinc-300 placeholder:text-zinc-400 focus:ring-amber-400 sm:w-52 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:placeholder:text-zinc-600 dark:focus:ring-zinc-500"
            />
            <div className="flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
              {['upcoming', 'all', 'past'].map((option) => (
                <button
                  key={option}
                  onClick={() => setFilter(option)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize sm:flex-none ${
                    filter === option
                      ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="hidden rounded-lg bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 sm:block dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              + New meeting
            </button>
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {filteredMeetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-zinc-600 dark:text-zinc-300">
            {meetings.length === 0 ? (
              <>
                <span className="text-sm font-medium">No meetings yet.</span>
                <p className="text-sm">Schedule your first meeting for this workspace.</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-2 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  Add your first meeting
                </button>
              </>
            ) : (
              <>
                <span className="text-sm font-medium">No meetings in this view.</span>
                <p className="text-sm">Switch filters or create a new session.</p>
              </>
            )}
          </div>
        ) : (
          <div className="max-w-3xl space-y-3">
            {filteredMeetings.map((m) => (
              <div key={m.id} className="group flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90 sm:gap-4">
                <div className="flex min-w-[56px] flex-col items-center rounded-lg bg-zinc-100 px-2 py-1.5 text-center dark:bg-zinc-800">
                  <span className="text-xs text-zinc-500 dark:text-zinc-500">
                    {format(new Date(m.start_time), 'MMM')}
                  </span>
                  <span className="text-xl font-bold leading-none text-zinc-900 dark:text-zinc-100">
                    {format(new Date(m.start_time), 'd')}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{m.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[m.status] || STATUS_STYLES.scheduled}`}>
                      {m.status}
                    </span>
                  </div>
                  {m.description && (
                    <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-500">{m.description}</p>
                  )}
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-600">
                    {format(new Date(m.start_time), 'h:mm a')}
                    {m.end_time && ` - ${format(new Date(m.end_time), 'h:mm a')}`}
                    {' · '}{m.creator_name}
                  </p>
                </div>
                <button
                  onClick={() => onDelete(m.id)}
                  aria-label="Delete meeting"
                  title="Delete meeting"
                  className="rounded p-1 text-red-500 sm:opacity-0 sm:group-hover:opacity-100 hover:text-red-600"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {showModal && (
        <CreateMeetingModal onClose={() => setShowModal(false)} onCreate={onCreate} />
      )}
    </div>
  );
}
