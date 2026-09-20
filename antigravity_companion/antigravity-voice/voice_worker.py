"""
Antigravity Voice Companion - Worker Engine
Runs in the background, monitored by the Antigravity Voice extension.
Implements progressive chunking: 1 sentence -> 2 sentences -> 5 sentences -> remaining text.
Dynamically reloads configuration (voice, speed, enabled status) from config.json.
Responds to runtime commands (replay last response, stop speaking) from command.json.
"""

import os
import re
import sys
import json
import time
import asyncio
import tempfile
from pathlib import Path
import edge_tts
import pygame

# Ensure UTF-8 output so emojis and unicode symbols don't crash Windows charmap
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

BRAIN_DIR = Path(r"C:\Users\Reduan\.gemini\antigravity-ide\brain")
CONFIG_PATH = Path(__file__).parent / "voice_config.json"
COMMAND_PATH = Path(__file__).parent / "command.json"
PREVIEWS_DIR = Path(__file__).parent / "previews"

# Defaults
DEFAULT_VOICE = "en-US-AndrewMultilingualNeural"
DEFAULT_SPEED = "+0%"
DEFAULT_ENABLED = True
DEFAULT_VOLUME = 100

current_voice = DEFAULT_VOICE
current_speed = DEFAULT_SPEED
is_enabled = DEFAULT_ENABLED
current_volume = DEFAULT_VOLUME
last_command_ts = 0

def load_config():
    """Loads settings from voice_config.json if available."""
    global current_voice, current_speed, is_enabled, current_volume
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                current_voice = data.get("voice", DEFAULT_VOICE)
                current_speed = data.get("speed", DEFAULT_SPEED)
                is_enabled = data.get("enabled", DEFAULT_ENABLED)
                current_volume = int(data.get("volume", DEFAULT_VOLUME))
                if pygame.mixer.get_init():
                    pygame.mixer.music.set_volume(max(0.0, min(1.0, current_volume / 100.0)))
        except Exception:
            pass

def ensure_mixer_init():
    """Initializes pygame mixer if not already initialized."""
    if not pygame.mixer.get_init():
        pygame.mixer.init()

def get_latest_conversation_dir() -> Path | None:
    """Finds the most recently active conversation directory."""
    if not BRAIN_DIR.exists():
        return None
    candidates = []
    for d in BRAIN_DIR.iterdir():
        if d.is_dir() and d.name != "tempmediaStorage":
            transcript = d / ".system_generated" / "logs" / "transcript.jsonl"
            if transcript.exists():
                candidates.append((transcript.stat().st_mtime, transcript))
    if not candidates:
        return None
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1]

def find_last_response_content(transcript_path: Path) -> str | None:
    """Finds the most recent assistant response in the transcript."""
    if not transcript_path or not transcript_path.exists():
        return None
    last_content = None
    try:
        with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                try:
                    data = json.loads(line)
                    if (
                        data.get("type") == "PLANNER_RESPONSE"
                        and not data.get("tool_calls")
                    ):
                        cnt = data.get("content", "")
                        if cnt.strip():
                            last_content = cnt
                except Exception:
                    pass
    except Exception:
        pass
    return last_content

