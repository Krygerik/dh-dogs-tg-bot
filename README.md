# Dread Hunger Server Bot 🎮

Telegram бот для управления игровым сервером Dread Hunger на Windows Server.

## Возможности

### Команды бота
| Команда | Описание |
|---------|----------|
| `/start` | Приветственное сообщение |
| `/help` | Список всех команд |
| `/run` | Выбор и запуск игровой сессии |
| `/stop` | Остановка выбранной сессии |
| `/status` | Статус активных сессий |
| `/log` | Показать хвост лога по сессии |
| `/testing` | Тестовый запуск (maxplayers=1?thralls=1) |
| `/dog` | Случайный факт о собаках 🐕 |

### Доступные карты (/run)
Список карт берётся из `reference/maps.json`.

---

## Требования

- **Node.js** (v18 или выше) - [Скачать](https://nodejs.org/)
- **Python** (если используете Frida скрипты) - [Скачать](https://python.org/)
- **Telegram Bot Token** - Получить у [@BotFather](https://t.me/BotFather)

---

## Быстрый старт

### 1. Клонировать проект
```bash
git clone <repository-url>
cd dh-dogs-tg-bot
```

### 2. Настроить окружение
```bash
copy env.example .env
notepad .env
```

Заполнить `.env`:
```
BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
PUBLIC_IP=185.17.66.195
BINARY_PATH=C:\Users\Server\WindowsServer\DreadHunger\Binaries\Win64\DreadHungerServer-Win64-Shipping.exe
PORTS=7777-7782
FRIDA_PATH=.\frida\python_loader.bat
API_TOKEN=change_me
```

### 3. Запустить бота
```bash
start-bot.bat
```

---

## Конфигурация

### Переменные окружения (.env)

| Переменная | Описание | Значения |
|------------|----------|----------|
| `BOT_TOKEN` | Токен Telegram бота | Получить у @BotFather |
| `PUBLIC_IP` | Публичный IP для игроков | `185.17.66.195` |
| `BINARY_PATH` | Путь к `DreadHungerServer-Win64-Shipping.exe` | Абсолютный путь |
| `PORTS` | Порты (список/диапазоны) | `7777,8000-8010` |
| `FRIDA_PATH` | Путь к Frida инжектору (опц.) | `.\frida\python_loader.bat` |
| `API_TOKEN` | Токен API | `change_me` |
| `TELEMETRY_ENABLE` | Включить Frida‑телеметрию | `true` |
| `TELEMETRY_BASE_PORT` | Базовый порт для telemetry bridge | `8790` |

---

## Frida скрипты (опционально)

Если нужен Frida‑инжектор, укажите путь в `FRIDA_PATH`. Скрипт должен принимать аргументы:

```
<PID> <MapValue>
```

---

## Внешний API для клиента

Бот поднимает HTTP API на `0.0.0.0:8787` (фиксированный порт).

Эндпоинты:
- `GET /status` — активные сессии
- `GET /maps` — список карт
- `GET /mods` — список доступных модов
- `POST /run` — запуск сессии `{ "mapName": "...", "mods": ["..."] }`
- `POST /testing` — тестовый запуск `{ "mapName": "...", "mode": "solo|duo", "mods": ["..."] }`
- `POST /stop` — остановка сессии `{ "port": 7777 }`

Если задан `API_TOKEN`, нужно отправлять заголовок `X-API-Token`.

## Структура проекта

```
dh-dogs-tg-bot/
├── src/
│   └── index.ts            # Исходный код бота
├── dist/                   # Скомпилированный JS (генерируется)
├── node_modules/           # Зависимости (генерируется)
├── .env                    # Переменные окружения
├── env.example             # Пример .env файла
├── package.json            # Конфигурация проекта
├── tsconfig.json           # Конфигурация TypeScript
└── start-bot.bat           # Запуск бота
```

---

## Хостинг на Windows Server

### Шаг 1: Установить Node.js

1. Скачать Node.js LTS с https://nodejs.org/
2. Установить с настройками по умолчанию
3. Проверить установку:
   ```cmd
   node --version
   npm --version
   ```

### Шаг 2: Развернуть файлы бота

1. Скопировать проект на сервер (например, `C:\Bots\dh-dogs-tg-bot\`)
2. Создать `.env` файл:
   ```cmd
   cd C:\Bots\dh-dogs-tg-bot
   copy env.example .env
   notepad .env
   ```

### Шаг 3: Установить зависимости и собрать

```cmd
cd C:\Bots\dh-dogs-tg-bot
npm install
npm run build
```

### Шаг 4: Запуск через Task Scheduler (рекомендуется)

1. Открыть **Task Scheduler** (`taskschd.msc`)
2. Нажать **Create Task**
3. **General:**
   - Name: `Dread Hunger Server Bot`
   - Check: `Run whether user is logged on or not`
   - Check: `Run with highest privileges`
4. **Triggers:**
   - New → Begin task: `At startup`
5. **Actions:**
   - New → Action: `Start a program`
   - Program: `C:\Bots\dh-dogs-tg-bot\start-bot.bat`
   - Start in: `C:\Bots\dh-dogs-tg-bot`
6. **Settings:**
   - Uncheck: `Stop the task if it runs longer than`
7. Нажать **OK**

---

## Решение проблем

| Проблема | Решение |
|----------|---------|
| `BOT_TOKEN is not set` | Создать `.env` файл с токеном |
| `ETELEGRAM: 401 Unauthorized` | Неверный токен бота |
| `ETELEGRAM: 409 Conflict` | Бот уже запущен в другом месте |
| Сервер не запускается | Проверить путь в `BINARY_PATH` |
| Python loader не работает | Проверить название и расположение `.py` файла |

---

## Разработка

```bash
# Режим разработки
npm run dev

# Режим разработки с hot reload
npm run dev:watch

# Сборка
npm run build

# Запуск собранной версии
npm start
```

---

## Получение токена бота

1. Открыть Telegram и найти [@BotFather](https://t.me/BotFather)
2. Отправить `/newbot`
3. Следовать инструкциям для создания бота
4. Скопировать токен (формат: `123456789:ABCdefGHI...`)
5. Вставить в `.env` файл

---

## Лицензия

ISC
