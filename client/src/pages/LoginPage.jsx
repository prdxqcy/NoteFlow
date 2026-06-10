import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import BrandMark from '../components/BrandMark';

const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || 'prdxqcy/Cove';
const DEFAULT_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;
const DEFAULT_DOWNLOAD_URL = import.meta.env.VITE_DESKTOP_DOWNLOAD_URL || DEFAULT_RELEASES_URL;

function getPlatformPreference() {
  if (typeof navigator === 'undefined') {
    return { label: 'Desktop', extensions: ['.exe', '.dmg', '.zip'] };
  }

  const agent = navigator.userAgent.toLowerCase();
  if (agent.includes('mac')) {
    return { label: 'macOS', extensions: ['.dmg', '.zip', '.exe'] };
  }

  if (agent.includes('win')) {
    return { label: 'Windows', extensions: ['.exe', '.msi', '.zip'] };
  }

  return { label: 'Desktop', extensions: ['.exe', '.dmg', '.zip'] };
}

export default function LoginPage() {
  const { login } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [desktopRelease, setDesktopRelease] = useState({
    file: DEFAULT_DOWNLOAD_URL,
    version: '',
    source: 'GitHub Releases',
    platformLabel: 'Desktop',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    const preferredPlatform = getPlatformPreference();

    fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Release lookup failed');
        const release = await response.json();
        const matchingAsset = preferredPlatform.extensions
          .map((extension) => release.assets?.find((asset) => asset.name?.toLowerCase().endsWith(extension)))
          .find(Boolean);

        return {
          file: matchingAsset?.browser_download_url || release.html_url || DEFAULT_DOWNLOAD_URL,
          version: release.tag_name || release.name || '',
          source: 'GitHub Releases',
          platformLabel: preferredPlatform.label,
        };
      })
      .then((release) => {
        if (!ignore) setDesktopRelease(release);
      })
      .catch(() => {
        if (!ignore) {
          setDesktopRelease({
            file: DEFAULT_DOWNLOAD_URL,
            version: '',
            source: 'GitHub Releases',
            platformLabel: preferredPlatform.label,
          });
        }
      });

    return () => {
      ignore = true;
    };
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.12),_transparent_24%),linear-gradient(180deg,_#f5f5f4_0%,_#fafaf9_100%)] px-4 py-8 dark:bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_22%),linear-gradient(180deg,_#09090b_0%,_#111827_100%)]">
      <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white/90 p-8 shadow-xl shadow-zinc-300/30 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80 dark:shadow-black/20">
        <div className="mb-8 flex items-start justify-between gap-3">
          <BrandMark compact />
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-white"
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            required
            className="w-full rounded-lg bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-1 ring-zinc-300 placeholder:text-zinc-400 focus:ring-emerald-400 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-600"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="Password"
            required
            className="w-full rounded-lg bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-1 ring-zinc-300 placeholder:text-zinc-400 focus:ring-emerald-400 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-600"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-400"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-500">Desktop App</p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Download the latest Electron build for quick capture, tray access, and hotkeys.
          </p>
          <a
            href={desktopRelease.file}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
          >
            Download for {desktopRelease.platformLabel}
          </a>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-500">
            <span>{desktopRelease.source}</span>
            {desktopRelease.version ? <span>{desktopRelease.version}</span> : null}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          No account?{' '}
          <Link to="/register" className="text-zinc-700 underline hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
