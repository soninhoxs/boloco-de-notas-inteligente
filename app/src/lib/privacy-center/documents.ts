import type { LucideIcon } from 'lucide-react'
import {
  Cookie,
  Database,
  FileText,
  Lock,
  NotebookPen,
  ScrollText,
  Settings2,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react'

export type PolicySlug = 'privacy' | 'cookies' | 'terms'

export type PolicySectionId = string

export type PolicyHighlightKey = 'one' | 'two' | 'three'

export type PolicyDocument = {
  slug: PolicySlug
  path: string
  icon: LucideIcon
  titleKey: string
  pageTitleKey: string
  introKey: string
  topicsTitleKey: string
  footerTitleKey: string
  footerBodyKey: string
  sections: readonly PolicySectionId[]
  highlights: {
    keys: readonly PolicyHighlightKey[]
    sectionMap: Record<PolicyHighlightKey, PolicySectionId>
    icons: Record<PolicyHighlightKey, LucideIcon>
  }
}

export const POLICY_DOCUMENTS: PolicyDocument[] = [
  {
    slug: 'privacy',
    path: '/privacidade',
    icon: Lock,
    titleKey: 'privacy.title',
    pageTitleKey: 'privacy.pageTitle',
    introKey: 'privacy.intro',
    topicsTitleKey: 'privacy.topicsTitle',
    footerTitleKey: 'privacy.footer.title',
    footerBodyKey: 'privacy.footer.body',
    sections: [
      'controller',
      'data',
      'purpose',
      'legalBasis',
      'sharing',
      'rights',
      'security',
      'retention',
      'contact',
    ],
    highlights: {
      keys: ['one', 'two', 'three'],
      sectionMap: { one: 'rights', two: 'data', three: 'purpose' },
      icons: {
        one: Shield,
        two: Database,
        three: ShieldCheck,
      },
    },
  },
  {
    slug: 'cookies',
    path: '/privacidade/cookies',
    icon: Cookie,
    titleKey: 'cookies.title',
    pageTitleKey: 'cookies.pageTitle',
    introKey: 'cookies.intro',
    topicsTitleKey: 'cookies.topicsTitle',
    footerTitleKey: 'cookies.footer.title',
    footerBodyKey: 'cookies.footer.body',
    sections: [
      'whatAre',
      'whyWeUse',
      'essential',
      'preferences',
      'storage',
      'thirdParty',
      'control',
      'contact',
    ],
    highlights: {
      keys: ['one', 'two', 'three'],
      sectionMap: { one: 'control', two: 'essential', three: 'whatAre' },
      icons: {
        one: Settings2,
        two: Lock,
        three: Cookie,
      },
    },
  },
  {
    slug: 'terms',
    path: '/privacidade/termos',
    icon: ScrollText,
    titleKey: 'terms.title',
    pageTitleKey: 'terms.pageTitle',
    introKey: 'terms.intro',
    topicsTitleKey: 'terms.topicsTitle',
    footerTitleKey: 'terms.footer.title',
    footerBodyKey: 'terms.footer.body',
    sections: [
      'acceptance',
      'service',
      'account',
      'content',
      'ai',
      'prohibited',
      'intellectual',
      'liability',
      'changes',
      'contact',
    ],
    highlights: {
      keys: ['one', 'two', 'three'],
      sectionMap: { one: 'service', two: 'content', three: 'account' },
      icons: {
        one: NotebookPen,
        two: FileText,
        three: User,
      },
    },
  },
]

export const POLICY_BY_SLUG = Object.fromEntries(
  POLICY_DOCUMENTS.map((doc) => [doc.slug, doc])
) as Record<PolicySlug, PolicyDocument>

export function sectionTranslationKey(
  slug: PolicySlug,
  sectionId: PolicySectionId
): string {
  return `${slug}.${sectionId}.title`
}

export function sectionBodyKey(slug: PolicySlug, sectionId: PolicySectionId): string {
  return `${slug}.${sectionId}.body`
}

export function highlightTranslationPrefix(slug: PolicySlug): string {
  return `${slug}.highlight`
}

/** Sidebar group label for all legal documents */
export const POLICIES_NAV_ICON = FileText
