import http.server
import socketserver
import json
import asyncio
import edge_tts
import re
import os
import io
import sys
import base64
from pathlib import Path

# Ensure UTF-8 output
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

STUDIO_DIR = Path(__file__).resolve().parent
STATIC_PREVIEWS = STUDIO_DIR.parent / "antigravity-voice" / "previews"
PORT = int(os.environ.get("PORT", 5050))

VOICES = [
    # English Voices
    {
        "id": "en-US-EmmaNeural",
        "name": "Emma",
        "gender": "Female",
        "region": "US 🇺🇸",
        "language": "English",
        "tag": "Gentle & Reflective",
        "recommended": True
    },
    {
        "id": "en-US-AndrewNeural",
        "name": "Andrew",
        "gender": "Male",
        "region": "US 🇺🇸",
        "language": "English",
        "tag": "Warm & Conversational",
        "recommended": True
    },
    {
        "id": "en-US-AvaNeural",
        "name": "Ava",
        "gender": "Female",
        "region": "US 🇺🇸",
        "language": "English",
        "tag": "Melodic & Expressive",
        "recommended": True
    },
    {
        "id": "en-US-JennyNeural",
        "name": "Jenny",
        "gender": "Female",
        "region": "US 🇺🇸",
        "language": "English",
        "tag": "Crisp & Professional",
        "recommended": False
    },
    {
        "id": "en-US-AriaNeural",
        "name": "Aria",
        "gender": "Female",
        "region": "US 🇺🇸",
        "language": "English",
        "tag": "Bright & Articulate",
        "recommended": False
    },
    {
        "id": "en-US-GuyNeural",
        "name": "Guy",
        "gender": "Male",
        "region": "US 🇺🇸",
        "language": "English",
        "tag": "Casual & Friendly",
        "recommended": False
    },
    {
        "id": "en-US-BrianNeural",
        "name": "Brian",
        "gender": "Male",
        "region": "US 🇺🇸",
        "language": "English",
        "tag": "Deep & Authoritative",
        "recommended": False
    },
    {
        "id": "en-GB-RyanNeural",
        "name": "Ryan",
        "gender": "Male",
        "region": "UK 🇬🇧",
        "language": "British English",
        "tag": "Refined British",
        "recommended": False
    },
    {
        "id": "en-GB-SoniaNeural",
        "name": "Sonia",
        "gender": "Female",
        "region": "UK 🇬🇧",
        "language": "British English",
        "tag": "Natural British",
        "recommended": False
    },
    # Bengali Voices
    {
        "id": "bn-BD-NabanitaNeural",
        "name": "Nabanita (নবনীত)",
        "gender": "Female",
        "region": "Bangladesh 🇧🇩",
        "language": "Bengali (বাংলা)",
        "tag": "Warm & Melodic",
        "recommended": True
    },
    {
        "id": "bn-BD-PradeepNeural",
        "name": "Pradeep (প্রদীপ)",
        "gender": "Male",
        "region": "Bangladesh 🇧🇩",
        "language": "Bengali (বাংলা)",
        "tag": "Natural & Narrative",
        "recommended": True
    },
    {
        "id": "bn-IN-TanishaaNeural",
        "name": "Tanishaa (তানিশা)",
        "gender": "Female",
        "region": "India 🇮🇳",
        "language": "Bengali (বাংলা)",
        "tag": "Sweet & Clear",
        "recommended": False
    },
    {
        "id": "bn-IN-BashkarNeural",
        "name": "Bashkar (ভাস্কর)",
        "gender": "Male",
        "region": "India 🇮🇳",
        "language": "Bengali (বাংলা)",
        "tag": "Deep & Articulate",
        "recommended": False
    }
]

