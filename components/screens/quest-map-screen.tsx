"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import type { Screen } from "@/app/page"
import {
  EXPLORATION_H3_RESOLUTION,
  getExplorationCellIndex,
  type GeoJsonFeatureCollection,
  type TerritoryBoundary,
} from "@/lib/exploration"
import { startQuest as createQuestSession } from "@/lib/start-quest"
import {
  Bell,
  Clock,
  Home,
  Map as MapIcon,
  MapPin,
  Navigation,
  User,
  X,
} from "lucide-react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

interface QuestMapScreenProps {
  onNavigate: (screen: Screen, data?: any) => void
  onLogout?: () => void
  userName: string
}

interface Quest {
  questId: string
  title: string
  durationMinutes: number
  intensity: "light" | "moderate" | "hard"
  questType: "walk" | "run" | "mixed"
  xpReward: number
  latitude: number
  longitude: number
  routeDescription: string
  isAssigned: boolean
  routeColorIndex: number | null
  distanceMeters?: number
  distance?: number
}

interface ExplorationCell {
  h3Index: string
  discoveredAt: string
}

interface ExplorationState {
  territory: {
    id: string
    name: string
    city: string
    boundary: TerritoryBoundary
  } | null
  cells: ExplorationCell[]
  fog: GeoJsonFeatureCollection
  resolution: number
}

const ROUTE_COLORS = ["#8b5cf6", "#ef4444", "#06b6d4", "#f59e0b"]
const MAX_ACTIVE_QUESTS = 4
const BOTTOM_NAV_OFFSET = 84
const FOG_SOURCE_ID = "exploration-fog"
const FOG_LAYER_ID = "exploration-fog-fill"
const FOG_OUTLINE_LAYER_ID = "exploration-fog-outline"
const FOG_PATTERN_ID = "fog-pattern-texture"
const KRASNOYARSK_CENTER: [number, number] = [92.87, 56.01]
const KRASNOYARSK_BOUNDS: [[number, number], [number, number]] = [
  [92.55, 55.83],
  [93.19, 56.19],
]
const LOCATION_ACCURACY_THRESHOLD = 500

// Функция для создания текстуры тумана
const generateFogTexture = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext("2d")!

  // Базовый слой тумана
  ctx.fillStyle = "rgba(2, 6, 23, 0.85)"
  ctx.fillRect(0, 0, 256, 256)

  // Добавляем облачные паттерны для более реалистичного вида
  ctx.globalCompositeOperation = "lighter"
  
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    const size = Math.random() * 80 + 40
    const opacity = Math.random() * 0.3 + 0.1
    
    ctx.fillStyle = `rgba(100, 120, 150, ${opacity})`
    ctx.beginPath()
    ctx.ellipse(x, y, size, size * 0.6, Math.random() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }

  // Добавляем детали с шумом
  ctx.globalCompositeOperation = "source-over"
  const imageData = ctx.getImageData(0, 0, 256, 256)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    // Добавляем случайный шум для эффекта дымки
    const noise = (Math.random() - 0.5) * 20
    data[i] += noise // R
    data[i + 1] += noise * 0.8 // G
    data[i + 2] += noise * 1.2 // B
    // Alpha остаётся как есть
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

