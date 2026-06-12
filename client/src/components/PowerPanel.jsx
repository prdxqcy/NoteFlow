import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import RemindersTab from './RemindersTab';

const TABS = [
  { id: 'Tasks',      icon: <><rect x="3" y="5" width="6" height="6" rx="1" /><rect x="3" y="13" width="6" height="6" rx="1" /><path d="M13 6h8M13 10h5M13 14h8M13 18h5" strokeLinecap="round" /></> },
  { id: 'Search',     icon: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" strokeLinecap="round" /></> },
  { id: 'Templates',  icon: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h5" strokeLinecap="round" /></> },
  { id: 'Collaborate',icon: <><path d="M17 20v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" /><circle cx="9" cy="7" r="4" /><path d="M23 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" /></> },
  { id: 'AI',         icon: <><path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4Z" strokeLinecap="round" /></> },
  { id: 'Activity',   icon: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round" /></> },
  { id: 'Inbox',      icon: <><path d="M22 12h-6l-2 3H10l-2-3H2" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" strokeLinecap="round" /></> },
  { id: 'Reminders',  icon: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" /><path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" /></> },
];

const PRIORITY_STYLES = {
  low:    { badge: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400', dot: 'bg-zinc-400' },
  medium: { badge: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-400' },
  high:   { badge: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
};

const COLUMN_STYLES = {
  todo:  { bar: 'bg-zinc-300 dark:bg-zinc-600',    header: 'text-zinc-500 dark:text-zinc-400',   badge: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' },
  doing: { bar: 'bg-amber-400',                     header: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  done:  { bar: 'bg-emerald-500',                   header: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

const inputCls = 'w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:focus:border-emerald-600 dark:focus:ring-emerald-900/30';
const selectCls = 'rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-700 outline-none transition focus:border-emerald-400 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300';

function SectionCard({ children, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#1a2638] ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div className="border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{children}</p>
    </div>
  );
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-zinc-400">{icon}</svg>
      </div>
      <p className="text-sm font-medium text-zinc-500">{title}</p>
      {subtitle && <p className="text-xs text-zinc-400">{subtitle}</p>}
    </div>
  );
}

export default function PowerPanel({ workspace, notes, members, onNoteCreated, onNoteRestored }) {
  const [tab, setTab] = useState('Tasks');
  const [data, setData] = useState({ tasks: [], templates: [], activity: [], notifications: [] });
  const [selectedNoteId, setSelectedNoteId] = useState(notes[0]?.id || '');
  const [details, setDetails] = useState({ comments: [], versions: [], shares: [] });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [text, setText] = useState('');
  const [answer, setAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDue, setTaskDue] = useState('');

  const selectedNote = useMemo(() => notes.find((n) => n.id === selectedNoteId), [notes, selectedNoteId]);

  async function refresh() {
    if (!workspace) return;
    setData(await api.getPowerOverview(workspace.id));
  }

  async function refreshDetails(noteId = selectedNoteId) {
    if (!noteId) return;
    setDetails(await api.getNoteDetails(noteId));
  }

  useEffect(() => { refresh(); }, [workspace?.id]);
  useEffect(() => { if (selectedNoteId) refreshDetails(selectedNoteId); }, [selectedNoteId]);

  async function addTask(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await api.createTask({ workspace_id: workspace.id, title: text.trim(), note_id: selectedNoteId || null, priority: taskPriority, assigned_to: taskAssignee || null, due_at: taskDue || null });
    setText('');
    refresh();
  }

  async function addTemplate() {
    if (!selectedNote) return;
    const name = window.prompt('Template name', selectedNote.title);
    if (!name) return;
    await api.createTemplate({ workspace_id: workspace.id, name, title: selectedNote.title, content: selectedNote.content });
    refresh();
  }

  async function comment(e) {
    e.preventDefault();
    if (!text.trim() || !selectedNoteId) return;
    await api.addComment(selectedNoteId, text.trim());
    setText('');
    refreshDetails();
  }

  async function share() {
    const password = window.prompt('Optional share password (leave blank for none)', '') || '';
    const days = Number(window.prompt('Expire after how many days? Leave blank for no expiry', '') || 0);
    const expires_at = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
    const s = await api.shareNote(selectedNoteId, { password, expires_at });
    await navigator.clipboard?.writeText(`${window.location.origin}/share/${s.token}`);
    refreshDetails();
  }

  async function askAi(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setAiLoading(true);
    setAnswer('');
    try {
      const result = await api.aiWorkspaceInsights(workspace.id, text.trim());
      setAnswer(result.answer);
    } catch (err) {
      setAnswer(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function extractTasks() {
    if (!selectedNote) return;
    const result = await api.aiExtractTasks(`${selectedNote.title}\n${selectedNote.content}`);
    for (const task of result.tasks || []) {
      await api.createTask({ workspace_id: workspace.id, note_id: selectedNote.id, ...task });
    }
    setTab('Tasks');
    refresh();
  }

  const unreadCount = data.notifications.filter((n) => !n.read_at).length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-[#111a2a]">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/30">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-violet-600 dark:text-violet-400">
              <path d="M13 2 3 14h8l-1 8 11-13h-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Power Tools</h2>
            <p className="text-xs text-zinc-400">Turn workspace knowledge into action</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {TABS.map(({ id, icon }) => {
            const isActive = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0">{icon}</svg>
                {id}
                {id === 'Inbox' && unreadCount > 0 && (
                  <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${isActive ? 'bg-white text-emerald-700' : 'bg-emerald-500 text-white'}`}>
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-[#f5f6fa] p-5 dark:bg-[#0e1825]">

        {/* ── TASKS ── */}
        {tab === 'Tasks' && (
          <div className="space-y-4">
            <SectionCard>
              <div className="p-4">
                <form onSubmit={addTask}>
                  <div className="mb-3">
                    <input
                      className={inputCls}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="What needs to be done?"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select className={selectCls} value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}>
                      <option value="low">🟢 Low</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="high">🔴 High</option>
                    </select>
                    <select className={selectCls} value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}>
                      <option value="">👤 Unassigned</option>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
                    </select>
                    <input
                      className={selectCls}
                      type="datetime-local"
                      value={taskDue}
                      onChange={(e) => setTaskDue(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="ml-auto flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
                      Add task
                    </button>
                  </div>
                </form>
              </div>
            </SectionCard>

            <div className="grid gap-4 lg:grid-cols-3">
              {['todo', 'doing', 'done'].map((status) => {
                const col = COLUMN_STYLES[status];
                const columnTasks = data.tasks.filter((t) => t.status === status);
                return (
                  <div key={status} className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#1a2638]">
                    <div className={`h-1 w-full ${col.bar}`} />
                    <div className="flex items-center justify-between px-4 py-3">
                      <h3 className={`text-xs font-bold uppercase tracking-widest ${col.header}`}>
                        {status === 'todo' ? 'To Do' : status.charAt(0).toUpperCase() + status.slice(1)}
                      </h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${col.badge}`}>{columnTasks.length}</span>
                    </div>

                    <div className="space-y-2 px-3 pb-3">
                      {columnTasks.length === 0 ? (
                        <p className="py-4 text-center text-xs text-zinc-400">No tasks</p>
                      ) : (
                        columnTasks.map((task) => {
                          const pr = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
                          return (
                            <div key={task.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
                              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{task.title}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${pr.badge}`}>
                                  {task.priority}
                                </span>
                                {task.assignee_name && (
                                  <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" /></svg>
                                    {task.assignee_name}
                                  </span>
                                )}
                                {task.due_at && (
                                  <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><rect x="3" y="5" width="18" height="16" rx="2" strokeLinecap="round" /><path d="M16 3v4M8 3v4M3 9h18" strokeLinecap="round" /></svg>
                                    {new Date(task.due_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2.5 flex items-center justify-between border-t border-zinc-100 pt-2.5 dark:border-zinc-700">
                                <select
                                  value={task.status}
                                  onChange={async (e) => { await api.updateTask(task.id, { status: e.target.value }); refresh(); }}
                                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 outline-none focus:border-emerald-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                >
                                  <option value="todo">To Do</option>
                                  <option value="doing">Doing</option>
                                  <option value="done">Done</option>
                                </select>
                                <button
                                  onClick={async () => { await api.deleteTask(task.id); refresh(); }}
                                  className="rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M7.5 7l.7 11.1A2 2 0 0 0 10.2 20h3.6a2 2 0 0 0 2-1.9L16.5 7" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SEARCH ── */}
        {tab === 'Search' && (
          <div className="space-y-4">
            <SectionCard>
              <div className="p-4">
                <form onSubmit={async (e) => { e.preventDefault(); setResults(await api.powerSearch(workspace.id, query)); }} className="flex gap-2">
                  <input className={inputCls} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes, merged sections, screenshot context…" />
                  <button type="submit" className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" strokeLinecap="round" /></svg>
                    Search
                  </button>
                </form>
              </div>
            </SectionCard>

            {results.length === 0 ? (
              <EmptyState
                icon={<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" strokeLinecap="round" /></>}
                title="Search your workspace"
                subtitle="Results will appear here"
              />
            ) : (
              <div className="space-y-2.5">
                {results.map((note) => (
                  <SectionCard key={note.id}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{note.title}</h3>
                        {note.has_screenshot && (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">Screenshot</span>
                        )}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{note.content}</p>
                    </div>
                  </SectionCard>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TEMPLATES ── */}
        {tab === 'Templates' && (
          <div className="space-y-4">
            <SectionCard>
              <div className="flex items-center justify-between p-4">
                <div>
                  <select className={selectCls} value={selectedNoteId} onChange={(e) => setSelectedNoteId(e.target.value)}>
                    <option value="">Choose a note…</option>
                    {notes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
                  </select>
                </div>
                <button
                  onClick={addTemplate}
                  disabled={!selectedNote}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
                  Save as template
                </button>
              </div>
            </SectionCard>

            {data.templates.length === 0 ? (
              <EmptyState
                icon={<><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h5" strokeLinecap="round" /></>}
                title="No templates yet"
                subtitle="Save a note as a template to reuse it"
              />
            ) : (
              <div className="space-y-2.5">
                {data.templates.map((tmpl) => (
                  <SectionCard key={tmpl.id}>
                    <div className="flex items-center gap-4 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/30">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-violet-600 dark:text-violet-400">
                          <rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h5" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{tmpl.name}</p>
                        <p className="text-xs text-zinc-400">{tmpl.title}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => { const note = await api.useTemplate(tmpl.id); onNoteCreated(note); }}
                          className="rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                        >
                          Use
                        </button>
                        <button
                          onClick={async () => { await api.deleteTemplate(tmpl.id); refresh(); }}
                          className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:border-zinc-700 dark:hover:bg-red-900/20"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </SectionCard>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── COLLABORATE ── */}
        {tab === 'Collaborate' && (
          <div className="space-y-4">
            <SectionCard>
              <div className="p-4">
                <select className={selectCls + ' w-full'} value={selectedNoteId} onChange={(e) => setSelectedNoteId(e.target.value)}>
                  <option value="">Choose a note…</option>
                  {notes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
                </select>
              </div>
            </SectionCard>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Comments */}
              <SectionCard>
                <SectionHeader>Comments & Mentions</SectionHeader>
                <div className="p-4">
                  <form onSubmit={comment} className="flex gap-2 mb-4">
                    <input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder="Comment, use @email to mention…" />
                    <button type="submit" className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Send</button>
                  </form>
                  <div className="space-y-2.5">
                    {details.comments.length === 0 ? (
                      <p className="text-center text-xs text-zinc-400 py-4">No comments yet</p>
                    ) : details.comments.map((item) => (
                      <div key={item.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
                        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{item.display_name}</p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{item.body}</p>
                        <button
                          onClick={async () => { await api.resolveComment(item.id, !item.resolved_at); refreshDetails(); }}
                          className={`mt-1.5 text-[11px] font-medium ${item.resolved_at ? 'text-zinc-400 hover:text-zinc-600' : 'text-emerald-600 hover:text-emerald-700'}`}
                        >
                          {item.resolved_at ? 'Reopen' : '✓ Resolve'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>

              {/* Versions & Sharing */}
              <SectionCard>
                <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Versions & Sharing</p>
                  <button
                    onClick={share}
                    disabled={!selectedNoteId}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" strokeLinecap="round" /><polyline points="16 6 12 2 8 6" strokeLinecap="round" strokeLinejoin="round" /><line x1="12" y1="2" x2="12" y2="15" strokeLinecap="round" /></svg>
                    Share
                  </button>
                </div>
                <div className="space-y-2.5 p-4">
                  {details.versions.length === 0 && details.shares.length === 0 ? (
                    <p className="text-center text-xs text-zinc-400 py-4">No versions or shares</p>
                  ) : null}
                  {details.versions.map((v) => (
                    <div key={v.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
                      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{new Date(v.created_at).toLocaleString()}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{v.content}</p>
                      <button
                        onClick={async () => { const note = await api.restoreVersion(selectedNoteId, v.id); onNoteRestored(note); }}
                        className="mt-1.5 text-[11px] font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        ↩ Restore
                      </button>
                    </div>
                  ))}
                  {details.shares.map((s) => (
                    <div key={s.token} className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
                      <p className="min-w-0 flex-1 break-all text-xs text-zinc-500">{window.location.origin}/share/{s.token}</p>
                      <button
                        onClick={async () => { await api.revokeShare(s.token); refreshDetails(); }}
                        className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* ── AI ── */}
        {tab === 'AI' && (
          <div className="mx-auto max-w-2xl space-y-4">
            <SectionCard>
              <div className="h-1 w-full bg-gradient-to-r from-violet-500 to-pink-400" />
              <div className="p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/30">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-violet-600">
                      <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4Z" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Workspace AI</p>
                    <p className="text-xs text-zinc-400">Ask anything about your workspace</p>
                  </div>
                </div>

                <div className="mb-4 flex gap-2">
                  <select className={selectCls + ' flex-1'} value={selectedNoteId} onChange={(e) => setSelectedNoteId(e.target.value)}>
                    <option value="">Choose note for task extraction…</option>
                    {notes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
                  </select>
                  <button
                    onClick={extractTasks}
                    disabled={!selectedNote}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path strokeLinecap="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6M9 12l2 2 4-4" strokeLinejoin="round" /></svg>
                    Extract tasks
                  </button>
                </div>

                <form onSubmit={askAi} className="space-y-3">
                  <textarea
                    className={inputCls + ' resize-none'}
                    rows={4}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="e.g. What are the main action items across all notes?"
                  />
                  <button
                    type="submit"
                    disabled={aiLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {aiLoading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeOpacity=".25" /><path d="M12 3a9 9 0 0 1 9 9" strokeLinecap="round" /></svg>
                        Thinking…
                      </>
                    ) : (
                      <>✦ Ask workspace AI</>
                    )}
                  </button>
                </form>
              </div>
            </SectionCard>

            {answer && (
              <SectionCard>
                <div className="p-5">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Answer</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{answer}</p>
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {/* ── ACTIVITY ── */}
        {tab === 'Activity' && (
          <div className="space-y-2.5">
            {data.activity.length === 0 ? (
              <EmptyState
                icon={<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round" />}
                title="No activity yet"
                subtitle="Actions in this workspace will appear here"
              />
            ) : data.activity.map((item) => (
              <SectionCard key={item.id}>
                <div className="flex items-start gap-3 p-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {(item.display_name || 'S')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      <span className="font-semibold">{item.display_name || 'System'}</span>
                      {' '}{item.action} {item.entity_type}
                    </p>
                    <time className="text-xs text-zinc-400">{new Date(item.created_at).toLocaleString()}</time>
                  </div>
                </div>
              </SectionCard>
            ))}
          </div>
        )}

        {/* ── INBOX ── */}
        {tab === 'Inbox' && (
          <div className="space-y-2.5">
            {data.notifications.length === 0 ? (
              <EmptyState
                icon={<><path d="M22 12h-6l-2 3H10l-2-3H2" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" strokeLinecap="round" /></>}
                title="Inbox is empty"
                subtitle="Notifications will appear here"
              />
            ) : data.notifications.map((item) => (
              <button
                key={item.id}
                onClick={async () => { await api.readNotification(item.id); refresh(); }}
                className={`group flex w-full items-start gap-3 rounded-2xl border p-4 text-left shadow-sm transition-all ${
                  item.read_at
                    ? 'border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-[#1a2638]'
                    : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-900/20'
                }`}
              >
                <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${item.read_at ? 'bg-zinc-300 dark:bg-zinc-600' : 'bg-emerald-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${item.read_at ? 'text-zinc-500' : 'font-medium text-zinc-900 dark:text-zinc-100'}`}>{item.message}</p>
                  <time className="text-xs text-zinc-400">{new Date(item.created_at).toLocaleString()}</time>
                </div>
              </button>
            ))}
          </div>
        )}

        {tab === 'Reminders' && <RemindersTab />}
      </div>
    </div>
  );
}
