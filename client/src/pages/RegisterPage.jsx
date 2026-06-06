import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useTheme } from '../hooks/useTheme.jsx';
import { api } from '../lib/api.js';

export default function RegisterPage() {
  const { register } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [form, setForm] = useState({ email: '', password: '', display_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteInfo, setInviteInfo] = useState(null);

  // Pre-fill email when there's a valid invite token
  useEffect(() => {
    if (!inviteToken) return;
    api.getInvitation(inviteToken)
      .then((info) => {
        setInviteInfo(info);
        setForm((f) => ({ ...f, email: info.invited_email }));
      })
      .catch(() => {});
  }, [inviteToken]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.email, form.password, form.display_name, inviteToken || undefined);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.22),_transparent_28%),linear-gradient(180deg,_#f5f5f4_0%,_#fafaf9_100%)] px-4 dark:bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_25%),linear-gradient(180deg,_#09090b_0%,_#111827_100%)]">
      <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white/90 p-8 shadow-xl shadow-zinc-300/30 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80 dark:shadow-black/20">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create account</h1>
            {inviteInfo && (
              <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                Joining <strong>{inviteInfo.workspace_name}</strong> · invited by {inviteInfo.inviter_name}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="ml-3 shrink-0 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-white"
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Display name"
            required
            className="w-full rounded-lg bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-1 ring-zinc-300 placeholder:text-zinc-400 focus:ring-amber-400 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-600"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          />
          <input
            type="email"
            placeholder="Email"
            required
            className="w-full rounded-lg bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-1 ring-zinc-300 placeholder:text-zinc-400 focus:ring-amber-400 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-600"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="Password"
            required
            minLength={8}
            className="w-full rounded-lg bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-1 ring-zinc-300 placeholder:text-zinc-400 focus:ring-amber-400 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-600"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-950 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <Link to="/login" className="text-zinc-700 underline hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
