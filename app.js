// ---------- Utilities ----------
const degToArrow = (deg) => {
    if (deg == null || isNaN(deg)) return '•';
    const dirs = ['N', 'N-NE', 'NE', 'E-NE', 'E', 'E-SE', 'SE', 'S-SE', 'S', 'S-SW', 'SW', 'W-SW', 'W', 'W-NW', 'NW', 'N-NW', 'N'];
    return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5)];
};
const fmtDay = (iso, tz) => new Date(iso).toLocaleDateString('it-IT', { timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit' });
const fmtTime = (iso, tz) => new Date(iso).toLocaleString('it-IT', { timeZone: tz, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const mm = v => (v == null ? 0 : Math.round(Number(v) * 10) / 10);

// ---------- State ----------
const DEFAULT_LOCATION = { name: 'Roma, IT', lat: 41.902783, lon: 12.496366, tz: 'Europe/Rome' };

let state = {
    lat: DEFAULT_LOCATION.lat, lon: DEFAULT_LOCATION.lon, name: DEFAULT_LOCATION.name, tz: DEFAULT_LOCATION.tz, elev: null, chart: null,
    hourlyData: null, dailyData: null, expandedDay: null
};

// ---------- Fetch MeteoAM ----------
async function loadMeteoAM(lat, lon) {
    const url = `https://api.meteoam.it/deda-meteograms/api/GetMeteogram/preset1/${lat},${lon}`;
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

// ---------- Renderers ----------
function renderHeader(name, tz, elev) {
    document.getElementById('loc').textContent = name;
    document.getElementById('tz').textContent = tz || 'Europe/Rome';
    document.getElementById('elev').textContent = (elev != null ? Math.round(elev) + ' m s.l.m.' : '— m s.l.m.');
    document.getElementById('when').textContent = 'Aggiornato: ' + new Date().toLocaleString('it-IT', { timeZone: tz || 'Europe/Rome' });
    document.getElementById('sel').textContent = `Lat ${state.lat.toFixed(3)}, Lon ${state.lon.toFixed(3)} — ${tz || 'Europe/Rome'}`;
}

function groupHourlyByDay(ts, ds, tz) {
    const dayGroups = {};
    const T = Object.values(ds["0"]).map(Number);
    const RH = Object.values(ds["1"]).map(Number);
    const P = Object.values(ds["2"]).map(Number);
    const R = Object.values(ds["3"]).map(Number);
    const Wd = Object.values(ds["4"]).map(Number);
    const Wc = Object.values(ds["5"]);
    const WsKmh = Object.values(ds["7"]).map(Number);
    const GustMs = Object.values(ds["6"]).map(Number);
    const GustKmh = GustMs.map(v => Math.round(Number(v) * 3.6));
    const Icons = Object.values(ds["9"]); // icon is at index 9

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
                hours: []
            };
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
            icon: Icons[i]
        });
    }

    return Object.values(dayGroups);
}

function renderDailyFromStats(stats, tz, hourlyGroups) {
    const root = document.getElementById('days');
    root.innerHTML = '';
    if (!stats || !stats.length) { root.innerHTML = '<div class="muted">Nessun riepilogo giornaliero disponibile.</div>'; return; }

    for (let i = 0; i < stats.length; i++) {
        const s = stats[i];
        const el = document.createElement('div');
        el.className = 'day-card';
        el.dataset.dayIndex = i;

        const iconSvg = codeToSVG(s.icon);
        const isExpanded = state.expandedDay === i;
        const dayHours = hourlyGroups.find(g => g.date === s.localDate.slice(0, 10));

        el.innerHTML = `
      <div class="day-header" style="cursor:pointer;user-select:none">
        <div class="flex" style="justify-content:space-between;align-items:center">
          <div class="flex" style="align-items:center;gap:8px">
            <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
            <img class="icon" src="${iconSvg}" alt="">
            <div class="day-title">${fmtDay(s.localDate, tz)}</div>
          </div>
          <span class="big">${s.maxCelsius}° / ${s.minCelsius}°</span>
        </div>
      </div>
      <div class="day-details" style="display:${isExpanded ? 'block' : 'none'}">
        ${dayHours ? renderDayHours(dayHours, tz) : '<div class="muted">Dati orari non disponibili</div>'}
      </div>
    `;
        root.appendChild(el);

        el.querySelector('.day-header').addEventListener('click', () => {
            state.expandedDay = state.expandedDay === i ? null : i;
            renderDailyFromStats(stats, tz, hourlyGroups);
        });
    }
}

function renderDayHours(dayGroup, tz) {
    let html = '<div class="table" style="max-height:400px;margin-top:10px"><table>';
    html += `<tr>
    <th>Ora</th><th></th><th>Temp (°C)</th><th>Pioggia (mm)</th><th>Umidità (%)</th>
    <th>Pressione (hPa)</th><th>Vento (km/h)</th><th>Raffica (km/h)</th><th>Direzione</th>
  </tr>`;

    for (const h of dayGroup.hours) {
        const iconSvg = codeToSVG(h.icon);
        html += `<tr>
      <td>${fmtTime(h.time, tz)}</td>
      <td><img class="icon" src="${iconSvg}" alt="" style="width:24px;height:24px"></td>
      <td><span class="temp">${Math.round(h.temp)}°C</span></td>
      <td class="rain">${mm(h.rain) > 0 ? mm(h.rain) + ' mm' : '—'}</td>
      <td class="humidity">${h.humidity}%</td>
      <td>${Math.round(h.pressure)}</td>
      <td class="wind">${Math.round(h.windSpeed)}</td>
      <td class="wind">${h.gust > h.windSpeed ? h.gust : '—'}</td>
      <td title="${h.windCard || ''}">${isFinite(h.windDir) ? Math.round(h.windDir) + '° (' + degToArrow(h.windDir) + ')' : (h.windCard || '')}</td>
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

    // Mappatura unica (no lune, il meteo prevale)
    const map = {
        "01": "☀️",     // Sereno
        "02": "🌫️",     // Sole + foschia
        "03": "🌫️",     // Nebbia
        "04": "🌤️",     // Sole + nuvola
        "05": "🌥️",     // Molto nuvoloso
        "06": "☁️",     // Nuvoloso
        "07": "☁️",     // Alias
        "08": "🌦️",     // Nuvoloso + pioggerella
        "09": "🌧️",     // Pioggia
        "10": "⛈️",     // Temporale
        "11": "🌨️",     // Pioggia + neve
        "12": "🌧️",     // Pioggia + grandine -> meglio pioggia come emoji singola
        "13": "🌤️",     // Sole + nuvola + foschia
        "14": "🌫️",     // Foschia
        "15": "🧊",     // Grandine
        "16": "🌨️",     // Neve
        "17": "🌪️",     // Tromba d’aria
        "18": "💨",     // Tempesta di polvere
        "19": "💨",     // Tempesta di sabbia

        // Notte → usare meteo equivalente
        "31": "☀️",     // Sereno notte -> meteo prevale
        "32": "🌫️",     // Nebbia notte
        "33": "🌫️",
        "34": "🌤️",
        "35": "🌥️",
        "36": "🌤️",
    };

    const emoji = map[code] || "❓";

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
        const data = await loadMeteoAM(lat, lon);
        const tz = data?.extrainfo?.timezone || 'Europe/Rome';
        const elev = data?.extrainfo?.elevation ?? null;
        renderHeader(name, tz, elev);

        const ds = data?.datasets?.["0"];
        if (!ds) { throw new Error('Formato inatteso (datasets mancante)'); }

        // Group hourly data by day
        const hourlyGroups = groupHourlyByDay(data.timeseries, ds, tz);
        state.hourlyData = hourlyGroups;

        // Render daily summaries with expandable cards
        renderDailyFromStats(data?.extrainfo?.stats || [], tz, hourlyGroups);

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

function init() {
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

    loadAll(DEFAULT_LOCATION.name, DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
