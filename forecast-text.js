import { dateKey, timezone, iconSemantics } from './meteoam-data.js';

// Editorial conventions, not MeteoAM thresholds or meteorological confidence.
export const DEFAULT_RULES = Object.freeze({
    possible: 30, probable: 60, maxStepHours: 3, sustainedSamples: 2,
    skyChange: 1, calmKmh: 2, usefulWindKmh: 10, directionConcentration: 0.65,
    bands: Object.freeze([{ start: 0, end: 6, name: 'notte' }, { start: 6, end: 12, name: 'mattino' },
        { start: 12, end: 18, name: 'pomeriggio' }, { start: 18, end: 24, name: 'sera' }].map(Object.freeze))
});
const finite = n => typeof n === 'number' && Number.isFinite(n);
const validProbability = n => finite(n) && n >= 0 && n <= 100;
const HOUR = 3600000;
const skyLabels = ['sereno', 'poco nuvoloso', 'molto nuvoloso', 'coperto'];
const round = n => n.toLocaleString('it-IT', { maximumFractionDigits: 0 });
const probabilityNumber = n => n.toLocaleString('it-IT', { maximumSignificantDigits: 3 });
function editorialRules(custom = {}) {
    const rules = { ...DEFAULT_RULES, ...custom };
    for (const key of Object.keys(DEFAULT_RULES).filter(k => k !== 'bands')) {
        if (!finite(rules[key]) || rules[key] < 0) throw new TypeError(`Regola non valida: ${key}`);
    }
    if (rules.possible >= rules.probable || rules.probable > 100 || rules.maxStepHours <= 0 || rules.sustainedSamples < 2 || rules.directionConcentration > 1)
        throw new TypeError('Soglie editoriali non valide');
    if (!Array.isArray(rules.bands) || !rules.bands.length || rules.bands[0].start !== 0 || rules.bands.at(-1).end !== 24 ||
        rules.bands.some((b, i) => !finite(b.start) || !finite(b.end) || b.end <= b.start || !b.name || (i && b.start !== rules.bands[i - 1].end)))
        throw new TypeError('Le fasce devono coprire 00–24 senza sovrapposizioni');
    return rules;
}
function localParts(time, tz) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset' }).formatToParts(time);
    const part = key => parts.find(p => p.type === key)?.value;
    return { hour: Number(part('hour')), minute: Number(part('minute')), offset: part('timeZoneName') };
}
// Locate local midnight by date, including 23/25-hour days and fractional zones.
function dayBounds(date, tz) {
    const utc = Date.parse(`${date}T00:00:00Z`);
    const boundary = key => {
        let lo = utc - 36 * HOUR, hi = utc + 60 * HOUR;
        while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (dateKey(mid, tz) < key) lo = mid; else hi = mid; }
        return hi;
    };
    const next = new Date(utc + 24 * HOUR).toISOString().slice(0, 10);
    return [boundary(date), boundary(next)];
}