def clean_markdown_for_speech(text: str) -> str:
    """Cleans markdown, filenames, code, and technical jargon for natural speech."""
    # 1. Remove entire code blocks
    text = re.sub(r"```[\s\S]*?```", " [Code block omitted.] ", text)

    # 2. Extract markdown links: [Readable Title](url) -> Readable Title
    text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)

    # 3. Simplify full file paths
    text = re.sub(r"[A-Za-z]:\\[^ \n\r\t]+\\([^ \n\r\t]+)", r"\1", text)
    text = re.sub(r"file:///[^\s)]+/([^\s/)]+)", r"\1", text)

    # 4. Remove URLs
    text = re.sub(r"https?://\S+", "", text)

    # 5. Handle GitHub-style alert callouts: > [!NOTE] / > [!WARNING]
    text = re.sub(r">\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]", r"\1: ", text, flags=re.I)

    # 6. Split CamelCase words: VoiceGenerator -> Voice Generator
    text = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)

    # 7. Expand technical units for natural pronunciation
    text = re.sub(r"(\d+(?:\.\d+)?)\s*GB\b", r"\1 gigabytes", text, flags=re.I)
    text = re.sub(r"(\d+(?:\.\d+)?)\s*MB\b", r"\1 megabytes", text, flags=re.I)
    text = re.sub(r"(\d+(?:\.\d+)?)\s*KB\b", r"\1 kilobytes", text, flags=re.I)
    text = re.sub(r"(\d+(?:\.\d+)?)\s*GHz\b", r"\1 gigahertz", text, flags=re.I)
    text = re.sub(r"(\d+(?:\.\d+)?)\s*ms\b", r"\1 milliseconds", text, flags=re.I)

    # 8. Phonetic expansion for common tech acronyms
    text = re.sub(r"\bTTS\b", "T T S", text)
    text = re.sub(r"\bLLMs?\b", "L L M", text)
    text = re.sub(r"\bVRAM\b", "V RAM", text)
    text = re.sub(r"\bAPIs?\b", "A P I", text)
    text = re.sub(r"\bCLI\b", "C L I", text)
    text = re.sub(r"\bSDK\b", "S D K", text)
    text = re.sub(r"\bSTT\b", "S T T", text)
    text = re.sub(r"\bVAD\b", "V A D", text)

    # 9. Natural file extension pronunciation
    text = re.sub(r"\.py\b", " dot pie", text)
    text = re.sub(r"\.jsonl\b", " dot json lines", text)
    text = re.sub(r"\.json\b", " dot json", text)
    text = re.sub(r"\.md\b", " markdown file", text)
    text = re.sub(r"\.txt\b", " text file", text)
    text = re.sub(r"\.env\b", " dot env file", text)
    text = re.sub(r"\.exe\b", " executable", text)

    # 10. Replace underscores in identifiers/filenames with spaces
    text = text.replace("_", " ")

    # 11. Convert UI symbols and arrows into words
    text = text.replace("▶", " play button ")
    text = text.replace("◀", " left arrow ")
    text = text.replace("▼", " down arrow ")
    text = text.replace("▲", " up arrow ")

    # 12. Structure lists and colons for natural breathing pauses
    # Numbered points with colons: "1. Point Title:" -> "Point 1: Point Title."
    text = re.sub(r"^(\s*)(\d+)\.\s+([^:\n]+):", r"\1Point \2: \3.", text, flags=re.MULTILINE)
    # Bullet points with colons: "- Point Title:" -> "- Point Title."
    text = re.sub(r"^(\s*[-*•]\s+[^:\n]+):", r"\1.", text, flags=re.MULTILINE)
    # Colons at the end of headings/lines -> period to force full sentence pause
    text = re.sub(r":\s*(?=\n|$)", ".\n", text)
    # Mid-sentence colons before capitalized phrases -> comma pause
    text = re.sub(r":(?=\s+[A-Z0-9])", ", ", text)

    # 13. Clean table markdown formatting
    lines = []
    for line in text.splitlines():
        trimmed = line.strip()
        if trimmed.startswith("|") and trimmed.endswith("|"):
            if set(trimmed.replace("|", "").strip()) <= {"-", ":"}:
                continue
            cells = [c.strip() for c in trimmed.strip("|").split("|") if c.strip()]
            if len(cells) >= 2:
                lines.append(f"{cells[0]}: {', '.join(cells[1:])}")
            elif cells:
                lines.append(cells[0])
        elif trimmed.startswith(">"):
            lines.append(trimmed.lstrip(">").strip())
        else:
            # If a line looks like a title/heading without ending punctuation, add a period to pause
            if trimmed and not trimmed.endswith((".", "!", "?", ";", ",")) and len(trimmed) < 70:
                lines.append(line + ".")
            else:
                lines.append(line)
    text = "\n".join(lines)

    # 14. Natural human breathing and rhythm enhancements
    # Convert parentheticals (like this) to em-dashes for natural conversational aside inflection
    text = re.sub(r"\s*\(([^)]+)\)\s*", r" — \1 — ", text)

    # Micro-pause after transition phrases if missing
    transitions = [
        "First", "Second", "Third", "Finally", "Additionally", "In addition",
        "Furthermore", "Moreover", "However", "On the other hand", "For example",
        "For instance", "In fact", "Actually", "Basically", "Specifically",
        "To do this", "As you can see", "Notice that", "Keep in mind"
    ]
    for tr in transitions:
        text = re.sub(rf"(^|[.!?\n]\s*)({tr})\s+([A-Za-z])", r"\1\2, \3", text, flags=re.IGNORECASE)

    # Micro-pause before contrasting conjunctions in compound sentences
    text = re.sub(r"(?<=[a-z]{3})\s+(but|although|whereas)\s+", r", \1 ", text, flags=re.IGNORECASE)

    # 15. Clean markdown symbols
    text = re.sub(r"[*`#~>|]", " ", text)
    text = re.sub(r"\s*—\s*", ", ", text)
    text = re.sub(r",\s*,", ", ", text)
    text = re.sub(r"\.\s*,", ". ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def inject_breathing_pauses(text: str) -> str:
    """Injects natural human breathing pauses using prosodic punctuation (ellipses & commas).
    Strictly avoids SSML/XML tags so the TTS engine never speaks tags or milliseconds aloud.
    """
    # 1. Strip any HTML/XML tags (<break...>, <span>, etc.) so they are never read aloud
    text = re.sub(r"<[^>]+>", " ", text)

    # 2. Numbered points: "Point 1: Title." -> "Point 1: Title... " (natural breath intake)
    text = re.sub(r"\b(Point \d+:[^.]+?\.)\s*", r'\1... ', text)

    # 3. Transitions at sentence start -> comma pause
    transitions = [
        "First", "Second", "Third", "Finally", "Additionally", "In addition",
        "Furthermore", "Moreover", "However", "On the other hand", "For example",
        "For instance", "In fact", "Actually", "Basically", "Specifically",
        "To do this", "As you can see", "Notice that", "Keep in mind", "Apparently"
    ]
    for tr in transitions:
        text = re.sub(rf"(^|[.!?]\s+)({tr}),?\s+", r'\1\2, ', text, flags=re.IGNORECASE)

    # 4. Contrasting & causal conjunctions in compound sentences
    text = re.sub(r",?\s*(but|although|whereas|however)\s+", r', \1 ', text, flags=re.IGNORECASE)
    text = re.sub(r",?\s*(because|so that)\s+", r', \1 ', text, flags=re.IGNORECASE)

    # 5. Clean punctuation duplicates
    text = re.sub(r",\s*,+", ", ", text)
    text = re.sub(r"\.{4,}", "... ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def split_into_chunks(text: str) -> list[str]:
    """Progressive chunking strategy:
    - Layer 1 (Chunk 1): Exactly 1 sentence (~1s initial latency)
    - Layer 2 (Chunk 2): Exactly 2 sentences (seamless audio continuity)
    - Layer 3 (Chunk 3): Exactly 5 sentences (extended buffer with cohesive prosody)
    - Layer 4 (Chunk 4): The entire remaining text (full natural cadence)
    """
    cleaned = clean_markdown_for_speech(text)
    if not cleaned:
        return []

    # Split into sentences
    sentences = [
        s.strip()
        for s in re.split(r"(?<=[.!?])\s+|\n+", cleaned)
        if s.strip() and not s.strip().startswith("---")
    ]
    if not sentences:
        return []

    n = len(sentences)
    if n <= 1:
        return [sentences[0]]
    elif n <= 2:
        return [sentences[0], sentences[1]]
    elif n <= 3:
        return [sentences[0], " ".join(sentences[1:])]
    elif n <= 8:
        return [sentences[0], " ".join(sentences[1:3]), " ".join(sentences[3:])]
    else:
        chunk1 = sentences[0]
        chunk2 = " ".join(sentences[1:3])
        chunk3 = " ".join(sentences[3:8])
        remaining = sentences[8:]
        rem_text = " ".join(remaining)

        if len(rem_text) <= 1500:
            return [chunk1, chunk2, chunk3, rem_text]
        else:
            blocks = []
            cur = []
            cur_len = 0
            for s in remaining:
                if cur_len + len(s) > 1000 and cur:
                    blocks.append(" ".join(cur))
                    cur = [s]
                    cur_len = len(s)
                else:
                    cur.append(s)
                    cur_len += len(s)
            if cur:
                blocks.append(" ".join(cur))
            return [chunk1, chunk2, chunk3] + blocks

# Communication Queues
speech_queue = asyncio.Queue()
audio_queue = asyncio.Queue(maxsize=6)

def clear_queues_and_stop_playback():
    """Clears pending text and audio queues and immediately stops audio."""
    if pygame.mixer.get_init():
        try:
            pygame.mixer.music.stop()
            pygame.mixer.music.unload()
        except Exception:
            pass
    while not speech_queue.empty():
        try:
            speech_queue.get_nowait()
            speech_queue.task_done()
        except Exception:
            pass
    while not audio_queue.empty():
        try:
            path, _ = audio_queue.get_nowait()
            if os.path.exists(path):
                os.remove(path)
            audio_queue.task_done()
        except Exception:
            pass

async def check_commands(current_transcript):
    """Checks for runtime commands written by the IDE extension."""
    global last_command_ts
    if not COMMAND_PATH.exists():
        return
    try:
        with open(COMMAND_PATH, "r", encoding="utf-8") as f:
            cmd_data = json.load(f)
        ts = cmd_data.get("timestamp", 0)
        if ts > last_command_ts:
            last_command_ts = ts
            action = cmd_data.get("action")
            if action == "stop":
                clear_queues_and_stop_playback()
                print("\n[Command]: Playback stopped.", flush=True)
            elif action == "replay":
                clear_queues_and_stop_playback()
                print("\n[Command]: Replaying last response...", flush=True)
                last_content = find_last_response_content(current_transcript)
                if last_content:
                    chunks = split_into_chunks(last_content)
                    for ch in chunks:
                        await speech_queue.put(ch)
            elif action == "preview":
                clear_queues_and_stop_playback()
                preview_voice = cmd_data.get("voice", current_voice)
                preview_file = PREVIEWS_DIR / f"{preview_voice}.mp3"
                if preview_file.exists():
                    print(f"\n[Instant Preview]: Playing pre-cached sample for {preview_voice}...", flush=True)
                    await audio_queue.put((str(preview_file), f"[Companion Preview]: {preview_voice}"))
                else:
                    short_name = preview_voice.split("-")[2].replace("Neural", "").replace("Multilingual", "")
                    preview_text = f"Hi, I am {short_name}! Select me if you like my voice."
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
                        temp_path = temp_file.name
                    communicate = edge_tts.Communicate(preview_text, preview_voice, rate=current_speed)
                    await communicate.save(temp_path)
                    await audio_queue.put((temp_path, f"[Companion Preview]: {preview_voice}"))
    except Exception as e:
        print(f"Error handling command: {e}", flush=True)

async def synthesize_worker():
    """Synthesizes queued text chunks in the background using edge-tts."""
    while True:
        try:
            text_chunk = await speech_queue.get()
            load_config()
            if not is_enabled or not text_chunk.strip():
                speech_queue.task_done()
                continue

            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
                temp_path = temp_file.name

            text_with_pauses = inject_breathing_pauses(text_chunk)
            communicate = edge_tts.Communicate(text_with_pauses, current_voice, rate=current_speed)
            await communicate.save(temp_path)

            safe_preview = text_chunk[:70].encode("ascii", errors="replace").decode("ascii")
            await audio_queue.put((temp_path, f"[Speaking]: {safe_preview}..."))
            speech_queue.task_done()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Synthesis error: {e}", flush=True)

async def playback_worker():
    """Plays audio chunks smoothly one after another."""
    ensure_mixer_init()
    while True:
        try:
            temp_path, preview = await audio_queue.get()
            print(f"\n{preview}", flush=True)

            try:
                pygame.mixer.music.load(temp_path)
                pygame.mixer.music.set_volume(max(0.0, min(1.0, current_volume / 100.0)))
                pygame.mixer.music.play()
                while pygame.mixer.music.get_busy():
                    await asyncio.sleep(0.05)
                # Human breathing gap between successive chunks
                await asyncio.sleep(0.35)
            except Exception as e:
                print(f"Playback error: {e}", flush=True)
            finally:
                try:
                    if pygame.mixer.get_init():
                        pygame.mixer.music.unload()
                except Exception:
                    pass
                try:
                    # Never delete pre-cached preview audio files!
                    if os.path.exists(temp_path) and not str(temp_path).startswith(str(PREVIEWS_DIR)):
                        os.remove(temp_path)
                except Exception:
                    pass
                audio_queue.task_done()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Playback worker error: {e}", flush=True)

async def monitor_transcript():
    """Monitors transcript and pushes responses to speech queue."""
    load_config()
    print("=" * 60)
    print("  Antigravity Voice Companion (Worker Process)")
    print(f"  Voice: {current_voice} | Speed: {current_speed}")
    print("  Progressive Schedule: 1 -> 2 -> 5 -> remaining sentences")
    print("=" * 60, flush=True)

    current_transcript = get_latest_conversation_dir()
    if not current_transcript:
        while not current_transcript:
            await asyncio.sleep(1)
            current_transcript = get_latest_conversation_dir()

    processed_steps = set()
    with open(current_transcript, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            try:
                data = json.loads(line)
                step_idx = data.get("step_index")
                if (
                    data.get("type") == "PLANNER_RESPONSE"
                    and not data.get("tool_calls")
                    and step_idx is not None
                ):
                    processed_steps.add(step_idx)
            except Exception:
                pass

    print("Worker synchronized. Ready!", flush=True)

    synth_task = asyncio.create_task(synthesize_worker())
    play_task = asyncio.create_task(playback_worker())

    try:
        while True:
            load_config()
            latest_transcript = get_latest_conversation_dir()
            if latest_transcript and latest_transcript != current_transcript:
                current_transcript = latest_transcript
                processed_steps.clear()
                print(f"\nSwitched to conversation: {current_transcript.parent.parent.name}\n", flush=True)

            # Check for runtime commands (replay / stop)
            await check_commands(current_transcript)

            try:
                with open(current_transcript, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        try:
                            data = json.loads(line)
                            step_idx = data.get("step_index")
                            if step_idx is None:
                                continue

                            if (
                                data.get("type") == "PLANNER_RESPONSE"
                                and not data.get("tool_calls")
                                and step_idx not in processed_steps
                            ):
                                processed_steps.add(step_idx)
                                content = data.get("content", "")
                                if content.strip() and is_enabled:
                                    chunks = split_into_chunks(content)
                                    for ch in chunks:
                                        await speech_queue.put(ch)
                        except Exception:
                            pass
            except Exception as e:
                print(f"Error reading transcript: {e}", flush=True)

            await asyncio.sleep(0.4)
    finally:
        synth_task.cancel()
        play_task.cancel()

if __name__ == "__main__":
    try:
        asyncio.run(monitor_transcript())
    except KeyboardInterrupt:
        print("\nWorker stopped.", flush=True)
