// null = auto by time, 'light' = force day, 'dark' = force night
let _devThemeOverride = null;

const getThemeBasedOnTime = () => {
    if (_devThemeOverride) return _devThemeOverride;
    const hours = new Date().getHours();
    return (hours >= 6 && hours < 22) ? 'light' : 'dark';
};

const applyTheme = () => {
    const theme = getThemeBasedOnTime();
    const htmlEl = document.documentElement;

    if (theme === 'dark') {
        htmlEl.classList.add('dark');
        htmlEl.classList.remove('light');
    } else {
        htmlEl.classList.add('light');
        htmlEl.classList.remove('dark');
    }

    return theme;
};

const mapTheme = applyTheme();
setInterval(applyTheme, 60000);

// Nahrazeno za Mapbox mapu
mapboxgl.accessToken = 'pk.eyJ1IjoicXF4emV3IiwiYSI6ImNtbTFyY3VtNTBibDYycXM3OG94OTJleTcifQ.nSV6VT1f0hDwztl8KVQfQg';

let lightStyle = 'mapbox://styles/mapbox/light-v11';
let darkStyle = 'mapbox://styles/mapbox/dark-v11';

const map = new mapboxgl.Map({
    container: 'map',
    style: mapTheme === 'dark' ? darkStyle : lightStyle,
    center: [14.4330, 50.0880], // Mírně posunuto, aby byl text "Praha" pěkně ve středu
    zoom: 13,
    pitch: 0, 
    bearing: 0,
    attributionControl: false // Vypnutí atribucí
});

// Plynulá změna stylu při přepnutí tématu by se musela řešit nasloucháním mutiation observerů na HTML, 
// pro jednoduchost při loadu bereme správnou

const settingsBtn = document.getElementById('settingsBtn');
const bottomSheet = document.getElementById('bottomSheet');
const closeSheetBtn = document.getElementById('closeSheetBtn');
const backdrop = document.getElementById('backdrop');

const openBottomSheet = () => {
    bottomSheet.classList.remove('translate-y-full');
    backdrop.classList.remove('opacity-0', 'pointer-events-none');
    backdrop.classList.add('opacity-100', 'pointer-events-auto');
};

const closeBottomSheet = () => {
    bottomSheet.classList.add('translate-y-full');
    backdrop.classList.remove('opacity-100', 'pointer-events-auto');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
};

settingsBtn.addEventListener('click', openBottomSheet);
closeSheetBtn.addEventListener('click', closeBottomSheet);
backdrop.addEventListener('click', closeBottomSheet);

const locateBtn = document.getElementById('locateBtn');
let hasLocation = false;
let userMarker = null;

locateBtn.addEventListener('click', () => {
    // Vizuál načítání
    locateBtn.innerHTML = '<i class="ph ph-spinner-gap text-xl text-brand-600 dark:text-brand-400 animate-spin"></i>';
    
    // Použití prohlížečové Geolokace přímo napojené do Mapboxu
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lng = position.coords.longitude;
                const lat = position.coords.latitude;
                
                locateBtn.innerHTML = '<i class="ph-fill ph-crosshair text-xl text-brand-600 dark:text-brand-400"></i>';
                locateBtn.classList.add('border-brand-500');

                map.flyTo({ center: [lng, lat], zoom: 16 });

                if (userMarker) {
                    userMarker.setLngLat([lng, lat]);
                } else {
                    const el = document.createElement('div');
                    el.style.width = '16px';
                    el.style.height = '16px';
                    el.style.backgroundColor = '#22c55e';
                    el.style.border = '3px solid #ffffff';
                    el.style.borderRadius = '50%';
                    el.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';

                    userMarker = new mapboxgl.Marker(el)
                        .setLngLat([lng, lat])
                        .addTo(map);
                }
            },
            (error) => {
                locateBtn.innerHTML = '<i class="ph ph-crosshair text-xl text-red-500"></i>';
                alert("Nemůžeme najít vaši polohu. Zkontrolujte oprávnění v prohlížeči.");
                setTimeout(() => {
                    locateBtn.innerHTML = '<i class="ph ph-crosshair text-xl text-gray-700 dark:text-gray-200"></i>';
                }, 3000);
            },
            { enableHighAccuracy: true }
        );
    } else {
        alert("Geolokace není podporována.");
    }
});

// DEV: remove this block when done
document.getElementById('devThemeToggle').addEventListener('click', () => {
    // Cycle: auto → force day → force night → auto
    if (_devThemeOverride === null) {
        _devThemeOverride = 'light';   // force day
    } else if (_devThemeOverride === 'light') {
        _devThemeOverride = 'dark';    // force night
    } else {
        _devThemeOverride = null;      // back to auto
    }

    const effective = _devThemeOverride ?? getThemeBasedOnTime();
    const icon = document.querySelector('#devThemeToggle i');

    if (_devThemeOverride === null) {
        icon.className = 'ph ph-clock text-xl text-gray-700 dark:text-gray-200';
    } else if (effective === 'light') {
        icon.className = 'ph ph-sun text-xl text-yellow-500';
    } else {
        icon.className = 'ph ph-moon text-xl text-indigo-400';
    }

    // Apply CSS theme + map style
    const htmlEl = document.documentElement;
    htmlEl.classList.toggle('dark', effective === 'dark');
    htmlEl.classList.toggle('light', effective === 'light');

    if (map.isStyleLoaded()) {
        map.setStyle(effective === 'dark' ? darkStyle : lightStyle);
    }
});
// /DEV

const toggle3DBtn = document.getElementById('toggle3DBtn');
let is3DMode = false;

toggle3DBtn.addEventListener('click', () => {
    is3DMode = !is3DMode;
    
    if (is3DMode) {
        toggle3DBtn.classList.add('bg-brand-100', 'dark:bg-brand-900', 'border-brand-500');
        toggle3DBtn.querySelector('i').classList.add('text-brand-600', 'dark:text-brand-400');
        toggle3DBtn.querySelector('i').classList.replace('ph-cube', 'ph-fill');
        toggle3DBtn.querySelector('i').classList.add('ph-cube');
        
        // Let's pitch the Mapbox camera smoothly to 60 degrees for true 3D
        map.easeTo({ pitch: 60, bearing: -17.6, duration: 1000 });
        
        // Přidáme 3D budovy pokud tam nejsou
        if (!map.getLayer('3d-buildings')) {
            map.addLayer({
                'id': '3d-buildings',
                'source': 'composite',
                'source-layer': 'building',
                'filter': ['==', 'extrude', 'true'],
                'type': 'fill-extrusion',
                'minzoom': 15,
                'paint': {
                    'fill-extrusion-color': '#aaa',
                    'fill-extrusion-height': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        15,
                        0,
                        15.05,
                        ['get', 'height']
                    ],
                    'fill-extrusion-base': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        15,
                        0,
                        15.05,
                        ['get', 'min_height']
                    ],
                    'fill-extrusion-opacity': 0.6
                }
            });
        }
    } else {
        toggle3DBtn.classList.remove('bg-brand-100', 'dark:bg-brand-900', 'border-brand-500');
        toggle3DBtn.querySelector('i').classList.remove('text-brand-600', 'dark:text-brand-400');
        toggle3DBtn.querySelector('i').classList.replace('ph-fill', 'ph-cube');
        
        // Nastavení mapbox kamery zpět svrchu na pitch 0
        map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
    }
});

let startY;
const sheetHandle = document.getElementById('sheetHandle');

sheetHandle.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
}, { passive: true });

sheetHandle.addEventListener('touchmove', (e) => {
    const currentY = e.touches[0].clientY;
    if (currentY > startY) {
        const diff = currentY - startY;
        bottomSheet.style.transform = `translateY(${diff}px)`;
    }
}, { passive: true });

sheetHandle.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientY - startY;
    bottomSheet.style.transform = '';
    
    if (diff > 100) {
        closeBottomSheet();
    }
}, { passive: true });

// Sliders Logic
const updateSliderText = (sliderId, textId, valuesMap) => {
    const slider = document.getElementById(sliderId);
    const textEl = document.getElementById(textId);
    
    const update = () => {
        textEl.textContent = valuesMap[slider.value];
    };
    
    slider.addEventListener('input', update);
    update(); // Init
};

updateSliderText('noiseLevel', 'noiseValText', {
    '1': 'Velmi tichý',
    '2': 'Tichý',
    '3': 'Střední',
    '4': 'Hlučnější',
    '5': 'Nezáleží'
});

updateSliderText('airLevel', 'airValText', {
    '1': 'Výborná',
    '2': 'Dobrá',
    '3': 'Střední',
    '4': 'Zhoršená',
    '5': 'Nezáleží'
});

updateSliderText('elevationLevel', 'elevationValText', {
    '1': 'Plochý terén',
    '2': 'Mírné',
    '3': 'Střední',
    '4': 'Náročné',
    '5': 'Libovolné'
});

// ═══════════════════════════════════════════════════════════
// ROUTING & GRAPHHOPPER LOGIC
// ═══════════════════════════════════════════════════════════
let ptStart = null;
let ptEnd = null;
let markerStart = null;
let markerEnd = null;

// GraphHopper URL: relative /route works via the proxy server (server.js).
// To use a direct external tunnel instead, set GH_BASE_OVERRIDE.
const GH_BASE_OVERRIDE = '';
const GH_URL     = (GH_BASE_OVERRIDE || '') + '/route';
const GH_HEADERS = { 'Content-Type': 'application/json' };

const _BASE_NOISE_DAY = [
  ['in_noise_day_25_30',0.97],['in_noise_day_30_35',0.95],['in_noise_day_35_40',0.92],
  ['in_noise_day_40_45',0.88],['in_noise_day_45_50',0.82],['in_noise_day_50_55',0.74],
  ['in_noise_day_55_60',0.64],['in_noise_day_60_65',0.52],['in_noise_day_65_70',0.40],
  ['in_noise_day_70_75',0.30],['in_noise_day_75_80',0.22],['in_noise_day_80_85',0.18],
  ['in_noise_day_85_90',0.15],
];
const _BASE_NOISE_NIGHT = [
  ['in_noise_night_25_30',0.96],['in_noise_night_30_35',0.93],['in_noise_night_35_40',0.89],
  ['in_noise_night_40_45',0.84],['in_noise_night_45_50',0.77],['in_noise_night_50_55',0.68],
  ['in_noise_night_55_60',0.56],['in_noise_night_60_65',0.42],['in_noise_night_65_70',0.30],
  ['in_noise_night_70_75',0.22],['in_noise_night_75_80',0.15],['in_noise_night_80_85',0.12],
];
const _BASE_AIR = [
  ['in_air_level_3',0.93],['in_air_level_4',0.78],['in_air_level_5',0.60],
];

// Elevation slope conditions — steeper edge = lower priority
// average_slope is 0.0–1.0 in GH (tan of grade: 0.05≈3°, 0.10≈6°, 0.17≈10°)
const _BASE_ELEV = [
    ['average_slope > 0.05', 0.90],
    ['average_slope > 0.08', 0.75],
    ['average_slope > 0.12', 0.55],
    ['average_slope > 0.17', 0.35],
];

// Clamp adjusted priority to [0.10, 1.0] — floor of 0.10 prevents extreme detours
function _scaleMult(base, factor) {
    return Math.round(Math.max(0.10, Math.min(1.0, 1 - (1 - base) * factor)) * 1000) / 1000;
}

// Slider 1–5 → penalty factor:
//   1 → 2.0  (maximum avoidance)
//   2 → 1.5
//   3 → 1.0  (default)
//   4 → 0.4  (nearly ignore)
//   5 → 0.0  (off, multiply_by = 1.0)
function _sliderToScale(v) {
    return [2.0, 1.5, 1.0, 0.4, 0.0][v - 1] ?? 1.0;
}

function buildCustomModel() {
    const nV = parseInt(document.getElementById('noiseLevel').value);
    const aV = parseInt(document.getElementById('airLevel').value);
    const eV = parseInt(document.getElementById('elevationLevel').value);
    const sN = _sliderToScale(nV);
    const sA = _sliderToScale(aV);
    const sE = _sliderToScale(eV);

    // Each slider independently sets distance_influence (willingness to detour).
    // Slider 1 (max avoidance) -> di=15  (big detours OK).
    // Slider 3 (neutral)       -> di=65.
    // Slider 5 (ignore factor) -> di=100 (stick to shortest path).
    // Final di = min across all sliders: the most demanding preference wins.
    const _DI = [15, 35, 65, 88, 100];
    const distance_influence = Math.min(_DI[nV - 1], _DI[aV - 1], _DI[eV - 1]);

    const hour = new Date().getHours();
    const noiseBase = (hour >= 7 && hour < 22) ? _BASE_NOISE_DAY : _BASE_NOISE_NIGHT;

    const priority = [
        { if: '!in_merged_parks', multiply_by: 0.85 },
        ..._BASE_AIR.map(([k,v]) => ({ if: k, multiply_by: _scaleMult(v, sA) })),
        ...noiseBase.map(([k,v]) => ({ if: k, multiply_by: _scaleMult(v, sN) })),
        ...(sE > 0 ? _BASE_ELEV.map(([k,v]) => ({ if: k, multiply_by: _scaleMult(v, sE) })) : []),
    ];
    return { distance_influence, priority };
}

// Build walk-generator custom model from walk-gen sliders (same logic as buildCustomModel).
// All sliders at 5 = pure fast route.
function buildWalkModel() {
    const nV = parseInt(document.getElementById('walkNoiseLevel').value);
    const aV = parseInt(document.getElementById('walkAirLevel').value);
    const eV = parseInt(document.getElementById('walkElevLevel').value);
    const sN = _sliderToScale(nV);
    const sA = _sliderToScale(aV);
    const sE = _sliderToScale(eV);

    const _DI = [15, 35, 65, 88, 100];
    const distance_influence = Math.min(_DI[nV - 1], _DI[aV - 1], _DI[eV - 1]);

    const hour = new Date().getHours();
    const noiseBase = (hour >= 7 && hour < 22) ? _BASE_NOISE_DAY : _BASE_NOISE_NIGHT;

    const priority = [
        { if: '!in_merged_parks', multiply_by: 0.85 },
        ..._BASE_AIR.map(([k,v]) => ({ if: k, multiply_by: _scaleMult(v, sA) })),
        ...noiseBase.map(([k,v]) => ({ if: k, multiply_by: _scaleMult(v, sN) })),
        ...(sE > 0 ? _BASE_ELEV.map(([k,v]) => ({ if: k, multiply_by: _scaleMult(v, sE) })) : []),
    ];
    return { distance_influence, priority };
}

