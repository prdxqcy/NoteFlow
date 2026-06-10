import { useMemo, useState } from 'react';

export default function TeamPanel({
  workspace,
  members,
  currentUser,
  canInvite,
  inviting,
  onInvite,
  canDeleteWorkspace,
  deletingWorkspace,
  onDeleteWorkspace,
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const memberSummary = useMemo(() => {
    const owners = members.filter((member) => member.role === 'owner').length;
    const collaborators = members.length - owners;
    return { owners, collaborators };
  }, [members]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setSuccessMsg('');
    try {
      const result = await onInvite(email.trim());
      setEmail('');
      if (result?.type === 'invited') {
        setSuccessMsg(`Invite sent to ${result.email}`);
      } else if (result?.type === 'added') {
        setSuccessMsg(`${result.member?.display_name || result.email} added to workspace`);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteWorkspace() {
    const confirmed = window.confirm(`Delete "${workspace?.name}"? This removes its notes, meetings, and members.`);
    if (!confirmed) return;
    await onDeleteWorkspace();
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-zinc-200 px-4 py-4 sm:px-6 dark:border-zinc-800">
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Collaboration</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Invite people to this workspace and keep everyone aligned in one place.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">Workspace</p>
                <h3 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {workspace?.name || 'Workspace'}
                </h3>
              </div>
              <div className="flex gap-2">
                <div className="rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {members.length} member{members.length === 1 ? '' : 's'}
                </div>
                <div className="rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {memberSummary.collaborators} collaborator{memberSummary.collaborators === 1 ? '' : 's'}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {members.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-500">
                  No members yet.
                </div>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 dark:border-zinc-800"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold uppercase text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
                      {member.display_name?.[0] || member.email?.[0] || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {member.display_name}
                        {member.id === currentUser?.id ? ' (You)' : ''}
                      </p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-500">{member.email}</p>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {member.role}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">Invite</p>
              <h3 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Bring in collaborators</h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
                Enter any email. If they have an account they'll be added instantly — otherwise they'll get an invite email to join.
              </p>

              {canInvite ? (
                <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setSuccessMsg(''); }}
                    placeholder="teammate@example.com"
                    className="w-full rounded-xl bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-1 ring-zinc-300 placeholder:text-zinc-400 focus:ring-emerald-400 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:placeholder:text-zinc-600 dark:focus:ring-zinc-500"
                  />
                  {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
                  {successMsg && <p className="text-sm text-green-600 dark:text-green-400">{successMsg}</p>}
                  <button
                    type="submit"
                    disabled={inviting}
                    className="w-full rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-400"
                  >
                    {inviting ? 'Sending invite...' : 'Invite member'}
                  </button>
                </form>
              ) : (
                <p className="mt-4 rounded-xl bg-zinc-100 px-3 py-3 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  Only the workspace owner can invite new members.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">How Collaboration Works</p>
              <div className="mt-3 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                <p>Shared notes are visible to all workspace members. Mark a note <strong>Private</strong> (lock icon) to keep it only for yourself.</p>
                <p>When you create a meeting, add guest emails to send Google Calendar invites to people outside the workspace.</p>
                <p>Changes to notes and meetings sync in real time for everyone in the workspace.</p>
              </div>
            </section>

            {canDeleteWorkspace && (
              <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm dark:border-red-900/60 dark:bg-zinc-900/90">
                <p className="text-xs uppercase tracking-[0.2em] text-red-500 dark:text-red-400">Danger Zone</p>
                <h3 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Delete workspace</h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
                  This permanently removes the workspace, including all notes, meetings, and memberships.
                </p>
                <button
                  onClick={handleDeleteWorkspace}
                  disabled={deletingWorkspace}
                  className="mt-4 w-full rounded-xl bg-red-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingWorkspace ? 'Deleting workspace...' : 'Delete workspace'}
                </button>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
