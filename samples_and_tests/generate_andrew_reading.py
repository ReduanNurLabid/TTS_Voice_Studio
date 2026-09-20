import asyncio
import edge_tts
import re
import os

def unescape_breaks(b_data: bytes) -> bytes:
    pattern = rb'&lt;break time=&quot;([0-9]+m?s)&quot;\s*/?&gt;'
    def repl(m):
        return b'<break time="' + m.group(1) + b'" />'
    return re.sub(pattern, repl, b_data)

def clean_and_inject_pauses(text: str) -> str:
    text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)
    text = re.sub(r"https?://\S+", "", text)
    text = text.replace(";", ", ")
    text = re.sub(r"\s*\(([^)]+)\)\s*", r', <break time="250ms" /> \1, <break time="200ms" /> ', text)
    transitions = ["During", "When", "There are", "Apparently", "However", "In fact", "Actually"]
    for tr in transitions:
        text = re.sub(rf"(^|[.!?\n]\s*)({tr}),?\s+", rf'\1\2, <break time="220ms" /> ', text, flags=re.IGNORECASE)
    text = re.sub(r",\s*(but|because|although)\s+", r', <break time="220ms" /> \1 ', text, flags=re.IGNORECASE)
    text = re.sub(r"[*`#~|]", " ", text)
    text = re.sub(r",\s*,", ", ", text)
    text = re.sub(r"\.\s*,", ". ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

async def main():
    book_text = """
I consider myself an observant. I often spend time being quiet, just staring and watching my surroundings, from the main situation to things that most people don’t notice, like that single fly who broke its wings and is currently struggling to turn its body over; like the dust piling in the corner of my bus’ automatic door.
During my bus ride home, I usually listen to some music from my Spotify (give it a follow if you want to) and just stare out the window, watching the city at night, admiring all its mesmerizing skyscrapers and the dim street lights.
It’s beautiful.
It made me realize that I have so many little things to be grateful for.
When I graduated, I had a dream of working in the middle of this busy city because I want to be able to experience Jakarta at night. Here I am.
I dreamed of working in a tall building so I can watch the streets from above. I didn’t get the experience at my previous office, but here I am now on the 18th floor (not that high, but still, I’m blessed.)
I dreamed of working in a well-known company. It didn’t come true during my first year of work, but here I am now.
I dreamed of going on a leisure trip with my friends, now I have gone to 2 different cities with them.
There are still so many other dreams that came true. More and more are coming true as time goes by. I cannot be more thankful.
Apparently life is not as boring if we appreciate the smallest things.
"""
    cleaned = clean_and_inject_pauses(book_text)
    voice = "en-US-AndrewNeural"
    output_file = r"c:\Users\Reduan\Downloads\TTS\book_reading_andrew.mp3"
    communicate = edge_tts.Communicate(cleaned, voice, rate="-4%")
    communicate.texts = [unescape_breaks(t) for t in communicate.texts]
    await communicate.save(output_file)
    print(f"Andrew reading saved to: {output_file}")

if __name__ == "__main__":
    asyncio.run(main())
