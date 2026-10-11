// Optional browser QA: Playwright is installed outside the project (see README).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(new URL('..', import.meta.url).pathname);
const output = process.env.QA_OUTPUT || '/tmp/41weather-qa-results';
await mkdir(output, { recursive: true });
const { data: fixture } = JSON.parse(await readFile(new URL('../tests/fixtures/napoli-real.json', import.meta.url)));
// Second day is synthetic, repeating the real samples to exercise date isolation.
const weather = structuredClone(fixture);
weather.timeseries.push(...fixture.timeseries.map(t => new Date(Date.parse(t) + 86400000).toISOString()));
for (const [key, values] of Object.entries(weather.datasets['0'])) for (let i = 0; i < 12; i++) values[i + 12] = values[i];
weather.extrainfo.stats.push({ ...fixture.extrainfo.stats[0], localDate: '2026-10-13T00:00:00+02:00' });
const astronomy = { days: ['2026-10-12', '2026-10-13'].map(date => ({ date, sunrise: `${date}T05:15:00Z`, sunset: `${date}T16:30:00Z`, moon_phase: 'Waxing Crescent', moon_illumination: 30, moonrise: `${date}T07:00:00Z`, moonset: `${date}T19:00:00Z`, civil_twilight_begin: `${date}T04:45:00Z`, civil_twilight_end: `${date}T17:00:00Z` })) };
const marine = { timeseries: fixture.timeseries, paramlist: ['swh'], datasets: { '0': { '0': { '0': 0.5 } } } };
// Visual scenario: one real day and six explicitly synthetic days with varied
// summary/hourly icons to inspect a complete weekly overview.
const weekWeather = structuredClone(fixture);
weekWeather.timeseries = [];
weekWeather.datasets = { '0': Object.fromEntries(fixture.paramlist.map((_, i) => [i, {}])) };
weekWeather.extrainfo.stats = [];
const weekIcons = ['09', '04', '01', '05', '10', '03', '06'];
for (let day = 0; day < 7; day++) {
    const date = new Date(Date.parse('2026-10-12T00:00:00Z') + day * 86400000).toISOString().slice(0, 10);
    weekWeather.extrainfo.stats.push({ ...fixture.extrainfo.stats[0], localDate: `${date}T00:00:00+02:00`, icon: weekIcons[day] });
    for (let i = 0; i < 12; i++) {
        weekWeather.timeseries.push(new Date(Date.parse(fixture.timeseries[i]) + day * 86400000).toISOString());
        for (const [key, values] of Object.entries(fixture.datasets['0'])) {
            const param = fixture.paramlist[Number(key)];
            weekWeather.datasets['0'][key][day * 12 + i] = day && param === 'icon' ? weekIcons[day] : day && param === 'tpp' ? (weekIcons[day] === '10' ? 60 : 0) : values[i];
        }
    }
}
const chartSource = await readFile(process.env.CHART_JS_FILE || '/tmp/41weather-qa/chart.umd.js');
const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(`${root}/`)) { res.writeHead(403).end(); return; }
    try { const body = await readFile(file); res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(file)] || 'application/json'); res.end(body); }
    catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const json = body => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
