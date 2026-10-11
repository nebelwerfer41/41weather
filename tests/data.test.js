import test from 'node:test';
import assert from 'node:assert/strict';
import { number, timezone, dateKey, normalizeForecast, normalizeMarine, normalizeAstronomy, MOON_PHASES, icon } from '../meteoam-data.js';
import { RequestScope, fetchJson } from '../services.js';
const fixture = {
    timeseries: ['2026-10-25T00:00:00Z', '2026-10-25T01:00:00Z', '2026-10-25T04:00:00Z'],
    paramlist: ['tpp', 'wspd', '2t'], datasets: { '0': { '0': { '0': 0, '1': 50, '2': '' }, '1': { '0': 10, '1': null }, '2': { '0': 12, '1': 10, '2': '-' } } },
    extrainfo: { timezone: 'Europe/Rome', stats: [{ localDate: '2026-10-25T00:00:00+02:00', minCelsius: '-', maxCelsius: '-' }] }
};
test('missing values stay missing, real zero survives', () => {
    for (const n of [null, undefined, '', ' ', '-', false, true, NaN, Infinity, {}, []]) assert.equal(number(n), null);
    assert.equal(number('0'), 0);
});
test('parameters use names; wind knots are converted and tpp remains probability', () => {
    const s = normalizeForecast(fixture, {});
    assert.equal(s.hours[0].windSpeed, 18.52);
    assert.equal(s.hours[0].probability, 0);
    assert.equal(s.hours[1].windSpeed, null);
    assert.equal(s.hours[2].temp, null);
    assert.equal(s.days[0].min, 10); assert.equal(s.days[0].max, 12);
    assert.equal(s.days[0].sampledExtremes, true);
    assert.equal(s.hours[2].time - s.hours[1].time, 10800000);
    assert.ok(!('gust' in s.hours[0]));
});
test('timezone fallback and DST use local dates and distinct UTC instants', () => {
    assert.equal(timezone('bad', 'Asia/Kolkata'), 'Asia/Kolkata');
    assert.equal(timezone(), 'UTC');
    assert.equal(dateKey('2026-10-24T23:00:00Z', 'Europe/Rome'), '2026-10-25');
    const s = normalizeForecast(fixture, {});
    assert.notEqual(s.hours[0].time, s.hours[1].time); assert.equal(s.days.length, 1);
});
test('marine joins equivalent UTC instants; empty inland payload is unavailable', () => {
    const sea = normalizeMarine({ timeseries: ['2026-10-25T02:00:00+02:00'], paramlist: ['swh'], datasets: { '0': { '0': { '0': 0 } } } });
    assert.equal(sea.get(Date.parse(fixture.timeseries[0])).height, 0);
    assert.equal(sea.get(Date.parse(fixture.timeseries[1])), undefined);
    assert.equal(normalizeMarine({ timeseries: [], datasets: {} }).size, 0);
});
test('Sunrise-Sunset v2 preserves all daily phases and nullable polar events', () => {
    const days = Object.keys(MOON_PHASES).map((phase, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, moon_phase: phase, moon_illumination: i ? 50 : 0, sunrise: null, moonrise: null }));
    const result = normalizeAstronomy({ days });
    assert.equal(result.size, 8); assert.equal(result.get('2026-10-01').illumination, 0);
    assert.equal(result.get('2026-10-01').sunrise, null);
    assert.equal(normalizeAstronomy(days[0]).size, 1);
    assert.equal(icon('12')[1], 'Pioggia congelantesi');
});
test('superseded searches cannot commit either forecasts or enrichments', async () => {
    const scope = new RequestScope(); const first = scope.begin();
    const second = scope.begin();
    assert.equal(first.signal.aborted, true); assert.equal(first.current(), false); assert.equal(second.current(), true);
    await Promise.resolve(); assert.equal(first.current(), false);
});
test('HTTP failures propagate and are not cached', async () => {
    const original = globalThis.fetch; let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response('{}', { status: 429 }); };
    try { await assert.rejects(fetchJson('https://example.test', undefined, 1000), /429/); await assert.rejects(fetchJson('https://example.test', undefined, 1000), /429/); assert.equal(calls, 2); }
    finally { globalThis.fetch = original; }
});

