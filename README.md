# DH Dogs Telegram Bot 🐕

A simple Telegram bot built with TypeScript that provides dog-related commands.

## Features

### Bot Commands
| Command | Description |
|---------|-------------|
| `/start` | Shows welcome message and available commands |
| `/run` | Выбор и запуск скрипта (Вершина / Просторы) |
| `/dog` | Returns a random fun fact about dogs |

## Prerequisites

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Telegram Bot Token** - Get one from [@BotFather](https://t.me/BotFather)

---

## Quick Start

### 1. Clone/Download the project
```bash
git clone <repository-url>
cd dh-dogs-tg-bot
```

### 2. Configure Environment
```bash
# Copy example environment file
copy env.example .env

# Edit .env file and add your bot token
notepad .env
```

Set your bot token in `.env`:
```
BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 3. Run the Bot
Double-click `start.bat` or run:
```bash
start.bat
```

---

## Batch Scripts

| Script | Description |
|--------|-------------|
| `start.bat` | Installs dependencies, builds TypeScript, and starts the bot |
| `stop.bat` | Stops all running bot instances |
| `restart.bat` | Stops and restarts the bot |

---

## Windows Server Hosting Instructions

### Step 1: Install Node.js

1. Download Node.js LTS from https://nodejs.org/
2. Run the installer with default settings
3. Verify installation:
   ```cmd
   node --version
   npm --version
   ```

### Step 2: Deploy Bot Files

1. Copy the entire project folder to your server (e.g., `C:\Bots\dh-dogs-tg-bot\`)
2. Create the `.env` file with your bot token:
   ```cmd
   cd C:\Bots\dh-dogs-tg-bot
   copy env.example .env
   notepad .env
   ```

### Step 3: Install Dependencies & Build

```cmd
cd C:\Bots\dh-dogs-tg-bot
npm install
npm run build
```

### Step 4: Run Bot Manually (Testing)

```cmd
start.bat
```

### Step 5: Run Bot as Windows Service (Production)

#### Option A: Using Task Scheduler (Recommended)

1. Open **Task Scheduler** (`taskschd.msc`)
2. Click **Create Task** (not Basic Task)
3. **General tab:**
   - Name: `DH Dogs Telegram Bot`
   - Check: `Run whether user is logged on or not`
   - Check: `Run with highest privileges`
4. **Triggers tab:**
   - New → Begin task: `At startup`
5. **Actions tab:**
   - New → Action: `Start a program`
   - Program: `C:\Bots\dh-dogs-tg-bot\start.bat`
   - Start in: `C:\Bots\dh-dogs-tg-bot`
6. **Settings tab:**
   - Uncheck: `Stop the task if it runs longer than`
   - Check: `If the task fails, restart every: 1 minute`
7. Click **OK** and enter your Windows credentials

#### Option B: Using NSSM (Non-Sucking Service Manager)

1. Download NSSM from https://nssm.cc/download
2. Extract and copy `nssm.exe` to `C:\Windows\System32\`
3. Open Command Prompt as Administrator:
   ```cmd
   nssm install DHDogsBot
   ```
4. Configure in the GUI:
   - **Path:** `C:\Program Files\nodejs\node.exe`
   - **Startup directory:** `C:\Bots\dh-dogs-tg-bot`
   - **Arguments:** `dist/index.js`
5. Start the service:
   ```cmd
   nssm start DHDogsBot
   ```

#### Option C: Using PM2 (Process Manager)

1. Install PM2 globally:
   ```cmd
   npm install -g pm2
   npm install -g pm2-windows-startup
   ```
2. Start the bot with PM2:
   ```cmd
   cd C:\Bots\dh-dogs-tg-bot
   pm2 start dist/index.js --name "dh-dogs-bot"
   ```
3. Save PM2 configuration:
   ```cmd
   pm2 save
   pm2-startup install
   ```

### Step 6: Configure Firewall (If Needed)

The bot uses **outbound HTTPS connections only** (polling mode), so no inbound firewall rules are required.

### Step 7: Monitoring & Logs

**Check if bot is running:**
```cmd
tasklist | findstr node
```

**View PM2 logs (if using PM2):**
```cmd
pm2 logs dh-dogs-bot
```

**View Windows Event logs (if using NSSM):**
- Open Event Viewer → Windows Logs → Application

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `BOT_TOKEN is not set` | Create `.env` file with your token |
| `ETELEGRAM: 401 Unauthorized` | Invalid bot token - check with @BotFather |
| `ETELEGRAM: 409 Conflict` | Another instance is running - use `stop.bat` |
| Bot not responding | Check if Node.js process is running |
| Build errors | Delete `node_modules` and `dist`, run `npm install` again |

---

## Project Structure

```
dh-dogs-tg-bot/
├── src/
│   └── index.ts        # Bot source code
├── scripts/            # Batch scripts to run
│   ├── run-departure.bat   # Вершина script
│   └── run-expanse.bat     # Просторы script
├── dist/               # Compiled JavaScript (generated)
├── node_modules/       # Dependencies (generated)
├── .env                # Environment variables (create from env.example)
├── env.example         # Example environment file
├── package.json        # Project configuration
├── tsconfig.json       # TypeScript configuration
├── start.bat           # Start the bot
├── stop.bat            # Stop the bot
└── restart.bat         # Restart the bot
```

---

## Development

**Run in development mode:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
```

**Start production build:**
```bash
npm start
```

---

## Getting Bot Token from BotFather

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` command
3. Follow the prompts to name your bot
4. Copy the token provided (looks like: `123456789:ABCdefGHI...`)
5. Paste it in your `.env` file

---

## License

ISC

