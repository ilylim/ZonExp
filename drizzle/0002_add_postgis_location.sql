-- Миграция: добавляем PostGIS-колонку location в таблицу quests
-- для эффективных spatial-запросов (расстояние, ближайший поиск)

-- 1. Добавляем колонку geometry(Point, 4326)
ALTER TABLE "quests" ADD COLUMN IF NOT EXISTS "location" geometry(Point, 4326);

-- 2. Заполняем location из существующих latitude/longitude
UPDATE "quests" 
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE location IS NULL;

-- 3. Создаём GiST-индекс для быстрых spatial-запросов
CREATE INDEX IF NOT EXISTS "quests_location_gix" ON "quests" USING gist ("location");

-- 4. Добавляем колонку location в таблицу progress (для трекинга)
-- (необязательно, но пригодится для будущего функционала)
-- ALTER TABLE "progress" ADD COLUMN IF NOT EXISTS "last_location" geometry(Point, 4326);
