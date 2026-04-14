import "dotenv/config"
import { sql } from "drizzle-orm"
import { getDb } from "./index"
import { quests, territories } from "./schema"

// Красноярск центр - polygon
const krasnoyarskCenterPolygon = {
  type: "Polygon" as const,
  coordinates: [
    [
      [92.79, 55.95],
      [92.96, 55.95],
      [92.96, 56.04],
      [92.79, 56.04],
      [92.79, 55.95],
    ],
  ],
}

// Квесты с исправленными GPS-координатами
const krasnoyarskQuests = [
  { questId: "quest_stolby_hike", title: "Тропа к Столбам", durationMinutes: 45, intensity: "moderate" as const, questType: "walk" as const, xpReward: 450, isActive: true, lat: 55.9520, lng: 92.8950, routeDescription: "Поднимитесь по тропе к знаменитым Красноярским Столбам через хвойный лес" },
  { questId: "quest_yenisei_embankment", title: "Набережная Енисея", durationMinutes: 20, intensity: "light" as const, questType: "walk" as const, xpReward: 200, isActive: true, lat: 56.0068, lng: 92.8667, routeDescription: "Прогулка вдоль набережной Енисея с видом на Коммунальный мост и правый берег" },
  { questId: "quest_karaulnaya_hill", title: "Караульная гора", durationMinutes: 30, intensity: "moderate" as const, questType: "walk" as const, xpReward: 300, isActive: true, lat: 56.0236, lng: 92.8597, routeDescription: "Подъём на Караульную гору к исторической парашютной башне с панорамой города" },
  { questId: "quest_chapel_paraskeva", title: "Часовня Параскевы Пятницы", durationMinutes: 20, intensity: "light" as const, questType: "walk" as const, xpReward: 200, isActive: true, lat: 56.0236, lng: 92.8597, routeDescription: "Прогулка к древней часовне Параскевы Пятницы — символу Красноярска на 10-рублёвой купюре" },
  { questId: "quest_communal_bridge", title: "Прогулка по Коммунальному мосту", durationMinutes: 25, intensity: "light" as const, questType: "walk" as const, xpReward: 250, isActive: true, lat: 56.0032, lng: 92.8744, routeDescription: "Прогулка по знаменитому Коммунальному мосту с видами на оба берега Енисея" },
  { questId: "quest_parachute_tower", title: "Парашютная башня", durationMinutes: 15, intensity: "light" as const, questType: "walk" as const, xpReward: 150, isActive: true, lat: 56.0236, lng: 92.8597, routeDescription: "Короткая прогулка к исторической парашютной вышке 1930-х годов" },
  { questId: "quest_central_park", title: "Центральный парк", durationMinutes: 20, intensity: "light" as const, questType: "walk" as const, xpReward: 200, isActive: true, lat: 56.0075, lng: 92.8528, routeDescription: "Прогулка по аллеям Центрального парка с видом на Енисей" },
  { questId: "quest_peace_square", title: "Площадь Мира", durationMinutes: 15, intensity: "light" as const, questType: "walk" as const, xpReward: 150, isActive: true, lat: 56.0110, lng: 92.8950, routeDescription: "Прогулка по главной площади города и осмотр архитектурного ансамбля" },
  { questId: "quest_tatyshev_island", title: "Остров Татышев", durationMinutes: 50, intensity: "moderate" as const, questType: "walk" as const, xpReward: 500, isActive: true, lat: 56.0270, lng: 92.9410, routeDescription: "Большая прогулка по острову Татышев через Большой мост и по парковым дорожкам" },
  { questId: "quest_art_museum", title: "Художественный музей", durationMinutes: 25, intensity: "light" as const, questType: "walk" as const, xpReward: 250, isActive: true, lat: 56.0135, lng: 92.8900, routeDescription: "Прогулка к Художественному музею им. Сурикова по проспекту Мира" },
  { questId: "quest_local_history_museum", title: "Краеведческий музей", durationMinutes: 25, intensity: "light" as const, questType: "walk" as const, xpReward: 250, isActive: true, lat: 56.0074, lng: 92.8728, routeDescription: "Путь к Краеведческому музею через набережную с видом на Стрелку" },
  { questId: "quest_revolution_square", title: "Площадь Революции", durationMinutes: 15, intensity: "light" as const, questType: "walk" as const, xpReward: 150, isActive: true, lat: 56.0103, lng: 92.8525, routeDescription: "Прогулка по площади Революции к памятнику Ленину и Театру оперы и балета" },
  { questId: "quest_bobrovaya_gora", title: "Бобровый лог", durationMinutes: 60, intensity: "hard" as const, questType: "mixed" as const, xpReward: 600, isActive: true, lat: 55.9613, lng: 92.7952, routeDescription: "Подъём к горнолыжному курорту 'Бобровый лог' через лесную тропу и канатную дорогу" },
  { questId: "quest_run_embankment", title: "Пробежка вдоль Енисея", durationMinutes: 35, intensity: "moderate" as const, questType: "run" as const, xpReward: 400, isActive: true, lat: 56.0070, lng: 92.8650, routeDescription: "Беговой маршрут вдоль набережной Енисея от Коммунального моста до Стрелки" },
  { questId: "quest_big_krasnoyarsk_marathon", title: "Марафон большого Красноярска", durationMinutes: 75, intensity: "hard" as const, questType: "run" as const, xpReward: 800, isActive: true, lat: 56.0000, lng: 92.8600, routeDescription: "Длинный беговой маршрут через центр города, набережную и Коммунальный мост" },
]

// Функция для автоматической повторной попытки при обрыве соединения
async function executeWithRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      const code = error?.cause?.code || error?.code
      const msg = (error?.message || "") + " " + (error?.cause?.message || "")
      const isConnError =
        code === "ECONNRESET" ||
        msg.toLowerCase().includes("terminated unexpectedly") ||
        msg.toLowerCase().includes("connection terminated") ||
        msg.toLowerCase().includes("read econnreset")

      if (isConnError) {
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

  // Вставляем квесты с PostGIS location одним запросом на каждый квест
  console.log("[Seed] Inserting quests with PostGIS location...")
  for (const q of krasnoyarskQuests) {
    await executeWithRetry(async () => {
      return db.execute(
        sql`INSERT INTO quests (quest_id, title, duration_minutes, intensity, quest_type, xp_reward, is_active, route_description, location)
            VALUES (${q.questId}, ${q.title}, ${q.durationMinutes}, ${q.intensity}, ${q.questType}, ${q.xpReward}, ${q.isActive}, ${q.routeDescription}, ST_SetSRID(ST_MakePoint(${q.lng}, ${q.lat}), 4326))
            ON CONFLICT (quest_id) DO UPDATE SET
              title = EXCLUDED.title,
              duration_minutes = EXCLUDED.duration_minutes,
              intensity = EXCLUDED.intensity,
              quest_type = EXCLUDED.quest_type,
              xp_reward = EXCLUDED.xp_reward,
              is_active = EXCLUDED.is_active,
              route_description = EXCLUDED.route_description,
              location = EXCLUDED.location`
      )
    })
  }
  console.log(`[Seed] ✓ ${krasnoyarskQuests.length} quests upserted with PostGIS location`)

  // Территория
  console.log("[Seed] Upserting territory...")
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
  console.log("[Seed] ✓ Territory upserted")

  // Обновляем PostGIS geometry территории
  console.log("[Seed] Updating PostGIS geometry for territory...")
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
