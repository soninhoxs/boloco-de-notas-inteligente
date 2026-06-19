import { useState } from 'react'
import {
  Home,
  Settings,
  Calendar,
  ChevronLeft,
  Menu,
  X,
  NotebookPen,
} from 'lucide-react'
import { useI18n } from '@/contexts/I18nContext'
import { chromeIconButtonClass } from '@/components/global/ThemeToggle'
import { cn } from '@/lib/utils'

interface AppSidebarProps {
  isCollapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  isCommandOpen?: boolean
  currentPage: string
  onNavigate: (page: string) => void
  username?: string
  displayName?: string
  isMobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
  showFixedMenuButton?: boolean
}

export function AppSidebar({
  isCollapsed,
  onCollapsedChange,
  isCommandOpen = false,
  currentPage,
  onNavigate,
  username = '',
  displayName,
  isMobileOpen: isMobileOpenProp,
  onMobileOpenChange,
  showFixedMenuButton = true,
}: AppSidebarProps) {
  const { t } = useI18n()
  const [internalMobileOpen, setInternalMobileOpen] = useState(false)
  const isMobileOpen = isMobileOpenProp ?? internalMobileOpen
  const setIsMobileOpen = onMobileOpenChange ?? setInternalMobileOpen

  const navItems = [
    { id: 'home', icon: Home, label: t('nav.home'), shortcut: '⌘H' },
    { id: 'notes', icon: NotebookPen, label: t('nav.notes'), shortcut: '⌘P' },
    { id: 'calendar', icon: Calendar, label: t('nav.calendar'), shortcut: '⌘C' },
    { id: 'settings', icon: Settings, label: t('nav.settings'), shortcut: '⌘S' },
  ]

  const brandName = t('home.title')
  const brandInitial = brandName.trim().charAt(0).toUpperCase() || '?'

  const shouldShowMenuButton =
    showFixedMenuButton && !isMobileOpen && !isCommandOpen

  return (
    <>
      {shouldShowMenuButton && (
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className={cn(
            chromeIconButtonClass,
            'fixed top-4 left-4 z-50 lg:hidden'
          )}
          aria-label={t('nav.openMenu')}
        >
          <Menu className="size-5" />
        </button>
      )}

      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar transition-all duration-300",
          "flex flex-col",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
          isCollapsed ? "lg:w-16" : "lg:w-64",
          "w-64"
        )}
      >
        <div
          className={cn(
            'flex h-14 shrink-0 items-center border-b border-sidebar-border',
            isCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between px-3',
            !isCollapsed && 'gap-2'
          )}
        >
          <div
            className={cn(
              'flex min-w-0 items-center gap-2 overflow-hidden',
              isCollapsed && 'lg:hidden'
            )}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-bold">{brandInitial}</span>
            </div>
            <span className="truncate font-semibold text-sidebar-foreground">
              {brandName}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent lg:hidden"
            aria-label={t('nav.closeMenu')}
          >
            <X className="size-5" />
          </button>

          <button
            type="button"
            onClick={() => onCollapsedChange(!isCollapsed)}
            className="hidden size-9 shrink-0 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent lg:inline-flex"
            aria-label={isCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
          >
            {isCollapsed ? (
              <Menu className="size-5" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </button>
        </div>

        <nav
          className={cn(
            'flex-1 space-y-1 overflow-y-auto py-2',
            isCollapsed ? 'lg:px-1' : 'px-3'
          )}
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id)
                setIsMobileOpen(false)
              }}
              aria-current={currentPage === item.id ? 'page' : undefined}
              aria-label={isCollapsed ? item.label : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                isCollapsed ? 'lg:justify-center lg:gap-0 lg:px-0' : 'px-0',
                currentPage === item.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon className="size-5 shrink-0" />
              <span
                className={cn(
                  "flex-1 text-left",
                  isCollapsed && "lg:hidden"
                )}
              >
                {item.label}
              </span>
              {item.shortcut && !isCollapsed && (
                <span className="hidden text-xs text-muted-foreground lg:block">
                  {item.shortcut}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div
          className={cn(
            'border-t border-sidebar-border',
            isCollapsed ? 'lg:p-2' : 'px-3 py-4'
          )}
        >
          <div
            className={cn(
              'flex items-center gap-3',
              isCollapsed && 'lg:justify-center lg:gap-0'
            )}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {(displayName || username || t('settings.profileEmptyName'))
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div
              className={cn(
                "flex-1 overflow-hidden",
                isCollapsed && "lg:hidden"
              )}
            >
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {displayName || username || t('settings.profileEmptyName')}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">
                {username ? `@${username}` : t('settings.profileNoUsername')}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
