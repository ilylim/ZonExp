"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { startQuest as createQuestSession } from "@/lib/start-quest"
import type { QuestWithLocation, StartQuestResult } from "@/lib/game-types"
import type { Screen } from "@/app/page"
import { useMap } from "@/components/map/map-provider"
import {
  ArrowLeft,
  Heart,
  MapPin,
  Gem,
  Trophy,
  Timer,
  Footprints,
  AlertTriangle,
} from "lucide-react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

interface QuestDetailsScreenProps {
  onNavigate: (screen: Screen, data?: any) => void
  quest?: any
}

const intensityMap: Record<string, { label: string; color: string }> = {
  light: { label: "Лёгкий", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  moderate: { label: "Средний", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  hard: { label: "Сложный", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function QuestDetailsScreen({ onNavigate, quest: initialInput }: QuestDetailsScreenProps) {
  const { map, exploration, userLocation } = useMap()
  
  const initialSessionId = initialInput?.sessionId || null
  const initialQuestId = initialInput?.questId || (typeof initialInput === "string" ? initialInput : initialInput?.quest?.questId)
  const preloadedQuest = initialInput?.title ? initialInput : initialInput?.quest?.title ? initialInput.quest : null

  const [quest, setQuest] = useState<QuestWithLocation | undefined>(preloadedQuest)
  const [session, setSession] = useState<StartQuestResult | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(!preloadedQuest)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [distanceTraveled, setDistanceTraveled] = useState(0) // TODO: track via watcher if needed
  const [distanceToTarget, setDistanceToTarget] = useState(0)
  const [initialDistance, setInitialDistance] = useState(0)

  const questMarkerRef = useRef<maplibregl.Marker | null>(null)

  const isAssigned = quest?.isAssigned || !!initialSessionId || !!session?.sessionId
  const currentLocation = userLocation

  const handleCompleteQuest = useCallback(async () => {
    if (!quest || isCompleting) return
    setIsCompleting(true)
    try {
      const res = await fetch("/api/quest-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          questId: quest.questId, 
          userLat: currentLocation?.[1], 
          userLng: currentLocation?.[0] 
        }),
      })
      const data = await res.json()
      if (res.ok) {
        sessionStorage.removeItem("quests_data")
        onNavigate("reward", { earnedXp: data.earnedXp, quest, successful: data.successful })
      }
    } catch (err) {
      console.error("[QuestDetails] Complete error:", err)
    } finally {
      setIsCompleting(false)
    }
  }, [quest, isCompleting, currentLocation, onNavigate])

  useEffect(() => {
    const fetchData = async () => {
      if (quest && !initialSessionId) {
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      try {
        if (initialSessionId) {
          const res = await fetch(`/api/quest-sessions/${initialSessionId}`)
          if (res.ok) {
            const data = await res.json()
            setSession(data)
            setQuest(data.quest)
            setInitialDistance(data.initialDistanceMeters || 0)
          }
        } else if (initialQuestId) {
          const res = await fetch(`/api/quests/${initialQuestId}`)
          if (res.ok) {
            const data = await res.json()
            setQuest(data)
          }
        }
      } catch (error) {
        console.error("[QuestDetails] Fetch error:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [initialQuestId, initialSessionId])

  // КАРТА И МАРКЕРЫ
  useEffect(() => {
    if (!map || !quest) return

    const questLoc: [number, number] = [quest.longitude, quest.latitude]
    map.flyTo({ center: currentLocation || questLoc, zoom: 14 })

    const finishEl = document.createElement("div")
    finishEl.innerHTML = `<div style="width:32px;height:32px;background:#8b5cf6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`
    questMarkerRef.current = new maplibregl.Marker({ element: finishEl }).setLngLat(questLoc).addTo(map)

    return () => {
      questMarkerRef.current?.remove()
      questMarkerRef.current = null
    }
  }, [map, quest])

  useEffect(() => {
    if (!quest || !currentLocation) return
    const dist = haversineDistance(currentLocation[1], currentLocation[0], quest.latitude, quest.longitude)
    const roundedDist = Math.round(dist)
    setDistanceToTarget(roundedDist)
    if (initialDistance === 0 && dist > 0) setInitialDistance(Math.round(dist))

    // АВТОЗАВЕРШЕНИЕ ПРИ ПРИБЛИЖЕНИИ
    if (isAssigned && roundedDist <= 40 && !isCompleting) {
      handleCompleteQuest()
    }
  }, [quest, currentLocation, isAssigned, isCompleting, handleCompleteQuest, initialDistance])

  useEffect(() => {
    const startedAt = session?.startedAt
    if (!isAssigned || !startedAt) return
    const startedAtMs = new Date(startedAt).getTime()
    const interval = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAtMs) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [isAssigned, session?.startedAt])

  const startQuest = async () => {
    if (!quest) return
    setIsStarting(true)
    try {
      const res = await createQuestSession(quest.questId, quest)
      setSession(res)
      setInitialDistance(res.initialDistanceMeters || 0)
    } catch (error: any) {
      alert(error.message)
    } finally {
      setIsStarting(false)
    }
  }

  if (isLoading || !exploration) return <div className="min-h-screen flex items-center justify-center p-8"><div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>
  if (!quest) return <div className="min-h-screen flex items-center justify-center p-8 font-bold text-muted-foreground">Квест не найден</div>

  const progressPercent = initialDistance > 0 ? Math.min(100, Math.max(0, ((initialDistance - distanceToTarget) / initialDistance) * 100)) : 0
  const currentXp = isAssigned ? (distanceToTarget <= 40 ? quest.xpReward : Math.round((progressPercent / 100) * quest.xpReward)) : quest.xpReward

  return (
    <div className="min-h-screen bg-transparent flex flex-col pb-24 pointer-events-none">
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white/90 backdrop-blur-md dark:bg-gray-900/90 border-b shadow-sm shrink-0 pointer-events-auto">
        <Button variant="ghost" size="icon" onClick={() => onNavigate(isAssigned ? "quest-map" : "quest-list")}><ArrowLeft className="w-5 h-5" /></Button>
        <span className="font-bold truncate px-2">{isAssigned ? "Выполнение" : "Детали"}</span>
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 dark:bg-purple-900/30 rounded-full border border-purple-100 dark:border-purple-800">
             <Timer className="w-3.5 h-3.5 text-purple-600" />
             <span className="font-mono text-sm font-bold text-purple-600">{isAssigned ? `${Math.floor(elapsedSeconds / 60).toString().padStart(2, "0")}:${(elapsedSeconds % 60).toString().padStart(2, "0")}` : "--:--"}</span>
           </div>
           <Button variant="ghost" size="icon" onClick={() => setIsFavorite(!isFavorite)}><Heart className={cn("w-5 h-5", isFavorite && "fill-red-500 text-red-500")} /></Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pointer-events-none">
        {/* Распорка для видимости карты */}
        <div className="h-64 pointer-events-none flex-shrink-0" />
        
        {/* Контент под картой, который скроллится и перехватывает клики */}
        <div className="bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-t border-white/20 shadow-[0_-8px_30px_rgba(0,0,0,0.1)] pointer-events-auto min-h-[calc(100vh-16rem)] p-4 rounded-t-[2.5rem] space-y-4">
          
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-6 opacity-50" />

          {isAssigned && (
            <Card className="p-4 bg-white dark:bg-gray-900 border-0 shadow-lg mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2"><Footprints className="w-4 h-4 text-blue-600" /><span className="text-sm font-bold">{distanceToTarget < 1000 ? `${distanceToTarget}м` : `${(distanceToTarget / 1000).toFixed(1)}км`} до цели</span></div>
                <span className="text-xs font-bold text-muted-foreground uppercase">{Math.round(progressPercent)}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
              </div>
            </Card>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between"><h1 className="text-2xl font-black tracking-tight">{quest?.title}</h1>{quest?.intensity && intensityMap[quest.intensity] && <span className={cn("px-3 py-1 text-[10px] rounded-full font-black uppercase tracking-widest", intensityMap[quest.intensity].color)}>{intensityMap[quest.intensity].label}</span>}</div>
            <div className="grid grid-cols-2 gap-3">
               <Card className="p-3 flex items-center gap-3 bg-white dark:bg-gray-900 border-0 shadow-sm"><div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center"><MapPin className="w-5 h-5 text-blue-600" /></div><div><p className="text-[10px] text-muted-foreground uppercase font-black">Пройдено</p><p className="font-black text-sm">{isAssigned ? (distanceTraveled < 1000 ? `${Math.round(distanceTraveled)}м` : `${(distanceTraveled / 1000).toFixed(1)}км`) : "--"}</p></div></Card>
               <Card className="p-3 flex items-center gap-3 bg-white dark:bg-gray-900 border-0 shadow-sm"><div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center"><Gem className="w-5 h-5 text-purple-600" /></div><div><p className="text-[10px] text-muted-foreground uppercase font-black">Награда</p><p className="font-black text-sm text-purple-600">+{currentXp} XP</p></div></Card>
            </div>
            <Card className="p-5 bg-white dark:bg-gray-900 border-0 shadow-sm space-y-3"><h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2"><Trophy className="w-4 h-4 text-orange-500" />Легенда маршрута</h3><p className="text-sm text-muted-foreground leading-relaxed font-medium">{quest?.routeDescription}</p></Card>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl border-t z-50 pointer-events-auto">
        <Button className={cn("w-full h-14 text-lg font-black uppercase tracking-widest shadow-xl", isAssigned ? "bg-gradient-to-r from-red-600 to-orange-600" : "bg-gradient-to-r from-purple-600 to-blue-600")} onClick={isAssigned ? () => setShowWarning(true) : startQuest} disabled={isStarting || isCompleting}>{isStarting ? "Запуск..." : isCompleting ? "Завершение..." : isAssigned ? "Завершить квест" : "Начать приключение"}</Button>
      </div>

      {showWarning && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 text-center pointer-events-auto">
          <Card className="w-full max-w-sm p-6 space-y-6">
            <div className="space-y-4">
              <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto"><AlertTriangle className="w-10 h-10 text-amber-600" /></div>
              <h3 className="text-2xl font-black uppercase">Завершить досрочно?</h3>
              <p className="text-sm text-muted-foreground">Вы прошли {Math.round(progressPercent)}% пути. Награда: +{currentXp} XP. Квест исчезнет из списка!</p>
            </div>
            <div className="flex gap-3"><Button variant="outline" className="flex-1 h-12 font-black uppercase" onClick={() => setShowWarning(false)}>Отмена</Button><Button className="flex-1 h-12 font-black uppercase bg-amber-600" onClick={handleCompleteQuest}>Завершить</Button></div>
          </Card>
        </div>
      )}
    </div>
  )
}
