import json, os

def ring_area(ring):
    a = 0
    for i in range(len(ring)):
        x1, y1 = ring[i]; x2, y2 = ring[(i+1) % len(ring)]
        a += x1*y2 - x2*y1
    return abs(a) / 2

def feat_area(f):
    sa = (f.get('properties') or {}).get('shape_Area')
    if sa: return float(sa)
    g = f.get('geometry') or {}
    t = g.get('type', '')
    if t == 'Polygon':
        return ring_area(g['coordinates'][0])
    if t == 'MultiPolygon':
        return sum(ring_area(p[0]) for p in g['coordinates'])
    return 0

def centroid(f):
    g = f.get('geometry') or {}
    t = g.get('type', '')
    if t == 'Polygon':
        ring = g['coordinates'][0]
    elif t == 'MultiPolygon':
        rings = [p[0] for p in g['coordinates']]
        ring = max(rings, key=ring_area)
    else:
        return None
    if not ring:
        return None
    return [round(sum(c[0] for c in ring)/len(ring), 6),
            round(sum(c[1] for c in ring)/len(ring), 6)]

print('Loading Parks.geojson ...')
base = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(base, 'GreenZone', 'Parks.geojson'), encoding='utf-8') as fh:
    data = json.load(fh)

MIN_AREA = 5e-7   # ~0.4 ha at Prague latitude
out_feats = []
for f in data['features']:
    a = feat_area(f)
    if a < MIN_AREA:
        continue
    c = centroid(f)
    if not c:
        continue
    ha = round(a * 7.95e9 / 10000, 2)
    raw_name = (f.get('properties') or {}).get('name')
    name = raw_name if raw_name else f'Zelená plocha ({ha}\u00a0ha)'
    out_feats.append({
        'type': 'Feature',
        'geometry': {'type': 'Point', 'coordinates': c},
        'properties': {'name': name, 'area_ha': ha, 'shape_Area': a}
    })

out_feats.sort(key=lambda x: x['properties']['shape_Area'], reverse=True)
out = {'type': 'FeatureCollection', 'features': out_feats}

out_path = os.path.join(base, 'Web', 'parks_sos.geojson')
with open(out_path, 'w', encoding='utf-8') as fh:
    json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))

size_kb = os.path.getsize(out_path) // 1024
print(f'Written {len(out_feats)} parks -> Web/parks_sos.geojson ({size_kb} KB)')
for f in out_feats[:5]:
    p = f['properties']
    print(f"  {p['area_ha']:.2f} ha  [{f['geometry']['coordinates']}]  {p['name']}")
