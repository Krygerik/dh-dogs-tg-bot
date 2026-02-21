# Архитектура проекта

## Обзор

Проект состоит из Telegram-бота и HTTP API для управления игровыми сессиями
Dread Hunger на Windows Server. Бот запускает процессы игрового сервера,
управляет их жизненным циклом, инжектирует моды через Frida и предоставляет
телеметрию.

## Структура исходного кода

```
src/
├── index.ts              # Точка входа: dotenv, wiring, graceful shutdown
├── types.ts              # Все типы: MapConfig, ServerConfig, GameSession и др.
├── paths.ts              # Константы путей к reference/ и patches/ файлам
├── config.ts             # buildConfig(), resolveBinaryPath(), resolveFridaPath()
│                         # Константы: API_PORT, API_TOKEN, TEST_PARAMS_*
├── server-manager.ts     # Класс ServerManager — ядро управления сессиями
├── api-server.ts         # HTTP API сервер (порт 8787)
├── bot-handlers.ts       # Telegram-хендлеры команд и inline callback
├── reference/            # Загрузчики справочных данных из JSON
│   ├── maps.ts           # loadMapReferences()
│   ├── mods.ts           # listStableMods(), listModCollections(), resolveModScripts()
│   ├── modifiers.ts      # loadCustomModifiers(), parseCustomModifiers()
│   ├── roles.ts          # loadRoleReferences()
│   └── items.ts          # loadItemReferences()
└── utils/                # Утилиты без побочных эффектов
    ├── parse.ts          # parsePortSpec(), buildMapArg(), formatDuration() и др.
    ├── telegram.ts       # escapeMarkdown(), sendMarkdownSafe(), buildInlineKeyboard()
    ├── http.ts           # sendJson(), requestLocalJson(), readJsonBody(), isAuthorized()
    ├── process.ts        # killProcessTree(), wrapCommand(), waitForSignature()
    └── logging.ts        # attachRealtimeLogging(), readLogTail(), cleanupOldLogs()
```

## Граф зависимостей

```
index.ts
├── config.ts
│   ├── types.ts
│   ├── utils/parse.ts
│   └── reference/maps.ts → paths.ts, types.ts
├── server-manager.ts
│   ├── types.ts
│   ├── config.ts (resolveFridaPath)
│   ├── utils/parse.ts
│   ├── utils/process.ts
│   ├── utils/logging.ts
│   └── reference/maps.ts
├── api-server.ts
│   ├── types.ts
│   ├── config.ts (константы)
│   ├── server-manager.ts (тип)
│   ├── utils/http.ts
│   └── reference/* (все загрузчики)
└── bot-handlers.ts
    ├── types.ts
    ├── server-manager.ts (тип)
    ├── utils/telegram.ts
    ├── utils/parse.ts (formatDuration)
    └── utils/logging.ts (readLogTail)
```

Циклических зависимостей нет. Файл `paths.ts` выделен отдельно, чтобы
`reference/maps.ts` и `config.ts` не зависели друг от друга циклически.

## Ключевые компоненты

### ServerManager (`server-manager.ts`)

Управляет жизненным циклом игровых сессий:
- Выделение портов из пула (round-robin)
- Запуск процесса игрового сервера через `child_process.spawn()`
- Ожидание инициализации по сигнатуре в stdout/stderr
- Инжекция Frida-скриптов (если настроено)
- Остановка через `taskkill /PID /T /F` (Windows)

### HTTP API (`api-server.ts`)

Сервер на `http.createServer` (без фреймворков), порт 8787:
- CORS для всех origin
- Опциональная авторизация через `X-API-Token`
- Эндпоинты: `/status`, `/session`, `/maps`, `/mods`, `/modifiers`,
  `/reference/roles`, `/reference/items`, `/telemetry`, `/run`, `/testing`, `/stop`

### Telegram Bot (`bot-handlers.ts`)

Команды: `/start`, `/help`, `/run`, `/stop`, `/status`, `/log`, `/testing`, `/dog`.
Интерактивный выбор через inline keyboard + callback query.

### Система модов

Три слоя:
1. **Stable mods** (`patches/stable/{name}/{name}.js`) — отдельные моды
2. **Коллекции** (`patches/alllready_configs/*.txt`) — предсобранные наборы
3. **Custom modifiers** (`reference/custom_modifiers.json`) — параметры баланса

### Справочные данные (`reference/`)

JSON-каталоги с поддержкой локализации через `*.ru.json` файлы.
Загружаются из файловой системы при каждом запросе (без кеширования).

## Внешние компоненты

### Frida Loader (`frida/`)

Python-скрипт (`loader.py`), обёрнутый в `python_loader.bat`.
Инжектирует JavaScript-моды в процесс игрового сервера.
Опционально поднимает telemetry bridge.

### Справочные данные (`reference/`)

```
reference/
├── maps.json                     # Список карт (serverValue)
├── maps.ru.json                  # Локализация названий карт
├── map-collections.json          # Привязка карт к коллекциям модов
├── custom_modifiers.json         # Модификаторы баланса (диапазоны)
├── custom_modifiers.ru.json      # Локализация модификаторов
├── custom_modifiers.presets.json # Пресеты модификаторов
├── roles.json                    # Игровые роли
└── items.json                    # Игровые предметы
```

### Патчи (`patches/`)

```
patches/
├── stable/              # Продакшен-моды (14 директорий)
│   └── {name}/
│       ├── {name}.js    # Frida-скрипт для инжекции
│       └── {name}.txt   # Описание мода
├── alllready_configs/   # Предсобранные коллекции модов
├── technical/           # Техническая инфраструктура
│   └── telemetry/       # Телеметрия
└── others/              # Прочие патчи
```
