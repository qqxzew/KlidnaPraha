import json, os, glob

# ── Путь относительно этого файла ─────────────────────────────────────────
_HERE            = os.path.dirname(os.path.abspath(__file__))
_CUSTOM_AREAS    = os.path.join(_HERE, 'custom_areas')


def run():
    """Проверяет и дополняет id у всех фич в Grapphopper/custom_areas/."""
    geojson_files = glob.glob(os.path.join(_CUSTOM_AREAS, '*.geojson'))

    for filepath in sorted(geojson_files):
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        filename_base = os.path.splitext(os.path.basename(filepath))[0]
        changed = 0

        for i, feature in enumerate(data.get('features', [])):
            if feature.get('id') is None or feature.get('id') == '':
                feature['id'] = f'{filename_base}_{i}'
                changed += 1

        if changed > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, separators=(',', ':'))
            print(f'{os.path.basename(filepath)}: fixed {changed} features')
        else:
            print(f'{os.path.basename(filepath)}: OK (no changes needed)')

    print('fix_ids: Done.')


if __name__ == '__main__':
    run()
