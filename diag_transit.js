const g  = JSON.parse(require('fs').readFileSync('Web/AppUI/transit_graph.json','utf-8'));
const sc = JSON.parse(require('fs').readFileSync('Web/AppUI/transit_stops_coords.json','utf-8'));
const s1 = JSON.parse(require('fs').readFileSync('Web/AppUI/transit_schedule.json','utf-8'));
const s2 = JSON.parse(require('fs').readFileSync('Web/AppUI/transit_bus_schedule.json','utf-8'));

for (const sch of [s1, s2])
    for (const sid in sch)
        for (const e of sch[sid])
            if (!e._m) e._m = e.times.map(t => +t.slice(0,2)*60 + +t.slice(3,5));

function haversineM(lat1,lng1,lat2,lng2) {
    const R=6371000,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180;
    const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function nextDep(sid, rname, curMin) {
    let best = Infinity;
    for (const sch of [s1, s2]) {
        const entries = sch[sid]; if (!entries) continue;
        for (const e of entries) {
            if (e.r !== rname) continue;
            const m = e._m; let lo=0, hi=m.length;
            while (lo<hi) { const mid=(lo+hi)>>1; if(m[mid]<curMin) lo=mid+1; else hi=mid; }
            if (lo<m.length && m[lo]<best) best=m[lo];
        }
    }
    return best;
}

const graphNodes = Object.keys(g);
const WALK_SPD=80, MAX_WALK=1400, K=6, MAX_TF=2, HORIZON=100, TF_PEN=4;

function nearest(coord) {
    const res=[];
    for (const sid of graphNodes) {
        const c=sc[sid]; if(!c) continue;
        const d=haversineM(coord.lat,coord.lng,c[0],c[1]);
        if(d<=MAX_WALK) res.push({sid, lat:c[0], lng:c[1], d});
    }
    return res.sort((a,b)=>a.d-b.d).slice(0,K);
}

// Test: Václavské náměstí -> Florenc
const from = {lat:50.0815, lng:14.4270};
const to   = {lat:50.0927, lng:14.4409};
const t0 = 10*60;

const starts = nearest(from);
const ends   = nearest(to);
console.log('Nearest starts:', starts.map(s => s.sid + ' d=' + Math.round(s.d) + 'm'));
console.log('Nearest ends:  ', ends.map(e => e.sid + ' d=' + Math.round(e.d) + 'm'));
console.log('Current time:', t0, '(10:00)');

for (const st of starts) {
    const edges = g[st.sid] || [];
    let good = 0;
    for (const e of edges) { const dep = nextDep(st.sid, e.r, t0); if (dep < Infinity) good++; }
    console.log('  ' + st.sid + ': ' + good + '/' + edges.length + ' departures found');
    if (good === 0 && edges.length > 0) {
        // Show why
        for (const e of edges.slice(0,3)) {
            const dep = nextDep(st.sid, e.r, t0);
            console.log('    route ' + e.r + ': next dep=' + dep);
        }
    }
}

// Full Dijkstra
class MinHeap {
    constructor(key) { this._k=key; this._d=[]; }
    get size() { return this._d.length; }
    push(v) { this._d.push(v); this._up(this._d.length-1); }
    pop() { const t=this._d[0]; const l=this._d.pop(); if(this._d.length){this._d[0]=l;this._dn(0);} return t; }
    _up(i){while(i>0){const p=(i-1)>>1;if(this._k(this._d[p])<=this._k(this._d[i]))break;[this._d[p],this._d[i]]=[this._d[i],this._d[p]];i=p;}}
    _dn(i){const n=this._d.length;while(true){let s=i,l=2*i+1,r=l+1;if(l<n&&this._k(this._d[l])<this._k(this._d[s]))s=l;if(r<n&&this._k(this._d[r])<this._k(this._d[s]))s=r;if(s===i)break;[this._d[s],this._d[i]]=[this._d[i],this._d[s]];i=s;}}
}

const endMap = new Map(ends.map(e => [e.sid, e]));
const heap = new MinHeap(n => n.t);
const best = new Map();
for (const s of starts) {
    const t = t0 + s.d / WALK_SPD;
    heap.push({ t, sid: s.sid, tf: 0, route: null, legs: [] });
}

let iterations = 0;
let result = null;
while (heap.size && iterations < 50000) {
    iterations++;
    const { t, sid, tf, route } = heap.pop();
    const bk = sid + '\x01' + tf + '\x01' + (route||'');
    if ((best.get(bk) ?? Infinity) <= t) continue;
    best.set(bk, t);
    if (endMap.has(sid)) { result = { sid, t, tf }; break; }
    if (t > t0 + HORIZON) continue;
    for (const edge of (g[sid] || [])) {
        const dep = nextDep(sid, edge.r, t);
        if (dep === Infinity) continue;
        const arr = dep + edge.t / 60;
        const isTf = route !== null && route !== edge.r;
        const newTf = tf + (isTf ? 1 : 0);
        if (newTf > MAX_TF) continue;
        const eff = arr + (isTf ? TF_PEN : 0);
        const bk2 = edge.to + '\x01' + newTf + '\x01' + edge.r;
        if ((best.get(bk2) ?? Infinity) <= eff) continue;
        heap.push({ t: eff, sid: edge.to, tf: newTf, route: edge.r, legs: [] });
    }
}
console.log('\nDijkstra iterations:', iterations);
if (result) {
    console.log('ROUTE FOUND! Arrival at', result.sid, 'time:', Math.floor(result.t/60)+':'+String(Math.round(result.t)%60).padStart(2,'0'), 'transfers:', result.tf);
} else {
    console.log('NO ROUTE FOUND');
    console.log('Heap final size:', heap.size);
    console.log('Best map size:', best.size);
    // Find nodes that were visited
    const visited = [...best.keys()].map(k => k.split('\x01')[0]);
    console.log('Sample visited stops (first 10):', visited.slice(0,10));
}
