# Validation — 11 October 2026

Base verified twice: PR #1 remains open at `186ac92b9a6e4012c115c43bfc8a29aebfbded89`. `feat/forecast-text` derives from its head, with `fix/forecast-data-and-astronomy` as PR base. No `AGENTS.md` was found in the repository or parent chain.

## Executed checks

- `npm test`: **29 passed**, including the original 7 regressions. Pure analysis/rendering tests cover unknown/missing/zero values, significant phenomena and probability disagreement, sustained vs isolated sky changes, observed pauses vs holes, mixed resolutions, midnight, truncated coverage, 23/25-hour days, fractional zones, circular/calm/absent wind, configurable rules, determinism and no snapshot mutation. Editorial regression tests enforce deduplicated veils, no sample boilerplate, no zero probabilities in prose, positive fractional probabilities without rounding to zero, and direct phenomenon names grouped only when time/intermittency/probability qualifications match.
- `node --check` for changed JavaScript modules and QA script; `git diff --check` passed.
- `qa/browser.mjs`: **passed in Chrome 155.0.8059.40 and Playwright WebKit 27.2** on macOS. Real HTML/CSS layout, native details and actual Chart.js 4.4.1, with deterministic intercepted provider responses.
- Widths **320, 390, 768, 1440 px**, including a 1440→320 resize. No page-wide horizontal overflow; tables retain their own horizontal scrolling; sticky offsets match measured column widths after resize/opening/marine enrichment. Text is selectable outside the clickable summary, and the chart uses the available content width.
- Keyboard Enter/Space opens details; mobile contexts use emulated touch taps. Focus outlines are visible. All eight full-page browser screenshots were generated. Representative screenshots inspected visually: Chrome 390/1440 and WebKit 320/1440. Committed examples: [WebKit 320 px](evidence/webkit-320.png) and [Chrome 1440 px](evidence/chromium-1440.png).
- Enrichments preserve card/paragraph/row identity, focus, selection, window/table scroll and open state in the controlled scenario. Four detail levels preserve the number of fetches and Chart instances. Preference survives reload; denied storage works in memory.
- Copy includes the active location, current level, temperatures and only the selected date. Both denied and absent Clipboard APIs produce a focused, selectable manual fallback. Failed optional HTTP services leave forecasts usable. Rapid searches, delayed geocoding, stale astronomy and failed/no-coverage searches preserve the latest committed location and URL.

A real public MeteoAM Napoli payload was acquired on 2026-10-11. The committed fixture preserves 12 consecutive UTC samples, daily stats and model runs, including positive probabilities. Browser scenarios use that fixture and an explicitly synthetic repeated second day; astronomy/marine responses are synthetic so failures and delays are reproducible.

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

WebKit was tested as Playwright WebKit, **not the Safari application**. Touch was emulated, not tested on physical iOS/Android devices. No screen-reader audit was performed. The deterministic browser suite does not verify current API uptime/CORS; the real forecast fixture was obtained over HTTP separately. Browser screenshots are QA evidence, not images generated from a DOM simulation.

The probability interval remains undocumented by the provider. Prose reports model indications, never official alerts, gusts, amounts or daily risk. Numeric zeros and nulls remain distinct even though zero probabilities are omitted from prose. Sample resolution does not prove continuity; no event is extended beyond its last point. Detailed time windows identify the model's indicated times rather than exact onset/cessation. Secondary supported sky changes remain in diagnostics but at most one increase and one clearing are selected for brevity. Atmospheric partial-period labels are separate from the generated text, and fallback temperatures are labeled “estremi parziali”.

Reproduce with the temporary-install commands in README. Screenshots are written to `QA_OUTPUT` (default `/tmp/41weather-qa-results`).