export function analyzeForecast(snapshot = {}, { rules: custom } = {}) {
    const rules = editorialRules(custom);
    const tz = timezone(snapshot.location?.tz);
    const samples = (snapshot.hours ?? []).filter(h => finite(h.time)).map(h => {
        const local = localParts(h.time, tz);
        return { ...h, date: dateKey(h.time, tz), local, semantic: iconSemantics(h.icon),
            band: rules.bands.find(b => local.hour >= b.start && local.hour < b.end).name };
    }).sort((a, b) => a.time - b.time).filter((h, i, all) => !i || h.time !== all[i - 1].time);
    // Only documented 1 h / 3 h resolutions connect editorial evidence. A 2 h
    // jump is an unexplained hole, not a valid pause or a sustained transition.
    const connected = (a, b) => b.time > a.time && [1, rules.maxStepHours].includes((b.time - a.time) / HOUR);
    // Build runs before slicing by date. Missing/unknown icons break semantic runs.
    function runs(key) {
        const result = [];
        for (const [index, h] of samples.entries()) {
            const kind = key(h);
            if (kind == null) continue;
            const last = result.at(-1);
            const previous = samples[index - 1];
            if (last?.kind === kind && last.samples.at(-1) === previous && connected(previous, h)) last.samples.push(h);
            else result.push({ kind, samples: [h] });
        }
        return result;
    }
    const skyRuns = runs(h => h.semantic?.sky);
    const phenomenonRuns = runs(h => h.semantic?.phenomenon);
    const transitions = [];
    for (let i = 1; i < skyRuns.length; i++) {
        const before = skyRuns[i - 1], after = skyRuns[i];
        if (before.samples.length >= rules.sustainedSamples && after.samples.length >= rules.sustainedSamples &&
            samples.indexOf(after.samples[0]) === samples.indexOf(before.samples.at(-1)) + 1 &&
            connected(before.samples.at(-1), after.samples[0]) && Math.abs(after.kind - before.kind) >= rules.skyChange) {
            transitions.push({ before, after, kind: after.kind > before.kind ? 'nubi in aumento' : 'schiarite' });
        }
    }
    const summaries = new Map();
    const stats = new Map((snapshot.days ?? []).map(d => [d.date, d]));
    const dates = [...new Set([...samples.map(h => h.date), ...stats.keys()])].sort();
    for (const date of dates) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const hours = samples.filter(h => h.date === date), day = stats.get(date);
        const facts = [];
        function fact(category, source, reason, detail = {}) {
            const sequence = source.length ? samples.filter(h => h.time >= source[0].time && h.time <= source.at(-1).time) : [];
            const steps = sequence.slice(1).map((h, i) => (h.time - sequence[i].time) / HOUR);
            const supportedStep = step => [1, rules.maxStepHours].includes(step);
            const item = { category, samples: source.map(({ semantic, ...h }) => ({ ...h, local: { ...h.local } })),
                start: source[0]?.time ?? null, end: source.at(-1)?.time ?? null,
                precision: { kind: 'sampled', stepHours: [...new Set(steps.filter(supportedStep))], gapHours: [...new Set(steps.filter(step => !supportedStep(step)))], extendsLastSample: false },
                reason, ...detail };
            facts.push(item); return item;
        }
        const [start, end] = dayBounds(date, tz);
        const gaps = hours.slice(1).filter((h, i) => !connected(hours[i], h)).map(h => h.time);
        const previous = samples[samples.indexOf(hours[0]) - 1];
        const partial = !hours.length || hours[0].time > start && (!previous || !connected(previous, hours[0])) || end - hours.at(-1).time > rules.maxStepHours * HOUR;
        fact('coverage', hours, 'Limiti degli istanti disponibili, senza prolungare l’ultimo campione',
            { partial, gaps, dayHours: (end - start) / HOUR, unknownIcons: hours.filter(h => !h.semantic).length });
        const sky = hours.filter(h => h.semantic?.sky != null);
        if (sky.length) {
            const counts = new Map();
            for (const h of sky) counts.set(h.semantic.sky, (counts.get(h.semantic.sky) ?? 0) + 1);
            const dominant = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
            fact('sky', sky.filter(h => h.semantic.sky === dominant), 'Condizione più rappresentata tra le icone di cielo; punti non pesati come ore',
                { counts: Object.fromEntries(counts), label: skyLabels[dominant], stable: counts.size === 1, mixed: counts.size > 1 });
        }
        for (const change of transitions) {
            // Include boundary changes only on the dates with samples after the change.
            const evidence = [...change.before.samples.slice(-rules.sustainedSamples), ...change.after.samples.slice(0, rules.sustainedSamples)];
            const local = change.after.samples.slice(0, rules.sustainedSamples).filter(h => h.date === date);
            if (local.length) fact('evolution', evidence,
                `Almeno ${rules.sustainedSamples} campioni validi consecutivi per ciascuna condizione, salto cielo ≥${rules.skyChange}, distanza ≤${rules.maxStepHours} h`,
                { label: change.kind, strength: Math.abs(change.after.kind - change.before.kind), localSamples: local.map(h => h.time), bands: [...new Set(local.map(h => h.band))] });
        }
        for (const obscuration of [...new Set(hours.map(h => h.semantic?.obscuration).filter(o => o?.startsWith('velature')))]) {
            fact('veils', hours.filter(h => h.semantic?.obscuration === obscuration), 'Velature separate da nuvolosità e visibilità', { label: obscuration });
        }
        const phenomena = [...new Set(hours.map(h => h.semantic?.phenomenon).filter(Boolean))];
        for (const label of phenomena) {
            const source = hours.filter(h => h.semantic?.phenomenon === label);
            const episodes = phenomenonRuns.filter(r => r.kind === label && r.samples.some(h => h.date === date));
            // A pause needs known non-phenomenon samples and no time gaps anywhere between occurrences.
            const between = samples.filter(h => h.time >= source[0].time && h.time <= source.at(-1).time);
            const intermittent = between.some(h => h.semantic && !h.semantic.phenomenon) &&
                between.every((h, i) => h.semantic && (!i || connected(between[i - 1], h)));
            fact('phenomenon', source, 'Fenomeno indicato dal catalogo del modello, conservato anche con probabilità bassa o assente',
                { label, intermittent, single: source.length === 1, bands: [...new Set(source.map(h => h.band))],
                    episodes: episodes.map(r => ({ start: r.samples[0].time, end: r.samples.at(-1).time, samples: r.samples.map(h => h.time) })),
                    probability: source.filter(h => validProbability(h.probability)).map(h => h.probability) });
        }
        for (const band of rules.bands) {
            const source = hours.filter(h => h.band === band.name && validProbability(h.probability));
            if (source.length) fact('probability', source, 'Intervallo e massimo dei campioni della fascia; nessuna probabilità giornaliera',
                { band: band.name, min: Math.min(...source.map(h => h.probability)), max: Math.max(...source.map(h => h.probability)),
                    level: Math.max(...source.map(h => h.probability)) >= rules.probable ? 'probable' : Math.max(...source.map(h => h.probability)) >= rules.possible ? 'possible' : 'low' });
        }
        const wind = hours.filter(h => finite(h.windSpeed) && h.windSpeed >= 0);
        if (wind.length) {
            const directed = wind.filter(h => h.windSpeed > rules.calmKmh && finite(h.windDir) && h.windDir >= 0 && h.windDir <= 360);
            const x = directed.reduce((sum, h) => sum + Math.cos(h.windDir * Math.PI / 180), 0);
            const y = directed.reduce((sum, h) => sum + Math.sin(h.windDir * Math.PI / 180), 0);
            const concentration = directed.length ? Math.hypot(x, y) / directed.length : null;
            const angle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
            const max = Math.max(...wind.map(h => h.windSpeed));
            fact('wind', wind, 'Velocità campionate; media circolare delle sole direzioni non calme disponibili',
                { min: Math.min(...wind.map(h => h.windSpeed)), max, calm: max <= rules.calmKmh, useful: max >= rules.usefulWindKmh,
                    direction: concentration === null ? null : concentration < rules.directionConcentration ? 'variabile' : ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(angle / 45) % 8],
                    concentration, directionSamples: directed.map(h => h.time), directionPartial: directed.length < wind.filter(h => h.windSpeed > rules.calmKmh).length });
        }
        if (finite(day?.min) || finite(day?.max)) fact('temperature', hours.filter(h => finite(h.temp)),
            day.sampledExtremes ? 'Estremi con fallback ai campioni, conservativi per l’intera coppia' : 'Estremi giornalieri dalle stats del provider',
            { min: finite(day.min) ? day.min : null, max: finite(day.max) ? day.max : null, sampledExtremes: !!day.sampledExtremes,
                stats: { date, min: day.min, max: day.max }, precision: { kind: day.sampledExtremes ? 'sampled' : 'provider-daily' } });
        for (const label of ['nubi in aumento', 'schiarite']) {
            const candidates = facts.filter(f => f.category === 'evolution' && f.label === label).sort((a, b) => b.strength - a.strength || a.start - b.start);
            candidates.forEach((f, i) => { f.selected = i === 0; f.reason += i === 0 ? '; selezionata l’evoluzione più ampia, prima in ordine temporale a parità' : '; evoluzione secondaria conservata nella diagnostica'; });
        }
        summaries.set(date, { date, tz, facts, rules: { ...rules, bands: rules.bands.map(b => ({ ...b })) },
            diagnostics: { sampleCount: hours.length, unknownIcons: hours.filter(h => !h.semantic).map(h => h.time), gaps,
                notes: ['Probabilità e copertura sono distinte', 'Gli intervalli indicano campioni, non durata del fenomeno'] } });
    }
    return summaries;
}