test('last-day visibility uses elapsed supported hours, not point counts, and leaves the snapshot intact', async () => {
    const { visibleForecast } = await import('../meteoam-data.js');
    const day = (date, offsets) => {
        const hours = offsets.map(hour => ({ date, time: Date.parse(`${date}T00:00:00Z`) + hour * 3600000, temp: 0, probability: 0, windSpeed: 0, windDir: null, humidity: 0, pressure: 1000, icon: '01' }));
        return { date, hours, min: 0, max: 0, sampledExtremes: false, icon: '01' };
    };
    const first = day('2026-10-12', [0, 1]), last = day('2026-10-13', Array.from({ length: 12 }, (_, i) => i));
    const s = { days: [first, last], hours: [...first.hours, ...last.hours] }, copy = structuredClone(s);
    const view = visibleForecast(s);
    assert.equal(view.days.length, 1); assert.equal(view.hours.length, 2);
    assert.equal(view.excluded.coverageHours, 11); assert.deepEqual(s, copy);
    for (const offsets of [Array.from({ length: 13 }, (_, i) => i), [0, 3, 6, 9, 12], [0, 1, 2, 5, 8, 11, 12]]) {
        const d = day('2026-10-13', offsets);
        assert.equal(visibleForecast({ days: [d], hours: d.hours }).days.length, 1);
    }
    const hole = day('2026-10-13', [0, 1, 12, 13]);
    assert.equal(visibleForecast({ days: [hole], hours: hole.hours }).days.length, 0);
    const longerHole = day('2026-10-13', Array.from({ length: 19 }, (_, i) => i).filter(i => i !== 9));
    assert.equal(visibleForecast({ days: [longerHole], hours: longerHole.hours }).excluded.reason, 'missing-data');
});
test('missing atmospheric data/stats exclude only the final date, independently of optional services', async () => {
    const { visibleForecast } = await import('../meteoam-data.js');
    const hours = Array.from({ length: 13 }, (_, i) => ({ date: '2026-10-13', time: Date.parse('2026-10-13T00:00:00Z') + i * 3600000, temp: 0, probability: 0, windSpeed: 0, windDir: null, humidity: 0, pressure: 1000, icon: '01' }));
    const day = { date: '2026-10-13', hours, min: 0, max: 0, sampledExtremes: false, icon: '01' };
    const s = { days: [day], hours, marineStatus: 'non disponibili', astronomyStatus: 'non disponibili' };
    assert.equal(visibleForecast(s).excluded, null);
    for (const field of ['temp', 'probability', 'windSpeed', 'humidity', 'pressure', 'icon']) {
        const damaged = structuredClone(s); damaged.days[0].hours[1][field] = null;
        assert.equal(visibleForecast(damaged).excluded.reason, 'missing-data');
    }
    for (const patch of [{ sampledExtremes: true }, { icon: '-' }, { min: null }, { max: null }]) {
        const damaged = structuredClone(s); Object.assign(damaged.days[0], patch);
        assert.equal(visibleForecast(damaged).excluded.reason, 'missing-data');
    }
    const windy = structuredClone(s); windy.days[0].hours[0].windSpeed = 10;
    assert.equal(visibleForecast(windy).excluded.reason, 'missing-data');
    assert.equal(visibleForecast({ days: [], hours: [] }).days.length, 0);
});
test('twelve real UTC hours survive DST repeated/skipped wall-clock hours', async () => {
    const { visibleForecast } = await import('../meteoam-data.js');
    for (const start of ['2026-10-24T22:00:00Z', '2026-03-28T23:00:00Z']) {
        const hours = Array.from({ length: 13 }, (_, i) => ({ time: Date.parse(start) + i * 3600000, temp: 10, probability: 0, windSpeed: 0, windDir: null, humidity: 50, pressure: 1000, icon: '01' }));
        hours.forEach(h => h.date = dateKey(h.time, 'Europe/Rome'));
        const day = { date: hours[0].date, hours, min: 10, max: 10, sampledExtremes: false, icon: '01' };
        assert.equal(visibleForecast({ days: [day], hours }).excluded, null);
    }
});
