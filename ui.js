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
    const node = el('span', 'condition');
    const symbol = el('span', 'day-weather-symbol', emoji); symbol.setAttribute('aria-hidden', 'true');
    node.append(symbol, el('span', 'condition-label', label));
    return node;
}
const levels = { title: 'Titolo', brief: 'Breve', standard: 'Standard', detailed: 'Dettagliato' };
const preferenceKey = '41weather.detail';
let verbosity = 'standard';
try { const saved = localStorage.getItem(preferenceKey); if (Object.hasOwn(levels, saved)) verbosity = saved; } catch { /* Storage is optional. */ }
$('verbosity').value = verbosity;
let chart, activeSnapshot, lastHours;
const cards = new Map();
export function status(message, error = false) {
    setText($('status'), message === 'Previsioni caricate.' ? '' : message);
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
    const root = el('article', 'day-card'); root.dataset.date = date; root.id = `day-${date}`; root.tabIndex = -1;
    const localDate = new Date(`${date}T12:00:00Z`);
    const weekday = localDate.toLocaleDateString('it-IT', { timeZone: 'UTC', weekday: 'long' });
    const calendarDate = localDate.toLocaleDateString('it-IT', { timeZone: 'UTC', day: 'numeric', month: 'long' });
    const weekLink = el('a', 'week-day'); weekLink.href = `#${root.id}`; weekLink.dataset.date = date;
    weekLink.setAttribute('aria-label', `Previsione del ${dateLabel(date)}`);
    const weekDate = el('span', 'week-date');
    weekDate.append(el('span', 'week-weekday', weekday.slice(0, 3)), el('span', 'week-number', String(localDate.getUTCDate())));
    const weekWeather = el('span', 'week-condition');
    const weekTemperature = el('span', 'week-temperatures');
    weekLink.append(weekDate, weekWeather, weekTemperature);
    const header = el('div', 'day-header');
    const title = el('h3', 'day-title', weekday);
    title.append(el('span', 'day-date', calendarDate));
    const weather = el('div', 'day-condition');
    const temperature = el('div', 'temperatures');
    header.append(title, weather, temperature);
    const extremes = el('p', 'hint extremes');
    const forecast = el('p', 'forecast');
    const coverageNote = el('p', 'hint coverage-note');
    const secondary = el('div', 'day-secondary');
    const astroSummary = el('p', 'astro-summary hint');
    const copy = el('button', 'copy', 'Copia'); copy.type = 'button';
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
    headings.forEach((label, i) => { const th = el('th', i >= 8 ? `marine-cell${i === 8 ? ' marine-start' : ''}` : '', label); th.scope = 'col'; tr.append(th); });
    thead.append(tr);
    const tbody = el('tbody'); table.append(caption, thead, tbody); wrapper.append(table);
    const marineState = el('p', 'hint marine-state');
    const coverageDetails = el('div', 'coverage-details'); coverageDetails.append(extremes, coverageNote);
    content.append(coverageDetails, astro, note, wrapper, marineState); details.append(summary, content);
    root.append(header, forecast, secondary, copyStatus, fallbackLabel, fallback, details);
    const card = { date, root, weekLink, weekWeather, weekTemperature, weather, temperature, extremes, coverageNote, forecast, astroSummary, astro, tbody, wrapper, table, details, marineState, copy, copyStatus, fallback, fallbackLabel, rows: [] };
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
    const reading = (label, n, className) => {
        const node = el('span', `temperature-reading ${className}`);
        node.append(el('span', 'temperature-label', label), el('strong', 'temperature-value', value(n, '°')));
        return node;
    };
    card.temperature.replaceChildren(reading('Max', day.max, 'temperature-high'), reading('Min', day.min, 'temperature-low'));
    if (day.sampledExtremes) card.temperature.append(el('span', 'temperature-qualifier', 'Estremi parziali'));
    card.weekWeather.replaceChildren(condition(day.icon));
    card.weekLink.setAttribute('aria-label', `${dateLabel(day.date)}: ${icon(day.icon)[1]}, massima ${value(day.max, ' °C')}, minima ${value(day.min, ' °C')}${day.sampledExtremes ? ', estremi parziali' : ''}`);
    const weekMax = el('span', 'week-high', value(day.max, '°')); weekMax.setAttribute('aria-label', `Massima ${value(day.max, ' °C')}`);
    const weekMin = el('span', 'week-low', value(day.min, '°')); weekMin.setAttribute('aria-label', `Minima ${value(day.min, ' °C')}`);
    card.weekTemperature.replaceChildren(weekMax, weekMin);
    if (day.sampledExtremes) card.weekTemperature.append(el('span', 'week-qualifier', 'Parziali'));
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
        const marine = Array.from({ length: 4 }, (_, i) => el('td', `marine-cell${i === 0 ? ' marine-start' : ''}`, '—'));
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
        setText(card.astroSummary, ''); setText(card.astro, text); return;
    }
    const solarClock = time => time == null ? '—' : new Date(time).toLocaleTimeString('it-IT', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
    setText(card.astroSummary, `Alba ${solarClock(sun.sunrise)} · Tramonto ${solarClock(sun.sunset)} · ${sun.phase[0]}`);
    card.astroSummary.setAttribute('aria-label', `Alba ${solarClock(sun.sunrise)}, tramonto ${solarClock(sun.sunset)}, ${sun.phase[1]}`);
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
    const { days, hours } = snapshot.visible;
    if (atmosphericChange) {
        setText($('loc'), snapshot.location.name);
        setText($('sel'), `${snapshot.location.lat.toFixed(3)}, ${snapshot.location.lon.toFixed(3)} · ${snapshot.location.tz}${snapshot.elevation == null ? '' : ` · ${value(snapshot.elevation, ' m s.l.m.')}`}`);
        const runs = Object.entries(snapshot.models).map(([model, run]) => `${model}: ${run}`).join(' · ');
        setText($('when'), `Acquisizione: ${timestamp(snapshot.fetchedAt, snapshot.location.tz)}${runs ? ` · Run ${runs}` : ''}`);
        const dates = new Set(days.map(d => d.date));
        const rangeDate = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('it-IT', { timeZone: 'UTC', day: 'numeric', month: 'long' });
        const firstDate = days[0]?.date, lastDate = days.at(-1)?.date;
        setText($('forecast-range'), !days.length ? '' : firstDate === lastDate ? rangeDate(firstDate) : `${firstDate.slice(0, 7) === lastDate.slice(0, 7) ? Number(firstDate.slice(-2)) : rangeDate(firstDate)} – ${rangeDate(lastDate)}`);
        for (const [name, limit] of [['week-days', 7], ['week-tablet-days', 4], ['week-mobile-days', 3]])
            $('week').style.setProperty(`--${name}`, Math.max(1, Math.min(limit, days.length)));
        for (const [date, card] of cards) if (!dates.has(date)) { card.observer?.disconnect(); card.root.remove(); card.weekLink.remove(); cards.delete(date); }
        for (const [index, day] of days.entries()) {
            let card = cards.get(day.date);
            if (!card) { card = createCard(day.date); cards.set(day.date, card); $('days').append(card.root); $('week').append(card.weekLink); }
            const current = $('days').children[index];
            if (current !== card.root) $('days').insertBefore(card.root, current ?? null);
            const currentWeek = $('week').children[index];
            if (currentWeek !== card.weekLink) $('week').insertBefore(card.weekLink, currentWeek ?? null);
            updateAtmosphere(card, day);
            card.sun = null;
            card.fallback.hidden = card.fallbackLabel.hidden = true; setText(card.copyStatus, '');
        }
        $('forecast-empty').hidden = days.length > 0;
        $('verbosity').disabled = days.length === 0;
        document.querySelector('.chart-section').hidden = !hours.length;
        renderChart(snapshot);
        lastHours = snapshot.hours;
    }
    for (const card of cards.values()) {
        updateAstronomy(card, snapshot);
        updateMarine(card, snapshot);
    }
    setText($('sources'), `Mare: ${snapshot.marineStatus ?? 'caricamento…'} · Sole e Luna: ${snapshot.astronomyStatus ?? 'caricamento…'}`);
    const coverages = days.map(day => snapshot.forecast.get(day.date)).map(s => s.facts.find(f => f.category === 'coverage'));
    setText($('coverage'), hours.length ? coverages.some(c => c?.partial || c?.gaps.length) ? 'Copertura atmosferica parziale: consulta i periodi disponibili nelle schede.' : 'Campioni atmosferici disponibili per le date mostrate.' : 'Copertura insufficiente per la vista giornaliera.');
    if (snapshot.visible.excluded) setText($('coverage'), `${$('coverage').textContent} Giorno finale incompleto escluso.`);
}
function chartPalette() {
    const css = getComputedStyle(document.documentElement);
    return Object.fromEntries(['text', 'muted', 'accent', 'temperature', 'border', 'surface-raised', 'chart-grid'].map(key => [key, css.getPropertyValue(`--${key}`).trim()]));
}
document.addEventListener('41weather:themechange', () => {
    if (!chart) return;
    const colors = chartPalette();
    chart.data.datasets.forEach((dataset, i) => { dataset.borderColor = dataset.backgroundColor = i ? colors.accent : colors.temperature; });
    chart.options.plugins.legend.labels.color = colors.text;
    Object.assign(chart.options.plugins.tooltip, { backgroundColor: colors['surface-raised'], titleColor: colors.text, bodyColor: colors.text, borderColor: colors.border });
    for (const [name, scale] of Object.entries(chart.options.scales)) {
        const color = name === 'temperature' ? colors.temperature : name === 'probability' ? colors.accent : colors.muted;
        scale.ticks.color = color;
        scale.grid.color = colors['chart-grid'];
        scale.border.color = colors.border;
        if (scale.title) scale.title.color = color;
    }
    chart.update('none');
});
function renderChart(snapshot) {
    chart?.destroy(); chart = undefined;
    const hours = snapshot.visible.hours;
    if (!hours.length) return;
    if (typeof Chart === 'undefined') { setText($('chart-state'), 'Grafico non disponibile. Consulta le tabelle orarie.'); return; }
    setText($('chart-state'), '');
    const tz = snapshot.location.tz;
    const axisStamp = time => new Date(time).toLocaleString('it-IT', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const tickTimes = [...new Set(Array.from({ length: 5 }, (_, i) => hours[Math.round(i * (hours.length - 1) / 4)].time))];
    const gaps = new Set([...(snapshot.forecast?.values() ?? [])].flatMap(s => s.diagnostics.gaps));
    const points = field => hours.flatMap((h, i, all) => [
        ...(i && (gaps.has(h.time) || h.time - all[i - 1].time > 10800000) ? [{ x: all[i - 1].time + 1, y: null }] : []), { x: h.time, y: h[field] }
    ]);
    const colors = chartPalette();
    chart = new Chart($('chart'), {
        type: 'line', data: { datasets: [
            { label: 'Temperatura °C', data: points('temp'), borderColor: colors.temperature, backgroundColor: colors.temperature, yAxisID: 'temperature', tension: 0, pointRadius: 2, spanGaps: false },
            { label: 'Probabilità precipitazione %', data: points('probability'), borderColor: colors.accent, backgroundColor: colors.accent, borderDash: [5, 3], yAxisID: 'probability', stepped: 'after', pointRadius: 2, spanGaps: false }
        ] },
        options: { responsive: true, maintainAspectRatio: false, parsing: false, interaction: { mode: 'index', intersect: false },
            plugins: { legend: { labels: { color: colors.text, boxWidth: 16 } }, tooltip: { backgroundColor: colors['surface-raised'], titleColor: colors.text, bodyColor: colors.text, borderColor: colors.border, borderWidth: 1, callbacks: { title: items => timestamp(items[0].parsed.x, tz) } } },
            scales: { x: { grid: { color: colors['chart-grid'] }, border: { color: colors.border }, type: 'linear', min: hours[0].time, max: hours.at(-1).time, afterBuildTicks: axis => { axis.ticks = tickTimes.map(value => ({ value })); }, ticks: { color: colors.muted, maxTicksLimit: 5, callback: n => axisStamp(n) } },
                temperature: { grid: { color: colors['chart-grid'] }, border: { color: colors.border }, position: 'left', title: { display: true, text: '°C', color: colors.temperature }, ticks: { color: colors.temperature } },
                probability: { border: { color: colors.border }, position: 'right', min: 0, max: 100, title: { display: true, text: '%', color: colors.accent }, ticks: { color: colors.accent }, grid: { drawOnChartArea: false, color: colors['chart-grid'] } } }
        }
    });
}
