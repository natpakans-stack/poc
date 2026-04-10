import { useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { LoginModalProvider, useLoginModal } from './contexts/LoginModalContext'
import LoginModal from './components/auth/LoginModal'
import LandingPage from './pages/LandingPage'
import ChatPage from './pages/ChatPage'
import ReleasesPage from './pages/ReleasesPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const { openLogin } = useLoginModal()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !session) {
      openLogin()
      navigate('/', { replace: true })
    }
  }, [loading, session, openLogin, navigate])

  if (loading || !session) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/releases" element={<ReleasesPage />} />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
      </Routes>
      <LoginModal />
    </>
  )
}

export default function App() {
  return (
    <LoginModalProvider>
      <AppRoutes />
    </LoginModalProvider>
  )
}
