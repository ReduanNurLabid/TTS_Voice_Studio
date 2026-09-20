# Neural TTS & Voice Companion Suite

This workspace contains two specialized voice systems built on Microsoft Edge Neural Speech technology:

---

## 📂 Projects

### 1. 🎙️ [Antigravity Voice Companion](antigravity_companion/)
The desktop ambient companion and IDE extension for Google Antigravity IDE.
- Automatically reads IDE agent responses aloud as they stream into conversation transcripts.
- Progressive streaming schedule (Layer 1: 1 sent -> Layer 2: 2 sents -> Layer 3+: remaining).
- Packaged as a VS Code / Antigravity IDE `.vsix` extension and standalone Python background daemon.

👉 See [`antigravity_companion/README.md`](antigravity_companion/README.md) for extension details and launch instructions.

---

### 2. 📖 [Human-Like Reader TTS (Voice Studio)](voice_studio/)
A standalone, full-featured web studio for listening to books, technical architecture documents, Bengali literature, and articles with human-like breathing pauses and word-by-word karaoke synchronization.
- **Modes**:
  - `🚀 Read As You Go`: Layered progressive audio streaming with paragraph-bounded chunking and synchronized teleprompter.
  - `🎧 Generate Audio`: Full studio MP3 export with timeline scrubbing and download.
- **Visuals**: Centered symmetrical breathing audio beat visualizer with organic respiratory expansion.
- **Languages**: Native US English (`Emma`, `Andrew`, `Ava`, `Jenny`, `Aria`) and Bengali (`Nabanita`, `Pradeep`, `Tanishaa`, `Bashkar`).
- **GitHub Pages Ready**: Prepared for static hosting on GitHub Pages with lightweight serverless cloud proxy.

👉 See [`voice_studio/README.md`](voice_studio/README.md) for local run and free online deployment instructions.

---

### 3. 🧪 [Samples & Tests](samples_and_tests/)
Collection of sample MP3 audio renders, pitch modulation tests, voice audition recordings, and acoustic pause benchmarks.

---

## ⚡ Quick Launchers (Root Shortcuts)

- **`launch_voice_studio_silent.vbs`**: Starts the Voice Studio server on port 5050 and opens browser silently.
- **`start_voice_companion_silent.vbs`**: Starts the Antigravity companion daemon in the background.
- **`stop_voice_companion.bat`**: Stops all active voice companion and studio background processes.
