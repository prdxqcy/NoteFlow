import { useMemo } from 'react';
import { format, isToday, isTomorrow, startOfDay, subDays } from 'date-fns';

/* ─── tiny sparkline (pure SVG, no deps) ─── */
function Sparkline({ data = [], color = '#10b981', h = 40, w = 120 }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(' ');
  const fill = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  });
  const area = `M0,${h} L${fill.join(' L')} L${w},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="overflow-visible" style={{ width: w, height: h }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace('#','')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── stat card ─── */
function StatCard({ icon, label, value, sub, trend, sparkData, sparkColor }) {
  const up = trend >= 0;
  return (
    <div className="flex flex-1 flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-[#1a2638]">
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-zinc-500 dark:text-zinc-400">{icon}</svg>
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${up ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400'}`}>
            {up ? '↑' : '↓'} {Math.abs(trend)}
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-black leading-none text-zinc-900 dark:text-zinc-100">{value}</p>
        <p className="mt-1 text-xs text-zinc-400">{label}</p>
        {sub && <p className="text-[10px] text-zinc-400">{sub}</p>}
      </div>
      {sparkData && (
        <div className="mt-3">
          <Sparkline data={sparkData} color={sparkColor || '#10b981'} w={120} h={32} />
        </div>
      )}
    </div>
  );
}

/* ─── quick action button ─── */
function QuickAction({ icon, label, description, onClick, color = 'emerald' }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    blue:    'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    violet:  'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
    amber:   'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colors[color]}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">{icon}</svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{label}</p>
        <p className="text-[11px] text-zinc-400">{description}</p>
      </div>
    </button>
  );
}

