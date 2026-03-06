with open('Web/AppUI/app.js', encoding='utf-8') as f:
    src = f.read()

start_marker = '\n// ── Walk check banner ──\n'
end_marker = '\ndocument.getElementById(\'walkGenStartBtn\')'

start_idx = src.find(start_marker)
end_idx = src.find(end_marker, start_idx)

if start_idx == -1 or end_idx == -1:
    print(f"Markers not found! start={start_idx}, end={end_idx}")
else:
    print(f"Removing chars {start_idx} to {end_idx} ({end_idx-start_idx} chars)")
    src = src[:start_idx] + '\n' + src[end_idx:]
    with open('Web/AppUI/app.js', 'w', encoding='utf-8') as f:
        f.write(src)
    print("Done.")
