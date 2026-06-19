import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { CookieConsentProvider } from '@/contexts/CookieConsentContext'
import { api } from '@/services/api'

// Remove tokens legados do localStorage (migração para cookies httpOnly)
for (const key of ['access_token', 'refresh_token', 'token_expiry']) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

void api.initCsrf().catch(() => {
  /* backend offline — CSRF será obtido no primeiro request */
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CookieConsentProvider>
      <AuthProvider>
        <SettingsProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </SettingsProvider>
      </AuthProvider>
    </CookieConsentProvider>
  </StrictMode>,
)
