// Provider contracts are translated here; views never interpret raw dataset indices.
export function number(value) {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    if (typeof value === 'string' && !value.trim()) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
export function timezone(...candidates) {
    for (const tz of candidates) {
        if (!tz) continue;
        try { new Intl.DateTimeFormat('en', { timeZone: tz }); return tz; } catch { /* next */ }
    }
    return 'UTC';
}
export function dateKey(time, tz) {
    const parts = new Intl.DateTimeFormat('en', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(time));
    return ['year', 'month', 'day'].map(key => parts.find(p => p.type === key).value).join('-');
}
// One catalog serves provider icons and editorial analysis. Phenomenon icons do
// not imply a cloud cover; day/night variants share atmospheric semantics.
const descriptor = (emoji, label, sky = null, obscuration = null, phenomenon = null, variant = 'day') =>
    Object.assign([emoji, label], { sky, obscuration, phenomenon, variant });
export const ICONS = {
    '01': descriptor('☀️', 'Sereno', 0),
    '02': descriptor('🌤️', 'Parzialmente velato', null, 'velature parziali'),
    '03': descriptor('🌥️', 'Velato', null, 'velature'),
    '04': descriptor('🌤️', 'Poco nuvoloso', 1),
    '05': descriptor('🌥️', 'Molto nuvoloso', 2),
    '06': descriptor('☁️', 'Coperto', 3), '07': descriptor('☁️', 'Coperto', 3),
    '08': descriptor('🌦️', 'Pioggia debole', null, null, 'pioggia'),
    '09': descriptor('🌧️', 'Pioggia forte', null, null, 'pioggia'),
    '10': descriptor('⛈️', 'Temporale', null, null, 'temporale'),
    '11': descriptor('🌨️', 'Pioggia e neve', null, null, 'pioggia e neve'),
    '12': descriptor('🌧️', 'Pioggia congelantesi', null, null, 'pioggia congelantesi'),
    '13': descriptor('🌫️', 'Foschia', null, 'foschia', 'foschia'),
    '14': descriptor('🌫️', 'Nebbia', null, 'nebbia', 'nebbia'),
    '15': descriptor('🧊', 'Grandine', null, null, 'grandine'),
    '16': descriptor('🌨️', 'Neve', null, null, 'neve'),
    '17': descriptor('🌪️', 'Tromba d’aria o marina', null, null, 'tromba d’aria o marina'),
    '18': descriptor('💨', 'Fumo', null, 'fumo', 'fumo'),
    '19': descriptor('💨', 'Tempesta di sabbia', null, 'sabbia', 'tempesta di sabbia'),
    '31': descriptor('🌙', 'Sereno (notte)', 0, null, null, 'night'),
    '32': descriptor('🌙', 'Parzialmente velato (notte)', null, 'velature parziali', null, 'night'),
    '33': descriptor('🌙', 'Velato (notte)', null, 'velature', null, 'night'),
    '34': descriptor('☁️', 'Poco nuvoloso (notte)', 1, null, null, 'night'),
    '35': descriptor('☁️', 'Molto nuvoloso (notte)', 2, null, null, 'night'),
    '36': descriptor('🌫️', 'Foschia (notte)', null, 'foschia', 'foschia', 'night')
};
const iconKey = code => String(code ?? '').padStart(2, '0');
export const iconSemantics = code => Object.hasOwn(ICONS, iconKey(code)) ? ICONS[iconKey(code)] : null;
export const icon = code => iconSemantics(code)?.slice(0, 2) ?? ['❔', 'Condizione non disponibile'];
function rows(data) {
    const params = data.paramlist ?? [];
    const ds = data.datasets?.['0'] ?? {};
    return (data.timeseries ?? []).map((iso, i) => {
        const time = Date.parse(iso);
        const get = name => ds[String(params.indexOf(name))]?.[String(i)] ?? null;
        return { time, get };
    }).filter(r => Number.isFinite(r.time)).sort((a, b) => a.time - b.time);
}
const bounded = (v, min, max) => { const n = number(v); return n !== null && n >= min && n <= max ? n : null; };
export function normalizeForecast(data, location, fetchedAt = Date.now()) {
    if (!data.datasets?.['0']) throw new Error('Previsioni MeteoAM non disponibili');
    const tz = timezone(data.extrainfo?.timezone, location.tz);
    const hours = rows(data).map(({ time, get }) => ({
        time, date: dateKey(time, tz), temp: number(get('2t')), humidity: bounded(get('r'), 0, 100),
        pressure: number(get('pmsl')), probability: bounded(get('tpp'), 0, 100),
        windSpeed: bounded(get('wkmh'), 0, Infinity) ?? (bounded(get('wspd'), 0, Infinity) === null ? null : number(get('wspd')) * 1.852),
        windDir: bounded(get('wdir'), 0, 360), icon: get('icon')
    }));
    if (!hours.length) throw new Error('Nessuna copertura atmosferica disponibile per questa località');
    const stats = new Map((data.extrainfo?.stats ?? []).map(s => [s.localDate?.slice(0, 10), s]));
    const grouped = new Map();
    for (const hour of hours) {
        if (!grouped.has(hour.date)) grouped.set(hour.date, []);
        grouped.get(hour.date).push(hour);
    }
    const days = [...grouped].map(([date, samples]) => {
        const stat = stats.get(date);
        const temperatures = samples.map(h => h.temp).filter(v => v !== null);
        const min = number(stat?.minCelsius), max = number(stat?.maxCelsius);
        return { date, hours: samples, min: min ?? (temperatures.length ? Math.min(...temperatures) : null),
            max: max ?? (temperatures.length ? Math.max(...temperatures) : null),
            sampledExtremes: min === null || max === null, icon: stat?.icon ?? samples[0].icon };
    });
    return { location: { ...location, tz }, hours, days, fetchedAt,
        elevation: number(data.extrainfo?.elevation), models: data.extrainfo?.models ?? {}, marine: null, astronomy: new Map() };
}
export function normalizeMarine(data) {
    return new Map(rows(data).map(({ time, get }) => [time, {
        height: bounded(get('swh'), 0, Infinity), period: bounded(get('mwp'), 0, Infinity),
        direction: bounded(get('mwd'), 0, 360), beaufort: bounded(get('wbeauf'), 0, 12)
    }]).filter(([, r]) => Object.values(r).some(v => v !== null)));
}
export const MOON_PHASES = {
    'New Moon': ['🌑', 'Luna nuova'], 'Waxing Crescent': ['🌒', 'Luna crescente'],
    'First Quarter': ['🌓', 'Primo quarto'], 'Waxing Gibbous': ['🌔', 'Gibbosa crescente'],
    'Full Moon': ['🌕', 'Luna piena'], 'Waning Gibbous': ['🌖', 'Gibbosa calante'],
    'Last Quarter': ['🌗', 'Ultimo quarto'], 'Waning Crescent': ['🌘', 'Luna calante']
};
export function normalizeAstronomy(payload) {
    const days = payload.days ?? (payload.date ? [payload] : []);
    if (!Array.isArray(days) || !days.length) throw new Error('Dati astronomici non disponibili');
    return new Map(days.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date)).map(d => [d.date, {
        ...d, phase: MOON_PHASES[d.moon_phase] ?? ['🌙', 'Fase non disponibile'],
        illumination: bounded(d.moon_illumination, 0, 100)
    }]));
}
