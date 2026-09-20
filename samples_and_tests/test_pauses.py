import re

sample = """What Was Fixed:
1. Crisp, Clear Greeting:

Replaced the ambiguous opener with a clear, warm companion greeting:
"Hello! I am [Name], select me if you like my voice."

Every model clearly articulates its own name and identity with natural warmth.
2. Native US Neural Models Added:

Upgraded to the pure native US English neural models (en-US-AndrewNeural, en-US-AvaNeural, en-US-EmmaNeural, and en-US-AriaNeural).
They have zero cross-lingual accent confusion and produce crystal-clear American pronunciation.
3. Pre-Rendered & Instant:

All audio files are generated and stored locally in the extension folder. Clicking ▶ plays them with zero delay.
"""

def enhance_pauses(text):
    # 1. Convert colons at line ends or before newlines to periods for full pause
    text = re.sub(r':\s*(?=\n|$)', '.\n', text)
    # 2. Numbered list titles: '1. Title:' -> '1. Title.'
    text = re.sub(r'^(\s*\d+\.\s+[^:\n]+):', r'\1.', text, flags=re.MULTILINE)
    # 3. Bullet list titles: '- Title:' -> '- Title.'
    text = re.sub(r'^(\s*[-*•]\s+[^:\n]+):', r'\1.', text, flags=re.MULTILINE)
    # 4. If a line is a standalone heading/title with no punctuation at end, add a period
    lines = []
    for line in text.splitlines():
        trimmed = line.strip()
        if trimmed and not trimmed.endswith(('.', '!', '?', ';', ',')):
            lines.append(line + '.')
        else:
            lines.append(line)
    text = '\n'.join(lines)
    return text

print("--- TRANSFORMED ---")
print(enhance_pauses(sample))
