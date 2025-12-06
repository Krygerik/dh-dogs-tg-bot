@echo off
chcp 65001 >nul

:: Load environment from .env file
for /f "tokens=1,2 delims==" %%a in ('type "%~dp0..\.env" 2^>nul ^| findstr "SERVER_ENV"') do (
    set %%a=%%b
)

:: Set default if not defined
if not defined SERVER_ENV set SERVER_ENV=LOCALE

:: Change to the directory where the server executable is located
if "%SERVER_ENV%"=="LOCALE" (
    cd /d "D:\steam\steamapps\common\Dread Hunger\WindowsServer\DreadHunger\Binaries\Win64"
) else (
    cd /d "C:\Users\Server\WindowsServer\DreadHunger\Binaries\Win64"
)

:: Start the Dread Hunger server (Expanse Duo map) and capture PID using PowerShell
for /f %%p in ('powershell -Command "& { $proc = Start-Process -FilePath 'DreadHungerServer-Win64-Shipping.exe' -ArgumentList 'Expanse_Persistent?daysbeforeblizzard=3?maxplayers=2?thralls=1 -log' -PassThru; Write-Output $proc.Id }"') do (
    set PID=%%p
)

:: Write PID to file in scripts directory
echo %PID%> "%~dp0server.pid"
echo expanse_duo> "%~dp0server.map"

:: Run the Python loader script (if exists in server directory)
if exist "scripts_for_tg_bot/loader_for_expanse_tg_bot.py" (
    echo [INFO] Running Python loader...
    python "scripts_for_tg_bot/loader_for_solo_or_duo.py"
)

echo [OK] Expanse Duo server started. PID: %PID% [%SERVER_ENV%]

