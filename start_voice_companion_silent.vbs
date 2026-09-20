Set WshShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "pythonw """ & scriptDir & "\antigravity_companion\antigravity_voice_companion.py""", 0, False