const sentence = s => s ? `${s[0].toUpperCase()}${s.slice(1)}.` : '';
const bandText = bands => bands.map(b => ({ notte: 'nella notte', mattino: 'al mattino', pomeriggio: 'nel pomeriggio', sera: 'in serata' })[b] ?? `nella fascia ${b}`).join(' e ');
function windowText(fact, tz) {
    const clock = time => {
        const p = localParts(time, tz);
        return `${String(p.hour).padStart(2, '0')}${p.minute ? `:${String(p.minute).padStart(2, '0')}` : ''}`;
    };
    if (fact.start === fact.end) return `alle ${clock(fact.start)}`;
    const a = localParts(fact.start, tz), b = localParts(fact.end, tz);
    const offset = a.offset !== b.offset;
    return `tra le ${clock(fact.start)}${offset ? ` ${a.offset}` : ''} e le ${clock(fact.end)}${offset ? ` ${b.offset}` : ''}`;
}
export function renderForecast(daySummary, { verbosity = 'standard', includeTemperature = false } = {}) {
    if (!daySummary?.facts) return 'Dati atmosferici non disponibili.';
    const level = ['title', 'brief', 'standard', 'detailed'].includes(verbosity) ? verbosity : 'standard';
    const { facts, tz, rules } = daySummary;
    const find = category => facts.filter(f => f.category === category);
    const coverage = find('coverage')[0];
    if (!coverage?.samples.length) return 'Dati atmosferici non disponibili.';
    const phenomena = find('phenomenon'), probability = find('probability');
    const mainProbability = probability.filter(f => f.level !== 'low');
    // Select the largest supported change in each direction, in temporal order.
    const changes = find('evolution').filter(f => f.selected).sort((a, b) => a.start - b.start);
    const evolution = changes.map(f => f.label);
    const sky = find('sky')[0];
    const veils = find('veils');
    const veilText = veils.some(f => f.label === 'velature') ? 'velature' : veils.length ? 'velature parziali' : '';
    const sentences = [];
    const phenomenonGroups = new Map();
    for (const f of phenomena) {
        const placement = level === 'standard' ? bandText(f.bands) : level === 'detailed' ? windowText(f, tz) : '';
        const lowProbability = f.probability.length > 0 && f.probability.every(p => p < rules.possible) &&
            !['foschia', 'nebbia', 'fumo', 'tempesta di sabbia'].includes(f.label);
        const key = JSON.stringify([placement, f.intermittent, lowProbability]);
        if (!phenomenonGroups.has(key)) phenomenonGroups.set(key, { labels: [], placement, intermittent: f.intermittent, lowProbability });
        phenomenonGroups.get(key).labels.push(f.label);
    }
    const phenomenonSentences = [...phenomenonGroups.values()].map(group => {
        const labels = group.labels.length > 1 ? `${group.labels.slice(0, -1).join(', ')} e ${group.labels.at(-1)}` : group.labels[0];
        let text = `${labels}${group.intermittent ? ' a tratti' : ''}${group.placement ? ` ${group.placement}` : ''}`;
        if (group.lowProbability) text += '; probabilità di precipitazione bassa';
        return sentence(text);
    });
    if (level === 'title') {
        if (phenomena.length) sentences.push(phenomenonSentences.join(' '));
        else if (mainProbability.length) sentences.push(sentence(`${mainProbability.some(f => f.level === 'probable') ? 'precipitazioni probabili' : 'possibili precipitazioni'} ${bandText(mainProbability.map(f => f.band))}`));
        else if (evolution.length) sentences.push(sentence(evolution.join(', ')));
        else if (sky) sentences.push(sentence(sky.mixed ? 'cielo variabile' : sky.label));
        else if (veilText) sentences.push(sentence(veilText));
    } else {
        const skyText = [sky ? sky.mixed ? 'cielo variabile' : sky.label : '', veilText].filter(Boolean);
        for (const f of changes) skyText.push(`${f.label}${level === 'standard' || level === 'detailed' ? ` ${bandText(f.bands)}` : ''}`);
        if (skyText.length) sentences.push(sentence([...new Set(skyText)].join(', ')));
        sentences.push(...phenomenonSentences);
        if (level === 'detailed') {
            for (const f of probability.filter(f => f.max > 0)) {
                const positives = f.samples.map(h => h.probability).filter(p => validProbability(p) && p > 0);
                const min = Math.min(...positives);
                sentences.push(sentence(`probabilità${f.min === 0 ? ' positiva' : ''} ${probabilityNumber(min)}${min !== f.max ? `–${probabilityNumber(f.max)}` : ''}% ${bandText([f.band])}`));
            }
        } else {
            for (const probabilityLevel of ['possible', 'probable']) {
                const selected = mainProbability.filter(f => f.level === probabilityLevel);
                if (selected.length) sentences.push(sentence(`${probabilityLevel === 'probable' ? 'precipitazioni probabili' : 'possibili precipitazioni'} ${bandText(selected.map(f => f.band))}`));
            }
        }
        const wind = find('wind')[0];
        if (wind && (level === 'detailed' || level === 'standard' && wind.useful)) {
            const speed = `${round(wind.min)}${wind.min !== wind.max ? `–${round(wind.max)}` : ''} km/h`;
            const dir = wind.direction === 'variabile' ? ' a direzione variabile' : wind.direction ? ` da ${wind.direction}` : '';
            sentences.push(sentence(wind.calm ? `vento calmo, ${speed}` : `vento${dir}${dir ? ',' : ''} ${speed}${wind.direction === null ? '; direzione non disponibile' : ''}`));
        }
    }
    if (!sentences.length) sentences.push('Condizione del cielo non disponibile.');
    if (level === 'detailed' && coverage.unknownIcons) sentences.push('Alcune condizioni del cielo non sono interpretabili.');
    const temperature = find('temperature')[0];
    if (includeTemperature && temperature) sentences.push(sentence(`temperatura: minima ${temperature.min === null ? 'non disponibile' : `${round(temperature.min)} °C`}, massima ${temperature.max === null ? 'non disponibile' : `${round(temperature.max)} °C`}${temperature.sampledExtremes ? ' (estremi parziali)' : ''}`));
    return sentences.join(' ');
}
