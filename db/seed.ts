import "dotenv/config"
import { sql } from "drizzle-orm"
import { getDb } from "./index"
import { quests, territories } from "./schema"

// Красноярск центр - polygon (центр города)
const krasnoyarskCenterPolygon = {
  type: "Polygon" as const,
  coordinates: [
    [
      [92.80, 56.00],
      [92.95, 56.00],
      [92.95, 56.04],
      [92.80, 56.04],
      [92.80, 56.00],
    ],
  ],
}

// Квесты по достопримечательностям Красноярска с точными GPS-координатами
const krasnoyarskQuests = [
  {
    questId: "quest_stolby_hike",
    title: "Тропа к Столбам",
    durationMinutes: 45,
    intensity: "moderate" as const,
    questType: "walk" as const,
    xpReward: 450,
    isActive: true,
    latitude: 55.9520,
    longitude: 92.8950,
    routeDescription: "Поднимитесь по тропе к знаменитым Красноярским Столбам через хвойный лес",
  },
  {
    questId: "quest_yenisei_embankment",
    title: "Набережная Енисея",
    durationMinutes: 20,
    intensity: "light" as const,
    questType: "walk" as const,
    xpReward: 200,
    isActive: true,
    latitude: 56.0065,
    longitude: 92.8730,
    routeDescription: "Прогулка вдоль набережной Енисея с видом на Коммунальный мост и правый берег",
  },
  {
    questId: "quest_karaulnaya_hill",
    title: "Караульная гора",
    durationMinutes: 30,
    intensity: "moderate" as const,
    questType: "walk" as const,
    xpReward: 300,
    isActive: true,
    latitude: 56.0185,
    longitude: 92.8620,
    routeDescription: "Подъём на Караульную гору к исторической парашютной башне с панорамой города",
  },
  {
    questId: "quest_chapel_paraskeva",
    title: "Часовня Параскевы Пятницы",
    durationMinutes: 20,
    intensity: "light" as const,
    questType: "walk" as const,
    xpReward: 200,
    isActive: true,
    latitude: 56.0195,
    longitude: 92.8635,
    routeDescription: "Прогулка к древней часовне Параскевы Пятницы — символу Красноярска на 10-рублёвой купюре",
  },
  {
    questId: "quest_communal_bridge",
    title: "Прогулка по Коммунальному мосту",
    durationMinutes: 25,
    intensity: "light" as const,
    questType: "walk" as const,
    xpReward: 250,
    isActive: true,
    latitude: 56.0105,
    longitude: 92.8755,
    routeDescription: "Прогулка по знаменитому Коммунальному мосту с видами на оба берега Енисея",
  },
  {
    questId: "quest_parachute_tower",
    title: "Парашютная башня",
    durationMinutes: 15,
    intensity: "light" as const,
    questType: "walk" as const,
    xpReward: 150,
    isActive: true,
    latitude: 56.0190,
    longitude: 92.8625,
    routeDescription: "Короткая прогулка к исторической парашютной вышке 1930-х годов",
  },
  {
    questId: "quest_central_park",
    title: "Центральный парк",
    durationMinutes: 20,
    intensity: "light" as const,
    questType: "walk" as const,
    xpReward: 200,
    isActive: true,
    latitude: 56.0050,
    longitude: 92.8720,
    routeDescription: "Прогулка по аллеям Центрального парка с видом на Енисей",
  },
  {
    questId: "quest_peace_square",
    title: "Площадь Мира",
    durationMinutes: 15,
    intensity: "light" as const,
    questType: "walk" as const,
    xpReward: 150,
    isActive: true,
    latitude: 56.0085,
    longitude: 92.8745,
    routeDescription: "Прогулка по главной площади города и осмотр архитектурного ансамбля",
  },
  {
    questId: "quest_tatyshev_island",
    title: "Остров Татышев",
    durationMinutes: 50,
    intensity: "moderate" as const,
    questType: "walk" as const,
    xpReward: 500,
    isActive: true,
    latitude: 56.0135,
    longitude: 92.8885,
    routeDescription: "Большая прогулка по острову Татышев через Большой мост и по парковым дорожкам",
  },
  {
    questId: "quest_art_museum",
    title: "Художественный музей",
    durationMinutes: 25,
    intensity: "light" as const,
    questType: "walk" as const,
    xpReward: 250,
    isActive: true,
    latitude: 56.0060,
    longitude: 92.8685,
    routeDescription: "Прогулка к Художественному музею им. Сурикова по проспекту Мира",
  },
  {
    questId: "quest_local_history_museum",
    title: "Краеведческий музей",
    durationMinutes: 25,
    intensity: "light" as const,
    questType: "walk" as const,
    xpReward: 250,
    isActive: true,
    latitude: 56.0045,
    longitude: 92.8790,
    routeDescription: "Путь к Краеведческому музею через набережную с видом на Стрелку",
  },
  {
    questId: "quest_revolution_square",
    title: "Площадь Революции",
    durationMinutes: 15,
    intensity: "light" as const,
    questType: "walk" as const,
    xpReward: 150,
    isActive: true,
    latitude: 56.0020,
    longitude: 92.8640,
    routeDescription: "Прогулка по площади Революции к памятнику Ленину и Театру оперы и балета",
  },
  {
    questId: "quest_bobrovaya_gora",
    title: "Бобровый лог",
    durationMinutes: 60,
    intensity: "hard" as const,
    questType: "mixed" as const,
    xpReward: 600,
    isActive: true,
    latitude: 55.9585,
    longitude: 92.9100,
    routeDescription: "Подъём к горнолыжному курорту 'Бобровый лог' через лесную тропу и канатную дорогу",
  },
  {
    questId: "quest_run_embankment",
    title: "Пробежка вдоль Енисея",
    durationMinutes: 35,
    intensity: "moderate" as const,
    questType: "run" as const,
    xpReward: 400,
    isActive: true,
    latitude: 56.0070,
    longitude: 92.8650,
    routeDescription: "Беговой маршрут вдоль набережной Енисея от Коммунального моста до Стрелки",
  },
  {
    questId: "quest_big_krasnoyarsk_marathon",
    title: "Марафон большого Красноярска",
    durationMinutes: 75,
    intensity: "hard" as const,
    questType: "run" as const,
    xpReward: 800,
    isActive: true,
    latitude: 56.0000,
    longitude: 92.8600,
    routeDescription: "Длинный беговой маршрут через центр города, набережную и Коммунальный мост",
  },
]

