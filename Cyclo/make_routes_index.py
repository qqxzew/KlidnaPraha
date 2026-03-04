"""
make_routes_index.py  –  STEP 2 of 2
=====================================
Scores every route in Cyclo/routes/ against noise and air quality data,
then writes a compact JSON index used by Web/cyclo.html.

Input:   Cyclo/routes/*.geojson               (produced by split_routes.py)
         Grapphopper/custom_areas/             (noise_day_*.geojson, air_level_*.geojson)
Output:  Cyclo/routes_index.json

Scores:
  noise_score  0–100  mean dB along the route (day)   lower = quieter
  air_score    1–5    mean air-quality level            lower = cleaner

Run from anywhere:
    python Cyclo/make_routes_index.py
OR
    python build.py          (runs both steps in order)

Requires: shapely  (pip install shapely)
"""

import json
import os
import glob
import re

from shapely.geometry import shape, Point
from shapely.strtree  import STRtree

# ── Paths (all relative to this file's directory = Cyclo/) ────────────────────
HERE         = os.path.dirname(os.path.abspath(__file__))          # …/Cyclo
PROJECT_ROOT = os.path.dirname(HERE)                               # …/Tichá Praha

ROUTES_DIR   = os.path.join(HERE,         "routes")
CUSTOM_AREAS = os.path.join(PROJECT_ROOT, "Grapphopper", "custom_areas")
OUT_FILE     = os.path.join(HERE,         "routes_index.json")

# ── Load noise-day polygons ───────────────────────────────────────────────────
print("Loading noise polygons …")
_noise_pat  = re.compile(r"noise_day_(\d+)_(\d+)\.geojson$")
noise_geoms, noise_dbs = [], []
for fp in glob.glob(os.path.join(CUSTOM_AREAS, "noise_day_*.geojson")):
    m = _noise_pat.search(fp)
    if not m:
        continue
    lo, hi = int(m.group(1)), int(m.group(2))
    with open(fp, encoding="utf-8") as fh:
        feat = json.load(fh)["features"][0]
    noise_geoms.append(shape(feat["geometry"]))
    noise_dbs.append((lo + hi) / 2)

noise_tree = STRtree(noise_geoms)
print(f"  {len(noise_geoms)} noise polygons")

# ── Load air-quality polygons ─────────────────────────────────────────────────
print("Loading air polygons …")
_air_pat   = re.compile(r"air_level_(\d+)\.geojson$")
air_geoms, air_levels = [], []
for fp in glob.glob(os.path.join(CUSTOM_AREAS, "air_level_*.geojson")):
    m = _air_pat.search(fp)
    if not m:
        continue
    with open(fp, encoding="utf-8") as fh:
        feat = json.load(fh)["features"][0]
    air_geoms.append(shape(feat["geometry"]))
    air_levels.append(int(m.group(1)))

air_tree = STRtree(air_geoms)
print(f"  {len(air_geoms)} air polygons")


# ── Helpers ───────────────────────────────────────────────────────────────────
def sample_points(geom, step=0.002):
    """Sample points ~every `step` degrees (~140 m at Prague lat) along all lines."""
    lines = list(geom.geoms) if geom.geom_type == "MultiLineString" else [geom]
    pts = []
    for line in lines:
        coords = list(line.coords)
        pts.append(coords[0])
        accum = 0.0
        for i in range(1, len(coords)):
            dx = coords[i][0] - coords[i - 1][0]
            dy = coords[i][1] - coords[i - 1][1]
            seg = (dx * dx + dy * dy) ** 0.5
            accum += seg
            while accum >= step:
                frac = (accum - step) / seg if seg > 0 else 0
                pts.append((coords[i][0] - dx * frac, coords[i][1] - dy * frac))
                accum -= step
        pts.append(coords[-1])
    return pts


def mean_score(pts, tree, values):
    """Mean `values[i]` for all sampled points that fall inside any polygon."""
    total, n = 0.0, 0
    for x, y in pts:
        idxs = tree.query(Point(x, y), predicate="intersects")
        if len(idxs):
            total += values[idxs[0]]
            n += 1
    return round(total / n, 2) if n else 0.0


def bbox(geom):
    b = geom.bounds  # (minx, miny, maxx, maxy)
    return [round(v, 5) for v in b]


def centroid(geom):
    c = geom.centroid
    return [round(c.x, 5), round(c.y, 5)]


# ── Process routes ────────────────────────────────────────────────────────────
route_files = sorted(glob.glob(os.path.join(ROUTES_DIR, "*.geojson")))
print(f"\nScoring {len(route_files)} routes …")

if not route_files:
    raise SystemExit(
        f"No route files found in {ROUTES_DIR}\n"
        "Run split_routes.py first (or python build.py)."
    )

index = []
for i, fp in enumerate(route_files, 1):
    if i % 50 == 0 or i == len(route_files):
        print(f"  {i}/{len(route_files)}")

    with open(fp, encoding="utf-8") as fh:
        data = json.load(fh)

    feat  = data["features"][0]
    props = feat["properties"]
    geom  = shape(feat["geometry"])

    pts   = sample_points(geom, step=0.002)
    ns    = mean_score(pts, noise_tree, noise_dbs)
    air   = mean_score(pts, air_tree,   air_levels)

    # shape_Length is in degrees; × 111 km/° ≈ km (good enough for display)
    km = round(props.get("shape_Length", 0) * 111.0, 2)

    index.append({
        "id":          os.path.splitext(os.path.basename(fp))[0],
        "nazev":       (props.get("nazev")    or "").strip(),
        "jmeno":       (props.get("jmeno")    or "").strip(),
        "pocatek":     (props.get("pocatek")  or "").strip(),
        "konec":       (props.get("konec")    or "").strip(),
        "kategorie":   props.get("kategorie", 0),
        "length_km":   km,
        "noise_score": ns,
        "air_score":   air if air > 0 else 1.0,   # default to cleanest level
        "bbox":        bbox(geom),
        "center":      centroid(geom),
    })

# ── Write output ──────────────────────────────────────────────────────────────
with open(OUT_FILE, "w", encoding="utf-8") as fh:
    json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))

kb = os.path.getsize(OUT_FILE) // 1024
print(f"\nWrote {len(index)} routes → {OUT_FILE} ({kb} KB)")
with_noise = sum(1 for r in index if r["noise_score"] > 0)
with_air   = sum(1 for r in index if r["air_score"]   > 1)
print(f"  noise data coverage: {with_noise}/{len(index)} routes")
print(f"  air   data coverage: {with_air}/{len(index)} routes")


if __name__ == "__main__":
    pass   # all logic runs at import/exec so build.py can exec() this
