import { useEffect, useState } from 'react';
import { useDesktopBridge } from '../hooks/useDesktopBridge';
import GoogleCalendarConnect from './GoogleCalendarConnect';

export default function SettingsPanel() {
  const desktop = useDesktopBridge();
  const [form, setForm] = useState({
    toggleHotkey: '',
    newNoteHotkey: '',
    newMeetingHotkey: '',
  });

  useEffect(() => {
    setForm(desktop.settings);
  }, [desktop.settings]);

  async function handleSubmit(e) {
    e.preventDefault();
    await desktop.saveSettings(form);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-zinc-200 px-4 py-4 sm:px-6 dark:border-zinc-800">
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Settings</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Tune desktop shortcuts and general app behavior in one place.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">Desktop Shortcuts</p>
            <h3 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Global hotkeys</h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
              These work from the Electron app, even when NoteFlow is hidden to the tray.
            </p>

            {desktop.available ? (
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
                    Show / hide app
                  </span>
                  <input
                    value={form.toggleHotkey}
                    onChange={(e) => {
                      desktop.clearStatus();
                      setForm((prev) => ({ ...prev, toggleHotkey: e.target.value }));
                    }}
                    placeholder="CommandOrControl+Alt+N"
                    className="w-full rounded-xl bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-1 ring-zinc-300 placeholder:text-zinc-400 focus:ring-amber-400 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:placeholder:text-zinc-600 dark:focus:ring-zinc-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
                    New note
                  </span>
                  <input
                    value={form.newNoteHotkey}
                    onChange={(e) => {
                      desktop.clearStatus();
                      setForm((prev) => ({ ...prev, newNoteHotkey: e.target.value }));
                    }}
                    placeholder="CommandOrControl+Shift+N"
                    className="w-full rounded-xl bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-1 ring-zinc-300 placeholder:text-zinc-400 focus:ring-amber-400 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:placeholder:text-zinc-600 dark:focus:ring-zinc-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
                    New meeting
                  </span>
                  <input
                    value={form.newMeetingHotkey}
                    onChange={(e) => {
                      desktop.clearStatus();
                      setForm((prev) => ({ ...prev, newMeetingHotkey: e.target.value }));
                    }}
                    placeholder="CommandOrControl+Shift+M"
                    className="w-full rounded-xl bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-1 ring-zinc-300 placeholder:text-zinc-400 focus:ring-amber-400 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:placeholder:text-zinc-600 dark:focus:ring-zinc-500"
                  />
                </label>

                <p className="text-xs text-zinc-500 dark:text-zinc-500">
                  Examples: <code>CommandOrControl+Shift+Space</code>, <code>Alt+N</code>, <code>CommandOrControl+1</code>
                </p>

                {desktop.error && <p className="text-sm text-red-500 dark:text-red-400">{desktop.error}</p>}
                {desktop.message && <p className="text-sm text-emerald-600 dark:text-emerald-400">{desktop.message}</p>}

                <button
                  type="submit"
                  disabled={desktop.loading || desktop.saving}
                  className="w-full rounded-xl bg-zinc-950 px-3 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  {desktop.saving ? 'Saving shortcuts...' : 'Save shortcuts'}
                </button>
              </form>
            ) : (
              <p className="mt-5 rounded-xl bg-zinc-100 px-3 py-3 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                Open NoteFlow through the Electron desktop app to manage tray and global shortcuts here.
              </p>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">Integrations</p>
              <h3 className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">Google Calendar</h3>
              <p className="mb-4 mt-1 text-sm text-zinc-500 dark:text-zinc-500">
                Meetings you create are automatically added to your Google Calendar. Attendees receive Google invite emails and notifications.
              </p>
              <GoogleCalendarConnect />
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">Desktop Behavior</p>
              <div className="mt-3 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                <p>Closing the desktop window hides NoteFlow to the tray instead of quitting.</p>
                <p>New note and new meeting shortcuts open a focused quick-capture window instead of the full app.</p>
                <p>The tray icon can reopen the app or launch those same quick actions from anywhere on your desktop.</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
