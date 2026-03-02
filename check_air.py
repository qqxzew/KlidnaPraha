import json, os

base = r'C:\Users\fandr\Desktop\Tichá Praha'

for lvl in [1, 2, 3, 4, 5]:
    src = os.path.join(base, 'Air', 'Vzduch', f'air_level_{lvl}.geojson')
    dst = os.path.join(base, 'Grapphopper', 'custom_areas', f'air_level_{lvl}.geojson')

    if not os.path.exists(src):
        print(f'air_level_{lvl}: SOURCE MISSING')
        continue

    with open(src, encoding='utf-8') as f:
        data = json.load(f)

    feats = data.get('features', [])
    expected_id = f'air_level_{lvl}'

    # If multiple features, merge into one MultiPolygon like noise files
    if len(feats) > 1:
        all_polys = []
        for feat in feats:
            g = feat['geometry']
            if g['type'] == 'Polygon':
                all_polys.append(g['coordinates'])
            elif g['type'] == 'MultiPolygon':
                all_polys.extend(g['coordinates'])
        data = {
            'type': 'FeatureCollection',
            'features': [{
                'type': 'Feature',
                'id': expected_id,
                'properties': {},
                'geometry': {'type': 'MultiPolygon', 'coordinates': all_polys}
            }]
        }
        print(f'air_level_{lvl}: merged {len(feats)} features -> 1 MultiPolygon')
    else:
        feat = feats[0]
        if feat.get('id') != expected_id:
            feat['id'] = expected_id
            print(f'air_level_{lvl}: fixed id')
        else:
            print(f'air_level_{lvl}: OK')

    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'))
    print(f'  -> written to custom_areas/air_level_{lvl}.geojson')
