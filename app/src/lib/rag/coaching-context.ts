import type { NoteCategory } from '@/lib/note-tags'
import { detectNoteCategory, stripNoteTagPrefix } from '@/lib/note-tags'
import { tokenize, type RagChunk } from '@/lib/rag/retrieve-notes'

export type CoachingIntent = 'practical' | 'development'

const DEVELOPMENT_PATTERNS = [
  /\b(estudar|aprender|curso|cursos|carreira|mercado\s+de\s+trabalho|profissional|portf[oó]lio|implementar|desenvolver|programar|dominar|trilha|vaga|entrevista|virar\s+dev)\b/i,
  /\b(llm|llms|machine\s+learning|inteligencia\s+artificial|typescript|react|python|backend|frontend|fullstack|langchain)\b/i,
  /\b(como\s+entrar|preparar\s+para|especializa)/i,
]

const PRACTICAL_PATTERNS = [
  /\b(hoje|agora|rápid[oa]|rapido|facil|fácil|simples|prátic[oa]|pratico)\b/i,
  /\b(comida|receita|jantar|almoço|almoco|café|cafe|lanche|cozinhar|comer)\b/i,
  /\b(ideias?\s+de|sugest[oõ]es?\s+de|exemplos?\s+de|o\s+que\s+(fazer|comer|assistir|ver|cozinhar))\b/i,
  /\b(filme|série|serie|presente|viagem|look|roupa|jogo)\b/i,
]

const FOOD_TOPIC = /\b(comida|receita|jantar|almoço|almoco|café|cafe|lanche|cozinhar|comer|refeição|refeicao)\b/i
const CAREER_FOOD =
  /\b(carreira|profissional|curso|estudar|mercado|chef|culinaria|culinária|gastronomia)\b/i

export function detectCoachingIntent(query: string): CoachingIntent {
  const body = stripNoteTagPrefix(query).trim().toLowerCase()

  if (FOOD_TOPIC.test(body) && !CAREER_FOOD.test(body)) {
    return 'practical'
  }

  const hasDevelopment = DEVELOPMENT_PATTERNS.some((pattern) => pattern.test(body))
  const hasPractical = PRACTICAL_PATTERNS.some((pattern) => pattern.test(body))

  if (hasDevelopment && !hasPractical) return 'development'
  if (hasPractical && !hasDevelopment) return 'practical'

  if (hasPractical && hasDevelopment) {
    if (/\b(hoje|agora|rápid|rapido|facil|fácil|simples)\b/i.test(body)) {
      return 'practical'
    }
    return 'development'
  }

  if (body.length < 70 && !hasDevelopment) return 'practical'

  return 'development'
}

export interface ProblemPart {
  label: string
  hint: string
}

export interface CoachingFrame {
  objective: string
  centralTopics: string[]
  parts: ProblemPart[]
  reflectionQuestions: string[]
  studyAngles: string[]
  progressionStages: ProgressionStage[]
  intent: CoachingIntent
}

export interface ProgressionStage {
  level: string
  focus: string
  deliverables: string
}

const LLM_PROGRESSION: Omit<ProgressionStage, 'level'>[] = [
  {
    focus:
      'Python, APIs REST, HTTP, Git; conceitos de transformer, tokens e inferência; curso introdutório (DeepLearning.AI ou Hugging Face)',
    deliverables:
      'script que chama API de LLM + resumo escrito dos conceitos base',
  },
  {
    focus:
      'prompt engineering, RAG, embeddings, LangChain/LlamaIndex; fine-tuning conceitual; avaliação básica de respostas',
    deliverables:
      'chatbot com RAG sobre documentos próprios + métricas simples de qualidade',
  },
  {
    focus:
      'arquitetura de sistemas com LLM, custo/latência, guardrails, observabilidade, deploy (Docker, serverless), avaliação em produção',
    deliverables:
      'serviço deployado com monitoramento, limites de custo e testes de regressão',
  },
  {
    focus:
      'portfólio GitHub com 2–3 projetos end-to-end; contribuição open source; perfis AI Engineer / ML Engineer; entrevistas técnicas (system design + coding)',
    deliverables:
      'README com arquitetura, demo online e post explicando trade-offs',
  },
]