def clean_and_inject_pauses(text: str) -> str:
    # 1. Strip any HTML/XML tags
    text = re.sub(r"<[^>]+>", " ", text)

    # 2. Clean markdown links & URLs
    text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)
    text = re.sub(r"https?://\S+", "", text)

    # 3. Bengali vs English Pacing
    is_bengali = bool(re.search(r"[\u0980-\u09FF]", text))
    if is_bengali:
        # Bengali Dari (।) and Semicolons
        text = text.replace(";", ", ")
        text = re.sub(r"।\s*", "। ... ", text)
        # Bengali transitions
        bn_transitions = ["তবে", "কিন্তু", "অবশ্যই", "সুতরাং", "অবশেষে", "কারণ", "যেমন"]
        for tr in bn_transitions:
            text = re.sub(rf"(^|[।!?\n]\s*)({tr})", r"\1\2, ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    # English Natural Human Breath Pacing:
    text = text.replace(";", ", ")
    text = re.sub(r"\s*\(([^)]+)\)\s*", r" — \1 — ", text)

    # Numbered points: "1. Point Title:" -> "Point 1: Point Title... "
    text = re.sub(r"^(\s*)(\d+)\.\s+([^:\n]+):", r"\1Point \2: \3... ", text, flags=re.MULTILINE)
    text = re.sub(r"\b(Point \d+:[^.]+?\.)\s*", r"\1... ", text)

    # Transitions at sentence starts -> comma pauses
    transitions = [
        "First", "Second", "Third", "Finally", "During", "When", "There are",
        "Apparently", "However", "On the other hand", "In fact", "Actually",
        "For example", "For instance", "Notice that", "Keep in mind"
    ]
    for tr in transitions:
        text = re.sub(rf"(^|[.!?\n]\s*)({tr}),?\s+([A-Za-z])", rf"\1\2, \3", text, flags=re.IGNORECASE)

    # Contrasting & causal conjunctions
    text = re.sub(r",?\s*(but|although|whereas|however)\s+", r", \1 ", text, flags=re.IGNORECASE)
    text = re.sub(r",?\s*(because|so that)\s+", r", \1 ", text, flags=re.IGNORECASE)

    # Complex / unfamiliar word pacing:
    # When an English word is polysyllabic / complex (>= 10 chars), prefix a tiny comma pause if after a long run of words
    words = text.split(" ")
    refined_words = []
    run_length = 0
    for w in words:
        clean_w = re.sub(r"[^A-Za-z]", "", w)
        # Check if word is long / complex and preceded by a breath run
        if len(clean_w) >= 10 and run_length >= 6 and not refined_words[-1].endswith((",", ".", "!", "?", "—", "...")):
            refined_words.append(f"... {w}")
            run_length = 0
        else:
            refined_words.append(w)
            if any(w.endswith(p) for p in [".", ",", "!", "?", "..."]):
                run_length = 0
            else:
                run_length += 1

    text = " ".join(refined_words)
    text = re.sub(r"[*`#~|]", " ", text)
    text = re.sub(r",\s*,+", ", ", text)
    text = re.sub(r"\.{4,}", "... ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

async def synthesize_speech_with_words(text: str, voice: str, rate: str = "+0%", pitch: str = "+0Hz", natural_pauses: bool = True) -> tuple[bytes, list[dict]]:
    processed_text = clean_and_inject_pauses(text) if natural_pauses else text.strip()
    communicate = edge_tts.Communicate(processed_text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
    
    mp3_buffer = io.BytesIO()
    word_boundaries = []

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            mp3_buffer.write(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            start_s = chunk["offset"] / 10_000_000.0
            dur_s = chunk["duration"] / 10_000_000.0
            word_boundaries.append({
                "text": chunk["text"],
                "start": round(start_s, 3),
                "end": round(start_s + dur_s, 3)
            })

    return mp3_buffer.getvalue(), word_boundaries

class StudioRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STUDIO_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/voices":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(VOICES).encode("utf-8"))
            return

        if self.path.startswith("/api/preview/"):
            voice_id = self.path.split("/api/preview/")[1]
            preview_file = STATIC_PREVIEWS / f"{voice_id}.mp3"
            if preview_file.exists():
                self.send_response(200)
                self.send_header("Content-Type", "audio/mpeg")
                self.send_header("Content-Length", str(preview_file.stat().st_size))
                self.end_headers()
                with open(preview_file, "rb") as f:
                    self.wfile.write(f.read())
                return

        return super().do_GET()

    def do_POST(self):
        if self.path in ("/api/speak", "/api/stream_unit"):
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body)
                text = data.get("text", "").strip()
                voice = data.get("voice", "en-US-EmmaNeural")
                rate = data.get("rate", "+0%")
                pitch = data.get("pitch", "+0Hz")
                natural_pauses = data.get("natural_pauses", True)
                format_type = data.get("format", "json")  # "json" or "audio"

                if not text:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Text cannot be empty"}).encode("utf-8"))
                    return

                # Run synthesis with word boundaries
                audio_bytes, words = asyncio.run(
                    synthesize_speech_with_words(text, voice, rate=rate, pitch=pitch, natural_pauses=natural_pauses)
                )

                if format_type == "audio":
                    self.send_response(200)
                    self.send_header("Content-Type", "audio/mpeg")
                    self.send_header("Content-Length", str(len(audio_bytes)))
                    self.end_headers()
                    self.wfile.write(audio_bytes)
                else:
                    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
                    resp_payload = {
                        "audio": f"data:audio/mp3;base64,{audio_b64}",
                        "words": words,
                        "word_count": len(words)
                    }
                    resp_bytes = json.dumps(resp_payload).encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(resp_bytes)))
                    self.end_headers()
                    self.wfile.write(resp_bytes)

            except Exception as e:
                import traceback
                traceback.print_exc()
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), StudioRequestHandler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 60)
        print("  Voice Companion Studio Server (Multi-lingual & Word Sync)")
        print(f"  Live at: {url}")
        print("=" * 60, flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer shutting down...")

if __name__ == "__main__":
    run_server()
