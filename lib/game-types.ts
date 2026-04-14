export type QuestDto = {
  questId: string
  title: string
  durationMinutes: number
  intensity: "light" | "moderate" | "hard"
  questType: "walk" | "run" | "mixed"
  xpReward: number
  isActive: boolean
}

export type QuestWithLocation = QuestDto & {
  routeDescription: string
  latitude: number
  longitude: number
  isAssigned?: boolean
  routeColorIndex?: number | null
  distanceMeters?: number
  distance?: number
}

export type StartQuestResult = {
  sessionId: string
  startedAt: string
  alreadyStarted?: boolean
  routeColorIndex?: number | null
  quest: QuestWithLocation
  initialDistanceMeters?: number
}

export function intensityLabelRu(i: QuestDto["intensity"]): string {
  switch (i) {
    case "light":
      return "Лёгкий"
    case "moderate":
      return "Средний"
    case "hard":
      return "Сложный"
    default:
      return i
  }
}

export function xpToNextLevel(level: number): number {
  return level * 500
}
