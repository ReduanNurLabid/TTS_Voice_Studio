"""
Antigravity Live Voice Companion
Reads Antigravity IDE assistant responses aloud with natural speaking cadence.
Uses progressive chunking (1 sentence -> 2 sentences -> remaining text) for
zero-latency immediate start and cohesive speech intonation.
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

BRAIN_DIR = Path(r"C:\Users\Reduan\.gemini\antigravity-ide\brain")

# Natural neural English voice
VOICE_MAIN = "en-US-AndrewMultilingualNeural"  # Or "en-US-JennyNeural", "en-US-AvaMultilingualNeural"

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

    # 11. Clean table markdown formatting
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
            lines.append(line)
    text = "\n".join(lines)

    # 12. Clean markdown symbols
    text = re.sub(r"[*`#~>|]", " ", text)
    text = re.sub(r"\s*—\s*", ", ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def split_into_chunks(text: str) -> list[str]:
    """Progressive chunking strategy:
    - Chunk 1: Exactly 1 sentence (starts playing immediately with ~1s latency).
    - Chunk 2: Exactly 2 sentences (keeps playback continuous while remaining text compiles).
    - Chunk 3: The entire remaining response (preserves natural cross-sentence prosody and flow).
    """
    cleaned = clean_markdown_for_speech(text)
    if not cleaned:
        return []

    # Split into clean sentences
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
    elif n == 3:
        return [sentences[0], " ".join(sentences[1:])]
    else:
        chunk1 = sentences[0]
        chunk2 = " ".join(sentences[1:3])
        remaining = sentences[3:]
        rem_text = " ".join(remaining)

        # If remaining text is exceptionally large (>1500 chars), split into large paragraphs
        if len(rem_text) <= 1500:
            return [chunk1, chunk2, rem_text]
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
            return [chunk1, chunk2] + blocks

# Communication Queues
speech_queue = asyncio.Queue()
audio_queue = asyncio.Queue(maxsize=5)

async def synthesize_worker():
    """Generates audio for queued text chunks in background."""
    while True:
        try:
            text_chunk = await speech_queue.get()
            if not text_chunk.strip():
                speech_queue.task_done()
                continue

            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
                temp_path = temp_file.name

            communicate = edge_tts.Communicate(text_chunk, VOICE_MAIN)
            await communicate.save(temp_path)

            await audio_queue.put((temp_path, f"[Speaking]: {text_chunk[:80]}..."))
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
                pygame.mixer.music.play()
                while pygame.mixer.music.get_busy():
                    await asyncio.sleep(0.05)
            except Exception as e:
                print(f"Playback error: {e}", flush=True)
            finally:
                try:
                    if pygame.mixer.get_init():
                        pygame.mixer.music.unload()
                except Exception:
                    pass
                try:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
                except Exception:
                    pass
                audio_queue.task_done()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Worker error: {e}", flush=True)

async def monitor_transcript():
    """Monitors the active Antigravity conversation transcript and speaks responses."""
    print("=" * 60)
    print("  Antigravity Live Voice Companion")
    print("  - Progressive streaming playback (fast start, coherent speech)")
    print("  - Press Ctrl+C in terminal to stop.")
    print("=" * 60, flush=True)

    current_transcript = get_latest_conversation_dir()
    if not current_transcript:
        print("Waiting for an active Antigravity conversation...", flush=True)
        while not current_transcript:
            await asyncio.sleep(1)
            current_transcript = get_latest_conversation_dir()

    print(f"Active Conversation: {current_transcript.parent.parent.name}\n", flush=True)

    # Initial sync
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

    print("Synced! Listening for responses...\n", flush=True)

    # Launch background synthesize & playback workers
    synth_task = asyncio.create_task(synthesize_worker())
    play_task = asyncio.create_task(playback_worker())

    try:
        while True:
            # Check for newer conversation sessions
            latest_transcript = get_latest_conversation_dir()
            if latest_transcript and latest_transcript != current_transcript:
                current_transcript = latest_transcript
                processed_steps.clear()
                print(f"\nSwitched to conversation: {current_transcript.parent.parent.name}\n", flush=True)

            try:
                with open(current_transcript, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        try:
                            data = json.loads(line)
                            step_idx = data.get("step_index")
                            if step_idx is None:
                                continue

                            # Check for final assistant response
                            if (
                                data.get("type") == "PLANNER_RESPONSE"
                                and not data.get("tool_calls")
                                and step_idx not in processed_steps
                            ):
                                processed_steps.add(step_idx)
                                content = data.get("content", "")
                                if content.strip():
                                    chunks = split_into_chunks(content)
                                    for ch in chunks:
                                        await speech_queue.put(ch)
                        except Exception:
                            pass
            except Exception as e:
                print(f"Error reading transcript: {e}", flush=True)

            await asyncio.sleep(0.5)
    finally:
        synth_task.cancel()
        play_task.cancel()

if __name__ == "__main__":
    try:
        asyncio.run(monitor_transcript())
    except KeyboardInterrupt:
        print("\nVoice companion stopped.", flush=True)