const AVATAR_COLORS = ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-indigo-500','bg-pink-500'];
function memberColor(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function HomeDashboard({ notes = [], meetings = [], members = [], user, workspace, onCreateNote, onCreateMeeting, onChangeView }) {
  const now = new Date();

  /* ── derived stats ── */
  const todayMeetings = useMemo(() =>
    meetings
      .filter(m => isToday(new Date(m.start_time)))
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),
    [meetings]);

  const upcomingMeetings = useMemo(() =>
    meetings
      .filter(m => new Date(m.end_time || m.start_time) >= now)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
      .slice(0, 5),
    [meetings]);

  const recentNotes = useMemo(() =>
    [...notes].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 5),
    [notes]);

  const pinnedNotes = notes.filter(n => n.is_pinned).length;

  /* ── sparkline: notes created per day (last 7 days) ── */
  const notesSpark = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = startOfDay(subDays(now, 6 - i));
      const next = startOfDay(subDays(now, 5 - i));
      return notes.filter(n => {
        const d = new Date(n.created_at);
        return d >= day && d < next;
      }).length;
    });
  }, [notes]);

  const meetingsSpark = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = startOfDay(subDays(now, 6 - i));
      const next = startOfDay(subDays(now, 5 - i));
      return meetings.filter(m => {
        const d = new Date(m.start_time);
        return d >= day && d < next;
      }).length;
    });
  }, [meetings]);

  function meetingDateLabel(m) {
    const d = new Date(m.start_time);
    if (isToday(d)) return `Today · ${format(d, 'h:mm a')}`;
    if (isTomorrow(d)) return `Tomorrow · ${format(d, 'h:mm a')}`;
    return format(d, 'EEE, MMM d · h:mm a');
  }

  const STATUS_BAR = {
    scheduled: 'bg-blue-500',
    ongoing:   'bg-emerald-500',
    completed: 'bg-zinc-300',
    cancelled: 'bg-red-400',
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-[#111a2a]">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Good {now.getHours() < 12 ? 'morning' : now.getHours() < 18 ? 'afternoon' : 'evening'}, {user?.display_name?.split(' ')[0] || 'there'} 👋
          </h2>
          <p className="text-xs text-zinc-400">{format(now, "EEEE, d MMMM yyyy")} · {workspace?.name}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-[#f5f6fa] p-5 dark:bg-[#0e1825]">

        {/* ── Stat cards row ── */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            icon={<><path d="M5 4h14v16H5z" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 9h8M8 13h5" strokeLinecap="round" /></>}
            label="Total notes"
            value={notes.length}
            trend={notesSpark[6] - notesSpark[5]}
            sparkData={notesSpark}
            sparkColor="#10b981"
          />
          <StatCard
            icon={<><path d="M12 21C12 21 5 13.5 5 8.5a7 7 0 0 1 14 0c0 5-7 12.5-7 12.5Z" strokeLinecap="round" /><circle cx="12" cy="8.5" r="2.5" /></>}
            label="Pinned notes"
            value={pinnedNotes}
            sub={`of ${notes.length} total`}
          />
          <StatCard
            icon={<><rect x="3" y="5" width="18" height="16" rx="2" strokeLinecap="round" /><path d="M16 3v4M8 3v4M3 9h18" strokeLinecap="round" /></>}
            label="Upcoming meetings"
            value={meetings.filter(m => new Date(m.end_time || m.start_time) >= now).length}
            trend={meetingsSpark[6] - meetingsSpark[5]}
            sparkData={meetingsSpark}
            sparkColor="#3b82f6"
          />
          <StatCard
            icon={<><path d="M17 20v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" /><circle cx="9" cy="7" r="4" /><path d="M23 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" /></>}
            label="Team members"
            value={members.length}
            sub={members.length === 1 ? 'just you' : `${members.filter(m => m.role === 'owner').length} owner`}
          />
          <StatCard
            icon={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" /></>}
            label="Today's meetings"
            value={todayMeetings.length}
            sub={todayMeetings.length === 0 ? 'nothing scheduled' : `next: ${format(new Date(todayMeetings[0].start_time), 'h:mm a')}`}
          />
        </div>

        {/* ── Main grid: schedule + right sidebar ── */}
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">

          {/* Left column */}
          <div className="space-y-4">

            {/* Today's schedule */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#1a2638]">
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
                <div>
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Upcoming Schedule</p>
                  <p className="text-[11px] text-zinc-400">{format(now, 'EEEE, d MMM')}</p>
                </div>
                <button onClick={() => onChangeView('meetings')} className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
                  View all →
                </button>
              </div>

              {upcomingMeetings.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-zinc-400">
                      <rect x="3" y="5" width="18" height="16" rx="2" strokeLinecap="round" /><path d="M16 3v4M8 3v4M3 9h18" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-sm text-zinc-500">No upcoming meetings</p>
                  <button onClick={() => onCreateMeeting()} className="mt-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                    Schedule one
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {upcomingMeetings.map(m => (
                    <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className={`h-8 w-1 shrink-0 rounded-full ${STATUS_BAR[m.status] || 'bg-blue-500'}`} />
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-800">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{format(new Date(m.start_time), 'MMM')}</span>
                        <span className="text-base font-black leading-tight text-zinc-900 dark:text-zinc-100">{format(new Date(m.start_time), 'd')}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{m.title}</p>
                        <p className="text-[11px] text-zinc-400">{meetingDateLabel(m)}</p>
                      </div>
                      {m.location && (
                        <a
                          href={/^https?:\/\//.test(m.location) ? m.location : `https://maps.google.com/?q=${encodeURIComponent(m.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-zinc-400 hover:text-emerald-500"
                          title={m.location}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                            <path d="M12 21C12 21 5 13.5 5 8.5a7 7 0 0 1 14 0c0 5-7 12.5-7 12.5Z" strokeLinecap="round" /><circle cx="12" cy="8.5" r="2.5" />
                          </svg>
                        </a>
                      )}
                      {(m.guest_emails?.length > 0) && (
                        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          {m.guest_emails.length} guest{m.guest_emails.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Notes */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#1a2638]">
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
                <div>
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Recent Notes</p>
                  <p className="text-[11px] text-zinc-400">Last updated across workspace</p>
                </div>
                <button onClick={() => onChangeView('notes')} className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
                  View all →
                </button>
              </div>

              {recentNotes.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-zinc-400">
                      <path d="M5 4h14v16H5z" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 9h8M8 13h5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-sm text-zinc-500">No notes yet</p>
                  <button onClick={onCreateNote} className="mt-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                    Create first note
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {recentNotes.map(note => (
                    <button
                      key={note.id}
                      onClick={() => onChangeView('notes')}
                      className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                        style={{ backgroundColor: note.color && note.color !== '#ffffff' ? note.color : '#6366f1' }}
                      >
                        {note.title?.[0]?.toUpperCase() || 'N'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{note.title || 'Untitled'}</p>
                          {note.is_pinned && (
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 shrink-0 text-amber-400">
                              <path d="M16 4v8l2 2H6l2-2V4h8zM12 20v-4M9 4h6" />
                            </svg>
                          )}
                          {note.is_private && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 shrink-0 text-zinc-400">
                              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" />
                            </svg>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-zinc-400">
                          {note.content ? note.content.slice(0, 60) + (note.content.length > 60 ? '…' : '') : 'No content'}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] text-zinc-400">
                        {format(new Date(note.updated_at), 'MMM d')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div className="space-y-4">

            {/* Quick Actions */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#1a2638]">
              <div className="border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Quick Actions</p>
              </div>
              <div className="p-2">
                <QuickAction
                  icon={<><path d="M5 4h14v16H5z" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 8v8M8 12h8" strokeLinecap="round" /></>}
                  label="New Note"
                  description="Start capturing ideas"
                  onClick={onCreateNote}
                  color="emerald"
                />
                <QuickAction
                  icon={<><rect x="3" y="5" width="18" height="16" rx="2" strokeLinecap="round" /><path d="M16 3v4M8 3v4M3 9h18M12 13v4M10 15h4" strokeLinecap="round" /></>}
                  label="New Meeting"
                  description="Schedule a meeting"
                  onClick={() => onCreateMeeting()}
                  color="blue"
                />
                <QuickAction
                  icon={<><path d="M17 20v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" strokeLinecap="round" /><line x1="22" y1="11" x2="16" y2="11" strokeLinecap="round" /></>}
                  label="Invite Member"
                  description="Grow your team"
                  onClick={() => onChangeView('team')}
                  color="violet"
                />
                <QuickAction
                  icon={<><path d="M13 2 3 14h8l-1 8 11-13h-8z" strokeLinecap="round" strokeLinejoin="round" /></>}
                  label="Power Tools"
                  description="Tasks, AI, templates"
                  onClick={() => onChangeView('power')}
                  color="amber"
                />
              </div>
            </div>

            {/* Team Members */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#1a2638]">
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Team</p>
                <button onClick={() => onChangeView('team')} className="text-[11px] font-semibold text-emerald-600 hover:underline dark:text-emerald-400">Manage</button>
              </div>
              {members.length === 0 ? (
                <p className="px-5 py-4 text-xs text-zinc-400">No members yet</p>
              ) : (
                <div className="divide-y divide-zinc-100 p-2 dark:divide-zinc-800">
                  {members.slice(0, 6).map(m => (
                    <div key={m.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${memberColor(m.id)}`}>
                        {(m.display_name?.[0] || m.email?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100">{m.display_name}</p>
                        <p className="truncate text-[10px] text-zinc-400">{m.email}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${m.role === 'owner' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                        {m.role}
                      </span>
                    </div>
                  ))}
                  {members.length > 6 && (
                    <p className="px-3 py-2 text-center text-[11px] text-zinc-400">+{members.length - 6} more</p>
                  )}
                </div>
              )}
            </div>

            {/* Workspace info */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#1a2638]">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-base font-black text-white shadow-sm">
                    {workspace?.name?.[0]?.toUpperCase() || 'W'}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">{workspace?.name}</p>
                    <p className="text-[11px] text-zinc-400">{workspace?.is_solo ? 'Personal workspace' : 'Team workspace'}</p>
                  </div>
                </div>
                {workspace?.description && (
                  <p className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{workspace.description}</p>
                )}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Notes', value: notes.length },
                    { label: 'Meetings', value: meetings.length },
                    { label: 'Members', value: members.length },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl bg-zinc-50 py-2 text-center dark:bg-zinc-800/60">
                      <p className="text-base font-black text-zinc-900 dark:text-zinc-100">{s.value}</p>
                      <p className="text-[10px] text-zinc-400">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