const WEB_DEV_PROGRESSION: Omit<ProgressionStage, 'level'>[] = [
  {
    focus: 'HTML, CSS, JavaScript, Git; fundamentos de rede e DOM',
    deliverables: '3 páginas estáticas responsivas no GitHub',
  },
  {
    focus: 'React ou framework escolhido, TypeScript, APIs, estado e roteamento',
    deliverables: 'app CRUD consumindo API pública com testes básicos',
  },
  {
    focus: 'performance, acessibilidade, testes E2E, CI/CD, arquitetura de componentes',
    deliverables: 'app com pipeline de deploy e documentação de decisões',
  },
  {
    focus: 'portfólio profissional, projetos freelance ou open source, preparação para entrevistas front-end',
    deliverables: 'case study de projeto real com métricas de impacto',
  },
]

const GENERIC_PROGRESSION: Omit<ProgressionStage, 'level'>[] = [
  {
    focus: 'vocabulário essencial, pré-requisitos e um material introdutório reconhecido na área',
    deliverables: 'mapa mental ou resumo do que já domina vs. lacunas',
  },
  {
    focus: 'prática guiada, projetos pequenos, feedback de pares ou comunidade',
    deliverables: 'primeiro projeto completo documentado',
  },
  {
    focus: 'profundidade técnica, edge cases, padrões da indústria e autonomia',
    deliverables: 'projeto desafiador com documentação de processo',
  },
  {
    focus: 'portfólio, networking, vagas e perfis profissionais típicos na área',
    deliverables: 'perfil LinkedIn/GitHub alinhado + projeto showcase',
  },
]

const LEVEL_LABELS = [
  'Nível 1 — Fundamentos',
  'Nível 2 — Intermediário',
  'Nível 3 — Avançado',
  'Nível 4 — Mercado de trabalho',
] as const

const TOPIC_STUDY_HINTS: [RegExp, string][] = [
  [/\b(llm|llms|gpt|openai|groq|langchain|rag|deepseek)\b/i, 'cursos DeepLearning.AI, Hugging Face LLM Course e documentação oficial de APIs'],
  [/\b(ia|inteligencia artificial|machine learning|ml)\b/i, 'fast.ai, Andrew Ng (Coursera) e projetos aplicados com dataset real'],
  [/\b(implementar|implementacao|integrar|integracao|sistema|app|aplicacao)\b/i, 'arquitetura em camadas, protótipo mínimo e critérios de pronto por fase'],
  [/\b(estudar|aprender|curso|livro|mercado|trabalho|carreira|profissional)\b/i, 'trilha com marcos mensuráveis e projetos para portfólio'],
  [/\b(python|javascript|typescript|react|api)\b/i, 'documentação oficial, projeto mínimo funcionando e depois refatoração com testes'],
  [/\b(receita|cozinha|culinaria|comida)\b/i, 'pratos rápidos com poucos ingredientes e tempo estimado'],
  [/\b(negocio|startup|empreender|validar)\b/i, 'Lean Startup, entrevistas com usuários e MVP com métricas'],
]

const TASK_PARTS_TEMPLATE: Omit<ProblemPart, 'hint'>[] = [
  { label: 'Objetivo' },
  { label: 'Pré-requisitos prováveis' },
  { label: 'Obstáculos comuns' },
  { label: 'Menor primeiro passo' },
  { label: 'Ângulo de leitura' },
]

