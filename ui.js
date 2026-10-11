import { icon } from './meteoam-data.js';
const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const value = (n, unit = '', digits = 0) => n == null ? '—' : `${n.toLocaleString('it-IT', { maximumFractionDigits: digits })}${unit}`;
const clock = (time, tz) => time && Number.isFinite(new Date(time).getTime()) ? new Date(time).toLocaleTimeString('it-IT', { timeZone: tz, hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' }) : '—';
const timestamp = (time, tz) => new Date(time).toLocaleString('it-IT', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const direction = n => n == null ? '—' : `${['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(n / 45) % 8]} ${value(n, '°')}`;
const condition = code => { const [emoji, label] = icon(code); return `<span role="img" aria-label="${escape(label)}" title="${escape(label)}">${emoji}</span>`; };
let chart;
let lastSnapshot;
export function status(message, error = false) {
    $('status').textContent = message;
    $('status').classList.toggle('error', error);
}
export function render(snapshot) {
    const { location, days } = snapshot;
    const tz = location.tz;
    const open = new Set([...$('days').querySelectorAll('details[open]')].map(el => el.dataset.date));
    if (lastSnapshot && lastSnapshot !== snapshot) open.clear();
    $('loc').textContent = location.name;
    $('sel').textContent = `Lat ${location.lat.toFixed(3)}, Lon ${location.lon.toFixed(3)} — ${tz}`;
    $('tz').textContent = tz;
    $('elev').textContent = value(snapshot.elevation, ' m s.l.m.');
    const runs = Object.entries(snapshot.models).map(([model, run]) => `${model}: ${run}`).join(' · ');
    $('when').textContent = `Dati acquisiti: ${timestamp(snapshot.fetchedAt, tz)}${runs ? ` · Run ${runs}` : ''}`;
    const hasMarine = snapshot.marine?.size > 0;
    $('days').innerHTML = days.map(day => {
        const sun = snapshot.astronomy.get(day.date);
        const solarTip = sun ? [['Crepuscolo civile', 'civil_twilight'], ['Crepuscolo nautico', 'nautical_twilight'], ['Crepuscolo astronomico', 'astronomical_twilight']].map(([label, key]) => `${label}: ${clock(sun[`${key}_begin`], tz)} / ${clock(sun[`${key}_end`], tz)}`).join('\n') : '';
        const moon = sun ? `${sun.phase.join(' ')} · illuminazione ${value(sun.illumination, '%', 1)} (mezzogiorno locale) · Levata ${clock(sun.moonrise, tz)} / Tramonto ${clock(sun.moonset, tz)}` : '';
        const rows = day.hours.map(h => {
            const wave = snapshot.marine?.get(h.time);
            return `<tr><td>${escape(clock(h.time, tz))}</td><td>${condition(h.icon)}</td><td class="temp">${value(h.temp, '°', 1)}</td><td class="rain">${value(h.probability, '%')}</td><td>${value(h.humidity, '%')}</td><td>${value(h.pressure, '', 1)}</td><td>${value(h.windSpeed, '', 1)}</td><td>${direction(h.windDir)}</td>${hasMarine ? `<td>${value(wave?.height, '', 1)}</td><td>${value(wave?.period, '', 1)}</td><td>${direction(wave?.direction)}</td><td>${value(wave?.beaufort)}</td>` : ''}</tr>`;
        }).join('');
        return `<details class="day-card" data-date="${day.date}" ${open.has(day.date) ? 'open' : ''}>
          <summary class="day-header"><span class="day-title">${escape(new Date(day.hours[0].time).toLocaleDateString('it-IT', { timeZone: tz, weekday: 'long', day: '2-digit', month: '2-digit' }))}</span> ${condition(day.icon)} <span class="big">${value(day.max, '°')} / ${value(day.min, '°')}</span>${day.sampledExtremes ? '<span class="hint"> Estremi dei campioni disponibili</span>' : ''}
          <div class="sun-row tooltip" tabindex="0" data-tooltip="${escape(solarTip)}" title="${escape(solarTip)}">${sun ? `☀️ ${escape(clock(sun.sunrise, tz))} / ${escape(clock(sun.sunset, tz))} · ${escape(moon)}` : 'Sole e Luna: ' + escape(snapshot.astronomyStatus ?? 'caricamento…')}</div></summary>
          <div class="day-details"><div class="hint">Probabilità di precipitazione fornita da MeteoAM; intervallo di riferimento non specificato. — indica un dato assente.</div>
          <div class="table"><table><thead><tr><th>Ora</th><th class="icon-header">Meteo</th><th>Temp °C</th><th>Precipitazione %</th><th>Umidità %</th><th>Pressione hPa</th><th>Vento km/h</th><th>Direzione</th>${hasMarine ? '<th>Onde m</th><th>Periodo s</th><th>Direzione onde</th><th>Beaufort</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div></div>
        </details>`;
    }).join('');
    for (const wrapper of $('days').querySelectorAll('.table')) {
        const sync = () => wrapper.style.setProperty('--hour-col-width', `${wrapper.querySelector('th').getBoundingClientRect().width}px`);
        wrapper.closest('details').addEventListener('toggle', sync);
        requestAnimationFrame(sync);
    }
    $('sources').textContent = `Mare: ${snapshot.marineStatus ?? 'caricamento…'} · Sole e Luna: ${snapshot.astronomyStatus ?? 'caricamento…'}`;
    if (lastSnapshot !== snapshot) renderChart(snapshot);
    lastSnapshot = snapshot;
}
function renderChart(snapshot) {
    chart?.destroy();
    if (typeof Chart === 'undefined') { status('Grafico non disponibile: impossibile caricare Chart.js', true); return; }
    const tz = snapshot.location.tz;
    const points = field => snapshot.hours.map(h => ({ x: h.time, y: h[field] }));
    chart = new Chart($('chart'), {
        type: 'line', data: { datasets: [
            { label: 'Temperatura °C', data: points('temp'), borderColor: '#ffcc66', yAxisID: 'temperature', tension: 0, pointRadius: 0, spanGaps: false },
            { label: 'Probabilità precipitazione %', data: points('probability'), borderColor: '#6aa6ff', yAxisID: 'probability', tension: 0, pointRadius: 0, spanGaps: false }
        ] },
        options: { responsive: true, maintainAspectRatio: false, parsing: false, interaction: { mode: 'index', intersect: false },
            plugins: { legend: { labels: { color: '#e9eef7' } }, tooltip: { callbacks: { title: items => timestamp(items[0].parsed.x, tz) } } },
            scales: { x: { type: 'linear', ticks: { color: '#a9b6cc', maxTicksLimit: 5, callback: n => timestamp(n, tz) } },
                temperature: { position: 'left', title: { display: true, text: '°C' }, ticks: { color: '#ffcc66' } },
                probability: { position: 'right', min: 0, max: 100, title: { display: true, text: '%' }, ticks: { color: '#6aa6ff' }, grid: { drawOnChartArea: false } } }
        }
    });
}
