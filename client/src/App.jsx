import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import QuickCapturePage from './pages/QuickCapturePage';

function PublicSharePage() {
  const { token } = useParams();
  const [note, setNote] = useState(null);
  const [error, setError] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/productivity/public/${token}`)
      .then(async (response) => {
        const body = await response.json();
        if (body.password_required) setNeedsPassword(true);
        if (!response.ok) throw new Error(body.error);
        setNote(body);
      })
      .catch((requestError) => setError(requestError.message));
  }, [token]);
  if (needsPassword && !note) return <main className="mx-auto max-w-md p-8"><h1 className="text-xl font-semibold">Password-protected note</h1><form className="mt-4 flex gap-2" onSubmit={async (event) => { event.preventDefault(); const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/productivity/public/${token}/access`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); const body = await response.json(); if (response.ok) { setNote(body); setError(''); } else setError(body.error); }}><input className="min-w-0 flex-1 rounded-xl border px-3 py-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /><button className="rounded-xl bg-emerald-600 px-4 py-2 text-white">Open</button></form>{error && <p className="mt-2 text-sm text-red-500">{error}</p>}</main>;
  if (error) return <main className="mx-auto max-w-3xl p-8"><h1 className="text-xl font-semibold">{error}</h1></main>;
  if (!note) return <main className="p-8">Loading shared note...</main>;
  return (
    <main className="mx-auto min-h-screen max-w-3xl p-8">
      <p className="text-sm font-semibold text-emerald-600">Shared from Cove</p>
      <h1 className="mt-3 text-3xl font-bold">{note.title}</h1>
      <p className="mt-2 text-sm text-zinc-500">By {note.author_name}</p>
      <article className="mt-8 whitespace-pre-wrap rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">{note.content}</article>
    </main>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-zinc-500">Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const quickCaptureType =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('quickCapture')
      : null;

  return (
    <AuthProvider>
      {quickCaptureType ? (
        <RequireAuth>
          <QuickCapturePage initialType={quickCaptureType} />
        </RequireAuth>
      ) : (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/share/:token" element={<PublicSharePage />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
        </Routes>
      )}
    </AuthProvider>
  );
}