const IDEA_PARTS_TEMPLATE: Omit<ProblemPart, 'hint'>[] = [
  { label: 'Contexto da ideia' },
  { label: 'Incógnitas principais' },
  { label: 'O que validar primeiro' },
  { label: 'Menor experimento' },
  { label: 'Ângulo de leitura' },
]

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1)}…`
}

function inferProgressionTemplate(query: string): Omit<ProgressionStage, 'level'>[] {
  const normalized = query.toLowerCase()
  if (/\b(llm|llms|gpt|langchain|rag|deepseek|openai|groq)\b/i.test(normalized)) {
    return LLM_PROGRESSION
  }
  if (/\b(react|typescript|javascript|frontend|front-end|web|fullstack|full-stack)\b/i.test(normalized)) {
    return WEB_DEV_PROGRESSION
  }
  return GENERIC_PROGRESSION
}

function buildProgressionStages(query: string): ProgressionStage[] {
  const template = inferProgressionTemplate(query)
  return LEVEL_LABELS.map((level, index) => ({
    level,
    focus: template[index]?.focus ?? '',
    deliverables: template[index]?.deliverables ?? '',
  }))
}

function uniqueTokens(tokens: string[], limit: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const token of tokens) {
    if (seen.has(token)) continue
    seen.add(token)
    result.push(token)
    if (result.length >= limit) break
  }
  return result
}

function inferStudyAngles(query: string, topics: string[]): string[] {
  const angles = new Set<string>()
  const normalized = query.toLowerCase()

  for (const [pattern, hint] of TOPIC_STUDY_HINTS) {
    if (pattern.test(normalized)) angles.add(hint)
  }

  if (topics.length > 0) {
    angles.add(
      `material introdutório ou capítulo inicial sobre: ${topics.slice(0, 3).join(', ')}`
    )
  }

  if (angles.size === 0) {
    angles.add('um guia introdutório ou documentação oficial do tema central')
  }

  return [...angles].slice(0, 3)
}

function buildReflectionQuestions(
  query: string,
  category: 'idea' | 'task',
  topics: string[],
  intent: CoachingIntent
): string[] {
  const topicSample = topics.slice(0, 2).join(' e ') || 'este tema'
  const shortQuery = truncate(query, 80)

  if (intent === 'practical') {
    return [
      `Quanto tempo você tem disponível agora para "${shortQuery}"?`,
      `Quais ingredientes ou recursos você já tem em casa?`,
      `Prefere algo mais leve, reconfortante ou sem fogão?`,
    ]
  }

  if (category === 'task') {
    return [
      `Em qual dos 4 níveis (fundamentos → mercado) você está hoje em "${shortQuery}"?`,
      `Que projeto no portfólio provaria que você está pronto para vagas em ${topicSample}?`,
      `Qual lacuna técnica mais te impede de avançar para o próximo nível?`,
    ]
  }

  return [
    `Esta ideia sobre ${topicSample} é hobby, transição de carreira ou especialização profissional?`,
    `Que entregável de portfólio tornaria a ideia credível para um recrutador?`,
    `Qual seria o menor projeto do Nível 2 que valida se vale aprofundar?`,
  ]
}

function buildPartHints(
  query: string,
  category: 'idea' | 'task',
  topics: string[],
  studyAngles: string[]
): ProblemPart[] {
  const template =
    category === 'task' ? TASK_PARTS_TEMPLATE : IDEA_PARTS_TEMPLATE
  const topicLabel = topics.slice(0, 4).join(', ') || 'o tema descrito'

  const hints: Record<string, string> =
    category === 'task'
      ? {
          Objetivo: truncate(query, 160),
          'Pré-requisitos prováveis':
            studyAngles[0] ??
            'mapear o que você já sabe antes de avançar',
          'Obstáculos comuns':
            'escopo amplo demais, falta de critério de pronto, ou pular etapas base',
          'Menor primeiro passo':
            'mapear em qual nível da trilha (1–4) você está e definir entregável da semana',
          'Ângulo de leitura': studyAngles.join('; ') || `introdução a ${topicLabel}`,
        }
      : {
          'Contexto da ideia': truncate(query, 160),
          'Incógnitas principais': `aspectos ainda pouco claros sobre ${topicLabel}`,
          'O que validar primeiro':
            'se o problema é real, se há interesse, e se existe caminho mínimo viável',
          'Menor experimento':
            'um teste rápido, conversa com alguém, ou rascunho de 15 minutos',
          'Ângulo de leitura': studyAngles.join('; ') || `referências introdutórias sobre ${topicLabel}`,
        }

  return template.map((part) => ({
    label: part.label,
    hint: hints[part.label] ?? '',
  }))
}

export function buildCoachingFrame(
  query: string,
  category: 'idea' | 'task',
  intent: CoachingIntent = detectCoachingIntent(query)
): CoachingFrame {
  const body = stripNoteTagPrefix(query).trim()
  const centralTopics = uniqueTokens(tokenize(body), 6)
  const studyAngles = inferStudyAngles(body, centralTopics)
  const parts = buildPartHints(body, category, centralTopics, studyAngles)
  const progressionStages =
    intent === 'development' ? buildProgressionStages(body) : []
  const reflectionQuestions = buildReflectionQuestions(
    body,
    category,
    centralTopics,
    intent
  )

  return {
    objective: truncate(body, 200),
    centralTopics,
    parts,
    reflectionQuestions,
    studyAngles,
    progressionStages,
    intent,
  }
}

function getMatchedTokens(query: string, noteText: string): string[] {
  const queryTokens = new Set(tokenize(query))
  const noteTokens = tokenize(stripNoteTagPrefix(noteText))
  return uniqueTokens(
    noteTokens.filter((token) => queryTokens.has(token)),
    5
  )
}

function formatNoteCategory(category: NoteCategory | null): string {
  if (category === 'idea') return 'ideia'
  if (category === 'task') return 'tarefa'
  if (category === 'gratitude') return 'gratidão'
  if (category === 'reminder') return 'lembrete'
  return 'nota'
}

function formatEnrichedChunk(
  chunk: RagChunk,
  index: number,
  query: string
): string {
  const date = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(chunk.createdAt))

  const body = truncate(stripNoteTagPrefix(chunk.text), 200)
  const noteCategory = detectNoteCategory(chunk.text)
  const matched =
    chunk.matchedTokens ?? getMatchedTokens(query, chunk.text)
  const overlap =
    matched.length > 0
      ? `temas em comum: ${matched.join(', ')}`
      : 'relacionada por contexto geral'

  return `[${index}] (${formatNoteCategory(noteCategory)}, ${date}) ${body} — ${overlap}`
}

function buildProgressionSection(stages: ProgressionStage[]): string {
  const lines = stages
    .map(
      (stage) =>
        `  ${stage.level}: foco — ${stage.focus}; entregável — ${stage.deliverables}`
    )
    .join('\n')

  return `<trilha_progressao>
