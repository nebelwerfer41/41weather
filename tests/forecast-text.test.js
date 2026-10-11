import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeForecast, renderForecast } from '../forecast-text.js';
import { dateKey, normalizeForecast, iconSemantics, icon } from '../meteoam-data.js';
const base = Date.parse('2026-10-12T00:00:00Z');
function snapshot(rows, tz = 'UTC', start = base) {
    const hours = rows.map((r, i) => ({ time: start + (r.hour ?? i) * 3600000, temp: null, probability: null, windSpeed: null, windDir: null, icon: null, ...r })).map(h => ({ ...h, date: dateKey(h.time, tz) }));
    const dates = [...new Set(hours.map(h => h.date))];
    return { location: { name: 'Fixture', tz }, hours, days: dates.map(date => ({ date, hours: hours.filter(h => h.date === date), min: null, max: null, sampledExtremes: true })), fetchedAt: base, models: {} };
}
const summary = s => analyzeForecast(s).values().next().value;
const text = (s, verbosity = 'standard', includeTemperature = false) => renderForecast(summary(s), { verbosity, includeTemperature });
const facts = (s, category) => summary(s).facts.filter(f => f.category === category);
test('empty input and missing parameters are usable without environment services', () => {
    assert.equal(analyzeForecast().size, 0);
    assert.match(renderForecast(), /non disponibili/);
    const s = snapshot([{}]);
    assert.equal(facts(s, 'wind').length, 0); assert.equal(facts(s, 'probability').length, 0);
    assert.doesNotMatch(text(s), /pioggia|0%|calmo/);
    assert.throws(() => analyzeForecast(s, { rules: { possible: 70, probable: 60 } }), /Soglie/);
});
test('shared catalog preserves icon compatibility and separates veils from fog', () => {
    assert.deepEqual(icon('02'), ['🌤️', 'Parzialmente velato']);
    assert.equal(iconSemantics('32').variant, 'night');
    assert.equal(iconSemantics('32').obscuration, iconSemantics('02').obscuration);
    assert.equal(iconSemantics('unknown'), null);
    assert.equal(iconSemantics('__proto__'), null);
    assert.deepEqual(icon('constructor'), ['❔', 'Condizione non disponibile']);
    assert.match(text(snapshot([{ icon: '03' }])), /Velature/);
    assert.doesNotMatch(text(snapshot([{ icon: '03' }])), /nebbia|foschia/);
});
test('real zeros, unknown codes and known numeric fields remain independent', () => {
    const s = snapshot([{ icon: '99', probability: 0, temp: 0, windSpeed: 0 }]);
    s.days[0].min = s.days[0].max = 0;
    assert.doesNotMatch(text(s, 'detailed', true), /probabilità.*0%/i);
    assert.match(text(s, 'detailed', true), /vento calmo/i);
    assert.match(text(s, 'detailed', true), /minima 0 °C/);
    assert.doesNotMatch(text(s), /non pioverà|pioggia/);
    assert.deepEqual(summary(s).diagnostics.unknownIcons, [base]);
});
test('probability alone does not invent precipitation type, accumulation or daily risk', () => {
    const s = snapshot([{ hour: 12, probability: 30 }, { hour: 15, probability: 40 }]);
    assert.match(text(s, 'title'), /Possibili precipitazioni nel pomeriggio/);
    assert.match(text(s, 'detailed'), /30–40%/);
    assert.doesNotMatch(text(s, 'detailed'), /pioggia|neve|rovesci|temporali|mm|rischio della giornata/);
    assert.match(text(snapshot([{ probability: 60 }]), 'brief'), /probabili/);
    assert.doesNotMatch(text(snapshot([{ probability: 20 }]), 'brief'), /precipitazioni/);
    assert.match(text(snapshot([{ probability: 20 }]), 'detailed'), /20%/);
});
test('all significant phenomena survive every level, including low or absent probability', () => {
    for (const [code, label] of [['10', 'temporale'], ['12', 'pioggia congelantesi'], ['14', 'nebbia'], ['15', 'grandine'], ['16', 'neve'], ['17', 'tromba d’aria'], ['19', 'tempesta di sabbia']]) {
        const s = snapshot([{ icon: code, probability: 0 }]);
        for (const verbosity of ['title', 'brief', 'standard', 'detailed']) assert.match(text(s, verbosity), new RegExp(label, 'i'));
        assert.doesNotMatch(text(s, 'detailed'), /allerta|raffiche/);
    }
    const low = snapshot([{ icon: '10', probability: 10 }]);
    assert.match(text(low), /Temporale/); assert.match(text(low), /probabilità.*bassa/);
    assert.doesNotMatch(text(snapshot([{ icon: '10' }])), /bassa/);
});
test('title retains multiple significant phenomena instead of choosing only one', () => {
    const s = snapshot([{ icon: '10' }, { icon: '15' }, { icon: '16' }]);
    for (const level of ['title', 'brief', 'standard', 'detailed']) {
        assert.match(text(s, level), /temporale/i); assert.match(text(s, level), /grandine/i); assert.match(text(s, level), /neve/i);
    }
});
test('stable skies and isolated oscillations do not invent a sustained evolution', () => {
    assert.equal(facts(snapshot([{ icon: '01' }, { icon: '31' }]), 'sky')[0].stable, true);
    for (const icons of [['01', '01', '06', '01', '01'], ['01', '06', '01', '06']]) {
        const s = snapshot(icons.map(icon => ({ icon })));
        assert.equal(facts(s, 'evolution').length, 0);
        assert.doesNotMatch(text(s), /in aumento|schiarite|attenuazione/);
    }
});
test('sustained sky changes require two points on both sides and retain evidence', () => {
    const s = snapshot([{ hour: 9, icon: '04' }, { hour: 10, icon: '04' }, { hour: 13, icon: '05' }, { hour: 16, icon: '05' }]);
    const f = facts(s, 'evolution')[0];
    assert.equal(f.label, 'nubi in aumento'); assert.equal(f.samples.length, 4);
    assert.match(text(s), /nubi in aumento nel pomeriggio/);
    assert.deepEqual(f.precision.stepHours, [1, 3]); assert.equal(f.precision.extendsLastSample, false);
});
test('unknown icons and large holes break evolution and are not observed pauses', () => {
    const s = snapshot([{ icon: '01' }, { icon: '01' }, { icon: '99' }, { icon: '06' }, { icon: '06' }]);
    assert.equal(facts(s, 'evolution').length, 0);
    const twoHourHole = snapshot([{ hour: 0, icon: '01' }, { hour: 1, icon: '01' }, { hour: 3, icon: '06' }, { hour: 4, icon: '06' }]);
    assert.equal(facts(twoHourHole, 'evolution').length, 0);
    const gap = snapshot([{ hour: 0, icon: '10' }, { hour: 6, icon: '01' }, { hour: 7, icon: '10' }]);
    assert.equal(facts(gap, 'phenomenon')[0].intermittent, false);
    assert.ok(facts(gap, 'coverage')[0].gaps.length);
    assert.doesNotMatch(text(gap, 'detailed'), /campion/i);
    assert.doesNotMatch(text(gap), /a tratti|cessazione|fino a mezzanotte/);
});
test('a tratti requires valid observed pause; ending the series does not imply cessation', () => {
    const intermittent = snapshot([{ icon: '10' }, { icon: '01' }, { icon: '10' }]);
    assert.match(text(intermittent), /a tratti/);
    assert.deepEqual(facts(intermittent, 'phenomenon')[0].precision.stepHours, [1]);
    assert.doesNotMatch(text(snapshot([{ icon: '10' }, {} , { icon: '10' }])), /a tratti/);
    assert.doesNotMatch(text(snapshot([{ icon: '10' }, { icon: '10' }])), /cessa|attenuazione|a tratti/);
});
test('events and sustained changes are recognized across local midnight before clipping', () => {
    const s = snapshot([{ hour: 22, icon: '01' }, { hour: 23, icon: '01' }, { hour: 24, icon: '06' }, { hour: 25, icon: '06' }]);
    const days = analyzeForecast(s); const next = days.get('2026-10-13');
    assert.match(renderForecast(next), /Nubi in aumento|nubi in aumento/);
    assert.equal(next.facts.find(f => f.category === 'evolution').samples[0].date, '2026-10-12');
    const event = analyzeForecast(snapshot([{ hour: 23, icon: '16' }, { hour: 24, icon: '16' }, { hour: 25, icon: '16' }]));
    const a = event.get('2026-10-12').facts.find(f => f.category === 'phenomenon');
    const b = event.get('2026-10-13').facts.find(f => f.category === 'phenomenon');
    assert.deepEqual(a.episodes, b.episodes);
    assert.ok(b.samples.every(h => h.date === '2026-10-13'));
});
test('truncated last day reports only available period and sampled temperature fallback', () => {
    const s = snapshot([{ hour: 6, temp: 4, icon: '01' }, { hour: 9, temp: 8, icon: '01' }]);
    s.days[0].min = 4; s.days[0].max = 8;
    assert.equal(facts(s, 'coverage')[0].partial, true);
    assert.doesNotMatch(text(s), /periodo disponibile|campion/i);
    assert.match(text(s, 'title', true), /estremi parziali/);
    assert.doesNotMatch(text(s, 'detailed', true), /tra i campioni disponibili/);
    assert.doesNotMatch(text(s), /°C|oggi|domani/);
    s.days[0].sampledExtremes = false; s.days[0].max = 12;
    assert.match(text(s, 'detailed', true), /massima 12 °C/);
});
test('DST day lengths are 23 and 25 hours and duplicate hours expose UTC offsets', () => {
    for (const [start, count] of [['2026-03-28T23:00:00Z', 23], ['2026-10-24T22:00:00Z', 25]]) {
        const s = snapshot(Array.from({ length: count }, (_, hour) => ({ hour, icon: '01' })), 'Europe/Rome', Date.parse(start));
        const days = analyzeForecast(s); assert.equal(days.size, 1);
        const coverage = summary(s).facts.find(f => f.category === 'coverage');
        assert.equal(coverage.dayHours, count); assert.equal(coverage.partial, false);
    }
    const s = snapshot([{ icon: '10' }, { icon: '10' }], 'Europe/Rome', Date.parse('2026-10-25T00:00:00Z'));
    assert.match(text(s, 'detailed'), /02 GMT\+2.*02 GMT\+1/);
});
test('fractional timezone determines dates and bands independently of device timezone', () => {
    const s = snapshot([{ icon: '10' }], 'Asia/Kathmandu', Date.parse('2026-10-11T20:00:00Z'));
    const day = summary(s); assert.equal(day.date, '2026-10-12');
    assert.match(renderForecast(day), /nella notte/);
    assert.match(renderForecast(day, { verbosity: 'detailed' }), /01:45/);
});
test('circular directions, calm, dispersion, absent and partial direction are distinct', () => {
    const north = snapshot([{ windSpeed: 15, windDir: 350 }, { windSpeed: 25, windDir: 10 }]);
    assert.equal(facts(north, 'wind')[0].direction, 'N'); assert.match(text(north), /da N,/);
    const dispersed = snapshot([{ windSpeed: 12, windDir: 90 }, { windSpeed: 12, windDir: 270 }]);
    assert.match(text(dispersed), /direzione variabile/);
    assert.match(text(snapshot([{ windSpeed: 12 }]), 'detailed'), /direzione non disponibile/);
    assert.match(text(snapshot([{ windSpeed: 0, windDir: 180 }]), 'detailed'), /calmo/);
    assert.equal(facts(snapshot([{ windSpeed: 0, windDir: 180 }]), 'wind')[0].direction, null);
    assert.equal(facts(snapshot([{ windSpeed: 12, windDir: 10 }, { windSpeed: 12 }]), 'wind')[0].directionPartial, true);
});
test('determinism, purity and optional providers cannot change atmospheric evidence', () => {
    const s = snapshot([{ icon: '01', probability: 30 }, { icon: '16', probability: 60 }]);
    const before = structuredClone(s); const first = analyzeForecast(s);
    assert.deepEqual(s, before); assert.deepEqual(analyzeForecast(s), first);
    s.astronomy = new Map(); s.marine = new Map([[base, { height: 2 }]]);
    assert.deepEqual(analyzeForecast(s), first);
    const day = first.values().next().value; const copy = structuredClone(day);
    for (const verbosity of ['title', 'brief', 'standard', 'detailed']) {
        assert.equal(renderForecast(day, { verbosity }), renderForecast(day, { verbosity }));
        assert.match(renderForecast(day, { verbosity }), /neve/i);
    }
    assert.deepEqual(day, copy);
    for (const f of day.facts) { assert.ok(f.category && f.reason && f.precision); assert.ok(f.samples.every(h => before.hours.some(s => s.time === h.time))); }
});
test('custom thresholds and bands are editorial configuration', () => {
    const s = snapshot([{ hour: 12, probability: 40 }]);
    const day = analyzeForecast(s, { rules: { possible: 50, probable: 70, bands: [{ start: 0, end: 24, name: 'giorno' }] } }).values().next().value;
    assert.doesNotMatch(renderForecast(day), /possibili precipitazioni/i);
    assert.match(renderForecast(day, { verbosity: 'detailed' }), /fascia giorno/);
});
test('real MeteoAM sample with positive probabilities uses the same normalized model', () => {
    const fixture = JSON.parse(readFileSync(new URL('./fixtures/napoli-real.json', import.meta.url)));
    const s = normalizeForecast(fixture.data, { name: 'Napoli', lat: 40.8518, lon: 14.2681 }, base);
    assert.ok(s.hours.some(h => h.probability > 0));
    const day = summary(s);
    assert.ok(day.facts.some(f => f.category === 'probability' && f.max >= 30));
    assert.match(renderForecast(day), /pioggia/i);
    assert.match(renderForecast(day, { verbosity: 'detailed' }), /30%/);
});

