@echo off
echo Stopping Antigravity Voice Companion and Voice Studio...
taskkill /F /IM pythonw.exe /FI "WINDOWTITLE eq *" 2>nul
powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*antigravity_voice_companion.py*' -or $_.CommandLine -like '*voice_studio\server.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" 2>nul
echo Successfully stopped.
timeout /t 2 >nul
