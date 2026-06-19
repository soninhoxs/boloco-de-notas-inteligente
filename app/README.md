# Mega Brain

App de anotações pessoais com mapas, anexos e calendário.

> Documentação geral do monorepo (backend, deploy, scripts PowerShell, o que pode ir no Git): **[README na raiz](../README.md)**

## 📁 Estrutura do Projeto

```
src/
├── components/
│   ├── global/          # Componentes específicos do app
│   │   ├── AppSidebar.tsx
│   │   ├── GlobalCommand.tsx
│   │   ├── LocationPicker.tsx
│   │   ├── MonthlyCalendar.tsx
│   │   ├── ThemeToggle.tsx
│   │   ├── ThoughtComposer.tsx
│   │   └── Toast.tsx
│   └── ui/              # Componentes reutilizáveis shadcn
│       ├── button.tsx
│       ├── command.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── liquid-glass.tsx
│       ├── mapcn-map-controls.tsx
│       ├── pagination.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       ├── sidebar.tsx
│       ├── skeleton.tsx
│       ├── textarea.tsx
│       └── tooltip.tsx
├── hooks/               # React hooks personalizados
│   ├── use-mobile.ts
│   ├── useNotes.ts
│   ├── useSettings.ts
│   └── useTheme.ts
├── lib/                 # Utilitários
│   └── utils.ts
├── pages/               # Páginas do app
│   ├── CalendarPage.tsx
│   ├── HomePage.tsx
│   ├── NotesPage.tsx
│   └── SettingsPage.tsx
├── types/               # Definições de tipos TypeScript
│   ├── index.ts
│   ├── notes.ts
│   └── settings.ts
├── App.tsx              # Componente raiz
├── main.tsx             # Entry point
└── index.css            # Estilos globais (Tailwind + CSS vars)
```

## 🚀 Tecnologias

- **React 19** com TypeScript
- **Vite** para build e dev server
- **Tailwind CSS** para estilização
- **shadcn/ui** para componentes base
- **MapLibre GL** para mapas interativos
- **localStorage** para modo convidado; **API REST** para usuários logados (notas na nuvem)

## ⚙️ Features

- ✅ **Anotações** com texto, tags rápidas (💡 Ideia, ✅ Tarefa, 🙏 Gratidão, 🔔 Lembrete)
- 📷 **Anexos** - suporte para imagens e PDFs
- 🗺️ **Localização** - marcar local no mapa com descrição da tarefa
- 📅 **Calendário** - visualização de anotações por data (heatmap)
- ⚙️ **Configurações** - perfil, tema, notificações, idioma
- 🌓 **Tema claro/escuro** com detecção automática
- 📱 **Responsivo** - funciona em desktop e mobile

## Desenvolvimento

```bash
cd app
npm install
npm run dev
```

Deploy, notebook e link público para testes: veja [README na raiz](../README.md).

## 📝 Convenções

- **Componentes** - PascalCase (ex: `ThoughtComposer.tsx`)
- **Hooks** - camelCase com prefixo `use` (ex: `useNotes.ts`)
- **Types** - PascalCase para interfaces/types (ex: `Note`, `Settings`)
- **Utilitários** - camelCase (ex: `cn`, `loadSettings`)
- **CSS** - Tailwind classes inline + CSS variables para temas
- **Imports** - Usar alias `@/` para imports absolutos

## 📦 Dados

**Modo convidado** — dados no `localStorage` (requer cookies aceitos):

- `thoughts` — anotações locais
- `app_settings` — preferências
- `theme` — tema claro/escuro

**Conta logada** — anotações e configurações sincronizam com o backend (`/api/v1`). Chaves de IA ficam apenas no dispositivo.

Rotas do app: `/`, `/notas`, `/calendario`, `/configuracoes`.
