import { AiServiceError } from '@/services/ai-errors'

const MAX_INPUT_CHARS = 1500
const MAX_SUGGESTION_CHARS = 520
const MIN_SUGGESTIONS = 5
const MAX_SUGGESTIONS = 5

const RATE_LIMIT_KEY = 'ai_rate_limit_v1'
const RATE_LIMIT_MAX = 40
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

interface RateLimitState {
  count: number
  resetAt: number
}

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|system)\s/i,
  /you\s+are\s+now\s+/i,
  /act\s+as\s+(a\s+)?/i,
  /modo\s+(desenvolvedor|developer|admin|jailbreak)/i,
  /ignore\s+as\s+instruções/i,
  /esqueça\s+(todas\s+)?as\s+instruções/i,
  /finja\s+que\s+(você|nao)/i,
  /sem\s+restrições/i,
  /without\s+restrictions/i,
  /do\s+anything\s+now/i,
  /<\/?system>/i,
  /\[INST\]/i,
  /###\s*instruction/i,
  /override\s+(safety|security)/i,
  /bypass\s+(safety|filter|moderation)/i,
  /desativ(e|ar)\s+(filtro|segurança|moderação)/i,
]

/** Frases inofensivas com verbos como "matar" */
const BENIGN_PHRASE_PATTERNS = [
  /\bmatar\s+(a\s+)?fome\b/i,
  /\bmatar\s+saudades\b/i,
  /\bmatar\s+tempo\b/i,
  /\bmatar\s+(o\s+)?t[eê]dio\b/i,
  /\bmatar\s+a\s+curiosidade\b/i,
  /\bmatar\s+vermes?\b/i,
  /\bmatar\s+formigas?\b/i,
  /\bmatar\s+mosquitos?\b/i,
]

const HARMFUL_INTENT_PATTERNS = [
  // Violência contra pessoas (ordem flexível + typos comuns)
  /\b(como|quero|posso|ways?\s+to|how\s+to)\b[^.?!]{0,40}\b(matar|assassinar|esfaquear|esganar|estrangular|envenenar|torturar|agredir|espancar|atropelar|esfolar|decapitar|linchar)\b/i,
  /\b(matar|assassinar|esfaquear|envenenar|torturar|agredir|espancar|kill|murder|stab)\b[^.?!]{0,50}\b(algu[eé]m|algem|pessoa|gente|humanos?|crian[cç]a|menor|beb[eê]|mulher|homem|namorad[oa]|marido|esposa|m[ãa]e|pai|vizinh[oa]|colega|professor|chefe|inimig[oa])\b/i,
  /\b(algu[eé]m|algem|pessoa|crian[cç]a|menor)\b[^.?!]{0,50}\b(matar|assassinar|esfaquear|envenenar|torturar|agredir|violentar)\b/i,
  /\bposso\s+matar\b/i,
  /\bplanej(ar|o)\s+(um\s+)?(crime|assassinato|ataque)\b/i,

  // Abuso sexual, pedofilia, exploração de menores
  /\b(pedofil|pedófil|pedophil|paedophil)\w*/i,
  /\b(abuso\s+sexual|estupro|viola[çc][aã]o\s+sexual|sexual\s+abuse)\b/i,
  /\b(estuprar|violar)\b[^.?!]{0,30}\b(crian[cç]a|menor|menina|menino|adolescente)\b/i,
  /\b(crian[cç]a|menor|menina|menino)\b[^.?!]{0,30}\b(sexual|nudez|porn|abuso|explora)\b/i,
  /\b(child|minor)\b[^.?!]{0,30}\b(sex|porn|abuse|nude|exploit)/i,
  /\b(pornografia|pornô|porno)\b[^.?!]{0,20}\b(infantil|menor|crian[cç]a|child)/i,
  /\b(incesto|incest)\b/i,
  /\b(grooming|aliciar)\b[^.?!]{0,30}\b(menor|crian[cç]a)/i,

  // Autolesão e suicídio
  /\b(como|how\s+to)\b[^.?!]{0,30}\b(se\s+)?(matar|suicid|enforcar|enforcar|defenestrar|overdose)\b/i,
  /\b(m[eé]todos?\s+de\s+)?suic[ií]dio\b/i,
  /\b(cortar|machucar)\s+(os\s+)?(pulsos?|braços?|pernas?)\b/i,
  /\bself[\s-]?harm\b/i,

  // Armas, explosivos, drogas ilegais
  /\b(fabricar|manufacture|construir|montar|fazer)\b[^.?!]{0,30}\b(bomba|explosivo|arma\s+de\s+fogo|veneno|molotov)\b/i,
  /\b(traficar|tráfico\s+de|vender\s+drogas|drug\s+traffick|sintetizar)\b[^.?!]{0,20}\b(droga|coca[ií]na|hero[ií]na|metanfetamina|fentanil)/i,
  /\b(criar|gerar|desenvolver)\s+(malware|ransomware|v[ií]rus\s+malicioso|keylogger)\b/i,

  // Crime financeiro, hacking, sequestro
  /\b(como|how\s+to)\s+(hackear|invadir|break\s+into)\s+(conta|sistema|site|bank|account)/i,
  /\b(roubar|steal)\s+(dinheiro|banco|identidade|data|credenciais)/i,
  /\b(fraude|golpe|estelionato|money\s+launder|lavar\s+dinheiro)\b/i,
  /\b(sequestro|sequestrar|extorsão|kidnap|extortion)\b/i,
  /\b(sonegar|evadir)\s+(imposto|taxes)\b/i,

  // Assédio, stalking, discriminação violenta
  /\b(stalkear|perseguir|espionar)\b[^.?!]{0,30}\b(ex|namorad[oa]|pessoa|mulher|homem)\b/i,
  /\b(odi[oa]|matar)\b[^.?!]{0,20}\b(negros?|brancos?|judeus?|gay|lgbt|mulheres|homens)\b/i,
]

