# ZonExp - Платформа для геолокационных квестов

ZonExp — это интерактивная веб-платформа для создания и прохождения квестов на основе геолокации. Пользователи могут исследовать территории, выполнять задачи и получать награды.

## 🌟 Особенности

- 🗺️ **Интерактивная карта** — Карта в реальном времени с поддержкой геолокации (MapLibre GL)
- 🎮 **Система квестов** — Создание, отслеживание и завершение квестов
- 👤 **Аутентификация** — Регистрация и вход через NextAuth.js
- 📊 **Профиль пользователя** — Отслеживание прогресса и достижений
- 🎁 **Система наград** — Получение вознаграждений за завершённые квесты
- 🌍 **Геолокационные данные** — Использование H3 для геопространственного анализа
- 🎨 **Современный UI** — Компоненты Radix UI с Tailwind CSS
- 🌙 **Тёмная тема** — Поддержка светлой и тёмной темы

## 📋 Требования

- **Node.js** >= 18.0
- **pnpm** (рекомендуется) или npm
- **PostgreSQL** >= 12 с расширением PostGIS
- **Environment переменные** (см. раздел Configuration)

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
# Используя pnpm (рекомендуется)
pnpm install

# Или используя npm
npm install
```

### 2. Конфигурация переменных окружения

Создайте файл `.env.local` в корневой папке проекта:

```env
# Базы данных
DATABASE_URL=postgresql://user:password@localhost:5432/zonexp

# NextAuth
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# Опционально: другие конфигурации
```

### 3. Инициализация базы данных

```bash
# Генерировать миграции
pnpm db:generate

# Применить миграции
pnpm db:migrate

# Заполнить БД начальными данными (опционально)
pnpm db:seed
```

### 4. Запуск в режиме разработки

```bash
pnpm dev
```

Приложение будет доступно по адресу: `http://localhost:3000`

## 📁 Структура проекта

```
project/
├── app/                          # Next.js App Router
│   ├── api/                      # API маршруты
│   │   ├── auth/                 # Аутентификация (NextAuth)
│   │   ├── map/                  # Данные карты
│   │   ├── quests/               # Управление квестами
│   │   ├── quest-sessions/       # Сессии прохождения квестов
│   │   ├── quest-complete/       # Завершение квестов
│   │   └── me/                   # Данные профиля пользователя
│   ├── layout.tsx                # Главный layout
│   ├── page.tsx                  # Главная страница
│   └── globals.css               # Глобальные стили
├── components/                   # React компоненты
│   ├── screens/                  # Полноэкранные компоненты страниц
│   ├── ui/                       # Переиспользуемые UI компоненты (Radix UI)
│   ├── providers.tsx             # Провайдеры приложения
│   └── theme-provider.tsx        # Провайдер темы
├── db/                           # Работа с БД
│   ├── schema.ts                 # Drizzle ORM схема
│   ├── index.ts                  # Конфигурация БД
│   └── seed.ts                   # Заполнение начальных данных
├── hooks/                        # Custom React hooks
├── lib/                          # Утилиты и вспомогательные функции
├── types/                        # TypeScript типы
├── public/                       # Статические файлы
├── styles/                       # CSS стили
├── drizzle/                      # SQL миграции
└── vercel.json                   # Конфиг для Vercel

```

## 🔌 API Endpoints

### Аутентификация
- `POST /api/auth/register` — Регистрация нового пользователя
- `POST /api/auth/signin` — Вход в систему
- `POST /api/auth/signout` — Выход из системы

### Квесты
- `GET /api/quests` — Получить список всех квестов
- `GET /api/quests/[id]` — Получить подробность квеста
- `POST /api/quest-sessions` — Начать сессию квеста
- `POST /api/quest-complete` — Завершить квест

### MapBox
- `GET /api/map/exploration` — Получить данные для исследования на карте

### Профиль
- `GET /api/me` — Получить информацию текущего пользователя
- `GET /api/me/progress` — Получить прогресс пользователя

## 📝 Доступные команды

```bash
# Разработка
pnpm dev              # Запустить dev сервер
pnpm build            # Собрать проект для production
pnpm start            # Запустить production сервер
pnpm lint             # Проверить код на ошибки

# База данных
pnpm db:generate      # Генерировать миграции
pnpm db:migrate       # Применить миграции
pnpm db:studio        # Открыть Drizzle Studio
pnpm db:seed          # Заполнить БД начальными данными
```

## 🛠️ Развёртывание на Vercel

### Способ 1: Через веб-интерфейс

1. Перейдите на [vercel.com](https://vercel.com)
2. Нажмите **"New Project"** и выберите ваш Git репозиторий
3. Добавьте переменные окружения:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
4. Нажмите **"Deploy"**

### Способ 2: Через Vercel CLI

```bash
# Установить Vercel CLI
npm i -g vercel

# Развернуть на production
vercel --prod
```

## 📚 Технологический стек

| Технология | Назначение |
|-----------|-----------|
| **Next.js 16** | React фреймворк с SSR |
| **TypeScript** | Типизированный JavaScript |
| **NextAuth.js** | Аутентификация и авторизация |
| **Drizzle ORM** | Работа с БД (PostgreSQL) |
| **PostGIS** | Геопространственные данные |
| **MapLibre GL** | Интерактивная карта |
| **H3** | Геопространственный индекс |
| **Radix UI** | UI компоненты |
| **Tailwind CSS** | Утилиты для стилизации |
| **React Hook Form** | Управление формами |
| **Zod** | Валидация данных |
| **Recharts** | Графики и диаграммы |
| **Sonner** | Уведомления (тосты) |
| **Vercel Analytics** | Аналитика |

## 🔐 Безопасность

- Пароли хешируются с помощью **bcryptjs**
- Используется **NextAuth.js** для безопасной аутентификации
- HTTPS поддержка на production
- Переменные окружения защищены

## 📧 Переменные окружения

```env
# Обязательные
DATABASE_URL=postgresql://user:password@localhost:5432/zonexp
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# Опционные
NEXT_PUBLIC_MAP_TOKEN=your-token
```

## 🐛 Отладка

### Drizzle Studio (visualizer БД)

```bash
pnpm db:studio
```

Откроется веб-интерфейс для просмотра и редактирования БД.

### Логирование

Включите debug режим добавив в `.env.local`:

```env
DEBUG=*
```

## 📖 Документация

- [Next.js документация](https://nextjs.org/docs)
- [NextAuth.js документация](https://next-auth.js.org)
- [Drizzle ORM документация](https://orm.drizzle.team)
- [MapLibre GL документация](https://maplibre.org)
- [H3 документация](https://h3geo.org)

## 👥 Контрибьютинг

Если вы хотите помочь в разработке:

1. Сделайте fork проекта
2. Создайте ветку для вашей фишки (`git checkout -b feature/amazing-feature`)
3. Коммитьте изменения (`git commit -m 'Add amazing feature'`)
4. Запушьте ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

Проект распространяется под лицензией MIT. Для деталей смотрите файл LICENSE.

## 📞 Поддержка

Если у вас есть вопросы или проблемы:
- Откройте Issue на GitHub
- Проверьте документацию выше
- Посмотрите логи приложения

---

**Последнее обновление:** 2026-04-14