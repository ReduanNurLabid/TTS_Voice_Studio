@echo off
title Voice Companion Studio
cd /d "%~dp0voice_studio"
echo Starting Voice Companion Studio at http://localhost:5050 ...
start http://localhost:5050
python server.py
pause
