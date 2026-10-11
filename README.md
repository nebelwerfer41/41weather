[Catalog](https://nebelwerfer41.github.io/) · [Repository](https://github.com/nebelwerfer41/41weather)

# 41weather

41weather is a lightweight client-side weather viewer that combines the public MeteoAM meteogram endpoint with Open-Meteo geocoding. It ships as a static HTML/CSS/JS bundle and renders interactive daily summaries (with sunrise/sunset and lunar phases) plus an hourly chart with Chart.js.

## Features
- Location search powered by the Open-Meteo geocoding API, with a quick shortcut to Roma.
- A prominent weekly overview shows each available day’s condition, large weather icon and temperatures; selecting a day jumps to its forecast.
- Fetches detailed hourly forecasts from MeteoAM (preset1) and groups them into daily cards with always-visible text and expandable hourly details.
- When a coastal/offshore point is selected, augments the hourly table with marine data (preset2) in the same rows while hiding those columns for inland locations.
- Shows compact sunrise/sunset and lunar summaries, with accessible details for twilight, phase, illumination, moonrise and moonset from Sunrise-Sunset v2.
- Responsive UI with a combined temperature/precipitation-probability chart, weather icons, and key metadata (timezone, elevation).
- Weather icons ship with descriptive alt/title text for accessibility and quick hover hints.
- Zero-build setup: just serve the static files and the app runs in modern browsers.

## Project Structure
- `index.html` – main page markup and script includes.
- `styles.css` – dark theme styling for layout, cards, tables, and responsive tweaks.
- `app.js` – request coordination and consistent location updates.
- `services.js` – provider requests, cancellation, deadlines and bounded cache.
- `meteoam-data.js` – pure provider normalization, units, local dates and missing values.
- `ui.js` – keyed daily cards, text detail/copy controls, hourly tables and time-based chart.
- `forecast-text.js` – pure atmospheric analysis, evidence and deterministic Italian prose.
- `tests/` – Node regression tests for provider contracts and cancellation.
- `api.md` – notes on the reverse-engineered MeteoAM meteogram API.

## Getting Started
1. Serve the folder with any static file server (examples below):
   ```bash
   # Python (3.x)
   python3 -m http.server 8000

   # Node.js (with http-server)
   npx http-server .
   ```
2. Open `http://localhost:8000/` (or `http://localhost:8000/index.html`) in your browser.
3. Use the search box to find a city or click `Roma` for the default location.

> Note: Directly opening the HTML file from disk (`file://`) may block `fetch` in some browsers. Prefer a local server.

### Deep-linking a location
You can load the app straight to a given place by passing query parameters:

- `?lat=41.89020&lon=12.49223&name=Roma%2C%20IT` pins exact coordinates, optionally naming the location.
- `?q=isola%20d%27ischia` resolves the string through the same Open-Meteo geocoding used by the search box.

Once a location is loaded, the app keeps the URL in sync so you can bookmark or share it.

## APIs Used
- **MeteoAM meteograms** (`https://api.meteoam.it/deda-meteograms/api/GetMeteogram/{preset}/{lat},{lon}`) – hourly atmospheric parameters and daily stats.
- **Sunrise-Sunset.org v2** (`https://api.sunrise-sunset.org/v2`) – solar events, twilight, daily lunar phase and illumination, moonrise and moonset. Lunar phase is evaluated at local noon, not the exact primary-phase event instant.
- **Open-Meteo Geocoding** (`https://geocoding-api.open-meteo.com/v1/search`) – translates user queries into coordinates and timezone data.

See `api.md` for the detailed reverse-engineering notes captured during development.

## Dependencies
- Runtime: [Chart.js 4](https://www.chartjs.org/) (loaded from CDN).
- Browser: modern ES modules/Fetch/DOM support (tested in recent Chromium/WebKit browsers).

## Development Notes
- Run `npm test` with Node 20+ (no dependency installation required).
- Forecast data renders before optional marine and astronomy enrichment. Optional failures are shown explicitly; failed searches preserve the previous forecast.
- Every location search owns an abortable request scope; stale results cannot update the page.
- Temperature and precipitation probability use actual UTC timestamps on a linear axis, preserving the change from hourly to three-hour steps. Missing values remain gaps.
- Daily cards use native keyboard-accessible `details` elements and retain their open state during enrichment.
- No rainfall amounts or gusts are inferred from unavailable parameters.

## License
Released under the [MIT License](LICENSE) © 2024 nebelwerfer41.

## Deterministic Italian forecast text

`forecast-text.js` exports two pure functions, usable in Node without DOM, network or storage:

```js
const summaries = analyzeForecast(snapshot, { rules: { possible: 30, probable: 60 } });
const text = renderForecast(summaries.get('2026-10-12'), {
  verbosity: 'standard', // title | brief | standard | detailed
  includeTemperature: false
});
```

The return value of analysis is a `Map` keyed by local date. It uses the existing normalized atmospheric hours and daily stats, and the shared semantic icon catalog in `meteoam-data.js`. It ignores marine and astronomy availability. Each fact has a category, source samples, UTC start/end, precision and selection reason; diagnostics retain missing/unknown conditions and gaps. Daily temperature facts also identify the provider stats or fallback. No weather-confidence score is generated.

Editorial defaults are centralized in `DEFAULT_RULES`; they are our conventions, not MeteoAM thresholds:

| Rule | Default / behavior |
| --- | --- |
| Precipitation probability | 30–59%: possible precipitation; ≥60%: probable precipitation |
| Editorial bands | Night 00–06, morning 06–12, afternoon 12–18, evening 18–24, in the location timezone |
| Sustained sky change | At least two consecutive valid samples on **each** side; cloud-cover rank changes by ≥1 |
| Temporal adjacency | Documented 1 h or 3 h steps; no resampling, duration weighting or extension of the final point |
| Unknown icons / holes | Break sky runs; unexplained 2 h steps and steps >3 h are treated conservatively as gaps |
| Evolution selection | Largest supported rise and fall per date, earliest on ties; secondary candidates remain in diagnostics |
| Intermittent phenomenon | Requires an observed valid non-phenomenon pause with no gaps or unknown icons between occurrences |
| Calm wind | All available speeds ≤2 km/h; calm directions excluded from circular mean |
| Wind in Standard | Included when the maximum available speed is ≥10 km/h; Detailed includes any available speed |
| Variable direction | Circular concentration <0.65; absent directions and calm remain distinct |

Analysis runs across midnight before clipping facts to each local date. Day boundaries account for DST and fractional timezones. Cloud cover, veils, visibility and phenomena stay separate; full/partial veils render as one indication. Isolated significant icons remain visible at all four levels, named directly (“Pioggia”, “Foschia”, “Temporale”), without duration or official-warning claims. Compatible phenomena are joined (“Pioggia e foschia”); different time windows, intermittency or probability qualifications remain separate. The diagnostic distinction between isolated and repeated occurrences does not add “segnale di” or “indicazione di” to prose. At most one selected increase and one clearing are rendered, rather than one sentence per point. No attenuation or cessation is inferred from the end of the series. Unknown codes do not prevent using temperatures, wind or probability.

Probability is not precipitation amount, intensity, or daily risk. A precipitation type requires a matching hourly icon. Phenomena survive low/absent probability; divergent low probability is stated without inventing a cause. Detailed prose reports positive hourly probabilities only: zero-only bands are omitted, and ranges spanning zero describe their positive values explicitly. Real zeros remain in analysis, tables and chart; missing values remain missing. Text contains no sample/coverage boilerplate. Partial coverage and time limits are shown separately in the card states; copied fallback extrema are labeled “estremi parziali”. No “oggi”/“domani”, random synonyms, LLM, backend, framework or new runtime dependency is used.

A responsive weekly overview precedes the daily cards, with large icons, condition labels, max/min temperatures and native links to the corresponding dates. It shows only available forecast dates, never fills missing days, and updates only with a new atmospheric dataset. Cards retain one column and show prominent icons, dates and temperatures, with selectable forecast text outside `summary`. Copy is a small text action with a 44 px touch area. Coordinate/timezone/model/source metadata, provider extrema notes, coverage windows and chart explanations remain available in native disclosures; loading and search errors stay visible. The global detail preference defaults to Standard and uses optional `localStorage`; denied storage keeps a working in-memory preference. Changing detail updates only paragraphs. Each new atmospheric snapshot explicitly owns its analysis; enrichment of that same snapshot does not invalidate it. Cards are keyed by date, and enrichment changes only astronomy, marine cells and source states, retaining DOM nodes, text selection, focus, table/window scroll and details state. Copy includes only that day's text, active location, explicit date, current level and temperatures. Clipboard denial/unavailability exposes a labeled selectable textarea.

The chart occupies the available content width, keeps numeric UTC positions and actual forecast timestamps for ticks, and shows separate °C/% axes. Probability uses a dashed step series, with a note that the connection does not define its statistical interval. Missing values or unexplained holes interrupt the chart. Tables expose units and UTC offsets for duplicate local hours; `ResizeObserver` measures sticky columns on opening, resizing and marine-column changes. Astronomy has a compact visible summary and keyboard/touch-accessible detail, solely from Sunrise-Sunset v2.

## Browser validation

`npm test` requires no installed dependencies. Optional real-browser QA lives in `qa/browser.mjs`, outside the automatic Node test suite. Install Playwright and its browsers in a temporary folder, and obtain the **existing** Chart.js bundle for deterministic offline routing:

```bash
npm install --prefix /tmp/41weather-qa playwright
PLAYWRIGHT_BROWSERS_PATH=/tmp/41weather-qa/browsers /tmp/41weather-qa/node_modules/.bin/playwright install chromium webkit
curl -fLsS https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js -o /tmp/41weather-qa/chart.umd.js
PLAYWRIGHT_MODULE=/tmp/41weather-qa/node_modules/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/tmp/41weather-qa/browsers \
CHART_JS_FILE=/tmp/41weather-qa/chart.umd.js \
node qa/browser.mjs
```

Optionally set `CHROME_EXECUTABLE` to an installed Chrome executable and `QA_OUTPUT` to a screenshot output directory (default `/tmp/41weather-qa-results`). Tests use real browser rendering and actual Chart.js, deterministic intercepted API responses, the real Napoli fixture and explicitly synthetic added dates. Functional scenarios have two dates; visual scenarios use seven varied days to inspect the full weekly grid. They verify 320/390/768/1440 px, touch emulation and keyboard, weekly links without network/chart changes, collapsible metadata, prominent icons and usable copy targets, table confinement/sticky measurements, resize, node/focus/selection/scroll/open-state preservation, detail without network/new chart, persistence, denied storage/clipboard, date-isolated copy, optional failures and rapid searches with stale replies. They do not contact live APIs during the deterministic run. See [qa/RESULTS.md](qa/RESULTS.md) for the recorded results and limits.

Measured generator weight: **19,000 bytes source / 6,223 bytes gzip** (Node `gzipSync` defaults), within the initial target. The full recorded validation has **32 passing Node tests** plus real Chrome/WebKit QA; Safari itself, physical touch devices and screen readers were not audited.


## Themes, marine columns and the final forecast date

The header theme button switches between light and dark palettes. Initially it follows the system preference; an explicit choice is saved in optional `localStorage` (`41weather.theme`), with an in-memory fallback if storage is denied. The initial palette is applied before first paint. Without an explicit choice, system theme changes are followed. Chart lines, labels, axes and tooltips read the same palette tokens and update the existing Chart instance without refetching, reanalysis or card reconstruction. Marine columns use a separate teal background/text palette and a leading divider in both themes.

`visibleForecast()` is a pure display policy evaluated once per atmospheric dataset. It excludes **only the original final date** if it has fewer than 12 covered UTC hours or incomplete atmospheric data/stats. Covered hours are the sum of adjacent supported 1 h / 3 h timestamp intervals, with no extension after the last point: 13 hourly points or five three-hour points can cover exactly 12 hours; 12 hourly points cover 11. Holes, absent temperature/probability/wind/humidity/pressure, uninterpretable icons and fallback/missing daily extrema count as incomplete; absent direction is allowed for calm wind (≤2 km/h). Marine/astronomy availability has no effect. Earlier partial dates are retained.

The full normalized series remains intact for analysis and diagnostics. Daily cards, weekly grid/date range and chart consistently use the visible subset; the grid resizes to the remaining dates. If the only date is excluded, the page shows insufficient coverage and hides the empty chart. The forecast grammar itself is unchanged.
