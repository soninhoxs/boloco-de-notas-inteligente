export const APP_ROUTES = {
  home: '/',
  notes: '/notas',
  calendar: '/calendario',
  settings: '/configuracoes',
} as const

export type AppPageId = keyof typeof APP_ROUTES

const PAGE_BY_PATH: Record<string, AppPageId> = {
  [APP_ROUTES.home]: 'home',
  [APP_ROUTES.notes]: 'notes',
  [APP_ROUTES.calendar]: 'calendar',
  [APP_ROUTES.settings]: 'settings',
}

export function pageFromPath(pathname: string): AppPageId {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  return PAGE_BY_PATH[normalized] ?? 'home'
}

export function pathFromPage(page: string): string {
  if (page in APP_ROUTES) {
    return APP_ROUTES[page as AppPageId]
  }
  return APP_ROUTES.home
}

export function settingsPathWithFocus(target?: 'ai' | 'ai-key'): string {
  if (!target) return APP_ROUTES.settings
  return `${APP_ROUTES.settings}?focus=${target}`
}
