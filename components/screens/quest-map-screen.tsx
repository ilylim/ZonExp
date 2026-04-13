"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Screen } from "@/app/page"
import { MapPin, Clock, X, Flag, Navigation, AlertTriangle, Bell, ChevronDown, Home, Map as MapIcon, User } from "lucide-react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

interface QuestMapScreenProps {
  onNavigate: (screen: Screen) => void
  onLogout: () => void
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
}

const intensityMap = {
  light: { label: "Лёгкий", color: "bg-green-500" },
  moderate: { label: "Средний", color: "bg-yellow-500" },
  hard: { label: "Сложный", color: "bg-red-500" },
}

const ROUTE_COLORS = ["#8b5cf6", "#ef4444", "#06b6d4", "#f59e0b"]
const MAX_ACTIVE_QUESTS = 4

// Центр Красноярска
const KRASNOYARSK_CENTER: [number, number] = [92.8700, 56.0100]

// Границы: ±20 км от центра Красноярска (приблизительно)
// 1° широты ≈ 111 км, 1° долготы ≈ 62 км (на широте 56°)
const KRASNOYARSK_BOUNDS: [[number, number], [number, number]] = [
  [92.55, 55.83], // юго-запад [lng, lat]
  [93.19, 56.19], // северо-восток [lng, lat]
]

// Порог точности геолокации (в метрах). Если хуже — используем центр Красноярска
const LOCATION_ACCURACY_THRESHOLD = 500

