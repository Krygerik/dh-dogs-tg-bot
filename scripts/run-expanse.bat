@echo off
chcp 65001 >nul

:: Change to the directory where the server executable is located
:: LOCALE
cd /d "D:\steam\steamapps\common\Dread Hunger\WindowsServer\DreadHunger\Binaries\Win64"
:: REMOTE SERVER
:: cd /d "C:\Users\Server\WindowsServer\DreadHunger\Binaries\Win64"

:: Start the Dread Hunger server (Expanse map) and capture PID using PowerShell
for /f %%p in ('powershell -Command "& { $proc = Start-Process -FilePath 'DreadHungerServer-Win64-Shipping.exe' -ArgumentList 'Expanse_Persistent?daysbeforeblizzard=3?maxplayers=8?thralls=2 -log' -PassThru; Write-Output $proc.Id }"') do (
    set PID=%%p
)

:: Write PID to file in scripts directory
echo %PID%> "%~dp0server.pid"
echo expanse> "%~dp0server.map"

echo [OK] Expanse server started. PID: %PID%
