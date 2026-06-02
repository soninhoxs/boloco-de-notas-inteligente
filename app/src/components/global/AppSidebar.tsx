import { useState } from 'react'
import {
  Home,
  Settings,
  Calendar,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  NotebookPen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  id: string
  icon: React.ElementType
  label: string
  shortcut?: string
}

const navItems: NavItem[] = [
  { id: 'home', icon: Home, label: 'Início', shortcut: '⌘H' },
  { id: 'calendar', icon: Calendar, label: 'Calendário', shortcut: '⌘C' },
  { id: 'notes', icon: NotebookPen, label: 'Anotações', shortcut: '⌘P' },
  { id: 'payments', icon: CreditCard, label: 'Pagamentos' },
  { id: 'settings', icon: Settings, label: 'Configurações', shortcut: '⌘S' },
]

interface AppSidebarProps {
  isCollapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  isCommandOpen?: boolean
  currentPage: string
  onNavigate: (page: string) => void
  username?: string
  displayName?: string
}

export function AppSidebar({
  isCollapsed,
  onCollapsedChange,
  isCommandOpen = false,
  currentPage,
  onNavigate,
  username = 'jhss2',
  displayName,
}: AppSidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const shouldShowMenuButton = !isMobileOpen && !isCommandOpen;

  return (
    <>
      {/* Mobile menu button - only visible on mobile */}
      {shouldShowMenuButton && (
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className={cn(
            'fixed top-4 left-4 z-50 inline-flex size-10 items-center justify-center overflow-hidden rounded-lg border border-white/40 bg-white/10 text-foreground backdrop-blur-md transition-transform duration-300 hover:scale-105 active:scale-95 dark:border-white/10 dark:bg-white/5 md:hidden',
            'shadow-[inset_1px_1px_1px_-0.5px_rgba(255,255,255,0.7),inset_-1px_-1px_1px_-0.5px_rgba(0,0,0,0.25),0_4px_14px_rgba(0,0,0,0.12)]'
          )}
          aria-label="Abrir menu"
        >
          <Menu className="size-5" />
        </button>
      )}

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar transition-all duration-300",
          "flex flex-col",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
          isCollapsed ? "md:w-16" : "md:w-64",
          "w-64"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <div
            className={cn(
              "flex items-center gap-2 overflow-hidden transition-opacity",
              isCollapsed && "md:opacity-0"
            )}
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-bold">A</span>
            </div>
            <span className="font-semibold text-sidebar-foreground">App</span>
          </div>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="inline-flex md:hidden size-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            aria-label="Fechar menu"
          >
            <X className="size-4" />
          </button>

          {/* Desktop toggle button */}
          <button
            type="button"
            onClick={() => onCollapsedChange(!isCollapsed)}
            className="hidden md:inline-flex size-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            aria-label={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id)
                setIsMobileOpen(false)
              }}
              aria-current={currentPage === item.id ? 'page' : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                currentPage === item.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon className="size-5 shrink-0" />
              <span
                className={cn(
                  "flex-1 text-left",
                  isCollapsed && "md:hidden"
                )}
              >
                {item.label}
              </span>
              {item.shortcut && !isCollapsed && (
                <span className="text-xs text-muted-foreground hidden md:block">
                  {item.shortcut}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          <div
            className={cn(
              "flex items-center gap-3",
              isCollapsed && "md:justify-center"
            )}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {(displayName || username).slice(0, 2).toUpperCase()}
            </div>
            <div
              className={cn(
                "flex-1 overflow-hidden",
                isCollapsed && "md:hidden"
              )}
            >
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {displayName || username}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">
                @{username}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
