import * as React from 'react'
import {
  Bell,
  FileText,
  Heart,
  Lightbulb,
  ListTodo,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type MasonryNoteCategory =
  | 'idea'
  | 'task'
  | 'gratitude'
  | 'reminder'
  | 'other'

export interface MasonryCardData {
  id: string
  src?: string
  category?: MasonryNoteCategory
  content: string
  linkHref?: string
  linkText?: string
  meta?: string
  onClick?: () => void
  selected?: boolean
}

export interface MasonryGridProps extends React.HTMLAttributes<HTMLDivElement> {
  items: MasonryCardData[]
  selectedId?: string | null
}

const CATEGORY_COVER: Record<
  MasonryNoteCategory,
  { icon: LucideIcon; className: string }
> = {
  idea: {
    icon: Lightbulb,
    className:
      'bg-gradient-to-br from-amber-500/25 via-amber-900/20 to-background text-amber-400',
  },
  task: {
    icon: ListTodo,
    className:
      'bg-gradient-to-br from-emerald-500/25 via-emerald-900/20 to-background text-emerald-400',
  },
  gratitude: {
    icon: Heart,
    className:
      'bg-gradient-to-br from-rose-500/25 via-rose-900/20 to-background text-rose-400',
  },
  reminder: {
    icon: Bell,
    className:
      'bg-gradient-to-br from-blue-500/25 via-blue-900/20 to-background text-blue-400',
  },
  other: {
    icon: FileText,
    className:
      'bg-gradient-to-br from-zinc-500/20 via-zinc-800/20 to-background text-zinc-400',
  },
}

const MasonryGridCSS = () => (
  <style>{`
    @keyframes masonry-slide-in {
      from {
        opacity: 0;
        transform: scale(0.92) rotate(calc(var(--side, 1) * (3deg * var(--amp, 1))));
      }
      to {
        opacity: 1;
        transform: scale(1) rotate(0deg);
      }
    }

    .masonry-card-wrapper {
      &:nth-of-type(2n + 1) { transform-origin: 25vw 100%; }
      &:nth-of-type(2n) { transform-origin: -25vw 100%; }

      @media (min-width: 768px) {
        &:nth-of-type(3n + 1) { transform-origin: 40vw 100%; }
        &:nth-of-type(3n + 2) { transform-origin: 0vw 100%; }
        &:nth-of-type(3n) { transform-origin: -40vw 100%; }
      }

      @media (min-width: 1024px) {
        &:nth-of-type(4n + 1) { transform-origin: 50vw 100%; }
        &:nth-of-type(4n + 2) { transform-origin: 15vw 100%; }
        &:nth-of-type(4n + 3) { transform-origin: -15vw 100%; }
        &:nth-of-type(4n) { transform-origin: -50vw 100%; }
      }

      @media (prefers-reduced-motion: no-preference) {
        animation: masonry-slide-in linear both;
        animation-timeline: view();
        animation-range: entry 0% cover 20%;
      }
    }

    @supports not (animation-timeline: view()) {
      .masonry-card-wrapper {
        animation: masonry-slide-in 0.45s ease-out both;
      }
    }
  `}</style>
)

function CategoryCover({
  category = 'other',
}: {
  category?: MasonryNoteCategory
}) {
  const cover = CATEGORY_COVER[category]
  const Icon = cover.icon

  return (
    <div
      className={cn(
        'flex aspect-[4/3] w-full items-center justify-center rounded-md border border-border/50',
        cover.className
      )}
    >
      <Icon className="size-10 opacity-90" strokeWidth={1.5} aria-hidden />
    </div>
  )
}

function MasonryCard({
  item,
  className,
  style,
  selected,
  ...props
}: { item: MasonryCardData; selected?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  const Comp = item.onClick ? 'button' : 'div'

  return (
    <div className={cn('grid gap-2', className)} style={style} {...props}>
      <Comp
        type={item.onClick ? 'button' : undefined}
        onClick={item.onClick}
        className={cn(
          'w-full space-y-2.5 rounded-xl border bg-card p-3 text-left shadow-sm transition-all',
          selected
            ? 'border-primary ring-2 ring-primary/30 shadow-md'
            : 'border-border hover:border-primary/30 hover:shadow-md',
          item.onClick &&
            'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
      >
        {item.src ? (
          <img
            src={item.src}
            alt=""
            height={400}
            width={400}
            loading="lazy"
            className="aspect-[4/3] w-full rounded-md bg-muted object-cover"
          />
        ) : (
          <CategoryCover category={item.category} />
        )}
        <p className="line-clamp-3 text-sm leading-snug text-foreground/90">
          {item.content}
        </p>
        {(item.linkText || item.meta) && (
          <div className="flex items-center justify-between gap-2 text-xs">
            {item.linkText && (
              <span className="font-medium text-foreground/80">{item.linkText}</span>
            )}
            {item.meta && (
              <span className="truncate text-muted-foreground">{item.meta}</span>
            )}
          </div>
        )}
      </Comp>
    </div>
  )
}

const MasonryGrid = React.forwardRef<HTMLDivElement, MasonryGridProps>(
  ({ items, selectedId, className, ...props }, ref) => (
    <>
      <MasonryGridCSS />
      <div
        ref={ref}
        className={cn(
          'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4',
          className
        )}
        {...props}
      >
        {items.map((item, index) => (
          <MasonryCard
            key={item.id}
            item={item}
            selected={selectedId === item.id}
            className="masonry-card-wrapper"
            style={
              {
                '--side': index % 2 === 0 ? 1 : -1,
                '--amp': Math.ceil((index % 8) / 2),
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </>
  )
)

MasonryGrid.displayName = 'MasonryGrid'

export { MasonryGrid, MasonryCard }
