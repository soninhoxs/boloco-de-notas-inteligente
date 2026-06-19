import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, type User, type AuthResponse, ApiError } from '@/services/api'
import { LGPD_CONSENT_VERSION } from '@/lib/lgpd'
import { isGuestMode, setGuestMode } from '@/lib/lgpd'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isGuest: boolean
  isLoading: boolean
  error: string | null
}

interface RegisterInput {
  email: string
  password: string
  username: string
  displayName: string
  consentPrivacy: boolean
  consentTerms: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<AuthResponse>
  completeMfaLogin: (mfaToken: string, code: string) => Promise<void>
  register: (input: RegisterInput) => Promise<AuthResponse>
  refreshUser: () => Promise<void>
  logout: () => Promise<void>
  continueAsGuest: () => void
  completeOAuthCallback: (params: URLSearchParams) => void
  getOAuthUrl: (provider: 'google' | 'github', withConsent?: boolean) => string
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

function mapAuthError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback

  const body = error.details as { code?: string } | undefined
  if (error.status === 403 && body?.code === 'email_not_verified') {
    return 'auth.error.emailNotVerified'
  }
  if (error.status === 401) return 'auth.error.loginFailed'
  if (error.status === 409) return 'auth.error.registerFailed'

  return fallback
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isGuest: isGuestMode(),
    isLoading: true,
    error: null,
  })

  const fetchUser = useCallback(async () => {
    if (isGuestMode()) {
      setState((prev) => ({
        ...prev,
        isGuest: true,
        isLoading: false,
        isAuthenticated: false,
        user: null,
      }))
      return
    }

    try {
      const user = await api.users.getProfile()
      setGuestMode(false)
      setState({
        user,
        isAuthenticated: true,
        isGuest: false,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setState({
          user: null,
          isAuthenticated: false,
          isGuest: false,
          isLoading: false,
          error: null,
        })
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'auth.error.profileLoad',
        }))
      }
    }
  }, [])

  useEffect(() => {
    void fetchUser()
  }, [fetchUser])

  const login = useCallback(async (email: string, password: string): Promise<AuthResponse> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await api.auth.login(email, password)

      if (response.mfa_required && response.mfa_token) {
        setState((prev) => ({ ...prev, isLoading: false, error: null }))
        return response
      }

      if (!response.user) {
        throw new Error('missing user in login response')
      }

      setGuestMode(false)
      setState({
        user: response.user,
        isAuthenticated: true,
        isGuest: false,
        isLoading: false,
        error: null,
      })
      return response
    } catch (error) {
      const message = mapAuthError(error, 'auth.error.loginFailed')
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }))
      throw error
    }
  }, [])

  const completeMfaLogin = useCallback(async (mfaToken: string, code: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await api.auth.mfaLogin(mfaToken, code)
      if (!response.user) {
        throw new Error('missing user in mfa login response')
      }
      setGuestMode(false)
      setState({
        user: response.user,
        isAuthenticated: true,
        isGuest: false,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      const message = mapAuthError(error, 'auth.error.mfaFailed')
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }))
      throw error
    }
  }, [])

  const register = useCallback(async (input: RegisterInput): Promise<AuthResponse> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await api.auth.register(
        input.email,
        input.password,
        input.displayName,
        {
          consent_version: LGPD_CONSENT_VERSION,
          consent_privacy: input.consentPrivacy,
          consent_terms: input.consentTerms,
        }
      )

      if (response.email_verification_required) {
        setState((prev) => ({
          ...prev,
          user: response.user ?? null,
          isAuthenticated: false,
          isGuest: false,
          isLoading: false,
          error: null,
        }))
        return response
      }

      if (!response.user) {
        throw new Error('missing user in register response')
      }

      setGuestMode(false)
      setState({
        user: response.user,
        isAuthenticated: true,
        isGuest: false,
        isLoading: false,
        error: null,
      })
      return response
    } catch (error) {
      const message = mapAuthError(error, 'auth.error.registerFailed')
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }))
      throw error
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.auth.logout()
    } finally {
      setGuestMode(false)
      setState({
        user: null,
        isAuthenticated: false,
        isGuest: false,
        isLoading: false,
        error: null,
      })
    }
  }, [])

  const continueAsGuest = useCallback(() => {
    void api.auth.logout().finally(() => {
      setGuestMode(true)
      setState({
        user: null,
        isAuthenticated: false,
        isGuest: true,
        isLoading: false,
        error: null,
      })
    })
  }, [])

  const completeOAuthCallback = useCallback((params: URLSearchParams) => {
    const code = params.get('code')

    if (!code) {
      setState((prev) => ({
        ...prev,
        error: 'auth.error.oauthFailed',
        isLoading: false,
      }))
      return
    }

    void (async () => {
      try {
        await api.auth.exchangeOAuthCode(code)
        setGuestMode(false)
        await fetchUser()
      } catch {
        setState((prev) => ({
          ...prev,
          error: 'auth.error.oauthFailed',
          isLoading: false,
        }))
      }
    })()
  }, [fetchUser])

  const getOAuthUrl = useCallback((provider: 'google' | 'github', withConsent = false) => {
    const query = withConsent ? '?consent=1' : ''
    return `${API_BASE}/auth/${provider}${query}`
  }, [])

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      login,
      completeMfaLogin,
      register,
      refreshUser: fetchUser,
      logout,
      continueAsGuest,
      completeOAuthCallback,
      getOAuthUrl,
      clearError,
    }),
    [
      state,
      fetchUser,
      login,
      completeMfaLogin,
      register,
      logout,
      continueAsGuest,
      completeOAuthCallback,
      getOAuthUrl,
      clearError,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
