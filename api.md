🌊 MeteoAM — API non ufficiale per i Meteograms

Scopo di questo documento
Questa pagina descrive il funzionamento dell’endpoint utilizzato dal sito MeteoAM.it (Servizio Meteorologico dell’Aeronautica Militare) per ottenere i dati meteo e mare dei meteograms.
Le informazioni sono state ottenute tramite analisi del traffico di rete del sito pubblico (nessuna autenticazione necessaria).

⚠️ Questa non è una API ufficialmente documentata.
È soggetta a modifiche e potrebbe non essere stabile nel tempo.

⸻

📌 Endpoint

GET https://api.meteoam.it/deda-meteograms/api/GetMeteogram/{preset}/{lat},{lon}

	•	{preset} → preset di dati (insieme di parametri)
	•	{lat},{lon} → coordinate geografiche in WGS84 (decimali)

Esempio:

curl -s "https://api.meteoam.it/deda-meteograms/api/GetMeteogram/preset1/41.894798,12.48534"


⸻

✅ Preset attualmente validi (scoperti tramite test)

Preset	Tipo di dati	Funziona su terra	Funziona su mare
preset1	🌦️ Meteo (temperatura, vento, pioggia, icona)	✅	✅
preset2	🌊 Mare/onde (altezza onda, periodo, vento, Beaufort)	❌	✅
altri (preset3, preset4, full, basic, daily, ecmwf, wam, icon_it)	non restituiscono dati	—	—

Nota: preset2 risponde solo se il punto è in mare.
Se usato sulla terra, ritorna timeseries: [].

⸻

🧠 Struttura della risposta

Esempio (ridotto):

{
  "timeseries": [
    "2025-11-01T00:00:00Z",
    "2025-11-01T01:00:00Z",
    ...
  ],
  "pointlist": [[41.894798, 12.48534]],
  "paramlist": ["2t","r","pmsl","tpp","wdir","wcar","wspd","wkmh","2tf","icon"],
  "datasets": {
    "0": {
      "0": { "0": 18, "1": 17, ... },
      "1": { "0": 74, "1": 75, ... },
      ...
    }
  },
  "extrainfo": {
    "timezone": "Europe/Rome",
    "models": {
      "cosmo_it": "2025103112",
      "ecmwf": "2025103112"
    },
    "stats": [
      {
        "localDate": "2025-11-01T00:00:00+01:00",
        "maxCelsius": 23,
        "minCelsius": 17,
        "icon": "07"
      }
    ]
  }
}


⸻

⏱ Timeseries
	•	Array di timestamp ISO (UTC).
	•	Per i primi ~3 giorni → step orario
	•	Oltre → step 3 ore

⸻

🧩 paramlist + datasets

paramlist contiene l’ordine delle variabili.
datasets contiene i valori veri e propri indicizzati così:

datasets["0"][ indexParametro ][ indexTimestamp ]
           ↑           ↑               ↑
         punto      come in        tempo (timeseries[i])
        (sempre 0)  paramlist

Esempio:

temperatura °C  → datasets["0"]["0"][i]    # se paramlist[0] == "2t"
prob. pioggia   → datasets["0"]["3"][i]    # se paramlist[3] == "tpp"
vento km/h      → datasets["0"]["7"][i]    # se paramlist[7] == "wkmh"


⸻

📦 Parametri osservati nei preset

✅ preset1 (meteo terra/mare)

Parametro	Significato
2t	Temperatura 2m (°C)
r	Umidità relativa (%)
pmsl	Pressione livello mare (hPa)
tpp	Probabilità precipitazione (%)
wdir	Direzione vento (°)
wcar	Direzione vento (testuale es. "N-NE")
wspd	Vento m/s
wkmh	Vento km/h
2tf	Temperatura (°F)
icon	Codice icona meteo (MeteoAM internal)

✅ preset2 (mare/onde — solo in mare)

Parametro	Significato
swh	Altezza d’onda significativa (m)
mwd	Direzione media onda (°)
mwp	Periodo medio onda (s)
pmsl	Pressione livello mare (hPa)
wdir	Direzione vento (°)
wcar	Direzione vento (testuale)
wspd	Vento m/s
wkmh	Vento km/h
icon	Codice fenomeno mare/vento
mcar	Direzione onda (cardinale)
wbeauf	Scala di Beaufort


⸻

🎨 Codici icona meteo (campo "icon" in preset1)

I codici icona seguono lo standard WWIS/WMO WxIcons_it.

Codice - Etichetta

01 - sole
02 - sole con nebbia
03 - sole con molta nebbia
04 - sole con nuvola
05 - sole con grande nuvola
06 - nuvola
07 - nuvola uguale
08 - nuvola con pioggerella
09 - nuvola con pioggia
10 - nuvola con temporale
11 -  nuvola con pioggia e neve
12 - nuvola con pioggia e grandine
13 - sole con nuvola e nebbia
14 - nuvola e nebbia
15 - nuvola e grandine 
16 - nuvola e neve
17 - Tromba d’aria
18 - Tempesta di polvere
19 - Tempesta di sabbia

31 - Luna
32 - Luna e nebbia
33 - Luna e molta nebbia
34 - Luna e nuvola
35 - Luna e nuvola grande
36 - Luna nuvola e nebbia


⸻

✅ Conversione a tabella (via jq)

Convertire in TSV leggibile

curl -s "https://api.meteoam.it/deda-meteograms/api/GetMeteogram/preset1/41.894798,12.48534" \
| jq -r '
  . as $r
  | (reduce range(0;($r.paramlist|length)) as $i ({}; . + {($r.paramlist[$i]):$i})) as $idx
  | ["time","temp_C","rain_%","wind_kmh","wind"] ,
    (range(0;($r.timeseries|length)) as $i
      | [
          $r.timeseries[$i],
          $r.datasets["0"][($idx."2t"|tostring)][$i],
          $r.datasets["0"][($idx.tpp|tostring)][$i],
          $r.datasets["0"][($idx.wkmh|tostring)][$i],
          $r.datasets["0"][($idx.wcar|tostring)][$i]
        ])
  | @tsv'


⸻

📚 Data usage notes
	•	Nessuna autenticazione richiesta
	•	Non c’è rate limit documentato
	•	È un endpoint pubblico ma non ufficiale
	•	Non usare per produzione senza fallback o caching

⸻

✅ Esempio minimo da usare in JS

const url = `https://api.meteoam.it/deda-meteograms/api/GetMeteogram/preset1/${lat},${lon}`;

const res = await fetch(url);
const json = await res.json();

console.log(json.timeseries.length, "timestamps");
console.log(json.paramlist);    // elenco parametri


⸻

💡 Best practices
	•	Cache locale (risposta cambia ogni 6/12h, in base al run del modello)
	•	Converti UTC → Europe/Rome usando la timezone in extrainfo.timezone
	•	Usa paramlist per leggere correttamente i dati da datasets

⸻

🏁 Conclusione

L’endpoint

/GetMeteogram/{preset}/{lat},{lon}

permette di ottenere meteogrammi sia meteo (preset1) sia mare (preset2) in formato machine-readable.
L’API è potente, facile da interrogare via curl/fetch, e adatta per widget, dashboard e automazione.