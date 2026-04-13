export type QuestDto = {
  questId: string
  title: string
  durationMinutes: number
  intensity: "light" | "moderate" | "hard"
  questType: "walk" | "run" | "mixed"
  xpReward: number
  isActive: boolean
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
