import { useState } from 'react';
import { useReminders } from '../hooks/useReminders';

const field = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-[#202c40]';
const btn = 'rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50';

export default function RemindersTab() {
  const { reminders, add, remove, clearFired } = useReminders();
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!time) return;
    add(time, note);
    setTime('');
    setNote('');
  }

  const upcoming = reminders.filter((r) => !r.fired).sort((a, b) => new Date(a.time) - new Date(b.time));
  const fired = reminders.filter((r) => r.fired).sort((a, b) => new Date(b.time) - new Date(a.time));

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-slate-600 dark:bg-[#202c40]">
        <h3 className="mb-3 font-semibold">New reminder</h3>
        <div className="space-y-2">
          <input
            className={field}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Remind me to..."
          />
          <input
            className={field}
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
          <button className={btn} type="submit" disabled={!time}>
            Set reminder
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          A chime and notification will fire when the time arrives — even in the background.
        </p>
      </form>

      {upcoming.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-zinc-500 uppercase tracking-wide">Upcoming</h3>
          <div className="space-y-2">
            {upcoming.map((r) => (
              <article key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-slate-600 dark:bg-[#202c40]">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{r.note}</p>
                  <time className="text-xs text-emerald-600">{new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                </div>
                <button onClick={() => remove(r.id)} className="shrink-0 text-xs text-red-400 hover:text-red-600">Remove</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {fired.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Fired</h3>
            <button onClick={clearFired} className="text-xs text-zinc-400 hover:text-red-500">Clear all</button>
          </div>
          <div className="space-y-2">
            {fired.map((r) => (
              <article key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 opacity-60 dark:border-slate-700 dark:bg-slate-800">
                <div className="min-w-0">
                  <p className="text-sm truncate line-through">{r.note}</p>
                  <time className="text-xs text-zinc-400">{new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                </div>
                <button onClick={() => remove(r.id)} className="shrink-0 text-xs text-zinc-400 hover:text-red-500">Remove</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {upcoming.length === 0 && fired.length === 0 && (
        <p className="text-center text-sm text-zinc-400 py-8">No reminders yet.</p>
      )}
    </div>
  );
}