const HARMFUL_OUTPUT_PATTERNS = [
  // Violência
  /\b(fabric[ae]|monte|construa|faça)\s+[^.?!]{0,30}\b(bomba|explosivo|arma|veneno)\b/i,
  /\b(hackeie|invada|roube|fraude|mate|envenene|esfaqueie|estrangule|torture|agreda|espancar)\b/i,
  /\b(passo[s]?\s+(para|de))\b[^.?!]{0,40}\b(matar|assassinar|envenenar|esfaquear)\b/i,
  /\b(use|usar)\b[^.?!]{0,30}\b(faca|objeto\s+afiado|arma|veneno)\b[^.?!]{0,30}\b(matar|ferir|cortar|agredir)\b/i,

  // Abuso / menores
  /\b(pedofil|pedófil|pedophil|abuso\s+sexual|estupro|incesto)\b/i,
  /\b(crian[cç]a|menor)\b[^.?!]{0,30}\b(sexual|nudez|porn|abuso)\b/i,

  // Ilegal / crime
  /\b(illegalmente|criminalmente|sem\s+autorização\s+legal)\b/i,
  /\b(comprar\s+drogas|vender\s+drogas|trafic)\b/i,
  /\b(algema|algemas)\b[^.?!]{0,40}\b(cortar|quebrar|serrar|objeto\s+afiado|faca)\b/i,

  // Autolesão
  /\b(m[eé]todo|forma)\b[^.?!]{0,20}\b(suic[ií]dio|se\s+matar)\b/i,
]

export interface ValidatedAiInput {
  content: string
}

export interface ValidatedAiOutput {
  suggestions: string[]
}

function loadRateLimit(): RateLimitState {
  try {
    const raw = sessionStorage.getItem(RATE_LIMIT_KEY)
    if (!raw) return { count: 0, resetAt: Date.now() + RATE_LIMIT_WINDOW_MS }
    const parsed = JSON.parse(raw) as RateLimitState
    if (Date.now() > parsed.resetAt) {
      return { count: 0, resetAt: Date.now() + RATE_LIMIT_WINDOW_MS }
    }
    return parsed
  } catch {
    return { count: 0, resetAt: Date.now() + RATE_LIMIT_WINDOW_MS }
  }
}

function saveRateLimit(state: RateLimitState): void {
  sessionStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(state))
}

export function checkRateLimit(): void {
  const state = loadRateLimit()
  if (state.count >= RATE_LIMIT_MAX) {
    throw new AiServiceError('ai.error.rateLimit')
  }
  saveRateLimit({
    count: state.count + 1,
    resetAt: state.resetAt,
  })
}

function sanitizeContent(raw: string): string {
  return raw
    // eslint-disable-next-line no-control-regex -- strip control chars from user input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

function stripBenignPhrases(text: string): string {
  let result = text
  for (const pattern of BENIGN_PHRASE_PATTERNS) {
    result = result.replace(pattern, ' ')
  }
  return result.replace(/\s+/g, ' ').trim()
}

/** Detecta conteúdo ilegal, violento, abusivo ou perigoso */
export function isHarmfulContent(text: string): boolean {
  const normalized = sanitizeContent(text)
  if (!normalized) return false

  const withoutBenign = stripBenignPhrases(normalized)
  const toCheck = withoutBenign || normalized

  return hasPattern(toCheck, HARMFUL_INTENT_PATTERNS)
}

export function validateUserInput(raw: string): ValidatedAiInput {
  const content = sanitizeContent(raw)

  if (content.length < 3) {
    throw new AiServiceError('ai.error.inputTooShort')
  }

  if (content.length > MAX_INPUT_CHARS) {
    throw new AiServiceError('ai.error.inputTooLong', { max: MAX_INPUT_CHARS })
  }

  if (hasPattern(content, PROMPT_INJECTION_PATTERNS)) {
    throw new AiServiceError('ai.error.promptInjection')
  }

  if (isHarmfulContent(content)) {
    throw new AiServiceError('ai.error.harmfulContent')
  }

  return { content }
}

export function validateModelOutput(raw: unknown): ValidatedAiOutput {
  if (!raw || typeof raw !== 'object') {
    throw new AiServiceError('ai.error.invalidResponse')
  }

  const payload = raw as { suggestions?: unknown; refusal?: unknown }

  if (typeof payload.refusal === 'string' && payload.refusal.trim()) {
    throw new AiServiceError('ai.error.securityRefusal')
  }

  if (!Array.isArray(payload.suggestions)) {
    throw new AiServiceError('ai.error.parseError')
  }

  const rawSuggestions = payload.suggestions.filter(
    (item): item is string => typeof item === 'string'
  )

  const combinedOutput = rawSuggestions.join(' ')
  if (isHarmfulContent(combinedOutput) || hasPattern(combinedOutput, HARMFUL_OUTPUT_PATTERNS)) {
    throw new AiServiceError('ai.error.harmfulContent')
  }

  const suggestions = rawSuggestions
    .map((item) => sanitizeContent(item))
    .filter(Boolean)
    .map((item) => item.slice(0, MAX_SUGGESTION_CHARS))
    .filter(
      (item) =>
        !isHarmfulContent(item) && !hasPattern(item, HARMFUL_OUTPUT_PATTERNS)
    )

  if (suggestions.length < MIN_SUGGESTIONS) {
    throw new AiServiceError('ai.error.harmfulContent')
  }

  return { suggestions: suggestions.slice(0, MAX_SUGGESTIONS) }
}

export function wrapUserQuery(content: string): string {
  return `<entrada_usuario>
${content}
</entrada_usuario>`
}
