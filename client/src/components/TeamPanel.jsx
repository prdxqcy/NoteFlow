import { useEffect, useMemo, useState } from 'react';

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500',
];

function memberColor(id = '') {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Avatar({ member, size = 'md' }) {
  const sz = size === 'lg' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-sm';
  const letter = member.display_name?.[0] || member.email?.[0] || '?';
  return (
    <div className={`${sz} ${memberColor(member.id)} flex shrink-0 items-center justify-center rounded-full font-bold text-white`}>
      {letter.toUpperCase()}
    </div>
  );
}

function StatBadge({ value, label, icon }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/60">
      <span className="text-zinc-400">{icon}</span>
      <div>
        <p className="text-sm font-bold leading-none text-zinc-900 dark:text-zinc-100">{value}</p>
        <p className="mt-0.5 text-[10px] text-zinc-400">{label}</p>
      </div>
    </div>
  );
}

export default function TeamPanel({
  workspace,
  members,
  currentUser,
  canInvite,
  inviting,
  onInvite,
  canManageWorkspace,
  savingWorkspace,
  onUpdateWorkspace,
  managingMemberId,
  onUpdateMemberRole,
  onRemoveMember,
  onUpdateMemberPermissions,
  canDeleteWorkspace,
  deletingWorkspace,
  onDeleteWorkspace,
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [workspaceName, setWorkspaceName] = useState(workspace?.name || '');
  const [workspaceDescription, setWorkspaceDescription] = useState(workspace?.description || '');
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceSuccess, setWorkspaceSuccess] = useState('');

  useEffect(() => {
    setWorkspaceName(workspace?.name || '');
    setWorkspaceDescription(workspace?.description || '');
    setWorkspaceError('');
    setWorkspaceSuccess('');
  }, [workspace?.id, workspace?.name, workspace?.description]);

  const memberSummary = useMemo(() => {
    const owners = members.filter((m) => m.role === 'owner').length;
    return { owners, collaborators: members.length - owners };
  }, [members]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setSuccessMsg('');
    try {
      const result = await onInvite(email.trim());
      setEmail('');
      if (result?.type === 'invited') setSuccessMsg(`Invite sent to ${result.email}`);
      else if (result?.type === 'added') setSuccessMsg(`${result.member?.display_name || result.email} added`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleWorkspaceSubmit(e) {
    e.preventDefault();
    setWorkspaceError('');
    setWorkspaceSuccess('');
    try {
      await onUpdateWorkspace({ name: workspaceName, description: workspaceDescription });
      setWorkspaceSuccess('Workspace saved.');
    } catch (err) {
      setWorkspaceError(err.message);
    }
  }

  async function handleRoleChange(member, role) {
    try { await onUpdateMemberRole(member.id, role); } catch (err) { setWorkspaceError(err.message); }
  }

  async function handleRemoveMember(member) {
    if (!window.confirm(`Remove ${member.display_name || member.email}?`)) return;
    try { await onRemoveMember(member.id); } catch (err) { setWorkspaceError(err.message); }
  }

  async function handleDeleteWorkspace() {
    if (!window.confirm(`Delete "${workspace?.name}"? This removes all notes, meetings, and members.`)) return;
    await onDeleteWorkspace();
  }

  const inputCls = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-emerald-600 dark:focus:ring-emerald-900/30';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-[#111a2a]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-emerald-600 dark:text-emerald-400">
              <path d="M17 20v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Collaboration</h2>
            <p className="text-xs text-zinc-400">Manage your workspace and team members</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-[#f5f6fa] p-5 dark:bg-[#0e1825]">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">

          {/* ── Left Column ── */}
          <div className="space-y-4">

            {/* Workspace card */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#1a2638]">
              {/* Color bar */}
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-400" />

              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-lg font-black text-white shadow-sm">
                      {workspace?.name?.[0]?.toUpperCase() || 'W'}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Workspace</p>
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{workspace?.name || 'Workspace'}</h3>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <StatBadge
                      value={members.length}
                      label={members.length === 1 ? 'member' : 'members'}
                      icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" /></svg>}
                    />
                    <StatBadge
                      value={memberSummary.collaborators}
                      label={memberSummary.collaborators === 1 ? 'collaborator' : 'collaborators'}
                      icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M17 20v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" /><circle cx="9" cy="7" r="4" /><path d="M23 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" /></svg>}
                    />
                  </div>
                </div>

                {/* Workspace form */}
                {canManageWorkspace && (
                  <form className="mt-5 space-y-3 border-t border-zinc-100 pt-5 dark:border-zinc-800" onSubmit={handleWorkspaceSubmit}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Workspace Profile</p>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Name</label>
                      <input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} maxLength={120} required className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Description</label>
                      <textarea value={workspaceDescription} onChange={(e) => setWorkspaceDescription(e.target.value)} maxLength={1000} rows={3} placeholder="What is this workspace used for?" className={inputCls + ' resize-none'} />
                    </div>
                    {workspaceError && <p className="text-xs text-red-500">{workspaceError}</p>}
                    {workspaceSuccess && (
                      <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        {workspaceSuccess}
                      </p>
                    )}
                    <button type="submit" disabled={savingWorkspace} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
                      {savingWorkspace ? 'Saving…' : 'Save workspace'}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Members list */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#1a2638]">
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Team Members</p>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                  {members.length}
                </span>
              </div>

              {members.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-zinc-400"><path d="M17 20v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" /><circle cx="9" cy="7" r="4" /></svg>
                  </div>
                  <p className="text-sm text-zinc-500">No members yet</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <Avatar member={member} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {member.display_name}
                          {member.id === currentUser?.id && <span className="ml-1.5 text-xs font-normal text-zinc-400">(You)</span>}
                        </p>
                        <p className="truncate text-xs text-zinc-400">{member.email}</p>
                      </div>

                      {canManageWorkspace && member.role !== 'owner' ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <select
                            value={member.role}
                            disabled={managingMemberId === member.id}
                            onChange={(e) => handleRoleChange(member, e.target.value)}
                            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 outline-none focus:border-emerald-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button
                            type="button"
                            disabled={managingMemberId === member.id}
                            onClick={() => handleRemoveMember(member)}
                            className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            Remove
                          </button>
                          <div className="flex gap-2">
                            {['edit_notes', 'merge_notes', 'manage_tasks'].map((perm) => (
                              <label key={perm} className="flex cursor-pointer items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                                <input
                                  type="checkbox"
                                  checked={member.permissions?.[perm] !== false}
                                  onChange={(e) => onUpdateMemberPermissions(member.id, { ...(member.permissions || {}), [perm]: e.target.checked })}
                                  className="accent-emerald-600"
                                />
                                {perm.replace(/_/g, ' ')}
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
                          member.role === 'owner'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}>
                          {member.role}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column ── */}
          <div className="space-y-4">

            {/* Invite card */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#1a2638]">
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-violet-400" />
              <div className="p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-blue-600 dark:text-blue-400">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="19" y1="8" x2="19" y2="14" strokeLinecap="round" />
                      <line x1="22" y1="11" x2="16" y2="11" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Invite</p>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Bring in collaborators</h3>
                  </div>
                </div>

                <p className="mb-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Enter any email. Existing accounts are added instantly — otherwise an invite email is sent.
                </p>

                {canInvite ? (
                  <form onSubmit={handleSubmit} className="space-y-2.5">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setSuccessMsg(''); }}
                      placeholder="teammate@example.com"
                      className={inputCls}
                    />
                    {error && (
                      <p className="flex items-center gap-1.5 text-xs text-red-500">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" /></svg>
                        {error}
                      </p>
                    )}
                    {successMsg && (
                      <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        {successMsg}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={inviting}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {inviting ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeOpacity=".25" /><path d="M12 3a9 9 0 0 1 9 9" strokeLinecap="round" /></svg>
                          Sending…
                        </>
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7Z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          Send invite
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-900/20">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2a5 5 0 0 1 5 5v3H7V7a5 5 0 0 1 5-5ZM4 11h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11Z" /></svg>
                    <p className="text-xs text-amber-700 dark:text-amber-300">Only workspace owners and admins can invite members.</p>
                  </div>
                )}
              </div>
            </div>

            {/* How it works */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#1a2638]">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">How Collaboration Works</p>
              <div className="space-y-3.5">
                {[
                  {
                    icon: <path d="M12 2a5 5 0 0 1 5 5v3H7V7a5 5 0 0 1 5-5ZM4 11h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11Z" />,
                    color: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
                    text: 'Shared notes are visible to all workspace members. Mark a note Private (lock icon) to keep it only for yourself.',
                  },
                  {
                    icon: <><rect x="3" y="5" width="18" height="16" rx="2" strokeLinecap="round" /><path d="M16 3v4M8 3v4M3 9h18" strokeLinecap="round" /></>,
                    color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
                    text: 'Add guest emails when creating a meeting to automatically send Google Calendar invites.',
                  },
                  {
                    icon: <><path d="M5 12.5 9 16.5 19 7.5" strokeLinecap="round" strokeLinejoin="round" /></>,
                    color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
                    text: 'All changes to notes and meetings sync in real time for every workspace member.',
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${item.color}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">{item.icon}</svg>
                    </div>
                    <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger zone */}
            {canDeleteWorkspace && (
              <div className="rounded-2xl border border-red-200/80 bg-white p-5 shadow-sm dark:border-red-900/40 dark:bg-[#1a2638]">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/30">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-red-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" /><line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-red-500">Danger Zone</p>
                </div>
                <p className="mb-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Permanently removes this workspace along with all its notes, meetings, and memberships. This cannot be undone.
                </p>
                <button
                  onClick={handleDeleteWorkspace}
                  disabled={deletingWorkspace}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-white py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M7.5 7l.7 11.1A2 2 0 0 0 10.2 20h3.6a2 2 0 0 0 2-1.9L16.5 7" />
                  </svg>
                  {deletingWorkspace ? 'Deleting…' : 'Delete workspace'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
