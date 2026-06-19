import { useState, useEffect } from 'react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import {
  Calendar,
  Settings,
  Home,
  MoonStar,
  NotebookPen,
  PenLine,
} from 'lucide-react'
import { useI18n } from '@/contexts/I18nContext'

interface GlobalCommandProps {
  onToggleTheme: () => void
  onOpenChange?: (open: boolean) => void
  onNavigate?: (page: string) => void
}

export function GlobalCommand({ onToggleTheme, onOpenChange, onNavigate }: GlobalCommandProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runAction = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command>
        <CommandInput placeholder={t('command.placeholder')} />
        <CommandList>
          <CommandEmpty>{t('command.empty')}</CommandEmpty>

          <CommandGroup heading={t('command.navigation')}>
            <CommandItem onSelect={() => runAction(() => onNavigate?.('home'))}>
              <Home />
              <span>{t('command.homePage')}</span>
              <CommandShortcut>⌘H</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runAction(() => onNavigate?.('notes'))}>
              <NotebookPen />
              <span>{t('nav.notes')}</span>
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runAction(() => onNavigate?.('calendar'))}>
              <Calendar />
              <span>{t('nav.calendar')}</span>
              <CommandShortcut>⌘C</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading={t('command.quickActions')}>
            <CommandItem onSelect={() => runAction(() => onNavigate?.('home'))}>
              <PenLine />
              <span>{t('command.newNote')}</span>
              <CommandShortcut>⌘N</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading={t('command.settingsGroup')}>
            <CommandItem onSelect={() => runAction(onToggleTheme)}>
              <MoonStar />
              <span>{t('command.toggleTheme')}</span>
              <CommandShortcut>⌘J</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runAction(() => onNavigate?.('settings'))}>
              <Settings />
              <span>{t('nav.settings')}</span>
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
