"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Screen } from "@/app/page"
import { X, MapPin, Footprints, Gem, Timer, AlertTriangle, Navigation, Home } from "lucide-react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

interface ActiveQuestScreenProps {
  onNavigate: (screen: Screen, data?: any) => void
  quest?: any
}

const COMPLETION_THRESHOLD = 15 // метров

// OSRM API для построения маршрута по дорогам
async function fetchRoute(start: [number, number], end: [number, number]) {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`
    const res = await fetch(url)
    const data = await res.json()
    if (data.code === "Ok" && data.routes?.[0]) {
      return {
        geometry: data.routes[0].geometry,
        distance: data.routes[0].distance, // метры
      }
    }
  } catch (e) {
    console.warn("OSRM routing error:", e)
  }
  return null
}

// Расстояние по Haversine
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function ActiveQuestScreen({ onNavigate, quest }: ActiveQuestScreenProps) {
  const [time, setTime] = useState(0)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [routeGeometry, setRouteGeometry] = useState<any>(null)
  const [routeDistance, setRouteDistance] = useState(0)
  const [distanceTraveled, setDistanceTraveled] = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)

  console.log("[ActiveQuest] Rendered with quest:", quest ? {
    id: quest.questId,
    title: quest.title,
    lat: quest.latitude,
    lng: quest.longitude,
  } : "NO QUEST")

  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const prevLocation = useRef<[number, number] | null>(null)
  const watchId = useRef<number | null>(null)
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)

  // Проверяем, рядом ли пользователь с точкой назначения
  const isNearDestination = useCallback(() => {
    if (!userLocation || !quest) return false
    const dist = haversineDistance(userLocation[1], userLocation[0], quest.latitude, quest.longitude)
    return dist <= COMPLETION_THRESHOLD
  }, [userLocation, quest])

  // Получаем маршрут OSRM при наличии позиции
  useEffect(() => {
    if (!userLocation || !quest) return

    fetchRoute(userLocation, [quest.longitude, quest.latitude]).then((result) => {
      if (result) {
        setRouteGeometry(result.geometry)
        setRouteDistance(result.distance)
      } else {
        // Fallback: прямая линия
        const directDist = haversineDistance(userLocation[1], userLocation[0], quest.latitude, quest.longitude)
        setRouteDistance(directDist)
      }
    })
  }, [userLocation, quest])

  // Отслеживаем GPS
  useEffect(() => {
    if (!navigator.geolocation) return

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude]

        // Считаем пройденное расстояние
        if (prevLocation.current) {
          const segment = haversineDistance(
            prevLocation.current[1], prevLocation.current[0],
            coords[1], coords[0]
          )
          setDistanceTraveled((prev) => prev + segment)
        }

        prevLocation.current = coords
        setUserLocation(coords)
      },
      (err) => console.warn("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 2000 }
    )

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    }
  }, [])

  // Таймер
  useEffect(() => {
    const timer = setInterval(() => setTime((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  // Инициализация карты
  useEffect(() => {
    if (!mapContainer.current || !quest) {
      console.log("[ActiveQuestMap] Waiting for container or quest:", {
        hasContainer: !!mapContainer.current,
        hasQuest: !!quest,
      })
      return
    }
    if (map.current) return

    console.log("[ActiveQuestMap] Initializing map for quest:", quest.title, quest.latitude, quest.longitude)

    const center: [number, number] = userLocation || [quest.longitude, quest.latitude]

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
            attribution: "© OpenStreetMap",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center,
      zoom: 14,
    })

    map.current.on("load", () => {
      console.log("[ActiveQuestMap] Map loaded successfully")
    })

    map.current.on("error", (e) => {
      console.error("[ActiveQuestMap] Map error:", e.error)
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [quest])

  // Обновляем маркеры и маршрут на карте
  useEffect(() => {
    if (!map.current || !quest) return

    // Удаляем старые слои
    ["route-line", "user-marker", "dest-marker"].forEach((id) => {
      if (map.current!.getLayer(id)) map.current!.removeLayer(id)
      if (map.current!.getSource(id)) map.current!.removeSource(id)
    })
    userMarkerRef.current?.remove()
    userMarkerRef.current = null

    // Линия маршрута
    if (routeGeometry) {
      map.current.addSource("route-line", {
        type: "geojson",
        data: { type: "Feature", geometry: routeGeometry },
      })
      map.current.addLayer({
        id: "route-line",
        type: "line",
        source: "route-line",
        paint: { "line-color": "#8b5cf6", "line-width": 5, "line-opacity": 0.8 },
      })
    }

    // Маркер пользователя
    if (userLocation) {
      const userEl = document.createElement("div")
      userEl.innerHTML = `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`
      userMarkerRef.current = new maplibregl.Marker({ element: userEl })
        .setLngLat(userLocation)
        .addTo(map.current!)
    }

    // Маркер назначения
    const destEl = document.createElement("div")
    destEl.innerHTML = `<div style="width:20px;height:20px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`
    new maplibregl.Marker({ element: destEl })
      .setLngLat([quest.longitude, quest.latitude])
      .addTo(map.current!)

    // Показываем весь маршрут
    if (userLocation) {
      const bounds = new maplibregl.LngLatBounds()
      bounds.extend(userLocation)
      bounds.extend([quest.longitude, quest.latitude])
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 16 })
    }
  }, [routeGeometry, userLocation, quest])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Расчет текущего XP (% от пройденного расстояния маршрута)
  const progressPercent = routeDistance > 0 ? Math.min((distanceTraveled / routeDistance) * 100, 100) : 0
  const currentXp = Math.round((progressPercent / 100) * quest.xpReward)
  const nearDestination = isNearDestination()

  const handleCompleteQuest = async () => {
    if (isCompleting) return
    setIsCompleting(true)

    const successful = nearDestination

    try {
      const res = await fetch("/api/quest-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId: quest.questId, successful }),
      })
      const data = await res.json()
      if (res.ok) {
        onNavigate("reward", { earnedXp: data.earnedXp || currentXp, quest, successful })
      } else {
        console.error("Failed to complete quest:", data.error)
      }
    } catch {
      console.error("Failed to complete quest")
    } finally {
      setIsCompleting(false)
      setShowWarning(false)
    }
  }

  const handleClose = () => {
    onNavigate("quest-map")
  }

  if (!quest) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Квест не найден</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* HEADER */}
      <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-950 border-b shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{quest.title}</h1>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-full shrink-0">
          <Timer className="w-4 h-4 text-purple-600" />
          <span className="font-mono font-semibold text-purple-600 text-sm">{formatTime(time)}</span>
        </div>
        <button onClick={handleClose} className="p-2 hover:bg-muted rounded-full transition-colors shrink-0">
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* MAP */}
      <div className="relative w-full h-72 bg-gray-100 dark:bg-gray-800">
        <div ref={mapContainer} className="absolute inset-0" />
      </div>

      {/* PROGRESS */}
      <div className="p-4 bg-white dark:bg-gray-900 border-b">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Footprints className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium">{Math.round(distanceTraveled)} м / {Math.round(routeDistance)} м</span>
          </div>
          <div className="flex items-center gap-2">
            <Gem className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-purple-600">+{currentXp} XP</span>
          </div>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {nearDestination && (
          <p className="text-center text-sm text-green-600 font-medium mt-2">
            ✓ Вы у точки назначения! Можете завершить квест.
          </p>
        )}
      </div>

      {/* WARNING DIALOG (досрочное завершение) */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold">Завершить квест досрочно?</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Вы получите только <span className="font-semibold text-purple-600">+{currentXp} XP</span> из{" "}
              <span className="font-semibold">{quest.xpReward} XP</span> ({Math.round(progressPercent)}% пройдено). 
              Квест вернётся в доступные.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowWarning(false)}>
                Продолжить
              </Button>
              <Button className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={handleCompleteQuest} disabled={isCompleting}>
                {isCompleting ? "Завершение..." : "Завершить"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* COMPLETE BUTTON */}
      <div className="p-4 bg-white dark:bg-gray-900 border-t shrink-0">
        <Button
          className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          onClick={() => {
            if (nearDestination) {
              handleCompleteQuest()
            } else {
              setShowWarning(true)
            }
          }}
          disabled={isCompleting}
        >
          {nearDestination ? "✓ Завершить квест" : "Завершить квест"}
        </Button>
      </div>

      {/* BOTTOM NAVIGATION */}
      <nav className="flex items-center justify-around p-3 border-t bg-white dark:bg-gray-950 shrink-0">
        <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" onClick={handleClose}>
          <Home className="w-6 h-6" />
          <span className="text-xs">Главная</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-purple-600" onClick={() => onNavigate("quest-list")}>
          <Navigation className="w-6 h-6" />
          <span className="text-xs font-medium">Квесты</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" onClick={() => onNavigate("profile")}>
          <MapPin className="w-6 h-6" />
          <span className="text-xs">Профиль</span>
        </button>
      </nav>
    </div>
  )
}
