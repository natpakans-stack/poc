import { createContext, useContext, useState, useCallback } from 'react'

interface LoginModalContextValue {
  isOpen: boolean
  openLogin: () => void
  closeLogin: () => void
}

const LoginModalContext = createContext<LoginModalContextValue | null>(null)

export function LoginModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openLogin = useCallback(() => setIsOpen(true), [])
  const closeLogin = useCallback(() => setIsOpen(false), [])

  return (
    <LoginModalContext.Provider value={{ isOpen, openLogin, closeLogin }}>
      {children}
    </LoginModalContext.Provider>
  )
}

export function useLoginModal() {
  const ctx = useContext(LoginModalContext)
  if (!ctx) throw new Error('useLoginModal must be used within LoginModalProvider')
  return ctx
}
