import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './lib/auth';
import { Landing } from './pages/Landing';
import { AuthPage } from './pages/Auth';
import { EventsIndex } from './pages/EventsIndex';
import { EventShell } from './pages/app/EventShell';
import { Dashboard } from './pages/app/Dashboard';
import { Phases } from './pages/app/Phases';
import { Guests } from './pages/app/Guests';
import { Seating } from './pages/app/Seating';
import { MenuPage } from './pages/app/MenuPage';
import { Tasks } from './pages/app/Tasks';
import { Budget } from './pages/app/Budget';
import { Comms } from './pages/app/Comms';
import { Media } from './pages/app/Media';
import { Ticketing } from './pages/app/Ticketing';
import { RunOfShow } from './pages/app/RunOfShow';
import { Settings } from './pages/app/Settings';
import { EventSite } from './pages/public/EventSite';
import { GuestPortal } from './pages/public/GuestPortal';
import { Loading } from './components/ui';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading label="Opening your workspace" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />

      {/* Guest-facing, no account required */}
      <Route path="/e/:slug" element={<EventSite />} />
      <Route path="/me/:token" element={<GuestPortal />} />
      <Route path="/i/:token" element={<GuestPortal invitation />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <EventsIndex />
          </RequireAuth>
        }
      />
      <Route
        path="/app/:eventId"
        element={
          <RequireAuth>
            <EventShell />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="phases" element={<Phases />} />
        <Route path="guests" element={<Guests />} />
        <Route path="seating" element={<Seating />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="budget" element={<Budget />} />
        <Route path="comms" element={<Comms />} />
        <Route path="media" element={<Media />} />
        <Route path="ticketing" element={<Ticketing />} />
        <Route path="run-of-show" element={<RunOfShow />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
