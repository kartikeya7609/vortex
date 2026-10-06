import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

/* Pages */
import { LoginPage }          from './pages/LoginPage';
import { OnboardingPage }     from './pages/OnboardingPage';
import { DashboardPage }      from './pages/DashboardPage';
import { ProfilePage }        from './pages/ProfilePage';
import { TeamPage }           from './pages/TeamPage';
import { RoundsPage }         from './pages/RoundsPage';
import { LeaderboardPage }    from './pages/LeaderboardPage';
import { HelpPage }           from './pages/HelpPage';
import { PuzzleGamePage }     from './pages/PuzzleGamePage';
import { DetectiveGamePage }  from './pages/DetectiveGamePage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public ── */}
          <Route path="/login" element={<LoginPage />} />

          {/* ── Onboarding (auth required, no profile required) ── */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute requireProfile={false}>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />

          {/* ── Participant protected pages (profile required) ── */}
          <Route path="/dashboard"     element={<ProtectedRoute requireProfile={true}><DashboardPage /></ProtectedRoute>} />
          <Route path="/profile"       element={<ProtectedRoute requireProfile={true}><ProfilePage /></ProtectedRoute>} />
          <Route path="/team"          element={<ProtectedRoute requireProfile={true}><TeamPage /></ProtectedRoute>} />
          <Route path="/rounds"        element={<ProtectedRoute requireProfile={true}><RoundsPage /></ProtectedRoute>} />
          <Route path="/leaderboard"   element={<ProtectedRoute requireProfile={true}><LeaderboardPage /></ProtectedRoute>} />
          <Route path="/help"          element={<ProtectedRoute requireProfile={true}><HelpPage /></ProtectedRoute>} />
          <Route path="/game"          element={<ProtectedRoute requireProfile={true}><PuzzleGamePage /></ProtectedRoute>} />
          <Route path="/detective"     element={<ProtectedRoute requireProfile={true}><DetectiveGamePage /></ProtectedRoute>} />

          {/* ── Admin protected panel ── */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin', 'super_admin']} requireProfile={false}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* ── Catch-all ── */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
