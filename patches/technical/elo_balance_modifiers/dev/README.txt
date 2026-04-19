workbench_craft_speed_lib.js — только для локальной отладки.

Не подмешивается к elo_balance_modifiers.js и не описан в stable/collections
(список модов клиента).

Известные проблемы на проде: ломает взаимодействия ролей (инженер, повар,
охотник, капитан и др.) — не включать в обычные сборки.

Включение: задать globalThis.__DH_DEV_WORKBENCH_CRAFT_SPEED = true и множитель
__DH_WORKBENCH_CRAFT_SPEED_MULT до загрузки скрипта; подключить только этот файл
+ вызов installWorkbenchCraftSpeedHooks(base) с базой модуля игры.