// Decode Google Encoded Polyline (precision 1e-5)
function decodePolyline(enc) {
    const out = []; let i = 0, lat = 0, lng = 0;
    while (i < enc.length) {
        let b, s = 0, r = 0;
        do { b = enc.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
        lat += (r & 1) ? ~(r >> 1) : (r >> 1); s = 0; r = 0;
        do { b = enc.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
        lng += (r & 1) ? ~(r >> 1) : (r >> 1);
        out.push([lng * 1e-5, lat * 1e-5]); // Mapbox uses [lng, lat]
    }
    return out;
}

// Prague bounding box check [lng, lat]
const PRAGUE_BOUNDS = { minLng: 14.224, maxLng: 14.707, minLat: 49.942, maxLat: 50.177 };
function isInPrague(lng, lat) {
    return lng >= PRAGUE_BOUNDS.minLng && lng <= PRAGUE_BOUNDS.maxLng &&
           lat >= PRAGUE_BOUNDS.minLat && lat <= PRAGUE_BOUNDS.maxLat;
}

// Stored coords for both route variants
let _fastRouteCoords = [];
let _klidnaRouteCoords = [];
let _activeVariant   = 'klidna'; // 'fast' | 'klidna'

async function _fetchRoute(from, to, customModel) {
    const body = {
        points: [[from.lng, from.lat], [to.lng, to.lat]],
        profile: 'normal_walk',
        points_encoded: true,
        instructions: false,
        'ch.disable': true,
        custom_model: customModel,
    };
    const r = await fetch(GH_URL, {
        method: 'POST',
        headers: GH_HEADERS,
        body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return data.paths[0];
}

function _drawRoute(coords, sourceId, layerId, color, width, opacity, dasharray) {
    const geojson = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
    };
    if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData(geojson);
    } else {
        map.addSource(sourceId, { type: 'geojson', data: geojson });
        const paint = { 'line-color': color, 'line-width': width, 'line-opacity': opacity };
        if (dasharray) paint['line-dasharray'] = dasharray;
        map.addLayer({ id: layerId, type: 'line', source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' }, paint });
    }
}

function _selectRouteOpt(variant) {
    _activeVariant = variant;
    const coords = variant === 'fast' ? _fastRouteCoords : _klidnaRouteCoords;
    _routeCoords = coords;

    document.getElementById('optFast').classList.toggle('selected', variant === 'fast');
    document.getElementById('optKlidna').classList.toggle('selected', variant === 'klidna');

    // Highlight chosen route, dim the other
    if (map.getLayer('route-fast'))   map.setPaintProperty('route-fast',   'line-opacity', variant === 'fast'   ? 0.9 : 0.25);
    if (map.getLayer('route-klidna')) map.setPaintProperty('route-klidna', 'line-opacity', variant === 'klidna' ? 0.9 : 0.25);
}

async function calculateRoute() {
    if (!ptStart || !ptEnd) return;

    if (!isInPrague(ptStart.lng, ptStart.lat) || !isInPrague(ptEnd.lng, ptEnd.lat)) {
        toast('Zvolte prosím místa v Praze.', 4000);
        return;
    }

    toast('Vypočítávám trasu…', 8000);

    // Fast model: distance_influence=100, no penalties
    const fastModel = { distance_influence: 100, priority: [] };
    // Klidná model: full user preferences
    const klidnaModel = buildCustomModel();

    const nV = parseInt(document.getElementById('noiseLevel').value);
    const aV = parseInt(document.getElementById('airLevel').value);
    const eV = parseInt(document.getElementById('elevationLevel').value);
    const allOff = nV === 5 && aV === 5 && eV === 5;

    try {
        if (allOff) {
            // All settings on "Nezáleží" — only fastest route, no compare
            const fastPath = await _fetchRoute(ptStart, ptEnd, fastModel);
            _fastRouteCoords   = decodePolyline(fastPath.points);
            _klidnaRouteCoords = [];
            _activeVariant     = 'fast';
            _routeCoords       = _fastRouteCoords;

            ['route-fast', 'route-klidna', 'route'].forEach(id => {
                if (map.getLayer(id)) map.removeLayer(id);
                if (map.getSource(id)) map.removeSource(id);
            });
            _drawRoute(_fastRouteCoords, 'route-fast', 'route-fast', '#f59e0b', 5, 0.9, null);

            const fastTimeMs = (fastPath.distance / 3500) * 3600000;
            _navRouteDist = fastPath.distance;
            _navRouteTime = fastTimeMs;
            _navRouteAvoidsNoise = false;
            _navRouteAvoidsAir   = false;

            document.getElementById('routeDistText').textContent = fmtDist(fastPath.distance);
            document.getElementById('routeTimeText').textContent = fmtTime(fastTimeMs);
            document.getElementById('routeFromLabel').textContent = _addrFrom.value.trim() || 'Startovní bod';
            document.getElementById('routeToLabel').textContent   = _addrTo.value.trim()   || 'Cíl';
            _showRouteSheet('single');
            return;
        }

        const [fastPath, klidnaPath] = await Promise.all([
            _fetchRoute(ptStart, ptEnd, fastModel),
            _fetchRoute(ptStart, ptEnd, klidnaModel),
        ]);

        _fastRouteCoords   = decodePolyline(fastPath.points);
        _klidnaRouteCoords = decodePolyline(klidnaPath.points);
        _activeVariant     = 'klidna';
        _routeCoords       = _klidnaRouteCoords;

        // Draw both routes
        _drawRoute(_fastRouteCoords,   'route-fast',   'route-fast',   '#f59e0b', 5, 0.3, [3, 2]);
        _drawRoute(_klidnaRouteCoords, 'route-klidna', 'route-klidna', '#10b981', 5, 0.9, null);

        // Remove legacy 'route' source if present
        if (map.getLayer('route')) map.removeLayer('route');
        if (map.getSource('route')) map.removeSource('route');

        const fastTimeMs   = (fastPath.distance   / 3500) * 3600000;
        const klidnaTimeMs = (klidnaPath.distance / 3500) * 3600000;

        document.getElementById('optFastDist').textContent   = fmtDist(fastPath.distance);
        document.getElementById('optFastTime').textContent   = fmtTime(fastTimeMs);
        document.getElementById('optKlidnaDist').textContent = fmtDist(klidnaPath.distance);
        document.getElementById('optKlidnaTime').textContent = fmtTime(klidnaTimeMs);

        // Diff badge
        const extraMin  = Math.round((klidnaTimeMs - fastTimeMs) / 60000);
        const distDiff  = klidnaPath.distance - fastPath.distance;
        const diffParts = [];
        if (extraMin > 0)  diffParts.push(`+${extraMin} min navíc`);
        else if (extraMin < 0) diffParts.push(`${extraMin} min ušetřeno`);
        if (Math.abs(distDiff) > 50) diffParts.push(`${distDiff > 0 ? '+' : ''}${fmtDist(Math.abs(distDiff))} vzdálenosti`);

        let qualityMsg = '';
        if (nV <= 2) qualityMsg = 'Trasa maximálně vyhýbá hlučným ulicím 🤫';
        else if (aV <= 2) qualityMsg = 'Trasa maximálně vyhýbá znečištěnému vzduchu 🌿';
        else qualityMsg = 'Vyvážená klidná trasa přes tiché zóny';

        const diffEl = document.getElementById('compareDiff');
        if (diffParts.length) {
            diffEl.innerHTML = `<span class="font-semibold">${diffParts.join(', ')}</span> — ${qualityMsg}`;
        } else {
            diffEl.textContent = qualityMsg;
        }

        // Show route sheet in compare mode
        document.getElementById('routeFromLabel').textContent = _addrFrom.value.trim() || 'Startovní bod';
        document.getElementById('routeToLabel').textContent   = _addrTo.value.trim()   || 'Cíl';
        _showRouteSheet('compare');

        // Store dist/time for summary
        _navRouteDist = klidnaPath.distance;
        _navRouteTime = klidnaTimeMs;
        _navRouteAvoidsNoise = nV <= 2;
        _navRouteAvoidsAir   = aV <= 2;

    } catch (e) {
        console.error('Chyba při výpočtu trasy:', e);
        toast('Chyba výpočtu trasy: ' + e.message, 5000);
    }
}

// ═══════════════════════════════════════════════════════════
// HELPERS: toast, fmtDist, fmtTime, fetchJSON
// ═══════════════════════════════════════════════════════════
function toast(msg, ms = 3500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), ms);
}
function fmtDist(m) {
    return m >= 1000 ? (m / 1000).toFixed(2) + ' km' : Math.round(m) + ' m';
}
function fmtTime(ms) {
    const min = Math.round(ms / 60000);
    return min >= 60 ? `${Math.floor(min/60)} h ${min % 60} min` : `${min} min`;
}
async function fetchJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
}

// ═══════════════════════════════════════════════════════════
// NAVIGATION MODE
// ═══════════════════════════════════════════════════════════
let _navMode     = false;
let _navFromSOS  = false;
let _navWatchId  = null;
let _navUserMarker = null;
let _navPrevLat  = null, _navPrevLng = null;
let _navBearing  = 0;
let _routeCoords = []; // [[lng, lat], ...]

function _haversineM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function _bearingTo(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180;
    const dLon = (lon2 - lon1) * r;
    const y = Math.sin(dLon) * Math.cos(lat2 * r);
    const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos(dLon);
    return (Math.atan2(y, x) / r + 360) % 360;
}

function _navRemaining(lat, lng) {
    let minIdx = 0, minD = Infinity;
    for (let i = 0; i < _routeCoords.length; i++) {
        const d = _haversineM(lat, lng, _routeCoords[i][1], _routeCoords[i][0]);
        if (d < minD) { minD = d; minIdx = i; }
    }
    let rem = 0;
    for (let i = minIdx; i < _routeCoords.length - 1; i++) {
        rem += _haversineM(_routeCoords[i][1], _routeCoords[i][0], _routeCoords[i+1][1], _routeCoords[i+1][0]);
    }
    return rem;
}

function startNavigation() {
    if (!_routeCoords.length) { toast('Nejprve vypočítej trasu.', 3000); return; }
    _navMode = true;

    _navFromSOS = !document.getElementById('sosInfoCard').classList.contains('card-hidden');
    if (_navFromSOS) {
        document.getElementById('sosInfoCard').classList.add('card-hidden');
        document.getElementById('sosNavRow').classList.add('hidden');
    } else {
        _hideRouteSheet();
    }
    document.getElementById('navHUD').classList.remove('nav-hidden');
    // Move SOS to bottom-left, hide top-left area and top-right utility buttons
    const _navLeft = document.getElementById('floatBtnsNavLeft');
    _navLeft.appendChild(document.getElementById('sosBtn'));
    _navLeft.classList.remove('hidden');
    document.getElementById('floatBtnsLeft').style.visibility = 'hidden';
    document.getElementById('searchRouteBtn').style.display = 'none';
    document.getElementById('devThemeToggle').style.display = 'none';
    _syncFloatBtns();

    // Navigation puck: morph userMarker into arrow, or create a fresh one
    const startCoord = _routeCoords[0];
    if (userMarker) {
        _setMarkerArrow(userMarker.getElement());
        userMarker.setLngLat(startCoord);
        _navUserMarker = userMarker;
    } else {
        const el = document.createElement('div');
        _setMarkerArrow(el);
        _navUserMarker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat(startCoord)
            .addTo(map);
    }

    map.easeTo({ pitch: 60, zoom: 17.5, center: startCoord, duration: 900 });

    if (!('geolocation' in navigator)) { toast('GPS není dostupné.', 4000); stopNavigation(); return; }
    _navMode._finishing = false;
    _navWatchId = navigator.geolocation.watchPosition(
        _navTick,
        (err) => toast('GPS chyba: ' + err.message, 3500),
        { enableHighAccuracy: true, maximumAge: 500 }
    );
}

function stopNavigation(showSummary = false) {
    _navMode = false;
    if (_navWatchId !== null) { navigator.geolocation.clearWatch(_navWatchId); _navWatchId = null; }
    if (_navUserMarker) {
        if (_navUserMarker === userMarker) {
            _setMarkerDot(userMarker.getElement()); // restore dot in-place
        } else {
            _navUserMarker.remove();
        }
        _navUserMarker = null;
    }
    _navPrevLat = null; _navPrevLng = null;
    document.getElementById('navHUD').classList.add('nav-hidden');
    // Restore SOS to top-left and unhide top-right utility buttons
    document.getElementById('floatBtnsLeft').appendChild(document.getElementById('sosBtn'));
    document.getElementById('floatBtnsNavLeft').classList.add('hidden');
    document.getElementById('floatBtnsLeft').style.visibility = '';
    document.getElementById('searchRouteBtn').style.display = '';
    document.getElementById('devThemeToggle').style.display = '';
    map.easeTo({ pitch: 0, bearing: 0, zoom: 14, duration: 900 });
    if (_navFromSOS) {
        document.getElementById('sosInfoCard').classList.remove('card-hidden');
        document.getElementById('sosNavRow').classList.remove('hidden');
    } else {
        const hasCompare = _fastRouteCoords.length > 0 && _klidnaRouteCoords.length > 0;
        _showRouteSheet(hasCompare ? 'compare' : 'single');
    }
    _navFromSOS = false;
    _syncFloatBtns();
    if (showSummary) _showSummary();
}

function _navTick(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const hdg = pos.coords.heading; // native compass heading when available

    // Bearing: prefer device compass, fall back to movement vector
    if (hdg !== null && !isNaN(hdg) && hdg >= 0) {
        _navBearing = hdg;
    } else if (_navPrevLat !== null) {
        const moved = _haversineM(lat, lng, _navPrevLat, _navPrevLng);
        if (moved > 3) _navBearing = _bearingTo(_navPrevLat, _navPrevLng, lat, lng);
    }
    _navPrevLat = lat; _navPrevLng = lng;

    // Move puck to live GPS position
    if (_navUserMarker) _navUserMarker.setLngLat([lng, lat]);

    // Rotate map so direction of travel is always screen-up
    map.easeTo({ center: [lng, lat], bearing: _navBearing, pitch: 60, zoom: 17.5, duration: 700 });

    // Update HUD
    const rem = _navRemaining(lat, lng);
    const lastPt = _routeCoords[_routeCoords.length - 1];
    if (lastPt && _haversineM(lat, lng, lastPt[1], lastPt[0]) < 20) {
        document.getElementById('navDistRemain').textContent = 'Jsi na místě ✓';
        document.getElementById('navTimeRemain').textContent = '';
        // Auto-stop after 3 s and show summary
        if (!_navMode._finishing) {
            _navMode._finishing = true;
            setTimeout(() => stopNavigation(true), 3000);
        }
    } else {
        document.getElementById('navDistRemain').textContent = fmtDist(rem);
        document.getElementById('navTimeRemain').textContent = 'ještě ~ ' + fmtTime((rem / 3500) * 3600000);
    }
}

// ═══════════════════════════════════════════════════════════
// SOS – Najbližší tichý park / Klinika / Knihovna
// ═══════════════════════════════════════════════════════════
let _parksGeoJSON = null;
let _medGeoJSON   = null;
let _libGeoJSON   = null;
let sosMark = null, sosDestMark = null;
let sosPickingMode = false;
let _sosMode = 'park'; // 'park' | 'med' | 'lib'

async function _ensureParks() {
    if (_parksGeoJSON) return;
    _parksGeoJSON = await fetchJSON('../../GreenZone/SOS/parks_sos.geojson');
}

async function _ensureMed() {
    if (_medGeoJSON) return;
    _medGeoJSON = await fetchJSON('../../GreenZone/Med/Med_clean.geojson');
}

async function _ensureLib() {
    if (_libGeoJSON) return;
    _libGeoJSON = await fetchJSON('../../GreenZone/Libraries/Libraries_prague.geojson');
}

// ── SOS Choice Modal ──────────────────────────────────────
function _showSOSChoice() {
    const overlay = document.getElementById('sosChoiceOverlay');
    const sheet   = document.getElementById('sosChoiceSheet');
    overlay.style.pointerEvents = 'auto';
    overlay.style.opacity = '1';
    sheet.style.transform = 'translateY(0)';
}

function _hideSOSChoice() {
    const overlay = document.getElementById('sosChoiceOverlay');
    const sheet   = document.getElementById('sosChoiceSheet');
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    sheet.style.transform = 'translateY(100%)';
}

function _dist2(la1, ln1, la2, ln2) {
    const d1 = la1 - la2, d2 = (ln1 - ln2) * 0.64;
    return d1 * d1 + d2 * d2;
}

function _findNearestPark(lat, lng) {
    const feats = _parksGeoJSON?.features ?? [];
    let best = null, bestD = Infinity;
    for (const f of feats) {
        const c = f.geometry?.coordinates;
        if (!c) continue;
        const d = _dist2(lat, lng, c[1], c[0]);
        if (d < bestD) { bestD = d; best = { f, c }; }
    }
    return best;
}

function _findNearestClinic(lat, lng) {
    const feats = _medGeoJSON?.features ?? [];
    let best = null, bestD = Infinity;
    for (const f of feats) {
        const c = f.geometry?.coordinates;
        if (!c) continue;
        const d = _dist2(lat, lng, c[1], c[0]);
        if (d < bestD) { bestD = d; best = { f, c }; }
    }
    return best;
}

function _findNearestLibrary(lat, lng) {
    const feats = _libGeoJSON?.features ?? [];
    let best = null, bestD = Infinity;
    for (const f of feats) {
        const c = f.geometry?.coordinates;
        if (!c) continue;
        const d = _dist2(lat, lng, c[1], c[0]);
        if (d < bestD) { bestD = d; best = { f, c }; }
    }
    return best;
}

function _sosClearLayers() {
    if (sosMark) { sosMark.remove(); sosMark = null; }
    if (sosDestMark) { sosDestMark.remove(); sosDestMark = null; }
    if (map.getLayer('sos-line'))   map.removeLayer('sos-line');
    if (map.getSource('sos-route')) map.removeSource('sos-route');
}

// Clear all walk + transit route lines from the map and close the route sheet.
function _clearAllRoutes() {
    ['route-fast', 'route-klidna', 'route'].forEach(id => {
        if (map.getLayer(id))  map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
    });
    _routeCoords = []; _fastRouteCoords = []; _klidnaRouteCoords = [];
    _clearTransitPlanMap();
    _hideRouteSheet();
    const st = document.getElementById('sheetTransit');
    if (st) st.classList.add('hidden');
}

function cancelSOS() {
    _sosClearLayers();
    _hideSOSChoice();
    sosPickingMode = false;
    const btn = document.getElementById('sosBtn');
    btn.classList.remove('picking', 'cancel', 'sos-pulse');
    document.getElementById('sosBtnText').textContent = 'Potřebuji klid';
    btn.querySelector('i').className = 'ph-fill ph-leaf text-lg text-white';
    map.getCanvas().style.cursor = '';
    document.getElementById('sosNavRow').classList.add('hidden');
    _routeCoords = [];
    _navFromSOS = false;
    const card = document.getElementById('sosInfoCard');
    card.classList.add('card-hidden');
    card.classList.remove('mode-med', 'mode-lib');
    _syncFloatBtns();
}

async function startSOS() {
    const btn = document.getElementById('sosBtn');
    // If already active → cancel
    if (btn.classList.contains('cancel') || sosPickingMode) { cancelSOS(); return; }
    // Clear any existing route before showing SOS
    _clearAllRoutes();
    // Show choice modal
    _showSOSChoice();
}

async function _startSOSWithMode(mode) {
    _sosMode = mode;
    _hideSOSChoice();
    _sosClearLayers();

    const btn = document.getElementById('sosBtn');
    const btnText = document.getElementById('sosBtnText');
    btn.classList.add('picking');
    btnText.textContent = '…';
    btn.querySelector('i').className = 'ph ph-spinner-gap animate-spin text-base text-white';

    // 1. Load data
    try {
        if (mode === 'park') {
            await _ensureParks();
        } else if (mode === 'med') {
            await _ensureMed();
        } else {
            await _ensureLib();
        }
    } catch (e) {
        console.error('[SOS] Failed to load data:', e);
        toast('Chyba načítání dat: ' + e?.message, 5000);
        cancelSOS();
        return;
    }

    // 2. Try geolocation
    let gotGeo = false;
    try {
        const pos = await new Promise((resolve, reject) => {
            if (!('geolocation' in navigator)) return reject(new Error('no-geo'));
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 6000
            });
        });
        if (!isInPrague(pos.coords.longitude, pos.coords.latitude)) {
            toast('Vaše GPS poloha je mimo Prahu. Klikněte na svou polohu na mapě.', 5000);
        } else {
            gotGeo = true;
            handleSOSClick(pos.coords.latitude, pos.coords.longitude);
        }
    } catch (_) {
        // Geo failed or denied → switch to manual tap mode
    }

    if (!gotGeo) {
        sosPickingMode = true;
        map.getCanvas().style.cursor = 'crosshair';
        btnText.textContent = 'Klikněte na mapu';
        btn.querySelector('i').className = 'ph ph-map-pin text-base text-white';

        document.getElementById('sosDestIcon').textContent = '📍';
        document.getElementById('sosParkName').textContent = 'Klikněte na své místo na mapě';
        document.getElementById('sosDistText').textContent = '';
        document.getElementById('sosTimeText').textContent = '';
        document.getElementById('sosTimeSep').classList.add('hidden');
        document.getElementById('sosSpinner').classList.add('hidden');
        document.getElementById('sosSpinner').classList.remove('flex');
        const card = document.getElementById('sosInfoCard');
        card.classList.remove('mode-med', 'mode-lib');
        if (mode === 'med')  card.classList.add('mode-med');
        if (mode === 'lib')  card.classList.add('mode-lib');
        card.classList.remove('card-hidden');
        _syncFloatBtns();
    }
}

