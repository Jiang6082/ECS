# Custom-ATS watch

Some econ-consulting firms post roles on systems the Node scanner can't enumerate:
Avature (Deloitte), Radancy/Phenom front-ends (Mathematica, Moody's, Cencora, Thermo Fisher),
viRecruit (Bates White), GoHire, Taleo, or simply a list on their own website
(many boutiques: IEc, QES, Vega, Epsilon, GMA, Lear, CEPA, …).

Instead of brittle private-API reversing, a browser agent renders each site and records
what it sees.

## What runs

For each entry in `watchlist.json`:

1. Open `url` in a browser (renders JS, passes basic anti-bot).
2. Read role text from every element matching `selector` (title, location, link).
3. Write `snapshots/<key>.json`:

   ```json
   { "key": "bates-white", "firm": "Bates White", "capturedAt": "2026-09-27",
     "roles": [ { "title": "Summer Consultant", "location": "Washington, DC", "url": "https://..." } ] }
   ```

4. The next `npm run scan:v2` / `scan:all` folds snapshot roles into the report through the
   same role filter (`scope` in the watchlist narrows multi-practice firms to economics roles).

If a site is unreachable that day, skip it and leave its snapshot untouched — do not blank it.
Firms on the watchlist without a snapshot are reported as **could not fully verify**, never as
"no roles".

Firms that turn out to be scriptable should move into `inputs/ats_seeds.json` instead.
