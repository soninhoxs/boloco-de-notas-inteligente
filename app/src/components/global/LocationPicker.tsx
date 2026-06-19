import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  useMap,
} from '@/components/ui/mapcn-map-controls'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ChevronDown, Loader2, MapPin } from 'lucide-react'
import {
  BRAZILIAN_STATES,
  formatLocationPlace,
  getStateByUf,
} from '@/data/brazilian-states'
import {
  findCityByName,
  getCitiesByUf,
  type BrazilianCity,
} from '@/data/brazilian-cities'
import type { NoteLocation } from '@/types/notes'
import { MAP_STYLES, MAP_STYLES_FALLBACK } from '@/lib/map-styles'
import { useI18n } from '@/contexts/I18nContext'
import { cn } from '@/lib/utils'

interface LocationPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialLocation?: NoteLocation | null
  onConfirm: (location: NoteLocation) => void
}

function MapClickHandler({
  onPick,
}: {
  onPick: (longitude: number, latitude: number) => void
}) {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return

    const handleClick = (e: { lngLat: { lng: number; lat: number } }) => {
      onPick(e.lngLat.lng, e.lngLat.lat)
    }

    map.on('click', handleClick)
    return () => {
      map.off('click', handleClick)
    }
  }, [map, isLoaded, onPick])

  return null
}

function MapFlyTo({
  coords,
  flyRequestId,
  zoom,
}: {
  coords: [number, number] | null
  flyRequestId: number
  zoom: number
}) {
  const { map, isLoaded } = useMap()
  const lastFlyRef = useRef(0)

  useEffect(() => {
    if (!map || !isLoaded || !coords || flyRequestId === 0) return
    if (lastFlyRef.current === flyRequestId) return
    lastFlyRef.current = flyRequestId
    map.flyTo({ center: coords, zoom, duration: 1000 })
  }, [map, isLoaded, coords, flyRequestId, zoom])

  return null
}

function MapResizeOnMount() {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return
    const resize = () => map.resize()
    resize()
    const timers = [100, 300, 600].map((delay) =>
      window.setTimeout(resize, delay)
    )
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [map, isLoaded])

  return null
}

function MapStyleFallback({ onFallback }: { onFallback: () => void }) {
  const { map } = useMap()
  const didFallback = useRef(false)

  useEffect(() => {
    if (!map) return

    const handleError = () => {
      if (didFallback.current) return
      didFallback.current = true
      onFallback()
    }

    map.on('error', handleError)
    return () => {
      map.off('error', handleError)
    }
  }, [map, onFallback])

  return null
}

