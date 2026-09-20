@echo off
echo Stopping Antigravity Voice Companion...
taskkill /F /FI "WINDOWTITLE eq Antigravity Live Voice Companion*" >nul 2>&1
wmic process where "commandline like '%%antigravity_voice_companion.py%%'" call terminate >nul 2>&1
powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*antigravity_voice_companion.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
echo Voice companion stopped!
timeout /t 2 >nul
