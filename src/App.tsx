import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLoadingScreen } from './components/AppLoadingScreen';

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Clients = lazy(() => import('./pages/Clients').then((module) => ({ default: module.Clients })));
const Loans = lazy(() => import('./pages/Loans').then((module) => ({ default: module.Loans })));
const Payments = lazy(() => import('./pages/Payments').then((module) => ({ default: module.Payments })));
const Financial = lazy(() => import('./pages/Financial').then((module) => ({ default: module.Financial })));
const Analytics = lazy(() => import('./pages/Analytics').then((module) => ({ default: module.Analytics })));
const Settings = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })));
const Calendar = lazy(() => import('./pages/Calendar').then((module) => ({ default: module.Calendar })));
const Support = lazy(() => import('./pages/Support').then((module) => ({ default: module.Support })));
const Admin = lazy(() => import('./pages/Admin').then((module) => ({ default: module.Admin })));
const ActivityLog = lazy(() => import('./pages/ActivityLog').then((module) => ({ default: module.ActivityLog })));
const SearchResults = lazy(() => import('./pages/SearchResults').then((module) => ({ default: module.SearchResults })));
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const Signup = lazy(() => import('./pages/Signup').then((module) => ({ default: module.Signup })));

export default function App() {
  return (
    <Router>
      <Suspense fallback={<AppLoadingScreen />}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <ProtectedRoute>
                <Clients />
              </ProtectedRoute>
            }
          />
          <Route
            path="/loans"
            element={
              <ProtectedRoute>
                <Loans />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payments"
            element={
              <ProtectedRoute>
                <Payments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/financial"
            element={
              <ProtectedRoute>
                <Financial />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <Calendar />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/support"
            element={
              <ProtectedRoute>
                <Support />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activity"
            element={
              <ProtectedRoute>
                <ActivityLog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchResults />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
