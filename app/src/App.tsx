import { useState } from 'react'
import { AppSidebar } from '@/components/global/AppSidebar'
import { GlobalCommand } from '@/components/global/GlobalCommand'
import { ThemeToggle } from '@/components/global/ThemeToggle'
import { Toast } from '@/components/global/Toast'
import { HomePage } from '@/pages/HomePage'
import { CalendarPage } from '@/pages/CalendarPage'
import { NotesPage } from '@/pages/NotesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { useTheme } from '@/hooks/useTheme'
import { useNotes } from '@/hooks/useNotes'
import { useSettings } from '@/hooks/useSettings'
import { cn } from '@/lib/utils'
import type { NewNoteInput } from '@/types/notes'

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">Em breve.</p>
      </div>
    </div>
  )
}

function App() {
  const { theme, toggleTheme } = useTheme()
  const { notes, addNote, deleteNote } = useNotes()
  const { settings, updateSettings } = useSettings()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState('home')
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null
  )

  const handleAddNote = (note: NewNoteInput) => {
    addNote(note)
    setToast({ id: Date.now(), message: 'Anotação salva em Anotações' })
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onAddNote={handleAddNote} />
      case 'calendar':
        return <CalendarPage notes={notes} />
      case 'notes':
        return <NotesPage notes={notes} onDeleteNote={deleteNote} />
      case 'payments':
        return <PlaceholderPage title="Pagamentos" />
      case 'settings':
        return (
          <SettingsPage
            settings={settings}
            onUpdateSettings={updateSettings}
            theme={theme}
            onToggleTheme={toggleTheme}
            noteCount={notes.length}
            onClearNotes={() => notes.forEach((n) => deleteNote(n.id))}
          />
        )
      default:
        return <HomePage onAddNote={handleAddNote} />
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        isCollapsed={isCollapsed}
        onCollapsedChange={setIsCollapsed}
        isCommandOpen={isCommandOpen}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        username={settings.username}
        displayName={settings.displayName}
      />
      <main
        className={cn(
          'min-w-0 flex-1 transition-[margin] duration-300',
          isCollapsed ? 'md:ml-16' : 'md:ml-64'
        )}
      >
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <GlobalCommand
          onToggleTheme={toggleTheme}
          onOpenChange={setIsCommandOpen}
          onNavigate={setCurrentPage}
        />
        {renderPage()}
      </main>

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          actionLabel="Ver"
          onAction={() => {
            setCurrentPage('notes')
            setToast(null)
          }}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

export default App
