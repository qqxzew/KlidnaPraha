"""
build.py  –  Cyklotrasy pipeline
==================================
Runs both preprocessing steps in order:

  STEP 1 – split_routes.py
    Splits Cyclo/Cyclo.geojson into individual per-route GeoJSON files
    → Cyclo/routes/<id>.geojson

  STEP 2 – make_routes_index.py
    Scores every route against noise + air data, writes the index
    → Cyclo/routes_index.json  (used by Web/cyclo.html)

Usage:
    python Cyclo/build.py          # from project root
    python build.py                # from inside Cyclo/

Re-run whenever Cyclo.geojson or the noise/air source data changes.
"""

import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))   # Cyclo/


def run_step(label: str, script: str):
    print()
    print(f"{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    t0 = time.time()
    path = os.path.join(HERE, script)
    with open(path, encoding="utf-8") as fh:
        code = compile(fh.read(), path, "exec")
    exec(code, {"__file__": path, "__name__": "__main__"})
    print(f"  ✓ Done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    total = time.time()
    skip_split = "--skip-split" in sys.argv

    if not skip_split:
        run_step("STEP 1/2 — split_routes.py", "split_routes.py")
    else:
        print("Skipping STEP 1 (--skip-split)")

    run_step("STEP 2/2 — make_routes_index.py", "make_routes_index.py")

    print()
    print(f"{'='*60}")
    print(f"  Pipeline complete in {time.time() - total:.1f}s")
    print(f"{'='*60}")
