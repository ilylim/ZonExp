"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { startQuest as createQuestSession } from "@/lib/start-quest"
import type { Screen } from "@/app/page"
import { ArrowLeft, Heart, Clock, MapPin, Gem, Trophy, Navigation, Home, Map as MapIcon, User } from "lucide-react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

interface QuestDetailsScreenProps {
  onNavigate: (screen: Screen, data?: any) => void
  quest?: any
  userLocation: [number, number] | null
}

const intensityMap = {
  light: { label: "Лёгкий", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  moderate: { label: "Средний", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  hard: { label: "Сложный", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
}

export function QuestDetailsScreen({ onNavigate, quest, userLocation }: QuestDetailsScreenProps) {
  const [isFavorite, setIsFavorite] = useState(false)
  const [isStarting, setIsStarting] = useState(false)

  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)

  const questLocation: [number, number] = quest
    ? [quest.longitude, quest.latitude]
    : [92.87, 56.01]

  useEffect(() => {
    if (!mapContainer.current || !quest || map.current) return

    const center = userLocation || questLocation

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png", "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png"],
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
      if (!map.current) return
      const from = userLocation || questLocation
      const to = questLocation

      map.current.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [from, to] },
        },
      })

      map.current.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-color": "#8b5cf6", "line-width": 4, "line-opacity": 0.8, "line-dasharray": [3, 2] },
      })

      if (userLocation) {
        const startEl = document.createElement("div")
        startEl.innerHTML = `<div style="width:28px;height:28px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.05 11.5 7.35 11.76a1 1 0 0 0 1.3 0C13 21.5 20 15.4 20 10a8 8 0 0 0-8-8Z"/></svg></div>`
        new maplibregl.Marker({ element: startEl }).setLngLat(from).addTo(map.current)
      }

      const finishEl = document.createElement("div")
      finishEl.innerHTML = `<div style="width:32px;height:32px;background:#8b5cf6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`
      new maplibregl.Marker({ element: finishEl }).setLngLat(to).addTo(map.current)

      const bounds = new maplibregl.LngLatBounds().extend(from).extend(to)
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 15 })
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [quest, userLocation, questLocation])

  const startQuest = async () => {
    if (!quest) return
    setIsStarting(true)
    try {
      const startedQuest = await createQuestSession(quest.questId, quest)
      onNavigate("active-quest", startedQuest)
    } catch (error: any) {
      alert(error.message || "Ошибка соединения")
    } finally {
      setIsStarting(false)
    }
  }

  if (!quest) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-950 border-b">
          <Button variant="ghost" size="icon" onClick={() => onNavigate("quest-list")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-semibold">Квест не найден</span>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Выберите квест из списка</p>
        </div>
      </div>
    )
  }

  const distance = userLocation
    ? Math.round(
        6371000 *
          2 *
          Math.atan2(
            Math.sqrt(
              Math.sin(((quest.latitude - userLocation[1]) * Math.PI) / 360) ** 2 +
                Math.cos((userLocation[1] * Math.PI) / 180) *
                  Math.cos((quest.latitude * Math.PI) / 180) *
                  Math.sin(((quest.longitude - userLocation[0]) * Math.PI) / 360) ** 2
            ),
            Math.sqrt(
              1 -
                Math.sin(((quest.latitude - userLocation[1]) * Math.PI) / 360) ** 2 +
                  Math.cos((userLocation[1] * Math.PI) / 180) *
                    Math.cos((quest.latitude * Math.PI) / 180) *
                    Math.sin(((quest.longitude - userLocation[0]) * Math.PI) / 360) ** 2
            )
          )
      )
    : null

  const formatDistance = (d: number | null) => {
    if (!d && d !== 0) return "—"
    if (d < 1000) return `${d} м`
    return `${(d / 1000).toFixed(1)} км`
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border-b shadow-sm shrink-0">
        <Button variant="ghost" size="icon" onClick={() => onNavigate("quest-list")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <span className="font-semibold">Детали квеста</span>
        <Button variant="ghost" size="icon" onClick={() => setIsFavorite(!isFavorite)}>
          <Heart className={`w-5 h-5 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="p-4 bg-white dark:bg-gray-900 border-b">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-xl font-bold flex-1">{quest.title}</h1>
            <span className={cn("px-3 py-1 text-xs rounded-full font-medium", intensityMap[quest.intensity].color)}>
              {intensityMap[quest.intensity].label}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
              <Clock className="w-5 h-5 text-purple-600 mb-1" />
              <span className="text-xs font-medium">{quest.durationMinutes} мин</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <MapPin className="w-5 h-5 text-blue-600 mb-1" />
              <span className="text-xs font-medium">{formatDistance(distance)}</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
              <Gem className="w-5 h-5 text-yellow-600 mb-1" />
              <span className="text-xs font-medium">+{quest.xpReward} XP</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
              <Trophy className="w-5 h-5 text-orange-600 mb-1" />
              <span className="text-xs font-medium">Бейдж</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-gray-900 border-b">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-purple-600" />
            Маршрут
          </h2>
          <div ref={mapContainer} className="w-full h-64 rounded-xl overflow-hidden border-2 border-purple-200 dark:border-purple-800" />
        </div>

        <div className="p-4 bg-white dark:bg-gray-900 border-b">
          <h2 className="text-lg font-semibold mb-3">О квесте</h2>
          <p className="text-sm text-muted-foreground">{quest.routeDescription}</p>
        </div>

        <div className="p-4 bg-white dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-3">Твоя награда</h2>
          <Card className="p-4 border-0 shadow-md">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center">
                  <Gem className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <span className="font-semibold text-purple-600">+{quest.xpReward} XP</span>
                  <p className="text-xs text-muted-foreground">Опыт за прохождение</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/40 rounded-lg flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <span className="font-semibold text-orange-600">Бейдж: Первопроходец</span>
                  <p className="text-xs text-muted-foreground">Уникальная награда</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>

      <div className="p-4 bg-white dark:bg-gray-900 border-t space-y-2 shrink-0">
        <Button
          className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          onClick={startQuest}
          disabled={isStarting}
        >
          {isStarting ? "Запускаем..." : "Начать квест"}
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => onNavigate("quest-list")}>
          Отмена
        </Button>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 flex items-center justify-around p-3 border-t bg-white dark:bg-gray-950 z-40">
        <button
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onNavigate("quest-map")}
        >
          <Home className="w-6 h-6" />
          <span className="text-xs">Главная</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 text-purple-600"
          onClick={() => onNavigate("quest-list")}
        >
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
