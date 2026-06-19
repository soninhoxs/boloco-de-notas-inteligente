import * as React from 'react'
import { motion, type Variants } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface FeatureHighlightCardProps {
  imageSrc?: string
  imageAlt?: string
  icon?: LucideIcon
  title: string
  description: string
  buttonText: string
  onButtonClick?: () => void
  className?: string
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.1,
    },
  },
}

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: [0.6, -0.05, 0.01, 0.99],
    },
  },
}

const imageContainerVariants: Variants = {
  hidden: { scale: 0.9, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.8,
      ease: 'easeOut',
    },
  },
}

export const FeatureHighlightCard = React.forwardRef<
  HTMLDivElement,
  FeatureHighlightCardProps
>(
  (
    {
      imageSrc,
      imageAlt = 'Feature image',
      icon: Icon,
      title,
      description,
      buttonText,
      onButtonClick,
      className,
    },
    ref
  ) => {
    const [imageFailed, setImageFailed] = React.useState(false)
    const showImage = Boolean(imageSrc) && !imageFailed
    const FallbackIcon = Icon ?? ImageIcon

    return (
      <motion.div
        ref={ref}
        className={cn(
          'relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card p-6 text-center shadow-sm md:p-8',
          className
        )}
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
      >
        <div className="absolute left-1/2 top-0 -z-10 h-2/3 w-2/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />

        <motion.div
          variants={imageContainerVariants}
          className="mb-5 flex justify-center"
        >
          {showImage ? (
            <img
              src={imageSrc}
              alt={imageAlt}
              className="h-36 w-full rounded-xl object-cover md:h-40"
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div
              className="flex h-36 w-full items-center justify-center rounded-xl border border-border/60 bg-gradient-to-br from-primary/15 via-muted/40 to-primary/5 md:h-40"
              aria-hidden
            >
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <FallbackIcon className="size-8 text-primary" strokeWidth={1.75} />
              </div>
            </div>
          )}
        </motion.div>

        <motion.h2
          variants={itemVariants}
          className="text-xl font-bold tracking-tight text-card-foreground md:text-2xl"
        >
          {title}
        </motion.h2>

        <motion.p
          variants={itemVariants}
          className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground"
        >
          {description}
        </motion.p>

        <motion.div variants={itemVariants} className="mt-6 shrink-0">
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full"
            onClick={onButtonClick}
          >
            {buttonText}
          </Button>
        </motion.div>
      </motion.div>
    )
  }
)

FeatureHighlightCard.displayName = 'FeatureHighlightCard'