${lines}
Ação imediata: escolher o nível atual e executar o menor entregável em 1–3 dias.
</trilha_progressao>`
}

function buildPracticalIntentSection(frame: CoachingFrame): string {
  const topicHint = FOOD_TOPIC.test(frame.objective.toLowerCase())
    ? 'Liste pratos reais (nome + tempo + ingredientes + preparo em 1 linha). Ex.: omelete, sanduíche, macarrão alho e óleo, salada com atum.'
    : 'Dê exemplos concretos e acionáveis diretamente relacionados ao pedido — sem cursos nem teoria.'

  return `<intencao_detectada>
modo: prática_imediata
pedido: ${frame.objective}
instrução: ${topicHint}
PROIBIDO neste modo: trilha de estudo, níveis fundamentais, Coursera, carreira, vocabulário teórico.
</intencao_detectada>`
}

function buildFrameSection(frame: CoachingFrame): string {
  const intentBlock =
    frame.intent === 'practical'
      ? buildPracticalIntentSection(frame)
      : buildProgressionSection(frame.progressionStages)
  const parts = frame.parts
    .map((part) => `  - ${part.label}: ${part.hint}`)
    .join('\n')

  const questions = frame.reflectionQuestions
    .map((q) => `  - ${q}`)
    .join('\n')

  const topics =
    frame.centralTopics.length > 0
      ? frame.centralTopics.join(', ')
      : '(não identificados)'

  return `${intentBlock}
<decomposicao_problema>
Objetivo: ${frame.objective}
Temas centrais: ${topics}
Partes para orientar o usuário:
${parts}
</decomposicao_problema>
<perguntas_reflexivas>
${questions}
</perguntas_reflexivas>`
}

function buildNotesSection(chunks: RagChunk[], query: string): string {
  if (chunks.length === 0) {
    return `<anotacoes_relacionadas>
(nenhuma anotação relacionada encontrada no diário)
</anotacoes_relacionadas>`
  }

  const lines = chunks.map((chunk, index) =>
    formatEnrichedChunk(chunk, index + 1, query)
  )

  return `<anotacoes_relacionadas>
${lines.join('\n')}
</anotacoes_relacionadas>`
}

export function buildCoachingContext(
  query: string,
  category: NoteCategory,
  chunks: RagChunk[],
  intent: CoachingIntent = detectCoachingIntent(query)
): string {
  if (category !== 'idea' && category !== 'task') return ''

  const frame = buildCoachingFrame(query, category, intent)

  return `<contexto_coaching>
${buildFrameSection(frame)}
${buildNotesSection(chunks, query)}
</contexto_coaching>`
}
