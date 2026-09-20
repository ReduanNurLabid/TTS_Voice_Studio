import asyncio
import edge_tts
import re
import os

book_text = """
I consider myself an observant. I often spend time being quiet... just staring and watching my surroundings... from the main situation to things that most people don’t notice, like that single fly who broke its wings and is currently struggling to turn its body over; like the dust piling in the corner of my bus’ automatic door.

During my bus ride home, I usually listen to some music from Spotify — give it a follow if you want to — and just stare out the window... watching the city at night, admiring all its mesmerizing skyscrapers and the dim street lights.

It’s beautiful.
It made me realize that I have so many little things to be grateful for.

When I graduated, I had a dream of working in the middle of this busy city, because I want to be able to experience Jakarta at night. Here I am.

I dreamed of working in a tall building, so I can watch the streets from above. I didn’t get the experience at my previous office, but here I am now on the 18th floor — not that high, but still, I’m blessed.

I dreamed of working in a well-known company. It didn’t come true during my first year of work, but here I am now.
I dreamed of going on a leisure trip with my friends... now I have gone to 2 different cities with them.

There are still so many other dreams that came true. More and more are coming true as time goes by. I cannot be more thankful.

Apparently... life is not as boring if we appreciate the smallest things.
"""

async def generate():
    clean_text = book_text.strip()
    
    # Emma
    c_emma = edge_tts.Communicate(clean_text, "en-US-EmmaNeural", rate="-4%")
    await c_emma.save(r"c:\Users\Reduan\Downloads\TTS\book_reading_emma.mp3")
    print("Emma clean book reading generated!")
    
    # Andrew
    c_andrew = edge_tts.Communicate(clean_text, "en-US-AndrewNeural", rate="-4%")
    await c_andrew.save(r"c:\Users\Reduan\Downloads\TTS\book_reading_andrew.mp3")
    print("Andrew clean book reading generated!")

if __name__ == "__main__":
    asyncio.run(generate())
