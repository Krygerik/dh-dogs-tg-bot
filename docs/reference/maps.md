# Справочник карт

Локальные справочники используются для передачи списка карт и их локализации
в клиент. Файлы лежат в `reference/`.

## Файлы

### `reference/maps.json`
Список ключей карт (server value), которые используются для запуска:
```json
{
  "maps": ["Approach_Persistent", "Departure_Persistent", "Expanse_Persistent"]
}
```

### `reference/maps.ru.json`
Локализация ключей карт на русский:
```json
{
  "Approach_Persistent": "Подступ",
  "Departure_Persistent": "Вершина",
  "Expanse_Persistent": "Просторы"
}
```

### `reference/map-collections.json`
Сопоставление карты и готовой коллекции модов (по имени файла в
`patches/alllready_configs`):
```json
{
  "Approach_Persistent": "Approach",
  "Departure_Persistent": "Departure",
  "Expanse_Persistent": "Expanse"
}
```

## Использование
- API `GET /maps` возвращает карты с локализованным `name`,
  оригинальным `serverValue` и полем `defaultCollection`.
- Клиент использует `name` как отображаемое значение,
  а `serverValue` отправляет в `mapName` при старте сессии.
- При выборе карты клиент автоматически применяет коллекцию
  `defaultCollection` и выбирает соответствующие моды.
