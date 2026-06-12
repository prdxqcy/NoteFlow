import { useEffect, useRef, useState } from 'react';
import { useReminders } from '../hooks/useReminders';

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function countdown(time, now) {
  const diff = new Date(time).getTime() - now;
  if (diff <= 0) return { label: 'Now', urgent: false, done: true };
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const label = h > 0
    ? `in ${h}h ${m}m`
    : m > 0
    ? `in ${m}m ${String(sec).padStart(2, '0')}s`
    : `in ${sec}s`;
  return { label, urgent: diff < 60_000, done: false };
}

export default function RemindersModal({ onClose }) {
  const { reminders, add, remove, clearFired } = useReminders();
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const inputRef = useRef(null);
  const now = useNow();

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function submit(e) {
    e.preventDefault();
    if (!time) return;
    add(time, note);
    setTime('');
    setNote('');
    inputRef.current?.focus();
  }

  const upcoming = reminders.filter((r) => !r.fired).sort((a, b) => new Date(a.time) - new Date(b.time));
  const fired = reminders.filter((r) => r.fired).sort((a, b) => new Date(b.time) - new Date(a.time));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />

      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-100 bg-white shadow-xl shadow-zinc-200/50 dark:border-slate-700 dark:bg-[#1e2c3d] dark:shadow-black/40">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Reminders</h2>
            <p className="text-xs text-zinc-400">Chime + notification fires when time arrives.</p>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-slate-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Add form */}
        <div className="px-5 pb-4">
          <form onSubmit={submit} className="flex gap-2">
            <input
              ref={inputRef}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              className="w-[120px] shrink-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-400 focus:ring-0 dark:border-slate-600 dark:bg-[#202c40] dark:text-zinc-100"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Remind me to..."
              className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-[#202c40] dark:text-zinc-100 placeholder:text-zinc-400"
            />
            <button
              type="submit"
              disabled={!time}
              className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              Add
            </button>
          </form>
        </div>

        {/* Divider */}
        {(upcoming.length > 0 || fired.length > 0) && (
          <div className="mx-5 border-t border-zinc-100 dark:border-slate-700" />
        )}

        {/* List */}
        <div className="max-h-64 overflow-y-auto px-3 py-2">
          {upcoming.length === 0 && fired.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-400">No reminders yet.</p>
          )}

          {upcoming.map((r) => {
            const cd = countdown(r.time, now);
            return (
              <div key={r.id} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-slate-700/40">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{r.note}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-600">
                      {new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`text-xs ${cd.done ? 'text-emerald-500 font-semibold' : cd.urgent ? 'text-amber-500 font-semibold' : 'text-zinc-400'}`}>
                      {cd.label}
                    </span>
                  </div>
                </div>
                <button onClick={() => remove(r.id)} className="shrink-0 text-zinc-200 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}

          {fired.length > 0 && (
            <>
              <div className="flex items-center justify-between px-3 pt-3 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Fired</p>
                <button onClick={clearFired} className="text-[11px] text-zinc-400 hover:text-red-500">Clear all</button>
              </div>
              {fired.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 opacity-45">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-400 line-through">{r.note}</p>
                    <span className="text-xs text-zinc-400">
                      {new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <button onClick={() => remove(r.id)} className="shrink-0 text-zinc-200 hover:text-red-500 dark:text-slate-600">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {(upcoming.length > 0 || fired.length > 0) && <div className="pb-2" />}
      </div>
    </div>
  );
}
