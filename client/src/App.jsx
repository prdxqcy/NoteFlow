import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import QuickCapturePage from './pages/QuickCapturePage';

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
