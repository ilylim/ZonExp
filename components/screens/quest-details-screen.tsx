"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
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
  Scroll
} from "lucide-react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

interface QuestDetailsScreenProps {
  onNavigate: (screen: Screen, data?: any) => void
  quest?: any
}

const intensityMap: Record<string, { label: string; color: string; border: string; text: string }> = {
  light: { label: "ЛЁГКИЙ", color: "bg-emerald-600", border: "border-emerald-800", text: "text-emerald-700" },
  moderate: { label: "СРЕДНИЙ", color: "bg-amber-500", border: "border-amber-700", text: "text-amber-600" },
  hard: { label: "СЛОЖНЫЙ", color: "bg-red-600", border: "border-red-800", text: "text-red-600" },
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
  const [distanceTraveled, setDistanceTraveled] = useState(0)
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
    finishEl.innerHTML = `<div style="width:36px;height:36px;background:#eab308;border:4px solid #1a1a1a;border-radius:0;box-shadow:4px 4px 0 0 rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>`
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

  if (isLoading || !exploration) return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-16 h-16 border-pixel-sm bg-primary/20 flex items-center justify-center animate-pulse">
        <Scroll className="w-8 h-8 text-primary" />
      </div>
    </div>
  )
  
  if (!quest) return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="border-pixel bg-destructive text-destructive-foreground p-4 font-press-start">Свиток не найден</div>
    </div>
  )

  const progressPercent = initialDistance > 0 ? Math.min(100, Math.max(0, ((initialDistance - distanceToTarget) / initialDistance) * 100)) : 0
  const currentXp = isAssigned ? (distanceToTarget <= 40 ? quest.xpReward : Math.round((progressPercent / 100) * quest.xpReward)) : quest.xpReward
  const intensity = intensityMap[quest.intensity]

  return (
    <div className="min-h-screen bg-transparent flex flex-col pb-24 pointer-events-none">
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background/90 backdrop-blur-sm border-b-4 border-border shrink-0 pointer-events-auto">
        <Button variant="outline" size="icon" className="border-pixel-sm" onClick={() => onNavigate(isAssigned ? "quest-map" : "quest-list")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <span className="font-press-start text-pixel-shadow text-primary px-2">{isAssigned ? "В ПУТИ" : "СВИТОК КВЕСТА"}</span>
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-1.5 px-3 py-1 bg-background border-pixel-sm">
             <Timer className="w-4 h-4 text-accent" />
             <span className="font-press-start text-sm text-accent">{isAssigned ? `${Math.floor(elapsedSeconds / 60).toString().padStart(2, "0")}:${(elapsedSeconds % 60).toString().padStart(2, "0")}` : "--:--"}</span>
           </div>
           <Button variant="outline" size="icon" className="border-pixel-sm" onClick={() => setIsFavorite(!isFavorite)}>
             <Heart className={cn("w-5 h-5", isFavorite && "fill-red-500 text-red-500")} />
           </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pointer-events-none">
        {/* Распорка для видимости карты - должна соответствовать высоте GlobalMap (280px) */}
        <div className="h-[280px] pointer-events-none flex-shrink-0" />
        
        {/* Контент под картой */}
        <div className="bg-card border-t-4 border-border shadow-[0_-10px_20px_rgba(0,0,0,0.5)] pointer-events-auto min-h-[calc(100vh-280px)] p-4 space-y-4 relative z-10">
          
          <div className="w-16 h-2 bg-border/20 rounded-full mx-auto mb-2" />

          {isAssigned && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Footprints className="w-5 h-5 text-accent" />
                  <span className="text-xs font-press-start uppercase text-muted-foreground">{distanceToTarget < 1000 ? `${distanceToTarget}м` : `${(distanceToTarget / 1000).toFixed(1)}км`} до цели</span>
                </div>
                <span className="text-sm font-press-start text-primary">{Math.round(progressPercent)}%</span>
              </div>
              <div className="w-full h-6 bg-background border-4 border-border relative overflow-hidden shadow-[2px_2px_0_0_rgba(0,0,0,0.1)]">
                <div 
                  className="h-full bg-primary transition-all duration-500 ease-out" 
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/20"></div>
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/10"></div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <h1 className="text-lg sm:text-xl font-press-start text-foreground leading-relaxed flex-1 break-words hyphens-auto">{quest?.title}</h1>
              {quest?.intensity && intensity && (
                <div className={`shrink-0 border-l-8 ${intensity.border} bg-background border-pixel-sm p-2 flex items-center gap-2 self-start sm:self-auto`}>
                  <span className={`w-3 h-3 ${intensity.color} border-pixel-sm`} />
                  <span className={`font-bold text-xs ${intensity.text}`}>{intensity.label}</span>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
               <Card className="p-3 bg-[url('/pixel-pattern.png')] bg-repeat bg-[length:16px_16px] border-pixel flex items-center gap-3">
                 <div className="w-10 h-10 bg-background border-pixel-sm flex items-center justify-center">
                   <MapPin className="w-5 h-5 text-accent" />
                 </div>
                 <div>
                   <p className="text-[10px] text-muted-foreground font-press-start leading-none mb-1">ПРОЙДЕНО</p>
                   <p className="font-bold text-lg leading-none">{isAssigned ? (distanceTraveled < 1000 ? `${Math.round(distanceTraveled)}м` : `${(distanceTraveled / 1000).toFixed(1)}км`) : "--"}</p>
                 </div>
               </Card>
               <Card className="p-3 bg-[url('/pixel-pattern.png')] bg-repeat bg-[length:16px_16px] border-pixel flex items-center gap-3">
                 <div className="w-10 h-10 bg-background border-pixel-sm flex items-center justify-center">
                   <Gem className="w-5 h-5 text-primary" />
                 </div>
                 <div>
                   <p className="text-[10px] text-muted-foreground font-press-start leading-none mb-1">НАГРАДА</p>
                   <p className="font-bold text-base sm:text-lg text-primary leading-none">+{currentXp} XP</p>
                 </div>
               </Card>
            </div>
            
            <Card className="p-4 bg-muted border-pixel">
              <h3 className="font-press-start text-sm uppercase flex items-center gap-2 mb-4 text-primary text-pixel-shadow">
                <Trophy className="w-5 h-5 text-accent" /> Легенда квеста
              </h3>
              <div className="bg-background border-pixel-sm p-4">
                <p className="text-lg font-vt323 leading-relaxed">{quest?.routeDescription}</p>
              </div>
            </Card>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t-4 border-border z-50 pointer-events-auto shadow-[0_-5px_0_rgba(0,0,0,0.5)]">
        <Button 
          className={`w-full h-16 text-lg font-press-start text-pixel-shadow transition-transform hover:scale-[1.02] active:scale-95 ${
            isAssigned ? "bg-accent text-accent-foreground hover:bg-accent/90 border-pixel-sm" : "bg-primary text-primary-foreground hover:bg-primary/90 border-pixel-sm"
          }`} 
          onClick={isAssigned ? () => setShowWarning(true) : startQuest} 
          disabled={isStarting || isCompleting}
        >
          {isStarting ? "ПОДГОТОВКА..." : isCompleting ? "ЗАВЕРШЕНИЕ..." : isAssigned ? "СДАТЬ КВЕСТ" : "НАЧАТЬ ПРИКЛЮЧЕНИЕ"}
        </Button>
      </div>

      <AnimatePresence>
        {showWarning && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 text-center pointer-events-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm"
            >
              <Card className="p-1 border-pixel shadow-2xl bg-card">
                <div className="bg-destructive p-4 border-b-4 border-border flex items-center justify-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-destructive-foreground" />
                  <h3 className="text-lg font-press-start text-destructive-foreground text-pixel-shadow leading-relaxed">ОТСТУПИТЬ?</h3>
                </div>
                <div className="p-6 bg-secondary space-y-6">
                  <p className="text-lg font-vt323 leading-relaxed bg-background border-pixel-sm p-4">
                    Вы прошли {Math.round(progressPercent)}% пути. Награда составит: <span className="text-primary font-bold">+{currentXp} XP</span>. Квест будет считаться завершенным!
                  </p>
                  <div className="flex gap-4">
                    <Button variant="outline" className="flex-1 h-14 font-press-start text-xs border-pixel-sm" onClick={() => setShowWarning(false)}>
                      ВЕРНУТЬСЯ
                    </Button>
                    <Button className="flex-1 h-14 font-press-start text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 border-pixel-sm" onClick={handleCompleteQuest}>
                      СДАТЬСЯ
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
