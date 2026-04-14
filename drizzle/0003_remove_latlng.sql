-- Миграция: удаляем старые колонки latitude/longitude
-- Теперь используем только PostGIS location

-- Проверяем, что колонки существуют перед удалением
DO $$
BEGIN
  -- Удаляем latitude если существует
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quests' AND column_name = 'latitude') THEN
    ALTER TABLE "quests" DROP COLUMN "latitude";
  END IF;
  
  -- Удаляем longitude если существует
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quests' AND column_name = 'longitude') THEN
    ALTER TABLE "quests" DROP COLUMN "longitude";
  END IF;
  
  -- Делаем location NOT NULL (если ещё не сделано)
  ALTER TABLE "quests" ALTER COLUMN "location" SET NOT NULL;
END $$;
