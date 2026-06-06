import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function GoogleCalendarConnect() {
  const [status, setStatus] = useState(null); // null | { connected, google_email }
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    api.googleStatus().then(setStatus).catch(() => setStatus({ connected: false }));
  }, []);

  // Handle redirect back from OAuth
  useEffect(() => {
    const result = searchParams.get('google');
    const account = searchParams.get('account');
    if (result === 'connected') {
      setStatus({ connected: true, google_email: account ? decodeURIComponent(account) : '' });
      // Clean up URL params
      const next = new URLSearchParams(searchParams);
      next.delete('google');
      next.delete('account');
      setSearchParams(next, { replace: true });
    } else if (result === 'denied' || result === 'error') {
      const next = new URLSearchParams(searchParams);
      next.delete('google');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  async function handleConnect() {
    try {
      const { url } = await api.googleConnectUrl();
      // Full redirect — Google OAuth requires same-window navigation
      window.location.href = url;
    } catch (err) {
      console.error('Failed to get Google OAuth URL:', err);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      await api.googleDisconnect();
      setStatus({ connected: false, google_email: null });
    } finally {
      setLoading(false);
    }
  }

  if (!status) {
    return <div className="h-9 w-48 animate-pulse rounded-lg bg-zinc-800" />;
  }

  if (status.connected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
          <GoogleIcon />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100">Google Calendar</p>
          <p className="truncate text-xs text-zinc-500">{status.google_email}</p>
        </div>
        <span className="shrink-0 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
          Connected
        </span>
        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-600 hover:text-red-400 disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
        <GoogleIcon />
      </div>
      Connect Google Calendar
    </button>
  );
}
