import json
import os

def format_db(val):
    if val is None or str(val).strip() == '':
        return None
    try:
        f_val = float(val)
        if f_val.is_integer():
            return str(int(f_val))
        return str(f_val)
    except ValueError:
        return str(val).strip()

def process_geojson(input_file, output_folder):
    os.makedirs(output_folder, exist_ok=True)
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    features_by_range = {}
    for feature in data.get('features', []):
        props = feature.get('properties', {})
        
        db_lo = props.get('db_lo')
        db_hi = props.get('db_hi')
        
        db_lo_str = format_db(db_lo) or "unknown"
        db_hi_str = format_db(db_hi)
        
        if db_hi_str is None:
            key = f"{db_lo_str}_plus"
        else:
            key = f"{db_lo_str}_{db_hi_str}"
            
        if key not in features_by_range:
            features_by_range[key] = []
        features_by_range[key].append(feature)
        
    for key, features in features_by_range.items():
        out_path = os.path.join(output_folder, f"noise_{key}.geojson")
        out_data = {
            "type": "FeatureCollection",
            "features": features
        }
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(out_data, f)

process_geojson('HlukDen.geojson', 'HlukDen')
process_geojson('HlukNoc.geojson', 'HlukNoc')
