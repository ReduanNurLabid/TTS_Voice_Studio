import zipfile
import json
from pathlib import Path

ext_dir = Path(r"C:\Users\Reduan\Downloads\TTS\antigravity-voice")
pkg_json_path = ext_dir / "package.json"
with open(pkg_json_path, "r", encoding="utf-8") as f:
    pkg = json.load(f)

vsix_path = ext_dir.parent / f"{pkg['name']}-{pkg['version']}.vsix"

content_types_xml = """<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="vsixmanifest" ContentType="text/xml"/>
  <Default Extension="json" ContentType="application/json"/>
  <Default Extension="js" ContentType="application/javascript"/>
  <Default Extension="py" ContentType="text/plain"/>
  <Default Extension="md" ContentType="text/markdown"/>
</Types>"""

vsix_manifest_xml = f"""<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Id="{pkg['name']}" Version="{pkg['version']}" Publisher="{pkg['publisher']}"/>
    <DisplayName>{pkg['displayName']}</DisplayName>
    <Description>{pkg['description']}</Description>
    <Categories>Accessibility,Other</Categories>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
  </Assets>
</PackageManifest>"""

with zipfile.ZipFile(vsix_path, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types_xml)
    z.writestr("extension.vsixmanifest", vsix_manifest_xml)
    
    # Add files from ext_dir into extension/
    for file_path in ext_dir.rglob("*"):
        if file_path.is_file() and not file_path.name.endswith(".vsix"):
            arcname = "extension/" + file_path.relative_to(ext_dir).as_posix()
            z.write(file_path, arcname)

print(f"SUCCESS: Created {vsix_path}")
