import { cn } from '@/lib/utils'

type SkeletonProps = React.ComponentProps<'div'> & {
  animationType?: 'shimmer' | 'pulse' | 'none'
}

function Skeleton({
  className,
  animationType = 'shimmer',
  ...props
}: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      data-animation={animationType}
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        animationType === 'shimmer' && 'skeleton--shimmer',
        animationType === 'pulse' && 'animate-pulse',
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
