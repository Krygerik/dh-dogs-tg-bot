# Custom Modifiers

Локальный справочник параметров для `custom_modifiers`. Используется клиентом
для построения UI и дефолтных значений.

## Файлы

### `reference/custom_modifiers.json`
Содержит список модификаторов и их диапазоны:
```json
{
  "modifiers": [
    { "key": "maxplayers", "min": 1, "max": 8, "default": 8, "step": 1 }
  ]
}
```

### `reference/custom_modifiers.ru.json`
Локализация ключей модификаторов:
```json
{
  "maxplayers": "Игроки"
}
```

### `reference/custom_modifiers.presets.json`
Готовые пресеты для Custom Modifiers:
```json
{
  "presets": [
    { "id": "solo", "name": "Solo", "values": { "maxplayers": 1 } }
  ]
}
```

## Использование
- API `GET /modifiers` возвращает список модификаторов с локализованным `name`,
  диапазоном и значениями по умолчанию.
- Клиент использует дефолты как стартовые значения.
- При старте сессии клиент отправляет `customModifiers` вместе с картой.
- Пресеты используются в UI как быстрые переключатели значений.
