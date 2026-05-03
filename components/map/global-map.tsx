"use client"

import { useEffect, useRef, memo } from "react"
import maplibregl from "maplibre-gl"
import { useMap } from "./map-provider"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Navigation, MapPin, X } from "lucide-react"

const KRASNOYARSK_CENTER: [number, number] = [92.87, 56.01]
const KRASNOYARSK_BOUNDS: [[number, number], [number, number]] = [
  [92.55, 55.83],
  [93.19, 56.19],
]

const FOG_SOURCE_ID = "exploration-fog"
const FOG_LAYER_ID = "exploration-fog-fill"
const FOG_OUTLINE_LAYER_ID = "exploration-fog-outline"

export const GlobalMap = memo(function GlobalMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapInitialized = useRef(false)
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)
  const tempMarkerRef = useRef<maplibregl.Marker | null>(null)

  const { 
    map, 
    setMap, 
    viewMode, 
    exploration,
    userLocation,
    setUserLocation,
    locationAccuracy,
    isSelectingLocation,
    setIsSelectingLocation,
    tempLocation,
    setTempLocation,
    isGettingGPS,
    handleGetGPS
  } = useMap()

  // Инициализация карты - только один раз
  useEffect(() => {
    if (!mapContainer.current || mapInitialized.current) return
    mapInitialized.current = true

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png", 
              "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png"
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: KRASNOYARSK_CENTER,
      zoom: 12,
      maxBounds: KRASNOYARSK_BOUNDS,
      fadeDuration: 0
    })

    m.on("load", () => {
      setMap(m)
      setTimeout(() => m.resize(), 100)
    })

    return () => {}
  }, [setMap])

  // РЕНДЕРИНГ ТУМАНА (только при изменении данных)
  useEffect(() => {
    if (!map || !exploration || !map.isStyleLoaded()) return

    const fogData = exploration.fog
    const existingSource = map.getSource(FOG_SOURCE_ID) as maplibregl.GeoJSONSource
    
    if (existingSource) {
      existingSource.setData(fogData as any)
    } else {
      map.addSource(FOG_SOURCE_ID, { type: "geojson", data: fogData as any })
      map.addLayer({
        id: FOG_LAYER_ID,
        type: "fill",
        source: FOG_SOURCE_ID,
        paint: { "fill-color": "#020617", "fill-opacity": 0.72 },
      })
      map.addLayer({
        id: FOG_OUTLINE_LAYER_ID,
        type: "line",
        source: FOG_SOURCE_ID,
        paint: { "line-color": "#0f172a", "line-width": 1, "line-opacity": 0.45 },
      })
    }
  }, [map, exploration])

  // Оптимизированный ресайз
  useEffect(() => {
    if (map && viewMode !== "hidden") {
      const timer = setTimeout(() => map.resize(), 150)
      return () => clearTimeout(timer)
    }
  }, [map, viewMode])

  // Управление маркером пользователя (без пересоздания)
  useEffect(() => {
    if (!map || !userLocation) return
    
    if (!userMarkerRef.current) {
      const el = document.createElement("div")
      el.innerHTML = '<div style="width:24px;height:24px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>'
      userMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(userLocation).addTo(map)
    } else {
      userMarkerRef.current.setLngLat(userLocation)
    }
  }, [map, userLocation])

  // Выбор временной точки
  useEffect(() => {
    if (!map || !isSelectingLocation) return

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      setTempLocation(coords)

      if (!tempMarkerRef.current) {
        const el = document.createElement("div")
        el.innerHTML = '<div style="width:24px;height:24px;background:#10b981;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>'
        tempMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(coords).addTo(map)
      } else {
        tempMarkerRef.current.setLngLat(coords)
      }
    }

    map.on("click", handleClick)
    map.getCanvas().style.cursor = "crosshair"

    return () => {
      map.off("click", handleClick)
      if (map) map.getCanvas().style.cursor = ""
      if (!isSelectingLocation) {
        tempMarkerRef.current?.remove()
        tempMarkerRef.current = null
        setTempLocation(null)
      }
    }
  }, [map, isSelectingLocation, setTempLocation])

  const confirmLocation = () => {
    if (tempLocation && map) {
      setUserLocation(tempLocation)
      setIsSelectingLocation(false)
      map.flyTo({ center: tempLocation, zoom: 15 })
    }
  }

  const cancelLocationSelection = () => {
    setIsSelectingLocation(false)
    setTempLocation(null)
    tempMarkerRef.current?.remove()
    tempMarkerRef.current = null
  }

  return (
    <div 
      className={cn(
        "fixed transition-all duration-500 ease-in-out z-0",
        viewMode === "full" && "inset-0 w-full h-full opacity-100 pointer-events-auto",
        viewMode === "header" && "top-0 left-0 w-full h-[280px] opacity-100 pointer-events-auto",
        viewMode === "hidden" && "inset-0 w-full h-full opacity-0 pointer-events-none"
      )}
    >
      <div ref={mapContainer} className="w-full h-full" />

      {/* UI элементы поверх карты */}
      {viewMode !== "hidden" && (
        <>
          <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 pointer-events-auto mt-[60px]">
            <div className="bg-white/90 dark:bg-gray-900/90 px-3 py-1.5 rounded-full shadow-lg border border-white/20 flex items-center gap-2 text-[10px] font-bold">
              <div className={cn("w-1.5 h-1.5 rounded-full", locationAccuracy && locationAccuracy < 100 ? "bg-green-500" : "bg-yellow-500")} />
              <span className="uppercase tracking-wider">{locationAccuracy ? `~${Math.round(locationAccuracy)}м` : "Центр"}</span>
              <span className="text-gray-300">|</span>
              <button onClick={handleGetGPS} disabled={isGettingGPS} className="text-blue-600 uppercase">{isGettingGPS ? "GPS..." : "GPS"}</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => setIsSelectingLocation(true)} className="text-blue-600 uppercase">Изменить</button>
            </div>
          </div>

          <button 
            onClick={() => {
              if (isSelectingLocation) cancelLocationSelection()
              else if (userLocation) map?.flyTo({ center: userLocation, zoom: 15 })
              else setIsSelectingLocation(true)
            }}
            className={cn(
              "absolute right-4 w-10 h-10 bg-white/90 dark:bg-gray-800/90 rounded-full shadow-lg flex items-center justify-center z-10 pointer-events-auto",
              viewMode === "full" ? "bottom-[100px]" : "bottom-4"
            )}
          >
            <Navigation className={cn("w-5 h-5", userLocation ? "text-purple-600" : "text-gray-400")} />
          </button>

          {isSelectingLocation && (
            <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-[1px] flex flex-col items-center justify-center z-20 pointer-events-none">
              <div className="bg-white/95 dark:bg-gray-900/95 p-3 rounded-xl shadow-2xl border border-blue-200 dark:border-blue-800 m-4 pointer-events-auto">
                {tempLocation ? (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-center">Установить здесь?</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-8 text-[10px] font-black" onClick={confirmLocation}>Да</Button>
                      <Button size="sm" variant="outline" className="h-8 text-[10px] font-black" onClick={cancelLocationSelection}>Нет</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600 animate-bounce" />
                    <span className="text-[10px] font-black uppercase">Выберите точку</span>
                    <button onClick={cancelLocationSelection} className="p-1 hover:bg-muted rounded-full ml-1"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
})
