import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || 'prdxqcy/Cove';
const DEFAULT_DOWNLOAD_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h14v16H5z" />
        <path strokeLinecap="round" d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    ),
    title: 'Smart Notes',
    desc: 'Capture ideas with rich formatting, boards, and sharing.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v3M18 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" />
      </svg>
    ),
    title: 'Meeting Scheduler',
    desc: 'Sync with Google Calendar and invite teammates automatically.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 20v-2a4 4 0 0 0-3-3.87" />
      </svg>
    ),
    title: 'Team Collaboration',
    desc: 'Real-time shared workspaces with role-based access.',
  },
];

export default function LoginPage() {
  const { login, loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(DEFAULT_DOWNLOAD_URL);

  // Handle Google Sign-In callback: ?gauth=BASE64 or ?google_error=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gauth = params.get('gauth');
    const googleError = params.get('google_error');

    if (gauth) {
      try {
        const { token, user } = JSON.parse(atob(decodeURIComponent(gauth)));
        loginWithToken(token, user);
        navigate('/', { replace: true });
      } catch {
        setError('Google sign-in failed. Please try again.');
        window.history.replaceState({}, '', '/login');
      }
      return;
    }

    if (googleError) {
      const messages = {
        denied: 'Google sign-in was cancelled.',
        config: 'Google Sign-In is not configured on this server.',
        server: 'A server error occurred during Google sign-in.',
        state: 'Invalid OAuth state. Please try again.',
      };
      setError(messages[googleError] || 'Google sign-in failed.');
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  // Fetch latest desktop release URL
  useEffect(() => {
    let ignore = false;
    const isWin = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('win');
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      .then((r) => r.ok ? r.json() : null)
      .then((rel) => {
        if (!rel || ignore) return;
        const ext = isWin ? '.exe' : '.dmg';
        const asset = rel.assets?.find((a) => a.name?.toLowerCase().endsWith(ext))
          || rel.assets?.[0];
        setDownloadUrl(asset?.browser_download_url || rel.html_url || DEFAULT_DOWNLOAD_URL);
      })
      .catch(() => {});
    return () => { ignore = true; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleSignIn() {
    const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
    window.location.href = `${apiBase}/google/signin-url`;
  }

  return (
    <div className="flex min-h-screen bg-[#f5f6fa] dark:bg-[#0e1825]">

      {/* ── Left branding panel (desktop only) ───────────────────────────── */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-12 text-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/5" />
          <div className="absolute -bottom-20 -left-10 h-80 w-80 rounded-full bg-black/10" />
          <div className="absolute bottom-1/3 right-8 h-40 w-40 rounded-full bg-white/5" />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <img src="/cove-logo.svg" alt="Cove" className="h-7 w-7 brightness-0 invert" />
          </div>
          <span
            className="text-2xl font-black tracking-tight text-white"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            Cove
          </span>
        </div>

        {/* Hero */}
        <div className="relative">
          <h1
            className="text-4xl font-black leading-tight tracking-tight"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            Your workspace,<br />beautifully organized.
          </h1>
          <p className="mt-4 text-base text-emerald-100/90 leading-relaxed max-w-xs">
            Notes, meetings, and team tools united in one clean, fast workspace.
          </p>

          <div className="mt-10 space-y-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  {f.icon}
                </div>
                <div>
                  <p className="font-semibold text-sm">{f.title}</p>
                  <p className="text-xs text-emerald-100/75 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <p className="relative text-xs text-emerald-200/60">
          Available as web app and Electron desktop client.
        </p>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[380px]">

          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src="/cove-logo.svg" alt="Cove" className="h-8 w-8" />
            <span
              className="text-xl font-black text-zinc-900 dark:text-white tracking-tight"
              style={{ fontFamily: "'Nunito', sans-serif" }}
            >
              Cove
            </span>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              Welcome back
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Sign in to your workspace to continue.
            </p>
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative my-5 flex items-center gap-3">
            <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
            <span className="text-xs text-zinc-400 dark:text-zinc-500">or sign in with email</span>
            <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
          </div>

          {/* Email / password form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Email address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-600 dark:focus:ring-emerald-900/30"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-600 dark:focus:ring-emerald-900/30"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 dark:border-red-900/40 dark:bg-red-900/20">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500">
                  <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" />
                </svg>
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" strokeOpacity=".25" />
                    <path d="M12 3a9 9 0 0 1 9 9" strokeLinecap="round" />
                  </svg>
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          {/* Desktop download */}
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-800/60">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-emerald-600 dark:text-emerald-400">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Desktop App</p>
                <p className="text-[11px] text-zinc-400">Hotkeys, tray, offline access</p>
              </div>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto shrink-0 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
              >
                Download
              </a>
            </div>
          </div>

          <p className="mt-5 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No account?{' '}
            <Link
              to="/register"
              className="font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
