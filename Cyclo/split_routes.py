"""
split_routes.py  –  STEP 1 of 2
================================
Splits Cyclo/Cyclo.geojson into individual per-route GeoJSON files.

Input:   Cyclo/Cyclo.geojson
Output:  Cyclo/routes/<id>.geojson   (one file per unique route 'nazev')

Each output file is a FeatureCollection with a single Feature whose geometry
is a MultiLineString that merges all segments belonging to that route.

Run from anywhere:
    python Cyclo/split_routes.py
OR
    python build.py          (runs both steps in order)
"""

import json
import os
import re

HERE       = os.path.dirname(os.path.abspath(__file__))   # Cyclo/
INPUT_FILE = os.path.join(HERE, "Cyclo.geojson")
OUTPUT_DIR = os.path.join(HERE, "routes")


def safe_id(nazev: str) -> str:
    """'A 1' → 'A_1',  'A 100' → 'A_100', etc."""
    s = nazev.strip()
    s = re.sub(r"[^\w\s\-]", "", s)
    s = re.sub(r"\s+", "_", s)
    return s


def merge_segments(features: list) -> dict:
    """Merge all LineString / MultiLineString segments into one MultiLineString."""
    lines = []
    for feat in features:
        g = feat.get("geometry") or {}
        t = g.get("type", "")
        c = g.get("coordinates", [])
        if t == "LineString":
            lines.append(c)
        elif t == "MultiLineString":
            lines.extend(c)

    props = dict(features[0].get("properties") or {})
    props["total_segments"] = len(lines)
    return {
        "type": "Feature",
        "properties": props,
        "geometry": {"type": "MultiLineString", "coordinates": lines},
    }


def run():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"Reading {INPUT_FILE} …")
    with open(INPUT_FILE, encoding="utf-8") as fh:
        data = json.load(fh)

    features = data.get("features", [])
    print(f"  {len(features)} segments total")

    # Group by nazev
    groups: dict[str, list] = {}
    for feat in features:
        nazev = (feat.get("properties") or {}).get("nazev") or "unknown"
        groups.setdefault(nazev.strip(), []).append(feat)

    print(f"  {len(groups)} unique routes found")
    print(f"Writing to {OUTPUT_DIR} …")

    for nazev, feats in sorted(groups.items()):
        route_id = safe_id(nazev)
        merged   = merge_segments(feats)
        props    = merged["properties"]
        out_path = os.path.join(OUTPUT_DIR, route_id + ".geojson")

        fc = {
            "type": "FeatureCollection",
            "crs":  data.get("crs"),
            "features": [merged],
        }
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump(fc, fh, ensure_ascii=False)          # compact = smaller files

    print(f"Done. {len(groups)} files in {OUTPUT_DIR}")


if __name__ == "__main__":
    run()