async function handleSOSClick(lat, lng) {
    sosPickingMode = false;
    const btn = document.getElementById('sosBtn');
    const btnText = document.getElementById('sosBtnText');
    btn.classList.remove('picking');
    btn.classList.add('cancel');
    btnText.textContent = 'Zrušit';
    btn.querySelector('i').className = 'ph ph-x text-lg text-white';
    map.getCanvas().style.cursor = '';

    _sosClearLayers();

    // "You are here" marker
    const youEl = document.createElement('div');
    youEl.className = 'pin-sos-you';
    youEl.textContent = 'Jsem zde';
    sosMark = new mapboxgl.Marker({ element: youEl, anchor: 'bottom' })
        .setLngLat([lng, lat]).addTo(map);

    // Resolve destination depending on mode
    let destLng, destLat, destName, destIcon, pinClass;
    if (_sosMode === 'med') {
        const clinic = _findNearestClinic(lat, lng);
        if (!clinic) { toast('Žádná klinika nenalezena.', 4000); cancelSOS(); return; }
        [destLng, destLat] = clinic.c;
        const rawName = clinic.f.properties?.nazev_zar || '';
        destName = rawName.trim() || 'Klinika';
        destIcon = '🏥';
        pinClass = 'pin-sos-park';
    } else if (_sosMode === 'lib') {
        const lib = _findNearestLibrary(lat, lng);
        if (!lib) { toast('Žádná knihovna nenalezena.', 4000); cancelSOS(); return; }
        [destLng, destLat] = lib.c;
        destName = lib.f.properties?.name?.trim() || 'Knihovna';
        destIcon = '📚';
        pinClass = 'pin-sos-park';
    } else {
        const park = _findNearestPark(lat, lng);
        if (!park) { toast('\u017dádný vhodný park nenalezen.', 4000); cancelSOS(); return; }
        [destLng, destLat] = park.c;
        const rawName = park.f.properties?.name || '';
        const cleanName = rawName.replace(/\s*\(.*?\)/g, '').trim();
        destName = (cleanName === '' || /zelen/i.test(cleanName)) ? 'Park' : cleanName;
        destIcon = '🌳';
        pinClass = 'pin-sos-park';
    }

    const destEl = document.createElement('div');
    destEl.className = pinClass;
    destEl.textContent = `${destIcon} ${destName}`;
    sosDestMark = new mapboxgl.Marker({ element: destEl, anchor: 'bottom' })
        .setLngLat([destLng, destLat]).addTo(map);

    document.getElementById('sosParkName').textContent = `${destIcon} ${destName}`;
    document.getElementById('sosDistText').textContent = '';
    document.getElementById('sosTimeText').textContent = '';
    const spinner = document.getElementById('sosSpinner');
    spinner.classList.remove('hidden');
    spinner.classList.add('flex');
    document.getElementById('sosInfoCard').classList.remove('card-hidden');
    _syncFloatBtns();

    try {
        const body = {
            points: [[lng, lat], [destLng, destLat]],
            profile: 'normal_walk',
            points_encoded: true,
            instructions: false,
            'ch.disable': true
        };
        const res = await fetch(GH_URL, {
            method: 'POST',
            headers: GH_HEADERS,
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errText.substring(0, 150)}`);
        }
        const data = await res.json();
        const path = data.paths[0];
        const coords = decodePolyline(path.points);

        const lineColor = _sosMode === 'med' ? '#3b82f6' : _sosMode === 'lib' ? '#8b5cf6' : '#10b981';
        if (map.getSource('sos-route')) {
            map.getSource('sos-route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } });
            if (map.getLayer('sos-line')) map.setPaintProperty('sos-line', 'line-color', lineColor);
        } else {
            map.addSource('sos-route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } });
            map.addLayer({
                id: 'sos-line', type: 'line', source: 'sos-route',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': lineColor, 'line-width': 6, 'line-opacity': 0.95, 'line-dasharray': [2, 1.5] }
            });
        }

        const bounds = coords.reduce(
            (b, c) => b.extend(c),
            new mapboxgl.LngLatBounds(coords[0], coords[0])
        );
        map.fitBounds(bounds, { padding: 80, maxZoom: 16 });

        _routeCoords = coords;
        document.getElementById('sosNavRow').classList.remove('hidden');
        document.getElementById('sosDistText').textContent = fmtDist(path.distance);
        document.getElementById('sosTimeText').textContent = fmtTime(path.time);
        document.getElementById('sosTimeSep').classList.remove('hidden');
    } catch (e) {
        const msg = e?.message || String(e);
        toast('Chyba trasy: ' + msg, 6000);
        console.error('SOS route error:', e);
    }

    spinner.classList.add('hidden');
    spinner.classList.remove('flex');
}

document.getElementById('sosBtn').addEventListener('click', startSOS);
document.getElementById('sosCancelBtn').addEventListener('click', cancelSOS);
document.getElementById('sosNavBtn').addEventListener('click', startNavigation);
document.getElementById('sosParkChoice').addEventListener('click', () => _startSOSWithMode('park'));
document.getElementById('sosMedChoice').addEventListener('click',  () => _startSOSWithMode('med'));
document.getElementById('sosLibChoice').addEventListener('click',  () => _startSOSWithMode('lib'));
document.getElementById('sosChoiceCancel').addEventListener('click', () => {
    _hideSOSChoice();
    cancelSOS();
});
document.getElementById('routeSheetCloseBtn').addEventListener('click', () => {
    if (_navMode) stopNavigation(false);
    _routeCoords = [];
    _fastRouteCoords = [];
    _klidnaRouteCoords = [];
    _hideRouteSheet();
    ['route-fast', 'route-klidna', 'route'].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
    });
    // Also clear transit plan polylines
    _clearTransitPlanMap();
    const st = document.getElementById('sheetTransit');
    if (st) st.classList.add('hidden');
    _tpMapStep = 0;
    ptStart = null; ptEnd = null;
    _coordFrom = null; _coordTo = null;
    _addrFrom.value = ''; _addrTo.value = '';
    _clearFromGPS();
    if (markerStart) { markerStart.remove(); markerStart = null; }
    if (markerEnd)   { markerEnd.remove();   markerEnd   = null; }
    if (_tpMarkerFrom) { _tpMarkerFrom.remove(); _tpMarkerFrom = null; }
    if (_tpMarkerTo)   { _tpMarkerTo.remove();   _tpMarkerTo   = null; }
    _markerFrom = null; _markerTo = null;
    _spClose();
});

document.getElementById('sheetNavBtn').addEventListener('click', startNavigation);
document.getElementById('navStopBtn').addEventListener('click', () => stopNavigation(true));

// Click on map to add Start / End
map.on('click', (e) => {
    const { lng, lat } = e.lngLat;

    // SOS active: picking mode handles the tap; if SOS card is just showing, block route building
    if (sosPickingMode || sosMark) {
        if (sosPickingMode) handleSOSClick(lat, lng);
        return;
    }

    // MHD tab active → map-tap transit planner (all walking features disabled)
    if (_transitVisible) {
        _handleTransitMapClick(lat, lng);
        return;
    }

    // Helper: fill a field with reverse-geocoded label for a map point
    function _fillReverse(field, lng, lat) {
        const input = field === 'from' ? _addrFrom : _addrTo;
        input.value = '…';
        _reverseGeocode(lng, lat).then(label => {
            input.value = label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        });
    }

    _spOpen();

    if (!ptStart) {
        ptStart = { lng, lat };
        _coordFrom = { lng, lat };
        markerStart = new mapboxgl.Marker({ color: '#22c55e' }).setLngLat([lng, lat]).addTo(map);
        _markerFrom = markerStart;
        _activeField = 'from';
        _fillReverse('from', lng, lat);
        setTimeout(() => { _addrTo.focus(); _activeField = 'to'; }, 120);

    } else if (!ptEnd) {
        ptEnd = { lng, lat };
        _coordTo = { lng, lat };
        markerEnd = new mapboxgl.Marker({ color: '#ef4444' }).setLngLat([lng, lat]).addTo(map);
        _markerTo = markerEnd;
        _activeField = 'to';
        _fillReverse('to', lng, lat);
        calculateRoute();

    } else {
        // Third tap — clear everything, reset to empty state
        ptStart = null; ptEnd = null;
        _coordFrom = null; _coordTo = null;
        _addrFrom.value = ''; _addrTo.value = '';
        _clearFromGPS();
        if (markerStart) { markerStart.remove(); markerStart = null; }
        if (markerEnd)   { markerEnd.remove();   markerEnd   = null; }
        _markerFrom = null; _markerTo = null;
        ['route-fast', 'route-klidna', 'route'].forEach(id => {
            if (map.getLayer(id)) map.removeLayer(id);
            if (map.getSource(id)) map.removeSource(id);
        });
        _routeCoords = []; _fastRouteCoords = []; _klidnaRouteCoords = [];
        _hideRouteSheet();
        _spClose();
        return;
    }
});

// App settings
const routeSettings = {
    noise: 3,
    air: 3,
    elevation: 3
};

document.getElementById('applySettingsBtn').addEventListener('click', () => {
    routeSettings.noise = parseInt(document.getElementById('noiseLevel').value);
    routeSettings.air = parseInt(document.getElementById('airLevel').value);
    routeSettings.elevation = parseInt(document.getElementById('elevationLevel').value);

    console.log('Nové parametry pro generování trasy:', routeSettings);

    const btn = document.getElementById('applySettingsBtn');
    const originalContent = btn.innerHTML;

    btn.innerHTML = '<i class="ph ph-spinner-gap animate-spin text-xl"></i> Přepočítávám...';

    // Re-route based on current mode
    const task = _transitVisible && (_coordFrom && _coordTo)
        ? _tpAutoSearch()
        : calculateRoute();

    task.then(() => {
        btn.innerHTML = '<i class="ph ph-check-circle text-xl"></i> Trasa aktualizována';
        btn.classList.replace('bg-brand-600', 'bg-green-600');        
        setTimeout(() => {
            closeBottomSheet();
            setTimeout(() => {
                btn.innerHTML = originalContent;
                btn.classList.replace('bg-green-600', 'bg-brand-600');
            }, 300);
        }, 800);
    });
});

// ═══════════════════════════════════════════════════════════
// ADDRESS SEARCH PANEL
// ═══════════════════════════════════════════════════════════
const GH_BBOX_STR = `${PRAGUE_BOUNDS.minLng},${PRAGUE_BOUNDS.minLat},${PRAGUE_BOUNDS.maxLng},${PRAGUE_BOUNDS.maxLat}`;

const _searchPanel   = document.getElementById('searchPanel');
const _addrFrom      = document.getElementById('addrFrom');
const _addrTo        = document.getElementById('addrTo');
const _suggestions   = document.getElementById('addrSuggestions');
const _searchBtn     = document.getElementById('searchRouteBtn');
const _geoFromBtn    = document.getElementById('geoFromBtn');
const _swapBtn       = document.getElementById('swapAddrBtn');

let _activeField = null;      // 'from' | 'to'
let _coordFrom   = null;      // { lng, lat, label }
let _coordTo     = null;
let _geocodeTimer = null;
let _markerFrom  = null;
let _markerTo    = null;
let _fromIsGPS   = false;     // 'from' marker is the user's GPS arrow

function _setMarkerArrow(el) {
    el.style.cssText = '';
    el.className = 'nav-puck';
    el.innerHTML = `
        <svg class="nav-arrow-svg" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 3 L35 34 Q19 26 3 34 Z"
                fill="#22c55e" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
          <circle cx="19" cy="28" r="4"
                  fill="#ffffff" opacity="0.92"/>
        </svg>`;
}

function _setMarkerDot(el) {
    el.className = '';
    el.innerHTML = '';
    el.style.cssText = 'width:16px;height:16px;background-color:#22c55e;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(0,0,0,0.3);';
}

function _clearFromGPS() {
    if (!_fromIsGPS) return;
    _fromIsGPS = false;
    if (userMarker) _setMarkerDot(userMarker.getElement());
    // Detach references without removing userMarker — it stays on map as a dot
    if (markerStart === userMarker) markerStart = null;
    if (_markerFrom === userMarker) _markerFrom = null;
}

function _spOpen() {
    _searchPanel.classList.remove('sp-hidden');
    _searchPanel.classList.add('sp-visible');
    _searchBtn.querySelector('i').className = 'ph ph-x text-xl text-gray-700 dark:text-gray-200';
}
function _spClose() {
    _searchPanel.classList.add('sp-hidden');
    _searchPanel.classList.remove('sp-visible');
    _hideSuggestions();
    _searchBtn.querySelector('i').className = 'ph ph-magnifying-glass text-xl text-gray-700 dark:text-gray-200';
    _activeField = null;
}

_searchBtn.addEventListener('click', () => {
    const isOpen = _searchPanel.classList.contains('sp-visible');
    if (isOpen) {
        _spClose();
    } else {
        _clearAllRoutes();
        _spOpen();
    }
});
document.getElementById('closePanelBtn').addEventListener('click', () => _spClose());

// Hide suggestions when tapping outside
document.addEventListener('pointerdown', (e) => {
    if (!_searchPanel.contains(e.target) && !_searchBtn.contains(e.target)) {
        _hideSuggestions();
    }
}, true);

function _hideSuggestions() {
    _suggestions.classList.add('hidden');
    _suggestions.innerHTML = '';
}

// ── Geocoding via Nominatim (OSM) — nativní čeština, plná adresní databáze Praha ──
let _lastResults = [];

// ── Route sheet helpers ──────────────────────────────────
function _syncNavBtn() {
    const wrap = document.getElementById('sheetNavBtnWrap');
    if (!wrap) return;
    const show = _transitVisible ? (_routeCoords.length > 0) : _fromIsGPS;
    wrap.classList.toggle('hidden', !show);
}
function _showRouteSheet(state) {
    _spClose(); // close address panel so the route sheet is clearly visible
    const sheetCompare = document.getElementById('sheetCompare');
    const sheetSingle  = document.getElementById('sheetSingle');
    const sheetTransit = document.getElementById('sheetTransit');
    sheetCompare.classList.toggle('hidden', state !== 'compare');
    sheetSingle.classList.toggle('hidden',  state !== 'single');
    if (sheetTransit) sheetTransit.classList.toggle('hidden', state !== 'transit');
    document.getElementById('routeSheet').classList.remove('sheet-hidden');
    const tb = document.getElementById('tabBar');
    if (tb) { tb.style.opacity = '0'; tb.style.transform = 'translateY(8px)'; tb.style.pointerEvents = 'none'; }
    _syncNavBtn();
    _syncFloatBtns();
}
function _hideRouteSheet() {
    document.getElementById('routeSheet').classList.add('sheet-hidden');
    const tb = document.getElementById('tabBar');
    if (tb) { tb.style.opacity = ''; tb.style.transform = ''; tb.style.pointerEvents = ''; }
    _syncFloatBtns();
}

// Raise/lower floating buttons when info card appears/disappears
function _syncFloatBtns() {
    const sheet = document.getElementById('routeSheet');
    const sheetVisible = !sheet.classList.contains('sheet-hidden');
    const sosVisible   = !document.getElementById('sosInfoCard').classList.contains('card-hidden');
    let bottom;
    if (sheetVisible) {
        const inner = sheet.querySelector('div');
        bottom = (inner ? inner.offsetHeight + 16 : 300) + 'px';
    } else if (sosVisible) {
        bottom = '11.5rem';
    } else {
        bottom = '7rem';
    }
    document.getElementById('floatBtnsRight').style.bottom = bottom;
    const navLeft = document.getElementById('floatBtnsNavLeft');
    if (navLeft && !navLeft.classList.contains('hidden')) navLeft.style.bottom = bottom;
}

// ── Swipe-down-to-close gesture on route sheet handle ───
(function () {
    const handle = document.getElementById('routeSheetHandle');
    const sheet  = document.getElementById('routeSheet');
    let startY = 0, dragging = false;
    handle.addEventListener('touchstart', e => {
        startY   = e.touches[0].clientY;
        dragging = true;
        sheet.style.transition = 'none';
    }, { passive: true });
    handle.addEventListener('touchmove', e => {
        if (!dragging) return;
        const dy = e.touches[0].clientY - startY;
        if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    handle.addEventListener('touchend', e => {
        if (!dragging) return;
        dragging = false;
        sheet.style.transition = '';
        const dy = e.changedTouches[0].clientY - startY;
        if (dy > 90) {
            // Dismiss: same as close button
            document.getElementById('routeSheetCloseBtn').click();
        } else {
            sheet.style.transform = '';
        }
    });
})();

// Reverse geocode a map point (Nominatim)
async function _reverseGeocode(lng, lat) {
    const params = new URLSearchParams({
        format: 'jsonv2', lat, lon: lng,
        'accept-language': 'cs', zoom: '17', addressdetails: '1',
        email: 'app@ticha-praha.cz',
    });
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
        if (!r.ok) return null;
        const item = await r.json();
        if (item.error) return null;
        const a = item.address || {};
        const houseNum = a.house_number || '';
        const road     = a.road || a.pedestrian || a.footway || a.path || '';
        const name     = item.name || '';
        if (name && name !== road)
            return houseNum ? `${name}, ${road} ${houseNum}`.trim() : name;
        if (road)
            return houseNum ? `${road} ${houseNum}` : road;
        return item.display_name.split(',').slice(0, 2).join(', ').trim() || null;
    } catch (e) {
        return null;
    }
}

async function _geocode(query) {
    if (!query || query.trim().length < 2) return [];
    // accept-language jako URL param — bez custom headers, žádný CORS preflight
    const params = new URLSearchParams({
        q: query,
        format: 'jsonv2',
        addressdetails: '1',
        limit: '8',
        countrycodes: 'cz',
        bounded: '1',
        viewbox: `${PRAGUE_BOUNDS.minLng},${PRAGUE_BOUNDS.maxLat},${PRAGUE_BOUNDS.maxLng},${PRAGUE_BOUNDS.minLat}`,
        'accept-language': 'cs',
        dedupe: '1',
        email: 'app@ticha-praha.cz',
    });
    const url = `https://nominatim.openstreetmap.org/search?${params}`;
    try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const items = await r.json();
        return items
            .map(item => {
                const lng = parseFloat(item.lon);
                const lat = parseFloat(item.lat);
                if (!isInPrague(lng, lat)) return null;
                const a = item.address || {};
                const houseNum = a.house_number || '';
                const road     = a.road || a.pedestrian || a.footway || a.path || '';
                const name     = item.name || '';
                let main;
                if (name && name !== road) {
                    main = houseNum ? `${name}, ${road} ${houseNum}`.trim() : name;
                } else if (road) {
                    main = houseNum ? `${road} ${houseNum}` : road;
                } else {
                    main = item.display_name.split(',')[0];
                }
                const district = a.city_district || a.suburb || a.neighbourhood || '';
                const city     = a.city || a.town || 'Praha';
                const sub      = district ? `${district}, ${city}` : city;
                return {
                    center: [lng, lat],
                    _main:  main,
                    _sub:   sub,
                    _class: item.class || '',
                    _type:  item.type  || '',
                    _name:  name,
                };
            })
            .filter(Boolean);
    } catch (e) {
        console.warn('[geocode]', e);
        return [];
    }
}

// Ikona podle třídy/typu OSM
function _poiIcon(f) {
    const cls  = (f._class || '').toLowerCase();
    const type = (f._type  || '').toLowerCase();
    const name = (f._name  || '').toLowerCase();
    const all  = cls + '/' + type + '/' + name;
    if (/museum|muzeum|galerie|gallery/.test(all))              return 'ph-buildings';
    if (/subway|metro/.test(all))                               return 'ph-train-subway';
    if (/tram|trolleybus|bus_stop|bus_station|railway|nádraží|train/.test(all)) return 'ph-bus';
    if (/^amenity\/stop_position|public_transport/.test(all))   return 'ph-bus';
    if (/park|garden|zahrad|forest|wood|nature/.test(all))      return 'ph-tree';
    if (/restaurant|cafe|bar|pub|fast_food|food_court|bistr/.test(all)) return 'ph-fork-knife';
    if (/hospital|clinic|pharmacy|nemocnice|lékárna/.test(all)) return 'ph-first-aid-kit';
    if (/school|university|college|kindergarten|faculty/.test(all)) return 'ph-graduation-cap';
    if (/church|cathedral|chapel|kostel|katedrála/.test(all))   return 'ph-church';
    if (/hotel|hostel|motel|guest_house/.test(all))             return 'ph-bed';
    if (/supermarket|shop|mall|market|obchod/.test(all))        return 'ph-shopping-bag';
    if (/theatre|cinema|nightclub|arts_centre/.test(all))       return 'ph-ticket';
    if (/highway|road|street|pedestrian|footway/.test(cls))     return 'ph-house-line';
    if (/building/.test(cls))                                   return 'ph-house-line';
    return 'ph-map-pin';
}

function _renderSuggestions(features) {
    _suggestions.innerHTML = '';
    if (!features.length) {
        _suggestions.classList.add('hidden');
        return;
    }
    features.forEach(f => {
        const main = f._main || (f.place_name || '').split(',')[0] || '?';
        const sub  = f._sub  || '';
        const icon = _poiIcon(f);
        const div  = document.createElement('div');
        div.className = 'addr-suggestion';
        div.innerHTML = `
            <i class="ph ${icon} addr-icon"></i>
            <div class="min-w-0">
                <div class="addr-main dark:text-gray-100 truncate">${main}</div>
                ${sub ? `<div class="addr-sub truncate">${sub}</div>` : ''}
            </div>`;
        div.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            const [lng, lat] = f.center;
            _selectResult(lng, lat, main + (sub ? ', ' + sub : ''));
        });
        _suggestions.appendChild(div);
    });
    _suggestions.classList.remove('hidden');
}

