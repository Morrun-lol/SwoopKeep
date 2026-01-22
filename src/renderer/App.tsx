import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Voice from './pages/Voice'
import Statistics from './pages/Statistics'
import History from './pages/History'
import Settings from './pages/Settings'
import BudgetConfig from './pages/BudgetConfig'
import UserLedger from './pages/UserLedger'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import Config from './pages/Config'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider, useAuth } from './context/AuthContext'
import { isSupabaseConfigured } from './lib/runtimeConfig'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  
  if (loading) {
      return <div className="h-screen flex items-center justify-center text-emerald-600">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
  }
  
  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  const needsConfig = !window.electron && !isSupabaseConfigured()

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
            <Routes>
              <Route path="/config" element={<Config />} />

              {needsConfig ? (
                <Route path="*" element={<Navigate to="/config" replace />} />
              ) : null}

              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              {/* Protected Routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout>
                    <Home />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/voice" element={
                <ProtectedRoute>
                  <Layout>
                    <Voice />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/statistics" element={
                <ProtectedRoute>
                  <Layout>
                    <Statistics />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/history" element={
                <ProtectedRoute>
                  <Layout>
                    <History />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/budget-config" element={
                <ProtectedRoute>
                  <Layout>
                    <BudgetConfig />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/user-ledger" element={
                <ProtectedRoute>
                  <Layout>
                    <UserLedger />
                  </Layout>
                </ProtectedRoute>
              } />
            </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
