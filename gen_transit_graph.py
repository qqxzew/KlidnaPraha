"""
Generate transit_graph.json  — directed stop-to-stop adjacency for all Friday routes
Generate transit_stops_coords.json — GTFS stop_id -> [lat, lng]
Generate transit_edge_shapes.json — per-edge shape geometry [lng,lat] arrays

Tram (0) + bus (3) + trolleybus (11) modes. Metro excluded.
"""
import zipfile, io, csv, json
from collections import defaultdict

GTFS_PATH        = r'ТРАНСОПРТ/PID_GTFS.zip'
OUT_GRAPH        = r'Web/AppUI/transit_graph.json'
OUT_COORDS       = r'Web/AppUI/transit_stops_coords.json'
OUT_EDGE_SHAPES  = r'Web/AppUI/transit_edge_shapes.json'

VALID_TYPES = {0, 3, 11}  # tram, bus, trolleybus
TARGET_DATE = '20260306'   # Friday

print("Opening GTFS zip…")
with zipfile.ZipFile(GTFS_PATH) as z:

    # ── Active service IDs (Fridays, date range covers target date)
    with z.open('calendar.txt') as f:
        rd = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8'))
        svc = {r['service_id'] for r in rd
               if r['friday'] == '1'
               and r['start_date'] <= TARGET_DATE <= r['end_date']}
    print(f"Active services: {len(svc)}")

    # ── Route short names + types
    with z.open('routes.txt') as f:
        rd = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8'))
        route_info = {r['route_id']: (int(r['route_type']), r['route_short_name']) for r in rd}

    # ── Active trips for valid route types, also record shape_id
    with z.open('trips.txt') as f:
        rd = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8'))
        trips = {}       # trip_id -> route_short_name
        trip_shape = {}  # trip_id -> shape_id
        for r in rd:
            if r['service_id'] not in svc:
                continue
            rt, rn = route_info.get(r['route_id'], (99, '?'))
            if rt in VALID_TYPES:
                trips[r['trip_id']] = rn
                if r.get('shape_id'):
                    trip_shape[r['trip_id']] = r['shape_id']
    print(f"Eligible trips: {len(trips)}, with shapes: {len(trip_shape)}")

    # ── Stop coords from stops.txt
    with z.open('stops.txt') as f:
        rd = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8'))
        stop_coords = {r['stop_id']: [float(r['stop_lat']), float(r['stop_lon'])] for r in rd}

    # ── Prague stop IDs (from transit_stops.geojson)
    with open('Web/AppUI/transit_stops.geojson', encoding='utf-8') as f:
        stops_gj = json.load(f)
    prague_stops = set()
    for feat in stops_gj['features']:
        ids_raw = feat['properties'].get('gtfsIds')
        if ids_raw:
            for i in json.loads(ids_raw):
                prague_stops.add(i)
    print(f"Prague GTFS stop IDs: {len(prague_stops)}")

    # ── Load shapes.txt → shape_id -> sorted list of [lat, lng, dist_traveled]
    print("Loading shapes.txt…")
    shape_pts = defaultdict(list)
    with z.open('shapes.txt') as raw:
        rd = csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8'))
        for r in rd:
            shape_pts[r['shape_id']].append((
                float(r['shape_dist_traveled']) if r.get('shape_dist_traveled') else 0.0,
                float(r['shape_pt_lat']),
                float(r['shape_pt_lon']),
            ))
    for sid in shape_pts:
        shape_pts[sid].sort(key=lambda x: x[0])
    print(f"Shapes loaded: {len(shape_pts)}")

    # ── Stream stop_times.txt → build per-trip ordered stop list
    def tsec(t):
        p = t.split(':')
        return int(p[0]) * 3600 + int(p[1]) * 60   # ignore seconds

    print("Streaming stop_times.txt…")
    trip_stops = defaultdict(list)
    rows = 0
    with z.open('stop_times.txt') as raw:
        rd = csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8'))
        for r in rd:
            rows += 1
            if rows % 1_000_000 == 0:
                print(f"  {rows // 1_000_000}M rows, trips so far: {len(trip_stops)}", flush=True)
            if r['trip_id'] not in trips:
                continue
            if r['stop_id'] not in prague_stops:
                continue
            trip_stops[r['trip_id']].append(
                (int(r['stop_sequence']), r['stop_id'], tsec(r['departure_time']))
            )
    print(f"Trips with Prague stops: {len(trip_stops)}")

    # ── Build edge accumulator: (from, to, route) -> [travel_sec, …]
    # Also track one representative trip per edge for shape lookup
    edge_acc = defaultdict(list)
    edge_rep = {}   # (sa, sb, rn) -> trip_id
    for tid, stps in trip_stops.items():
        stps.sort(key=lambda x: x[0])
        rname = trips[tid]
        for i in range(len(stps) - 1):
            _, sa, da = stps[i]
            _, sb, db = stps[i + 1]
            dt = db - da
            if 0 < dt < 3600:
                edge_acc[(sa, sb, rname)].append(dt)
                if (sa, sb, rname) not in edge_rep and tid in trip_shape:
                    edge_rep[(sa, sb, rname)] = tid

    print(f"Unique directed edges: {len(edge_acc)}, with shape ref: {len(edge_rep)}")

    # ── Build adjacency list with averaged travel times
    graph = defaultdict(list)
    for (sa, sb, rn), times in edge_acc.items():
        graph[sa].append({'to': sb, 'r': rn, 't': round(sum(times) / len(times))})

    # ── Stop coords for Prague stops
    coords_out = {sid: stop_coords[sid] for sid in prague_stops if sid in stop_coords}

    print(f"Graph nodes: {len(graph)}, Coord entries: {len(coords_out)}")

    # ── Compute per-edge shape geometry from shapes.txt
    print("Computing edge shape geometries…")

    def sq_dist_latlon(lat1, lng1, lat2, lng2):
        dlat = lat1 - lat2
        dlng = (lng1 - lng2) * 0.6
        return dlat * dlat + dlng * dlng

    def closest_shape_idx(shape, lat, lng):
        best_i, best_d = 0, float('inf')
        for i, (_, slat, slng) in enumerate(shape):
            d = sq_dist_latlon(slat, slng, lat, lng)
            if d < best_d:
                best_d = d
                best_i = i
        return best_i

    edge_shapes = {}
    missing_shape = 0
    for (sa, sb, rn), tid in edge_rep.items():
        if sa not in stop_coords or sb not in stop_coords:
            missing_shape += 1
            continue
        shape_id = trip_shape.get(tid)
        if not shape_id or shape_id not in shape_pts:
            missing_shape += 1
            continue
        shape = shape_pts[shape_id]
        if len(shape) < 2:
            missing_shape += 1
            continue
        lat_a, lng_a = stop_coords[sa]
        lat_b, lng_b = stop_coords[sb]
        ia = closest_shape_idx(shape, lat_a, lng_a)
        ib = closest_shape_idx(shape, lat_b, lng_b)
        if ia <= ib:
            seg = [[shape[i][2], shape[i][1]] for i in range(ia, ib + 1)]
        else:
            seg = [[shape[i][2], shape[i][1]] for i in range(ib, ia + 1)]
            seg.reverse()
        edge_shapes[f'{sa}|{sb}|{rn}'] = seg

    print(f"Edge shapes: {len(edge_shapes)}, skipped: {missing_shape}")

# ── Serialise
graph_s        = json.dumps(dict(graph),    ensure_ascii=False, separators=(',', ':'))
coords_s       = json.dumps(coords_out,     ensure_ascii=False, separators=(',', ':'))
edge_shapes_s  = json.dumps(edge_shapes,    ensure_ascii=False, separators=(',', ':'))
print(f"Graph: {len(graph_s)//1024} KB  |  Coords: {len(coords_s)//1024} KB  |  EdgeShapes: {len(edge_shapes_s)//1024} KB")

with open(OUT_GRAPH,       'w', encoding='utf-8') as f: f.write(graph_s)
with open(OUT_COORDS,      'w', encoding='utf-8') as f: f.write(coords_s)
with open(OUT_EDGE_SHAPES, 'w', encoding='utf-8') as f: f.write(edge_shapes_s)
print("Done.")
