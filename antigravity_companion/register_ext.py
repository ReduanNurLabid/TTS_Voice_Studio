import json
import time
from pathlib import Path

ext_path = Path(r"C:\Users\Reduan\.antigravity\extensions\extensions.json")
with open(ext_path, "r", encoding="utf-8") as f:
    extensions = json.load(f)

# Filter out any older entry
extensions = [e for e in extensions if e.get("identifier", {}).get("id") != "reduan.antigravity-voice"]

entry = {
    "identifier": { "id": "reduan.antigravity-voice" },
    "version": "1.0.0",
    "location": {
        "$mid": 1,
        "path": "/c:/Users/Reduan/.antigravity/extensions/reduan.antigravity-voice-1.0.0-universal",
        "scheme": "file"
    },
    "relativeLocation": "reduan.antigravity-voice-1.0.0-universal",
    "metadata": {
        "isApplicationScoped": False,
        "isMachineScoped": False,
        "isBuiltin": False,
        "installedTimestamp": int(time.time() * 1000),
        "pinned": False
    }
}
extensions.append(entry)
with open(ext_path, "w", encoding="utf-8") as f:
    json.dump(extensions, f, indent=2)
print("SUCCESS: Updated extensions.json with -universal entry")
