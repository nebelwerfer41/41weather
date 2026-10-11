# Validation — 11 October 2026

Base verified twice: PR #1 remains open at `186ac92b9a6e4012c115c43bfc8a29aebfbded89`. `feat/forecast-text` derives from its head, with `fix/forecast-data-and-astronomy` as PR base. No `AGENTS.md` was found in the repository or parent chain.

## Executed checks

- `npm test`: **32 passed**, including the original 7 regressions. Pure analysis/rendering tests cover unknown/missing/zero values, significant phenomena and probability disagreement, sustained vs isolated sky changes, observed pauses vs holes, mixed resolutions, midnight, truncated coverage, 23/25-hour days, fractional zones, circular/calm/absent wind, configurable rules, determinism and no snapshot mutation. Editorial regression tests enforce deduplicated veils, no sample boilerplate, no zero probabilities in prose, positive fractional probabilities without rounding to zero, and direct phenomenon names grouped only when time/intermittency/probability qualifications match.
- `node --check` for changed JavaScript modules and QA script; `git diff --check` passed.
- `qa/browser.mjs`: **passed in Chrome 155.0.8059.40 and Playwright WebKit 27.2** on macOS. Real HTML/CSS layout, native details and actual Chart.js 4.4.1, with deterministic intercepted provider responses.
- Widths **320, 390, 768, 1440 px**, including a 1440→320 resize. No page-wide horizontal overflow; tables retain their own horizontal scrolling; sticky offsets match measured column widths after resize/opening/marine enrichment. Text is selectable outside the clickable summary, and the chart uses the available content width.
- Keyboard Enter/Space opens details; mobile contexts use emulated touch taps. Focus outlines are visible. Full-page detail screenshots and viewport weekly-overview screenshots were generated in both browsers at all four widths. Representative screenshots inspected visually: Chrome 390/1440 and WebKit 320/1440. Committed weekly views: [WebKit 390 px](evidence/week-webkit-390.png) and [Chrome 1440 px](evidence/week-chromium-1440.png). Light-theme views: [Chrome 1440 px](evidence/week-light-chromium-1440.png), [WebKit 390 px](evidence/week-light-webkit-390.png), [marine columns](evidence/marine-light-webkit-390.png). Full detail views: [WebKit 320 px](evidence/webkit-320.png) and [Chrome 1440 px](evidence/chromium-1440.png).
- The six-day visible overview (seven supplied dates, incomplete final date excluded) keeps all tiles inside its container at every width, and prominent day/week icons remain readable. Week links jump to the correct date without fetching or creating a Chart; hidden technical metadata is accessible on opening its disclosure, and the small copy action and detail selector retain a 44 px touch target in both browsers.
- Enrichments preserve week-link/card/paragraph/row identity, focus, selection, window/table scroll and open state in the controlled scenario. Four detail levels preserve the number of fetches and Chart instances. Preference survives reload; denied storage works in memory.
- Copy includes the active location, current level, temperatures and only the selected date. Both denied and absent Clipboard APIs produce a focused, selectable manual fallback. Failed optional HTTP services leave forecasts usable. Rapid searches, delayed geocoding, stale astronomy and failed/no-coverage searches preserve the latest committed location and URL.

A real public MeteoAM Napoli payload was acquired on 2026-10-11. The committed fixture preserves 12 consecutive UTC samples, daily stats and model runs, including positive probabilities. Functional browser scenarios use that fixture and an explicitly synthetic repeated second day; the visual scenario supplies the real first day plus six synthetic dates with varied weather icons; the final short date is excluded, leaving six displayed days. Synthetic middle dates have 13 hourly points (12 elapsed hours). Astronomy/marine responses are synthetic so failures and delays are reproducible.

## Measured weight and contrast

`forecast-text.js`: **19,000 bytes source**, **6,223 bytes gzip** using Node `gzipSync` defaults. This is within the ≤30 kB source / approximately 5–10 kB gzip target. No runtime dependency was added; Playwright/browser downloads and the test Chart.js copy are in temporary QA storage only.

Contrast ratios against the card surface `#111a2b`, computed from sRGB relative luminance:

| Token / pairing | Ratio |
| --- | ---: |
| Main text | 14.95:1 |
| Muted text | 8.50:1 |
| Accent text | 7.05:1 |
| Temperature text | 11.67:1 |
| Button text on accent | 7.54:1 |
| Focus outline on raised surface | 10.00:1 |

## Scope and remaining limits

WebKit was tested as Playwright WebKit, **not the Safari application**. Touch was emulated, not tested on physical iOS/Android devices. No screen-reader audit was performed. The deterministic browser suite does not verify current API uptime/CORS; the real forecast fixture was obtained over HTTP separately. Both light and dark themes are checked at 320/390/768/1440 px, including theme persistence, denied storage, system preference changes, palette changes on the existing Chart and distinct marine column backgrounds. Missing/short final dates disappear consistently from cards, grid, date range and chart; an excluded sole date produces a usable empty state. Browser screenshots are QA evidence, not images generated from a DOM simulation.

The probability interval remains undocumented by the provider. Prose reports model indications, never official alerts, gusts, amounts or daily risk. Numeric zeros and nulls remain distinct even though zero probabilities are omitted from prose. Sample resolution does not prove continuity; no event is extended beyond its last point. Detailed time windows identify the model's indicated times rather than exact onset/cessation. Secondary supported sky changes remain in diagnostics but at most one increase and one clearing are selected for brevity. Atmospheric partial-period labels and provider stats notes are separate from the generated text, available in hourly details; fallback temperatures remain visibly labeled “estremi parziali” / “parziali”. Coordinate/timezone/run/source metadata and chart explanations are closed by default; loading and search errors remain visible.

Reproduce with the temporary-install commands in README. Screenshots are written to `QA_OUTPUT` (default `/tmp/41weather-qa-results`).


Additional contrast measurements for the light palette (on white unless specified): main text 15.25:1, muted text 6.44:1, accent 6.13:1, temperature 5.31:1. Marine text is 6.18:1 on the light marine body and 5.47:1 on its header; dark marine text is 9.07:1 on its body and 7.41:1 on its header.
