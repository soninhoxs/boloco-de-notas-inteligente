import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileText,
  Home,
  Printer,
  Search,
  Shield,
} from 'lucide-react'
import { useI18n } from '@/contexts/I18nContext'
import { useTheme } from '@/hooks/useTheme'
import { ThemeToggle } from '@/components/global/ThemeToggle'
import { AuthBrandMark } from '@/components/auth/AuthBrandMark'
import { FeatureHighlightCard } from '@/components/ui/feature-highlight-card'
import { Skeleton } from '@/components/ui/skeleton'
import { LGPD_CONSENT_VERSION } from '@/lib/lgpd'
import {
  POLICY_DOCUMENTS,
  POLICIES_NAV_ICON,
  type PolicySectionId,
  highlightTranslationPrefix,
  sectionBodyKey,
  sectionTranslationKey,
} from '@/lib/privacy-center/documents'
import { cn } from '@/lib/utils'

function PolicySkeleton() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Loading">
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-full max-w-lg" />
        <Skeleton className="h-4 w-4/5 max-w-md" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export function PrivacyPolicyPage() {
  const { pathname } = useLocation()
  const slug = useMemo(() => {
    const match = POLICY_DOCUMENTS.find((policy) => policy.path === pathname)
    return match?.slug ?? 'privacy'
  }, [pathname])
  const doc = POLICY_DOCUMENTS.find((d) => d.slug === slug)!
  const { t } = useI18n()
  const { theme, toggleTheme } = useTheme()

  const [activeId, setActiveId] = useState<PolicySectionId>(doc.sections[0])
  const [topicsOpen, setTopicsOpen] = useState(true)
  const [policiesOpen, setPoliciesOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setActiveId(doc.sections[0])
    setSearchQuery('')
    const timer = window.setTimeout(() => setLoading(false), 420)
    return () => window.clearTimeout(timer)
  }, [slug, doc.sections])

  useEffect(() => {
    if (loading) return

    const elements = doc.sections
      .map((id) => document.getElementById(`${slug}-${id}`))
      .filter(Boolean) as HTMLElement[]

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        const id = visible[0]?.target.id.replace(`${slug}-`, '')
        if (id) setActiveId(id)
      },
      { rootMargin: '-18% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] }
    )

    for (const element of elements) observer.observe(element)
    return () => observer.disconnect()
  }, [loading, slug, doc.sections])

  const scrollTo = (id: PolicySectionId) => {
    document
      .getElementById(`${slug}-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(id)
  }

  const handlePrint = () => window.print()

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return [...doc.sections]
    const q = searchQuery.toLowerCase()
    return doc.sections.filter((id) => {
      const title = t(sectionTranslationKey(slug, id)).toLowerCase()
      const body = t(sectionBodyKey(slug, id)).toLowerCase()
      return title.includes(q) || body.includes(q)
    })
  }, [doc.sections, searchQuery, slug, t])

  const highlightPrefix = highlightTranslationPrefix(slug)
  const PoliciesNavIcon = POLICIES_NAV_ICON
  const DocIcon = doc.icon

  const sidebarSectionItem = (id: PolicySectionId) => (
    <button
      key={id}
      type="button"
      onClick={() => scrollTo(id)}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
        activeId === id
          ? 'bg-primary/8 font-medium text-primary'
          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
      )}
    >
      <FileText className="size-4 shrink-0 opacity-80" />
      <span className="min-w-0 flex-1 truncate">{t(sectionTranslationKey(slug, id))}</span>
      {activeId === id && <ChevronRight className="size-4 shrink-0 text-primary" />}
    </button>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-[280px] shrink-0 flex-col border-r border-border/80 bg-background lg:flex">
          <div className="flex items-center gap-3 border-b border-border/80 px-5 py-5">
            <AuthBrandMark className="size-10 rounded-xl" iconClassName="size-5" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                {t('privacy.centerTitle')}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {t('privacy.lgpdLabel')}
              </p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label={t('privacy.toc')}>
            <Link
              to="/login"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              <Home className="size-4 shrink-0" />
              {t('privacy.nav.home')}
            </Link>

            <button
              type="button"
              onClick={() => setPoliciesOpen((open) => !open)}
              className="mt-3 flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <PoliciesNavIcon className="size-3.5" />
                {t('privacy.nav.policies')}
              </span>
              <ChevronDown
                className={cn('size-4 transition-transform', policiesOpen && 'rotate-180')}
              />
            </button>

            {policiesOpen && (
              <div className="space-y-0.5">
                {POLICY_DOCUMENTS.map((policy) => {
                  const Icon = policy.icon
                  const isActive = policy.slug === slug
                  return (
                    <Link
                      key={policy.slug}
                      to={policy.path}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                        isActive
                          ? 'bg-primary/8 font-medium text-primary'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{t(policy.titleKey)}</span>
                      {isActive && <ChevronRight className="size-4 shrink-0" />}
                    </Link>
                  )
                })}
              </div>
            )}

            <div className="relative mt-3 px-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('privacy.searchPlaceholder')}
                className="h-9 w-full rounded-lg border border-border bg-muted/40 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40 focus:bg-background"
              />
            </div>

            <button
              type="button"
              onClick={() => setTopicsOpen((open) => !open)}
              className="mt-4 flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <Shield className="size-3.5" />
                {t('privacy.nav.topics')}
              </span>
              <ChevronDown
                className={cn('size-4 transition-transform', topicsOpen && 'rotate-180')}
              />
            </button>

            {topicsOpen && (
              <div className="space-y-0.5">{filteredSections.map(sidebarSectionItem)}</div>
            )}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl print:hidden">
            <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 flex-1 items-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground lg:hidden"
                >
                  <ArrowLeft className="size-4 shrink-0" />
                  <span className="truncate">{t('auth.backToLogin')}</span>
                </Link>

                <div className="hidden items-center gap-2 text-sm font-medium lg:flex">
                  <DocIcon className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="truncate">{t(doc.pageTitleKey)}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handlePrint}
                  title={t('privacy.printVersion')}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-primary transition-colors hover:bg-muted/60 hover:underline sm:px-0 sm:hover:bg-transparent"
                >
                  <Printer className="size-4 shrink-0" />
                  <span className="hidden lg:inline">{t('privacy.printVersion')}</span>
                  <span className="sr-only lg:hidden">{t('privacy.printVersion')}</span>
                </button>
                <ThemeToggle
                  theme={theme}
                  onToggle={toggleTheme}
                  variant="inline"
                />
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto border-t border-border/60 px-4 py-2 lg:hidden">
              {POLICY_DOCUMENTS.map((policy) => (
                <Link
                  key={policy.slug}
                  to={policy.path}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    policy.slug === slug
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t(policy.pageTitleKey)}
                </Link>
              ))}
            </div>
          </header>

          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8 md:py-14">
            {loading ? (
              <PolicySkeleton />
            ) : (
              <>
                <header className="mb-12">
                  <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                    {t(doc.titleKey)}
                  </h1>
                  <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
                    {t(doc.introKey)}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>{t('privacy.effectiveDate', { version: LGPD_CONSENT_VERSION })}</span>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="text-primary hover:underline"
                    >
                      {t('privacy.printVersion')}
                    </button>
                  </div>
                </header>

                <section className="mb-14" aria-label={t('privacy.nav.resources')}>
                  <h2 className="mb-6 text-lg font-semibold">{t('privacy.nav.resources')}</h2>
                  <div className="grid items-stretch gap-5 md:grid-cols-3">
                    {doc.highlights.keys.map((key) => (
                      <FeatureHighlightCard
                        key={key}
                        icon={doc.highlights.icons[key]}
                        imageAlt={t(`${highlightPrefix}.${key}.title`)}
                        title={t(`${highlightPrefix}.${key}.title`)}
                        description={t(`${highlightPrefix}.${key}.body`)}
                        buttonText={t('privacy.highlight.button')}
                        onButtonClick={() => scrollTo(doc.highlights.sectionMap[key])}
                      />
                    ))}
                  </div>
                </section>

                <section className="mb-14" aria-label={t(doc.topicsTitleKey)}>
                  <h2 className="mb-4 text-lg font-semibold">{t(doc.topicsTitleKey)}</h2>
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {doc.sections.map((id) => (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => scrollTo(id)}
                          className={cn(
                            'flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/50',
                            activeId === id && 'bg-muted/30'
                          )}
                        >
                          <span className="text-sm font-medium md:text-base">
                            {t(sectionTranslationKey(slug, id))}
                          </span>
                          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>

                <article className="space-y-12 md:space-y-16">
                  {(searchQuery.trim() ? filteredSections : doc.sections).map((id) => (
                    <section
                      key={id}
                      id={`${slug}-${id}`}
                      className="scroll-mt-28 border-t border-border/60 pt-10 first:border-t-0 first:pt-0 md:scroll-mt-32"
                    >
                      <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
                        {t(sectionTranslationKey(slug, id))}
                      </h2>
                      <p className="mt-4 text-base leading-[1.75] text-muted-foreground">
                        {t(sectionBodyKey(slug, id))}
                      </p>
                    </section>
                  ))}

                  {searchQuery.trim() && filteredSections.length === 0 && (
                    <p className="py-8 text-center text-muted-foreground">
                      {t('privacy.searchEmpty')}
                    </p>
                  )}
                </article>

                <footer className="mt-16 rounded-2xl border border-border bg-muted/25 p-8 print:hidden">
                  <h3 className="text-lg font-semibold">{t(doc.footerTitleKey)}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {t(doc.footerBodyKey)}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-4">
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      <ArrowLeft className="size-4" />
                      {t('auth.backToLogin')}
                    </Link>
                    {slug !== 'privacy' && (
                      <Link
                        to="/privacidade"
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {t('privacy.title')}
                      </Link>
                    )}
                    {slug !== 'cookies' && (
                      <Link
                        to="/privacidade/cookies"
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {t('cookies.title')}
                      </Link>
                    )}
                    {slug !== 'terms' && (
                      <Link
                        to="/privacidade/termos"
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {t('terms.title')}
                      </Link>
                    )}
                  </div>
                </footer>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
