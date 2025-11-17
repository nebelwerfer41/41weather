// ---------- Utilities ----------
const degToArrow = (deg) => {
    if (deg == null || isNaN(deg)) return '•';
    const dirs = ['N', 'N-NE', 'NE', 'E-NE', 'E', 'E-SE', 'SE', 'S-SE', 'S', 'S-SW', 'SW', 'W-SW', 'W', 'W-NW', 'NW', 'N-NW', 'N'];
    return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5)];
};
const fmtDay = (iso, tz) => new Date(iso).toLocaleDateString('it-IT', { timeZone: tz, weekday: 'long', day: '2-digit', month: '2-digit' });
const fmtTime = (iso, tz) => new Date(iso).toLocaleString('it-IT', { timeZone: tz, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const fmtClock = (iso, tz) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleTimeString('it-IT', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
};
const mm = v => (v == null ? 0 : Math.round(Number(v) * 10) / 10);
const escapeAttr = (str = '') => String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
const ICON_META = {
    "01": { emoji: "☀️", label: "Sereno" },
    "02": { emoji: "🌫️", label: "Sole con foschia" },
    "03": { emoji: "🌫️", label: "Nebbia" },
    "04": { emoji: "🌤️", label: "Sole con nuvola" },
    "05": { emoji: "🌥️", label: "Molto nuvoloso" },
    "06": { emoji: "☁️", label: "Nuvoloso" },
    "07": { emoji: "☁️", label: "Nuvoloso" },
    "08": { emoji: "🌦️", label: "Nuvoloso con pioviggine" },
    "09": { emoji: "🌧️", label: "Pioggia" },
    "10": { emoji: "⛈️", label: "Temporale" },
    "11": { emoji: "🌨️", label: "Pioggia e neve" },
    "12": { emoji: "🌧️", label: "Pioggia e grandine" },
    "13": { emoji: "🌤️", label: "Sole con nuvola e foschia" },
    "14": { emoji: "🌫️", label: "Foschia" },
    "15": { emoji: "🧊", label: "Grandine" },
    "16": { emoji: "🌨️", label: "Neve" },
    "17": { emoji: "🌪️", label: "Tromba d'aria" },
    "18": { emoji: "💨", label: "Tempesta di polvere" },
    "19": { emoji: "💨", label: "Tempesta di sabbia" },
    "31": { emoji: "☀️", label: "Sereno (notte)" },
    "32": { emoji: "🌫️", label: "Foschia (notte)" },
    "33": { emoji: "🌫️", label: "Nebbia fitta (notte)" },
    "34": { emoji: "🌤️", label: "Parzialmente nuvoloso (notte)" },
    "35": { emoji: "🌥️", label: "Molto nuvoloso (notte)" },
    "36": { emoji: "🌤️", label: "Nuvoloso con schiarite (notte)" }
};

const MOON_EMOJI = {
    new: '🌑',
    waxing_crescent: '🌒',
    first_quarter: '🌓',
    waxing_gibbous: '🌔',
    full: '🌕',
    waning_gibbous: '🌖',
    last_quarter: '🌗',
    waning_crescent: '🌘'
};

const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};
const buildParamIndex = (paramlist = []) => paramlist.reduce((acc, param, idx) => {
    acc[param] = String(idx);
    return acc;
}, {});
const getSeries = (ds = {}, paramIndex, length) => {
    const row = ds[String(paramIndex)];
    const result = [];
    for (let i = 0; i < length; i++) {
        result.push(row ? row[String(i)] ?? null : null);
    }
    return result;
};
const getCell = (ds = {}, paramIndex, timeIndex) => {
    if (paramIndex == null) return null;
    const row = ds[String(paramIndex)];
    if (!row) return null;
    return row[String(timeIndex)] ?? null;
};
const codeToLabel = (codeStr) => {
    const code = String(codeStr || '').padStart(2, '0');
    return ICON_META[code]?.label || 'Condizione meteo sconosciuta';
};
const formatCoord = (value) => Math.round(Number(value) * 100000) / 100000;
const updateUrlWithLocation = (name, lat, lon) => {
    if (typeof window === 'undefined') return;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const params = new URLSearchParams(window.location.search);
    const latStr = formatCoord(lat).toFixed(5);
    const lonStr = formatCoord(lon).toFixed(5);
    let dirty = false;

    if (params.get('lat') !== latStr) { params.set('lat', latStr); dirty = true; }
    if (params.get('lon') !== lonStr) { params.set('lon', lonStr); dirty = true; }
    if (name) {
        const encodedName = name;
        if (params.get('name') !== encodedName) { params.set('name', encodedName); dirty = true; }
    } else if (params.has('name')) { params.delete('name'); dirty = true; }
    if (params.has('q')) { params.delete('q'); dirty = true; }

    if (!dirty) return;
    const newQuery = params.toString();
    const newUrl = `${window.location.pathname}${newQuery ? '?' + newQuery : ''}${window.location.hash}`;
    window.history.replaceState({}, '', newUrl);
};
const readLocationFromUrl = async () => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const latParam = params.get('lat');
    const lonParam = params.get('lon');
    const nameParam = params.get('name');
    if (latParam != null && lonParam != null) {
        const lat = parseFloat(latParam);
        const lon = parseFloat(lonParam);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
            return {
                name: nameParam || `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
                lat,
                lon,
                tz: null,
                query: null
            };
        }
    }
    const q = params.get('q');
    if (q) {
        try {
            const results = await geocode(q);
            if (results.length) {
                return { ...results[0], query: q };
            }
        } catch (err) {
            console.error('Impossibile risolvere location da URL', err);
        }
    }
    return null;
};
const syncTableStickyWidths = (tableEl) => {
    if (!tableEl) return;
    const firstCol = tableEl.querySelector('th:first-child, td:first-child');
    const secondCol = tableEl.querySelector('th:nth-child(2), td:nth-child(2)');
    if (firstCol) {
        const width = firstCol.getBoundingClientRect().width;
        if (width) tableEl.style.setProperty('--hour-col-width', `${width}px`);
    }
    if (secondCol) {
        const width = secondCol.getBoundingClientRect().width;
        if (width) tableEl.style.setProperty('--icon-col-width', `${width}px`);
    }
};
let stickyWidthRaf = null;
const scheduleStickyColumnSync = () => {
    if (typeof window === 'undefined') return;
    if (stickyWidthRaf) cancelAnimationFrame(stickyWidthRaf);
    stickyWidthRaf = requestAnimationFrame(() => {
        stickyWidthRaf = null;
        document.querySelectorAll('.table table').forEach(syncTableStickyWidths);
    });
};

// ---------- State ----------
const DEFAULT_LOCATION = { name: 'Roma, IT', lat: 41.902783, lon: 12.496366, tz: 'Europe/Rome' };

let state = {
    lat: DEFAULT_LOCATION.lat, lon: DEFAULT_LOCATION.lon, name: DEFAULT_LOCATION.name, tz: DEFAULT_LOCATION.tz, elev: null, chart: null,
    hourlyData: null, dailyData: null, expandedDay: null, hasMarineData: false, sunData: new Map()
};

// ---------- Fetch MeteoAM ----------
async function loadMeteoAM(preset, lat, lon) {
    const url = `https://api.meteoam.it/deda-meteograms/api/GetMeteogram/${preset}/${lat},${lon}`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
}

// Geocoding (Open-Meteo)
async function geocode(q) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=it&format=json`;
    const r = await fetch(url); if (!r.ok) throw new Error('geocoding');
    const j = await r.json();
    return (j.results || []).map(x => ({
        name: `${x.name}${x.admin1 ? ', ' + x.admin1 : ''}${x.country ? ', ' + x.country : ''}`,
        lat: x.latitude, lon: x.longitude, tz: x.timezone
    }));
}

const dayKeyFromIso = (iso) => (iso ? String(iso).slice(0, 10) : null);

const normalizePhaseId = (name = '') => {
    const t = name.toLowerCase();
    if (t.includes('new')) return 'new';
    if (t.includes('first')) return 'first_quarter';
    if (t.includes('full')) return 'full';
    if (t.includes('last') || t.includes('third')) return 'last_quarter';
    return null;
};

const formatTzOffset = (tz, date) => {
    try {
        const base = new Date(`${date}T12:00:00Z`);
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz || 'UTC',
            hour12: false,
            timeZoneName: 'longOffset',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        }).formatToParts(base);
        const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || '';
        const m = tzPart.match(/([+-]\d{2}):?(\d{2})/);
        if (m) return `${m[1]}:${m[2]}`;
    } catch (err) {
        console.warn('Impossibile calcolare offset per', tz, date, err);
    }
    return '+00:00';
};

async function fetchMetMoonData(lat, lon, date, tz) {
    // Manteniamo la firma per compatibilità, ma questo endpoint non viene più usato.
    return {
        moonPhaseValue: null,
        moonPhaseText: null,
        moonrise: null,
        moonset: null
    };
}

async function fetchSunriseSunsetOrg(lat, lon, date) {
    const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&date=${date}&formatted=0`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('Sunrise-Sunset.org ' + r.status);
    const j = await r.json();
    if (j.status !== 'OK') throw new Error('Sunrise-Sunset.org status ' + j.status);
    const res = j.results || {};
    return {
        sunrise: res.sunrise || null,
        sunset: res.sunset || null,
        civilDawn: res.civil_twilight_begin || null,
        civilDusk: res.civil_twilight_end || null,
        nauticalDawn: res.nautical_twilight_begin || null,
        nauticalDusk: res.nautical_twilight_end || null,
        astroDawn: res.astronomical_twilight_begin || null,
        astroDusk: res.astronomical_twilight_end || null
    };
}

async function fetchUsnoOneDay(lat, lon, date, tz) {
    const offsetStr = formatTzOffset(tz, date); // "+02:00"
    const offsetNum = Number(offsetStr.replace(':', ''));
    const tzHours = Math.trunc(offsetNum / 100);
    const tzQuery = tzHours;
    const url = `https://aa.usno.navy.mil/api/rstt/oneday?date=${date}&coords=${lat},${lon}&tz=${tzQuery}&dst=true`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('USNO oneday ' + r.status);
    const j = await r.json();
    const phaseName = j?.properties?.data?.curphase || j?.properties?.curphase || j?.curphase || '';
    const phaseId = normalizePhaseId(phaseName);
    const moonrise = j?.properties?.data?.moondata?.[0]?.rise || j?.properties?.moonrise || null;
    const moonset = j?.properties?.data?.moondata?.[0]?.set || j?.properties?.moonset || null;
    return { phaseId, phaseName, moonrise, moonset };
}

async function loadSunAndMoon(lat, lon, dates = [], tz = 'UTC') {
    const uniqueDates = Array.from(new Set(dates.filter(Boolean)));
    if (!uniqueDates.length) return new Map();
    const result = new Map();

    await Promise.all(uniqueDates.map(async (date) => {
        let fallbackData = null;
        try {
            fallbackData = await fetchSunriseSunsetOrg(lat, lon, date);
        } catch (err) {
            console.warn('Sunrise-Sunset.org non disponibile', err);
        }

        const merged = {
            sunrise: fallbackData?.sunrise || null,
            sunset: fallbackData?.sunset || null,
            civilDawn: fallbackData?.civilDawn || null,
            civilDusk: fallbackData?.civilDusk || null,
            nauticalDawn: fallbackData?.nauticalDawn || null,
            nauticalDusk: fallbackData?.nauticalDusk || null,
            astroDawn: fallbackData?.astroDawn || null,
            astroDusk: fallbackData?.astroDusk || null,
            moonPhaseValue: null,
            moonPhaseText: null,
            moonrise: null,
            moonset: null
        };

        result.set(date, merged);
    }));

    // USNO per-day: assegna icona solo quando cambia fase rispetto al giorno precedente
    const sortedDates = uniqueDates.slice().sort();
    let lastPhase = null;
    for (const d of sortedDates) {
        try {
            const usno = await fetchUsnoOneDay(lat, lon, d, tz);
            const info = result.get(d);
            if (!info) continue;
            info.moonPhaseText = usno.phaseName || null;
            if (usno.phaseId && usno.phaseId !== lastPhase) {
                info.moonEvent = MOON_EMOJI[usno.phaseId];
                lastPhase = usno.phaseId;
            } else {
                info.moonEvent = null;
            }
            info.moonrise = usno.moonrise || info.moonrise || null;
            info.moonset = usno.moonset || info.moonset || null;
            result.set(d, info);
        } catch (err) {
            console.warn('USNO non disponibile per', d, err);
        }
    }

    return result;
}

const buildSunTooltip = (info, tz) => {
    if (!info) return 'Orari alba/tramonto non disponibili';
    const lines = [
        `Civile: ⬆️ ${fmtClock(info.civilDawn, tz)} | ⬇️ ${fmtClock(info.civilDusk, tz)}`,
        `Nautico: ⬆️️ ${fmtClock(info.nauticalDawn, tz)} | ⬇️ ${fmtClock(info.nauticalDusk, tz)}`,
        `Astronomica: ⬆️ ${fmtClock(info.astroDawn, tz)} | ⬇️ ${fmtClock(info.astroDusk, tz)}`
    ];
    return lines.join('\n');
};

// ---------- Renderers ----------
function renderHeader(name, tz, elev) {
    document.getElementById('loc').textContent = name;
    document.getElementById('tz').textContent = tz || 'Europe/Rome';
    document.getElementById('elev').textContent = (elev != null ? Math.round(elev) + ' m s.l.m.' : '— m s.l.m.');
    document.getElementById('when').textContent = 'Aggiornato: ' + new Date().toLocaleString('it-IT', { timeZone: tz || 'Europe/Rome' });
    document.getElementById('sel').textContent = `Lat ${state.lat.toFixed(3)}, Lon ${state.lon.toFixed(3)} — ${tz || 'Europe/Rome'}`;
}

function groupHourlyByDay(ts, ds, tz, paramlist = [], marineData) {
    const dayGroups = {};
    if (!ts || !ds) return [];

    const len = ts.length;
    const idx = buildParamIndex(paramlist);

    const T = getSeries(ds, idx["2t"], len).map(toNumber);
    const RH = getSeries(ds, idx.r, len).map(toNumber);
    const P = getSeries(ds, idx.pmsl, len).map(toNumber);
    const R = getSeries(ds, idx.tpp, len).map(toNumber);
    const Wd = getSeries(ds, idx.wdir, len).map(toNumber);
    const Wc = getSeries(ds, idx.wcar, len);
    const WsKmh = getSeries(ds, idx.wkmh, len).map(toNumber);
    const WsMs = getSeries(ds, idx.wspd, len).map(toNumber);
    const GustKmh = WsMs.map(v => (v == null ? null : Math.round(v * 3.6)));
    const Icons = getSeries(ds, idx.icon, len);

    let marineByTime = null;
    if (marineData?.timeseries?.length) {
        const mIdx = buildParamIndex(marineData.paramlist || []);
        const mDs = marineData.datasets?.["0"] || {};
        marineByTime = new Map();
        for (let j = 0; j < marineData.timeseries.length; j++) {
            marineByTime.set(marineData.timeseries[j], {
                waveHeight: toNumber(getCell(mDs, mIdx.swh, j)),
                wavePeriod: toNumber(getCell(mDs, mIdx.mwp, j)),
                waveDir: toNumber(getCell(mDs, mIdx.mwd, j)),
                waveCard: getCell(mDs, mIdx.mcar, j),
                beaufort: toNumber(getCell(mDs, mIdx.wbeauf, j))
            });
        }
    }

    for (let i = 0; i < ts.length; i++) {
        const date = new Date(ts[i]);
        // Format as YYYY-MM-DD for comparison
        const year = date.toLocaleDateString('en-US', { timeZone: tz, year: 'numeric' });
        const month = date.toLocaleDateString('en-US', { timeZone: tz, month: '2-digit' });
        const day = date.toLocaleDateString('en-US', { timeZone: tz, day: '2-digit' });
        const dayKey = `${year}-${month}-${day}`;

        if (!dayGroups[dayKey]) {
            dayGroups[dayKey] = {
                date: dayKey,
                hours: [],
                hasMarine: false
            };
        }

        const marineInfo = marineByTime?.get(ts[i]) || null;
        if (marineInfo && (marineInfo.waveHeight != null || marineInfo.wavePeriod != null || marineInfo.waveDir != null || marineInfo.beaufort != null)) {
            dayGroups[dayKey].hasMarine = true;
        }

        dayGroups[dayKey].hours.push({
            time: ts[i],
            temp: T[i],
            humidity: RH[i],
            pressure: P[i],
            rain: R[i],
            windDir: Wd[i],
            windCard: Wc[i],
            windSpeed: WsKmh[i],
            gust: GustKmh[i],
            icon: Icons[i],
            waveHeight: marineInfo?.waveHeight ?? null,
            wavePeriod: marineInfo?.wavePeriod ?? null,
            waveDir: marineInfo?.waveDir ?? null,
            waveCard: marineInfo?.waveCard ?? null,
            beaufort: marineInfo?.beaufort ?? null
        });
    }

    return Object.values(dayGroups);
}

function renderDailyFromStats(stats, tz, hourlyGroups, hasMarine, sunDataByDay = new Map()) {
    const root = document.getElementById('days');
    root.innerHTML = '';
    if (!stats || !stats.length) { root.innerHTML = '<div class="muted">Nessun riepilogo giornaliero disponibile.</div>'; return; }

    const showMarine = Boolean(hasMarine);

    for (let i = 0; i < stats.length; i++) {
        const s = stats[i];
        const el = document.createElement('div');
        el.className = 'day-card';
        el.dataset.dayIndex = i;

        const iconSvg = codeToSVG(s.icon);
        const iconLabel = codeToLabel(s.icon);
        const isExpanded = state.expandedDay === i;
        const dayHours = hourlyGroups.find(g => g.date === s.localDate.slice(0, 10));
        const dateKey = dayKeyFromIso(s.localDate);
        const sunInfo = sunDataByDay.get(dateKey);
        const sunTimes = sunInfo ? `Alba: ${fmtClock(sunInfo.sunrise, tz)} | Tramonto: ${fmtClock(sunInfo.sunset, tz)}` : '—';
        const sunTooltip = escapeAttr(buildSunTooltip(sunInfo, tz));
        const moonEmoji = sunInfo?.moonEvent || '';
        const moonTitle = sunInfo?.moonPhaseText ? ` title="${escapeAttr(sunInfo.moonPhaseText)}"` : '';

        el.innerHTML = `
      <div class="day-header" style="cursor:pointer;user-select:none">
        <div class="flex" style="justify-content:space-between;align-items:center">
          <div class="flex" style="align-items:center;gap:8px">
            <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
            <img class="icon" src="${iconSvg}" alt="${iconLabel}" title="${iconLabel}">
            <div class="day-title-wrap">
              <div class="day-title">${fmtDay(s.localDate, tz)}</div>
              <div class="sun-row tooltip" data-tooltip="${sunTooltip}" tabindex="0">
                <span class="sun-times">${sunTimes}</span>
              </div>
            </div>
            ${moonEmoji ? `<span class="moon-event"${moonTitle}>${moonEmoji}</span>` : ''}
          </div>            
            <div class="big">${s.maxCelsius}° / ${s.minCelsius}°</div>
          </div>
        </div>
      </div>
      <div class="day-details" style="display:${isExpanded ? 'block' : 'none'}">
        ${dayHours ? renderDayHours(dayHours, tz, showMarine && dayHours.hasMarine) : '<div class="muted">Dati orari non disponibili</div>'}
      </div>
    `;
        root.appendChild(el);

        el.querySelector('.day-header').addEventListener('click', () => {
            state.expandedDay = state.expandedDay === i ? null : i;
            renderDailyFromStats(stats, tz, hourlyGroups, hasMarine, sunDataByDay);
        });
        const sunRowEl = el.querySelector('.sun-row');
        if (sunRowEl) {
            ['click', 'touchstart'].forEach(evt => {
                sunRowEl.addEventListener(evt, (e) => e.stopPropagation());
            });
        }
    }
    scheduleStickyColumnSync();
}

function renderDayHours(dayGroup, tz, showMarine) {
    let html = '<div class="table" style="max-height:400px;margin-top:10px"><table>';
    html += `<tr>
    <th>Ora</th><th class="icon-header" aria-label="Icona meteo">&nbsp;</th><th>Temp (°C)</th><th>Pioggia (mm)</th><th>Umidità (%)</th>
    <th>Pressione (hPa)</th><th>Vento (km/h)</th><th>Raffica (km/h)</th><th>Direzione</th>
    ${showMarine ? '<th>Onde (m)</th><th>Periodo (s)</th><th>Dir. onda</th><th>Beaufort</th>' : ''}
  </tr>`;

    for (const h of dayGroup.hours) {
        const iconSvg = codeToSVG(h.icon);
        const iconLabel = codeToLabel(h.icon);
        const gustCell = (h.gust != null && h.windSpeed != null && h.gust > h.windSpeed) ? h.gust : '—';
        const marineHeightCell = showMarine
            ? (Number.isFinite(h.waveHeight) ? Math.round(h.waveHeight * 10) / 10 + ' m' : '—')
            : '';
        const marinePeriodCell = showMarine
            ? (Number.isFinite(h.wavePeriod) ? Math.round(h.wavePeriod * 10) / 10 + ' s' : '—')
            : '';
        const marineDirCell = showMarine
            ? (() => {
                if (Number.isFinite(h.waveDir)) {
                    const dirCard = h.waveCard || degToArrow(h.waveDir);
                    return `${Math.round(h.waveDir)}° (${dirCard})`;
                }
                return h.waveCard || '—';
            })()
            : '';
        const beaufortCell = showMarine
            ? (Number.isFinite(h.beaufort) ? h.beaufort : '—')
            : '';

        html += `<tr>
      <td>${fmtTime(h.time, tz)}</td>
      <td><img class="icon" src="${iconSvg}" alt="${iconLabel}" title="${iconLabel}" style="width:24px;height:24px"></td>
      <td><span class="temp">${Math.round(h.temp)}°C</span></td>
      <td class="rain">${mm(h.rain) > 0 ? mm(h.rain) + ' mm' : '—'}</td>
      <td class="humidity">${h.humidity}%</td>
      <td>${Math.round(h.pressure)}</td>
      <td class="wind">${Math.round(h.windSpeed)}</td>
      <td class="wind">${gustCell}</td>
      <td title="${h.windCard || ''}">${isFinite(h.windDir) ? Math.round(h.windDir) + '° (' + degToArrow(h.windDir) + ')' : (h.windCard || '')}</td>
      ${showMarine ? `<td>${marineHeightCell}</td><td>${marinePeriodCell}</td><td>${marineDirCell}</td><td>${beaufortCell}</td>` : ''}
    </tr>`;
    }
    html += '</table></div>';
    return html;
}

function renderHourly(ts, ds, tz) {
    // paramlist: ["2t","r","pmsl","tpp","wdir","wcar","wspd","wkmh","2tf","icon"]
    const T = Object.values(ds["0"]).map(Number);   // 2t °C
    const R = Object.values(ds["3"]).map(Number);   // tpp mm
    renderChart(ts, T, R, tz);
}

function renderChart(ts, temp, rain, tz) {
    const ctx = document.getElementById('chart').getContext('2d');
    const labels = ts.map(t => new Date(t).toLocaleString('it-IT', { timeZone: tz, hour: '2-digit', day: '2-digit', month: '2-digit' }));
    if (state.chart) { state.chart.destroy(); }
    state.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels, datasets: [
                {
                    label: 'Temperatura °C',
                    data: temp,
                    yAxisID: 'y',
                    borderColor: '#6aa6ff',
                    backgroundColor: 'rgba(106, 166, 255, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    borderWidth: 2
                },
                {
                    label: 'Pioggia mm',
                    data: rain,
                    yAxisID: 'y1',
                    borderColor: '#41c97c',
                    backgroundColor: 'rgba(65, 201, 124, 0.15)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            stacked: false,
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#a9b6cc' }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#a9b6cc' }
                },
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#a9b6cc', maxRotation: 45, minRotation: 45 }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#d9e2f2' },
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#1a2740',
                    titleColor: '#e9eef7',
                    bodyColor: '#e9eef7',
                    borderColor: '#2a3a61',
                    borderWidth: 1,
                    padding: 12
                }
            }
        }
    });
}

