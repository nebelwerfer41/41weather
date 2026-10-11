import { normalizeForecast, normalizeMarine, number } from './meteoam-data.js';
import { meteogram, geocode, astronomy, RequestScope } from './services.js';
import { render, status } from './ui.js';
import { analyzeForecast } from './forecast-text.js';
const DEFAULT_LOCATION = { name: 'Roma, IT', lat: 41.902783, lon: 12.496366, tz: 'Europe/Rome' };
const requests = new RequestScope();
function updateUrl(location) {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ lat: location.lat.toFixed(5), lon: location.lon.toFixed(5), name: location.name, tz: location.tz });
    history.replaceState(null, '', url);
}
async function load(target) {
    const request = requests.begin();
    status(`Richiesta in corso: ${typeof target === 'string' ? target : target.name}…`);
    try {
        const location = typeof target === 'string' ? await geocode(target, request.signal) : target;
        if (!request.current()) return;
        const data = await meteogram('preset1', location, request.signal);
        if (!request.current()) return;
        const snapshot = normalizeForecast(data, location);
        // One analysis per atmospheric dataset; optional enrichments mutate this snapshot.
        snapshot.forecast = analyzeForecast(snapshot);
        // Commit a consistent location only after the required weather data is ready.
        render(snapshot);
        updateUrl(snapshot.location);
        document.getElementById('q').value = location.name;
        status('Previsioni caricate.');
        const enrich = async (source, fetchData, apply) => {
            try {
                const result = await fetchData();
                if (!request.current()) return;
                apply(result);
            } catch (error) {
                if (!request.current()) return;
                snapshot[`${source}Status`] = 'non disponibili';
                console.warn(`41weather: ${source}`, error);
            }
            if (request.current()) render(snapshot);
        };
        // Optional providers never block the atmospheric forecast or each other.
        await Promise.all([
            enrich('marine', () => meteogram('preset2', location, request.signal), raw => {
                snapshot.marine = normalizeMarine(raw);
                snapshot.marineStatus = snapshot.marine.size ? 'disponibili' : 'non disponibili per questo punto';
            }),
            enrich('astronomy', () => astronomy(snapshot, request.signal), result => {
                snapshot.astronomy = result;
                snapshot.astronomyStatus = snapshot.days.every(d => result.has(d.date)) ? 'disponibili' : 'parzialmente disponibili';
            })
        ]);
    } catch (error) {
        if (!request.current()) return;
        status(`${error.message}. Le eventuali previsioni precedenti restano visibili.`, true);
    }
}
function initialTarget() {
    const params = new URLSearchParams(location.search);
    const lat = number(params.get('lat')), lon = number(params.get('lon'));
    if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        return { lat, lon, name: params.get('name') || `${lat}, ${lon}`, tz: params.get('tz') };
    }
    return params.get('q')?.trim() || DEFAULT_LOCATION;
}
function search() {
    const q = document.getElementById('q').value.trim();
    if (q) load(q);
}
document.getElementById('searchBtn').addEventListener('click', search);
document.getElementById('q').addEventListener('keydown', event => { if (event.key === 'Enter') search(); });
document.getElementById('useRome').addEventListener('click', () => load(DEFAULT_LOCATION));
load(initialTarget());
