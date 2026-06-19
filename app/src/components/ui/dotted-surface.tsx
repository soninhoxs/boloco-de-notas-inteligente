import { cn } from '@/lib/utils'
import type { Theme } from '@/hooks/useTheme'
import { useEffect, useRef, type ComponentProps } from 'react'
import * as THREE from 'three'

type DottedSurfaceProps = Omit<ComponentProps<'div'>, 'ref'> & {
  theme?: Theme
}

const SEPARATION = 150
/** Grade quadrada para perspectiva simétrica (40×60 deixava o fundo torto) */
const AMOUNTX = 50
const AMOUNTY = 50
const PARTICLE_COUNT = AMOUNTX * AMOUNTY
/** Original: count += 0.1 per frame ≈ 6 units/s at 60 fps */
const TIME_SCALE = 6

export function DottedSurface({
  className,
  theme = 'light',
  ...props
}: DottedSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const isDark = theme === 'dark'

    const scene = new THREE.Scene()
    if (isDark) {
      scene.fog = new THREE.Fog(0x0a0a0a, 2000, 10000)
    }

    const getSize = () => ({
      width: container.clientWidth || window.innerWidth,
      height: container.clientHeight || window.innerHeight,
    })

    const { width: initialWidth, height: initialHeight } = getSize()

    const camera = new THREE.PerspectiveCamera(
      52,
      initialWidth / initialHeight,
      1,
      10000,
    )
    camera.position.set(0, 420, 1080)
    camera.lookAt(0, 0, 0)
    camera.up.set(0, 1, 0)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(initialWidth, initialHeight, false)
    renderer.setClearColor(0x000000, 0)

    const canvas = renderer.domElement
    canvas.style.display = 'block'
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    container.appendChild(canvas)

    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    const gridX = new Float32Array(PARTICLE_COUNT)
    const gridY = new Float32Array(PARTICLE_COUNT)
    const [r, g, b] = isDark ? [0.82, 0.82, 0.82] : [0.18, 0.18, 0.22]

    const halfX = (AMOUNTX - 1) / 2
    const halfY = (AMOUNTY - 1) / 2

    let index = 0
    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const base = index * 3
        positions[base] = (ix - halfX) * SEPARATION
        positions[base + 1] = 0
        positions[base + 2] = (iy - halfY) * SEPARATION
        colors[base] = r
        colors[base + 1] = g
        colors[base + 2] = b
        gridX[index] = ix - halfX
        gridY[index] = iy - halfY
        index++
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aGridX', new THREE.BufferAttribute(gridX, 1))
    geometry.setAttribute('aGridY', new THREE.BufferAttribute(gridY, 1))

    const uniforms = { uTime: { value: 0 } }

    const material = new THREE.PointsMaterial({
      size: isDark ? 8 : 10,
      vertexColors: true,
      transparent: true,
      opacity: isDark ? 0.8 : 0.9,
      sizeAttenuation: true,
    })

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime
      shader.vertexShader = `
        attribute float aGridX;
        attribute float aGridY;
        uniform float uTime;
        ${shader.vertexShader}
      `.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed.y = sin((aGridX + uTime) * 0.3) * 50.0 + sin((aGridY + uTime) * 0.5) * 50.0;`,
      )
    }
    material.customProgramCacheKey = () => `dotted-surface-${theme}`

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    const clock = new THREE.Clock()
    let animationId = 0
    let visible = !document.hidden

    const animate = () => {
      animationId = requestAnimationFrame(animate)
      if (!visible) return

      uniforms.uTime.value = clock.getElapsedTime() * TIME_SCALE
      renderer.render(scene, camera)
    }

    const handleResize = () => {
      const { width, height } = getSize()
      if (width === 0 || height === 0) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
      renderer.setSize(width, height, false)
    }

    const handleVisibility = () => {
      visible = !document.hidden
      if (visible) clock.getDelta()
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)
    window.addEventListener('resize', handleResize)
    document.addEventListener('visibilitychange', handleVisibility)

    animate()

    return () => {
      cancelAnimationFrame(animationId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibility)

      geometry.dispose()
      material.dispose()
      renderer.dispose()

      if (container.contains(canvas)) {
        container.removeChild(canvas)
      }
    }
  }, [theme])

  return (
    <div
      ref={containerRef}
      className={cn('pointer-events-none fixed inset-0 z-0', className)}
      {...props}
    />
  )
}
