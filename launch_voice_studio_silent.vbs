Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "c:\Users\Reduan\Downloads\TTS\voice_studio"
WshShell.Run "python server.py", 0, False
WScript.Sleep 800
WshShell.Run "http://localhost:5050"
