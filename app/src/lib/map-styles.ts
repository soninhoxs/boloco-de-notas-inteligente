const CARTO_LIGHT =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const CARTO_DARK =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const MAPLIBRE_DEMO = 'https://demotiles.maplibre.org/style.json'

function resolveCustomStyle(): string | null {
  const url = import.meta.env.VITE_MAP_STYLE_URL?.trim()
  if (!url || url.includes('YOUR_KEY')) return null
  return url
}

const customStyle = resolveCustomStyle()

export const MAP_STYLES = {
  light: customStyle ?? CARTO_LIGHT,
  dark: customStyle ?? CARTO_DARK,
} as const

/** Fallback when Carto tiles fail (e.g. network blocks). */
export const MAP_STYLES_FALLBACK = {
  light: MAPLIBRE_DEMO,
  dark: MAPLIBRE_DEMO,
} as const
