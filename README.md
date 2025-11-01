# 41weather

41weather is a lightweight client-side weather viewer that combines the public MeteoAM meteogram endpoint with Open-Meteo geocoding. It ships as a static HTML/CSS/JS bundle and renders interactive daily summaries and an hourly chart with Chart.js.

## Features
- Location search powered by the Open-Meteo geocoding API, with a quick shortcut to Pesaro.
- Fetches detailed hourly forecasts from MeteoAM (preset1) and groups them into expandable daily summaries.
- Responsive UI with a combined temperature/rainfall chart, weather icons, and key metadata (timezone, elevation).
- Zero-build setup: just serve the static files and the app runs in modern browsers.

## Project Structure
- `index.html` – main page markup and script includes.
- `styles.css` – dark theme styling for layout, cards, tables, and responsive tweaks.
- `app.js` – application logic (API calls, data aggregation, rendering).
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
3. Use the search box to find a city or click `Pesaro` for the default location.

> Note: Directly opening the HTML file from disk (`file://`) may block `fetch` in some browsers. Prefer a local server.

## APIs Used
- **MeteoAM meteograms** (`https://api.meteoam.it/deda-meteograms/api/GetMeteogram/preset1/{lat},{lon}`) – hourly atmospheric parameters and daily stats.
- **Open-Meteo Geocoding** (`https://geocoding-api.open-meteo.com/v1/search`) – translates user queries into coordinates and timezone data.

See `api.md` for the detailed reverse-engineering notes captured during development.

## Dependencies
- Runtime: [Chart.js 4](https://www.chartjs.org/) (loaded from CDN).
- Browser: modern ES modules/Fetch/DOM support (tested in recent Chromium/WebKit browsers).

## Development Notes
- `app.js` keeps UI state in a single `state` object. Re-rendering daily cards updates the expanded day without a framework.
- Weather icons are generated on the fly by mapping MeteoAM codes to emoji and inlining them as SVG data URIs.

## License
Released under the [MIT License](LICENSE).
