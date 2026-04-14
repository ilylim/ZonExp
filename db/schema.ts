import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  customType,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

// PostGIS geometry type (custom type for Drizzle)
const geometry = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geometry"
  },
})

export const questIntensityEnum = pgEnum("quest_intensity", [
  "light",
  "moderate",
  "hard",
])

export const questTypeEnum = pgEnum("quest_type", ["walk", "run", "mixed"])

export const questSessionStatusEnum = pgEnum("quest_session_status", [
  "active",
  "completed",
  "abandoned",
])

export const users = pgTable("users", {
  userId: text("user_id").primaryKey(),
  username: text("username").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  characterClass: text("character_class").notNull().default("warrior"), // warrior, mage, ranger, ninja, shapeshifter
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at", { mode: "date" }).notNull().defaultNow(),
})

export const progress = pgTable("progress", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.userId, { onDelete: "cascade" }),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  completedQuests: integer("completed_quests").notNull().default(0),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})

export const quests = pgTable("quests", {
  questId: text("quest_id").primaryKey(),
  title: text("title").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  intensity: questIntensityEnum("intensity").notNull(),
  questType: questTypeEnum("quest_type").notNull(),
  xpReward: integer("xp_reward").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  routeDescription: text("route_description").notNull().default(""),
  // PostGIS geometry (Point, 4326) — единственный источник координат
  location: geometry("location").notNull(),
})

export const questSessions = pgTable("quest_sessions", {
  sessionId: text("session_id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  questId: text("quest_id")
    .notNull()
    .references(() => quests.questId, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { mode: "date" }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { mode: "date" }),
  status: questSessionStatusEnum("status").notNull().default("active"),
  // Начальное расстояние при старте квеста (в метрах) - для расчета XP
  initialDistanceMeters: integer("initial_distance_meters").notNull().default(0),
})

// Active quest assignments — tracks which quests a user has accepted (max 4)
export const userQuestAssignments = pgTable(
  "user_quest_assignments",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    questId: text("quest_id")
      .notNull()
      .references(() => quests.questId, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { mode: "date" }).notNull().defaultNow(),
    // Color index for route display (0-3)
    routeColorIndex: integer("route_color_index").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.questId] })]
)

export const achievements = pgTable("achievements", {
  achievementId: text("achievement_id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  title: text("title").notNull(),
  awardedAt: timestamp("awarded_at", { mode: "date" }).notNull().defaultNow(),
})

export const territories = pgTable("territories", {
  territoryId: text("territory_id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  /** GeoJSON Polygon/MultiPolygon as JSON — mirrored to PostGIS geometry via migration */
  boundaryGeojson: jsonb("boundary_geojson").notNull(),
  totalCells: integer("total_cells").notNull().default(0),
})

export const userExplorationCells = pgTable(
  "user_exploration_cells",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    h3Index: text("h3_index").notNull(),
    discoveredAt: timestamp("discovered_at", { mode: "date" }).notNull().defaultNow(),
    territoryId: text("territory_id")
      .notNull()
      .references(() => territories.territoryId, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.h3Index] })]
)

export const userTerritoryStats = pgTable(
  "user_territory_stats",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    territoryId: text("territory_id")
      .notNull()
      .references(() => territories.territoryId, { onDelete: "cascade" }),
    openedCellsCount: integer("opened_cells_count").notNull().default(0),
    lastVisitAt: timestamp("last_visit_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.territoryId] })]
)

export const usersRelations = relations(users, ({ one, many }) => ({
  progress: one(progress, {
    fields: [users.userId],
    references: [progress.userId],
  }),
  questSessions: many(questSessions),
  achievements: many(achievements),
  explorationCells: many(userExplorationCells),
  territoryStats: many(userTerritoryStats),
  questAssignments: many(userQuestAssignments),
}))

export const progressRelations = relations(progress, ({ one }) => ({
  user: one(users, {
    fields: [progress.userId],
    references: [users.userId],
  }),
}))

export const questsRelations = relations(quests, ({ many }) => ({
  sessions: many(questSessions),
}))

export const questSessionsRelations = relations(questSessions, ({ one }) => ({
  user: one(users, {
    fields: [questSessions.userId],
    references: [users.userId],
  }),
  quest: one(quests, {
    fields: [questSessions.questId],
    references: [quests.questId],
  }),
}))

export const userQuestAssignmentsRelations = relations(userQuestAssignments, ({ one }) => ({
  user: one(users, {
    fields: [userQuestAssignments.userId],
    references: [users.userId],
  }),
  quest: one(quests, {
    fields: [userQuestAssignments.questId],
    references: [quests.questId],
  }),
}))
