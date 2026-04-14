import type { QuestWithLocation, StartQuestResult } from "@/lib/game-types"

type StartQuestFallback = {
  questId: string
  title?: string
  durationMinutes?: number
  intensity?: QuestWithLocation["intensity"]
  questType?: QuestWithLocation["questType"]
  xpReward?: number
  isActive?: boolean
  routeDescription?: string
  latitude?: number
  longitude?: number
  isAssigned?: boolean
  routeColorIndex?: number | null
  distanceMeters?: number
  distance?: number
}

function normalizeQuest(
  quest: Partial<QuestWithLocation> | null | undefined,
  fallbackQuest?: StartQuestFallback
): QuestWithLocation {
  const source = quest ?? fallbackQuest

  if (!source?.questId) {
    throw new Error("Quest data is missing in start quest response")
  }

  return {
    questId: source.questId,
    title: source.title ?? fallbackQuest?.title ?? "",
    durationMinutes: source.durationMinutes ?? fallbackQuest?.durationMinutes ?? 0,
    intensity: source.intensity ?? fallbackQuest?.intensity ?? "light",
    questType: source.questType ?? fallbackQuest?.questType ?? "walk",
    xpReward: source.xpReward ?? fallbackQuest?.xpReward ?? 0,
    isActive: source.isActive ?? fallbackQuest?.isActive ?? true,
    routeDescription: source.routeDescription ?? fallbackQuest?.routeDescription ?? "",
    latitude: source.latitude ?? fallbackQuest?.latitude ?? 0,
    longitude: source.longitude ?? fallbackQuest?.longitude ?? 0,
    isAssigned: source.isAssigned ?? fallbackQuest?.isAssigned ?? true,
    routeColorIndex: source.routeColorIndex ?? fallbackQuest?.routeColorIndex ?? null,
    distanceMeters: source.distanceMeters ?? fallbackQuest?.distanceMeters,
    distance: source.distance ?? fallbackQuest?.distance,
  }
}

export async function startQuest(
  questId: string,
  fallbackQuest?: StartQuestFallback
): Promise<StartQuestResult> {
  // Получаем начальное расстояние из localStorage
  const currentLocation = localStorage.getItem("user_location")
  let initialDistanceMeters: number | undefined

  if (currentLocation) {
    try {
      const [lng, lat] = JSON.parse(currentLocation)
      // Вычисляем примерное расстояние используя Haversine формулу
      // (тот же простой расчет будет на клиенте в activeQuestScreen)
      const R = 6371000
      const questLng = fallbackQuest?.longitude ?? 0
      const questLat = fallbackQuest?.latitude ?? 0
      const dLat = ((questLat - lat) * Math.PI) / 180
      const dLng = ((questLng - lng) * Math.PI) / 180
      const a = Math.sin(dLat / 2) ** 2 + 
                Math.cos((lat * Math.PI) / 180) * Math.cos((questLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
      initialDistanceMeters = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
    } catch (e) {
      console.warn("Failed to calculate initial distance:", e)
    }
  }

  const res = await fetch("/api/quests/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questId, initialDistanceMeters }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || "Не удалось начать квест")
  }

  if (!data?.sessionId) {
    throw new Error("Quest session was not created")
  }

  return {
    sessionId: data.sessionId,
    startedAt: data.startedAt ?? new Date().toISOString(),
    alreadyStarted: data.alreadyStarted,
    routeColorIndex: data.routeColorIndex ?? fallbackQuest?.routeColorIndex ?? null,
    quest: normalizeQuest(data.quest, fallbackQuest),
    initialDistanceMeters: data.initialDistanceMeters,
  }
}
