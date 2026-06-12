import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from '../hooks/useAuth.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import { useReminders } from '../hooks/useReminders';
import RemindersModal from '../components/RemindersModal';
import Sidebar from '../components/Sidebar';
import NotesList from '../components/NotesList';
import MeetingsList from '../components/MeetingsList';
import TeamPanel from '../components/TeamPanel';
import SettingsPanel from '../components/SettingsPanel';
import PowerPanel from '../components/PowerPanel';
import HomeDashboard from '../components/HomeDashboard';

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4 text-zinc-400">
      <circle cx="12" cy="12" r="9" strokeLinecap="round" />
      <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReminderCard() {
  const { reminders } = useReminders();
  const [open, setOpen] = useState(false);

  const upcoming = reminders.filter((r) => !r.fired).sort((a, b) => new Date(a.time) - new Date(b.time));
  const next = upcoming[0];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-1 flex-col px-6 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-[#1d2b3a]"
      >
        <div className="flex items-center justify-between mb-2">
          <ClockIcon />
          <span className="text-xs font-medium text-emerald-600">
            {upcoming.length > 0 ? `${upcoming.length} set` : 'Today'}
          </span>
        </div>
        {next ? (
          <>
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-none tabular-nums">
              {new Date(next.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="mt-1 text-[11px] text-zinc-400 truncate max-w-[120px]">{next.note}{upcoming.length > 1 ? ` +${upcoming.length - 1}` : ''}</p>
          </>
        ) : (
          <>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 leading-none">0</p>
            <p className="mt-1 text-[11px] text-zinc-400">Click to add</p>
          </>
        )}
      </button>

      {open && <RemindersModal onClose={() => setOpen(false)} />}
    </>
  );
}

function MobileShell({
  open,
  onClose,
  theme,
  setTheme,
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  onCreateWorkspace,
  user,
  onLogout,
}) {
  const [newWsName, setNewWsName] = useState('');
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
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Close menu" />
      <div className="absolute inset-x-0 top-0 rounded-b-[28px] border-b border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Cove</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-500">Choose a workspace and tune your app.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Close
          </button>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500">
            Theme
          </p>
          <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
          {themeItems.map((option) => (
            <button
              key={option.id}
              onClick={() => setTheme(option.id)}
              title={option.label}
              className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all ${
                theme === option.id
                  ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <span className="text-sm leading-none">{option.icon}</span>
              <span>{option.label}</span>
            </button>
          ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">Workspaces</p>
          <div className="space-y-2">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  onSelectWorkspace(ws);
                  onClose();
                }}
                className={`flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-left text-sm ${
                  activeWorkspace?.id === ws.id
                    ? 'bg-zinc-950 text-white dark:bg-zinc-800'
                    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold uppercase text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
                  {ws.name[0]}
                </span>
                <span className="truncate">{ws.name}</span>
                {!ws.is_solo && <span className="ml-auto text-xs opacity-70">team</span>}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleCreate} className="mt-4 flex gap-2">
          <input
            value={newWsName}
            onChange={(e) => setNewWsName(e.target.value)}
            placeholder="New workspace"
            className="min-w-0 flex-1 rounded-2xl bg-zinc-100 px-3 py-2.5 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200 placeholder:text-zinc-400 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:placeholder:text-zinc-600"
          />
          <button
            type="submit"
            className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
          >
            Add
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-zinc-100 px-3 py-3 dark:bg-zinc-900">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold uppercase text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
              {user?.display_name?.[0]}
            </div>
            <span className="truncate text-sm text-zinc-700 dark:text-zinc-300">{user?.display_name}</span>
          </div>
          <button
            onClick={onLogout}
            className="text-sm text-zinc-500 dark:text-zinc-400"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileTopBar({ workspaceName, view, onOpenMenu, onCreateNote, onCreateMeeting }) {
  const actionLabel = view === 'meetings' ? 'Meeting' : view === 'team' ? 'Manage' : 'Note';
  const showActionButton = view !== 'settings';

  function handleAction() {
    if (view === 'meetings') onCreateMeeting();
    if (view === 'notes') onCreateNote();
    if (view === 'team') onOpenMenu();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/92 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/92 lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <span className="flex flex-col gap-1.5">
            <span className="block h-0.5 w-4 rounded-full bg-current" />
            <span className="block h-0.5 w-4 rounded-full bg-current" />
            <span className="block h-0.5 w-4 rounded-full bg-current" />
          </span>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{workspaceName || 'Workspace'}</p>
          <p className="text-xs capitalize text-zinc-500 dark:text-zinc-500">{view}</p>
        </div>
        {showActionButton ? (
          <button
            onClick={handleAction}
            className="rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
          >
            {view === 'team' ? actionLabel : `+ New ${actionLabel}`}
          </button>
        ) : (
          <div className="w-[104px]" aria-hidden="true" />
        )}
      </div>
    </header>
  );
}

function MobileBottomNav({ view, onChangeView }) {
  const items = [
    { id: 'notes', label: 'Notes', icon: '📝' },
    { id: 'meetings', label: 'Meetings', icon: '📅' },
    { id: 'team', label: 'Team', icon: '🤝' },
    { id: 'power', label: 'Power', icon: '⚡' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <nav className="sticky bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 lg:hidden">
      <div className="grid grid-cols-5 gap-1 rounded-[28px] bg-zinc-100 p-1.5 shadow-sm dark:bg-zinc-900">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            className={`flex flex-col items-center justify-center gap-1 rounded-[22px] px-3 py-2.5 text-xs font-semibold transition-all ${
              view === item.id
                ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  // Switch to meetings view when returning from Google OAuth callback
  const [view, setView] = useState(searchParams.get('google') ? 'meetings' : 'home');
  const [notes, setNotes] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [managingMemberId, setManagingMemberId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showMeetingComposer, setShowMeetingComposer] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const upcomingMeetings = meetings.filter((meeting) => new Date(meeting.start_time) >= new Date()).length;
  const pinnedNotes = notes.filter((note) => note.is_pinned).length;
  const canManageWorkspace = activeWorkspace && user
    && (activeWorkspace.owner_id === user.id || activeWorkspace.membership_role === 'admin');
  const canInvite = canManageWorkspace;
  const canDeleteWorkspace = activeWorkspace && user && activeWorkspace.owner_id === user.id && !activeWorkspace.is_solo;

  useEffect(() => {
    api.getWorkspaces().then((ws) => {
      setWorkspaces(ws);
      if (ws.length > 0) setActiveWorkspace(ws[0]);
      else setLoading(false);
    }).catch((err) => {
      setLoadError(err.message);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!activeWorkspace) return;
    setLoading(true);
    Promise.all([
      api.getNotes(activeWorkspace.id),
      api.getMeetings(activeWorkspace.id),
      api.getMembers(activeWorkspace.id),
    ]).then(([n, m, workspaceMembers]) => {
      setNotes(n);
      setMeetings(m);
      setMembers(workspaceMembers);
      setLoadError('');
      setLoading(false);
    }).catch((err) => {
      setLoadError(err.message);
      setLoading(false);
    });
  }, [activeWorkspace]);

  useEffect(() => {
    if (!activeWorkspace) return;
    const socket = getSocket();
    socket.emit('join:workspace', activeWorkspace.id);

    socket.on('note:updated', (note) =>
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, ...note } : n)))
    );
    socket.on('meeting:updated', (meeting) =>
      setMeetings((prev) => prev.map((m) => (m.id === meeting.id ? meeting : m)))
    );

    return () => {
      socket.emit('leave:workspace', activeWorkspace.id);
      socket.off('note:updated');
      socket.off('meeting:updated');
    };
  }, [activeWorkspace]);

  const handleCreateWorkspace = useCallback(async (name) => {
    const ws = await api.createWorkspace({ name, is_solo: false });
    setWorkspaces((prev) => [...prev, ws]);
    setActiveWorkspace(ws);
  }, []);

  const handleCreateNote = useCallback(async (overrides = {}) => {
    if (!activeWorkspace) return;
    const note = await api.createNote({ workspace_id: activeWorkspace.id, ...overrides });
    setNotes((prev) => [note, ...prev]);
    setView('notes');
  }, [activeWorkspace]);

  const handleUpdateNote = useCallback(async (id, patch) => {
    const updated = await api.updateNote(id, patch);
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updated } : n)));
    const socket = getSocket();
    socket.emit('note:update', { workspaceId: activeWorkspace.id, note: updated });
  }, [activeWorkspace]);

  const handleDeleteNote = useCallback(async (id) => {
    await api.deleteNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleCreateNoteLink = useCallback(async (sourceId, targetId) => {
    const link = await api.createNoteLink(sourceId, targetId);
    setNotes((prev) => prev.map((note) => (
      note.id === sourceId || note.id === targetId
        ? {
            ...note,
            links: [...(note.links || []).filter((item) => item.id !== link.id), link],
          }
        : note
    )));
  }, []);

  const handleDeleteNoteLink = useCallback(async (noteId, linkId) => {
    await api.deleteNoteLink(noteId, linkId);
    setNotes((prev) => prev.map((note) => ({
      ...note,
      links: (note.links || []).filter((link) => link.id !== linkId),
    })));
  }, []);

  const handleUpdateNoteSection = useCallback(async (noteId, sectionId, patch) => {
    const updated = await api.updateNoteSection(noteId, sectionId, patch);
    setNotes((prev) => prev.map((note) => (
      note.id === noteId
        ? {
            ...note,
            sections: (note.sections || []).map((section) => (
              section.id === sectionId ? { ...section, ...updated } : section
            )),
          }
        : note
    )));
  }, []);

  const handleReorderNoteSections = useCallback(async (noteId, sectionIds) => {
    setNotes((prev) => prev.map((note) => (
      note.id === noteId
        ? {
            ...note,
            sections: sectionIds
              .map((sectionId) => (note.sections || []).find((section) => section.id === sectionId))
              .filter(Boolean)
              .map((section, index) => ({ ...section, sort_order: index })),
          }
        : note
    )));
    const updated = await api.reorderNoteSections(noteId, sectionIds);
    setNotes((prev) => prev.map((note) => (note.id === noteId ? updated : note)));
  }, []);

  const handleUnmergeNoteSection = useCallback(async (noteId, sectionId) => {
    const result = await api.unmergeNoteSection(noteId, sectionId);
    setNotes((prev) => {
      const withoutOld = prev.filter((note) => note.id !== noteId && note.id !== result.restored_note.id);
      return [result.restored_note, result.note, ...withoutOld];
    });
  }, []);

  const handleDeleteNoteSection = useCallback(async (noteId, sectionId) => {
    const updated = await api.deleteNoteSection(noteId, sectionId);
    setNotes((prev) => prev.map((note) => (note.id === noteId ? updated : note)));
  }, []);

  const handleAddNoteImage = useCallback(async (noteId, file) => {
    const image = await api.uploadNoteImage(noteId, file);
    setNotes((prev) =>
      prev.map((note) =>
        note.id === noteId ? { ...note, images: [...(note.images || []), image] } : note
      )
    );
  }, []);

  const handleDeleteNoteImage = useCallback(async (noteId, imageId) => {
    await api.deleteNoteImage(noteId, imageId);
    setNotes((prev) =>
      prev.map((note) =>
        note.id === noteId
          ? { ...note, images: (note.images || []).filter((image) => image.id !== imageId) }
          : note
      )
    );
  }, []);

  const handleAddAnnotation = useCallback(async (imageId, annotation) => {
    const created = await api.addAnnotation(imageId, annotation);
    setNotes((prev) => prev.map((note) => ({
      ...note,
      images: (note.images || []).map((image) => (
        image.id === imageId
          ? { ...image, annotations: [...(image.annotations || []), created] }
          : image
      )),
    })));
  }, []);

  const handleDeleteAnnotation = useCallback(async (imageId, annotationId) => {
    await api.deleteAnnotation(annotationId);
    setNotes((prev) => prev.map((note) => ({
      ...note,
      images: (note.images || []).map((image) => (
        image.id === imageId
          ? { ...image, annotations: (image.annotations || []).filter((item) => item.id !== annotationId) }
          : image
      )),
    })));
  }, []);

  const handleMergeNotes = useCallback(async (sourceId, targetId) => {
    const merged = await api.mergeNotes(targetId, sourceId);
    setNotes((prev) =>
      prev
        .filter((note) => note.id !== sourceId)
        .map((note) => (note.id === targetId ? { ...note, ...merged } : note))
    );
  }, []);

  const handleCreateMeeting = useCallback(async (data) => {
    if (!activeWorkspace) return;
    if (!data) {
      setView('meetings');
      setShowMeetingComposer((count) => count + 1);
      return;
    }
    const meeting = await api.createMeeting({ workspace_id: activeWorkspace.id, ...data });
    setMeetings((prev) => [meeting, ...prev]);
  }, [activeWorkspace]);

  const handleDeleteMeeting = useCallback(async (id) => {
    await api.deleteMeeting(id);
    setMeetings((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleInvite = useCallback(async (email) => {
    if (!activeWorkspace) return;
    setInviting(true);
    try {
      const result = await api.inviteMember(activeWorkspace.id, email);
      const updatedMembers = await api.getMembers(activeWorkspace.id);
      setMembers(updatedMembers);
      return result;
    } finally {
      setInviting(false);
    }
  }, [activeWorkspace]);

  const handleUpdateWorkspace = useCallback(async (changes) => {
    if (!activeWorkspace) return;
    setSavingWorkspace(true);
    try {
      const updated = await api.updateWorkspace(activeWorkspace.id, changes);
      setWorkspaces((prev) => prev.map((workspace) => (
        workspace.id === updated.id ? { ...workspace, ...updated } : workspace
      )));
      setActiveWorkspace((current) => ({ ...current, ...updated }));
      return updated;
    } finally {
      setSavingWorkspace(false);
    }
  }, [activeWorkspace]);

  const handleUpdateMemberRole = useCallback(async (userId, role) => {
    if (!activeWorkspace) return;
    setManagingMemberId(userId);
    try {
      const updated = await api.updateWorkspaceMember(activeWorkspace.id, userId, role);
      setMembers((prev) => prev.map((member) => (
        member.id === userId ? { ...member, role: updated.role } : member
      )));
    } finally {
      setManagingMemberId(null);
    }
  }, [activeWorkspace]);

  const handleRemoveMember = useCallback(async (userId) => {
    if (!activeWorkspace) return;
    setManagingMemberId(userId);
    try {
      await api.removeWorkspaceMember(activeWorkspace.id, userId);
      setMembers((prev) => prev.filter((member) => member.id !== userId));
    } finally {
      setManagingMemberId(null);
    }
  }, [activeWorkspace]);

  const handleUpdateMemberPermissions = useCallback(async (userId, permissions) => {
    if (!activeWorkspace) return;
    const updated = await api.updateMemberPermissions(activeWorkspace.id, userId, permissions);
    setMembers((prev) => prev.map((member) => (
      member.id === userId ? { ...member, permissions: updated.permissions } : member
    )));
  }, [activeWorkspace]);

  const handleDeleteWorkspace = useCallback(async () => {
    if (!activeWorkspace) return;
    setDeletingWorkspace(true);
    try {
      await api.deleteWorkspace(activeWorkspace.id);
      setWorkspaces((prev) => {
        const next = prev.filter((workspace) => workspace.id !== activeWorkspace.id);
        setActiveWorkspace(next[0] || null);
        return next;
      });
      setNotes([]);
      setMeetings([]);
      setMembers([]);
      setView('notes');
    } finally {
      setDeletingWorkspace(false);
    }
  }, [activeWorkspace]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#f5f6fa] dark:bg-[#131e2e] lg:flex-row">
      <Sidebar
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={setActiveWorkspace}
        onCreateWorkspace={handleCreateWorkspace}
        view={view}
        onChangeView={setView}
        user={user}
        onLogout={logout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
      />

      <MobileShell
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        theme={theme}
        setTheme={setTheme}
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={setActiveWorkspace}
        onCreateWorkspace={handleCreateWorkspace}
        user={user}
        onLogout={logout}
      />

      <main className="flex flex-1 flex-col overflow-hidden">
        <MobileTopBar
          workspaceName={activeWorkspace?.name}
          view={view}
          onOpenMenu={() => setMobileMenuOpen(true)}
          onCreateNote={handleCreateNote}
          onCreateMeeting={() => handleCreateMeeting()}
        />

        {/* Stats bar — Rantevoo flat style */}
        <section className="hidden bg-white border-b border-zinc-100 md:flex dark:bg-[#1a2535] dark:border-slate-700">
          {/* Workspace */}
          <div className="flex flex-1 flex-col px-6 py-3">
            <div className="flex items-center justify-between mb-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[18px] w-[18px] text-zinc-400">
                <rect x="3" y="3" width="7" height="7" rx="1.5" strokeLinecap="round" /><rect x="14" y="3" width="7" height="7" rx="1.5" strokeLinecap="round" /><rect x="3" y="14" width="7" height="7" rx="1.5" strokeLinecap="round" /><rect x="14" y="14" width="7" height="7" rx="1.5" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-medium text-emerald-600">Active</span>
            </div>
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 truncate leading-none">{activeWorkspace?.name || '—'}</p>
            <p className="mt-1 text-[11px] text-zinc-400">{activeWorkspace?.is_solo ? 'Personal workspace' : 'Team workspace'}</p>
          </div>

          <div className="w-px bg-zinc-100 dark:bg-slate-700" />

          {/* Pinned notes */}
          <div className="flex flex-1 flex-col px-6 py-3">
            <div className="flex items-center justify-between mb-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[18px] w-[18px] text-zinc-400">
                <path d="M5 4h14v16H5z" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 9h8M8 13h5" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-medium text-emerald-600">^ {pinnedNotes}</span>
            </div>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 leading-none">{pinnedNotes}</p>
            <p className="mt-1 text-[11px] text-zinc-400">Pinned notes</p>
          </div>

          <div className="w-px bg-zinc-100 dark:bg-slate-700" />

          {/* Upcoming meetings */}
          <div className="flex flex-1 flex-col px-6 py-3">
            <div className="flex items-center justify-between mb-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[18px] w-[18px] text-zinc-400">
                <rect x="3" y="5" width="18" height="16" rx="2" strokeLinecap="round" /><path d="M16 3v4M8 3v4M3 9h18" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-medium text-emerald-600">^ {upcomingMeetings}</span>
            </div>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 leading-none">{upcomingMeetings}</p>
            <p className="mt-1 text-[11px] text-zinc-400">Upcoming meetings</p>
          </div>

          <div className="w-px bg-zinc-100 dark:bg-slate-700" />

          {/* Members */}
          <div className="flex flex-1 flex-col px-6 py-3">
            <div className="flex items-center justify-between mb-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[18px] w-[18px] text-zinc-400">
                <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="7" r="4" /><path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-medium text-emerald-600">^ {members.length}</span>
            </div>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 leading-none">{members.length}</p>
            <p className="mt-1 text-[11px] text-zinc-400">Members</p>
          </div>

          <div className="w-px bg-zinc-100 dark:bg-slate-700" />

          {/* Reminder */}
          <ReminderCard />
        </section>

        <section className="flex gap-2 overflow-x-auto border-b border-zinc-200 px-4 py-3 md:hidden dark:border-zinc-800">
          <div className="rounded-2xl bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-300">
            {pinnedNotes} pinned
          </div>
          <div className="rounded-2xl bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-300">
            {upcomingMeetings} upcoming
          </div>
          <div className="rounded-2xl bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-300">
            {members.length} members
          </div>
        </section>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {loadError ? (
            <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-red-500 dark:text-red-400">
              {loadError}
            </div>
          ) : loading ? (
            <div className="flex flex-1 items-center justify-center px-4 text-zinc-500 dark:text-zinc-600">Loading...</div>
          ) : view === 'home' ? (
            <HomeDashboard
              notes={notes}
              meetings={meetings}
              members={members}
              user={user}
              workspace={activeWorkspace}
              onCreateNote={handleCreateNote}
              onCreateMeeting={handleCreateMeeting}
              onChangeView={setView}
            />
          ) : view === 'notes' ? (
            <NotesList
              notes={notes}
              currentUser={user}
              onCreate={handleCreateNote}
              onUpdate={handleUpdateNote}
              onUpdateSection={handleUpdateNoteSection}
              onReorderSections={handleReorderNoteSections}
              onUnmergeSection={handleUnmergeNoteSection}
              onDeleteSection={handleDeleteNoteSection}
              onCreateLink={handleCreateNoteLink}
              onDeleteLink={handleDeleteNoteLink}
              onDelete={handleDeleteNote}
              onAddImage={handleAddNoteImage}
              onDeleteImage={handleDeleteNoteImage}
              onAddAnnotation={handleAddAnnotation}
              onDeleteAnnotation={handleDeleteAnnotation}
              onMerge={handleMergeNotes}
            />
          ) : view === 'meetings' ? (
            <MeetingsList
              meetings={meetings}
              members={members}
              onCreate={handleCreateMeeting}
              onDelete={handleDeleteMeeting}
              forceComposerToken={showMeetingComposer}
            />
          ) : view === 'team' ? (
            <TeamPanel
              workspace={activeWorkspace}
              members={members}
              currentUser={user}
              canInvite={canInvite}
              inviting={inviting}
              onInvite={handleInvite}
              canManageWorkspace={canManageWorkspace}
              savingWorkspace={savingWorkspace}
              onUpdateWorkspace={handleUpdateWorkspace}
              managingMemberId={managingMemberId}
              onUpdateMemberRole={handleUpdateMemberRole}
              onRemoveMember={handleRemoveMember}
              onUpdateMemberPermissions={handleUpdateMemberPermissions}
              canDeleteWorkspace={canDeleteWorkspace}
              deletingWorkspace={deletingWorkspace}
              onDeleteWorkspace={handleDeleteWorkspace}
            />
          ) : view === 'power' ? (
            <PowerPanel
              workspace={activeWorkspace}
              notes={notes}
              members={members}
              onNoteCreated={(note) => {
                setNotes((prev) => [note, ...prev]);
                setView('notes');
              }}
              onNoteRestored={(note) => setNotes((prev) => prev.map((item) => (
                item.id === note.id ? { ...item, ...note } : item
              )))}
            />
          ) : (
            <SettingsPanel />
          )}
        </div>

        <MobileBottomNav view={view} onChangeView={setView} />
      </main>
    </div>
  );
}
