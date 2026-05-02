Данный документ содержит описание структуры данных, системной архитектуры и логики движения данных (Data Flow) для реализации механики гексагонального исследования города.

---

## 1. ER-диаграмма (Схема базы данных)
Описывает структуру таблиц, связи и ключевые атрибуты сущностей. Основной упор сделан на эффективное хранение геоданных через индексы H3.

```mermaid
erDiagram
    USERS {
        string user_id PK
        string username
        string email
        string password_hash
        string character_class
        datetime created_at
        datetime last_active_at
    }

    PROGRESS {
        string user_id PK
        string user_id FK
        int xp
        int level
        int completed_quests
        datetime updated_at
    }

    QUESTS {
        string quest_id PK
        string title
        int duration_minutes
        string intensity
        string quest_type
        int xp_reward
        bool is_active
        string route_description
        string location
    }

    QUEST_SESSIONS {
        string session_id PK
        string user_id FK
        string quest_id FK
        datetime started_at
        datetime completed_at
        string status
        int initial_distance_meters
    }

    USER_QUEST_ASSIGNMENTS {
        string user_id PK
        string user_id FK
        string quest_id PK
        string quest_id FK
        datetime assigned_at
        int route_color_index
    }

    ACHIEVEMENTS {
        string achievement_id PK
        string user_id FK
        string title
        datetime awarded_at
    }

    TERRITORIES {
        string territory_id PK
        string name
        string city
        string boundary_geojson
        int total_cells
        string h3_cache
    }

    USER_EXPLORATION_CELLS {
        string user_id PK
        string user_id FK
        string h3_index PK
        datetime discovered_at
        string territory_id FK
    }

    USER_TERRITORY_STATS {
        string user_id PK
        string user_id FK
        string territory_id PK
        string territory_id FK
        int opened_cells_count
        datetime last_visit_at
    }

    USERS ||--|| PROGRESS : "has progress"
    USERS ||--o{ QUEST_SESSIONS : "has sessions"
    QUESTS ||--o{ QUEST_SESSIONS : "has sessions"
    USERS ||--o{ USER_QUEST_ASSIGNMENTS : "has assignments"
    QUESTS ||--o{ USER_QUEST_ASSIGNMENTS : "assigned in"
    USERS ||--o{ ACHIEVEMENTS : "has achievements"
    TERRITORIES ||--o{ USER_EXPLORATION_CELLS : "contains cells"
    USERS ||--o{ USER_EXPLORATION_CELLS : "discovered"
    USERS ||--o{ USER_TERRITORY_STATS : "has stats"
    TERRITORIES ||--o{ USER_TERRITORY_STATS : "has stats"

```

---

## 2. Диаграмма архитектуры
Общая схема взаимодействия компонентов системы: от мобильного приложения до внешних сервисов и точек интеграции.

```mermaid
flowchart TD
    subgraph Frontend [Слой интерфейса]
        App[Mobile App / Web App]
    end

    subgraph Auth [Авторизация]
        Keycloak[Auth Service / Firebase Auth]
    end

    subgraph Backend [Серверная логика]
        API[Core API Gateway]
        Engine[RPG & Geo Engine]
        Notify[Notification Service]
    end

    subgraph Data [Хранилище данных]
        DB[(PostgreSQL + PostGIS)]
        Cache[(Redis Cache)]
    end

    subgraph External [Внешние сервисы]
        Maps[Mapbox / Google Maps API]
        S3[S3 File Storage]
        Mail[SendGrid / SMTP]
    end

    subgraph Integration [Точки интеграции - Будущие ПР]
        CRM{{"ПР-05: CRM (HubSpot/Bitrix)"}}
        BPMS{{"ПР-06: BPMS (n8n/Camunda)"}}
        Bot{{"ПР-07: Telegram Bot"}}
    end

    %% Связи
    App -- "HTTP/REST (JWT)" --> API
    App -- "SDK" --> Keycloak
    Keycloak -- "Verify Token" --> API
    
    API --> Engine
    Engine -- "SQL/Spatial Query" --> DB
    Engine -- "GeoData" --> Maps
    
    API --> Notify
    Notify -- "SMTP/API" --> Mail
    API -- "S3 API" --> S3
    
    %% Будущие интеграции
    API -. "Webhooks/API" .-> CRM
    Engine -. "gRPC / REST" .-> BPMS
    Bot -. "HTTP/API" .-> API

    %% Стилизация
    classDef frontend fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef backend fill:#fff3e0,stroke:#e65100,stroke-width:2px;
    classDef data fill:#f1f8e9,stroke:#33691e,stroke-width:2px;
    classDef external fill:#f3e5f5,stroke:#4a148c,stroke-width:2px;
    classDef integration fill:#eceff1,stroke:#455a64,stroke-width:2px,stroke-dasharray: 5 5;

    class App frontend;
    class API,Engine,Notify backend;
    class DB,Cache data;
    class Maps,S3,Mail,Keycloak external;
    class CRM,BPMS,Bot integration;
```

---

## 3. Data Flow Diagram Сценарий 1: Синхронизация локации и "закрашивание" карты
Логика превращения GPS-координат в игровой прогресс в реальном времени.

```mermaid
sequenceDiagram
    autonumber
    participant U as User (Player)
    participant F as Frontend (App)
    participant B as Backend (API + Geo Engine)
    participant D as Database (PostgreSQL)

    U->>F: Перемещается в пространстве
    F->>B: POST /v1/me/sync-location {lat, lng, timestamp}
    Note over B: Конвертация lat/lng -> H3 Index
    B->>D: SELECT h3_index FROM USER_EXPLORATION_CELL WHERE user_id AND index
    D-->>B: Not Found (Ячейка новая)
    
    par Обновление прогресса
        B->>D: INSERT INTO USER_EXPLORATION_CELL (h3_index, territory_id)
        B->>D: UPDATE USER_TERRITORY_STATS (opened_cells_count + 1)
        B->>D: UPDATE PROGRESS (xp + 5)
    end
    
    B-->>F: HTTP 201 {new_cell: true, xp_gained: 5, total_xp: 1250}
    F-->>U: Визуальное "проявление" гексагона на карте
```

---

## 4. Data Flow Diagram Сценарий 2: Выполнение квеста и получение наград
Процесс прохождения игровых активностей с обратной связью.

```mermaid
sequenceDiagram
    autonumber
    participant U as User (Player)
    participant F as Frontend (App)
    participant B as Backend (RPG Engine)
    participant D as Database (PostgreSQL)
    participant N as Notification Service

    U->>F: Нажимает "Старт в 1 клик"
    F->>B: POST /v1/quests/{id}/start
    B->>D: CREATE QUEST_SESSION {status: 'active', start_time: now}
    B-->>F: HTTP 201 {session_id: "QS-123", checkpoints: [...]}
    
    loop Процесс выполнения
        F->>B: PATCH /v1/sessions/QS-123 {current_pos: lat/lng}
        B->>B: Проверка близости к чекпоинту
        B-->>F: {reached_checkpoint: true, feedback: "vibrate"}
        F-->>U: Вибрация + Визуальный чекпоинт
    end

    U->>F: Нажимает "Завершить"
    F->>B: POST /v1/sessions/QS-123/finish
    B->>D: UPDATE QUEST_SESSION {status: 'completed', end_time: now}
    B->>N: Trigger Push "Поздравляем с наградой!"
    B-->>F: {reward: "Badge_01", xp: 500}
    F-->>U: Анимация уровня и показ бейджа
```
