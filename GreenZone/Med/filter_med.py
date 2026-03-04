import json
import unicodedata
import pathlib

HERE = pathlib.Path(__file__).parent

KEEP_KEYWORDS = [
    "poliklinika",
    "poliklina",  # typo variant in source data
    "lékařský dům",
    "lekarsky dum",
    "zdravotní středisko",
    "zdravotni stredisko",
    "zdravotnické zařízení",
    "zdravotnicke zarizeni",
    "centrum zdravotní",
    "centrum zdravotni",
    "zdravotnické",
    "zdravotnicke",
    "lékařský",
    "lekarsky",
    "středisko zdravotní",
    "stredisko zdravotni",
]

EXCLUDE_KEYWORDS = [
    "nemocnice",
    "urgentní",
    "urgentni",
]


def _normalize(text: str) -> str:
    """Lowercase + strip accents for comparison."""
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def should_keep(feature: dict) -> bool:
    raw_name = feature.get("properties", {}).get("nazev_zar", "") or ""
    name_norm = _normalize(raw_name)

    # First check exclusions
    for kw in EXCLUDE_KEYWORDS:
        if _normalize(kw) in name_norm:
            return False

    # Then check inclusions
    for kw in KEEP_KEYWORDS:
        if _normalize(kw) in name_norm:
            return True

    # Default: exclude if not matched
    return False


def main():
    input_path = HERE / "Med.geojson"
    output_path = HERE / "Med_clean.geojson"

    print(f"Reading {input_path}...")
    with open(input_path, encoding="utf-8") as f:
        geojson = json.load(f)

    features = geojson.get("features", [])
    print(f"Total features: {len(features)}")

    kept = [f for f in features if should_keep(f)]
    excluded = len(features) - len(kept)

    print(f"Kept:     {len(kept)}")
    print(f"Excluded: {excluded}")

    # Print excluded names for review
    if excluded > 0:
        print("\nExcluded entries:")
        for f in features:
            if not should_keep(f):
                name = f.get("properties", {}).get("nazev_zar", "(no name)")
                print(f"  - {name}")

    out_geojson = {
        "type": "FeatureCollection",
        "name": "med_clean",
        "crs": geojson.get("crs", {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}}),
        "features": kept
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(out_geojson, f, ensure_ascii=False, indent=2)

    print(f"\nSaved → {output_path}")


if __name__ == "__main__":
    main()
