import json, os

# ── Пути относительно этого файла ──────────────────────────────────────────
_HERE        = os.path.dirname(os.path.abspath(__file__))
_VZDUCH_DIR  = os.path.join(_HERE, 'Vzduch')
_CUSTOM_AREAS = os.path.normpath(os.path.join(_HERE, '..', 'Grapphopper', 'custom_areas'))


def run():
    """
    Читает Air/Vzduch/air_level_N.geojson (сырые полигоны от main.py),
    мержит в один MultiPolygon с правильным id,
    записывает в Grapphopper/custom_areas/air_level_N.geojson.
    """
    os.makedirs(_CUSTOM_AREAS, exist_ok=True)

    for lvl in range(1, 7):   # уровни 1–6
        src = os.path.join(_VZDUCH_DIR, f'air_level_{lvl}.geojson')
        dst = os.path.join(_CUSTOM_AREAS, f'air_level_{lvl}.geojson')
        expected_id = f'air_level_{lvl}'

        if not os.path.exists(src):
            if os.path.exists(dst):
                os.remove(dst)
                print(f'air_level_{lvl}: нет источника, устаревший custom_areas удалён')
            else:
                print(f'air_level_{lvl}: SOURCE MISSING, пропуск')
            continue

        with open(src, encoding='utf-8') as f:
            data = json.load(f)

        feats = data.get('features', [])

        if not feats:
            if os.path.exists(dst):
                os.remove(dst)
                print(f'air_level_{lvl}: пусто, устаревший custom_areas удалён')
            else:
                print(f'air_level_{lvl}: пусто, нечего делать')
            continue

        if len(feats) > 1:
            # Мержим все полигоны в один MultiPolygon
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
                    'properties': {'id': expected_id},
                    'geometry': {'type': 'MultiPolygon', 'coordinates': all_polys}
                }]
            }
            print(f'air_level_{lvl}: смержено {len(feats)} фич -> 1 MultiPolygon')
        else:
            feat = feats[0]
            changed = False
            if feat.get('id') != expected_id:
                feat['id'] = expected_id
                changed = True
            feat.setdefault('properties', {})
            if feat['properties'].get('id') != expected_id:
                feat['properties']['id'] = expected_id
                changed = True
            print(f'air_level_{lvl}: {"исправлен id" if changed else "OK"}')

        with open(dst, 'w', encoding='utf-8') as f:
            json.dump(data, f, separators=(',', ':'))
        print(f'  -> записано в custom_areas/air_level_{lvl}.geojson')


if __name__ == '__main__':
    run()
