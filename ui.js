import { icon } from './meteoam-data.js';
import { renderForecast } from './forecast-text.js';
const $ = id => document.getElementById(id);
const value = (n, unit = '', digits = 0) => n == null ? '—' : `${n.toLocaleString('it-IT', { maximumFractionDigits: digits })}${unit}`;
const clock = (time, tz) => time != null && Number.isFinite(new Date(time).getTime()) ? new Date(time).toLocaleTimeString('it-IT', { timeZone: tz, hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' }) : '—';
const timestamp = (time, tz) => new Date(time).toLocaleString('it-IT', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' });
const dateLabel = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('it-IT', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const direction = n => n == null ? '—' : `${['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(n / 45) % 8]} ${value(n, '°')}`;
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}
function setText(node, text) { if (node.textContent !== text) node.textContent = text; }
function condition(code) {
    const [emoji, label] = icon(code);
    return el('span', 'condition', `${emoji} ${label}`);
}
const levels = { title: 'Titolo', brief: 'Breve', standard: 'Standard', detailed: 'Dettagliato' };
const preferenceKey = '41weather.detail';
let verbosity = 'standard';
try { const saved = localStorage.getItem(preferenceKey); if (Object.hasOwn(levels, saved)) verbosity = saved; } catch { /* Storage is optional. */ }
$('verbosity').value = verbosity;
let chart, activeSnapshot, lastHours;
const cards = new Map();
export function status(message, error = false) {
    setText($('status'), message);
    $('status').classList.toggle('error', error);
}
function updateText(card) {
    setText(card.forecast, renderForecast(activeSnapshot.forecast?.get(card.date), { verbosity }));
}
$('verbosity').addEventListener('change', event => {
    verbosity = Object.hasOwn(levels, event.target.value) ? event.target.value : 'standard';
    try { localStorage.setItem(preferenceKey, verbosity); } catch { /* Keep the in-memory preference. */ }
    for (const card of cards.values()) updateText(card);
});
function createCard(date) {
    const root = el('article', 'day-card'); root.dataset.date = date;
    const header = el('div', 'day-header');
    const title = el('h3', 'day-title', dateLabel(date));
    const weather = el('div', 'day-condition');
    const temperature = el('div', 'temperatures');
    header.append(title, weather, temperature);
    const extremes = el('p', 'hint extremes');
    const forecast = el('p', 'forecast');
    const coverageNote = el('p', 'hint coverage-note');
    const secondary = el('div', 'day-secondary');
    const astroSummary = el('p', 'astro-summary hint');
    const copy = el('button', 'btn ghost copy', 'Copia previsione'); copy.type = 'button';
    copy.setAttribute('aria-label', `Copia previsione del ${dateLabel(date)}`);
    secondary.append(astroSummary, copy);
    const copyStatus = el('p', 'hint copy-status'); copyStatus.setAttribute('role', 'status');
    const fallbackLabel = el('label', 'hint', 'Seleziona e copia il testo:');
    const fallback = el('textarea', 'copy-fallback'); fallback.readOnly = true;
    fallback.id = `copy-${date}`; fallbackLabel.htmlFor = fallback.id;
    fallback.hidden = fallbackLabel.hidden = true;
    const details = el('details', 'hourly'); details.dataset.date = date;
    const summary = el('summary', '', 'Dettagli orari');
    const content = el('div', 'day-details');
    const astro = el('section', 'astronomy');
    astro.setAttribute('aria-label', `Astronomia del ${dateLabel(date)}`);
    const note = el('p', 'hint', 'Probabilità di precipitazione: intervallo statistico non documentato. — indica un dato assente. Gli orari includono l’offset UTC, anche al cambio di ora.');
    const wrapper = el('div', 'table'); wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region'); wrapper.setAttribute('aria-label', `Tabella oraria del ${dateLabel(date)}`);
    const table = el('table');
    const caption = el('caption', 'sr-only', `Previsioni orarie del ${dateLabel(date)}`);
    const thead = el('thead'), tr = el('tr');
    const headings = ['Ora locale', 'Meteo', 'Temp °C', 'Prob. precip. %', 'Umidità %', 'Pressione hPa', 'Vento km/h', 'Direzione °', 'Onde m', 'Periodo s', 'Dir. onde °', 'Beaufort'];
    headings.forEach((label, i) => { const th = el('th', i >= 8 ? 'marine-cell' : '', label); th.scope = 'col'; tr.append(th); });
    thead.append(tr);
    const tbody = el('tbody'); table.append(caption, thead, tbody); wrapper.append(table);
    const marineState = el('p', 'hint marine-state');
    content.append(astro, note, wrapper, marineState); details.append(summary, content);
    root.append(header, extremes, coverageNote, forecast, secondary, copyStatus, fallbackLabel, fallback, details);
    const card = { date, root, weather, temperature, extremes, coverageNote, forecast, astroSummary, astro, tbody, wrapper, table, details, marineState, copy, copyStatus, fallback, fallbackLabel, rows: [] };
    card.sync = () => {
        const width = tr.firstElementChild.getBoundingClientRect().width;
        if (width > 0) wrapper.style.setProperty('--hour-col-width', `${width}px`);
    };
    details.addEventListener('toggle', card.sync);
    if (typeof ResizeObserver !== 'undefined') { card.observer = new ResizeObserver(card.sync); card.observer.observe(wrapper); card.observer.observe(tr.firstElementChild); }
    copy.addEventListener('click', async () => {
        const snapshot = activeSnapshot;
        const text = `${snapshot.location.name} · ${dateLabel(date)} · ${levels[verbosity]}\n${renderForecast(activeSnapshot.forecast?.get(date), { verbosity, includeTemperature: true })}`;
        try {
            if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
            await navigator.clipboard.writeText(text);
            if (activeSnapshot !== snapshot || !root.isConnected) return;
            setText(copyStatus, 'Previsione copiata.');
            fallback.hidden = fallbackLabel.hidden = true;
        } catch {
            if (activeSnapshot !== snapshot || !root.isConnected) return;
            setText(copyStatus, 'Copia automatica non disponibile. Il testo è pronto per la copia manuale.');
            fallback.value = text; fallback.hidden = fallbackLabel.hidden = false;
            fallback.focus(); fallback.select();
        }
    });
    return card;
}
function updateAtmosphere(card, day) {
    card.weather.replaceChildren(condition(day.icon));
    setText(card.temperature, `Min ${value(day.min, '°')} · Max ${value(day.max, '°')}`);
    setText(card.extremes, day.sampledExtremes ? 'Estremi parziali della temperatura' : 'Estremi giornalieri del provider');
    updateText(card);
    const coverage = activeSnapshot.forecast?.get(day.date)?.facts.find(f => f.category === 'coverage');
    card.coverageNote.hidden = !coverage?.partial && !coverage?.gaps.length;
    const localClock = time => time == null ? '—' : new Date(time).toLocaleTimeString('it-IT', { timeZone: activeSnapshot.location.tz, hour: '2-digit', minute: '2-digit' });
    setText(card.coverageNote, `${coverage?.partial ? 'Copertura parziale · ' : ''}${localClock(coverage?.start)}–${localClock(coverage?.end)}${coverage?.gaps.length ? ' · intervalli senza dati' : ''}`);
    const tz = activeSnapshot.location.tz;
    card.rows = day.hours.map(h => {
        const tr = el('tr');
        [clock(h.time, tz), null, value(h.temp, '', 1), value(h.probability), value(h.humidity), value(h.pressure, '', 1), value(h.windSpeed, '', 1), direction(h.windDir)].forEach((text, i) => {
            const td = el('td', i === 2 ? 'temp' : i === 3 ? 'rain' : '', text);
            if (i === 1) { const [emoji, label] = icon(h.icon); td.append(el('span', 'weather-symbol', emoji), el('span', 'sr-only', label)); }
            tr.append(td);
        });
        const marine = Array.from({ length: 4 }, () => el('td', 'marine-cell', '—'));
        tr.append(...marine);
        return { time: h.time, node: tr, marine };
    });
    card.tbody.replaceChildren(...card.rows.map(r => r.node));
    requestAnimationFrame(card.sync);
}
function updateAstronomy(card, snapshot) {
    const sun = snapshot.astronomy?.get(card.date), tz = snapshot.location.tz;
    if (!sun) {
        const text = `Sole e Luna: ${snapshot.astronomyStatus ?? 'caricamento…'}`;
        setText(card.astroSummary, text); setText(card.astro, text); return;
    }
    setText(card.astroSummary, `☀ Alba ${clock(sun.sunrise, tz)} · Tramonto ${clock(sun.sunset, tz)} · ${sun.phase.join(' ')}`);
    if (card.sun === sun) return;
    card.sun = sun;
    const heading = el('h4', '', 'Sole e Luna');
    const phase = el('p', '', `${sun.phase.join(' ')} · Illuminazione ${value(sun.illumination, '%', 1)} al mezzogiorno locale`);
    const lunar = el('p', 'hint', `Luna: levata ${clock(sun.moonrise, tz)} · tramonto ${clock(sun.moonset, tz)}`);
    const solar = el('p', 'hint', `Sole: alba ${clock(sun.sunrise, tz)} · tramonto ${clock(sun.sunset, tz)}`);
    const twilight = el('dl', 'twilight');
    for (const [label, key] of [['Civile', 'civil_twilight'], ['Nautico', 'nautical_twilight'], ['Astronomico', 'astronomical_twilight']])
        twilight.append(el('dt', '', `Crepuscolo ${label.toLowerCase()}`), el('dd', '', `${clock(sun[`${key}_begin`], tz)} / ${clock(sun[`${key}_end`], tz)}`));
    card.astro.replaceChildren(heading, phase, solar, lunar, twilight);
}
function updateMarine(card, snapshot) {
    const hasMarine = snapshot.marine?.size > 0;
    for (const node of card.table.querySelectorAll('.marine-cell')) node.hidden = !hasMarine;
    for (const row of card.rows) {
        const wave = snapshot.marine?.get(row.time);
        [value(wave?.height, '', 1), value(wave?.period, '', 1), direction(wave?.direction), value(wave?.beaufort)].forEach((text, i) => setText(row.marine[i], text));
    }
    setText(card.marineState, `Mare: ${snapshot.marineStatus ?? 'caricamento…'}`);
}
export function render(snapshot) {
    const atmosphericChange = lastHours !== snapshot.hours;
    activeSnapshot = snapshot;
    if (atmosphericChange) {
        setText($('loc'), snapshot.location.name);
        setText($('sel'), `${snapshot.location.lat.toFixed(3)}, ${snapshot.location.lon.toFixed(3)} · ${snapshot.location.tz}${snapshot.elevation == null ? '' : ` · ${value(snapshot.elevation, ' m s.l.m.')}`}`);
        const runs = Object.entries(snapshot.models).map(([model, run]) => `${model}: ${run}`).join(' · ');
        setText($('when'), `Acquisizione: ${timestamp(snapshot.fetchedAt, snapshot.location.tz)}${runs ? ` · Run ${runs}` : ''}`);
        const dates = new Set(snapshot.days.map(d => d.date));
        for (const [date, card] of cards) if (!dates.has(date)) { card.observer?.disconnect(); card.root.remove(); cards.delete(date); }
        for (const [index, day] of snapshot.days.entries()) {
            let card = cards.get(day.date);
            if (!card) { card = createCard(day.date); cards.set(day.date, card); $('days').append(card.root); }
            const current = $('days').children[index];
            if (current !== card.root) $('days').insertBefore(card.root, current ?? null);
            updateAtmosphere(card, day);
            card.sun = null;
            card.fallback.hidden = card.fallbackLabel.hidden = true; setText(card.copyStatus, '');
        }
        renderChart(snapshot);
        lastHours = snapshot.hours;
    }
    for (const card of cards.values()) {
        updateAstronomy(card, snapshot);
        updateMarine(card, snapshot);
    }
    setText($('sources'), `Mare: ${snapshot.marineStatus ?? 'caricamento…'} · Sole e Luna: ${snapshot.astronomyStatus ?? 'caricamento…'}`);
    const coverages = [...(snapshot.forecast?.values() ?? [])].map(s => s.facts.find(f => f.category === 'coverage'));
    setText($('coverage'), snapshot.hours.length ? coverages.some(c => c?.partial || c?.gaps.length) ? 'Copertura atmosferica parziale: consulta i periodi disponibili nelle schede.' : 'Campioni atmosferici disponibili per le date mostrate.' : 'Nessuna copertura atmosferica disponibile.');
}
function renderChart(snapshot) {
    chart?.destroy();
    if (typeof Chart === 'undefined') { setText($('chart-state'), 'Grafico non disponibile. Consulta le tabelle orarie.'); return; }
    setText($('chart-state'), 'Punti = campioni disponibili. I tratti interrotti indicano dati mancanti; i gradini della probabilità collegano campioni senza definire un intervallo statistico.');
    const tz = snapshot.location.tz;
    const axisStamp = time => new Date(time).toLocaleString('it-IT', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const tickTimes = [...new Set(Array.from({ length: 5 }, (_, i) => snapshot.hours[Math.round(i * (snapshot.hours.length - 1) / 4)].time))];
    const gaps = new Set([...(snapshot.forecast?.values() ?? [])].flatMap(s => s.diagnostics.gaps));
    const points = field => snapshot.hours.flatMap((h, i, all) => [
        ...(i && (gaps.has(h.time) || h.time - all[i - 1].time > 10800000) ? [{ x: all[i - 1].time + 1, y: null }] : []), { x: h.time, y: h[field] }
    ]);
    chart = new Chart($('chart'), {
        type: 'line', data: { datasets: [
            { label: 'Temperatura °C', data: points('temp'), borderColor: '#ffcc66', backgroundColor: '#ffcc66', yAxisID: 'temperature', tension: 0, pointRadius: 2, spanGaps: false },
            { label: 'Probabilità precipitazione %', data: points('probability'), borderColor: '#6aa6ff', backgroundColor: '#6aa6ff', borderDash: [5, 3], yAxisID: 'probability', stepped: 'after', pointRadius: 2, spanGaps: false }
        ] },
        options: { responsive: true, maintainAspectRatio: false, parsing: false, interaction: { mode: 'index', intersect: false },
            plugins: { legend: { labels: { color: '#e9eef7', boxWidth: 16 } }, tooltip: { callbacks: { title: items => timestamp(items[0].parsed.x, tz) } } },
            scales: { x: { type: 'linear', min: snapshot.hours[0].time, max: snapshot.hours.at(-1).time, afterBuildTicks: axis => { axis.ticks = tickTimes.map(value => ({ value })); }, ticks: { color: '#a9b6cc', maxTicksLimit: 5, callback: n => axisStamp(n) } },
                temperature: { position: 'left', title: { display: true, text: '°C', color: '#ffcc66' }, ticks: { color: '#ffcc66' } },
                probability: { position: 'right', min: 0, max: 100, title: { display: true, text: '%', color: '#6aa6ff' }, ticks: { color: '#6aa6ff' }, grid: { drawOnChartArea: false } } }
        }
    });
}
