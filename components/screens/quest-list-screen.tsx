"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Screen } from "@/app/page"
import { startQuest as createQuestSession } from "@/lib/start-quest"
import { Clock, MapPin, ChevronRight, Home, Map as MapIcon, User, Target, Flag, RefreshCw, Scroll } from "lucide-react"

interface QuestListScreenProps {
  onNavigate: (screen: Screen, data?: any) => void
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

const intensityMap = {
  light: { label: "ЛЁГКИЙ", color: "bg-emerald-600", border: "border-emerald-800", text: "text-emerald-700" },
  moderate: { label: "СРЕДНИЙ", color: "bg-amber-500", border: "border-amber-700", text: "text-amber-600" },
  hard: { label: "СЛОЖНЫЙ", color: "bg-red-600", border: "border-red-800", text: "text-red-600" },
}

import { useMap } from "@/components/map/map-provider"

export function QuestListScreen({ onNavigate }: QuestListScreenProps) {
  const { userLocation } = useMap()
  const [quests, setQuests] = useState<Quest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchQuests = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const url = userLocation
        ? `/api/quests?lng=${userLocation[0]}&lat=${userLocation[1]}`
        : "/api/quests"

      const res = await fetch(url)
      const data = await res.json()

      if (res.ok && Array.isArray(data.quests)) {
        setQuests(data.quests)
      } else {
        setError(data.error || "Не удалось загрузить свитки квестов")
      }
    } catch (err) {
      console.error("[QuestList] Error:", err)
      setError("Серверы перегружены монстрами")
    } finally {
      setIsLoading(false)
    }
  }, [userLocation])

  useEffect(() => {
    fetchQuests()
  }, [])

  const handleStartActiveQuest = (quest: Quest) => {
    onNavigate("quest-details", quest)
  }

  const activeQuests = quests.filter((q) => q.isAssigned)
  const availableQuests = quests.filter((q) => !q.isAssigned)

  const formatDistance = (quest: Quest) => {
    const dist = quest.distanceMeters || quest.distance
    if (!dist && dist !== 0) return "—"
    if (dist < 1000) return `${Math.round(dist)} м`
    return `${(dist / 1000).toFixed(1)} км`
  }

  return (
    <div className="min-h-screen flex flex-col relative z-10 pb-20">
      <header className="sticky top-0 z-20 flex items-center justify-between p-4 bg-background/90 backdrop-blur-sm border-b-4 border-border">
        <button 
          onClick={() => onNavigate("quest-map")}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <img src="/emblem-pixel.png" alt="Emblem" className="w-10 h-10 object-contain" />
          <h1 className="text-lg sm:text-xl font-press-start text-pixel-shadow text-primary">КВЕСТЫ</h1>
        </button>
        <Button variant="outline" size="icon" onClick={fetchQuests} disabled={isLoading} className="border-pixel-sm">
          <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-4 border-pixel-sm bg-destructive text-destructive-foreground text-center"
            >
              <p className="font-bold">{error}</p>
              <Button variant="outline" size="sm" className="mt-3 border-pixel-sm font-bold" onClick={fetchQuests}>
                ПОВТОРИТЬ ЗАКЛИНАНИЕ
              </Button>
            </motion.div>
          )}

          {isLoading && !error && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="w-16 h-16 border-pixel-sm bg-primary/20 flex items-center justify-center mb-4">
                <Scroll className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <p className="font-press-start text-primary text-sm text-pixel-shadow animate-pulse">ЧТЕНИЕ СВИТКОВ...</p>
            </motion.div>
          )}

          {!isLoading && !error && quests.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center py-20 bg-muted border-pixel-sm"
            >
              <Flag className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="font-press-start text-muted-foreground leading-relaxed">На доске объявлений пусто.</p>
            </motion.div>
          )}

          {!isLoading && !error && quests.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {activeQuests.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 bg-secondary border-pixel-sm p-2">
                    <Target className="w-6 h-6 text-primary" />
                    <h2 className="text-sm font-press-start text-secondary-foreground text-pixel-shadow flex-1">
                      АКТИВНЫЕ
                    </h2>
                    <span className="font-bold text-primary bg-background border-pixel-sm px-2">
                      {activeQuests.length}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {activeQuests.map((quest) => (
                      <QuestCard
                        key={quest.questId}
                        quest={quest}
                        formatDistance={formatDistance}
                        onDetails={() => handleStartActiveQuest(quest)}
                        isActive={true}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-3 bg-card border-pixel-sm p-2 mt-6">
                  <Scroll className="w-6 h-6 text-accent" />
                  <h2 className="text-sm font-press-start text-foreground text-pixel-shadow flex-1">
                    ДОСТУПНЫЕ
                  </h2>
                  <span className="font-bold text-accent bg-background border-pixel-sm px-2">
                    {availableQuests.length}
                  </span>
                </div>
                
                {availableQuests.length === 0 && (
                  <div className="p-4 bg-muted border-pixel-sm text-center">
                    <p className="font-bold">Все доступные квесты приняты!</p>
                  </div>
                )}
                
                <div className="space-y-4">
                  {availableQuests.map((quest) => (
                    <QuestCard
                      key={quest.questId}
                      quest={quest}
                      formatDistance={formatDistance}
                      onDetails={() => onNavigate("quest-details", quest)}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 flex items-center justify-around p-2 border-t-4 border-border bg-card z-40">
        <button
          className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-primary transition-colors group"
          onClick={() => onNavigate("quest-map")}
        >
          <div className="group-hover:-translate-y-1 transition-transform">
            <Home className="w-7 h-7" />
          </div>
          <span className="text-xs font-bold uppercase">Карта</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 text-primary">
          <div className="-translate-y-1">
            <MapIcon className="w-7 h-7 drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]" />
          </div>
          <span className="text-xs font-bold uppercase underline decoration-2 underline-offset-4">Квесты</span>
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

interface QuestCardProps {
  quest: Quest
  formatDistance: (q: Quest) => string
  onDetails: () => void
  isActive?: boolean
}

function QuestCard({ quest, formatDistance, onDetails, isActive }: QuestCardProps) {
  const intensity = intensityMap[quest.intensity]
  
  return (
    <Card className={`p-0 overflow-hidden border-pixel ${isActive ? 'bg-secondary' : 'bg-card'}`}>
      <div className={`p-2 border-b-4 border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 ${isActive ? 'bg-primary' : 'bg-muted'}`}>
        <div className="flex items-start sm:items-center gap-2 flex-1 pr-2 w-full">
          {isActive && <Target className="w-5 h-5 text-primary-foreground animate-pulse shrink-0 mt-0.5 sm:mt-0" />}
          <h3 className={`font-bold text-base sm:text-lg leading-tight break-words hyphens-auto ${isActive ? 'text-primary-foreground' : 'text-foreground'}`}>
            {quest.title}
          </h3>
        </div>
        <div className="bg-background border-pixel-sm px-2 py-1 transform rotate-3 shrink-0 self-end sm:self-auto">
          <span className="text-sm font-press-start text-primary text-pixel-shadow">+{quest.xpReward} XP</span>
        </div>
      </div>
      
      <div className="p-3 sm:p-4 bg-[url('/pixel-pattern.png')] bg-repeat bg-[length:16px_16px]">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
          <div className="bg-background border-pixel-sm p-2 flex flex-col sm:flex-row items-center sm:items-center justify-center sm:justify-start gap-1 sm:gap-2 text-center sm:text-left">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-accent shrink-0" />
            <span className="font-bold text-xs sm:text-base leading-none">{quest.durationMinutes} мин</span>
          </div>
          
          <div className="bg-background border-pixel-sm p-2 flex flex-col sm:flex-row items-center sm:items-center justify-center sm:justify-start gap-1 sm:gap-2 text-center sm:text-left">
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
            <span className="font-bold text-xs sm:text-base leading-none">{formatDistance(quest)}</span>
          </div>
          
          <div className={`col-span-2 bg-background border-pixel-sm p-2 flex items-center gap-2 border-l-4 sm:border-l-8 ${intensity.border}`}>
            <span className={`w-2 h-2 sm:w-3 sm:h-3 ${intensity.color} border-pixel-sm shrink-0`} />
            <span className={`font-bold text-[10px] sm:text-sm ${intensity.text}`}>{intensity.label} СЛОЖНОСТЬ</span>
          </div>
        </div>
        
        <Button 
          className={`w-full h-14 border-pixel-sm font-press-start text-sm hover:scale-[1.02] transition-transform ${
            isActive ? 'bg-accent text-accent-foreground hover:bg-accent/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`} 
          onClick={onDetails}
        >
          {isActive ? 'ПРОДОЛЖИТЬ' : 'ПОДРОБНЕЕ'} <ChevronRight className="w-6 h-6 ml-1" />
        </Button>
      </div>
    </Card>
  )
}
