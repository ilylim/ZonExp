"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Screen } from "@/app/page"
import { MapPin, Clock, X, Flag, Navigation, AlertTriangle, Bell, ChevronDown, Home, Map as MapIcon, User } from "lucide-react"
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

const intensityMap = {
  light: { label: "Лёгкий", color: "bg-green-500" },
  moderate: { label: "Средний", color: "bg-yellow-500" },
  hard: { label: "Сложный", color: "bg-red-500" },
}

const ROUTE_COLORS = ["#8b5cf6", "#ef4444", "#06b6d4", "#f59e0b"]
const MAX_ACTIVE_QUESTS = 4
const KRASNOYARSK_CENTER: [number, number] = [92.8700, 56.0100]
const KRASNOYARSK_BOUNDS: [[number, number], [number, number]] = [
  [92.55, 55.83],
  [93.19, 56.19],
]
const LOCATION_ACCURACY_THRESHOLD = 500

export function QuestMapScreen({ onNavigate, userName }: QuestMapScreenProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)
  const initialized = useRef(false)

  const [quests, setQuests] = useState<Quest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Читаем позицию из localStorage при старте
  const [userLocation, setUserLocation] = useState<[number, number] | null>(() => {
    try {
      const saved = localStorage.getItem("user_location")
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem("location_accuracy")
      return saved ? Number(saved) : null
    } catch { return null }
  })

  // Сохраняем позицию в localStorage при изменении
  useEffect(() => {
    if (userLocation) {
      try {
        localStorage.setItem("user_location", JSON.stringify(userLocation))
      } catch {}
    }
  }, [userLocation])

  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeCount, setActiveCount] = useState(0)
  const [showLimitWarning, setShowLimitWarning] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [isSelectingLocation, setIsSelectingLocation] = useState(false)
  const [tempLocation, setTempLocation] = useState<[number, number] | null>(null)
  const tempMarkerRef = useRef<maplibregl.Marker | null>(null)

  const fetchQuests = useCallback(async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        try {
          const cached = sessionStorage.getItem("quests_data")
          if (cached) {
            const { data, timestamp } = JSON.parse(cached)
            if (Date.now() - timestamp < 60000 && Array.isArray(data)) {
              console.log("[QuestMap] Restoring quests from cache")
              setQuests(data)
              const assignedCount = data.filter((q: Quest) => q.isAssigned).length
              setActiveCount(assignedCount)
              setIsLoading(false)
              return
            }
          }
        } catch {}
      }

      console.log("Fetching quests from API...")
      const url = userLocation
        ? `/api/quests?lng=${userLocation[0]}&lat=${userLocation[1]}`
        : "/api/quests"
      
      const res = await fetch(url)
      const data = await res.json()

      if (res.ok) {
        const questsList = Array.isArray(data.quests) ? data.quests : []
        console.log(`Received ${questsList.length} quests from API`)
        setQuests(questsList)
        const assignedCount = questsList.filter((q: Quest) => q.isAssigned).length
        setActiveCount(assignedCount)
        sessionStorage.setItem("quests_data", JSON.stringify({ data: questsList, timestamp: Date.now() }))
      } else {
        console.error("API error:", data.error)
        setError(data.error || "Не удалось загрузить квесты")
      }
    } catch (error) {
      console.error("Failed to fetch quests:", error)
      setError("Ошибка соединения с сервером")
    } finally {
      setIsLoading(false)
    }
  }, [userLocation])

  useEffect(() => {
    fetchQuests()
  }, [fetchQuests])

  // Функция добавления маркера (объявлена до использования)
  const addUserMarker = (location: [number, number]) => {
    if (!map.current) return
    userMarkerRef.current?.remove()
    
    const el = document.createElement("div")
    el.innerHTML = `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`
    userMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(location).addTo(map.current)
  }