export function QuestMapScreen({ onNavigate, userName }: QuestMapScreenProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)
  const [quests, setQuests] = useState<Quest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(() => {
    try {
      const saved = localStorage.getItem("user_location")
      if (saved) {
        const parsed = JSON.parse(saved)
        console.log("Restored location from localStorage:", parsed)
        return parsed
      }
    } catch {}
    return null
  })
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeCount, setActiveCount] = useState(0)
  const [showLimitWarning, setShowLimitWarning] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem("location_accuracy")
      return saved ? Number(saved) : null
    } catch {
      return null
    }
  })
  const [isSelectingLocation, setIsSelectingLocation] = useState(false)
  const [tempLocation, setTempLocation] = useState<[number, number] | null>(null)
  const tempMarkerRef = useRef<maplibregl.Marker | null>(null)

  // Получаем квесты с кэшированием
  const fetchQuests = useCallback(async () => {
    try {
      // Проверяем кэш в sessionStorage
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

      console.log("Fetching quests from API...")
      const res = await fetch("/api/quests")
      const data = await res.json()
      
      if (res.ok) {
        const questsList = Array.isArray(data.quests) ? data.quests : []
        console.log(`Received ${questsList.length} quests from API`)
        setQuests(questsList)
        const assignedCount = questsList.filter((q: Quest) => q.isAssigned).length
        setActiveCount(assignedCount)
        
        // Сохраняем в sessionStorage для других экранов
        sessionStorage.setItem("quests_data", JSON.stringify({
          data: questsList,
          timestamp: Date.now()
        }))
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
  }, [])

  // Сохранение позиции в localStorage при изменении
  useEffect(() => {
    if (userLocation) {
      try {
        localStorage.setItem("user_location", JSON.stringify(userLocation))
        if (locationAccuracy !== null) {
          localStorage.setItem("location_accuracy", String(locationAccuracy))
        }
      } catch {}
    }
  }, [userLocation, locationAccuracy])

  // Если позиция восстановлена из localStorage - центрируем карту на ней
  useEffect(() => {
    if (!map.current || !userLocation) return
    map.current.flyTo({ center: userLocation, zoom: 14 })
  }, [])

  // Геолокация
  useEffect(() => {
    // Если позиция уже есть в localStorage - не запрашиваем геолокацию
    if (userLocation) {
      console.log("Location already set from localStorage, skipping geolocation request")
      return
    }

    console.log("Requesting geolocation...")
    if (!navigator.geolocation) {
      console.log("Geolocation not supported, entering manual selection mode")
      // Сразу включаем ручной выбор
      setTimeout(() => setIsSelectingLocation(true), 500)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Geolocation success:", position.coords.latitude, position.coords.longitude)
        console.log("Accuracy:", position.coords.accuracy, "meters")
        
        const accuracy = Math.round(position.coords.accuracy)
        setLocationAccuracy(accuracy)

        // Если точность плохая — включаем ручной выбор
        if (accuracy > LOCATION_ACCURACY_THRESHOLD) {
          console.log("Poor accuracy, entering manual selection mode")
          setTimeout(() => setIsSelectingLocation(true), 500)
        } else {
          const coords: [number, number] = [position.coords.longitude, position.coords.latitude]
          setUserLocation(coords)
        }
      },
      (err) => {
        console.error("Geolocation error:", err.code, err.message)
        // Если ошибка — сразу включаем ручной выбор
        console.log("Geolocation failed, entering manual selection mode")
        setTimeout(() => setIsSelectingLocation(true), 500)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }, [])

  // Инициализация карты (только один раз)
  useEffect(() => {
    if (!mapContainer.current) {
      console.error("Map container not found")
      return
    }
    if (map.current) return

    // Карта всегда инициализируется с центром Красноярска, но userLocation остаётся null
    // пока пользователь не выберет позицию вручную или не придёт точная геолокация
    console.log("Initializing map at Krasnoyarsk center, container:", mapContainer.current)

    // Таймаут для определения проблемы загрузки
    const loadTimeout = setTimeout(() => {
      if (!mapLoaded) {
        setMapError("Карта загружается слишком долго. Проверьте подключение к интернету.")
      }
    }, 10000)

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
            attribution: '© OpenStreetMap',
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: KRASNOYARSK_CENTER,
      zoom: 13,
      maxBounds: KRASNOYARSK_BOUNDS,
      fadeDuration: 0,
    })

    map.current.on("load", () => {
      console.log("Map loaded successfully")
      setMapLoaded(true)
      setMapError(null)
      clearTimeout(loadTimeout)
    })

    map.current.on("error", (e) => {
      console.error("Map error:", e.error)
      setMapError("Ошибка загрузки карты: " + (e.error?.message || "Неизвестная ошибка"))
    })

    // Обновление центра при получении геолокации
    if (userLocation && map.current) {
      map.current.setCenter(userLocation)
      map.current.setZoom(15)
    }

    return () => {
      clearTimeout(loadTimeout)
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
      map.current?.remove()
      map.current = null
    }
  }, [])

  // ✅ ОТДЕЛЬНЫЙ useEffect для загрузки квестов (только при монтировании)
  useEffect(() => {
    fetchQuests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Маркер пользователя (добавляется когда определена геолокация)
  useEffect(() => {
    if (!map.current || !userLocation) return
    if (userMarkerRef.current) return // уже добавлен

    // Маркер пользователя — пульсирующая точка
    const userMarkerEl = document.createElement("div")
    userMarkerEl.className = "user-marker"
    userMarkerEl.innerHTML = `
      <div style="position:relative;width:20px;height:20px;">
        <div style="width:14px;height:14px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);position:absolute;top:3px;left:3px;"></div>
        <div style="width:14px;height:14px;background:#3b82f6;border-radius:50%;position:absolute;top:3px;left:3px;opacity:0.4;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
      </div>
    `

    // Добавляем стиль анимации один раз
    if (!document.getElementById("map-ping-style")) {
      const style = document.createElement("style")
      style.id = "map-ping-style"
      style.textContent = `
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.4; }
          75%, 100% { transform: scale(2.5); opacity: 0; }
        }
      `
      document.head.appendChild(style)
    }

    userMarkerRef.current = new maplibregl.Marker({ element: userMarkerEl })
      .setLngLat(userLocation)
      .addTo(map.current)
  }, [userLocation])

  // Обновление маркеров квестов
  useEffect(() => {
    if (!map.current) {
      console.log("Map not ready for quest markers")
      return
    }
    if (quests.length === 0) {
      console.log("No quests to display markers for")
      return
    }

    console.log(`Rendering ${quests.length} quest markers`)

    // Очищаем старые маркеры безопасно
    markersRef.current.forEach((m: any) => {
      if (m && typeof m.remove === 'function') {
        try { m.remove() } catch {}
      }
    })
    markersRef.current = []

    quests.forEach((quest) => {
      console.log(`Creating marker for quest: ${quest.title} at [${quest.longitude}, ${quest.latitude}]`)
      
      const markerEl = document.createElement("div")
      markerEl.style.cursor = "pointer"
      markerEl.style.zIndex = "10"

      if (quest.isAssigned && quest.routeColorIndex !== null) {
        // Маркер для принятого квеста — цветной круг с номером
        const color = ROUTE_COLORS[quest.routeColorIndex]
        markerEl.innerHTML = `
          <div style="width:32px;height:32px;background:${color};border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
            ${quest.routeColorIndex + 1}
          </div>
        `
      } else {
        // Маркер для доступного квеста — фиолетовая точка
        markerEl.innerHTML = `
          <div style="width:28px;height:28px;background:#6366f1;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.2);">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
        `
      }

      const marker = new maplibregl.Marker({ element: markerEl })
        .setLngLat([quest.longitude, quest.latitude])
        .addTo(map.current!)
        .on("click", () => {
          console.log("Quest marker clicked:", quest.title)
          setSelectedQuest(quest)
        })

      markersRef.current.push(marker)
    })
    
    console.log(`Successfully created ${markersRef.current.length} markers`)
  }, [quests, userLocation])

  // Отрисовка маршрутов для принятых квестов
  useEffect(() => {
    if (!map.current) return

    // Удаляем старые маршруты
    const assignedQuests = quests.filter((q) => q.isAssigned && q.routeColorIndex !== null)

    assignedQuests.forEach((quest) => {
      const routeId = `route-${quest.questId}`
      const fromId = `from-${quest.questId}`
      const toId = `to-${quest.questId}`

      // Удаляем существующие слои/источники
      if (map.current!.getLayer(routeId)) map.current!.removeLayer(routeId)
      if (map.current!.getLayer(fromId)) map.current!.removeLayer(fromId)
      if (map.current!.getLayer(toId)) map.current!.removeLayer(toId)
      if (map.current!.getSource(routeId)) map.current!.removeSource(routeId)

      const from = userLocation || KRASNOYARSK_CENTER
      const to: [number, number] = [quest.longitude, quest.latitude]
      const color = ROUTE_COLORS[quest.routeColorIndex!]

      // Маршрут: прямая линия от пользователя до квеста
      map.current!.addSource(routeId, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: [from, to] },
        },
      })

      map.current!.addLayer({
        id: routeId,
        type: "line",
        source: routeId,
        paint: {
          "line-color": color,
          "line-width": 4,
          "line-opacity": 0.7,
          "line-dasharray": [2, 2],
        },
      })
    })
  }, [quests, userLocation])

  // Взять квест
  const handleAcceptQuest = async (questId: string) => {
    if (activeCount >= MAX_ACTIVE_QUESTS) {
      setShowLimitWarning(true)
      setTimeout(() => setShowLimitWarning(false), 3000)
      return
    }

    try {
      const res = await fetch("/api/quests/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId }),
      })

      const data = await res.json()

      if (res.ok) {
        // Обновляем список квестов
        await fetchQuests()
        setSelectedQuest(null)
      } else if (data.maxReached) {
        setShowLimitWarning(true)
        setTimeout(() => setShowLimitWarning(false), 3000)
      } else {
        setError(data.error || "Ошибка при принятии квеста")
      }
    } catch (error) {
      setError("Ошибка соединения с сервером")
    }
  }

  // Отменить квест
  const handleCancelQuest = async (questId: string) => {
    try {
      const res = await fetch("/api/quests/assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId }),
      })

      if (res.ok) {
        await fetchQuests()
        setSelectedQuest(null)
      }
    } catch (error) {
      setError("Ошибка при отмене квеста")
    }
  }

  // Расчёт расстояния до квеста (упрощённый Haversine)
  const calculateDistance = (questLat: number, questLng: number): number => {
    if (!userLocation) return 0
    const R = 6371000 // Радиус Земли в метрах
    const [userLng, userLat] = userLocation
    const dLat = ((questLat - userLat) * Math.PI) / 180
    const dLng = ((questLng - userLng) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((userLat * Math.PI) / 180) * Math.cos((questLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return Math.round(R * c)
  }

  // Центрирование на пользователе (или запрос геолокации)
  const centerOnUser = () => {
    if (!map.current) return
    
    // Если точность плохая или неизвестна — предлагаем выбрать вручную
    if (!locationAccuracy || locationAccuracy > LOCATION_ACCURACY_THRESHOLD) {
      setIsSelectingLocation(true)
      setTempLocation(null)
      return
    }
    
    // Иначе центрируем на пользователе
    if (userLocation) {
      map.current.flyTo({ center: userLocation, zoom: 15 })
    }
  }

  // Обработка клика по карте для выбора позиции
  useEffect(() => {
    if (!map.current || !isSelectingLocation) return

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      setTempLocation(coords)
      
      // Удаляем старый маркер
      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove()
      }
      
      // Создаём новый маркер
      const markerEl = document.createElement("div")
      markerEl.className = "temp-location-marker"
      markerEl.innerHTML = `
        <div style="width:32px;height:32px;background:#22c55e;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
      `
      
      tempMarkerRef.current = new maplibregl.Marker({ element: markerEl })
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
      tempMarkerRef.current?.remove()
      tempMarkerRef.current = null
    }
  }, [isSelectingLocation])

  // Подтверждение выбранной позиции
  const confirmLocation = () => {
    if (!tempLocation || !map.current) return
    
    setUserLocation(tempLocation)
    setLocationAccuracy(null)
    setIsSelectingLocation(false)
    setTempLocation(null)
    
    // Удаляем временный маркер
    tempMarkerRef.current?.remove()
    tempMarkerRef.current = null
    
    map.current.flyTo({ center: tempLocation, zoom: 15 })
    if (map.current.getCanvas().style.cursor === "crosshair") {
      map.current.getCanvas().style.cursor = ""
    }
  }

  // Отмена выбора позиции
  const cancelLocationSelection = () => {
    setIsSelectingLocation(false)
    setTempLocation(null)
    tempMarkerRef.current?.remove()
    tempMarkerRef.current = null
    if (map.current && map.current.getCanvas().style.cursor === "crosshair") {
      map.current.getCanvas().style.cursor = ""
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* HEADER */}
      <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-950 border-b z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
            <MapIcon className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg">ZonExp</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setShowNotifications(!showNotifications)}>
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
        </div>
      </header>

      {/* INFO BAR */}
      <div className="px-4 py-2 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-b flex items-center justify-between z-10">
        <div>
          <p className="text-sm">Привет, <span className="font-medium">{userName}</span>!</p>
          <p className="text-xs text-muted-foreground">Красноярск • {quests.length} квестов доступно</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {activeCount}/{MAX_ACTIVE_QUESTS} активных
          </span>
          <div className="flex gap-1">
            {Array.from({ length: MAX_ACTIVE_QUESTS }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${i < activeCount ? "bg-purple-500" : "bg-gray-300 dark:bg-gray-600"}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* MAP */}
      <div className="relative flex-1 min-h-[50vh]">
        <div 
          ref={mapContainer} 
          className="absolute inset-0 bg-gray-100 dark:bg-gray-800"
          style={{ minHeight: "400px" }}
        />

        {/* Fallback если карта не загрузилась */}
        {!mapLoaded && !mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Загрузка карты...</p>
            </div>
          </div>
        )}

        {/* Error state для карты */}
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
            <div className="text-center p-6">
              <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">{mapError}</p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setMapError(null)
                  setMapLoaded(false)
                  map.current?.remove()
                  map.current = null
                  // Принудительная перезагрузка компонента
                  window.location.reload()
                }}
              >
                Попробовать снова
              </Button>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="absolute top-4 left-4 right-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 z-20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Limit warning */}
        {showLimitWarning && (
          <div className="absolute top-4 left-4 right-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 z-20 animate-in slide-in-from-top">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-800 dark:text-red-200">
                Максимум {MAX_ACTIVE_QUESTS} активных квестов! Завершите один, чтобы взять новый.
              </p>
            </div>
          </div>
        )}

        {/* Center on user button */}
        <button
          onClick={centerOnUser}
          className="absolute bottom-4 right-4 w-10 h-10 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center z-10 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title={isSelectingLocation ? "Выберите точку на карте" : userLocation ? "Центрировать на вас" : "Определить местоположение"}
        >
          <Navigation className={`w-5 h-5 ${userLocation && locationAccuracy && locationAccuracy <= LOCATION_ACCURACY_THRESHOLD ? "text-purple-600" : "text-gray-400"}`} />
        </button>

        {/* Режим выбора позиции */}
        {isSelectingLocation && (
          <>
            {/* Панель подтверждения */}
            {tempLocation && (
              <div className="absolute bottom-20 left-4 right-4 bg-white dark:bg-gray-900 rounded-xl shadow-lg p-4 z-20">
                <p className="text-sm font-medium mb-3">Установить здесь ваше местоположение?</p>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={confirmLocation}>
                    Да, здесь
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={cancelLocationSelection}>
                    Отмена
                  </Button>
                </div>
              </div>
            )}

            {/* Инструкция если ещё не выбрано */}
            {!tempLocation && (
              <div className="absolute top-4 left-4 right-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 z-10">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-800 dark:text-blue-200">Нажмите на карту, чтобы выбрать ваше местоположение</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Geolocation status indicator */}
        {!userLocation && (
          <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-900/90 px-3 py-2 rounded-lg shadow text-xs z-10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              <span>Определение местоположения...</span>
            </div>
          </div>
        )}
        {userLocation && locationAccuracy && locationAccuracy <= LOCATION_ACCURACY_THRESHOLD && (
          <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-900/90 px-3 py-2 rounded-lg shadow text-xs z-10">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${locationAccuracy < 100 ? "bg-green-500" : locationAccuracy < 500 ? "bg-yellow-500" : "bg-red-500"}`} />
              <span>
                Точность: ~{locationAccuracy}м
                {locationAccuracy > 200 && (
                  <span className="text-muted-foreground ml-1">(Wi-Fi)</span>
                )}
              </span>
            </div>
          </div>
        )}
        {userLocation && (!locationAccuracy || locationAccuracy > LOCATION_ACCURACY_THRESHOLD) && (
          <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-900/90 px-3 py-2 rounded-lg shadow text-xs z-10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span>Красноярск (центр)</span>
            </div>
          </div>
        )}
      </div>

      {/* QUEST DETAIL POPUP */}
      {selectedQuest && (
        <div className="fixed inset-x-0 bottom-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl z-30 max-h-[60vh] overflow-y-auto animate-in slide-in-from-bottom">
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
                  <span className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${intensityMap[selectedQuest.intensity].color}`} />
                    {intensityMap[selectedQuest.intensity].label}
                  </span>
                  <span className="text-purple-600 font-medium">+{selectedQuest.xpReward} XP</span>
                </div>
                {userLocation && (
                  <p className="text-sm mt-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    ~{calculateDistance(selectedQuest.latitude, selectedQuest.longitude).toLocaleString()} м от вас
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedQuest(null)} className="p-2 hover:bg-muted rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Route description */}
            <div>
              <h3 className="font-semibold mb-2">Маршрут</h3>
              <p className="text-sm text-muted-foreground">{selectedQuest.routeDescription}</p>
            </div>

            {/* Actions */}
            {selectedQuest.isAssigned ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <Flag className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Квест принят!</span>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => handleCancelQuest(selectedQuest.questId)}
                >
                  Отменить квест
                </Button>
              </div>
            ) : (
              <Button
                className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                onClick={() => handleAcceptQuest(selectedQuest.questId)}
                disabled={activeCount >= MAX_ACTIVE_QUESTS}
              >
                {activeCount >= MAX_ACTIVE_QUESTS
                  ? `Максимум квестов (${MAX_ACTIVE_QUESTS})`
                  : `Взять квест (${activeCount}/${MAX_ACTIVE_QUESTS})`}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* LEGEND */}
      <div className="px-4 py-3 bg-white dark:bg-gray-950 border-t">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-indigo-500" />
              Доступные
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              Принятые
            </span>
          </div>
          <div className="flex gap-1">
            {ROUTE_COLORS.map((color, i) => (
              <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM NAVIGATION */}
      <nav className="flex items-center justify-around p-3 border-t bg-white dark:bg-gray-950">
        <button className="flex flex-col items-center gap-1 text-purple-600">
          <Home className="w-6 h-6" />
          <span className="text-xs font-medium">Главная</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onNavigate("quest-list")}
        >
          <MapIcon className="w-6 h-6" />
          <span className="text-xs">Квесты</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onNavigate("profile")}
        >
          <User className="w-6 h-6" />
          <span className="text-xs">Профиль</span>
        </button>
      </nav>
    </div>
  )
}