test('zero probabilities are omitted only from prose; mixed ranges describe positive samples', () => {
    const s = snapshot([{ hour: 12, probability: 0 }, { hour: 13, probability: 30 }]);
    const rendered = text(s, 'detailed');
    assert.match(rendered, /probabilità positiva 30%/i);
    assert.doesNotMatch(rendered, /0–30|probabilità 0%|campionato 0%/i);
    assert.equal(s.hours[0].probability, 0);
    for (const level of ['title', 'brief', 'standard', 'detailed']) assert.doesNotMatch(text(snapshot([{ probability: 0, icon: '01' }]), level), /probabilità/i);
});

test('veils are deduplicated and no level mentions samples or coverage boilerplate', () => {
    const s = snapshot([{ icon: '01', probability: 30, windSpeed: 2 }, { icon: '03', probability: 40, windSpeed: 9 }, { icon: '02', probability: 0 }, { icon: '05' }]);
    for (const level of ['title', 'brief', 'standard', 'detailed']) {
        const rendered = text(s, level, true);
        assert.doesNotMatch(rendered, /campion|periodo disponibile/i);
        assert.ok((rendered.match(/velature/gi) || []).length <= 1);
    }
    assert.match(text(snapshot([{ icon: '02' }]), 'brief'), /Velature parziali/);
    assert.match(text(snapshot([{ icon: '03' }, { icon: '02' }]), 'brief'), /^Velature\./);
});

