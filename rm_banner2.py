import re, sys

with open('Web/AppUI/app.js', encoding='utf-8') as f:
    src = f.read()

original_len = len(src)

# 1. Remove the whole "Walk check banner" section:
#    from the comment line through end of _hideWalkBanner function
pattern = r'\n// ── Walk check banner ──\nlet _walkBannerTimer = null;\nfunction _showWalkBanner\(\) \{[^}]*(?:\{[^}]*\}[^}]*)*\}\nfunction _hideWalkBanner\(success\) \{[^}]*(?:\{[^}]*\}[^}]*)*\}\n'
result = re.sub(pattern, '\n', src, flags=re.DOTALL)
if len(result) == len(src):
    print("WARNING: Banner section NOT removed via regex")
else:
    print(f"Banner section removed: {len(src)-len(result)} chars")
src = result

# 2. Remove call sites (simple line replacements)
call_sites = [
    '    _showWalkBanner();\n',
    '            _hideWalkBanner(true);\n',
    '        _hideWalkBanner(true);\n',
    '        _hideWalkBanner(false);\n',
    '    _hideWalkBanner(false);\n',
]
for cs in call_sites:
    count = src.count(cs)
    src = src.replace(cs, '', 1) if count >= 1 else src
    if count:
        print(f"Removed call site: {cs.strip()!r} ({count} found, removed first)")
    else:
        print(f"NOT FOUND: {cs.strip()!r}")

# 3. Remove _showWalkBanner() inside walkGenStartBtn handler (indented differently)
# line:  _showWalkBanner();  (4 spaces)
remaining_show = src.count('_showWalkBanner();')
remaining_hide = src.count('_hideWalkBanner(')
print(f"Remaining _showWalkBanner() refs: {remaining_show}")
print(f"Remaining _hideWalkBanner() refs: {remaining_hide}")
if remaining_show > 0:
    # Remove ALL remaining
    src = re.sub(r'[ \t]*_showWalkBanner\(\);[ \t]*\n', '', src)
    print(f"Removed all remaining _showWalkBanner() calls")
if remaining_hide > 0:
    src = re.sub(r'[ \t]*_hideWalkBanner\([^)]*\);[ \t]*\n', '', src)
    print(f"Removed all remaining _hideWalkBanner() calls")

# 4. Remove fitBounds in walk generator (NOT the other fitBounds uses)
# Context is unique: maxZoom: 16 (the other one has duration:700)
fitbounds_pattern = r'\n        const bounds = coords\.reduce\(\(b, c\) => b\.extend\(c\), new mapboxgl\.LngLatBounds\(coords\[0\], coords\[0\]\)\);\n        map\.fitBounds\(bounds, \{ padding: 80, maxZoom: 16 \}\);'
count = len(re.findall(fitbounds_pattern, src))
print(f"fitBounds pattern found: {count} time(s)")
result = re.sub(fitbounds_pattern, '', src)
if len(result) == len(src):
    print("WARNING: fitBounds NOT removed")
else:
    print(f"fitBounds removed: {len(src)-len(result)} chars")
src = result

with open('Web/AppUI/app.js', 'w', encoding='utf-8') as f:
    f.write(src)

print(f"\nDone. Chars: {original_len} -> {len(src)} (removed {original_len-len(src)})")
