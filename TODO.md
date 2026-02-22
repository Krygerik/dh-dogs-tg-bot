# TODO: Статистика игровых сессий

## Исследование (необходимо до улучшения мода)

- [ ] Найти RVA функции окончания матча (EndMatch / SetWinningTeam)
      Методы:
      - `MemoryAccessMonitor` на gameStatePtr + 0x51c (WinningTeam) для поиска записывающей функции
      - Поиск строк "WinningTeam", "EndMatch", "GameOver" в DreadHungerServer-Win64-Shipping.exe через IDA/Ghidra
      - После нахождения RVA — заменить polling в session_stats.js на Interceptor.attach(base.add(RVA))
- [ ] Проверить что PlayerState_GetPlayerRole (0xef26b0) возвращает корректный roleType в конце матча
- [ ] Проверить офсет PlayerStateSelectedRole (0x590) — указатель на RoleData или roleType напрямую
- [ ] Убедиться что roleName читается корректно через RoleData + 0x48 (RoleNameFString)

## Мод session_stats.js

- [x] Создать patches/technical/session_stats/session_stats.js (polling WinningTeam каждые 2с)
- [ ] После нахождения RVA функции окончания матча: заменить polling на Interceptor.attach
- [ ] Протестировать: запуск сессии → победа одной из команд → проверить что POST /session-stats вызван
- [ ] Убедиться что roleName у игроков заполняется корректно (Engineer, Cook, etc.)

## loader.py

- [x] Добавить обработку payload type == 'session_stats'
- [x] Добавить аргумент --session-id
- [x] Реализовать POST /session-stats на API бота (порт 8787)

## Бэкенд (TypeScript)

- [x] Создать src/stats/stats-types.ts
- [x] Создать src/stats/stats-store.ts (JSON-хранилище, атомарная запись)
- [x] Создать src/stats/stats-service.ts (запись сессий, агрегация топов)
- [x] Расширить RunningSession в types.ts полем statsSessionId
- [x] Изменить server-manager.ts: хуки на старт/стоп, инжекция session_stats, передача --session-id
- [x] Добавить POST /session-stats в api-server.ts
- [x] Добавить GET /stats в api-server.ts
- [x] Добавить команду /stats и обновить /help в bot-handlers.ts
- [x] Создать data/.gitkeep, добавить data/stats.json в .gitignore

## Верификация

- [ ] `npm run build` — без ошибок TypeScript
- [ ] Запустить сессию, завершить через /stop → запись в data/stats.json с endReason: "admin_stop"
- [ ] Завершить матч в игре → данные о игроках и победителе появились в записи
- [ ] `/stats` в Telegram — корректный вывод топов и последних сессий
- [ ] `GET /stats` — корректный JSON
- [ ] Перезапуск бота — история из data/stats.json сохранена
