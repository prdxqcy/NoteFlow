import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

const tabs = ['Tasks', 'Search', 'Templates', 'Collaborate', 'AI', 'Activity', 'Inbox'];
const field = 'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-[#202c40]';
const button = 'rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50';

export default function PowerPanel({ workspace, notes, members, onNoteCreated, onNoteRestored }) {
  const [tab, setTab] = useState('Tasks');
  const [data, setData] = useState({ tasks: [], templates: [], activity: [], notifications: [] });
  const [selectedNoteId, setSelectedNoteId] = useState(notes[0]?.id || '');
  const [details, setDetails] = useState({ comments: [], versions: [], shares: [] });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [text, setText] = useState('');
  const [answer, setAnswer] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const selectedNote = useMemo(() => notes.find((note) => note.id === selectedNoteId), [notes, selectedNoteId]);

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
    const share = await api.shareNote(selectedNoteId, { password, expires_at });
    await navigator.clipboard?.writeText(`${window.location.origin}/share/${share.token}`);
    refreshDetails();
  }

  async function askAi(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setAnswer('Thinking...');
    try {
      const result = await api.aiWorkspaceInsights(workspace.id, text.trim());
      setAnswer(result.answer);
    } catch (error) {
      setAnswer(error.message);
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-zinc-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-[#182235]">
        <h2 className="text-lg font-semibold">Power tools</h2>
        <p className="text-sm text-zinc-500">Turn workspace knowledge into action.</p>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((item) => (
            <button key={item} onClick={() => setTab(item)} className={`rounded-xl px-3 py-2 text-sm font-medium ${tab === item ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-slate-700 dark:text-zinc-200'}`}>{item}</button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {['Templates', 'Collaborate'].includes(tab) && (
          <select className={`${field} mb-4`} value={selectedNoteId} onChange={(e) => setSelectedNoteId(e.target.value)}>
            <option value="">Choose a note</option>
            {notes.map((note) => <option key={note.id} value={note.id}>{note.title}</option>)}
          </select>
        )}

        {tab === 'Tasks' && (
          <div className="space-y-4">
            <form onSubmit={addTask} className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]"><input className={field} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a task..." /><select className={field} value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><select className={field} value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select><input className={field} type="datetime-local" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} /><button className={button}>Add task</button></form>
            <div className="grid gap-3 lg:grid-cols-3">
              {['todo', 'doing', 'done'].map((status) => <section key={status} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-slate-600 dark:bg-[#202c40]"><h3 className="mb-3 font-semibold capitalize">{status}</h3>{data.tasks.filter((task) => task.status === status).map((task) => <article key={task.id} className="mb-2 rounded-xl bg-zinc-50 p-3 dark:bg-slate-700"><p className="text-sm font-medium">{task.title}</p><p className="text-xs text-zinc-500">{task.assignee_name || 'Unassigned'} · {task.priority}{task.due_at ? ` · ${new Date(task.due_at).toLocaleDateString()}` : ''}</p><div className="mt-2 flex justify-between"><select className="rounded-lg bg-transparent text-xs" value={task.status} onChange={async (e) => { await api.updateTask(task.id, { status: e.target.value }); refresh(); }}><option value="todo">To do</option><option value="doing">Doing</option><option value="done">Done</option></select><button className="text-xs text-red-500" onClick={async () => { await api.deleteTask(task.id); refresh(); }}>Delete</button></div></article>)}</section>)}
            </div>
          </div>
        )}

        {tab === 'Search' && <div className="space-y-4"><form onSubmit={async (e) => { e.preventDefault(); setResults(await api.powerSearch(workspace.id, query)); }} className="flex gap-2"><input className={field} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes, merged sections, screenshot context..." /><button className={button}>Search</button></form>{results.map((note) => <article key={note.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-slate-600 dark:bg-[#202c40]"><h3 className="font-semibold">{note.title}</h3><p className="mt-1 line-clamp-2 text-sm text-zinc-500">{note.content}</p>{note.has_screenshot && <span className="mt-2 inline-block text-xs text-emerald-600">Has screenshot</span>}</article>)}</div>}

        {tab === 'Templates' && <div className="space-y-4"><button className={button} onClick={addTemplate} disabled={!selectedNote}>Save selected note as template</button>{data.templates.map((template) => <article key={template.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 dark:border-slate-600 dark:bg-[#202c40]"><div><h3 className="font-semibold">{template.name}</h3><p className="text-sm text-zinc-500">{template.title}</p></div><div className="flex gap-2"><button className={button} onClick={async () => { const note = await api.useTemplate(template.id); onNoteCreated(note); }}>Use</button><button className="text-sm text-red-500" onClick={async () => { await api.deleteTemplate(template.id); refresh(); }}>Delete</button></div></article>)}</div>}

        {tab === 'Collaborate' && <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-slate-600 dark:bg-[#202c40]"><h3 className="font-semibold">Comments and mentions</h3><form onSubmit={comment} className="mt-3 flex gap-2"><input className={field} value={text} onChange={(e) => setText(e.target.value)} placeholder="Comment, use @email to mention..." /><button className={button}>Send</button></form>{details.comments.map((item) => <article key={item.id} className="mt-3 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-slate-700"><strong>{item.display_name}</strong><p>{item.body}</p><button className="mt-1 text-xs text-emerald-600" onClick={async () => { await api.resolveComment(item.id, !item.resolved_at); refreshDetails(); }}>{item.resolved_at ? 'Reopen' : 'Resolve'}</button></article>)}</section><section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-slate-600 dark:bg-[#202c40]"><div className="flex justify-between"><h3 className="font-semibold">Versions and sharing</h3><button className={button} onClick={share} disabled={!selectedNoteId}>Share</button></div>{details.versions.map((version) => <article key={version.id} className="mt-3 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-slate-700"><strong>{new Date(version.created_at).toLocaleString()}</strong><p className="line-clamp-2 text-zinc-500">{version.content}</p><button className="mt-1 text-xs text-emerald-600" onClick={async () => { const note = await api.restoreVersion(selectedNoteId, version.id); onNoteRestored(note); }}>Restore</button></article>)}{details.shares.map((shareItem) => <div key={shareItem.token} className="mt-3 flex items-center gap-2"><p className="min-w-0 flex-1 break-all text-xs text-zinc-500">{window.location.origin}/share/{shareItem.token}</p><button className="text-xs text-red-500" onClick={async () => { await api.revokeShare(shareItem.token); refreshDetails(); }}>Revoke</button></div>)}</section></div>}

        {tab === 'AI' && <div className="mx-auto max-w-3xl"><div className="mb-4 flex gap-2"><select className={field} value={selectedNoteId} onChange={(e) => setSelectedNoteId(e.target.value)}><option value="">Choose note for task extraction</option>{notes.map((note) => <option key={note.id} value={note.id}>{note.title}</option>)}</select><button className={button} onClick={extractTasks} disabled={!selectedNote}>Extract tasks</button></div><form onSubmit={askAi} className="space-y-3"><textarea className={field} rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask anything about this workspace..." /><button className={button}>Ask workspace AI</button></form>{answer && <div className="mt-5 whitespace-pre-wrap rounded-2xl border border-emerald-200 bg-white p-5 text-sm dark:border-emerald-800 dark:bg-[#202c40]">{answer}</div>}</div>}
        {tab === 'Activity' && <div className="space-y-2">{data.activity.map((item) => <article key={item.id} className="rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-slate-600 dark:bg-[#202c40]"><strong>{item.display_name || 'System'}</strong> {item.action} {item.entity_type}<time className="ml-2 text-xs text-zinc-500">{new Date(item.created_at).toLocaleString()}</time></article>)}</div>}
        {tab === 'Inbox' && <div className="space-y-2">{data.notifications.map((item) => <button key={item.id} onClick={async () => { await api.readNotification(item.id); refresh(); }} className={`block w-full rounded-xl border p-3 text-left text-sm ${item.read_at ? 'border-zinc-200 bg-white text-zinc-500' : 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30'}`}>{item.message}<time className="ml-2 text-xs text-zinc-500">{new Date(item.created_at).toLocaleString()}</time></button>)}</div>}
      </div>
    </div>
  );
}
