"""
Filter Libraries.xml (MARC21) → Libraries_prague.geojson

Keeps only Prague records that are publicly accessible quiet places:
  OK  – obecní knihovna (municipal library)
  MK  – městská knihovna (city library)
  KK  – krajská knihovna (regional library)
  NK  – národní knihovna (national library)
  KI  – knihovna kulturní instituce (cultural institution library)
  KI-MU – muzejní knihovna
  KI-GA – galerijní knihovna

Excludes: VŠ (university), VK (research), SP (specialized),
          AK (government admin), LK (medical), ŠK (school), CK (church)

Deduplicates by rounded coordinates so each physical building appears once.
"""

import re
import json
import pathlib
import xml.etree.ElementTree as ET

HERE = pathlib.Path(__file__).parent
NS = "http://www.loc.gov/MARC21/slim"

PUBLIC_TYPES = {"OK", "MK", "KK", "NK", "KI", "KI-MU", "KI-GA"}


def _dms_to_dd(dms_str: str):
    """
    Convert a DMS string like "50°5'11.12\"N, 14°24'56.61\"E"
    to (lat, lng) decimal degrees. Returns (None, None) on failure.
    """
    pattern = (
        r"(\d+)[°](\d+)[']([0-9.]+)[\"]\s*([NS])"
        r"\s*,\s*"
        r"(\d+)[°](\d+)[']([0-9.]+)[\"]\s*([EW])"
    )
    m = re.search(pattern, dms_str)
    if not m:
        return None, None
    latd, latm, lats, latH, lngd, lngm, lngs, lngH = m.groups()
    lat = float(latd) + float(latm) / 60 + float(lats) / 3600
    lng = float(lngd) + float(lngm) / 60 + float(lngs) / 3600
    if latH == "S":
        lat = -lat
    if lngH == "W":
        lng = -lng
    return lat, lng


def _tag(name):
    return f"{{{NS}}}{name}"


def _get_subfields(record, tag, code=None):
    """Return list of subfield text values for the given tag and code."""
    results = []
    for df in record.findall(_tag("datafield")):
        if df.get("tag") != tag:
            continue
        for sf in df.findall(_tag("subfield")):
            if code is None or sf.get("code") == code:
                results.append(sf.text or "")
    return results


def _is_prague(record):
    mes = _get_subfields(record, "MES", "a")
    krj_b = _get_subfields(record, "KRJ", "b")
    krj_a = _get_subfields(record, "KRJ", "a")
    all_vals = mes + krj_b + krj_a
    return any("Praha" in v for v in all_vals)


def main():
    input_path = HERE / "Libraries.xml"
    output_path = HERE / "Libraries_prague.geojson"

    print(f"Parsing {input_path}  (this may take a moment)…")

    features = []
    seen_coords = set()  # deduplicate by rounded lat/lng
    total = 0
    skipped_not_prague = 0
    skipped_wrong_type = 0
    skipped_no_coords = 0
    skipped_dup = 0

    context = ET.iterparse(str(input_path), events=("end",))

    for event, elem in context:
        if elem.tag != _tag("record"):
            continue
        total += 1

        if not _is_prague(elem):
            skipped_not_prague += 1
            elem.clear()
            continue

        # Filter by library type – only public/quiet-friendly types
        typ_a = ""
        for df in elem.findall(_tag("datafield")):
            if df.get("tag") == "TYP":
                for sf in df.findall(_tag("subfield")):
                    if sf.get("code") == "a":
                        typ_a = (sf.text or "").strip()
                break
        if typ_a not in PUBLIC_TYPES:
            skipped_wrong_type += 1
            elem.clear()
            continue

        # Get coordinates
        adr_g = _get_subfields(elem, "ADR", "g")
        lat, lng = None, None
        for g_val in adr_g:
            lat, lng = _dms_to_dd(g_val)
            if lat is not None:
                break

        if lat is None:
            skipped_no_coords += 1
            elem.clear()
            continue

        # Deduplicate by rounded coordinates (4 decimal places ≈ 11 m)
        coord_key = (round(lat, 4), round(lng, 4))
        if coord_key in seen_coords:
            skipped_dup += 1
            elem.clear()
            continue
        seen_coords.add(coord_key)

        # Use root name only (no sub-department suffixes)
        naz = _get_subfields(elem, "NAZ", "a")
        name = naz[0].strip() if naz else ""

        # Get address
        adr_u = _get_subfields(elem, "ADR", "u")
        adr_m = _get_subfields(elem, "ADR", "m")
        address = (adr_u[0].strip() if adr_u else "") + (", " + adr_m[0].strip() if adr_m else "")

        # Sigla
        sgl = _get_subfields(elem, "SGL", "a")
        sigla = sgl[0].strip() if sgl else ""

        features.append({
            "type": "Feature",
            "properties": {
                "name": name,
                "address": address,
                "sigla": sigla,
                "type": typ_a,
            },
            "geometry": {
                "type": "Point",
                "coordinates": [round(lng, 8), round(lat, 8)]
            }
        })

        elem.clear()

    print(f"Total records:       {total}")
    print(f"Not Prague:          {skipped_not_prague}")
    print(f"Wrong type:          {skipped_wrong_type}")
    print(f"No coordinates:      {skipped_no_coords}")
    print(f"Duplicates removed:  {skipped_dup}")
    print(f"Kept:                {len(features)}")
    print()
    for t in sorted(PUBLIC_TYPES):
        n = sum(1 for f in features if f['properties']['type'] == t)
        print(f"  {t:8}  {n}")

    geojson = {
        "type": "FeatureCollection",
        "name": "libraries_prague",
        "features": features
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    geojson = {
        "type": "FeatureCollection",
        "name": "libraries_prague",
        "features": features
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    print(f"\nSaved → {output_path}")


if __name__ == "__main__":
    main()