function _selectResult(lng, lat, label) {
    _hideSuggestions();
    if (!isInPrague(lng, lat)) {
        toast('Zvolte prosím místo v Praze.', 4000);
        return;
    }
    if (_activeField === 'from') {
        _coordFrom = { lng, lat };
        _addrFrom.value = label;
        _addrFrom.blur();
        _updateMarker('from', lng, lat);
        _maybeRoute();
        if (!_coordTo) { _addrTo.focus(); _activeField = 'to'; }
    } else if (_activeField === 'to') {
        _coordTo = { lng, lat };
        _addrTo.value = label;
        _addrTo.blur();
        _updateMarker('to', lng, lat);
        _maybeRoute();
    }
}

function _updateMarker(which, lng, lat) {
    if (which === 'from') {
        ptStart = { lng, lat };
        if (_transitVisible) {
            // In transit mode, always use teardrop pins
            if (markerStart) markerStart.remove();
            markerStart = new mapboxgl.Marker({ element: _makeTpPin('#22c55e'), anchor: 'bottom' })
                .setLngLat([lng, lat]).addTo(map);
            _markerFrom = markerStart;
        } else if (_markerFrom) {
            if (_fromIsGPS) {
                // Switching from GPS arrow to a typed address — restore userMarker dot, new separate pin
                _clearFromGPS(); // restores dot, nulls _markerFrom & markerStart
                _markerFrom = new mapboxgl.Marker({ color: '#22c55e' }).setLngLat([lng, lat]).addTo(map);
                markerStart = _markerFrom;
            } else {
                _markerFrom.setLngLat([lng, lat]);
            }
        } else {
            if (markerStart) markerStart.remove();
            _markerFrom = new mapboxgl.Marker({ color: '#22c55e' }).setLngLat([lng, lat]).addTo(map);
            markerStart = _markerFrom;
        }
    } else {
        ptEnd = { lng, lat };
        if (_transitVisible) {
            if (markerEnd) markerEnd.remove();
            markerEnd = new mapboxgl.Marker({ element: _makeTpPin('#ef4444'), anchor: 'bottom' })
                .setLngLat([lng, lat]).addTo(map);
            _markerTo = markerEnd;
        } else if (_markerTo) { _markerTo.setLngLat([lng, lat]); }
        else {
            if (markerEnd) markerEnd.remove();
            _markerTo = new mapboxgl.Marker({ color: '#ef4444' }).setLngLat([lng, lat]).addTo(map);
            markerEnd = _markerTo;
        }
    }
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 14) });
}

