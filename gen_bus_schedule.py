import zipfile, io, csv, json, sys

path = r'ТРАНСОПРТ/PID_GTFS.zip'
out_path = r'Web/AppUI/transit_bus_schedule.json'

print("Opening GTFS zip...")
with zipfile.ZipFile(path) as z:
    # Active services on Friday 2026-03-06
    with z.open('calendar.txt') as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8'))
        svc = set()
        for row in reader:
            if row['friday'] == '1' and row['start_date'] <= '20260306' <= row['end_date']:
                svc.add(row['service_id'])
    print(f"Active services: {len(svc)}")

    # Route types
    with z.open('routes.txt') as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8'))
        rtype = {}
        for row in reader:
            rtype[row['route_id']] = (int(row['route_type']), row['route_short_name'])

    # Bus trips (type=3) for active services
    with z.open('trips.txt') as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8'))
        bus_trips = {}  # trip_id -> (route_short_name, headsign)
        for row in reader:
            if row['service_id'] not in svc:
                continue
            rid = row['route_id']
            if rtype.get(rid, (99,))[0] == 3:
                bus_trips[row['trip_id']] = (rtype[rid][1], row['trip_headsign'])
    print(f"Bus trips on Friday: {len(bus_trips)}")

    # Load Prague bus stop IDs from transit_stops.geojson
    with open('Web/AppUI/transit_stops.geojson', encoding='utf-8') as f:
        stops_gj = json.load(f)
    prague_stop_ids = set()
    for feat in stops_gj['features']:
        ids = feat['properties'].get('gtfsIds')
        if ids:
            for i in json.loads(ids):
                prague_stop_ids.add(i)
    print(f"Prague GTFS stop IDs: {len(prague_stop_ids)}")

    # Stream stop_times.txt
    print("Streaming stop_times.txt...")
    schedule = {}  # stop_id -> { (route, dir) -> set of time strings }
    matched = 0
    with z.open('stop_times.txt') as raw:
        reader = csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8'))
        for i, row in enumerate(reader):
            if i % 1_000_000 == 0 and i > 0:
                print(f"  {i//1_000_000}M rows, matched so far: {matched}", flush=True)
            tid = row['trip_id']
            if tid not in bus_trips:
                continue
            sid = row['stop_id']
            if sid not in prague_stop_ids:
                continue
            # Parse time (may be 24+ hours)
            parts = row['departure_time'].split(':')
            h, m = int(parts[0]), int(parts[1])
            if h >= 24:
                h -= 24
            t = f"{h:02d}:{m:02d}"
            rname, headsign = bus_trips[tid]
            key = (rname, headsign)
            if sid not in schedule:
                schedule[sid] = {}
            if key not in schedule[sid]:
                schedule[sid][key] = set()
            schedule[sid][key].add(t)
            matched += 1

    print(f"Matched rows: {matched}")
    print(f"Stops with schedule: {len(schedule)}")

# Convert to list format and sort times
output = {}
for sid, routes in schedule.items():
    entries = []
    for (rname, headsign), times in routes.items():
        entries.append({'r': rname, 'dir': headsign, 'times': sorted(times)})
    entries.sort(key=lambda x: x['r'])
    output[sid] = entries

total_entries = sum(len(v) for v in output.values())
print(f"Output entries: {total_entries}")

json_str = json.dumps(output, ensure_ascii=False, separators=(',', ':'))
size_kb = len(json_str.encode('utf-8')) // 1024
print(f"Saving: {size_kb}KB")

with open(out_path, 'w', encoding='utf-8') as f:
    f.write(json_str)
print("Done.")
