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
  CreditCard,
  Settings,
  Home,
  MoonStar,
  NotebookPen,
  PenLine,
} from 'lucide-react'

interface GlobalCommandProps {
  onToggleTheme: () => void
  onOpenChange?: (open: boolean) => void
  onNavigate?: (page: string) => void
}

export function GlobalCommand({ onToggleTheme, onOpenChange, onNavigate }: GlobalCommandProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

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
        <CommandInput placeholder="Digite um comando ou busque..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

          <CommandGroup heading="Navegação">
            <CommandItem onSelect={() => runAction(() => onNavigate?.('home'))}>
              <Home />
              <span>Página Inicial</span>
              <CommandShortcut>⌘H</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runAction(() => onNavigate?.('calendar'))}>
              <Calendar />
              <span>Calendário</span>
              <CommandShortcut>⌘C</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runAction(() => onNavigate?.('notes'))}>
              <NotebookPen />
              <span>Anotações</span>
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Ações Rápidas">
            <CommandItem onSelect={() => runAction(() => onNavigate?.('home'))}>
              <PenLine />
              <span>Nova Anotação</span>
              <CommandShortcut>⌘N</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Configurações">
            <CommandItem onSelect={() => runAction(onToggleTheme)}>
              <MoonStar />
              <span>Alternar Tema</span>
              <CommandShortcut>⌘J</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runAction(() => onNavigate?.('settings'))}>
              <Settings />
              <span>Configurações</span>
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runAction(() => {})}>
              <CreditCard />
              <span>Pagamento</span>
              <CommandShortcut>⌘B</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