function _maybeRoute() {
    if (ptStart && ptEnd) {
        if (_transitVisible) _tpAutoSearch();
        else calculateRoute();
    }
}

// ── Input handlers ──
let _lastFromResults = [];
let _lastToResults   = [];

function _setInputLoading(field, on) {
    const btn = field === 'from' ? _geoFromBtn : _swapBtn;
    // Показываем спиннер в кнопке справа от поля
    if (field === 'from') {
        _geoFromBtn.querySelector('i').className = on
            ? 'ph ph-spinner-gap text-base animate-spin text-gray-400'
            : 'ph ph-crosshair text-base text-brand-600 dark:text-brand-400';
    }
}

function _onInput(field, val) {
    _activeField = field;
    clearTimeout(_geocodeTimer);
    // Сбрасываем координату — пользователь изменил текст
    if (field === 'from') _coordFrom = null;
    else _coordTo = null;
    if (!val.trim()) {
        _hideSuggestions();
        if (field === 'from') _lastFromResults = [];
        else _lastToResults = [];
        return;
    }
    _geocodeTimer = setTimeout(async () => {
        _setInputLoading(field, true);
        const results = await _geocode(val);
        _setInputLoading(field, false);
        if (field === 'from') _lastFromResults = results;
        else _lastToResults = results;
        // Показываем только если поле ещё активно
        const active = document.activeElement;
        if (active === _addrFrom || active === _addrTo) {
            _renderSuggestions(results);
        }
    }, 280);
}

// Автовыбор первого результата по Enter или при потере фокуса
function _autoPickFirst(field) {
    const results = field === 'from' ? _lastFromResults : _lastToResults;
    if (!results.length) return;
    const f = results[0];
    const [lng, lat] = f.center;
    const label = f._main + (f._sub ? ', ' + f._sub : '');
    _activeField = field;
    _selectResult(lng, lat, label);
}

_addrFrom.addEventListener('focus', () => { _activeField = 'from'; });
_addrTo  .addEventListener('focus', () => { _activeField = 'to';   });
_addrFrom.addEventListener('input', (e) => _onInput('from', e.target.value));
_addrTo  .addEventListener('input', (e) => _onInput('to',   e.target.value));

// Enter → автовыбор первого варианта
_addrFrom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); _autoPickFirst('from'); }
});
_addrTo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); _autoPickFirst('to'); }
});

// Blur → если ничего не выбирали — автовыбор первого
_addrFrom.addEventListener('blur', () => {
    // Небольшая задержка чтобы не конфликтовать с pointerdown на suggestion
    setTimeout(() => {
        if (_addrFrom.value.trim() && !_coordFrom) _autoPickFirst('from');
        _hideSuggestions();
    }, 180);
});
_addrTo.addEventListener('blur', () => {
    setTimeout(() => {
        if (_addrTo.value.trim() && !_coordTo) _autoPickFirst('to');
        _hideSuggestions();
    }, 180);
});

// ── Geolocation → From field ──
_geoFromBtn.addEventListener('click', () => {
    const icon = _geoFromBtn.querySelector('i');
    icon.className = 'ph ph-spinner-gap text-base animate-spin text-brand-600';
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            icon.className = 'ph ph-crosshair text-base text-brand-600 dark:text-brand-400';
            const { longitude: lng, latitude: lat } = pos.coords;
            if (!isInPrague(lng, lat)) {
                toast('Vaše poloha je mimo Prahu.', 4000);
                return;
            }
            _coordFrom = { lng, lat };
            ptStart = { lng, lat };
            _addrFrom.value = 'Moje poloha';
            _fromIsGPS = true;
            if (userMarker) {
                // Morph the existing location dot into the arrow in-place
                if (_markerFrom && _markerFrom !== userMarker) _markerFrom.remove();
                if (markerStart && markerStart !== userMarker) markerStart.remove();
                _setMarkerArrow(userMarker.getElement());
                userMarker.setLngLat([lng, lat]);
                _markerFrom = userMarker;
                markerStart = userMarker;
            } else {
                // No dot yet — create a new marker that acts as both userMarker and markerStart
                if (_markerFrom) { _markerFrom.remove(); _markerFrom = null; }
                if (markerStart) { markerStart.remove(); markerStart = null; }
                const el = document.createElement('div');
                _setMarkerArrow(el);
                userMarker = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
                _markerFrom = userMarker;
                markerStart = userMarker;
            }
            map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 14) });
            _activeField = 'to';
            _addrTo.focus();
            _maybeRoute();
        },
        () => {
            icon.className = 'ph ph-crosshair text-base text-brand-600 dark:text-brand-400';
            toast('Nelze zjistit polohu. Zkontrolujte oprávnění.', 4000);
        },
        { enableHighAccuracy: true, timeout: 8000 }
    );
});

// ── Swap from / to ──
_swapBtn.addEventListener('click', () => {
    [_addrFrom.value, _addrTo.value] = [_addrTo.value, _addrFrom.value];
    [_coordFrom, _coordTo]           = [_coordTo, _coordFrom];
    if (_coordFrom) { ptStart = _coordFrom; _updateMarker('from', ptStart.lng, ptStart.lat); }
    if (_coordTo)   { ptEnd   = _coordTo;   _updateMarker('to',   ptEnd.lng,   ptEnd.lat);   }
    _maybeRoute();
});

// ═══════════════════════════════════════════════════════════
// WALK GENERATOR
// ═══════════════════════════════════════════════════════════
let _walkSelectedMin = 40;

function _showWalkGen() {
    const overlay = document.getElementById('walkGenOverlay');
    const sheet   = document.getElementById('walkGenSheet');
    overlay.style.pointerEvents = 'auto';
    overlay.style.opacity = '1';
    sheet.style.transform = 'translateY(0)';
    // Highlight default selection
    _setWalkTimeBtns(_walkSelectedMin);
}

function _hideWalkGen() {
    const overlay = document.getElementById('walkGenOverlay');
    const sheet   = document.getElementById('walkGenSheet');
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    sheet.style.transform = 'translateY(100%)';
}

function _setWalkTimeBtns(min) {
    document.querySelectorAll('.walk-time-btn').forEach(btn => {
        const active = parseInt(btn.dataset.min) === min;
        btn.classList.toggle('bg-brand-600', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('border-brand-600', active);
        btn.classList.toggle('bg-gray-50', !active);
        btn.classList.toggle('dark:bg-zinc-800', !active);
        btn.classList.toggle('text-gray-700', !active);
        btn.classList.toggle('dark:text-gray-200', !active);
    });
}

document.querySelectorAll('.walk-time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        _walkSelectedMin = parseInt(btn.dataset.min);
        document.getElementById('walkCustomMin').value = '';
        _setWalkTimeBtns(_walkSelectedMin);
    });
});

document.getElementById('walkCustomMin').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    if (v >= 20 && v <= 180) {
        _walkSelectedMin = v;
        _setWalkTimeBtns(-1); // clear preset highlights
    }
});

// Show/hide hint when all walk sliders are at 5 (no eco factors)
function _updateWalkAllOffHint() {
    const allOff = parseInt(document.getElementById('walkNoiseLevel').value) === 5 &&
                   parseInt(document.getElementById('walkAirLevel').value) === 5 &&
                   parseInt(document.getElementById('walkElevLevel').value) === 5;
    document.getElementById('walkAllOffHint').classList.toggle('hidden', !allOff);
}

updateSliderText('walkNoiseLevel', 'walkNoiseValText', {
    '1': 'Velmi tichý', '2': 'Tichý', '3': 'Střední', '4': 'Hlučnější', '5': 'Nezáleží'
});
updateSliderText('walkAirLevel', 'walkAirValText', {
    '1': 'Výborná', '2': 'Dobrá', '3': 'Střední', '4': 'Zhoršená', '5': 'Nezáleží'
});
updateSliderText('walkElevLevel', 'walkElevValText', {
    '1': 'Plochý terén', '2': 'Mírné', '3': 'Střední', '4': 'Náročné', '5': 'Libovolné'
});
['walkNoiseLevel', 'walkAirLevel', 'walkElevLevel'].forEach(id => {
    document.getElementById(id).addEventListener('input', _updateWalkAllOffHint);
});

document.getElementById('walkGenOpenBtn').addEventListener('click', _showWalkGen);
document.getElementById('walkGenCancelBtn').addEventListener('click', _hideWalkGen);

// ── Walk check banner ──
let _walkBannerTimer = null;
function _showWalkBanner() {
    const banner = document.getElementById('walkCheckBanner');
    const bar    = document.getElementById('walkCheckProgressBar');
    const title  = document.getElementById('walkCheckTitle');
    const sub    = document.getElementById('walkCheckSub');
    if (!banner) return;
    const msgs = [
        ['🏃 Testujeme trasu…',      'Náš tým právě vyráží na trasu, aby ji pro vás otestoval!'],
        ['👟 Ještě kousek…',        'Kolega si právě zavazuje tkaničky. Hned jsme zpátky!'],
        ['🌳 Kontrolujeme parky…',  'Ověřujeme, že jsou lavičky volné a psi přátelští.'],
        ['✅ Téměř hotovo!',        'Trasa schválena — žádné louže, žádní rozzlobení holubi.'],
    ];
    let step = 0;
    banner.classList.add('show');
    bar.style.width = '0%';
    function tick() {
        if (step < msgs.length) {
            title.textContent = msgs[step][0];
            sub.textContent   = msgs[step][1];
            bar.style.width   = ((step + 1) / msgs.length * 92) + '%';
            step++;
        }
    }
    tick();
    _walkBannerTimer = setInterval(tick, 1100);
}
function _hideWalkBanner(success) {
    clearInterval(_walkBannerTimer);
    const banner = document.getElementById('walkCheckBanner');
    const bar    = document.getElementById('walkCheckProgressBar');
    const title  = document.getElementById('walkCheckTitle');
    const sub    = document.getElementById('walkCheckSub');
    if (!banner) return;
    if (success) {
        bar.style.width = '100%';
        title.textContent = '✅ Trasa připravena!';
        sub.textContent   = 'Tým se vrátil. Trasa je vaše!';
        setTimeout(() => banner.classList.remove('show'), 1000);
    } else {
        banner.classList.remove('show');
    }
}

document.getElementById('walkGenStartBtn').addEventListener('click', async () => {
    _hideWalkGen();
    _showWalkBanner();

    const btn = document.getElementById('walkGenStartBtn');
    btn.innerHTML = '<i class="ph ph-spinner-gap animate-spin text-base"></i> Generuji…';
    btn.disabled = true;

    let originLat, originLng;
    try {
        const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 7000 })
        );
        originLat = pos.coords.latitude;
        originLng = pos.coords.longitude;
    } catch (_) {
        // Fall back to map center
        const c = map.getCenter();
        originLat = c.lat; originLng = c.lng;
    }

    if (!isInPrague(originLng, originLat)) {
        toast('Vaše poloha je mimo Prahu.', 4000);
        btn.innerHTML = '<i class="ph-fill ph-shuffle text-base"></i> Vygenerovat trasu';
        btn.disabled = false;
        return;
    }

    // Walking speed & target
    const WALK_SPEED = 3500 / 3600; // m/s  (3.5 km/h)
    const targetTimeMs = _walkSelectedMin * 60 * 1000; // target in ms
    const minTimeMs    = (_walkSelectedMin - 5) * 60 * 1000;
    const maxTimeMs    = (_walkSelectedMin + 5) * 60 * 1000;
    const targetDist   = WALK_SPEED * _walkSelectedMin * 60;

    // Helper: project a point at bearing deg, distance m from origin
    function _proj(lat, lng, bearDeg, distM) {
        const Rr = 6371000;
        const φ1 = lat * Math.PI / 180, λ1 = lng * Math.PI / 180;
        const θ = bearDeg * Math.PI / 180, δ = distM / Rr;
        const φ2 = Math.asin(Math.sin(φ1)*Math.cos(δ) + Math.cos(φ1)*Math.sin(δ)*Math.cos(θ));
        const λ2 = λ1 + Math.atan2(Math.sin(θ)*Math.sin(δ)*Math.cos(φ1), Math.cos(δ) - Math.sin(φ1)*Math.sin(φ2));
        return { lat: φ2*180/Math.PI, lng: λ2*180/Math.PI };
    }

    // Triangle loop: A → W1 → W2 → A (120° between waypoints)
    // Crow-fly perimeter = r*(1 + √3 + 1) = r*3.732
    // Prague detour factor ≈1.75 (dense grid)
    const DETOUR = 1.75;
    let radius = targetDist / (DETOUR * (2 + Math.sqrt(3)));

    const b1 = Math.random() * 360;
    const b2 = (b1 + 120) % 360;

    // Pre-check initial waypoints are in Prague
    const _w1 = _proj(originLat, originLng, b1, radius);
    const _w2 = _proj(originLat, originLng, b2, radius);
    if (!isInPrague(_w1.lng, _w1.lat) || !isInPrague(_w2.lng, _w2.lat)) {
        toast('Vygenerovaný bod mimo Prahu. Zkuste to znovu.', 4000);
        btn.innerHTML = '<i class="ph-fill ph-shuffle text-base"></i> Vygenerovat trasu';
        btn.disabled = false;
        _hideWalkBanner(false);
            return;
    }

    ptStart = { lng: originLng, lat: originLat };
    ptEnd   = { lng: originLng, lat: originLat };

    const nV = parseInt(document.getElementById('walkNoiseLevel').value);
    const aV = parseInt(document.getElementById('walkAirLevel').value);
    const eV = parseInt(document.getElementById('walkElevLevel').value);
    const allOff = nV === 5 && aV === 5 && eV === 5;
    const klidnaModel = allOff ? { distance_influence: 100, priority: [] } : buildWalkModel();

    const _ghFetch = (rad) => {
        const pA = _proj(originLat, originLng, b1, rad);
        const pB = _proj(originLat, originLng, b2, rad);
        return fetch(GH_URL, {
            method: 'POST', headers: GH_HEADERS,
            body: JSON.stringify({
                points: [[originLng, originLat], [pA.lng, pA.lat], [pB.lng, pB.lat], [originLng, originLat]],
                profile: 'normal_walk', points_encoded: true, instructions: false,
                'ch.disable': true, custom_model: klidnaModel,
            }),
        });
    };

    try {
        // Iterative scaling: up to 5 attempts to land within ±5 min
        let data, attempts = 0;
        while (attempts < 5) {
            const resp = await _ghFetch(radius);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            data = await resp.json();
            const gotTime = data.paths[0].time; // ms from GraphHopper
            if (gotTime >= minTimeMs && gotTime <= maxTimeMs) break;
            // Scale radius proportionally based on time ratio
            const ratio = targetTimeMs / gotTime;
            radius = radius * Math.max(0.3, Math.min(3, ratio));
            attempts++;
        }

        const path = data.paths[0];
        const coords = decodePolyline(path.points);
        _routeCoords       = coords;
        _klidnaRouteCoords = coords;
        _fastRouteCoords   = [];
        _activeVariant     = 'klidna';

        // Clear old compare layers
        ['route-fast', 'route-klidna', 'route'].forEach(id => {
            if (map.getLayer(id)) map.removeLayer(id);
            if (map.getSource(id)) map.removeSource(id);
        });
        _drawRoute(coords, 'route-klidna', 'route-klidna', '#10b981', 5, 0.9, null);

        const walkTimeMs = path.time; // use GraphHopper's actual time
        _navRouteDist = path.distance;
        _navRouteTime = walkTimeMs;
        _navRouteAvoidsNoise = nV <= 2;
        _navRouteAvoidsAir   = aV <= 2;

        // Show route sheet (single variant)
        document.getElementById('routeDistText').textContent = fmtDist(path.distance);
        document.getElementById('routeTimeText').textContent = fmtTime(walkTimeMs);
        document.getElementById('routeFromLabel').textContent = '🚶 Procházka';
        document.getElementById('routeToLabel').textContent   = fmtTime(walkTimeMs);
        _showRouteSheet('single');

        // Place origin marker
        _clearFromGPS();
        if (markerStart) markerStart.remove();
        if (markerEnd)   markerEnd.remove();
        markerStart = new mapboxgl.Marker({ color: '#22c55e' }).setLngLat([originLng, originLat]).addTo(map);
        markerEnd = markerStart;
        _markerFrom = markerStart; _markerTo = markerEnd;

        _syncFloatBtns();
        _hideWalkBanner(true);
        toast(`Promenáda ${fmtTime(walkTimeMs)} vygenerována 🌿`, 3500);

    } catch (e) {
        _hideWalkBanner(false);
        toast('Chyba generování trasy: ' + e.message, 5000);
    }

    btn.innerHTML = '<i class="ph-fill ph-shuffle text-base"></i> Vygenerovat trasu';
    btn.disabled = false;
});

