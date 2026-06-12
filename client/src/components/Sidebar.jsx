import React, { useState } from 'react';
import { useTheme } from '../hooks/useTheme.jsx';

const ICON_PATHS = {
  notes: ['M5 4h14v16H5z', 'M8 8h8M8 12h8M8 16h5'],
  meetings: ['M6 3v3M18 3v3M4 8h16', 'M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z'],
  team: ['M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 20v-2a4 4 0 0 0-3-3.87'],
  power: ['M13 2 3 14h8l-1 8 11-13h-8z'],
  settings: ['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.83 2.83-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-4v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06-2.83-2.83.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3v-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06 2.83-2.83.06.06A1.65 1.65 0 0 0 8.92 4a1.65 1.65 0 0 0 1-1.51V2h4v.49A1.65 1.65 0 0 0 15 4a1.65 1.65 0 0 0 1.82-.33l.06-.06 2.83 2.83-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21v4h-.09A1.65 1.65 0 0 0 19.4 15Z'],
};

function Icon({ paths, className = 'h-[18px] w-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      {paths.map((d) => <path key={d} d={d} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-3.5 w-3.5 text-zinc-400">
      <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
    </svg>
  );
}

function Avatar({ name, size = 'h-8 w-8', textSize = 'text-xs', light = false }) {
  const letter = (name || '?').replace(/^[^a-zA-Z]*/, '')[0]?.toUpperCase() || '?';
  const colors = light
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
    : 'bg-emerald-600 text-white';
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-full ${colors} ${textSize} font-semibold`}>
      {letter}
    </span>
  );
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative px-3 pb-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-zinc-50 dark:hover:bg-[#1d293d]"
      >
        <Avatar name={user?.display_name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{user?.display_name}</p>
          <p className="truncate text-[11px] text-zinc-400">{user?.email}</p>
        </div>
        <Chevron />
      </button>
      {open && (
        <div className="absolute left-3 right-3 top-full z-50 mt-1 overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-lg dark:border-slate-700 dark:bg-[#1e2c3d]">
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12V7a2 2 0 0 1 2-2h6" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const navItems = [
  { id: 'home', label: 'Home', paths: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'] },
  { id: 'notes', label: 'Notes', paths: ICON_PATHS.notes },
  { id: 'meetings', label: 'Meetings', paths: ICON_PATHS.meetings },
  { id: 'team', label: 'Team', paths: ICON_PATHS.team },
  { id: 'power', label: 'Power tools', paths: ICON_PATHS.power },
];

export default function Sidebar({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  onCreateWorkspace,
  view,
  onChangeView,
  user,
  onLogout,
  collapsed,
  onToggleCollapse,
}) {
  const { theme, setTheme } = useTheme();
  const [newWsName, setNewWsName] = useState('');
  const [wsOpen, setWsOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newWsName.trim()) return;
    await onCreateWorkspace(newWsName.trim());
    setNewWsName('');
    setCreating(false);
    setWsOpen(false);
  }

  if (collapsed) {
    return (
      <aside className="hidden h-screen w-[64px] flex-col items-center border-r border-zinc-100 bg-white py-4 gap-1 dark:border-slate-700 dark:bg-[#111a2a] lg:flex">
        <img src="/cove-logo.svg" alt="Cove" className="mb-4 h-9 w-9" />
        {[...navItems, { id: 'settings', label: 'Settings', paths: ICON_PATHS.settings }].map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            title={item.label}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
              view === item.id ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:hover:bg-zinc-900'
            }`}
          >
            <Icon paths={item.paths} />
          </button>
        ))}
        <div className="mt-auto">
          <button onClick={onToggleCollapse} title="Expand" className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900">
            <ExpandIcon />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden h-screen w-[200px] shrink-0 flex-col border-r border-zinc-100 bg-white dark:border-slate-700 dark:bg-[#111a2a] lg:flex">

      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5">
        <img src="/cove-logo.svg" alt="Cove" className="h-8 w-8" />
        <span className="text-[17px] font-black tracking-tight text-zinc-900 dark:text-white" style={{ fontFamily: "'Nunito', sans-serif" }}>Cove</span>
      </div>

      {/* User */}
      <UserMenu user={user} onLogout={onLogout} />

      {/* Workspace */}
      <div className="relative px-3 pb-4">
        <button
          onClick={() => setWsOpen((o) => !o)}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-zinc-50 dark:hover:bg-[#1d293d]"
        >
          <Avatar name={activeWorkspace?.name} light />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{activeWorkspace?.name || 'Workspace'}</p>
            <p className="text-[11px] text-zinc-400">{activeWorkspace?.is_solo ? 'Personal' : 'Team'}</p>
          </div>
          <Chevron />
        </button>

        {wsOpen && (
          <div className="absolute left-3 right-3 top-[52px] z-30 rounded-2xl border border-zinc-100 bg-white p-2 shadow-xl shadow-zinc-200/50 dark:border-slate-600 dark:bg-[#202c40]">
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => { onSelectWorkspace(ws); setWsOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[13px] ${
                    activeWorkspace?.id === ws.id
                      ? 'bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-slate-700'
                  }`}
                >
                  <Avatar name={ws.name} size="h-6 w-6" textSize="text-[10px]" light />
                  <span className="truncate">{ws.name}</span>
                </button>
              ))}
            </div>
            {creating ? (
              <form onSubmit={handleCreate} className="mt-1 border-t border-zinc-100 pt-2 dark:border-zinc-700">
                <input
                  autoFocus
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
                  placeholder="Workspace name"
                  className="w-full rounded-xl bg-zinc-50 px-3 py-1.5 text-[13px] outline-none ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700 dark:text-zinc-100"
                />
              </form>
            ) : (
              <button onClick={() => setCreating(true)} className="mt-1 w-full border-t border-zinc-100 px-2 pt-2 text-left text-[13px] font-medium text-emerald-600 dark:border-zinc-700 dark:text-emerald-400">
                + New workspace
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Navigation</p>
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-[13px] font-medium transition-colors ${
                view === item.id
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-[#1d293d] dark:hover:text-zinc-100'
              }`}
            >
              <Icon paths={item.paths} />
              {item.label}
            </button>
          ))}
        </div>

        <p className="mb-1 mt-5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Preferences</p>
        <button
          onClick={() => onChangeView('settings')}
          className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-[13px] font-medium transition-colors ${
            view === 'settings'
              ? 'bg-emerald-600 text-white'
              : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-[#1d293d] dark:hover:text-zinc-100'
          }`}
        >
          <Icon paths={ICON_PATHS.settings} />
          Settings
        </button>
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 pt-3">
        <div className="mb-2 flex items-center justify-center gap-0.5 rounded-xl bg-zinc-100 p-1 dark:bg-[#1d293d]">
          {[{ id: 'system', emoji: '💻' }, { id: 'light', emoji: '☀️' }, { id: 'dark', emoji: '🌙' }].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              className={`flex h-7 flex-1 items-center justify-center rounded-lg text-sm transition-colors ${
                theme === opt.id
                  ? 'bg-white shadow-sm dark:bg-[#344158]'
                  : 'text-zinc-400 hover:bg-white/60 dark:hover:bg-[#344158]'
              }`}
            >
              {opt.emoji}
            </button>
          ))}
        </div>
        <button
          onClick={onToggleCollapse}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 dark:hover:bg-[#1d293d]"
        >
          <CollapseIcon />
          Collapse sidebar
        </button>
      </div>
    </aside>
  );
}