test('positive fractional probability is not rounded to zero; temperature matches UI rounding', () => {
    const s = snapshot([{ probability: 0.4 }]);
    s.days[0].min = -0.5; s.days[0].max = 0.5;
    assert.match(text(s, 'detailed', true), /Probabilità 0,4%/);
    assert.match(text(s, 'detailed', true), /minima -1 °C, massima 1 °C/);
});

test('phenomena use direct names and group only compatible time and probability facts', () => {
    const together = snapshot([{ hour: 6, icon: '08' }, { hour: 7, icon: '13' }]);
    assert.equal(text(together, 'title'), 'Pioggia e foschia.');
    assert.equal(text(together, 'brief'), 'Pioggia e foschia.');
    assert.equal(text(together, 'standard'), 'Pioggia e foschia al mattino.');
    assert.equal(text(together, 'detailed'), 'Pioggia alle 06. Foschia alle 07.');
    const separate = snapshot([{ hour: 6, icon: '08', probability: 10 }, { hour: 15, icon: '13' }]);
    assert.match(text(separate), /Pioggia al mattino; probabilità di precipitazione bassa\. Foschia nel pomeriggio\./);
    for (const level of ['title', 'brief', 'standard', 'detailed']) {
        assert.doesNotMatch(text(together, level), /indicazione di|segnale di/i);
        assert.doesNotMatch(text(snapshot([{ icon: '13' }]), level), /indicazione di|segnale di/i);
    }
});
