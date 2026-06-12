import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { api } from '../lib/api';
import GoogleCalendarConnect from './GoogleCalendarConnect';

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

const inputCls =
  'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:bg-zinc-750';

const dateCls =
  inputCls + ' [color-scheme:light] dark:[color-scheme:dark]';

function GuestEmailChips({ guests, onChange, members = [] }) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const inputId = 'guest-email-input';

  function addEmail(val) {
    const v = val.trim().toLowerCase();
    if (!v || !v.includes('@')) return;
    if (!guests.includes(v)) onChange([...guests, v]);
    setInput('');
    setOpen(false);
  }

  function toggleMember(email) {
    if (guests.includes(email)) onChange(guests.filter((g) => g !== email));
    else onChange([...guests, email]);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail(input); }
    if (e.key === 'Backspace' && !input && guests.length > 0) onChange(guests.slice(0, -1));
    if (e.key === 'Escape') setOpen(false);
  }

  const suggestions = members.filter(
    (m) => m.email && !guests.includes(m.email) &&
      (m.display_name?.toLowerCase().includes(input.toLowerCase()) ||
       m.email.toLowerCase().includes(input.toLowerCase()))
  );

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Guests <span className="font-normal text-zinc-400">(team members or external emails)</span>
      </label>

      {/* Team member quick-select */}
      {members.filter((m) => m.email).length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {members.filter((m) => m.email).map((m) => {
            const selected = guests.includes(m.email);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleMember(m.email)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${selected ? 'bg-emerald-500 text-white' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-600 dark:text-zinc-200'}`}>
                  {m.display_name?.[0]?.toUpperCase() || '?'}
                </span>
                {m.display_name}
                {selected && <span className="ml-0.5 text-emerald-500">✓</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Chip input */}
      <div className="relative">
        <div
          className="flex flex-wrap gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 focus-within:border-zinc-400 focus-within:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:focus-within:border-zinc-500"
          onClick={() => { document.getElementById(inputId)?.focus(); setOpen(true); }}
        >
          {guests.map((g) => (
            <span key={g} className="flex items-center gap-1 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
              {g}
              <button type="button" onClick={(e) => { e.stopPropagation(); onChange(guests.filter((x) => x !== g)); }} className="leading-none text-zinc-400 hover:text-zinc-900">×</button>
            </span>
          ))}
          <input
            id={inputId}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setOpen(true); }}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={guests.length === 0 ? 'Add external email…' : ''}
            className="min-w-[140px] flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
          />
        </div>

        {/* Dropdown suggestions */}
        {open && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-zinc-100 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-[#1e2c3d]">
            {suggestions.map((m) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={() => addEmail(m.email)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-slate-700"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  {m.display_name?.[0]?.toUpperCase() || '?'}
                </span>
                <span className="flex-1 font-medium text-zinc-800 dark:text-zinc-100">{m.display_name}</span>
                <span className="text-xs text-zinc-400">{m.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function MiniCalendar({ label, required, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const [viewDate, setViewDate] = useState(() => value ? new Date(value) : new Date());
  const [step, setStep] = useState('date');
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  const selected = value ? new Date(value) : null;
  const selH = selected ? String(selected.getHours()).padStart(2, '0') : '09';
  const selM = selected ? String(selected.getMinutes()).padStart(2, '0') : '00';

  const yr = viewDate.getFullYear();
  const mo = viewDate.getMonth();
  const firstDay = new Date(yr, mo, 1).getDay();
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const today = new Date();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function selectDay(day) {
    const d = new Date(yr, mo, day, parseInt(selH), parseInt(selM));
    onChange(fmt(d));
    setStep('time');
  }

  function updateTime(h, m) {
    const base = selected ? new Date(selected) : new Date(yr, mo, today.getDate());
    base.setHours(parseInt(h) || 0, parseInt(m) || 0, 0, 0);
    onChange(fmt(base));
  }

  function fmt(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const display = selected
    ? `${MONTHS[selected.getMonth()].slice(0,3)} ${selected.getDate()} · ${selH}:${selM}`
    : null;

  function openCalendar() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left, width: r.width });
    setStep('date');
    setOpen((o) => !o);
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <button
        ref={btnRef}
        type="button"
        onClick={openCalendar}
        className={`${inputCls} flex items-center gap-2 text-left ${!display ? 'text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-zinc-400">
          <rect x="3" y="5" width="18" height="16" rx="2" strokeLinecap="round" /><path d="M16 3v4M8 3v4M3 9h18" strokeLinecap="round" />
        </svg>
        {display || 'Pick date & time'}
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: 288, zIndex: 9999 }}
          className="w-72 rounded-2xl border border-zinc-100 bg-white p-4 shadow-2xl shadow-zinc-200/60 dark:border-slate-700 dark:bg-[#1e2c3d] dark:shadow-black/40"
        >
          {step === 'date' ? (
            <>
              {/* Month nav */}
              <div className="mb-3 flex items-center justify-between">
                <button type="button" onClick={() => setViewDate(new Date(yr, mo - 1))} className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-700">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path strokeLinecap="round" d="M15 6l-6 6 6 6" /></svg>
                </button>
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{MONTHS[mo]} {yr}</span>
                <button type="button" onClick={() => setViewDate(new Date(yr, mo + 1))} className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-700">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path strokeLinecap="round" d="M9 6l6 6-6 6" /></svg>
                </button>
              </div>
              {/* Day headers */}
              <div className="mb-1 grid grid-cols-7">
                {DAYS.map((d) => <span key={d} className="text-center text-[10px] font-semibold text-zinc-400">{d}</span>)}
              </div>
              {/* Day grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: firstDay }).map((_, i) => <span key={`gap${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isSel = selected && selected.getDate() === day && selected.getMonth() === mo && selected.getFullYear() === yr;
                  const isToday = today.getDate() === day && today.getMonth() === mo && today.getFullYear() === yr;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => selectDay(day)}
                      className={`flex h-8 w-full items-center justify-center rounded-lg text-sm transition-colors
                        ${isSel ? 'bg-emerald-600 font-bold text-white' : isToday ? 'border border-emerald-300 bg-emerald-50 font-semibold text-emerald-700' : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-slate-700'}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* Time picker */
            <div>
              <button type="button" onClick={() => setStep('date')} className="mb-3 flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path strokeLinecap="round" d="M15 6l-6 6 6 6" /></svg>
                {selected ? `${MONTHS[selected.getMonth()].slice(0,3)} ${selected.getDate()}, ${selected.getFullYear()}` : 'Back'}
              </button>
              <p className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-100">What time?</p>

              {/* Quick slots */}
              <div className="mb-3 grid grid-cols-4 gap-1.5">
                {['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { updateTime(t.split(':')[0], t.split(':')[1]); setOpen(false); }}
                    className={`rounded-lg py-1.5 text-xs font-medium transition-colors
                      ${selH + ':' + selM === t ? 'bg-emerald-600 text-white' : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:bg-slate-700 dark:text-zinc-300 dark:hover:bg-slate-600'}`}
                  >
                    {parseInt(t) > 12 ? `${parseInt(t)-12}:${t.split(':')[1]} PM` : `${parseInt(t)}:${t.split(':')[1]} AM`}
                  </button>
                ))}
              </div>

              {/* Custom time */}
              <div className="flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-slate-700">
                <input
                  type="number" min="0" max="23" value={selH}
                  onChange={(e) => updateTime(String(e.target.value).padStart(2,'0'), selM)}
                  className="w-16 rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center text-sm font-bold text-zinc-900 outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-zinc-100"
                />
                <span className="text-lg font-bold text-zinc-400">:</span>
                <input
                  type="number" min="0" max="59" step="5" value={selM}
                  onChange={(e) => updateTime(selH, String(e.target.value).padStart(2,'0'))}
                  className="w-16 rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center text-sm font-bold text-zinc-900 outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-zinc-100"
                />
                <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-xl bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">Done</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function CreateMeetingModal({ onClose, onCreate, members = [] }) {
  const [form, setForm] = useState({ title: '', description: '', location: '', start_time: '', end_time: '' });
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await onCreate({ ...form, guest_emails: guests });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  async function generateAgenda() {
    if (!form.title.trim()) return;
    setAiLoading(true);
    try {
      const result = await api.aiMeetingAgenda(form.title, form.description);
      setForm((f) => ({ ...f, description: result.agenda }));
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-100 bg-white shadow-2xl shadow-zinc-200/50 dark:border-slate-700 dark:bg-[#1e2c3d] dark:shadow-black/40">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">New meeting</h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-slate-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <input required autoFocus placeholder="Meeting title" className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Description / Agenda</label>
              <button type="button" onClick={generateAgenda} disabled={aiLoading || !form.title.trim()} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-40 dark:hover:bg-slate-700">
                <span>✦</span>{aiLoading ? 'Generating…' : 'AI agenda'}
              </button>
            </div>
            <textarea placeholder="Add context or let AI generate an agenda" className={inputCls + ' resize-none'} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <GuestEmailChips guests={guests} onChange={setGuests} members={members} />

          <div>
            <input
              placeholder="Location (address or Google Maps link)"
              className={inputCls}
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            {form.location.trim() && !(/^https?:\/\//.test(form.location)) && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(form.location.trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-800 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5 shrink-0 text-emerald-500">
                  <path d="M12 21C12 21 5 13.5 5 8.5a7 7 0 0 1 14 0c0 5-7 12.5-7 12.5Z" strokeLinecap="round" /><circle cx="12" cy="8.5" r="2.5" />
                </svg>
                <span className="flex-1 truncate">{form.location.trim()}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 shrink-0 opacity-50">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
                </svg>
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MiniCalendar
              label="Start"
              required
              value={form.start_time}
              onChange={(v) => {
                const pad = (n) => String(n).padStart(2, '0');
                const startDate = new Date(v);
                let endTime = form.end_time;
                if (!endTime) {
                  const end = new Date(startDate);
                  end.setHours(end.getHours() + 1);
                  endTime = `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
                } else {
                  const end = new Date(endTime);
                  end.setFullYear(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                  endTime = `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
                }
                setForm({ ...form, start_time: v, end_time: endTime });
              }}
            />
            <MiniCalendar label="End" value={form.end_time} onChange={(v) => setForm({ ...form, end_time: v })} />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-slate-700 dark:bg-slate-800 dark:text-zinc-300">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {loading ? 'Creating…' : 'Create meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const STATUS_COLOR = {
  scheduled: { bar: 'bg-blue-500', badge: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', dot: 'bg-blue-500' },
  ongoing:   { bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-500' },
  completed: { bar: 'bg-zinc-300', badge: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400', dot: 'bg-zinc-400' },
  cancelled: { bar: 'bg-red-400', badge: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-400' },
};

function MeetingDetailModal({ meeting, onDelete, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sc = STATUS_COLOR[meeting.status] || STATUS_COLOR.scheduled;
  const guests = meeting.guest_emails || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#1e2c3d]">
        <div className={`h-1 w-full ${sc.bar}`} />
        <div className="flex items-start justify-between px-6 pt-5 pb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{meeting.title}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${sc.badge}`}>{meeting.status}</span>
              {meeting.google_event_id && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">GCal</span>
              )}
            </div>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {format(new Date(meeting.start_time), 'EEEE, MMMM d · h:mm a')}
              {meeting.end_time && ` – ${format(new Date(meeting.end_time), 'h:mm a')}`}
            </p>
          </div>
          <button onClick={onClose} className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-slate-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-4 px-6 pb-6">
          {meeting.description && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Agenda</p>
              <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{meeting.description}</p>
            </div>
          )}

          {meeting.location && (
            <div className="flex items-start gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400">
                <path d="M12 21C12 21 5 13.5 5 8.5a7 7 0 0 1 14 0c0 5-7 12.5-7 12.5Z" strokeLinecap="round" /><circle cx="12" cy="8.5" r="2.5" />
              </svg>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Location</p>
                {/^https?:\/\//.test(meeting.location) ? (
                  <a href={meeting.location} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 hover:underline dark:text-emerald-400">
                    {meeting.location.length > 50 ? meeting.location.slice(0, 50) + '…' : meeting.location}
                  </a>
                ) : (
                  <>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{meeting.location}</p>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(meeting.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" /></svg>
                      View on Google Maps
                    </a>
                  </>
                )}
              </div>
            </div>
          )}

          {meeting.creator_name && (
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                {meeting.creator_name[0]?.toUpperCase()}
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Organizer</p>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{meeting.creator_name}</p>
              </div>
            </div>
          )}

          {guests.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Guests ({guests.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {guests.map((g) => (
                  <span key={g} className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600 dark:border-slate-600 dark:bg-slate-700 dark:text-zinc-300">{g}</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end border-t border-zinc-100 pt-3 dark:border-slate-700">
            <button
              onClick={() => { onDelete(meeting.id); onClose(); }}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M7.5 7l.7 11.1A2 2 0 0 0 10.2 20h3.6a2 2 0 0 0 2-1.9L16.5 7" />
              </svg>
              Delete meeting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MeetingsList({ meetings, members = [], onCreate, onDelete, forceComposerToken = 0 }) {
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
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
        const startTime = new Date(meeting.start_time).getTime();
        const endTime = meeting.end_time ? new Date(meeting.end_time).getTime() : startTime;
        const matchesFilter =
          filter === 'all' ||
          (filter === 'upcoming' && endTime >= now) ||
          (filter === 'past' && endTime < now);
        return matchesTerm && matchesFilter;
      });
  }, [filter, meetings, query]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-zinc-200 px-4 py-3 sm:px-6 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Title */}
          <h2 className="mr-auto text-base font-semibold text-zinc-900 dark:text-zinc-100">Meetings</h2>

          {/* Search */}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-36 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:ring-zinc-600 sm:w-44"
          />

          {/* Filter tabs */}
          <div className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900">
            {['upcoming', 'all', 'past'].map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  filter === option
                    ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          {/* GCal compact pill */}
          <GoogleCalendarConnect compact />

          {/* New meeting */}
          <button
            onClick={() => setShowModal(true)}
            className="hidden rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 sm:block dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-400"
          >
            + New meeting
          </button>
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
                  className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-400"
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
          <div className="max-w-xl space-y-2.5">
            {filteredMeetings.map((m) => {
              const sc = STATUS_COLOR[m.status] || STATUS_COLOR.scheduled;
              const guests = m.guest_emails || [];
              return (
                <button
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className="group w-full overflow-hidden rounded-xl border border-zinc-100 bg-white text-left transition-all hover:border-zinc-200 hover:shadow-sm dark:border-slate-700 dark:bg-[#1e2c3d] dark:hover:border-slate-600"
                >
                  <div className={`h-[2px] w-full ${sc.bar}`} />
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* compact date chip */}
                    <div className="flex shrink-0 flex-col items-center rounded-lg bg-zinc-50 px-2.5 py-1.5 text-center dark:bg-slate-700/50">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{format(new Date(m.start_time), 'MMM')}</span>
                      <span className="text-lg font-black leading-tight text-zinc-900 dark:text-zinc-100">{format(new Date(m.start_time), 'd')}</span>
                    </div>
                    {/* main content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{m.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${sc.badge}`}>{m.status}</span>
                        {m.google_event_id && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">GCal</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                        <span className="flex items-center gap-1">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" /></svg>
                          {format(new Date(m.start_time), 'h:mm a')}{m.end_time && ` – ${format(new Date(m.end_time), 'h:mm a')}`}
                        </span>
                        {m.location && (
                          <span className="flex items-center gap-1 truncate max-w-[180px]">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 shrink-0"><path d="M12 21C12 21 5 13.5 5 8.5a7 7 0 0 1 14 0c0 5-7 12.5-7 12.5Z" strokeLinecap="round" /><circle cx="12" cy="8.5" r="2.5" /></svg>
                            {m.location}
                          </span>
                        )}
                        {m.creator_name && <span className="flex items-center gap-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" /></svg>{m.creator_name}</span>}
                        {guests.length > 0 && <span className="flex items-center gap-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" strokeLinecap="round" /><circle cx="9" cy="7" r="4" /><path d="M23 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" /></svg>{guests.length} guest{guests.length !== 1 ? 's' : ''}</span>}
                        {m.description && <span className="hidden truncate max-w-[200px] sm:inline">{m.description}</span>}
                      </div>
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400 dark:text-slate-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showModal && <CreateMeetingModal onClose={() => setShowModal(false)} onCreate={onCreate} members={members} />}
      {selected && <MeetingDetailModal meeting={selected} onDelete={onDelete} onClose={() => setSelected(null)} />}
    </div>
  );
}
