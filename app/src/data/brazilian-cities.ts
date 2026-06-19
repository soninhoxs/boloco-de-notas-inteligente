export interface BrazilianCity {
  name: string
  latitude: number
  longitude: number
}

const cityCache = new Map<string, BrazilianCity[]>()

const cityLoaders = import.meta.glob('./cities/*.json', {
  import: 'default',
}) as Record<string, () => Promise<BrazilianCity[]>>

export async function getCitiesByUf(uf: string): Promise<BrazilianCity[]> {
  if (!uf) return []
  const cached = cityCache.get(uf)
  if (cached) return cached

  const loader = cityLoaders[`./cities/${uf}.json`]
  if (!loader) return []

  const cities = await loader()
  cityCache.set(uf, cities)
  return cities
}

export function findCityByName(
  cities: BrazilianCity[],
  name: string
): BrazilianCity | undefined {
  const normalized = name.trim().toLocaleLowerCase('pt-BR')
  return cities.find(
    (city) => city.name.toLocaleLowerCase('pt-BR') === normalized
  )
}