function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  active: boolean
) {
  useEffect(() => {
    if (!active) return
    const onMouseDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [ref, handler, active])
}

interface SearchableComboboxProps<T> {
  id: string
  items: T[]
  selectedKey: string
  onSelect: (item: T) => void
  onClear: () => void
  getKey: (item: T) => string
  getLabel: (item: T) => string
  filterItem: (item: T, query: string) => boolean
  placeholder: string
  disabled?: boolean
  loading?: boolean
  emptyMessage?: string
}

function SearchableCombobox<T>({
  id,
  items,
  selectedKey,
  onSelect,
  onClear,
  getKey,
  getLabel,
  filterItem,
  placeholder,
  disabled = false,
  loading = false,
  emptyMessage = '',
}: SearchableComboboxProps<T>) {
  const { t } = useI18n()
  const resolvedEmptyMessage = emptyMessage || t('location.noResults')
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selectedItem = items.find((item) => getKey(item) === selectedKey)

  useEffect(() => {
    if (selectedItem) {
      setQuery(getLabel(selectedItem))
      return
    }
    if (!selectedKey) setQuery('')
  }, [selectedItem, selectedKey, getLabel])

  useClickOutside(containerRef, () => setOpen(false), open)

  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
  const requiresQuery = items.length > 40
  const filtered =
    normalizedQuery.length > 0
      ? items.filter((item) => filterItem(item, normalizedQuery))
      : requiresQuery
        ? []
        : items

  const handleChange = (nextQuery: string) => {
    setQuery(nextQuery)
    setOpen(true)
    if (selectedItem && getLabel(selectedItem) !== nextQuery) {
      onClear()
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={query}
          disabled={disabled || loading}
          placeholder={loading ? t('location.loading') : placeholder}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => !disabled && !loading && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
        />
        {loading ? (
          <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown
            className={cn(
              'pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-transform',
              open && 'rotate-180'
            )}
          />
        )}
      </div>

      {open && !disabled && !loading && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          aria-labelledby={id}
          className="absolute z-[70] mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {requiresQuery && !normalizedQuery
                ? t('location.typeToSearch')
                : resolvedEmptyMessage}
            </li>
          ) : (
            filtered.map((item) => {
              const key = getKey(item)
              const isSelected = key === selectedKey
              return (
                <li key={key} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                      isSelected && 'bg-accent font-medium text-accent-foreground'
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSelect(item)
                      setQuery(getLabel(item))
                      setOpen(false)
                    }}
                  >
                    {getLabel(item)}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}

function StateSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (uf: string) => void
}) {
  const { t } = useI18n()

  return (
    <SearchableCombobox
      id="location-state"
      items={BRAZILIAN_STATES}
      selectedKey={value}
      onSelect={(state) => onChange(state.uf)}
      onClear={() => onChange('')}
      getKey={(state) => state.uf}
      getLabel={(state) => `${state.name} (${state.uf})`}
      filterItem={(state, query) =>
        state.name.toLocaleLowerCase('pt-BR').includes(query) ||
        state.uf.toLocaleLowerCase().includes(query)
      }
      placeholder={t('location.statePlaceholder')}
      emptyMessage={t('location.noState')}
    />
  )
}

function CitySelect({
  stateUf,
  value,
  onChange,
  onClear,
}: {
  stateUf: string
  value: string
  onChange: (city: BrazilianCity) => void
  onClear: () => void
}) {
  const { t } = useI18n()
  const [cities, setCities] = useState<BrazilianCity[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!stateUf) {
      setCities([])
      return
    }

    let cancelled = false
    setIsLoading(true)
    getCitiesByUf(stateUf)
      .then((loaded) => {
        if (!cancelled) setCities(loaded)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [stateUf])

  return (
    <SearchableCombobox
      id="location-city"
      items={cities}
      selectedKey={value}
      onSelect={onChange}
      onClear={onClear}
      getKey={(city) => city.name}
      getLabel={(city) => city.name}
      filterItem={(city, query) =>
        city.name.toLocaleLowerCase('pt-BR').includes(query)
      }
      placeholder={
        stateUf ? t('location.cityPlaceholder') : t('location.cityDisabled')
      }
      disabled={!stateUf}
      loading={isLoading}
      emptyMessage={t('location.noCity')}
    />
  )
}

export function LocationPicker({
  open,
  onOpenChange,
  initialLocation,
  onConfirm,
}: LocationPickerProps) {
  const { t } = useI18n()
  const [stateUf, setStateUf] = useState('')
  const [city, setCity] = useState('')
  const [task, setTask] = useState('')
  const [previewCoords, setPreviewCoords] = useState<[number, number] | null>(
    null
  )
  const [markerCoords, setMarkerCoords] = useState<[number, number] | null>(
    null
  )
  const [flyRequestId, setFlyRequestId] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [mapStyles, setMapStyles] = useState(MAP_STYLES)

  useEffect(() => {
    if (!open) {
      setShowMap(false)
      setMapStyles(MAP_STYLES)
      return
    }
    const timer = window.setTimeout(() => setShowMap(true), 350)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    setFormError(null)
    setIsSaving(false)
    setPreviewCoords(null)
    setMarkerCoords(null)
    setFlyRequestId(0)

    if (initialLocation) {
      setStateUf(initialLocation.state ?? '')
      setCity(initialLocation.city ?? '')
      setTask(initialLocation.task ?? '')
      const coords: [number, number] = [
        initialLocation.longitude,
        initialLocation.latitude,
      ]
      setPreviewCoords(coords)
      setMarkerCoords(coords)
      setFlyRequestId(1)
    } else {
      setStateUf('')
      setCity('')
      setTask('')
    }
  }, [open, initialLocation])

  useEffect(() => {
    if (!stateUf) {
      setPreviewCoords(null)
      return
    }

    const state = getStateByUf(stateUf)
    if (!state) return

    const cityTrimmed = city.trim()
    if (!cityTrimmed) {
      const coords: [number, number] = [state.longitude, state.latitude]
      setPreviewCoords(coords)
      setMarkerCoords(null)
      setFlyRequestId((id) => id + 1)
      return
    }

    let cancelled = false
    getCitiesByUf(stateUf).then((cities) => {
      if (cancelled) return
      const match = findCityByName(cities, cityTrimmed)
      const nextCoords: [number, number] = match
        ? [match.longitude, match.latitude]
        : [state.longitude, state.latitude]
      setPreviewCoords(nextCoords)
      setMarkerCoords(null)
      setFlyRequestId((id) => id + 1)
    })

    return () => {
      cancelled = true
    }
  }, [stateUf, city])

  const handlePick = useCallback((longitude: number, latitude: number) => {
    setMarkerCoords([longitude, latitude])
    setFormError(null)
  }, [])

  const handleConfirm = () => {
    const cityTrimmed = city.trim()
    if (!stateUf) {
      setFormError(t('location.errorState'))
      return
    }
    if (!cityTrimmed) {
      setFormError(t('location.errorCity'))
      return
    }
    if (!markerCoords) {
      setFormError(t('location.errorMarker'))
      return
    }

    const state = getStateByUf(stateUf)
    if (!state) return

    setIsSaving(true)
    setFormError(null)

    getCitiesByUf(stateUf)
      .then((cities) => {
        const match = findCityByName(cities, cityTrimmed)
        if (!match) {
          setFormError(t('location.errorCityList'))
          return
        }

        const latitude = markerCoords[1]
        const longitude = markerCoords[0]

        onConfirm({
          state: stateUf,
          city: match.name,
          latitude,
          longitude,
          label: formatLocationPlace(match.name, stateUf),
          task: task.trim() || undefined,
        })
        onOpenChange(false)
      })
      .catch(() => {
        setFormError(t('location.errorSave'))
      })
      .finally(() => {
        setIsSaving(false)
      })
  }

  const selectedState = stateUf ? getStateByUf(stateUf) : null
  const mapZoom = city.trim() ? 12 : 6
  const mapCoords =
    previewCoords ??
    (selectedState
      ? ([selectedState.longitude, selectedState.latitude] as [number, number])
      : null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('location.title')}</DialogTitle>
          <DialogDescription>{t('location.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="location-state" className="text-sm font-medium">
              {t('location.state')}
            </label>
            <StateSelect
              value={stateUf}
              onChange={(uf) => {
                setStateUf(uf)
                setCity('')
                setMarkerCoords(null)
                setFormError(null)
              }}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="location-city" className="text-sm font-medium">
              {t('location.city')}
            </label>
            <CitySelect
              stateUf={stateUf}
              value={city}
              onChange={(selected) => {
                setCity(selected.name)
                setFormError(null)
              }}
              onClear={() => {
                setCity('')
                setMarkerCoords(null)
              }}
            />
          </div>

          {selectedState && city.trim() && showMap && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {markerCoords
                  ? t('location.mapAdjust')
                  : t('location.mapTap')}
                {` · ${formatLocationPlace(city.trim(), stateUf)}`}
              </p>
              <div className="relative isolate z-0 h-56 w-full touch-none overflow-hidden rounded-lg border border-border bg-muted [&_.maplibregl-canvas]:!absolute">
                {mapCoords ? (
                  <Map
                    styles={mapStyles}
                    center={mapCoords}
                    zoom={mapZoom}
                    dragPan
                    scrollZoom
                    touchZoomRotate
                    doubleClickZoom
                    touchPitch
                  >
                    <MapResizeOnMount />
                    <MapStyleFallback
                      onFallback={() => setMapStyles(MAP_STYLES_FALLBACK)}
                    />
                    <MapClickHandler onPick={handlePick} />
                    <MapFlyTo
                      coords={previewCoords}
                      flyRequestId={flyRequestId}
                      zoom={mapZoom}
                    />
                    <MapControls position="top-right" showZoom />
                    {markerCoords && (
                      <MapMarker
                        longitude={markerCoords[0]}
                        latitude={markerCoords[1]}
                        draggable
                        onDragEnd={(lngLat) =>
                          setMarkerCoords([lngLat.lng, lngLat.lat])
                        }
                      >
                        <MarkerContent>
                          <MapPin className="size-7 fill-red-500 text-red-600 drop-shadow" />
                        </MarkerContent>
                      </MapMarker>
                    )}
                  </Map>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {t('location.mapLoading')}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="location-task" className="text-sm font-medium">
              {t('location.task')}
            </label>
            <Textarea
              id="location-task"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder={t('location.taskPlaceholder')}
              className="min-h-20"
            />
          </div>

          {formError && (
            <p className="text-xs text-destructive">{formError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('location.cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSaving || !stateUf || !city.trim() || !markerCoords}
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('location.saving')}
              </>
            ) : (
              t('location.save')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
