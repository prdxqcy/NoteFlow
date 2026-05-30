import { useState } from 'react';
import { useTheme } from '../hooks/useTheme.jsx';

function CollapseIcon({ collapsed }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17l5-5-5-5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
    </svg>
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
  const [creating, setCreating] = useState(false);
  const navItems = [
    { id: 'notes', label: 'Notes', icon: '📝' },
    { id: 'meetings', label: 'Meetings', icon: '📅' },
    { id: 'team', label: 'Team', icon: '🤝' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];
  const themeItems = [
    { id: 'system', label: 'Auto', icon: '🖥️' },
    { id: 'light', label: 'Light', icon: '☀️' },
    { id: 'dark', label: 'Dark', icon: '🌙' },
  ];

  async function handleCreate(e) {
    e.preventDefault();
    if (!newWsName.trim()) return;
    await onCreateWorkspace(newWsName.trim());
    setNewWsName('');
    setCreating(false);
  }

  return (
    <aside
      className={`hidden h-screen flex-col border-r border-zinc-200 bg-white/90 py-4 backdrop-blur transition-[width] duration-200 dark:border-zinc-800 dark:bg-zinc-950/95 lg:flex ${
        collapsed ? 'w-24' : 'w-72'
      }`}
    >
      <div className="mb-6 px-4">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {collapsed ? (
            <button
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <CollapseIcon collapsed={collapsed} />
            </button>
          ) : (
            <>
              <div>
                <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">NoteFlow</span>
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700 dark:bg-zinc-800 dark:text-zinc-400">
                  Beta
                </span>
              </div>
              <button
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
                className="flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <CollapseIcon collapsed={collapsed} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 px-3">
        <div className={`mb-3 ${collapsed ? 'space-y-2' : 'flex rounded-2xl bg-zinc-100 p-1.5 dark:bg-zinc-900'}`}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              title={collapsed ? item.label : undefined}
              className={`transition-all ${
                collapsed
                  ? `flex w-full items-center justify-center rounded-2xl py-3 text-xl ${
                      view === item.id
                        ? 'bg-zinc-950 text-white dark:bg-zinc-700'
                        : 'bg-zinc-100 text-zinc-500 hover:text-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-300'
                    }`
                  : `flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold ${
                      view === item.id
                        ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white'
                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`
              }`}
            >
              <span className="leading-none">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </div>

      </div>

      {!collapsed && (
        <div className="px-3">
          <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-600">
            Workspaces
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            onClick={() => onSelectWorkspace(ws)}
            title={collapsed ? ws.name : undefined}
            className={`mb-1 flex w-full items-center rounded-md transition-colors ${
              collapsed
                ? `justify-center px-2 py-3 ${
                    activeWorkspace?.id === ws.id
                      ? 'bg-zinc-900 text-white dark:bg-zinc-800'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'
                  }`
                : `${
                    activeWorkspace?.id === ws.id
                      ? 'bg-zinc-900 text-white dark:bg-zinc-800'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'
                  } gap-2 px-2 py-2 text-left text-sm`
            }`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-200 text-xs font-bold uppercase text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
              {ws.name[0]}
            </span>
            {!collapsed && (
              <>
                <span className="truncate">{ws.name}</span>
                {!ws.is_solo && (
                  <span className="ml-auto shrink-0 text-xs text-zinc-500 dark:text-zinc-600">team</span>
                )}
              </>
            )}
          </button>
        ))}

        {collapsed ? (
          <button
            onClick={() => setCreating(true)}
            title="New workspace"
            className="mt-1 flex w-full items-center justify-center rounded-2xl bg-zinc-100 py-3 text-lg text-zinc-600 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            +
          </button>
        ) : creating ? (
          <form onSubmit={handleCreate} className="mt-2">
            <input
              autoFocus
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
              placeholder="Workspace name"
              className="w-full rounded-md bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none ring-1 ring-zinc-300 placeholder:text-zinc-400 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:placeholder:text-zinc-600"
            />
          </form>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-600 dark:hover:text-zinc-400"
          >
            <span className="text-lg leading-none">+</span> New workspace
          </button>
        )}
      </div>

      <div className="mt-4 border-t border-zinc-200 px-3 pt-3 dark:border-zinc-800">
        {collapsed ? (
          <div className="mb-3 space-y-2">
            {themeItems.map((option) => (
              <button
                key={option.id}
                onClick={() => setTheme(option.id)}
                title={option.label}
                className={`flex h-10 w-full items-center justify-center rounded-2xl text-lg ${
                  theme === option.id
                    ? 'bg-zinc-950 text-white dark:bg-zinc-700'
                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400'
                }`}
              >
                {option.icon}
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-3">
            <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
              {themeItems.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setTheme(option.id)}
                  title={option.label}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all ${
                    theme === option.id
                      ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <span className="text-sm leading-none">{option.icon}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold uppercase text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
            {user?.display_name?.[0]}
          </div>
          {!collapsed && (
            <>
              <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">{user?.display_name}</span>
              <button
                onClick={onLogout}
                aria-label="Log out"
                title="Log out"
                className="text-red-500 hover:text-red-600"
              >
                <LogoutIcon />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
