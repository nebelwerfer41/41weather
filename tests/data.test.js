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
