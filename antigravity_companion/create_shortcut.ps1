$ws = New-Object -ComObject WScript.Shell
$desktopPath = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath "Antigravity Voice.lnk"
$shortcut = $ws.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = '"C:\Users\Reduan\Downloads\TTS\start_voice_companion_silent.vbs"'
$shortcut.WorkingDirectory = "C:\Users\Reduan\Downloads\TTS"
$shortcut.IconLocation = "shell32.dll,168"
$shortcut.Description = "Start Antigravity Voice Companion"
$shortcut.Save()
Write-Host "Shortcut created at $shortcutPath"