export function QuestMapScreen({ onNavigate }: QuestMapScreenProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const initialized = useRef(false)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)
  const tempMarkerRef = useRef<maplibregl.Marker | null>(null)

  const [quests, setQuests] = useState<Quest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(() => {
    try {
      const saved = localStorage.getItem("user_location")
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem("location_accuracy")
      return saved ? Number(saved) : null
    } catch {
      return null
    }
  })
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeCount, setActiveCount] = useState(0)
  const [showLimitWarning, setShowLimitWarning] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [isSelectingLocation, setIsSelectingLocation] = useState(false)
  const [tempLocation, setTempLocation] = useState<[number, number] | null>(null)
  const [isGettingGPS, setIsGettingGPS] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [exploration, setExploration] = useState<ExplorationState | null>(null)
  const [isExplorationLoading, setIsExplorationLoading] = useState(true)

  const initialCenterRef = useRef<[number, number]>(userLocation || KRASNOYARSK_CENTER)
  const lastDiscoveredCellRef = useRef<string | null>(null)

  useEffect(() => {
    if (!userLocation) {
      return
    }

    try {
      localStorage.setItem("user_location", JSON.stringify(userLocation))
    } catch {}
  }, [userLocation])

  const fetchQuests = useCallback(async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        try {
          const cached = sessionStorage.getItem("quests_data")
          if (cached) {
            const { data, timestamp } = JSON.parse(cached)
            if (Date.now() - timestamp < 60000 && Array.isArray(data)) {
              setQuests(data)
              setActiveCount(data.filter((quest: Quest) => quest.isAssigned).length)
              setIsLoading(false)
              return
            }
          }
        } catch {}
      }

      const url = userLocation
        ? `/api/quests?lng=${userLocation[0]}&lat=${userLocation[1]}`
        : "/api/quests"

      const res = await fetch(url)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Не удалось загрузить квесты")
      }

      const questsList = Array.isArray(data.quests) ? data.quests : []
      setQuests(questsList)
      setActiveCount(questsList.filter((quest: Quest) => quest.isAssigned).length)
      sessionStorage.setItem(
        "quests_data",
        JSON.stringify({ data: questsList, timestamp: Date.now() })
      )
      setError(null)
    } catch (questsError) {
      console.error("[QuestMap] Failed to fetch quests:", questsError)
      setError("Ошибка соединения с сервером")
    } finally {
      setIsLoading(false)
    }
  }, [userLocation])

  useEffect(() => {
    fetchQuests()
  }, [fetchQuests])

  const fetchExploration = useCallback(async () => {
  try {
    setIsExplorationLoading(true)
    const res = await fetch("/api/map/exploration")
    const data = await res.json()
    const combinedFog = {
      type: "FeatureCollection",
      features: (data.territories ?? []).flatMap((t: any) => t.fog.features),
    }
    if (!res.ok) throw new Error(data.error || "Ошибка загрузки")

    setExploration({
      territories: data.territories ?? [],
      cells: data.cells ?? [],
      fog: combinedFog,
      resolution: data.resolution ?? EXPLORATION_H3_RESOLUTION,
    })
  } catch (explorationError) {
    console.error("[QuestMap] Failed to fetch exploration:", explorationError)
    setExploration({
      territories: [],
      cells: [],
      fog: { type: "FeatureCollection", features: [] },
      resolution: EXPLORATION_H3_RESOLUTION,
    })
  } finally {
    setIsExplorationLoading(false)
  }
}, [])

  useEffect(() => {
    fetchExploration()
  }, [fetchExploration])

  const addUserMarker = useCallback((location: [number, number]) => {
    if (!map.current) {
      return
    }

    userMarkerRef.current?.remove()

    const element = document.createElement("div")
    element.innerHTML =
      '<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>'

    userMarkerRef.current = new maplibregl.Marker({ element })
      .setLngLat(location)
      .addTo(map.current)
  }, [])

  useEffect(() => {
    if (!mapContainer.current || map.current || initialized.current) {
      return
    }

    initialized.current = true
    const center = initialCenterRef.current

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "В© OpenStreetMap",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center,
      zoom: 13,
      maxBounds: KRASNOYARSK_BOUNDS,
    })

    map.current.on("load", () => {
      map.current?.resize()
      setMapLoaded(true)
      setMapError(null)
      if (userLocation) {
        addUserMarker(userLocation)
      }
    })

    map.current.on("error", (event) => {
      console.error("[QuestMap] Map error:", event.error)
      setMapError("Ошибка загрузки карты")
    })

    return () => {
      userMarkerRef.current?.remove()
      tempMarkerRef.current?.remove()
      markersRef.current.forEach((marker) => marker.remove())
      map.current?.remove()
      map.current = null
      initialized.current = false
    }
  }, [])

  useEffect(() => {
    if (!mapLoaded || !userLocation) {
      return
    }

    addUserMarker(userLocation)
    map.current?.flyTo({ center: userLocation, zoom: 14 })
  }, [addUserMarker, mapLoaded, userLocation])

  useEffect(() => {
    if (!map.current || !isSelectingLocation) {
      return
    }

    const handleClick = (event: maplibregl.MapMouseEvent) => {
      const coords: [number, number] = [event.lngLat.lng, event.lngLat.lat]
      setTempLocation(coords)

      tempMarkerRef.current?.remove()

      const element = document.createElement("div")
      element.innerHTML =
        '<div style="width:24px;height:24px;background:#10b981;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>'

      tempMarkerRef.current = new maplibregl.Marker({ element })
        .setLngLat(coords)
        .addTo(map.current!)
    }

    map.current.on("click", handleClick)
    map.current.getCanvas().style.cursor = "crosshair"

    return () => {
      map.current?.off("click", handleClick)
      if (map.current) {
        map.current.getCanvas().style.cursor = ""
      }
    }
  }, [isSelectingLocation])

  const confirmLocation = () => {
    if (!tempLocation) {
      return
    }

    setUserLocation(tempLocation)
    setLocationAccuracy(null)
    setIsSelectingLocation(false)
    setTempLocation(null)
    tempMarkerRef.current?.remove()
    tempMarkerRef.current = null
    map.current?.flyTo({ center: tempLocation, zoom: 15 })
  }

  const cancelLocationSelection = () => {
    setIsSelectingLocation(false)
    setTempLocation(null)
    tempMarkerRef.current?.remove()
    tempMarkerRef.current = null
    if (map.current) {
      map.current.getCanvas().style.cursor = ""
    }
  }

  const handleGetGPS = () => {
    setIsGettingGPS(true)
    setGpsError(null)

    if (!navigator.geolocation) {
      setGpsError("Геолокация недоступна в вашем браузере")
      setIsGettingGPS(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: [number, number] = [
          position.coords.longitude,
          position.coords.latitude,
        ]
        const accuracy = position.coords.accuracy

        setUserLocation(coords)
        setLocationAccuracy(accuracy)
        setIsGettingGPS(false)
        setGpsError(null)

        if (accuracy > LOCATION_ACCURACY_THRESHOLD) {
          setGpsError(
            `GPS точность: ${Math.round(accuracy)}м. Это может быть неточно. Хотите выбрать вручную?`
          )

          setTimeout(() => {
            if (
              confirm(
                `GPS неточен (${Math.round(accuracy)}м > 500м). Выбрать местоположение вручную?`
              )
            ) {
              setIsSelectingLocation(true)
              setTempLocation(null)
            }
          }, 300)
        }
      },
      (geoError) => {
        console.error("[QuestMap] GPS error:", geoError)

        let errorMessage = "Ошибка при получении GPS"
        if (geoError.code === 1) {
          errorMessage = "Доступ к геолокации запрещён"
        } else if (geoError.code === 2) {
          errorMessage = "Геолокация недоступна"
        } else if (geoError.code === 3) {
          errorMessage = "Истекло время ожидания GPS"
        }

        setGpsError(errorMessage)
        setIsGettingGPS(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  useEffect(() => {
    if (!userLocation) {
      return
    }

    const resolution = exploration?.resolution ?? EXPLORATION_H3_RESOLUTION
    const currentCell = getExplorationCellIndex(userLocation[1], userLocation[0])

    if (lastDiscoveredCellRef.current === currentCell) {
      return
    }

    lastDiscoveredCellRef.current = currentCell

    const revealCurrentCell = async () => {
      try {
        const res = await fetch("/api/map/exploration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: userLocation[1],
            lng: userLocation[0],
            resolution,
          }),
        })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "Не удалось обновить исследование")
        }

        if (data.discovered !== false) {
          await fetchExploration()
        }
      } catch (discoveryError) {
        console.error("[QuestMap] Failed to reveal cell:", discoveryError)
      }
    }

    void revealCurrentCell()
  }, [exploration?.resolution, fetchExploration, userLocation])

  useEffect(() => {
    if (!map.current || !mapLoaded) {
      return
    }

    const fogData = exploration?.fog ?? {
      type: "FeatureCollection",
      features: [],
    }

    const syncFogLayer = () => {
      if (!map.current) {
        return
      }

      const existingSource = map.current.getSource(FOG_SOURCE_ID) as
        | maplibregl.GeoJSONSource
        | undefined

      if (existingSource) {
        existingSource.setData(fogData as any)
      } else {
        map.current.addSource(FOG_SOURCE_ID, {
          type: "geojson",
          data: fogData as any,
        })

        map.current.addLayer({
          id: FOG_LAYER_ID,
          type: "fill",
          source: FOG_SOURCE_ID,
          paint: {
            "fill-color": "#020617",
            "fill-opacity": 0.72,
          },
        })

        map.current.addLayer({
          id: FOG_OUTLINE_LAYER_ID,
          type: "line",
          source: FOG_SOURCE_ID,
          paint: {
            "line-color": "#0f172a",
            "line-width": 1,
            "line-opacity": 0.45,
          },
        })
      }

      if (map.current.getLayer(FOG_LAYER_ID)) {
        map.current.moveLayer(FOG_LAYER_ID)
      }
      if (map.current.getLayer(FOG_OUTLINE_LAYER_ID)) {
        map.current.moveLayer(FOG_OUTLINE_LAYER_ID)
      }
    }

    if (map.current.isStyleLoaded()) {
      syncFogLayer()
    } else {
      map.current.once("load", syncFogLayer)
    }

    return () => {
      map.current?.off("load", syncFogLayer)
    }
  }, [exploration, mapLoaded])

  useEffect(() => {
    if (!map.current || !mapLoaded) {
      return
    }

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    const discoveredCells = new Set(exploration?.cells.map((cell) => cell.h3Index) ?? [])

    const visibleQuests =
      exploration?.territories && discoveredCells.size > 0
        ? quests.filter((quest) =>
            discoveredCells.has(
              getExplorationCellIndex(quest.latitude, quest.longitude)
            )
          )
        : exploration?.territories
          ? []
          : quests

    visibleQuests.forEach((quest) => {
      const markerElement = document.createElement("div")
      markerElement.style.cursor = "pointer"

      if (quest.isAssigned && quest.routeColorIndex !== null) {
        const color = ROUTE_COLORS[quest.routeColorIndex]
        markerElement.innerHTML = `<div style="width:32px;height:32px;background:${color};border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${quest.routeColorIndex + 1}</div>`
      } else {
        markerElement.innerHTML =
          '<div style="width:28px;height:28px;background:#6366f1;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.2);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>'
      }

      const marker = new maplibregl.Marker({ element: markerElement })
        .setLngLat([quest.longitude, quest.latitude])
        .addTo(map.current!)

      marker.on("click", () => setSelectedQuest(quest))

      markersRef.current.push(marker)
    })
  }, [exploration, mapLoaded, quests])

  useEffect(() => {
    if (!map.current || !mapLoaded || !map.current.isStyleLoaded()) {
      return
    }

    const mapInstance = map.current
    const assignedQuests = quests.filter(
      (quest) => quest.isAssigned && quest.routeColorIndex !== null
    )
    const origin = userLocation || KRASNOYARSK_CENTER
    const routeLayerIds = (mapInstance.getStyle().layers ?? [])
      .map((layer) => layer.id)
      .filter((layerId) => layerId.startsWith("route-"))

    routeLayerIds.forEach((routeId) => {
      if (mapInstance.getLayer(routeId)) {
        mapInstance.removeLayer(routeId)
      }
      if (mapInstance.getSource(routeId)) {
        mapInstance.removeSource(routeId)
      }
    })

    assignedQuests.forEach((quest) => {
      const routeId = `route-${quest.questId}`

      mapInstance.addSource(routeId, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [origin, [quest.longitude, quest.latitude]],
          },
        },
      })

      mapInstance.addLayer({
        id: routeId,
        type: "line",
        source: routeId,
        paint: {
          "line-color": ROUTE_COLORS[quest.routeColorIndex!],
          "line-width": 4,
          "line-opacity": 0.7,
          "line-dasharray": [2, 2],
        },
      })
    })

    if (mapInstance.getLayer(FOG_LAYER_ID)) {
      mapInstance.moveLayer(FOG_LAYER_ID)
    }
    if (mapInstance.getLayer(FOG_OUTLINE_LAYER_ID)) {
      mapInstance.moveLayer(FOG_OUTLINE_LAYER_ID)
    }
  }, [mapLoaded, quests, userLocation])

  const handleAcceptQuest = async (questId: string) => {
    if (activeCount >= MAX_ACTIVE_QUESTS) {
      setShowLimitWarning(true)
      setTimeout(() => setShowLimitWarning(false), 3000)
      return
    }

    const usedColors = new Set(
      quests
        .filter((quest) => quest.isAssigned && quest.routeColorIndex !== null)
        .map((quest) => quest.routeColorIndex!)
    )

    let nextColorIndex = 0
    while (usedColors.has(nextColorIndex)) {
      nextColorIndex += 1
    }

    const optimisticQuests = quests.map((quest) =>
      quest.questId === questId
        ? { ...quest, isAssigned: true, routeColorIndex: nextColorIndex }
        : quest
    )

    setQuests(optimisticQuests)
    setActiveCount((current) => current + 1)
    sessionStorage.setItem(
      "quests_data",
      JSON.stringify({ data: optimisticQuests, timestamp: Date.now() })
    )

    try {
      const startedQuest = await createQuestSession(
        questId,
        optimisticQuests.find((quest) => quest.questId === questId)
      )
      await fetchQuests(true)
      onNavigate("active-quest", startedQuest)
    } catch (startError: any) {
      setError(startError.message || "Не удалось начать квест")
      await fetchQuests(true)
    }
  }

  const handleCancelQuest = async (questId: string) => {
    try {
      await fetch("/api/quests/assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId }),
      })
      await fetchQuests(true)
      setSelectedQuest(null)
    } catch (cancelError) {
      console.error("[QuestMap] Failed to cancel quest:", cancelError)
    }
  }

  const loadingMapOverlay = !mapLoaded || isLoading || isExplorationLoading
  const combinedError = mapError || error

  return (
    <div className="relative min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 flex items-center justify-between p-4 bg-white dark:bg-gray-950 border-b z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
            <MapIcon className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg">ZonExp</span>
        </div>

        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNotifications((current) => !current)}
          >
            <Bell className="w-5 h-5" />
          </Button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-900 border rounded-lg shadow-lg z-50 py-2">
              <div className="px-4 py-3 text-center text-sm text-muted-foreground">
                Уведомлений нет
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="relative flex-1 min-h-[50vh]">
        <div
          ref={mapContainer}
          className="absolute inset-0 bg-gray-100 dark:bg-gray-800"
          style={{ minHeight: "calc(100vh - 128px)" }}
        />

        {loadingMapOverlay && (
          <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-[2px] flex items-center justify-center">
            <div className="text-center space-y-4 px-6">
              <div className="w-14 h-14 mx-auto rounded-full border-4 border-white/20 border-t-white animate-spin" />
              <div className="space-y-1">
                <p className="text-white font-semibold">Карта загружается</p>
                <p className="text-sm text-slate-300">
                  Поднимаем туман и открываем уже изученные области.
                </p>
              </div>
            </div>
          </div>
        )}

        {combinedError && (
          <div className="absolute top-4 right-4 max-w-xs bg-red-50/95 text-red-700 border border-red-200 rounded-lg px-3 py-2 shadow z-30 text-xs">
            {combinedError}
          </div>
        )}

        {showLimitWarning && (
          <div className="absolute bottom-20 left-4 right-4 bg-amber-50/95 text-amber-800 border border-amber-200 rounded-lg px-3 py-2 shadow z-30 text-sm">
            Можно держать не более {MAX_ACTIVE_QUESTS} активных квестов одновременно.
          </div>
        )}

        {!userLocation && (
          <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-900/90 px-3 py-2 rounded-lg shadow text-xs z-30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              <span>Местоположение не выбрано</span>
              <div className="flex gap-1">
                <button
                  onClick={handleGetGPS}
                  disabled={isGettingGPS}
                  className="text-blue-600 hover:text-blue-800 underline font-medium disabled:opacity-50"
                >
                  {isGettingGPS ? "GPS..." : "GPS"}
                </button>
                <span className="text-gray-400">|</span>
                <button
                  onClick={() => {
                    setIsSelectingLocation(true)
                    setTempLocation(null)
                  }}
                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  Вручную
                </button>
              </div>
            </div>
            {gpsError && <div className="text-red-600 text-xs mt-1">{gpsError}</div>}
          </div>
        )}

        {userLocation &&
          locationAccuracy &&
          locationAccuracy <= LOCATION_ACCURACY_THRESHOLD && (
            <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-900/90 px-3 py-2 rounded-lg shadow text-xs z-30">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${locationAccuracy < 100 ? "bg-green-500" : "bg-yellow-500"}`}
                />
                <span>Точность: ~{Math.round(locationAccuracy)}м</span>
                <div className="flex gap-1">
                  <button
                    onClick={handleGetGPS}
                    disabled={isGettingGPS}
                    className="text-blue-600 hover:text-blue-800 underline font-medium disabled:opacity-50"
                  >
                    {isGettingGPS ? "GPS..." : "Обновить"}
                  </button>
                  <span className="text-gray-400">|</span>
                  <button
                    onClick={() => {
                      setIsSelectingLocation(true)
                      setTempLocation(null)
                    }}
                    className="text-blue-600 hover:text-blue-800 underline font-medium"
                  >
                    Изменить
                  </button>
                </div>
              </div>
            </div>
          )}

        {userLocation &&
          (!locationAccuracy || locationAccuracy > LOCATION_ACCURACY_THRESHOLD) && (
            <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-900/90 px-3 py-2 rounded-lg shadow text-xs z-30">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span>Красноярск (центр)</span>
                <div className="flex gap-1">
                  <button
                    onClick={handleGetGPS}
                    disabled={isGettingGPS}
                    className="text-blue-600 hover:text-blue-800 underline font-medium disabled:opacity-50"
                  >
                    {isGettingGPS ? "GPS..." : "GPS"}
                  </button>
                  <span className="text-gray-400">|</span>
                  <button
                    onClick={() => {
                      setIsSelectingLocation(true)
                      setTempLocation(null)
                    }}
                    className="text-blue-600 hover:text-blue-800 underline font-medium"
                  >
                    Изменить
                  </button>
                </div>
              </div>
            </div>
          )}

        {isSelectingLocation && (
          <>
            <div className="absolute top-4 left-4 right-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 z-30">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-800 dark:text-blue-200">
                  Нажмите на карту, чтобы выбрать местоположение
                </span>
              </div>
            </div>

            {tempLocation && (
              <div
                className="absolute left-4 right-4 bg-white dark:bg-gray-900 rounded-xl shadow-lg p-4 z-30"
                style={{ bottom: BOTTOM_NAV_OFFSET + 16 }}
              >
                <p className="text-sm font-medium mb-3">
                  Установить здесь ваше местоположение?
                </p>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={confirmLocation}>
                    Да, здесь
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={cancelLocationSelection}
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <button
          onClick={() => {
            if (isSelectingLocation) {
              cancelLocationSelection()
            } else if (userLocation) {
              map.current?.flyTo({ center: userLocation, zoom: 15 })
            } else {
              setIsSelectingLocation(true)
              setTempLocation(null)
            }
          }}
          className="absolute bottom-4 right-4 w-10 h-10 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center z-30 hover:bg-gray-50 dark:hover:bg-gray-700"
          title={
            isSelectingLocation
              ? "Отмена выбора"
              : userLocation
                ? "Центрировать на вас"
                : "Выбрать местоположение"
          }
        >
          <Navigation
            className={`w-5 h-5 ${userLocation ? "text-purple-600" : "text-gray-400"}`}
          />
        </button>

        {selectedQuest && (
          <div
            className="absolute left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl z-30 max-h-[60vh] overflow-y-auto"
            style={{ bottom: BOTTOM_NAV_OFFSET }}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-900 p-4 border-b">
              <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{selectedQuest.title}</h2>
                  <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {selectedQuest.durationMinutes} мин
                    </span>
                    <span className="text-purple-600 font-medium">
                      +{selectedQuest.xpReward} XP
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedQuest(null)}
                  className="p-2 hover:bg-muted rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Маршрут</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedQuest.routeDescription}
                </p>
              </div>

              {selectedQuest.isAssigned ? (
                <div className="space-y-2">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm font-medium text-green-600">
                    Квест принят!
                  </div>
                  <Button
                    variant="outline"
                    className="w-full text-red-600 border-red-200"
                    onClick={() => handleCancelQuest(selectedQuest.questId)}
                  >
                    Отменить квест
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-blue-600"
                  onClick={() => handleAcceptQuest(selectedQuest.questId)}
                >
                  Начать квест
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 flex items-center justify-around p-3 border-t bg-white dark:bg-gray-950 z-40">
        <button className="flex flex-col items-center gap-1 text-purple-600">
          <Home className="w-6 h-6" />
          <span className="text-xs">Главная</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onNavigate("quest-list")}
        >
          <MapIcon className="w-6 h-6" />
          <span className="text-xs">Квесты</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 text-muted-foreground"
          onClick={() => onNavigate("profile")}
        >
          <User className="w-6 h-6" />
          <span className="text-xs font-medium">Профиль</span>
        </button>
      </nav>
    </div>
  )
}
