with open('Web/AppUI/app.js', encoding='utf-8') as f:
    lines = f.readlines()

out = []
skip_block = False
i = 0
while i < len(lines):
    line = lines[i]
    stripped = line.strip()

    # Remove the two function definitions (multi-line blocks)
    if stripped.startswith('function _showWalkBanner()') or stripped.startswith('function _hideWalkBanner('):
        # Skip until closing }
        depth = 0
        while i < len(lines):
            for ch in lines[i]:
                if ch == '{': depth += 1
                elif ch == '}': depth -= 1
            i += 1
            if depth == 0 and ('{' in lines[i-1] or depth < 0):
                break
        continue

    # Remove standalone call lines
    if stripped in ('_showWalkBanner();', '_hideWalkBanner(true);', '_hideWalkBanner(false);'):
        i += 1
        continue

    out.append(line)
    i += 1

with open('Web/AppUI/app.js', 'w', encoding='utf-8') as f:
    f.writelines(out)
print(f'Done. Lines: {len(lines)} -> {len(out)} (removed {len(lines)-len(out)})')
