"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
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
  Target,
  Swords
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

  const lastFetchLocation = useRef<[number, number] | null>(null)
  const lastFetchTime = useRef<number>(0)

  const fetchQuests = useCallback(async (forceRefresh = false) => {
    // Если это не принудительное обновление, проверяем нужно ли оно
    if (!forceRefresh && userLocation) {
      const now = Date.now()
      const timeSinceLastFetch = now - lastFetchTime.current
      
      // Не обновляем чаще чем раз в 30 секунд
      if (timeSinceLastFetch < 30000) return

      // Проверяем дистанцию (если переместились меньше чем на 50м - не обновляем)
      if (lastFetchLocation.current) {
        const dist = Math.sqrt(
          Math.pow(userLocation[0] - lastFetchLocation.current[0], 2) + 
          Math.pow(userLocation[1] - lastFetchLocation.current[1], 2)
        )
        // Примерная проверка (0.0005 градуса ~ 50м)
        if (dist < 0.0005 && timeSinceLastFetch < 300000) return 
      }
    }

    try {
      // Показываем загрузку только при первом входе или принудительном обновлении
      if (quests.length === 0 || forceRefresh) setIsLoading(true)
      
      const url = userLocation
        ? `/api/quests?lng=${userLocation[0]}&lat=${userLocation[1]}`
        : "/api/quests"

      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить квесты")

      const questsList = Array.isArray(data.quests) ? data.quests : []
      setQuests(questsList)
      setActiveCount(questsList.filter((quest: Quest) => quest.isAssigned).length)
      
      lastFetchLocation.current = userLocation
      lastFetchTime.current = Date.now()
      setError(null)
    } catch (err) {
      console.error("[QuestMap] Failed to fetch quests:", err)
      setError("Связь с гильдией утеряна")
    } finally {
      setIsLoading(false)
    }
  }, [userLocation, quests.length])

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

  // МАРКЕРЫ КВЕСТОВ В ПИКСЕЛЬНОМ СТИЛЕ
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
      el.className = "z-10"
      
      const inner = document.createElement("div")
      inner.className = "hover:scale-110 transition-transform cursor-pointer origin-center"
      
      if (q.isAssigned && q.routeColorIndex !== null) {
        const color = ROUTE_COLORS[q.routeColorIndex]
        inner.innerHTML = `<div style="width:36px;height:36px;background:${color};border:4px solid #1a1a1a;border-radius:0;display:flex;align-items:center;justify-content:center;color:white;font-family:'Press Start 2P', monospace;font-size:12px;box-shadow:4px 4px 0px 0px rgba(0,0,0,0.8);">${q.routeColorIndex + 1}</div>`
      } else {
        inner.innerHTML = '<div style="width:36px;height:36px;background:#eab308;border:4px solid #1a1a1a;border-radius:0;display:flex;align-items:center;justify-content:center;box-shadow:4px 4px 0px 0px rgba(0,0,0,0.8);"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>'
      }
      
      el.appendChild(inner)
      const marker = new maplibregl.Marker({ element: el }).setLngLat([q.longitude, q.latitude]).addTo(map)
      inner.addEventListener("click", () => setSelectedQuest(q))
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
        
        if (map.getSource(id)) return // Убедимся, что источник еще не добавлен
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
            "line-width": 6,
            "line-opacity": 0.8,
            "line-dasharray": [2, 1], // Более "пиксельный" пунктир
          },
        })
      } catch (err) {
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
            "line-width": 6,
            "line-opacity": 0.8,
            "line-dasharray": [2, 1],
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
      <header className="sticky top-0 flex items-center justify-between p-4 bg-background/90 backdrop-blur-sm border-b-4 border-border z-50 pointer-events-auto">
        <button 
          onClick={() => {}} 
          className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-default"
        >
          <img src="/emblem-pixel.png" alt="Emblem" className="w-10 h-10 object-contain" />
          <span className="font-press-start text-xl text-pixel-shadow text-primary hidden sm:block uppercase">ZonExp</span>
        </button>
        <div className="relative">
          <Button variant="outline" size="icon" onClick={() => setShowNotifications(!showNotifications)} className="border-pixel-sm">
            <Bell className="w-5 h-5" />
          </Button>
          <AnimatePresence>
            {showNotifications && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 top-full mt-2 w-64 bg-card border-pixel p-1 shadow-2xl z-50"
              >
                <div className="px-4 py-3 text-center font-press-start text-xs text-muted-foreground leading-relaxed">
                  Почтовый голубь не принес вестей
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="relative flex-1 min-h-[50vh] pointer-events-none">
        <div className="absolute inset-0 bg-transparent pointer-events-none" style={{ minHeight: "calc(100vh - 128px)" }} />
        
        <AnimatePresence>
          {loadingMapOverlay && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-auto border-pixel m-4 p-8"
            >
               <Swords className="w-16 h-16 text-primary animate-pulse mb-6" />
               <p className="font-press-start text-primary text-sm text-pixel-shadow text-center leading-relaxed">РАЗВЕРТЫВАНИЕ<br/>КАРТЫ МИРА...</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {combinedError && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="absolute top-4 right-4 max-w-xs bg-destructive text-destructive-foreground border-pixel p-3 shadow-2xl z-30 pointer-events-auto"
            >
              <p className="font-bold text-sm leading-tight">{combinedError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedQuest && (
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute left-0 right-0 bg-card border-t-4 border-border shadow-[0_-10px_20px_rgba(0,0,0,0.3)] z-30 max-h-[60vh] overflow-y-auto pointer-events-auto" 
              style={{ bottom: BOTTOM_NAV_OFFSET }}
            >
              <div className="sticky top-0 bg-secondary p-4 border-b-4 border-border flex items-start justify-between">
                <div className="pr-8">
                  <h2 className="text-lg font-press-start text-secondary-foreground text-pixel-shadow leading-relaxed">{selectedQuest.title}</h2>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="font-bold flex items-center bg-background border-pixel-sm px-2 py-1 text-sm">
                      <Clock className="w-4 h-4 mr-2 text-accent" />
                      {selectedQuest.durationMinutes} МИН
                    </span>
                    <span className="font-press-start text-xs text-primary bg-background border-pixel-sm px-2 py-2">
                      +{selectedQuest.xpReward} XP
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedQuest(null)} className="absolute top-4 right-4 p-1 bg-background border-pixel-sm hover:bg-muted transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-4 bg-[url('/pixel-pattern.png')] bg-repeat bg-[length:16px_16px]">
                <div className="bg-background border-pixel-sm p-4">
                  <p className="text-lg font-vt323 leading-relaxed">{selectedQuest.routeDescription}</p>
                </div>
                <Button 
                  className={`w-full h-14 border-pixel-sm font-press-start text-sm hover:scale-[1.02] transition-transform ${selectedQuest.isAssigned ? 'bg-accent text-accent-foreground hover:bg-accent/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`} 
                  onClick={() => onNavigate("quest-details", selectedQuest)}
                >
                  {selectedQuest.isAssigned ? "ПРОДОЛЖИТЬ КВЕСТ" : "ОТКРЫТЬ СВИТОК"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 flex items-center justify-around p-2 border-t-4 border-border bg-card z-40 pointer-events-auto">
        <button className="flex flex-col items-center gap-1 p-2 text-primary group">
          <div className="-translate-y-1">
            <Home className="w-7 h-7 drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]" />
          </div>
          <span className="text-xs font-bold uppercase underline decoration-2 underline-offset-4">Карта</span>
        </button>
        <button 
          className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-primary transition-colors group" 
          onClick={() => onNavigate("quest-list")}
        >
          <div className="group-hover:-translate-y-1 transition-transform">
            <MapIcon className="w-7 h-7" />
          </div>
          <span className="text-xs font-bold uppercase">Квесты</span>
        </button>
        <button 
          className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-primary transition-colors group" 
          onClick={() => onNavigate("profile")}
        >
          <div className="group-hover:-translate-y-1 transition-transform">
            <User className="w-7 h-7" />
          </div>
          <span className="text-xs font-bold uppercase">Герой</span>
        </button>
      </nav>
    </div>
  )
}

