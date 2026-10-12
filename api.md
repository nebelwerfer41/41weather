# Contratti API utilizzati da 41weather

Verifica: 11 ottobre 2026, risposte live e client pubblico MeteoAM. L'endpoint MeteoAM non ha un contratto pubblico versionato: la normalizzazione è isolata in `meteoam-data.js`.

## MeteoAM

`GET https://api.meteoam.it/deda-meteograms/api/GetMeteogram/{preset}/{lat},{lon}`

- `preset1`: dati atmosferici; `preset2`: mare. Su punti terrestri preset2 può rispondere HTTP 200 con `timeseries: []` e `datasets: {}`: significa dati non disponibili, non mare calmo.
- I valori sono in `datasets["0"][String(paramlist.indexOf(parameter))][String(timeIndex)]`.
- `timeseries` contiene istanti ISO UTC. La risoluzione può passare da un'ora a tre ore; non assumere durata o numerosità costante. Il grafico usa gli istanti reali.
- Il fuso valido di `extrainfo.timezone` precede quello del geocoder; fallback UTC. Le date delle schede sono locali, gli abbinamenti meteo/mare usano istanti UTC numerici.
- `extrainfo.stats` contiene estremi e icona per `localDate`. In assenza di estremi validi si usano quelli dei campioni disponibili, con indicazione esplicita; non si tratta necessariamente di una giornata completa.
- `extrainfo.models` identifica i run; l'ora di acquisizione del client viene mostrata separatamente.

| Parametro | Significato | Utilizzo |
|---|---|---|
| `2t` | Temperatura a 2 m, °C | Tabella, grafico |
| `r` | Umidità relativa, % | Tabella |
| `pmsl` | Pressione al livello del mare, hPa | Tabella |
| `tpp` | Probabilità di precipitazione, % | Tabella, grafico; nessuna somma giornaliera |
| `wkmh` | Velocità del vento, km/h | Fonte preferita |
| `wspd` | Velocità del vento, nodi | Fallback: moltiplicare per 1,852 |
| `wdir`, `wcar` | Direzione del vento in gradi/cardinale | Direzione |
| `2tf` | Temperatura °F | Non utilizzato |
| `icon` | Codice condizione | Solo namespace atmosferico preset1 |
| `swh` | Altezza significativa delle onde, m | Preset2 |
| `mwp` | Periodo medio delle onde, s | Preset2 |
| `mwd`, `mcar` | Direzione media delle onde | Preset2 |
| `wbeauf` | Beaufort | Preset2 |

`tpp` non è una quantità in mm. Il periodo cui si riferisce la probabilità non è specificato dal payload: non assumere che sia una probabilità oraria. `wspd` non è una raffica; il preset non fornisce un parametro raffica. `null`, stringhe vuote, `-`, booleani e numeri non finiti non devono diventare zero.

### Icone atmosferiche

| Codici | Condizione |
|---|---|
| 01 / 31 | Sereno, giorno / notte |
| 02 / 32 | Parzialmente velato, giorno / notte |
| 03 / 33 | Velato, giorno / notte |
| 04 / 34 | Poco nuvoloso, giorno / notte |
| 05 / 35 | Molto nuvoloso, giorno / notte |
| 06 / 07 | Coperto |
| 08 | Pioggia debole |
| 09 | Pioggia forte |
| 10 | Temporale |
| 11 | Pioggia e neve |
| 12 | Pioggia congelantesi |
| 13 / 36 | Foschia, giorno / notte |
| 14 | Nebbia |
| 15 | Grandine |
| 16 | Neve |
| 17 | Tromba d'aria o marina |
| 18 | Fumo |
| 19 | Tempesta di sabbia |

Verifiche sul client del fornitore: [rendering probabilità](https://www-static.meteoam.it/675/8207.bundle.js), componente `MeteogramInfoList` per le unità del vento e legenda/asset del [sito MeteoAM](https://www.meteoam.it/). I codici marini non vengono interpretati con questa tabella.

## Sunrise-Sunset v2: unica fonte astronomica

[Documentazione ufficiale](https://sunrise-sunset.org/api).

`GET https://api.sunrise-sunset.org/v2?lat=…&lng=…&tz=Europe%2FRome&date_start=YYYY-MM-DD&date_end=YYYY-MM-DD`

Una richiesta copre le date del forecast. Il risultato contiene `days`, con `date`, `sunrise`, `sunset`, crepuscoli civili/nautici/astronomici, `moonrise`, `moonset`, `moon_phase`, `moon_illumination`. Gli eventi sono timestamp ISO con offset; alcuni possono essere null, ad esempio nelle regioni polari. Il formato singolo giorno è supportato dal normalizzatore.

La fase e l'illuminazione (0–100 %) sono riferite al **mezzogiorno locale**. Sono supportate tutte le otto fasi; non si deduce l'istante esatto di un evento primario dalle transizioni giornaliere. USNO è stato rimosso. Se v2 fallisce, la previsione meteo resta disponibile e l'astronomia è marcata non disponibile.

Cache astronomica e geocoding: memoria della pagina, 24 ore, massimo 64 URL. Le richieste hanno timeout di 15 secondi; HTTP non riusciti (incluso 429) non vengono ritentati automaticamente né memorizzati. Una nuova ricerca annulla quella precedente.

## Open-Meteo geocoding

[Documentazione ufficiale](https://open-meteo.com/en/docs/geocoding-api).

`GET https://geocoding-api.open-meteo.com/v1/search?name=…&count=5&language=it&format=json`

Si conserva il comportamento esistente: selezione del primo risultato. Nome, coordinate e fuso vengono trasferiti al forecast; l'URL della pagina viene aggiornato solo dopo il caricamento riuscito dei dati atmosferici.

## Atmospheric editorial analysis

`forecast-text.js` consumes only the normalized snapshot; it does not reinterpret raw API indices. The icon catalog now carries sky rank (when documented), veils/obscuration, phenomenon and day/night variant while preserving `icon()`'s emoji/label pair. Daily stats icons remain provider summaries and are not used to infer hourly evolution.

Hourly probability is kept separate from phenomena and data coverage. Editorial thresholds and temporal rules are documented in README. Positive probabilities alone only name generic precipitation. Zero is retained in data and numeric views but omitted from generated prose. No daily probability, accumulation, gust or statistical interval is inferred. The detailed positive range is explicitly labeled positive if zero-valued hours also occur in that band. Diagnostics retain the complete evidence, including zeros and nulls.

The real regression fixture `tests/fixtures/napoli-real.json` records 12 original consecutive UTC samples from preset1 at 40.8518,14.2681, acquired on 2026-10-11, including nonzero `tpp` values and unchanged daily stats/model runs. Its source URL and reduction are recorded alongside the payload.

The final-date display policy does not change the provider contract or mutate normalized values. It filters only the visible cards/grid/chart, using at least 12 elapsed supported UTC hours and complete atmospheric fields/stats; optional marine/astronomy values are excluded from this decision. Full data and generator evidence remain available internally.
