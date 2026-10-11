[Catalog](https://nebelwerfer41.github.io/) · [Repository](https://github.com/nebelwerfer41/41weather)

# 41weather

41weather is a lightweight client-side weather viewer that combines the public MeteoAM meteogram endpoint with Open-Meteo geocoding. It ships as a static HTML/CSS/JS bundle and renders interactive daily summaries (with sunrise/sunset and lunar phases) plus an hourly chart with Chart.js.

## Features
- Location search powered by the Open-Meteo geocoding API, with a quick shortcut to Roma.
- Fetches detailed hourly forecasts from MeteoAM (preset1) and groups them into expandable daily summaries.
- When a coastal/offshore point is selected, augments the hourly table with marine data (preset2) in the same rows while hiding those columns for inland locations.
- Shows sunrise/sunset times with hover/tap tooltip for civil, nautical, and astronomical twilight; shows all eight daily lunar phases, illumination, moonrise and moonset from Sunrise-Sunset v2.
- Responsive UI with a combined temperature/precipitation-probability chart, weather icons, and key metadata (timezone, elevation).
- Weather icons ship with descriptive alt/title text for accessibility and quick hover hints.
- Zero-build setup: just serve the static files and the app runs in modern browsers.

## Project Structure
- `index.html` – main page markup and script includes.
- `styles.css` – dark theme styling for layout, cards, tables, and responsive tweaks.
- `app.js` – request coordination and consistent location updates.
- `services.js` – provider requests, cancellation, deadlines and bounded cache.
- `meteoam-data.js` – pure provider normalization, units, local dates and missing values.
- `ui.js` – daily cards, hourly tables and time-based chart.
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
