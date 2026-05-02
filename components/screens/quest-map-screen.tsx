"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import type { Screen } from "@/app/page"
import {
  EXPLORATION_H3_RESOLUTION,
  getExplorationCellIndex,
  type GeoJsonFeatureCollection,
} from "@/lib/exploration"
import { startQuest as createQuestSession } from "@/lib/start-quest"
import {
  Bell,
  Clock,
  Home,
  Map as MapIcon,
  User,
  X,
} from "lucide-react"
import maplibregl from "maplibre-gl"
import { useMap } from "@/components/map/map-provider"
import { cn } from "@/lib/utils"
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
  sessionId?: string | null
}

const ROUTE_COLORS = ["#8b5cf6", "#ef4444", "#06b6d4", "#f59e0b"]
const MAX_ACTIVE_QUESTS = 4
const KRASNOYARSK_CENTER: [number, number] = [92.87, 56.01]
const BOTTOM_NAV_OFFSET = 84

export function QuestMapScreen({ onNavigate }: QuestMapScreenProps) {
  const { map, exploration, refreshExploration, userLocation } = useMap()
  const markersRef = useRef<maplibregl.Marker[]>([])

  const [quests, setQuests] = useState<Quest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeCount, setActiveCount] = useState(0)
  const [showLimitWarning, setShowLimitWarning] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)



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
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить квесты")

      const questsList = Array.isArray(data.quests) ? data.quests : []
      setQuests(questsList)
      setActiveCount(questsList.filter((quest: Quest) => quest.isAssigned).length)
      sessionStorage.setItem("quests_data", JSON.stringify({ data: questsList, timestamp: Date.now() }))
      setError(null)
    } catch (err) {
      console.error("[QuestMap] Failed to fetch quests:", err)
      setError("Ошибка соединения с сервером")
    } finally {
      setIsLoading(false)
    }
  }, [userLocation])

  useEffect(() => {
    fetchQuests()
  }, [fetchQuests])

  useEffect(() => {
    if (!map) return
    setMapLoaded(true)

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
    }
  }, [map])



  // МАРКЕРЫ КВЕСТОВ
  useEffect(() => {
    if (!map || !mapLoaded) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    const discoveredCells = new Set(exploration?.cells.map((c) => c.h3Index) ?? [])
    const visibleQuests = exploration?.territories && discoveredCells.size > 0
      ? quests.filter((q) => discoveredCells.has(getExplorationCellIndex(q.latitude, q.longitude)))
      : exploration?.territories ? [] : quests

    visibleQuests.forEach((q) => {
      const el = document.createElement("div")
      el.style.cursor = "pointer"
      if (q.isAssigned && q.routeColorIndex !== null) {
        const color = ROUTE_COLORS[q.routeColorIndex]
        el.innerHTML = `<div style="width:32px;height:32px;background:${color};border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${q.routeColorIndex + 1}</div>`
      } else {
        el.innerHTML = '<div style="width:28px;height:28px;background:#6366f1;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.2);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>'
      }
      const marker = new maplibregl.Marker({ element: el }).setLngLat([q.longitude, q.latitude]).addTo(map)
      el.addEventListener("click", () => setSelectedQuest(q))
      markersRef.current.push(marker)
    })
  }, [map, exploration, mapLoaded, quests])

  // МАРШРУТЫ
  useEffect(() => {
    if (!map || !mapLoaded) return
    const assignedQuests = quests.filter((q) => q.isAssigned && q.routeColorIndex !== null)
    const origin = userLocation || KRASNOYARSK_CENTER
    
    // Очистка старых маршрутов
    const routeLayerIds = (map.getStyle().layers ?? []).map((l) => l.id).filter((id) => id.startsWith("route-"))
    routeLayerIds.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(id)) map.removeSource(id)
    })

    assignedQuests.forEach(async (q) => {
      const id = `route-${q.questId}`
      try {
        const res = await fetch(`/api/quests/${q.questId}/route?lng=${origin[0]}&lat=${origin[1]}`)
        if (!res.ok) throw new Error("Failed to load route")
        const data = await res.json()
        const geometry = data.route
        
        if (map.getSource(id)) return // Убедимся, что источник еще не добавлен (например, при быстром ререндере)

        map.addSource(id, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: geometry,
          },
        })
        map.addLayer({
          id,
          type: "line",
          source: id,
          paint: {
            "line-color": ROUTE_COLORS[q.routeColorIndex!],
            "line-width": 4,
            "line-opacity": 0.7,
            "line-dasharray": [2, 2],
          },
        })
      } catch (err) {
        // Фолбек: прямая линия
        if (map.getSource(id)) return
        map.addSource(id, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: [origin, [q.longitude, q.latitude]] },
          },
        })
        map.addLayer({
          id,
          type: "line",
          source: id,
          paint: {
            "line-color": ROUTE_COLORS[q.routeColorIndex!],
            "line-width": 4,
            "line-opacity": 0.7,
            "line-dasharray": [2, 2],
          },
        })
      }
    })
  }, [map, mapLoaded, quests, userLocation])

  const handleAcceptQuest = async (questId: string) => {
    if (activeCount >= MAX_ACTIVE_QUESTS) {
      setShowLimitWarning(true)
      setTimeout(() => setShowLimitWarning(false), 3000)
      return
    }
    try {
      const startedQuest = await createQuestSession(questId, quests.find(q => q.questId === questId))
      await fetchQuests(true)
      onNavigate("quest-details", startedQuest)
    } catch (err: any) {
      setError(err.message || "Ошибка запуска")
    }
  }

  const loadingMapOverlay = !mapLoaded || isLoading || !exploration
  const combinedError = mapError || error

  return (
    <div className="relative min-h-screen bg-transparent flex flex-col pointer-events-none">
      <header className="sticky top-0 flex items-center justify-between p-4 bg-white dark:bg-gray-950 border-b z-50 pointer-events-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
            <MapIcon className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg">ZonExp</span>
        </div>
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
      </header>

      <div className="relative flex-1 min-h-[50vh] pointer-events-none">
        <div className="absolute inset-0 bg-transparent pointer-events-none" style={{ minHeight: "calc(100vh - 128px)" }} />
        
        {loadingMapOverlay && (
          <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-auto">
             <div className="w-14 h-14 rounded-full border-4 border-white/20 border-t-white animate-spin mb-4" />
             <p className="text-white font-semibold">Загрузка приключений...</p>
          </div>
        )}

        {combinedError && (
          <div className="absolute top-4 right-4 max-w-xs bg-red-50/95 text-red-700 border border-red-200 rounded-lg px-3 py-2 shadow z-30 text-xs pointer-events-auto">
            {combinedError}
          </div>
        )}

        {selectedQuest && (
          <div className="absolute left-0 right-0 bottom-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl z-30 max-h-[60vh] overflow-y-auto pointer-events-auto" style={{ bottom: BOTTOM_NAV_OFFSET }}>
            <div className="sticky top-0 bg-white dark:bg-gray-900 p-4 border-b flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">{selectedQuest.title}</h2>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span><Clock className="w-4 h-4 inline mr-1" />{selectedQuest.durationMinutes} мин</span>
                  <span className="text-purple-600 font-bold">+{selectedQuest.xpReward} XP</span>
                </div>
              </div>
              <button onClick={() => setSelectedQuest(null)} className="p-2 hover:bg-muted rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">{selectedQuest.routeDescription}</p>
              <Button className="w-full h-12 text-lg font-bold" onClick={() => onNavigate("quest-details", selectedQuest)}>
                {selectedQuest.isAssigned ? "Перейти к квесту" : "Подробнее"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 flex items-center justify-around p-3 border-t bg-white dark:bg-gray-950 z-40 pointer-events-auto">
        <button className="flex flex-col items-center gap-1 text-purple-600"><Home className="w-6 h-6" /><span className="text-xs">Главная</span></button>
        <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" onClick={() => onNavigate("quest-list")}><MapIcon className="w-6 h-6" /><span className="text-xs">Квесты</span></button>
        <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" onClick={() => onNavigate("profile")}><User className="w-6 h-6" /><span className="text-xs">Профиль</span></button>
      </nav>
    </div>
  )
}