// ═══════════════════════════════════════════════════════════
// SUMMARY SCREEN
// ═══════════════════════════════════════════════════════════
let _navRouteDist = 0;
let _navRouteTime = 0;
let _navRouteAvoidsNoise = false;
let _navRouteAvoidsAir   = false;

function _showSummary() {
    document.getElementById('summTotalDist').textContent = fmtDist(_navRouteDist);
    document.getElementById('summTotalTime').textContent = fmtTime(_navRouteTime);

    const achievements = [];
    if (_navRouteAvoidsNoise) {
        achievements.push({ icon: '🤫', text: 'Vyhnuli jste se ulicím s vysokou hladinou hluku' });
    }
    if (_navRouteAvoidsAir) {
        achievements.push({ icon: '🌿', text: 'Prošli jste zónou s čistším ovzduším' });
    }
    if (_navRouteDist > 2000) {
        achievements.push({ icon: '🏃', text: `Ujili jste více než ${fmtDist(Math.floor(_navRouteDist / 1000) * 1000)}` });
    }
    achievements.push({ icon: '🌳', text: 'Trasa preferovala průchod parky a zelenými zónami' });

    const el = document.getElementById('summAchievements');
    el.innerHTML = achievements.map(a =>
        `<div class="flex items-start gap-3 bg-gray-50 dark:bg-zinc-800 rounded-xl p-3">
            <span class="text-xl leading-none flex-shrink-0">${a.icon}</span>
            <span class="text-sm text-gray-700 dark:text-gray-200">${a.text}</span>
        </div>`
    ).join('');

    const overlay = document.getElementById('summaryOverlay');
    const card    = document.getElementById('summaryCard');
    overlay.style.pointerEvents = 'auto';
    overlay.style.opacity = '1';
    card.style.transform = 'translateY(0)';
}

function _hideSummary() {
    const overlay = document.getElementById('summaryOverlay');
    const card    = document.getElementById('summaryCard');
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    card.style.transform = 'translateY(100%)';
}

document.getElementById('summCloseBtn').addEventListener('click', _hideSummary);

// ═══════════════════════════════════════════════════════════
// TRANSIT (MHD) OVERLAY  — Google-Maps style with GTFS routes
// ═══════════════════════════════════════════════════════════

let _transitVisible = false;
let _transitImagesLoaded = false;

// Ray-casting point-in-polygon (lng/lat coords)
function _pointInPoly(lng, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
            inside = !inside;
    }
    return inside;
}

let _noisyStopIds = null; // Set of stop IDs inside avoid zones

async function _ensureTransitData() {
    if (window._transitLoaded) return;
    toast('Načítám data MHD…', 12000);
    const [sR, tramR, busR, schedR, busSchedR, graphR, coordsR, avoidR, edgeShapesR] = await Promise.all([
        fetch('transit_stops.geojson'),
        fetch('transit_tram_routes.geojson'),
        fetch('transit_bus_routes.geojson'),
        fetch('transit_schedule.json'),
        fetch('transit_bus_schedule.json'),
        fetch('transit_graph.json'),
        fetch('transit_stops_coords.json'),
        fetch('avoid_stops.geojson'),
        fetch('transit_edge_shapes.json'),
    ]);
    window._transitStops        = await sR.json();
    window._transitTramLines    = await tramR.json();
    window._transitBusLines     = await busR.json();
    window._transitSchedule     = await schedR.json();
    window._transitBusSchedule  = await busSchedR.json();
    window._transitGraph        = await graphR.json();
    window._transitStopCoords   = await coordsR.json();
    window._transitEdgeShapes   = await edgeShapesR.json();

    // Build set of noisy stop IDs (stops inside avoid polygons)
    const avoidGeo = await avoidR.json();
    const avoidPolys = avoidGeo.features.map(f => f.geometry.coordinates[0]);
    _noisyStopIds = new Set();
    const sc = window._transitStopCoords;
    for (const sid in sc) {
        const [lat, lng] = sc[sid];
        for (const ring of avoidPolys) {
            if (_pointInPoly(lng, lat, ring)) { _noisyStopIds.add(sid); break; }
        }
    }

    // Expand radius: also mark stops within 250m of any confirmed noisy stop
    const noisyCoords = [..._noisyStopIds].map(sid => sc[sid]).filter(Boolean);
    for (const sid in sc) {
        if (_noisyStopIds.has(sid)) continue;
        const [lat, lng] = sc[sid];
        for (const [nLat, nLng] of noisyCoords) {
            if (_haversineM(lat, lng, nLat, nLng) <= 250) { _noisyStopIds.add(sid); break; }
        }
    }
    console.log('[MHD] Noisy stops (incl. 250m buffer):', _noisyStopIds.size, 'of', Object.keys(sc).length);

    window._transitLoaded = true;
}

// Register white SDF arrow image (re-used by all layers, colored via icon-color)
async function _ensureTransitImages() {
    if (_transitImagesLoaded && map.hasImage('transit-arrow-sdf') && map.hasImage('transit-stop-pin')) return;
    // Arrow SDF (for direction indicators)
    await new Promise(resolve => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><polygon points="4,3 17,10 4,17 7,10" fill="white"/></svg>`;
        const img = new Image(20, 20);
        img.onload = () => {
            try { if (!map.hasImage('transit-arrow-sdf')) map.addImage('transit-arrow-sdf', img, { sdf: true }); }
            catch(_) {}
            resolve();
        };
        img.onerror = resolve;
        img.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
    });
    // Bus-stop pin icon
    await new Promise(resolve => {
        const pin = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 130" width="100" height="130">
          <path d="M50 4 C24 4 3 25 3 51 C3 77 18 96 34 110 L50 126 L66 110 C82 96 97 77 97 51 C97 25 76 4 50 4 Z"
                fill="white" stroke="#111" stroke-width="4.5" stroke-linejoin="round"/>
          <rect x="18" y="20" width="64" height="48" rx="9" fill="none" stroke="#111" stroke-width="5"/>
          <line x1="18" y1="38" x2="82" y2="38" stroke="#111" stroke-width="4"/>
          <line x1="50" y1="38" x2="50" y2="68" stroke="#111" stroke-width="3.5"/>
          <circle cx="30" cy="74" r="8" fill="none" stroke="#111" stroke-width="4.5"/>
          <circle cx="70" cy="74" r="8" fill="none" stroke="#111" stroke-width="4.5"/>
        </svg>`;
        const img = new Image(100, 130);
        img.onload = () => {
            try { if (!map.hasImage('transit-stop-pin')) map.addImage('transit-stop-pin', img, { pixelRatio: 3 }); }
            catch(_) {}
            resolve();
        };
        img.onerror = resolve;
        img.src = 'data:image/svg+xml,' + encodeURIComponent(pin);
    });
    _transitImagesLoaded = true;
}

// Only stop layers are shown permanently while MHD tab is active.
// Route lines are drawn on-demand by _drawTransitPlan and cleared by _clearTransitPlanMap.
const _TRANSIT_STOP_LAYERS = [
    'transit-bus-stops', 'transit-tram-stops', 'transit-tram-labels',
];
const _TRANSIT_LAYERS = _TRANSIT_STOP_LAYERS; // alias kept for _removeTransitLayers
const _TRANSIT_SOURCES = ['transit-stops'];

async function _addTransitLayers() {
    if (!window._transitLoaded) return;
    await _ensureTransitImages();

    const dark = document.documentElement.classList.contains('dark');
    const bg   = dark ? '#18181b' : '#ffffff';
    const txt  = dark ? '#e4e4e7' : '#1f2937';
    const txth = dark ? '#18181b' : '#ffffff';

    // ── Only stops source — route line sources loaded on-demand ──
    if (!map.getSource('transit-stops'))
        map.addSource('transit-stops', { type: 'geojson', data: window._transitStops });

    // ── Transit stops ──
    if (!map.getLayer('transit-tram-stops')) {
        // Tram stops — pin icon
        map.addLayer({
            id: 'transit-tram-stops', type: 'symbol', source: 'transit-stops',
            filter: ['==', 'type', 'tram'],
            minzoom: 17,
            layout: {
                'icon-image': 'transit-stop-pin',
                'icon-size': ['interpolate', ['linear'], ['zoom'], 17, 0.90, 20, 1.65],
                'icon-anchor': 'bottom',
                'icon-allow-overlap': true,
            },
        });
        // Bus / trolleybus stops — same pin icon
        map.addLayer({
            id: 'transit-bus-stops', type: 'symbol', source: 'transit-stops',
            filter: ['in', 'type', 'bus', 'trolleybus'],
            minzoom: 17,
            layout: {
                'icon-image': 'transit-stop-pin',
                'icon-size': ['interpolate', ['linear'], ['zoom'], 17, 0.90, 20, 1.65],
                'icon-anchor': 'bottom',
                'icon-allow-overlap': true,
            },
        });
        // Stop name labels (shown even higher zoom)
        map.addLayer({
            id: 'transit-tram-labels', type: 'symbol', source: 'transit-stops',
            filter: ['in', 'type', 'tram', 'bus', 'trolleybus'],
            minzoom: 18,
            layout: {
                'text-field': ['get', 'name'],
                'text-size': 11,
                'text-font': ['DIN Pro Regular', 'Arial Unicode MS Regular'],
                'text-anchor': 'top', 'text-offset': [0, 0.5],
                'text-optional': true, 'text-max-width': 10,
            },
            paint: {
                'text-color': txt,
                'text-halo-color': txth, 'text-halo-width': 1.5,
            }
        });
    }
}

function _removeTransitLayers() {
    _TRANSIT_LAYERS.forEach(id  => { if (map.getLayer(id))   map.removeLayer(id); });
    _TRANSIT_SOURCES.forEach(id => { if (map.getSource(id)) map.removeSource(id); });
    // Also clean up line sources that may have been added on-demand
    ['transit-tram', 'transit-bus'].forEach(id => { if (map.getSource(id)) map.removeSource(id); });
}

async function _toggleTransit() {
    _transitVisible = !_transitVisible;
    const btn        = document.getElementById('transitTabBtn');
    const icon       = btn.querySelector('i');
    const modeLabel  = document.getElementById('searchPanelMode');
    if (_transitVisible) {
        icon.className = 'ph-fill ph-train-simple text-3xl mb-1';
        btn.classList.add('text-blue-600', 'dark:text-blue-400');
        btn.classList.remove('text-gray-400', 'dark:text-gray-500');
        if (modeLabel) modeLabel.textContent = 'MHD trasa';
        // Clear any existing walk route and close panels
        _clearWalkingState();
        await _ensureTransitData();
        if (map.isStyleLoaded()) await _addTransitLayers();
        _spOpen();
        toast('Zadejte odkud a kam nebo klepněte na mapu', 4000);
    } else {
        icon.className = 'ph ph-train-simple text-3xl mb-1';
        btn.classList.remove('text-blue-600', 'dark:text-blue-400');
        btn.classList.add('text-gray-400', 'dark:text-gray-500');
        if (modeLabel) modeLabel.textContent = 'Trasa';
        _removeTransitLayers();
        _clearTransitMapState();
        _spClose();
    }
}

// Re-add layers after theme switch (style.load clears all custom layers + images)
map.on('style.load', () => {
    _transitImagesLoaded = false;
    if (_transitVisible) setTimeout(() => _addTransitLayers(), 120);
});

// ── Stop popups ──
const _transitPopup = new mapboxgl.Popup({
    closeButton: false,
    className: 'transit-popup',
    maxWidth: '240px',
    offset: 12,
});

function _getNextDepartures(gtfsIdsJson) {
    if (!gtfsIdsJson) return [];
    let ids;
    try { ids = JSON.parse(gtfsIdsJson); } catch(e) { return []; }
    const now = new Date();
    const curMin = now.getHours() * 60 + now.getMinutes();
    const entryMap = new Map();
    for (const id of ids) {
        const entries = [
            ...(window._transitSchedule    ? (window._transitSchedule[id]    || []) : []),
            ...(window._transitBusSchedule ? (window._transitBusSchedule[id] || []) : []),
        ];
        for (const en of entries) {
            const key = en.r + '::' + en.dir;
            if (!entryMap.has(key)) entryMap.set(key, { r: en.r, dir: en.dir, times: new Set() });
            for (const t of en.times) entryMap.get(key).times.add(t);
        }
    }
    const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const result = [];
    for (const [, entry] of entryMap) {
        const sorted = Array.from(entry.times).sort();
        const upcoming = sorted.filter(t => {
            const diff = toMin(t) - curMin;
            return diff >= -1 && diff <= 180;
        });
        if (curMin > 21 * 60) {
            sorted.filter(t => { const h = parseInt(t); return h < 4; }).forEach(t => upcoming.push(t));
        }
        result.push({ r: entry.r, dir: entry.dir, next: upcoming.slice(0, 4) });
    }
    result.sort((a, b) => {
        if (!a.next.length && !b.next.length) return a.r.localeCompare(b.r);
        if (!a.next.length) return 1;
        if (!b.next.length) return -1;
        return toMin(a.next[0]) - toMin(b.next[0]);
    });
    return result;
}