// Инициализация карты
useEffect(() => {
  if (!mapContainer.current || map.current || initialized.current) {
    console.log("[Map] Skipping init:", { 
      hasContainer: !!mapContainer.current, 
      hasMap: !!map.current, 
      alreadyInitialized: initialized.current 
    })
    return
  }

  initialized.current = true
  const center = userLocation || KRASNOYARSK_CENTER
  
  if (!center[0] || !center[1] || isNaN(center[0]) || isNaN(center[1])) {
    console.error("[Map] Invalid center coordinates:", center)
    return
  }

  console.log("[Map] Initializing map at:", center)

  try {
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png", "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: '© OpenStreetMap',
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center,
      zoom: 13,
      maxBounds: KRASNOYARSK_BOUNDS,
    })

    map.current.on("load", () => {
      console.log("[Map] Map loaded successfully")
      map.current?.resize()
      setMapLoaded(true)
      setMapError(null)
      if (userLocation) addUserMarker(userLocation)
    })

    map.current.on("error", (e) => {
      console.error("[Map] Map error:", e.error)
      setMapError("Ошибка загрузки карты")
    })
  } catch (err) {
    console.error("[Map] Init failed:", err)
  }

  return () => {
    console.log("[Map] Cleanup")
    if (map.current) {
      map.current.remove()
      map.current = null
    }
    initialized.current = false   // ← КЛЮЧЕВАЯ СТРОКА
  }
}, [userLocation]) // ← важно: добавили userLocation в зависимости

  // Обновление маркера при смене позиции
  useEffect(() => {
    if (mapLoaded && userLocation) {
      addUserMarker(userLocation)
      map.current?.flyTo({ center: userLocation, zoom: 14 })
    }
  }, [userLocation, mapLoaded])

  // Режим ручного выбора
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
    if (map.current) map.current.getCanvas().style.cursor = ""
  }

  // Обновление маркеров квестов
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    markersRef.current.forEach((m) => { if (m.remove) m.remove() })
    markersRef.current = []

    quests.forEach((quest) => {
      const markerEl = document.createElement("div")
      markerEl.style.cursor = "pointer"

      if (quest.isAssigned && quest.routeColorIndex !== null) {
        const color = ROUTE_COLORS[quest.routeColorIndex]
        markerEl.innerHTML = `<div style="width:32px;height:32px;background:${color};border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${quest.routeColorIndex + 1}</div>`
      } else {
        markerEl.innerHTML = `<div style="width:28px;height:28px;background:#6366f1;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.2);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`
      }

      const marker = new maplibregl.Marker({ element: markerEl })
        .setLngLat([quest.longitude, quest.latitude])
        .addTo(map.current!)
        .on("click", () => setSelectedQuest(quest))

      markersRef.current.push(marker)
    })
  }, [quests, mapLoaded])

  // Отрисовка маршрутов
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    const assignedQuests = quests.filter((q) => q.isAssigned && q.routeColorIndex !== null)
    const origin = userLocation || KRASNOYARSK_CENTER

    assignedQuests.forEach((quest) => {
      const routeId = `route-${quest.questId}`
      if (map.current!.getLayer(routeId)) map.current!.removeLayer(routeId)
      if (map.current!.getSource(routeId)) map.current!.removeSource(routeId)

      map.current!.addSource(routeId, {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: [origin, [quest.longitude, quest.latitude]] } },
      })
      map.current!.addLayer({
        id: routeId, type: "line", source: routeId,
        paint: { "line-color": ROUTE_COLORS[quest.routeColorIndex!], "line-width": 4, "line-opacity": 0.7, "line-dasharray": [2, 2] },
      })
    })
  }, [quests, userLocation, mapLoaded])

  const handleAcceptQuest = async (questId: string) => {
    if (activeCount >= MAX_ACTIVE_QUESTS) {
      setShowLimitWarning(true)
      setTimeout(() => setShowLimitWarning(false), 3000)
      return
    }

    const usedColors = new Set(quests.filter((q) => q.isAssigned && q.routeColorIndex !== null).map((q) => q.routeColorIndex!))
    let nextColorIndex = 0
    while (usedColors.has(nextColorIndex)) nextColorIndex++
    
    const optimisticQuests = quests.map((q) => q.questId === questId ? { ...q, isAssigned: true, routeColorIndex: nextColorIndex } : q)
    setQuests(optimisticQuests)
    setActiveCount((prev) => prev + 1)
    sessionStorage.setItem("quests_data", JSON.stringify({ data: optimisticQuests, timestamp: Date.now() }))

    try {
      const res = await fetch("/api/quests/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId }),
      })
      const data = await res.json()
      if (!res.ok) throw data
      
      await fetchQuests(true)
      onNavigate("active-quest", { quest: optimisticQuests.find(q => q.questId === questId) })
    } catch (e: any) {
      setError(e.message || "Не удалось начать квест")
      await fetchQuests(true)
    }
  }

  const handleCancelQuest = async (questId: string) => {
    try {
      await fetch("/api/quests/assignments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questId }) })
      await fetchQuests(true)
      setSelectedQuest(null)
    } catch {}
  }

  return (
    <div className="relative min-h-screen bg-background flex flex-col">
      {/* HEADER */}
      <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-950 border-b z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
            <MapIcon className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg">ZonExp</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setShowNotifications(!showNotifications)}>
              <Bell className="w-5 h-5" />
            </Button>
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-900 border rounded-lg shadow-lg z-50 py-2">
                <div className="px-4 py-3 text-center text-sm text-muted-foreground">Уведомлений нет</div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAP CONTAINER */}
      <div className="relative flex-1 min-h-[50vh]">
        <div 
          ref={mapContainer} 
          className="absolute inset-0 bg-gray-100 dark:bg-gray-800"
          style={{ minHeight: "calc(100vh - 128px)" }}
        />

        {/* Status Indicator */}
        {!userLocation && (
          <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-900/90 px-3 py-2 rounded-lg shadow text-xs z-10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              <span>Местоположение не выбрано</span>
              <button onClick={() => { setIsSelectingLocation(true); setTempLocation(null); }} className="text-blue-600 hover:text-blue-800 underline font-medium">Выбрать</button>
            </div>
          </div>
        )}
        {userLocation && locationAccuracy && locationAccuracy <= LOCATION_ACCURACY_THRESHOLD && (
          <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-900/90 px-3 py-2 rounded-lg shadow text-xs z-10">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${locationAccuracy < 100 ? "bg-green-500" : "bg-yellow-500"}`} />
              <span>Точность: ~{locationAccuracy}м</span>
              <button onClick={() => { setIsSelectingLocation(true); setTempLocation(null); }} className="text-blue-600 hover:text-blue-800 underline font-medium">Изменить</button>
            </div>
          </div>
        )}
        {userLocation && (!locationAccuracy || locationAccuracy > LOCATION_ACCURACY_THRESHOLD) && (
          <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-900/90 px-3 py-2 rounded-lg shadow text-xs z-10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span>Красноярск (центр)</span>
              <button onClick={() => { setIsSelectingLocation(true); setTempLocation(null); }} className="text-blue-600 hover:text-blue-800 underline font-medium">Изменить</button>
            </div>
          </div>
        )}

        {/* Selection UI */}
        {isSelectingLocation && (
          <>
            <div className="absolute top-4 left-4 right-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 z-10">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-800 dark:text-blue-200">Нажмите на карту, чтобы выбрать местоположение</span>
              </div>
            </div>
            {tempLocation && (
              <div className="absolute bottom-20 left-4 right-4 bg-white dark:bg-gray-900 rounded-xl shadow-lg p-4 z-20">
                <p className="text-sm font-medium mb-3">Установить здесь ваше местоположение?</p>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={confirmLocation}>Да, здесь</Button>
                  <Button variant="outline" className="flex-1" onClick={cancelLocationSelection}>Отмена</Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Center Button */}
        <button
          onClick={() => {
            if (isSelectingLocation) cancelLocationSelection()
            else if (userLocation) map.current?.flyTo({ center: userLocation, zoom: 15 })
            else { setIsSelectingLocation(true); setTempLocation(null); }
          }}
          className="absolute bottom-4 right-4 w-10 h-10 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center z-10 hover:bg-gray-50 dark:hover:bg-gray-700"
          title={isSelectingLocation ? "Отмена выбора" : userLocation ? "Центрировать на вас" : "Выбрать местоположение"}
        >
          <Navigation className={`w-5 h-5 ${userLocation ? "text-purple-600" : "text-gray-400"}`} />
        </button>

        {/* Quest Popup */}
        {selectedQuest && (
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl z-30 max-h-[60vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 p-4 border-b">
              <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{selectedQuest.title}</h2>
                  <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {selectedQuest.durationMinutes} мин</span>
                    <span className="text-purple-600 font-medium">+{selectedQuest.xpReward} XP</span>
                  </div>
                </div>
                <button onClick={() => setSelectedQuest(null)} className="p-2 hover:bg-muted rounded-full"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Маршрут</h3>
                <p className="text-sm text-muted-foreground">{selectedQuest.routeDescription}</p>
              </div>
              {selectedQuest.isAssigned ? (
                <div className="space-y-2">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm font-medium text-green-600">Квест принят!</div>
                  <Button variant="outline" className="w-full text-red-600 border-red-200" onClick={() => handleCancelQuest(selectedQuest.questId)}>Отменить квест</Button>
                </div>
              ) : (
                <Button className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-blue-600" onClick={() => handleAcceptQuest(selectedQuest.questId)}>Начать квест</Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAVIGATION */}
      <nav className="flex items-center justify-around p-3 border-t bg-white dark:bg-gray-950 z-10 shrink-0">
        <button className="flex flex-col items-center gap-1 text-purple-600">
          <Home className="w-6 h-6" />
          <span className="text-xs font-medium">Главная</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" onClick={() => onNavigate("quest-list")}>
          <MapIcon className="w-6 h-6" />
          <span className="text-xs">Квесты</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" onClick={() => onNavigate("profile")}>
          <User className="w-6 h-6" />
          <span className="text-xs">Профиль</span>
        </button>
      </nav>
    </div>
  )
}