async function prepare(browser, { width = 390, denied = false, touch = false, deferred = false, weatherData = weather } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: touch });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ denied }) => {
        window.qaFetches = 0; const original = window.fetch;
        window.fetch = (...args) => { window.qaFetches++; return original(...args); };
        window.qaCharts = 0;
        let chart;
        Object.defineProperty(window, 'Chart', { configurable: true, get: () => chart, set: value => { chart = new Proxy(value, { construct(target, args) { window.qaCharts++; return Reflect.construct(target, args); } }); } });
        if (denied) {
            Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage denied'); } });
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard denied'); } } });
        } else Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.qaCopied = text; } } });
    }, { denied });
    const dates = [...new Set(weatherData.timeseries.map(t => t.slice(0, 10)))];
    const solarData = { days: dates.map(date => Object.fromEntries(Object.entries(astronomy.days[0]).map(([key, value]) => [key, typeof value === 'string' ? value.replaceAll('2026-10-12', date) : value]))) };
    let releaseSun, releaseMarine;
    const sunGate = deferred ? new Promise(resolve => releaseSun = resolve) : Promise.resolve();
    const marineGate = deferred ? new Promise(resolve => releaseMarine = resolve) : Promise.resolve();
    await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: chartSource }));
    await page.route('https://api.meteoam.it/**', async route => {
        if (route.request().url().includes('/preset2/')) { await marineGate; await route.fulfill(json(marine)).catch(() => {}); }
        else await route.fulfill(json(weatherData));
    });
    await page.route('https://api.sunrise-sunset.org/**', async route => { await sunGate; await route.fulfill(json(solarData)).catch(() => {}); });
    await page.goto(origin);
    await page.locator('.forecast').first().waitFor();
    await page.waitForFunction(() => window.qaCharts === 1);
    return { page, context, errors, releaseSun, releaseMarine };
}
async function assertLayout(page, width) {
    await page.waitForFunction(() => { const th = document.querySelector('.table th'), second = document.querySelector('.table th:nth-child(2)'); return Math.abs(parseFloat(getComputedStyle(second).left) - th.getBoundingClientRect().width) < 1; });
    const metrics = await page.evaluate(() => {
        const table = document.querySelector('.table'), hour = table.querySelector('th'), second = table.querySelector('th:nth-child(2)');
        return { scrollWidth: document.documentElement.scrollWidth, width: innerWidth, chart: document.querySelector('.chart-container').getBoundingClientRect().width, sectionWidth: document.querySelector('.chart-section').getBoundingClientRect().width, chartSpace: document.querySelector('.chart-section').clientWidth - parseFloat(getComputedStyle(document.querySelector('.chart-section')).paddingLeft) - parseFloat(getComputedStyle(document.querySelector('.chart-section')).paddingRight),
            sticky: parseFloat(getComputedStyle(second).left), first: hour.getBoundingClientRect().width, tableOverflow: table.scrollWidth > table.clientWidth,
            forecast: getComputedStyle(document.querySelector('.forecast')).userSelect, summaryContainsText: !!document.querySelector('summary .forecast'), weekWidth: document.querySelector('#week').scrollWidth, weekClient: document.querySelector('#week').clientWidth, dayIcon: parseFloat(getComputedStyle(document.querySelector('.day-condition .day-weather-symbol')).fontSize), weekIcon: parseFloat(getComputedStyle(document.querySelector('.week-condition .day-weather-symbol')).fontSize), copyHeight: document.querySelector('.copy').getBoundingClientRect().height, detailHeight: document.querySelector('#verbosity').getBoundingClientRect().height };
    });
    assert.ok(metrics.scrollWidth <= width + 1, JSON.stringify(metrics));
    assert.ok(Math.abs(metrics.chart - metrics.chartSpace) < 1, JSON.stringify(metrics));
    assert.ok(metrics.sectionWidth >= Math.min(width - 64, 1100), JSON.stringify(metrics));
    assert.ok(Math.abs(metrics.sticky - metrics.first) < 1, JSON.stringify(metrics));
    assert.ok(metrics.weekWidth <= metrics.weekClient + 1, JSON.stringify(metrics));
    assert.ok(metrics.dayIcon >= 48 && metrics.weekIcon >= 32, JSON.stringify(metrics));
    assert.ok(metrics.copyHeight >= 44 && metrics.detailHeight >= 44, JSON.stringify(metrics));
    assert.equal(metrics.forecast, 'text'); assert.equal(metrics.summaryContainsText, false);
    if (width <= 768) assert.equal(metrics.tableOverflow, true);
}
async function run(name, browser) {
    const first = await prepare(browser, { deferred: true }); const { page } = first;
    await page.locator('.hourly summary').first().focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.hourly').open);
    await page.evaluate(() => {
        window.qaWeek = document.querySelector('.week-day'); window.qaCard = document.querySelector('.day-card'); window.qaParagraph = document.querySelector('.forecast'); window.qaRow = document.querySelector('tbody tr');
        const selection = getSelection(), range = document.createRange(); range.selectNodeContents(window.qaParagraph); selection.removeAllRanges(); selection.addRange(range);
        window.qaSelection = selection.toString(); window.qaFocus = document.activeElement;
        window.scrollTo(0, 180); window.qaScroll = scrollY;
        document.querySelector('.table').scrollLeft = 50;
        window.qaTableScroll = document.querySelector('.table').scrollLeft;
    });
    first.releaseSun();
    await page.locator('.astronomy h4').first().waitFor({ state: 'attached' });
    first.releaseMarine();
    await page.waitForFunction(() => document.querySelector('.marine-state').textContent === 'Mare: disponibili');
    const preserved = await page.evaluate(() => ({ week: window.qaWeek === document.querySelector('.week-day'), card: window.qaCard === document.querySelector('.day-card'), paragraph: window.qaParagraph === document.querySelector('.forecast'),
        row: window.qaRow === document.querySelector('tbody tr'), open: document.querySelector('.hourly').open, focus: document.activeElement === window.qaFocus,
        selection: getSelection().toString() === window.qaSelection, scroll: Math.abs(scrollY - window.qaScroll) < 2,
        tableScroll: document.querySelector('.table').scrollLeft === window.qaTableScroll, charts: window.qaCharts }));
    assert.deepEqual(preserved, { week: true, card: true, paragraph: true, row: true, open: true, focus: true, selection: true, scroll: true, tableScroll: true, charts: 1 });
    const before = await page.evaluate(() => ({ fetches: window.qaFetches, charts: window.qaCharts }));
    const standard = await page.locator('.forecast').first().textContent();
    for (const level of ['title', 'brief', 'detailed', 'standard']) await page.locator('#verbosity').selectOption(level);
    assert.equal(await page.locator('.forecast').first().textContent(), standard);
    assert.deepEqual(await page.evaluate(() => ({ fetches: window.qaFetches, charts: window.qaCharts })), before);
    await page.locator('.copy').first().click();
    const copied = await page.evaluate(() => window.qaCopied);
    assert.match(copied, /Roma, IT.*12 ottobre 2026.*Standard/);
    assert.match(copied, /minima.*°C/); assert.doesNotMatch(copied, /13 ottobre/);
    await page.locator('#verbosity').selectOption('brief');
    await page.reload(); await page.locator('.forecast').first().waitFor();
    assert.equal(await page.locator('#verbosity').inputValue(), 'brief');
    await page.locator('#verbosity').selectOption('standard');
    await page.waitForFunction(() => document.querySelector('#sources').textContent.includes('Sole e Luna: disponibili'));
    const beforeNavigation = await page.evaluate(() => ({ fetches: window.qaFetches, charts: window.qaCharts }));
    await page.locator('.week-day').last().click();
    assert.equal(new URL(page.url()).hash, '#day-2026-10-13');
    assert.deepEqual(await page.evaluate(() => ({ fetches: window.qaFetches, charts: window.qaCharts })), beforeNavigation);
    assert.equal(await page.locator('#sel').isVisible(), false);
    await page.locator('.metadata summary').click();
    assert.equal(await page.locator('#sel').isVisible(), true);
    await first.context.close();
    for (const width of [320, 390, 768, 1440]) {
        const current = await prepare(browser, { width, touch: width <= 390, weatherData: weekWeather });
        assert.equal(await current.page.locator('.week-day').count(), 7);
        await current.page.screenshot({ path: `${output}/${name}-week-${width}.png`, fullPage: false });
        await current.page.locator('.astronomy h4').first().waitFor({ state: 'attached' });
        if (width <= 390) await current.page.locator('.hourly summary').first().tap();
        else { await current.page.locator('.hourly summary').first().focus(); await current.page.keyboard.press('Space'); }
        await current.page.waitForFunction(() => document.querySelector('.hourly').open);
        await assertLayout(current.page, width);
        await current.page.screenshot({ path: `${output}/${name}-${width}.png`, fullPage: true });
        if (width === 1440) {
            await current.page.setViewportSize({ width: 320, height: 900 }); await assertLayout(current.page, 320);
        }
        assert.deepEqual(current.errors, []); await current.context.close();
    }
    const denied = await prepare(browser, { denied: true });
    await denied.page.locator('#verbosity').selectOption('detailed');
    await denied.page.locator('.copy').first().click();
    await denied.page.locator('.copy-fallback').first().waitFor({ state: 'visible' });
    assert.match(await denied.page.locator('.copy-fallback').first().inputValue(), /Roma, IT.*Dettagliato/);
    assert.match(await denied.page.locator('.copy-status').first().textContent(), /manuale/);
    // Clipboard API may be absent rather than rejecting.
    await denied.page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
    await denied.page.locator('.copy').nth(1).click();
    await denied.page.locator('.copy-fallback').nth(1).waitFor({ state: 'visible' });
    assert.match(await denied.page.locator('.copy-fallback').nth(1).inputValue(), /13 ottobre/);
    assert.deepEqual(denied.errors, []); await denied.context.close();
    // Optional HTTP failures leave atmospheric cards/chart usable.
    const failure = await prepare(browser, { deferred: true });
    await failure.page.unroute('https://api.sunrise-sunset.org/**');
    await failure.page.unroute('https://api.meteoam.it/**');
    failure.releaseSun(); failure.releaseMarine();
    await failure.page.route('https://api.sunrise-sunset.org/**', route => route.fulfill({ status: 503, body: '{}' }));
    await failure.page.route('https://api.meteoam.it/**', route => route.request().url().includes('/preset2/') ? route.fulfill({ status: 503, body: '{}' }) : route.fulfill(json(weather)));
    await failure.page.reload(); await failure.page.locator('.forecast').first().waitFor();
    await failure.page.waitForFunction(() => document.querySelector('#sources').textContent.includes('Mare: non disponibili') && document.querySelector('#sources').textContent.includes('Sole e Luna: non disponibili'));
    assert.equal(await failure.page.locator('.day-card').count(), 2);
    await failure.page.locator('#verbosity').selectOption('title');
    assert.deepEqual(failure.errors, []); await failure.context.close();
    // Rapid geocoding searches and stale optional replies cannot commit an older location.
    const races = await prepare(browser);
    let releaseSlow, releaseOldSun;
    const slow = new Promise(resolve => releaseSlow = resolve), oldSun = new Promise(resolve => releaseOldSun = resolve);
    await races.page.route('https://geocoding-api.open-meteo.com/**', async route => {
        const name = new URL(route.request().url()).searchParams.get('name');
        if (name === 'Lenta') await slow;
        if (name === 'Errore') return route.fulfill({ status: 503, body: '{}' });
        return route.fulfill(json({ results: [{ name, latitude: name === 'Prima' ? 1 : 2, longitude: 3, timezone: 'UTC' }] })).catch(() => {});
    });
    await races.page.route('https://api.sunrise-sunset.org/**', async route => {
        if (new URL(route.request().url()).searchParams.get('lat') === '1') await oldSun;
        return route.fulfill(json(astronomy)).catch(() => {});
    });
    const search = async name => { await races.page.locator('#q').fill(name); await races.page.locator('#searchBtn').click(); };
    await search('Lenta'); await search('Prima');
    await races.page.waitForFunction(() => document.querySelector('#loc').textContent === 'Prima');
    await search('Ultima'); await races.page.waitForFunction(() => document.querySelector('#loc').textContent === 'Ultima');
    releaseSlow(); releaseOldSun();
    await races.page.waitForFunction(() => document.querySelector('#sources').textContent.includes('Sole e Luna: disponibili'));
    await races.page.route('https://api.meteoam.it/**', route => route.request().url().includes('/preset2/') ? route.fulfill(json(marine)) : route.fulfill(json({ datasets: { '0': {} }, timeseries: [] })));
    await search('Vuota'); await races.page.waitForFunction(() => document.querySelector('#status').textContent.includes('Nessuna copertura'));
    assert.equal(await races.page.locator('#loc').textContent(), 'Ultima');
    await search('Errore'); await races.page.waitForFunction(() => document.querySelector('#status').classList.contains('error'));
    assert.equal(await races.page.locator('#loc').textContent(), 'Ultima');
    assert.match(races.page.url(), /name=Ultima/);
    assert.deepEqual(races.errors, []); await races.context.close();
    console.log(`${name}: responsive widths, keyboard/touch, preservation, levels, copy/storage failures, optional failures and request races passed`);
}
try {
    for (const [name, type] of [['chromium', chromium], ['webkit', webkit]]) {
        const browser = await type.launch(name === 'chromium' && process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {});
        try { console.log(`${name} version ${browser.version()}`); await run(name, browser); }
        finally { await browser.close(); }
    }
} finally { server.close(); }
