import { normalizeAstronomy } from './meteoam-data.js';
const cache = new Map();
// Abort superseded locations; every request has a finite deadline. Failures are not cached.
export async function fetchJson(url, signal, ttl = 0) {
    const hit = cache.get(url);
    if (hit && hit.expires > Date.now()) return hit.value;
    const deadline = AbortSignal.timeout(15000);
    const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, deadline]) : deadline });
    if (!response.ok) throw new Error(`Servizio non disponibile (HTTP ${response.status})`);
    const value = await response.json();
    if (ttl) {
        if (cache.size >= 64) cache.delete(cache.keys().next().value);
        cache.set(url, { value, expires: Date.now() + ttl });
    }
    return value;
}
export const meteogram = (preset, location, signal) => fetchJson(
    `https://api.meteoam.it/deda-meteograms/api/GetMeteogram/${preset}/${location.lat},${location.lon}`, signal);
export async function geocode(query, signal) {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({ name: query, count: '5', language: 'it', format: 'json' });
    const data = await fetchJson(url.href, signal, 86400000);
    const place = data.results?.[0];
    if (!place) throw new Error('Località non trovata');
    return { name: [place.name, place.admin1, place.country_code].filter(Boolean).join(', '), lat: place.latitude, lon: place.longitude, tz: place.timezone };
}
export async function astronomy(snapshot, signal) {
    const { lat, lon, tz } = snapshot.location;
    const url = new URL('https://api.sunrise-sunset.org/v2');
    url.search = new URLSearchParams({ lat, lng: lon, tz, date_start: snapshot.days[0].date, date_end: snapshot.days.at(-1).date });
    return normalizeAstronomy(await fetchJson(url.href, signal, 86400000));
}
// One generation owns both the main forecast and its optional enrichments.
export class RequestScope {
    begin() {
        this.controller?.abort();
        this.controller = new AbortController();
        const controller = this.controller;
        return { signal: controller.signal, current: () => this.controller === controller && !controller.signal.aborted };
    }
}