// Codici icona MeteoAM -> SVG/emoji (WWIS/WMO WxIcons_it)
function codeToSVG(codeStr) {
    const code = String(codeStr || '').padStart(2, '0');

    const emoji = ICON_META[code]?.emoji || "❓";

    const svg = `
<svg xmlns='http://www.w3.org/2000/svg' width='50' height='50'>
  <text x='0' y='40' font-size='40'>${emoji}</text>
</svg>
    `.trim();

    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

// ---------- Orchestrator ----------
async function loadAll(name, lat, lon) {
    state.lat = lat; state.lon = lon; state.name = name;
    state.expandedDay = null;
    document.getElementById('searchBtn').disabled = true;
    const main = document.querySelector('main');
    main.classList.add('loading');
    try {
        const [data, marineCandidate] = await Promise.all([
            loadMeteoAM('preset1', lat, lon),
            loadMeteoAM('preset2', lat, lon).catch((err) => {
                console.warn('Preset2 non disponibile per questo punto', err);
                return null;
            })
        ]);
        const marineData = marineCandidate?.timeseries?.length ? marineCandidate : null;
        const tz = data?.extrainfo?.timezone || 'Europe/Rome';
        const elev = data?.extrainfo?.elevation ?? null;
        renderHeader(name, tz, elev);
        const searchInput = document.getElementById('q');
        if (searchInput) {
            searchInput.value = name || '';
        }
        updateUrlWithLocation(name, lat, lon);

        const ds = data?.datasets?.["0"];
        if (!ds) { throw new Error('Formato inatteso (datasets mancante)'); }

        // Group hourly data by day
        const hourlyGroups = groupHourlyByDay(data.timeseries, ds, tz, data.paramlist, marineData);
        const hasMarineData = hourlyGroups.some(g => g.hasMarine);
        state.hourlyData = hourlyGroups;
        state.hasMarineData = hasMarineData;
        const dailyStats = data?.extrainfo?.stats || [];
        const sunDates = dailyStats.map(s => dayKeyFromIso(s.localDate)).filter(Boolean);
        state.sunData = await loadSunAndMoon(lat, lon, sunDates, tz);

        // Render daily summaries with expandable cards
        renderDailyFromStats(dailyStats, tz, hourlyGroups, hasMarineData, state.sunData);

        // Keep overall chart for first day
        renderHourly(data.timeseries, ds, tz);
    } catch (e) {
        alert('Errore nel caricamento: ' + e.message);
        console.error(e);
    } finally {
        document.getElementById('searchBtn').disabled = false;
        main.classList.remove('loading');
        document.getElementById('sel').textContent = `Lat ${state.lat.toFixed(3)}, Lon ${state.lon.toFixed(3)} — ${document.getElementById('tz').textContent}`;
    }
}

// ---------- Events ----------
async function performSearch() {
    const q = document.getElementById('q').value.trim();
    if (!q) return;
    try {
        const results = await geocode(q);
        if (!results.length) { alert('Nessun risultato'); return; }
        const best = results[0];
        await loadAll(best.name, best.lat, best.lon);
    } catch (e) {
        alert('Errore ricerca città'); console.error(e);
    }
}

async function init() {
    document.getElementById('searchBtn').addEventListener('click', performSearch);

    document.getElementById('q').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    const quickBtn = document.getElementById('useRome');
    if (quickBtn) {
        quickBtn.addEventListener('click', () => {
            loadAll(DEFAULT_LOCATION.name, DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
        });
    }

    const urlLocation = await readLocationFromUrl();
    if (urlLocation) {
        if (urlLocation.query && document.getElementById('q')) {
            document.getElementById('q').value = urlLocation.query;
        }
        await loadAll(urlLocation.name, urlLocation.lat, urlLocation.lon);
    } else {
        await loadAll(DEFAULT_LOCATION.name, DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
