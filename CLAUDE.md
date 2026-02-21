# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Telegram bot + HTTP API for managing Dread Hunger dedicated game server sessions on Windows. Handles session lifecycle (start/stop/status), mod injection via Frida, real-time log capture, and telemetry. Written in TypeScript, runs on Node.js.

## Build & Run Commands

```bash
npm run build          # TypeScript compilation (tsc)
npm start              # Run compiled dist/index.js
npm run dev            # Run directly via ts-node
npm run dev:watch      # Hot reload development via tsx watch
```

No test framework is configured. No linter is configured.

## Architecture

Modular structure. See [docs/architecture.md](docs/architecture.md) for the full dependency graph.

```
src/
├── index.ts              # Entry point: dotenv, wiring, graceful shutdown
├── types.ts              # All type definitions
├── paths.ts              # Path constants to reference/ and patches/ files
├── config.ts             # buildConfig(), resolve helpers, API_PORT, API_TOKEN, TEST_PARAMS_*
├── server-manager.ts     # ServerManager class — session lifecycle, Frida injection
├── api-server.ts         # HTTP API server (port 8787, no framework)
├── bot-handlers.ts       # Telegram command handlers and inline callback routing
├── reference/            # JSON reference data loaders
│   ├── maps.ts           # mods.ts, modifiers.ts, roles.ts, items.ts
│   └── ...
└── utils/                # Pure utility functions
    ├── parse.ts          # http.ts, telegram.ts, process.ts, logging.ts
    └── ...
```

**No external web framework** — HTTP API uses Node.js `http` module directly with manual routing and JSON parsing.

**Process management** — game server sessions are spawned via `child_process.spawn()`. On Windows, processes are killed with `taskkill /PID /T /F`. Initialization is detected by watching stdout/stderr for a signature string.

**Mod system** has three layers:
- **Stable mods** in `patches/stable/{modname}/{modname}.js` — discovered dynamically by `listStableMods()`
- **Mod collections** in `patches/alllready_configs/*.txt` — predefined mod sets, mapped to maps via `reference/map-collections.json`
- **Custom modifiers** in `reference/custom_modifiers.json` — game balance parameters with range constraints and presets

**Frida integration** — optional Python-based script injector (`frida/loader.py`, wrapped by `frida/python_loader.bat`) injects mod scripts into the running game process. Configured via `FRIDA_PATH` env var.

## Key Configuration

All configuration is via `.env` file (see `env.example`). Required vars: `BOT_TOKEN`, `PUBLIC_IP`, `BINARY_PATH`. The `PORTS` var supports ranges (e.g. `7777-7782,8000`).

## Reference Data

Game metadata lives in `reference/` as JSON files: `maps.json`, `roles.json`, `items.json`, `custom_modifiers.json`, `map-collections.json`. Russian localization files use `*.ru.json` suffix.

## Documentation

All project documentation is in `docs/`. See [docs/README.md](docs/README.md) for the index.

## Language & Conventions

- TypeScript strict mode, target ES2020, CommonJS modules
- Documentation and UI strings are in Russian
- Commit messages use conventional-style prefixes (`feat:`, etc.) with Russian descriptions
