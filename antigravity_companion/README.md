# Antigravity Voice Companion

An ambient voice companion for the Antigravity IDE that reads AI assistant responses aloud in real-time with natural speaking cadence and zero-latency progressive streaming.

---

## 📂 Project Structure

- **`antigravity-voice/`**: The Antigravity IDE / VS Code extension source package (`extension.js`, `package.json`, `voice_worker.py`).
- **`antigravity_voice_companion.py`**: The background companion daemon that monitors the active Antigravity conversation trajectory (`transcript.jsonl`) and speaks assistant responses through Pygame.
- **`build_vsix.py`**: Packaging script to compile the extension into `antigravity-voice-1.0.0.vsix`.
- **`register_ext.py`**: Automatic registration script that links the extension into Antigravity IDE extension storage.
- **`start_voice_companion.bat`** & **`start_voice_companion_silent.vbs`**: Launchers for the companion daemon.
- **`stop_voice_companion.bat`**: Gracefully terminates running companion and voice worker processes.

---

## 🚀 Quick Start

1. **Install Dependencies**:
   ```bash
   pip install edge-tts pygame
   ```
2. **Launch Background Companion**:
   - Double-click `start_voice_companion_silent.vbs` to run silently in the background.
3. **Stop Companion**:
   - Double-click `stop_voice_companion.bat`.