// Функция для автоматической повторной попытки при обрыве соединения
async function executeWithRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      const isConnReset = error?.cause?.code === "ECONNRESET" || error?.code === "ECONNRESET"
      if (isConnReset) {
        console.log(`[Seed] Connection lost, retrying (${i + 1}/${retries}) in 2s...`)
        await new Promise(res => setTimeout(res, 2000))
        continue
      }
      throw error
    }
  }
  throw new Error("Seed failed after multiple retries")
}

async function main() {
  const db = getDb()

  console.log("[Seed] Inserting quests...")
  await executeWithRetry(async () => {
    return db
      .insert(quests)
      .values(krasnoyarskQuests)
      .onConflictDoNothing()
  })
  console.log(`[Seed] ✓ ${krasnoyarskQuests.length} quests inserted/updated`)

  console.log("[Seed] Inserting territory...")
  await executeWithRetry(async () => {
    return db
      .insert(territories)
      .values({
        territoryId: "terr_krasnoyarsk_center",
        name: "Центр Красноярска",
        city: "Красноярск",
        boundaryGeojson: krasnoyarskCenterPolygon,
        totalCells: 200,
      })
      .onConflictDoNothing()
  })
  console.log("[Seed] ✓ Territory inserted")

  console.log("[Seed] Updating PostGIS geometry...")
  const gj = JSON.stringify(krasnoyarskCenterPolygon)
  await executeWithRetry(async () => {
    return db.execute(
      sql`UPDATE territories SET boundary_polygon = ST_SetSRID(ST_GeomFromGeoJSON(${gj}), 4326) WHERE territory_id = ${"terr_krasnoyarsk_center"}`
    )
  })
  console.log("[Seed] ✓ PostGIS geometry updated")

  console.log("[Seed] ✓ Seed completed successfully!")
}

main().catch((e) => {
  console.error("[Seed] Fatal error:", e)
  process.exit(1)
})
