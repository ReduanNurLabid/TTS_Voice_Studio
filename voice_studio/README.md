# Human-Like Reader TTS Studio

A modern, responsive Neural Text-to-Speech reading studio featuring progressive layered streaming, human breathing pauses, synchronized karaoke word highlighting, and multi-lingual English & Bengali AI voices.

---

## 🚀 Quick Start (Run Locally)

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
2. **Start Studio**:
   - Double-click `launch_voice_studio_silent.vbs` or `launch_voice_studio.bat`, OR run:
   ```bash
   python server.py
   ```
3. Open [http://localhost:5050](http://localhost:5050) in your web browser.

---

## 🌐 Hosting Online (GitHub Pages + Free Backend)

### 1. Can GitHub Pages run the whole app alone?
- **GitHub Pages is a static host** (serves HTML, CSS, JavaScript, and static assets).
- Browser security (CORS/WebSocket restrictions) prevents browser JavaScript from directly connecting to Microsoft's private Edge TTS speech endpoint.
- Therefore, **the frontend runs on GitHub Pages**, while a **lightweight Python proxy (`server.py`)** runs on a free cloud container (e.g. Hugging Face Spaces or Render).

### 2. Where is CPU used?
When speech is generated and played:
1. **AI Neural Synthesis Model (Edge TTS / Azure)**:
   - **Runs on:** Microsoft Azure Cloud Datacenters.
   - **Your CPU cost:** **0%**. Microsoft performs the heavy GPU/CPU neural synthesis computations on their cloud infrastructure.
2. **Backend Proxy (`server.py`)**:
   - **Runs on:** Your free serverless host (e.g., Hugging Face Spaces or Render).
   - **CPU usage:** **Negligible (<1% of a single vCPU)**. It is purely an I/O network bridge streaming audio bytes and word boundary JSON to the browser.
3. **Browser Audio & Visualizer**:
   - **Runs on:** The visitor's device (phone, laptop, desktop).
   - **Usage:** Lightweight HTML5 Web Audio API and 60fps canvas rendering for the centered breathing animation.

---

## 📦 How to Deploy in 2 Steps

### Step 1: Deploy Free Backend on Hugging Face Spaces or Render
1. Create a free account on [Hugging Face](https://huggingface.co/) or [Render](https://render.com/).
2. Create a new **Space** (choose **Docker** or **Python** SDK).
3. Upload `server.py` and `requirements.txt`.
4. Hugging Face / Render gives you a public HTTPS URL:
   `https://your-username-reader-tts.hf.space`

### Step 2: Deploy Frontend on GitHub Pages
1. Push `index.html`, `style.css`, and `app.js` to a GitHub repository (e.g., `human-like-reader`).
2. In `index.html`, inside the `<head>` tag, specify your backend URL:
   ```html
   <script>
     window.SPEECH_API_BASE = "https://your-username-reader-tts.hf.space";
   </script>
   ```
3. In your GitHub repository, go to **Settings > Pages** and select **Deploy from branch: main / root**.
4. Your Human-Like Reader is now live on the internet!
