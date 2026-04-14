"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Screen } from "@/app/page"
import { startQuest as createQuestSession } from "@/lib/start-quest"
import { Clock, MapPin, ChevronRight, Home, Map as MapIcon, User, Target, Flag, RefreshCw } from "lucide-react"

interface QuestListScreenProps {
  onNavigate: (screen: Screen, data?: any) => void
  userLocation: [number, number] | null
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

export function QuestListScreen({ onNavigate, userLocation }: QuestListScreenProps) {
  const [quests, setQuests] = useState<Quest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchQuests = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      console.log("[QuestList] Fetching quests from API...")

      const url = userLocation
        ? `/api/quests?lng=${userLocation[0]}&lat=${userLocation[1]}`
        : "/api/quests"

      const res = await fetch(url)
      const data = await res.json()

      if (res.ok && Array.isArray(data.quests)) {
        console.log(`[QuestList] Received ${data.quests.length} quests`)
        setQuests(data.quests)
      } else {
        setError(data.error || "Не удалось загрузить квесты")
      }
    } catch (err) {
      console.error("[QuestList] Error:", err)
      setError("Ошибка соединения")
    } finally {
      setIsLoading(false)
    }
  }, [userLocation])

  useEffect(() => {
    fetchQuests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStartActiveQuest = async (quest: Quest) => {
    try {
      const startedQuest = await createQuestSession(quest.questId, quest)
      onNavigate("active-quest", startedQuest)
    } catch (error: any) {
      alert(error.message || "Не удалось начать квест")
    }
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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-950 border-b shrink-0">
        <h1 className="text-xl font-bold">Квесты</h1>
        <Button variant="ghost" size="icon" onClick={fetchQuests} disabled={isLoading}>
          <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {error && (
          <div className="p-4 text-center text-red-500">
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchQuests}>
              Попробовать снова
            </Button>
          </div>
        )}

        {isLoading && !error && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && !error && quests.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Flag className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Квестов пока нет</p>
          </div>
        )}

        {!isLoading && !error && quests.length > 0 && (
          <>
            {activeQuests.length > 0 && (
              <div className="p-4">
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  Активные квесты
                  <span className="text-sm text-muted-foreground font-normal">({activeQuests.length})</span>
                </h2>
                <div className="space-y-3">
                  {activeQuests.map((quest) => (
                    <QuestCard
                      key={quest.questId}
                      quest={quest}
                      formatDistance={formatDistance}
                      onDetails={() => handleStartActiveQuest(quest)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="p-4">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Flag className="w-5 h-5 text-blue-600" />
                Доступные квесты
                <span className="text-sm text-muted-foreground font-normal">({availableQuests.length})</span>
              </h2>
              {availableQuests.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Все квесты приняты!</p>
              )}
              <div className="space-y-3">
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
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 flex items-center justify-around p-3 border-t bg-white dark:bg-gray-950 z-40">
        <button
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onNavigate("quest-map")}
        >
          <Home className="w-6 h-6" />
          <span className="text-xs">Главная</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-purple-600">
          <MapIcon className="w-6 h-6" />
          <span className="text-xs font-medium">Квесты</span>
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

interface QuestCardProps {
  quest: Quest
  formatDistance: (q: Quest) => string
  onDetails: () => void
}

function QuestCard({ quest, formatDistance, onDetails }: QuestCardProps) {
  return (
    <Card className="p-4 border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-base">{quest.title}</h3>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {quest.durationMinutes} мин
            </span>
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${intensityMap[quest.intensity].color}`} />
              {intensityMap[quest.intensity].label}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {formatDistance(quest)}
            </span>
          </div>
        </div>
        <div className="text-right ml-3">
          <span className="text-sm font-semibold text-purple-600">+{quest.xpReward} XP</span>
        </div>
      </div>
      <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onDetails}>
        Подробнее <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </Card>
  )
}
