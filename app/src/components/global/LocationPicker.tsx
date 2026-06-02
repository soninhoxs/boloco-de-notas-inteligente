import { useCallback, useEffect, useState } from 'react'
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
import { MapPin } from 'lucide-react'
import type { NoteLocation } from '@/types/notes'

// Centered roughly on Brazil so the user has a sensible starting view.
const DEFAULT_CENTER: [number, number] = [-51.9253, -14.235]
const DEFAULT_ZOOM = 3

interface LocationPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialLocation?: NoteLocation | null
  onConfirm: (location: NoteLocation) => void
}

/** Registers a click handler on the map to drop/move the pin. */
function MapClickHandler({
  onPick,
}: {
  onPick: (longitude: number, latitude: number) => void
}) {
  const { map } = useMap()

  useEffect(() => {
    if (!map) return
    const handleClick = (e: { lngLat: { lng: number; lat: number } }) => {
      onPick(e.lngLat.lng, e.lngLat.lat)
    }
    map.on('click', handleClick)
    return () => {
      map.off('click', handleClick)
    }
  }, [map, onPick])

  return null
}

export function LocationPicker({
  open,
  onOpenChange,
  initialLocation,
  onConfirm,
}: LocationPickerProps) {
  const [coords, setCoords] = useState<[number, number] | null>(null)
  const [label, setLabel] = useState('')
  const [task, setTask] = useState('')

  // Reset form whenever the dialog is (re)opened.
  useEffect(() => {
    if (!open) return
    if (initialLocation) {
      setCoords([initialLocation.longitude, initialLocation.latitude])
      setLabel(initialLocation.label ?? '')
      setTask(initialLocation.task ?? '')
    } else {
      setCoords(null)
      setLabel('')
      setTask('')
    }
  }, [open, initialLocation])

  const handlePick = useCallback((longitude: number, latitude: number) => {
    setCoords([longitude, latitude])
  }, [])

  const handleConfirm = () => {
    if (!coords) return
    onConfirm({
      longitude: coords[0],
      latitude: coords[1],
      label: label.trim() || undefined,
      task: task.trim() || undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Marcar local da tarefa</DialogTitle>
          <DialogDescription>
            Clique no mapa para marcar onde é, e descreva o que precisa ser
            feito lá.
          </DialogDescription>
        </DialogHeader>

        <div className="h-72 w-full overflow-hidden rounded-lg border border-border">
          <Map
            center={coords ?? DEFAULT_CENTER}
            zoom={coords ? 14 : DEFAULT_ZOOM}
          >
            <MapClickHandler onPick={handlePick} />
            <MapControls position="top-right" showZoom showLocate />
            {coords && (
              <MapMarker
                longitude={coords[0]}
                latitude={coords[1]}
                draggable
                onDragEnd={(lngLat) => setCoords([lngLat.lng, lngLat.lat])}
              >
                <MarkerContent>
                  <MapPin className="size-7 fill-red-500 text-red-600 drop-shadow" />
                </MarkerContent>
              </MapMarker>
            )}
          </Map>
        </div>

        {coords ? (
          <p className="text-xs text-muted-foreground">
            Coordenadas: {coords[1].toFixed(5)}, {coords[0].toFixed(5)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nenhum ponto marcado ainda. Toque no mapa ou use o botão de
            localização.
          </p>
        )}

        <div className="space-y-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nome do local (ex: Escritório, Mercado)"
          />
          <Textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="O que você precisa fazer lá?"
            className="min-h-20"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!coords}>
            Salvar local
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