function _buildTransitPopupHTML(headerHTML, gtfsIdsJson) {
    const deps = _getNextDepartures(gtfsIdsJson);
    const now = new Date();
    const curMin = now.getHours() * 60 + now.getMinutes();
    const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const fmtDep = t => {
        const diff = toMin(t) - curMin;
        if (diff <= 0) return '<b>teď</b>';
        if (diff < 60) return `<b>${diff}</b>&nbsp;min`;
        return `<span class="tp-hhmm">${t}</span>`;
    };
    const visible = deps.filter(d => d.next.length).slice(0, 7);
    let schedHTML;
    if (visible.length) {
        schedHTML = '<div class="tp-sched">' + visible.map(d =>
            `<div class="tp-route-row">` +
            `<span class="tp-rnum">${d.r}</span>` +
            `<span class="tp-dir">${d.dir}</span>` +
            `<span class="tp-times">${d.next.slice(0, 3).map(fmtDep).join('<span class="tp-dot">·</span>')}</span>` +
            `</div>`
        ).join('') + '</div>';
    } else {
        schedHTML = '<div class="tp-no-sched">Žádné odchody v nejbližší době</div>';
    }
    return `<div class="tp-inner">${headerHTML}${schedHTML}</div>`;
}

map.on('click', 'transit-tram-stops', (e) => {
    if (!e.features.length) return;
    const p = e.features[0].properties;
    const header = `<div class="tp-row"><span class="tp-badge tp-badge-tram">🚋</span>` +
        `<div><strong class="tp-name">${p.name}</strong><div class="tp-sub">Tramvaj · Zóna ${p.zone || 'P'}</div></div></div>`;
    _transitPopup.setLngLat(e.lngLat)
        .setHTML(_buildTransitPopupHTML(header, p.gtfsIds))
        .addTo(map);
});

map.on('click', 'transit-bus-stops', (e) => {
    if (!e.features.length) return;
    const p = e.features[0].properties;
    const icon = p.type === 'trolleybus' ? '🚎' : '🚌';
    const label = p.type === 'trolleybus' ? 'Trolejbus' : 'Bus';
    const header = `<div class="tp-row"><span class="tp-badge tp-badge-bus">${icon}</span>` +
        `<div><strong class="tp-name">${p.name}</strong><div class="tp-sub">${label} · Zóna ${p.zone || 'P'}</div></div></div>`;
    _transitPopup.setLngLat(e.lngLat)
        .setHTML(_buildTransitPopupHTML(header, p.gtfsIds))
        .addTo(map);
});

['transit-tram-stops', 'transit-bus-stops'].forEach(id => {
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
});

document.getElementById('transitTabBtn').addEventListener('click', _toggleTransit);

// ═══════════════════════════════════════════════════════════
// TRANSIT NAVIGATOR — Dijkstra router + planner UI
// ═══════════════════════════════════════════════════════════
let _transitStopNames = null;

class MinHeap {
    constructor(f) { this.h = []; this.f = f; }
    push(v) {
        this.h.push(v);
        let i = this.h.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.f(this.h[p]) <= this.f(this.h[i])) break;
            [this.h[p], this.h[i]] = [this.h[i], this.h[p]]; i = p;
        }
    }
    pop() {
        const top = this.h[0];
        const last = this.h.pop();
        if (this.h.length) {
            this.h[0] = last;
            let i = 0;
            for (;;) {
                let s = i, l = 2*i+1, r = 2*i+2;
                if (l < this.h.length && this.f(this.h[l]) < this.f(this.h[s])) s = l;
                if (r < this.h.length && this.f(this.h[r]) < this.f(this.h[s])) s = r;
                if (s === i) break;
                [this.h[s], this.h[i]] = [this.h[i], this.h[s]]; i = s;
            }
        }
        return top;
    }
    get size() { return this.h.length; }
}

function _buildStopNameLookup() {
    if (_transitStopNames) return;
    _transitStopNames = {};
    if (!window._transitStops) return;
    for (const f of window._transitStops.features) {
        const ids = f.properties.gtfsIds;
        if (!ids) continue;
        const { name, type } = f.properties;
        try { for (const id of JSON.parse(ids)) _transitStopNames[id] = { name, type }; }
        catch (_) {}
    }
}

function _preProcessSchedules() {
    for (const sch of [window._transitSchedule, window._transitBusSchedule]) {
        if (!sch) continue;
        for (const sid in sch)
            for (const e of sch[sid])
                if (!e._m) e._m = e.times.map(t => +t.slice(0, 2) * 60 + +t.slice(3, 5));
    }
}

function _nextDepMin(sid, rname, curMin) {
    let best = Infinity;
    for (const sch of [window._transitSchedule, window._transitBusSchedule]) {
        if (!sch) continue;
        const entries = sch[sid];
        if (!entries) continue;
        for (const e of entries) {
            if (e.r !== rname) continue;
            const m = e._m;
            if (!m?.length) continue;
            let lo = 0, hi = m.length;
            while (lo < hi) { const mid = (lo + hi) >> 1; if (m[mid] < curMin) lo = mid + 1; else hi = mid; }
            if (lo < m.length && m[lo] < best) best = m[lo];
        }
    }
    return best;
}

async function _planTransitRoute(fromCoord, toCoord, avoidNoisy = false) {
    if (!window._transitGraph || !window._transitStopCoords) return { error: 'nodata' };
    _buildStopNameLookup();
    _preProcessSchedules();

    const WALK_SPD = 80;   // m/min ≈ 4.8 km/h
    const MAX_WALK = 2500; // max walk to/from a stop (m)
    const K        = 15;   // nearest-stop candidates
    const MAX_TF   = 3;    // max transfers
    const HORIZON  = 180;  // total journey window (min)
    const TF_PEN   = 5;    // transfer penalty (min) — only used in quiet mode to prefer fewer transfers
    const NOISY_MUL = 9.0; // 9x penalty: strongly avoids noisy stops — forces detour when any alternative exists

    const noisy = avoidNoisy && _noisyStopIds && _noisyStopIds.size > 0;

    // Fast route: sort purely by actual time; quiet route: sort by t + TF_PEN*tf + npen
    const sortKey = noisy
        ? (t, tf, np) => t + TF_PEN * tf + np
        : (t, tf, np) => t;

    const graph = window._transitGraph;
    const sc    = window._transitStopCoords;

    // For start: only graph nodes (need outgoing routes to board)
    // For end: all stops in coords (includes terminus stops with no outgoing edges)
    const nearestIn = (coord, pool) => {
        const res = [];
        for (const sid of pool) {
            const c = sc[sid];
            if (!c) continue;
            const d = _haversineM(coord.lat, coord.lng, c[0], c[1]);
            if (d <= MAX_WALK) res.push({ sid, d });
        }
        return res.sort((a, b) => a.d - b.d).slice(0, K);
    };

    const starts = nearestIn(fromCoord, Object.keys(graph));
    const ends   = nearestIn(toCoord,   Object.keys(sc));
    if (!starts.length) return { error: 'nostart' };
    if (!ends.length)   return { error: 'noend' };

    const endDist = new Map(ends.map(e => [e.sid, e.d]));

    const now = new Date();
    const t0  = now.getHours() * 60 + now.getMinutes();

    // Each heap node: { sortT, t, sid, tf, route, legs, npen }
    //   t      = actual clock arrival time (used for schedule lookups & total time)
    //   sortT  = t + TF_PEN * tf + npen  (heap ordering — penalizes transfers + noisy stops)
    //   npen   = accumulated noise penalty (only when avoidNoisy)
    // Dominance: by sortT when avoidNoisy, by t otherwise
    const heap = new MinHeap(n => n.sortT);
    const best = new Map();

    for (const s of starts) {
        const walkMin = s.d / WALK_SPD;
        const t = t0 + walkMin;
        const npen = (noisy && _noisyStopIds.has(s.sid)) ? walkMin * NOISY_MUL : 0;
        const sT = sortKey(t, 0, npen);
        heap.push({ sortT: sT, t, sid: s.sid, tf: 0, route: null, npen,
            legs: [{ type: 'walk', dist: s.d, fromSid: null, toSid: s.sid }] });
    }

    while (heap.size) {
        const { sortT, t, sid, tf, route, legs, npen } = heap.pop();

        // Dominance: use sortT when penalty active, otherwise actual t
        const domVal = noisy ? sortT : t;
        const bk = `${sid}\x01${tf}\x01${route || ''}`;
        if ((best.get(bk) ?? Infinity) <= domVal) continue;
        best.set(bk, domVal);

        // Reached a destination stop?
        if (endDist.has(sid)) {
            const walkDist = endDist.get(sid);
            return {
                legs: [...legs, { type: 'walk', dist: walkDist, fromSid: sid, toSid: null }],
                totalMin: Math.max(1, Math.round(t + walkDist / WALK_SPD - t0)),
                t0,
            };
        }

        if (t > t0 + HORIZON) continue;

        for (const edge of (graph[sid] || [])) {
            // Schedule lookup uses ACTUAL time t (not sortT which has TF penalties)
            const dep = _nextDepMin(sid, edge.r, t);
            if (dep === Infinity) continue;
            const arr   = dep + edge.t / 60;
            const isTf  = route !== null && route !== edge.r;
            const newTf = tf + (isTf ? 1 : 0);
            if (newTf > MAX_TF) continue;

            // Noise penalty: 30% extra time for edges arriving at a noisy stop
            const edgeNpen = (noisy && _noisyStopIds.has(edge.to)) ? (edge.t / 60) * NOISY_MUL : 0;
            const newNpen = npen + edgeNpen;
            const newSortT = sortKey(arr, newTf, newNpen);

            const domVal2 = noisy ? newSortT : arr;
            const bk2 = `${edge.to}\x01${newTf}\x01${edge.r}`;
            if ((best.get(bk2) ?? Infinity) <= domVal2) continue;

            // Build legs: extend current transit leg if same route, else start a new one
            const last = legs[legs.length - 1];
            let newLegs;
            if (last.type === 'transit' && last.route === edge.r) {
                newLegs = [...legs.slice(0, -1),
                    { ...last, toSid: edge.to, stops: last.stops + 1, arrMin: arr }];
            } else {
                newLegs = [...legs,
                    { type: 'transit', route: edge.r, fromSid: sid, toSid: edge.to,
                      stops: 1, depMin: dep, arrMin: arr }];
            }
            heap.push({ sortT: newSortT, t: arr, sid: edge.to, tf: newTf, route: edge.r, legs: newLegs, npen: newNpen });
        }
    }
    return { error: 'nroute' };
}

function _tpRouteColor(rname, type) {
    if (type === 'metro') return rname === 'A' ? '#009A44' : rname === 'B' ? '#c8a800' : '#EE1C25';
    if (type === 'trolleybus') return '#1565C0';
    return '#c0392b';
}

function _renderTransitPlan(plan) {
    const el = document.getElementById('transitPlanResult');
    if (!plan || plan.error) {
        const msg = !plan || plan.error === 'nodata'
            ? 'Data MHD se načítájí… zkuste za chvíli.'
            : plan.error === 'nostart'
            ? 'V okolí vašeho výchozího bodu nebyla nalezena žádná zastávka (do 2,5 km).'
            : plan.error === 'noend'
            ? 'V okolí vašeho cíle nebyla nalezena žádná zastávka (do 2,5 km).'
            : 'Spojení nenalezeno. Zkuste jiný čas nebo jiné místo.';
        el.innerHTML = '<div class="tpn-empty">' + msg + '</div>';
        return;
    }
    _buildStopNameLookup();
    const nm = _transitStopNames;
    const getName = (sid) => nm?.[sid]?.name || '';
    const getType = (sid) => nm?.[sid]?.type || 'tram';
    const ICON = { metro: '\uD83D\uDE87', tram: '\uD83D\uDE8B', trolleybus: '\uD83D\uDE8E', bus: '\uD83D\uDE8C' };
    const fmtM  = (m) => { const mm = Math.round(m); return mm >= 60 ? `${Math.floor(mm/60)}\u00a0h\u00a0${mm%60}\u00a0min` : `${mm}\u00a0min`; };
    const fmtHM = (m) => `${Math.floor(m/60).toString().padStart(2,'0')}:${(Math.round(m)%60).toString().padStart(2,'0')}`;

    let html = `<div class="tpn-header"><b class="tpn-total">${fmtM(plan.totalMin)}</b><span class="tpn-hsub">celkov\u00e1 doba cesty</span></div>`;
    for (const leg of plan.legs) {
        if (leg.type === 'walk') {
            const dm = Math.round(leg.dist / 80);
            html += `<div class="tpn-leg tpn-walk"><span class="tpn-wicon">🚶</span><div><div class="tpn-wt">${Math.round(leg.dist)}\u00a0m p\u011b\u0161ky</div><div class="tpn-wsub">${dm}\u00a0min</div></div></div>`;
        } else {
            const typ   = getType(leg.fromSid);
            const color = _tpRouteColor(leg.route, typ);
            const icon  = ICON[typ] || ICON.tram;
            const stops = leg.stops;
            const sc2   = stops === 1 ? 'zast\u00e1vka' : stops < 5 ? 'zast\u00e1vky' : 'zast\u00e1vek';
            html += `<div class="tpn-leg tpn-transit"><div class="tpn-tbar" style="background:${color}"></div><div class="tpn-tbody"><div class="tpn-thead"><span class="tpn-chip" style="background:${color}">${icon}\u00a0${leg.route}</span><span class="tpn-tdest">${getName(leg.toSid)}</span></div><div class="tpn-tstops">${getName(leg.fromSid)} \u2192 ${getName(leg.toSid)}</div><div class="tpn-tmeta">${stops}\u00a0${sc2} \u00b7 ${fmtHM(leg.depMin)}\u00a0\u2192\u00a0${fmtHM(leg.arrMin)}</div></div></div>`;
        }
    }
    el.innerHTML = html;
}

