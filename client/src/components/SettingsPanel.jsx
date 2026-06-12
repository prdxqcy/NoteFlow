import { useEffect, useState } from 'react';
import { useDesktopBridge } from '../hooks/useDesktopBridge';
import GoogleCalendarConnect from './GoogleCalendarConnect';

const inputCls = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-600 dark:focus:ring-emerald-900/30';

function HotkeyField({ label, description, value, placeholder, onChange }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{label}</p>
        {description && <p className="text-xs text-zinc-400">{description}</p>}
      </div>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-56 shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-700 outline-none transition placeholder:text-zinc-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-emerald-600"
      />
    </div>
  );
}

export default function SettingsPanel() {
  const desktop = useDesktopBridge();
  const [form, setForm] = useState({ toggleHotkey: '', newNoteHotkey: '', newMeetingHotkey: '' });

  useEffect(() => { setForm(desktop.settings); }, [desktop.settings]);

  async function handleSubmit(e) {
    e.preventDefault();
    await desktop.saveSettings(form);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-[#111a2a]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-zinc-600 dark:text-zinc-300">
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" strokeLinecap="round" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.83 2.83-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-4v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06-2.83-2.83.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3v-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06 2.83-2.83.06.06A1.65 1.65 0 0 0 8.92 4a1.65 1.65 0 0 0 1-1.51V2h4v.49A1.65 1.65 0 0 0 15 4a1.65 1.65 0 0 0 1.82-.33l.06-.06 2.83 2.83-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21v4h-.09A1.65 1.65 0 0 0 19.4 15Z" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Settings</h2>
            <p className="text-xs text-zinc-400">Tune desktop shortcuts and app behavior</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-[#f5f6fa] p-5 dark:bg-[#0e1825]">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">

          {/* ── Left: Shortcuts ── */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#1a2638]">
            <div className="h-1 w-full bg-gradient-to-r from-zinc-400 to-zinc-300 dark:from-zinc-600 dark:to-zinc-700" />
            <div className="p-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-zinc-600 dark:text-zinc-300">
                    <rect x="2" y="6" width="20" height="14" rx="2" strokeLinecap="round" />
                    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M10 14h.01M14 14h4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Desktop Shortcuts</p>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Global Hotkeys</h3>
                </div>
              </div>

              <p className="mb-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                These work from the Electron app even when Cove is hidden to the tray. Use <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono dark:bg-zinc-800">CommandOrControl</code> for cross-platform shortcuts.
              </p>

              {desktop.available ? (
                <form onSubmit={handleSubmit} className="space-y-2.5">
                  <HotkeyField
                    label="Show / Hide App"
                    description="Toggle the Cove window from anywhere"
                    value={form.toggleHotkey}
                    placeholder="CommandOrControl+Alt+N"
                    onChange={(e) => { desktop.clearStatus(); setForm((p) => ({ ...p, toggleHotkey: e.target.value })); }}
                  />
                  <HotkeyField
                    label="New Note"
                    description="Open a quick-capture note window"
                    value={form.newNoteHotkey}
                    placeholder="CommandOrControl+Shift+N"
                    onChange={(e) => { desktop.clearStatus(); setForm((p) => ({ ...p, newNoteHotkey: e.target.value })); }}
                  />
                  <HotkeyField
                    label="New Meeting"
                    description="Open a quick meeting scheduler"
                    value={form.newMeetingHotkey}
                    placeholder="CommandOrControl+Shift+M"
                    onChange={(e) => { desktop.clearStatus(); setForm((p) => ({ ...p, newMeetingHotkey: e.target.value })); }}
                  />

                  <div className="pt-1">
                    {desktop.error && (
                      <p className="mb-2 flex items-center gap-1.5 text-xs text-red-500">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" /></svg>
                        {desktop.error}
                      </p>
                    )}
                    {desktop.message && (
                      <p className="mb-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        {desktop.message}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={desktop.loading || desktop.saving}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {desktop.saving ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeOpacity=".25" /><path d="M12 3a9 9 0 0 1 9 9" strokeLinecap="round" /></svg>
                          Saving…
                        </>
                      ) : 'Save shortcuts'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-900/20">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 h-5 w-5 shrink-0 text-amber-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" /><line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
                  </svg>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Open Cove through the Electron desktop app to manage tray and global shortcuts here.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="space-y-4">

            {/* Google Calendar */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#1a2638]">
              <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-cyan-400" />
              <div className="p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-blue-600 dark:text-blue-400">
                      <rect x="3" y="5" width="18" height="16" rx="2" strokeLinecap="round" />
                      <path d="M16 3v4M8 3v4M3 9h18" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Integrations</p>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Google Calendar</h3>
                  </div>
                </div>
                <p className="mb-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Meetings you create are automatically added to your Google Calendar. Attendees receive invite emails and notifications.
                </p>
                <GoogleCalendarConnect />
              </div>
            </div>

            {/* Desktop Behavior */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#1a2638]">
              <div className="border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Desktop Behavior</p>
              </div>
              <div className="space-y-0 divide-y divide-zinc-100 dark:divide-zinc-800">
                {[
                  {
                    icon: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" strokeLinecap="round" /></>,
                    color: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
                    text: 'Closing the desktop window hides Cove to the tray instead of quitting.',
                  },
                  {
                    icon: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" strokeLinecap="round" /></>,
                    color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
                    text: 'New note and new meeting shortcuts open a focused quick-capture window.',
                  },
                  {
                    icon: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" /><polyline points="9 22 9 12 15 12 15 22" strokeLinecap="round" strokeLinejoin="round" /></>,
                    color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
                    text: 'The tray icon can reopen the app or launch quick actions from anywhere on your desktop.',
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-4">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${item.color}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">{item.icon}</svg>
                    </div>
                    <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
