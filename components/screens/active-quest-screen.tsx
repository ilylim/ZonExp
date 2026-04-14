"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Screen } from "@/app/page"
import type { StartQuestResult } from "@/lib/game-types"
import { X, Footprints, Gem, Timer, AlertTriangle, Navigation, Home, User, Map as MapIcon, ChevronDown, MapPin } from "lucide-react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

interface ActiveQuestScreenProps {
  onNavigate: (screen: Screen, data?: any) => void
  session?: StartQuestResult
}

const COMPLETION_THRESHOLD = 40
const GPS_ACCURACY_THRESHOLD = 500

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function ActiveQuestScreen({ onNavigate, session }: ActiveQuestScreenProps) {
  const quest = session?.quest
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [fallbackLocation, setFallbackLocation] = useState<[number, number] | null>(() => {
    if (typeof window === "undefined") return null
    try {
      const saved = localStorage.getItem("user_location")
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [gpsLocation, setGpsLocation] = useState<[number, number] | null>(null)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(() => {
    if (typeof window === "undefined") return null
    try {
      const saved = localStorage.getItem("location_accuracy")
      return saved ? Number(saved) : null
    } catch {
      return null
    }
  })
  const [routeGeometry, setRouteGeometry] = useState<any>(null)
  const [distanceToTarget, setDistanceToTarget] = useState(0)
  const [distanceTraveled, setDistanceTraveled] = useState(0)
  // Устанавливается от сессии, которая пришла с сервера
  const [initialDistance, setInitialDistance] = useState(session?.initialDistanceMeters || 0)
  const [showWarning, setShowWarning] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [isSelectingLocation, setIsSelectingLocation] = useState(false)
  const [tempLocation, setTempLocation] = useState<[number, number] | null>(null)

  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const prevLocation = useRef<[number, number] | null>(null)
  const watchId = useRef<number | null>(null)
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)
  const destinationMarkerRef = useRef<maplibregl.Marker | null>(null)
  const tempMarkerRef = useRef<maplibregl.Marker | null>(null)

  const hasAccurateGps = gpsLocation && gpsAccuracy !== null && gpsAccuracy <= GPS_ACCURACY_THRESHOLD
  const currentLocation = hasAccurateGps ? gpsLocation : fallbackLocation

  const isNearDestination = useCallback(() => {
    if (!currentLocation || !quest) return false
    const dist = haversineDistance(currentLocation[1], currentLocation[0], quest.latitude, quest.longitude)
    return dist <= COMPLETION_THRESHOLD
  }, [currentLocation, quest])

  useEffect(() => {
    const startedAtMs = session?.startedAt ? new Date(session.startedAt).getTime() : Date.now()
    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)))
    }
    updateElapsed()
    const timer = window.setInterval(updateElapsed, 1000)
    return () => window.clearInterval(timer)
  }, [session?.startedAt])

  useEffect(() => {
    if (!navigator.geolocation) return

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude]
        const accuracy = pos.coords.accuracy ?? null
        setGpsAccuracy(accuracy)

        if (accuracy !== null && accuracy > GPS_ACCURACY_THRESHOLD) {
          return
        }

        if (prevLocation.current) {
          const segment = haversineDistance(
            prevLocation.current[1],
            prevLocation.current[0],
            coords[1],
            coords[0]
          )
          setDistanceTraveled((prev) => prev + segment)
        }

        prevLocation.current = coords
        setGpsLocation(coords)
      },
      (err) => console.warn("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    )

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    }
  }, [])

  useEffect(() => {
    if (!quest || !currentLocation) return

    const controller = new AbortController()

    const loadRoute = async () => {
      try {
        const res = await fetch(
          `/api/quests/${quest.questId}/route?lng=${currentLocation[0]}&lat=${currentLocation[1]}`,
          { signal: controller.signal }
        )
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "Не удалось построить маршрут")
        }

        setRouteGeometry(data.route)
        const distance = data.distanceMeters || 0
        setDistanceToTarget(distance)
        // Устанавливаем начальное расстояние только если оно еще не установлено из сессии
        if (initialDistance === 0 && distance > 0) {
          setInitialDistance(distance)
        }
      } catch (error: any) {
        if (error.name === "AbortError") return

        console.error("[ActiveQuest] Route error:", error)
        setRouteGeometry({
          type: "LineString",
          coordinates: [currentLocation, [quest.longitude, quest.latitude]],
        })
        const distance = Math.round(haversineDistance(currentLocation[1], currentLocation[0], quest.latitude, quest.longitude))
        setDistanceToTarget(distance)
        // Устанавливаем начальное расстояние только если оно еще не установлено из сессии
        if (initialDistance === 0 && distance > 0) {
          setInitialDistance(distance)
        }
      }
    }

    loadRoute()
    return () => controller.abort()
  }, [quest, currentLocation, initialDistance])

  // ИНИЦИАЛИЗАЦИЯ КАРТЫ
  useEffect(() => {
    if (!mapContainer.current || !quest || map.current) return

    const center = currentLocation || [quest.longitude, quest.latitude]

    // Оборачиваем в requestAnimationFrame, чтобы контейнер успел получить реальные размеры от браузера
    const initMap = () => {
      if (!mapContainer.current) return

      map.current = new maplibregl.Map({
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
        center,
        zoom: 14,
        fadeDuration: 0,
      })

      map.current.on("load", () => {
        if (!map.current || !quest) return
        setMapError(null)
        map.current.resize()
      })

      map.current.on("error", (e) => {
        console.error("[ActiveQuestMap] Map error:", e.error)
        setMapError("Ошибка загрузки карты")
      })
    }

    const rafId = requestAnimationFrame(initMap)

    return () => {
      cancelAnimationFrame(rafId)
      userMarkerRef.current?.remove()
      destinationMarkerRef.current?.remove()
      map.current?.remove()
      map.current = null
    }
  }, [quest, currentLocation])

  // ОТРИСОВКА МАРШРУТА И МАРКЕРОВ
  useEffect(() => {
    if (!map.current || !quest) return

    const updateMapData = () => {
      if (!map.current) return

      const routeId = "route"
      const routeLayerId = "route-line"

      if (map.current.getLayer(routeLayerId)) {
        map.current.removeLayer(routeLayerId)
      }
      if (map.current.getSource(routeId)) {
        map.current.removeSource(routeId)
      }

      if (routeGeometry) {
        map.current.addSource(routeId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: routeGeometry,
          },
        })

        map.current.addLayer({
          id: routeLayerId,
          type: "line",
          source: routeId,
          paint: { "line-color": "#8b5cf6", "line-width": 4, "line-opacity": 0.8, "line-dasharray": [3, 2] },
        })
      }

      userMarkerRef.current?.remove()
      destinationMarkerRef.current?.remove()

      if (currentLocation) {
        const startEl = document.createElement("div")
        startEl.innerHTML = `<div style="width:28px;height:28px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.05 11.5 7.35 11.76a1 1 0 0 0 1.3 0C13 21.5 20 15.4 20 10a8 8 0 0 0-8-8Z"/></svg></div>`
        userMarkerRef.current = new maplibregl.Marker({ element: startEl }).setLngLat(currentLocation).addTo(map.current)
      }

      const finishEl = document.createElement("div")
      finishEl.innerHTML = `<div style="width:32px;height:32px;background:#8b5cf6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`
      destinationMarkerRef.current = new maplibregl.Marker({ element: finishEl })
        .setLngLat([quest.longitude, quest.latitude])
        .addTo(map.current)

      const bounds = new maplibregl.LngLatBounds()
      if (currentLocation) {
        bounds.extend(currentLocation)
      }
      bounds.extend([quest.longitude, quest.latitude])
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 15 })
    }

    // ПРАВИЛЬНАЯ проверка загрузки стиля:
    // Если стиль уже загружен — рисуем сразу. Если нет — ждем событие 'load'.
    if (map.current.isStyleLoaded()) {
      updateMapData()
    } else {
      map.current.once('load', updateMapData)
    }

    return () => {
      map.current?.off('load', updateMapData)
    }
  }, [quest, currentLocation, routeGeometry])

  // Режим ручного выбора локации на карте
  useEffect(() => {
    if (!map.current || !isSelectingLocation) return

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      setTempLocation(coords)

      tempMarkerRef.current?.remove()
      const el = document.createElement("div")
      el.innerHTML = `<div style="width:24px;height:24px;background:#10b981;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`
      tempMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(coords).addTo(map.current!)
    }

    map.current.on("click", handleClick)
    map.current.getCanvas().style.cursor = "crosshair"

    return () => {
      map.current?.off("click", handleClick)
      if (map.current) map.current.getCanvas().style.cursor = ""
    }
  }, [isSelectingLocation])

  const confirmLocation = () => {
    if (!tempLocation) return
    localStorage.setItem("user_location", JSON.stringify(tempLocation))
    setFallbackLocation(tempLocation)
    setIsSelectingLocation(false)
    setTempLocation(null)
    tempMarkerRef.current?.remove()
    tempMarkerRef.current = null
    // Сбрасываем предыдущую локацию, чтобы расстояние считалось заново
    prevLocation.current = null
  }

  const cancelLocationSelection = () => {
    setIsSelectingLocation(false)
    setTempLocation(null)
    tempMarkerRef.current?.remove()
    tempMarkerRef.current = null
    if (map.current) map.current.getCanvas().style.cursor = ""
  }

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        requestAnimationFrame(() => map.current?.resize())
      }
    }

    const handleFocus = () => {
      requestAnimationFrame(() => map.current?.resize())
    }

    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("focus", handleFocus)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("focus", handleFocus)
    }
  }, [])

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const nearDestination = isNearDestination()
  const progressPercent = distanceToTarget > 0
    ? Math.max(0, Math.min((distanceTraveled / (distanceTraveled + distanceToTarget)) * 100, 100))
    : nearDestination ? 100 : 0

  const currentXp = (quest && initialDistance > 0)
    ? (nearDestination 
        ? (quest.xpReward ?? 0) 
        : Math.round(Math.max(0, (initialDistance - distanceToTarget) / initialDistance) * (quest.xpReward ?? 0)))
    : 0;

  const handleCompleteQuest = async () => {
    if (!quest || isCompleting) return
    setIsCompleting(true)

    const successful = nearDestination

    try {
      const res = await fetch("/api/quest-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questId: quest.questId,
          successful,
          userLat: currentLocation?.[1],
          userLng: currentLocation?.[0],
        }),
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

  if (!quest) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Квест не найден</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white dark:bg-gray-950 border-b shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{quest.title}</h1>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-full shrink-0">
          <Timer className="w-4 h-4 text-purple-600" />
          <span className="font-mono font-semibold text-purple-600 text-sm">{formatTime(elapsedSeconds)}</span>
        </div>
        <button onClick={() => onNavigate("quest-map")} className="p-2 hover:bg-muted rounded-full transition-colors shrink-0">
          <X className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="p-4 bg-white dark:bg-gray-900 border-b relative flex-1 flex flex-col">
          <div className="relative flex-1 min-h-[50vh]">
        <div 
          ref={mapContainer} 
          className="absolute inset-0 bg-gray-100 dark:bg-gray-800"
          style={{ minHeight: "calc(100vh - 350px)" }}
        />

            {/* Selection UI */}
            {isSelectingLocation && (
              <>
                <div className="absolute top-3 left-3 right-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2 z-10">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span className="text-xs text-blue-800 dark:text-blue-200">Нажмите на карту для выбора локации</span>
                  </div>
                </div>
              </>
            )}

            {/* Center/Select Button */}
            <button
              onClick={() => {
                if (isSelectingLocation) {
                  cancelLocationSelection()
                } else {
                  setIsSelectingLocation(true)
                  setTempLocation(null)
                }
              }}
              className="absolute bottom-3 right-3 z-10 w-10 h-10 bg-white dark:bg-gray-900 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Navigation className="w-5 h-5 text-purple-600" />
            </button>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-gray-900 border-b">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Footprints className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium">{Math.round(distanceToTarget)} м до цели</span>
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
              Вы у точки назначения. Можно завершить квест.
            </p>
          )}
        </div>

        <div className="p-4 bg-white dark:bg-gray-900 border-b">
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
            Завершить квест
          </Button>
        </div>
      </main>

      {/* Location Confirmation Modal */}
      {isSelectingLocation && tempLocation && (
        <div className="fixed bottom-20 left-4 right-4 bg-white dark:bg-gray-900 rounded-xl shadow-lg p-4 z-20">
          <p className="text-sm font-medium mb-3">Установить здесь ваше местоположение?</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={confirmLocation}>Да, здесь</Button>
            <Button variant="outline" className="flex-1" onClick={cancelLocationSelection}>Отмена</Button>
          </div>
        </div>
      )}

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

      <nav className="flex items-center justify-around p-3 border-t bg-white dark:bg-gray-950 shrink-0">
        <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" onClick={() => onNavigate("quest-map")}>
          <Home className="w-6 h-6" />
          <span className="text-xs">Главная</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-purple-600" onClick={() => onNavigate("quest-list")}>
          <MapIcon className="w-6 h-6" />
          <span className="text-xs font-medium">Квесты</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" onClick={() => onNavigate("profile")}>
          <User className="w-6 h-6" />
          <span className="text-xs">Профиль</span>
        </button>
      </nav>
    </div>
  )
}
