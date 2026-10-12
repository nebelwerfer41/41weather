import { dateKey } from './meteoam-data.js';

// Keep local times compact; explain their timezone and any repeated clocks once.
export function timeDisplay(samples, tz) {
    const timeFormat = new Intl.DateTimeFormat('it-IT', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const stampFormat = new Intl.DateTimeFormat('it-IT', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const zoneFormat = new Intl.DateTimeFormat('it-IT', { timeZone: tz, timeZoneName: 'shortOffset' });
    const valid = time => time != null && Number.isFinite(new Date(time).getTime());
    const offset = time => zoneFormat.formatToParts(new Date(time)).find(p => p.type === 'timeZoneName').value;
    const key = time => `${dateKey(new Date(time).getTime(), tz)}T${timeFormat.format(new Date(time))}`;
    const occurrences = new Map(), offsets = new Set();
    for (const { time } of samples.filter(h => valid(h.time)).slice().sort((a, b) => new Date(a.time) - new Date(b.time))) {
        const zone = offset(time), local = key(time);
        offsets.add(zone);
        if (!occurrences.has(local)) occurrences.set(local, []);
        if (!occurrences.get(local).includes(zone)) occurrences.get(local).push(zone);
    }
    const repeated = new Map([...occurrences].filter(([, zones]) => zones.length > 1));
    const ordinal = index => ['¹', '²', '³'][index] ?? `(${index + 1})`;
    const marker = time => {
        if (!valid(time)) return '';
        const zones = repeated.get(key(time));
        return zones ? ordinal(zones.indexOf(offset(time))) : '';
    };
    const repeats = [...repeated].map(([local, zones]) => {
        const [date, clock] = local.split('T');
        const label = new Date(`${date}T12:00:00Z`).toLocaleDateString('it-IT', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
        return `${label}: ${zones.map((zone, i) => `${clock}${ordinal(i)} ${zone}`).join(', ')}`;
    });
    return {
        marker,
        clock: time => valid(time) ? `${timeFormat.format(new Date(time))}${marker(time)}` : '—',
        timestamp: time => valid(time) ? `${stampFormat.format(new Date(time))}${marker(time)}` : '—',
        description: `Fuso orario: ${tz}${offsets.size ? ` (${[...offsets].join(' / ')})` : ''}. Orari riferiti alla località selezionata.${repeats.length ? ` Ore ripetute al cambio d’ora: ${repeats.join('; ')}.` : ''}`
    };
}
