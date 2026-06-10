import { useState } from 'react';
import { useTheme } from '../hooks/useTheme.jsx';

const ICON_PATHS = {
  notes: ['M5 4h14v16H5z', 'M8 8h8M8 12h8M8 16h5'],
  meetings: ['M6 3v3M18 3v3M4 8h16', 'M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z'],
  team: ['M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 20v-2a4 4 0 0 0-3-3.87'],
  power: ['M13 2 3 14h8l-1 8 11-13h-8z'],
  settings: ['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.83 2.83-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-4v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06-2.83-2.83.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3v-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06 2.83-2.83.06.06A1.65 1.65 0 0 0 8.92 4a1.65 1.65 0 0 0 1-1.51V2h4v.49A1.65 1.65 0 0 0 15 4a1.65 1.65 0 0 0 1.82-.33l.06-.06 2.83 2.83-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21v4h-.09A1.65 1.65 0 0 0 19.4 15Z'],
};

function Icon({ paths, className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      {paths.map((path) => (
        <path key={path} d={path} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

function Chevron({ collapsed = false }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
    </svg>
  );
}

function LogoutIcon() {
  return <Icon paths={['M15 17l5-5-5-5', 'M20 12H9', 'M13 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6']} />;
}

function WorkspaceAvatar({ workspace, size = 'h-9 w-9' }) {
  const letter = workspace?.name?.replace(/^[^a-zA-Z]*/, '')[0]?.toUpperCase() || '#';
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xs font-bold text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300`}>
      {letter}
    </span>
  );
}

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
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const navItems = [
    { id: 'notes', label: 'Notes', paths: ICON_PATHS.notes },
    { id: 'meetings', label: 'Meetings', paths: ICON_PATHS.meetings },
    { id: 'team', label: 'Team', paths: ICON_PATHS.team },
    { id: 'power', label: 'Power tools', paths: ICON_PATHS.power },
    { id: 'settings', label: 'Settings', paths: ICON_PATHS.settings },
  ];

  async function handleCreate(e) {
    e.preventDefault();
    if (!newWsName.trim()) return;
    await onCreateWorkspace(newWsName.trim());
    setNewWsName('');
    setCreating(false);
    setWorkspaceOpen(false);
  }

  if (collapsed) {
    return (
      <aside className="hidden h-screen w-[76px] flex-col border-r border-zinc-200 bg-white py-4 dark:border-slate-700 dark:bg-[#111a2a] lg:flex">
        <button onClick={onToggleCollapse} aria-label="Expand sidebar" className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 font-bold text-white">
          C
        </button>
        <nav className="mt-8 flex flex-1 flex-col items-center gap-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              title={item.label}
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                view === item.id
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <Icon paths={item.paths} className="h-[18px] w-[18px]" />
            </button>
          ))}
        </nav>
        <button onClick={onToggleCollapse} aria-label="Expand sidebar" className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900">
          <Chevron collapsed />
        </button>
      </aside>
    );
  }

  return (
    <aside className="hidden h-screen w-[268px] shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-slate-700 dark:bg-[#111a2a] lg:flex">
      <div className="flex h-[64px] items-center gap-3 border-b border-zinc-200 px-5 dark:border-slate-700">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-base font-black text-white shadow-sm shadow-emerald-600/20">C</div>
        <div className="min-w-0">
          <p className="text-base font-bold tracking-tight text-zinc-950 dark:text-white">Cove</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">Workspace</p>
        </div>
      </div>

      <div className="relative border-b border-zinc-200 px-4 py-4 dark:border-slate-700">
        <button
          onClick={() => setWorkspaceOpen((open) => !open)}
          className="flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-[#1d293d]"
        >
          <WorkspaceAvatar workspace={activeWorkspace} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{activeWorkspace?.name || 'Choose workspace'}</p>
            <p className="text-xs text-zinc-400">{activeWorkspace?.is_solo ? 'Personal workspace' : 'Team workspace'}</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-4 w-4 text-zinc-400 transition-transform ${workspaceOpen ? 'rotate-180' : ''}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
          </svg>
        </button>

        {workspaceOpen && (
          <div className="absolute left-3 right-3 top-[76px] z-30 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl shadow-zinc-300/30 dark:border-slate-600 dark:bg-[#202c40] dark:shadow-black/20">
            <div className="max-h-52 overflow-y-auto">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => {
                    onSelectWorkspace(workspace);
                    setWorkspaceOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm ${
                    activeWorkspace?.id === workspace.id
                      ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-200'
                      : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                >
                  <WorkspaceAvatar workspace={workspace} size="h-7 w-7" />
                  <span className="truncate">{workspace.name}</span>
                </button>
              ))}
            </div>
            {creating ? (
              <form onSubmit={handleCreate} className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                <input
                  autoFocus
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
                  placeholder="Workspace name"
                  className="w-full rounded-xl bg-zinc-50 px-3 py-2 text-sm outline-none ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-700"
                />
              </form>
            ) : (
              <button onClick={() => setCreating(true)} className="mt-2 w-full border-t border-zinc-100 px-2 pt-3 text-left text-sm font-medium text-emerald-600 dark:border-zinc-800 dark:text-emerald-400">
                + New workspace
              </button>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Navigation</p>
        <div className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                view === item.id
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                  : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <Icon paths={item.paths} className="h-[18px] w-[18px]" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="border-t border-zinc-200 px-3 py-3 dark:border-slate-700">
        <div className="mb-2 grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-[#1d293d]">
          {['system', 'light', 'dark'].map((option) => (
            <button
              key={option}
              onClick={() => setTheme(option)}
              className={`rounded-lg py-1.5 text-[11px] font-medium capitalize ${
                theme === option ? 'bg-white text-zinc-900 shadow-sm dark:bg-[#344158] dark:text-white' : 'text-zinc-400'
              }`}
            >
              {option === 'system' ? 'Auto' : option}
            </button>
          ))}
        </div>
        <div className="mb-2 flex items-center gap-3 border-y border-zinc-100 px-2 py-3 dark:border-slate-700">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#101827] text-xs font-bold uppercase text-white">
            {user?.display_name?.[0] || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#101827] dark:text-zinc-100">{user?.display_name}</p>
            <p className="truncate text-xs text-zinc-400">{user?.email}</p>
          </div>
          <button onClick={onLogout} aria-label="Log out" title="Log out" className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10">
            <LogoutIcon />
          </button>
        </div>
        <button onClick={onToggleCollapse} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200">
          <Chevron />
          <span>Collapse sidebar</span>
        </button>
      </div>
    </aside>
  );
}
