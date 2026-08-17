import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PageLoadingSkeleton } from './components/motion/Skeleton'
import './index.css'

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const ReservationsPage = lazy(() =>
  import('./pages/ReservationsPage').then((m) => ({ default: m.ReservationsPage }))
)
const AccountPage = lazy(() => import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })))
const AuthCallbackPage = lazy(() =>
  import('./pages/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage }))
)

function RouteFallback() {
  return (
    <div className="min-h-screen bg-[#f8faf8] flex flex-col">
      <div className="bg-emerald-900 h-16" aria-hidden="true" />
      <PageLoadingSkeleton />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route
              path="/reservas"
              element={
                <ProtectedRoute>
                  <ReservationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/conta"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