// Map drawing of transit plan
const _TP_MAP_IDS = [];
function _clearTransitPlanMap() {
    for (const id of _TP_MAP_IDS) {
        if (map.getLayer(id))   map.removeLayer(id);
        if (map.getSource(id))  map.removeSource(id);
    }
    _TP_MAP_IDS.length = 0;
}
// Fetch walk polyline via GraphHopper.
// useComfort=true applies the user's custom model; false uses fast/direct routing.
async function _fetchWalkPolyline(from, to, useComfort = true) {
    try {
        const model = useComfort ? buildCustomModel() : { distance_influence: 100, priority: [] };
        const body = { points: [[from.lng, from.lat], [to.lng, to.lat]],
            profile: 'normal_walk', points_encoded: true, instructions: false,
            'ch.disable': true, custom_model: model };
        const r = await fetch(GH_URL, { method: 'POST', headers: GH_HEADERS, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(`GH ${r.status}`);
        return decodePolyline((await r.json()).paths[0].points);
    } catch (_) {
        return [[from.lng, from.lat], [to.lng, to.lat]];
    }
}

// Follow directed graph edges for a given route, return ordered [lng,lat] stop coords.
// When a stop has multiple outgoing edges on the same route (branch/variant),
// pick the edge whose destination is closest to the final toSid stop.
function _traceTransitLeg(fromSid, toSid, route) {
    const sc = window._transitStopCoords;
    const es = window._transitEdgeShapes;
    const to_ = sc[toSid];
    if (!to_) return [];

    const coords  = [];
    const visited = new Set();
    let cur = fromSid;

    while (cur && !visited.has(cur)) {
        if (cur === toSid) break;
        visited.add(cur);

        const candidates = (window._transitGraph[cur] || [])
            .filter(e => e.r === route && !visited.has(e.to));
        if (!candidates.length) break;

        let next = candidates[0];
        if (candidates.length > 1) {
            let bestD = Infinity;
            for (const e of candidates) {
                const ct = sc[e.to];
                if (!ct) continue;
                const dx = ct[1] - to_[1], dy = ct[0] - to_[0];
                const d  = dx * dx + dy * dy;
                if (d < bestD) { bestD = d; next = e; }
            }
        }

        // Append shape geometry for this hop (all points except the last,
        // which will be the first point of the next hop)
        const key = `${cur}|${next.to}|${route}`;
        const seg = es && es[key];
        if (seg && seg.length > 0) {
            for (let i = 0; i < seg.length - 1; i++) coords.push(seg[i]);
        } else {
            // Fallback: straight line from current stop
            const c = sc[cur];
            if (c) coords.push([c[1], c[0]]);
        }

        cur = next.to;
        if (coords.length > 4000) break;
    }

    // Add the final stop (closes the last segment)
    const cEnd = sc[toSid];
    if (cEnd) coords.push([cEnd[1], cEnd[0]]);
    return coords;
}

// Route through all stops of a transit leg via GH (follows roads/tracks, no comfort model).
// Transit vehicle legs: connect stops in route order with straight segments.
// We do NOT route through GH (pedestrian router follows sidewalks, not tram rails).
function _fetchTransitPolyline(fromSid, toSid, route) {
    return Promise.resolve(_traceTransitLeg(fromSid, toSid, route));
}

async function _drawTransitPlan(plan, from, to) {
    _clearTransitPlanMap();
    if (!plan) return;
    const sc = window._transitStopCoords;
    const gc = (sid) => { const c = sc?.[sid]; return c ? [c[1], c[0]] : null; };

    // Collect all legs as jobs, then fetch walk + transit polylines in parallel
    // custom model only for first and last walk legs (user walks to/from stops)
    const jobs = [];
    let idx = 0;
    const firstLegIdx = plan.legs.findIndex(l => l.type === 'walk');
    const lastLegIdx  = [...plan.legs].map((l,i)=>l.type==='walk'?i:-1).filter(i=>i>=0).pop() ?? -1;
    for (const leg of plan.legs) {
        const id = `tp-${idx}`;
        if (leg.type === 'walk') {
            const a = leg.fromSid ? { lat: sc[leg.fromSid][0], lng: sc[leg.fromSid][1] } : from;
            const b = leg.toSid   ? { lat: sc[leg.toSid][0],   lng: sc[leg.toSid][1]   } : to;
            const useComfort = (idx === firstLegIdx || idx === lastLegIdx);
            jobs.push({ id, type: 'walk', fromPt: a, toPt: b, leg, useComfort });
        } else {
            jobs.push({ id, type: 'transit', leg });
        }
        idx++;
    }

    // Fetch all polylines in parallel (comfort model only for first/last walk legs)
    const polylines = await Promise.all(jobs.map(j =>
        j.type === 'walk'
            ? _fetchWalkPolyline(j.fromPt, j.toPt, j.useComfort)
            : _fetchTransitPolyline(j.leg.fromSid, j.leg.toSid, j.leg.route)
    ));

    // Draw all legs
    for (let i = 0; i < jobs.length; i++) {
        const j = jobs[i];
        const coords = polylines[i];
        if (!coords || coords.length < 2) continue;
        if (map.getSource(j.id)) continue;
        map.addSource(j.id, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } });
        if (j.type === 'walk') {
            map.addLayer({ id: j.id, type: 'line', source: j.id, layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#6b7280', 'line-width': 3, 'line-opacity': 0.8, 'line-dasharray': [2, 2] } });
        } else {
            const typ   = _transitStopNames?.[j.leg.fromSid]?.type || 'tram';
            const color = _tpRouteColor(j.leg.route, typ);
            map.addLayer({ id: j.id, type: 'line', source: j.id, layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': color, 'line-width': 5, 'line-opacity': 0.92 } });
        }
        _TP_MAP_IDS.push(j.id);
    }

    // Flatten all leg polylines into _routeCoords so startNavigation() can track progress
    const navCoords = [];
    for (const coords of polylines) {
        if (!coords || coords.length < 2) continue;
        if (navCoords.length > 0) navCoords.pop(); // merge junction point
        navCoords.push(...coords);
    }
    _routeCoords = navCoords;

    const allPts = plan.legs.flatMap(leg => {
        const pts = [];
        if (leg.fromSid) { const c = gc(leg.fromSid); if (c) pts.push(c); }
        if (leg.toSid)   { const c = gc(leg.toSid);   if (c) pts.push(c); }
        return pts;
    });
    allPts.push([from.lng, from.lat], [to.lng, to.lat]);
    if (allPts.length > 1) {
        const bounds = allPts.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(allPts[0], allPts[0]));
        map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 700 });
    }
}

function _showTransitPlanSheet() {
    _showRouteSheet('transit');
}
function _hideTransitPlanSheet() {
    _hideRouteSheet();
    const st = document.getElementById('sheetTransit');
    if (st) st.classList.add('hidden');
    _clearTransitMapState();
}

// ── Map-tap transit planner state ──
function _clearWalkingState() {
    if (_navMode) stopNavigation(false);
    ptStart = null; ptEnd = null;
    _coordFrom = null; _coordTo = null;
    _addrFrom.value = ''; _addrTo.value = '';
    _clearFromGPS();
    if (markerStart) { markerStart.remove(); markerStart = null; }
    if (markerEnd)   { markerEnd.remove();   markerEnd   = null; }
    _markerFrom = null; _markerTo = null;
    ['route-fast', 'route-klidna', 'route'].forEach(id => {
        if (map.getLayer(id))  map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
    });
    _routeCoords = []; _fastRouteCoords = []; _klidnaRouteCoords = [];
    _hideRouteSheet();
    _spClose();
}

let _tpMapStep    = 0;   // 0=empty 1=start set 2=both set
let _tpMarkerFrom = null;
let _tpMarkerTo   = null;

// Transit compare state
let _transitPlanFast  = null;
let _transitPlanQuiet = null;
let _activeTransitVariant = 'fast'; // 'fast' | 'quiet'

function _selectTransitOpt(variant) {
    _activeTransitVariant = variant;
    const plan = variant === 'fast' ? _transitPlanFast : _transitPlanQuiet;
    // highlight selected tab
    const elF = document.getElementById('optTransitFast');
    const elQ = document.getElementById('optTransitQuiet');
    if (elF) elF.classList.toggle('selected', variant === 'fast');
    if (elQ) elQ.classList.toggle('selected', variant === 'quiet');
    // re-render + re-draw selected plan
    _renderTransitPlan(plan);
    if (plan && !plan.error && _coordFrom && _coordTo) {
        _drawTransitPlan(plan, _coordFrom, _coordTo);
        _syncNavBtn();
    }
}

function _clearTransitMapState() {
    _tpMapStep = 0;
    if (_tpMarkerFrom) { _tpMarkerFrom.remove(); _tpMarkerFrom = null; }
    if (_tpMarkerTo)   { _tpMarkerTo.remove();   _tpMarkerTo   = null; }
    // Clear shared walk state used by transit map taps
    ptStart = null; ptEnd = null;
    _coordFrom = null; _coordTo = null;
    _addrFrom.value = ''; _addrTo.value = '';
    _clearFromGPS();
    if (markerStart) { markerStart.remove(); markerStart = null; }
    if (markerEnd)   { markerEnd.remove();   markerEnd   = null; }
    _markerFrom = null; _markerTo = null;
    _clearTransitPlanMap();
    _hideRouteSheet();
    const st = document.getElementById('sheetTransit');
    if (st) st.classList.add('hidden');
}

function _makeTpPin(color) {
    const el = document.createElement('div');
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52" width="36" height="46">
      <path d="M20 2 C9.5 2 1 10.5 1 21 C1 34 20 50 20 50 C20 50 39 34 39 21 C39 10.5 30.5 2 20 2 Z"
            fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1.5"/>
      <circle cx="20" cy="21" r="8" fill="rgba(255,255,255,0.9)"/>
    </svg>`;
    el.style.cssText = 'cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4));';
    return el;
}

function _handleTransitMapClick(lat, lng) {
    _transitPopup.remove(); // close any stop popup

    function _fillReverse(field, lng, lat) {
        const input = field === 'from' ? _addrFrom : _addrTo;
        input.value = '…';
        _reverseGeocode(lng, lat).then(label => {
            input.value = label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        });
    }

    _spOpen();

    if (!ptStart) {
        ptStart = { lng, lat };
        _coordFrom = { lng, lat };
        _tpMapStep = 1;
        if (markerStart) markerStart.remove();
        markerStart = new mapboxgl.Marker({ element: _makeTpPin('#22c55e'), anchor: 'bottom' })
            .setLngLat([lng, lat]).addTo(map);
        _markerFrom = markerStart;
        _activeField = 'from';
        _fillReverse('from', lng, lat);
        setTimeout(() => { _addrTo.focus(); _activeField = 'to'; }, 120);
        toast('Klepněte na cíl cesty', 2500);
    } else if (!ptEnd) {
        ptEnd = { lng, lat };
        _coordTo = { lng, lat };
        _tpMapStep = 2;
        if (markerEnd) markerEnd.remove();
        markerEnd = new mapboxgl.Marker({ element: _makeTpPin('#ef4444'), anchor: 'bottom' })
            .setLngLat([lng, lat]).addTo(map);
        _markerTo = markerEnd;
        _activeField = 'to';
        _fillReverse('to', lng, lat);
        _tpAutoSearch();
    } else {
        // Third tap — restart
        _clearTransitMapState();
        toast('Klepněte na start', 2000);
    }
}

async function _tpAutoSearch() {
    if (!_coordFrom || !_coordTo) return;

    // Signature for identical-route detection: e.g. "L22:stopA-stopB|walk"
    function _legsSig(plan) {
        if (!plan || plan.error) return '';
        return plan.legs.map(l =>
            l.type === 'transit' ? `${l.route}:${l.fromSid}-${l.toSid}` : l.type
        ).join('|');
    }
    document.getElementById('transitPlanResult').innerHTML = '<div class="tpn-empty">Hledám spojení…</div>';
    document.getElementById('routeFromLabel').textContent = _addrFrom.value || 'Odkud…';
    document.getElementById('routeToLabel').textContent   = _addrTo.value   || 'Kam…';
    _showTransitPlanSheet();

    const avoidCb = document.getElementById('avoidNoisyStops');
    const wantQuiet = avoidCb && avoidCb.checked;
    const cmpEl = document.getElementById('transitCompare');

    try {
        await _ensureTransitData();

        if (wantQuiet) {
            // Two routes: fast + quiet
            const [planFast, planQuiet] = await Promise.all([
                _planTransitRoute(_coordFrom, _coordTo, false),
                _planTransitRoute(_coordFrom, _coordTo, true),
            ]);
            _transitPlanFast  = planFast;
            _transitPlanQuiet = planQuiet;

            // Show compare tabs
            if (cmpEl) cmpEl.classList.remove('hidden');
            const fmtM = (m) => { const mm = Math.round(m); return mm >= 60 ? `${Math.floor(mm/60)} h ${mm%60} min` : `${mm} min`; };
            const elFT = document.getElementById('optTransitFastTime');
            const elQT = document.getElementById('optTransitQuietTime');
            if (elFT) elFT.textContent = planFast && !planFast.error ? fmtM(planFast.totalMin) : '—';
            if (elQT) elQT.textContent = planQuiet && !planQuiet.error ? fmtM(planQuiet.totalMin) : '—';

            // Default to quiet variant
            _activeTransitVariant = 'quiet';
            const oF = document.getElementById('optTransitFast');
            const oQ = document.getElementById('optTransitQuiet');
            if (oF) oF.classList.remove('selected');
            if (oQ) oQ.classList.add('selected');

            const plan = planQuiet && !planQuiet.error ? planQuiet : planFast;

            // Detect identical routes and label
            const elQLabel = document.querySelector('#optTransitQuiet .text-xs');
            if (elQLabel) {
                const sameRoute = _legsSig(planFast) === _legsSig(planQuiet) && !planFast?.error && !planQuiet?.error;
                elQLabel.textContent = sameRoute ? '= nejrychlejší' : 'Tichá';
            }

            _renderTransitPlan(plan);
            if (plan && !plan.error) {
                await _drawTransitPlan(plan, _coordFrom, _coordTo);
                _syncNavBtn();
                const fmtM = (m) => { const mm = Math.round(m); return mm >= 60 ? `${Math.floor(mm/60)} h ${mm%60} min` : `${mm} min`; };
                toast(`Nalezeno spojení za ${fmtM(plan.totalMin)} 🚌`, 3500);
            } else {
                toast('Spojení nenalezeno.', 4000);
            }
        } else {
            // Single route (fastest)
            if (cmpEl) cmpEl.classList.add('hidden');
            _transitPlanFast = null;
            _transitPlanQuiet = null;
            const plan = await _planTransitRoute(_coordFrom, _coordTo, false);
            _renderTransitPlan(plan);
            if (plan && !plan.error) {
                await _drawTransitPlan(plan, _coordFrom, _coordTo);
                _syncNavBtn();
                const fmtM = (m) => { const mm = Math.round(m); return mm >= 60 ? `${Math.floor(mm/60)} h ${mm%60} min` : `${mm} min`; };
                toast(`Nalezeno spojení za ${fmtM(plan.totalMin)} 🚌`, 3500);
            } else {
                toast('Spojení nenalezeno.', 4000);
            }
        }
    } catch(e) {
        document.getElementById('transitPlanResult').innerHTML = `<div class="tpn-empty">Chyba: ${e.message}</div>`;
        toast('Chyba hledání spoje: ' + e.message, 5000);
        console.error('[MHD planner]', e);
    }
}