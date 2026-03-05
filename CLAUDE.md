# NEA Rain Monitor — Claude Code Master Prompt

## Project Overview

Build a full-stack rain monitoring application deployed entirely on Cloudflare's free tier. The app monitors rainfall over a specific geographic region near Changi, Singapore, by polling NEA (National Environment Agency) data sources every 5 minutes. When rain is detected, it captures the radar image, stores it, and sends a Telegram alert.

**Stack:** Cloudflare Workers (TypeScript) + D1 (SQLite) + R2 (Object Storage) + Pages (React frontend)

**No external databases, no Docker, no traditional servers.**

---

## Architecture

### Entry Points

The Worker has two entry points in a single codebase:

1. **Cron Trigger** (`scheduled` event) — fires every 5 minutes, runs the automated rain check loop
2. **HTTP Handler** (`fetch` event) — serves API endpoints for the frontend

Both entry points share the same service layer. The cron handler and the manual "Check Now" API endpoint both call the same `fullCheck()` function. There must be ONE code path for rain detection, never two.

### Detection Pipeline

Every 5 minutes:

1. Fetch real-time rainfall from `https://api.data.gov.sg/v1/environment/rainfall`
2. Filter ~60 stations down to those inside the target polygon OR within configurable radius of the center point
3. Fetch the latest radar PNG from `https://www.weather.gov.sg/files/rainarea/50km/v2/dpsri_70km_{timestamp}0000dBR.dpsri.png`
4. Rain decision: if ANY nearby station reports rainfall_mm > 0, OR the radar image file size exceeds a clear-sky threshold (~15KB for empty images), rain is detected
5. If raining: store radar PNG in R2, record metadata in D1, send Telegram alert (if cooldown elapsed)
6. If not raining: optionally log a dry reading

### Target Region Coordinates

These are fixed requirements from the client. They must be the defaults but also overridable at runtime via the settings table.

```
Centre: 1.354829, 103.990242

Polygon vertices (4 points forming a diamond):
  (1.342303, 103.974133)
  (1.332562, 103.997088)
  (1.370897, 103.985884)
  (1.364491, 104.009104)

Default station search radius: 5.0 km
```

### Radar Image URL Pattern

NEA publishes radar overlays at 5-minute intervals. The URL pattern is:

```
https://www.weather.gov.sg/files/rainarea/50km/v2/dpsri_70km_{YYYYMMDDHHmm}000000dBR.dpsri.png
```

Where the timestamp is rounded down to the nearest 5 minutes. When fetching, try the current rounded time first, then go back in 5-minute increments up to 30 minutes until a valid image is returned (HTTP 200, content length > 1000 bytes).

### Radar Image Bounds (for pixel analysis)

The 70km radar composite covers approximately:
- North: 1.4895°N
- South: 1.1560°N
- West: 103.5650°E
- East: 104.1310°E
- Image dimensions: ~480 × 480 pixels

To map a geographic coordinate to a pixel position:
```
px = Math.floor((lng - 103.5650) / (104.1310 - 103.5650) * width)
py = Math.floor((1.4895 - lat) / (1.4895 - 1.1560) * height)
```

---

## Project Structure

```
nea-rain-monitor/
├── worker/
│   ├── src/
│   │   ├── index.ts                 # Entry: scheduled + fetch handlers
│   │   ├── config.ts                # Type definitions, defaults, env parsing
│   │   ├── services/
│   │   │   ├── nea-client.ts        # Fetch rainfall API + radar PNGs
│   │   │   ├── rain-detector.ts     # Station filtering + rain decision logic
│   │   │   ├── capture-svc.ts       # R2 storage + D1 capture records
│   │   │   └── alert-svc.ts         # Telegram dispatch + cooldown
│   │   ├── routes/
│   │   │   ├── router.ts            # Simple path-based router
│   │   │   ├── rainfall.ts          # /api/rainfall/* handlers
│   │   │   ├── captures.ts          # /api/captures/* handlers
│   │   │   ├── summary.ts           # /api/summary/* handlers
│   │   │   ├── alerts.ts            # /api/alerts/* handlers
│   │   │   └── settings.ts          # /api/settings/* handlers
│   │   └── utils/
│   │       ├── geo.ts               # Haversine distance, point-in-polygon
│   │       └── file-naming.ts       # Token-based filename expansion
│   ├── schema.sql                   # D1 table definitions
│   ├── wrangler.toml                # Cloudflare bindings + cron config
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Root with routing
│   │   ├── main.tsx                 # React entry
│   │   ├── api/
│   │   │   └── client.ts           # Fetch wrapper for /api/* calls
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx        # Live status, nearby stations, check now
│   │   │   ├── History.tsx          # Monthly summary with daily breakdown
│   │   │   ├── Captures.tsx         # Gallery of saved radar images
│   │   │   └── Settings.tsx         # Config editor + alert log
│   │   ├── components/
│   │   │   ├── Layout.tsx           # Nav sidebar/header + page container
│   │   │   ├── StationTable.tsx     # Reusable station readings table
│   │   │   ├── RainBar.tsx          # Horizontal bar for daily rain visualization
│   │   │   └── StatusBadge.tsx      # Running/stopped/rain indicator
│   │   └── hooks/
│   │       └── useApi.ts            # Generic fetch hook with loading/error
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── package.json
│   └── tsconfig.json
│
└── README.md
```

---

## Cloudflare Configuration

### wrangler.toml

```toml
name = "nea-rain-monitor"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[triggers]
crons = ["*/5 * * * *"]

[[d1_databases]]
binding = "DB"
database_name = "rain-monitor-db"
database_id = "<FILLED_AFTER_CREATION>"

[[r2_buckets]]
binding = "CAPTURES"
bucket_name = "rain-captures"

[vars]
REGION_CENTER_LAT = "1.354829"
REGION_CENTER_LNG = "103.990242"
REGION_POLYGON = "1.342303,103.974133;1.332562,103.997088;1.364491,104.009104;1.370897,103.985884"
STATION_RADIUS_KM = "5.0"
MIN_RAINFALL_MM = "0.0"
CAPTURE_FILE_PATTERN = "{year}{month}{day}_{hour}{minute}_rain"
ALERT_COOLDOWN_MIN = "30"
RADAR_CLEAR_SIZE_THRESHOLD = "15000"

# Secrets (set via `wrangler secret put`):
# TELEGRAM_BOT_TOKEN
# TELEGRAM_CHAT_ID
```

### Env Type Definition (config.ts)

```typescript
export interface Env {
  // Cloudflare bindings
  DB: D1Database;
  CAPTURES: R2Bucket;

  // Region config
  REGION_CENTER_LAT: string;
  REGION_CENTER_LNG: string;
  REGION_POLYGON: string;
  STATION_RADIUS_KM: string;
  MIN_RAINFALL_MM: string;

  // Capture config
  CAPTURE_FILE_PATTERN: string;

  // Alert config
  ALERT_COOLDOWN_MIN: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;

  // Radar config
  RADAR_CLEAR_SIZE_THRESHOLD: string;
}

export interface RegionConfig {
  center: { lat: number; lng: number };
  polygon: [number, number][];
  radiusKm: number;
  minRainfallMm: number;
}

export function parseRegionConfig(env: Env): RegionConfig {
  // Parse REGION_POLYGON from "lat,lng;lat,lng;..." format
  // Return typed config object with numeric values
}
```

---

## D1 Database Schema (schema.sql)

```sql
-- Rain event captures
CREATE TABLE IF NOT EXISTS captures (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    checked_at  TEXT NOT NULL,
    is_raining  INTEGER NOT NULL DEFAULT 0,
    max_mm      REAL NOT NULL DEFAULT 0,
    stations    TEXT,
    radar_key   TEXT,
    radar_bytes INTEGER DEFAULT 0,
    alert_sent  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_captures_checked ON captures(checked_at);
CREATE INDEX IF NOT EXISTS idx_captures_raining ON captures(is_raining);

-- Alert audit log
CREATE TABLE IF NOT EXISTS alert_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sent_at     TEXT NOT NULL,
    channel     TEXT NOT NULL DEFAULT 'telegram',
    rainfall_mm REAL DEFAULT 0,
    message     TEXT,
    success     INTEGER NOT NULL DEFAULT 1,
    error       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_sent ON alert_logs(sent_at);

-- Runtime settings (overrides env vars)
CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Service Implementations

### nea-client.ts

Two functions:

**fetchRainfall()**
- GET `https://api.data.gov.sg/v1/environment/rainfall`
- Timeout: 15 seconds
- Parse the v1 response format:
  - `data.metadata.stations` → array of station metadata (id, name, location.latitude, location.longitude)
  - `data.items[0].readings` → array of { station_id, value }
  - `data.items[0].timestamp` → API timestamp string
- Merge metadata + readings into a flat array:
  ```typescript
  interface StationReading {
    stationId: string;
    name: string;
    lat: number;
    lng: number;
    rainfallMm: number;
  }
  ```
- If the API fails, return `{ stations: [], timestamp: "", error: string }`
- **Do NOT retry on failure.** The cron runs every 5 minutes anyway. Just log and return empty.

**fetchRadarImage()**
- Build URL from current time, rounded down to nearest 5 minutes
- Try offsets: 0, 5, 10, 15, 20, 25, 30 minutes back
- For each: GET the URL, check for HTTP 200 and content-length > 1000
- Return `{ imageBytes: ArrayBuffer | null, timestamp: Date }`
- Stop on first successful fetch

### rain-detector.ts

**filterNearbyStations(stations, regionConfig)**
- For each station, run two checks:
  - `pointInPolygon(station.lat, station.lng, regionConfig.polygon)` → boolean
  - `haversine(regionConfig.center, station) <= regionConfig.radiusKm` → boolean
- Keep station if EITHER test passes
- Augment each kept station with `distanceKm` and `inPolygon` fields

**fullCheck(env)**
- This is the single orchestration function called by BOTH the cron and the manual API
- Steps:
  1. Call `fetchRainfall()` → get stations
  2. Call `filterNearbyStations()` → get nearby
  3. Check if any nearby station has `rainfallMm > env.MIN_RAINFALL_MM`
  4. Call `fetchRadarImage()` → get PNG bytes
  5. Backup check: if image bytes exist, compare size to `RADAR_CLEAR_SIZE_THRESHOLD`
  6. Rain = station check OR size check
  7. Return result object (do NOT save or alert here — the caller decides):
  ```typescript
  interface CheckResult {
    isRaining: boolean;
    maxRainfallMm: number;
    nearbyStations: NearbyStation[];
    rainingStations: NearbyStation[];
    radarImage: ArrayBuffer | null;
    radarTimestamp: string | null;
    apiTimestamp: string;
  }
  ```

### capture-svc.ts

**buildR2Key(pattern, timestamp)**
- Expand tokens: `{year}`, `{month}`, `{day}`, `{hour}`, `{minute}`, `{second}`, `{date}`, `{time}`, `{datetime}`
- Prepend year/month folder: `2026/03/{expanded_pattern}_radar.png`
- Return the full R2 key string

**saveCapture(env, checkResult)**
- First, check the settings table for a custom file pattern (fall back to env var)
- Build the R2 key using the pattern
- PUT the radar image bytes into R2:
  ```typescript
  await env.CAPTURES.put(r2Key, checkResult.radarImage, {
    httpMetadata: { contentType: "image/png" },
    customMetadata: {
      maxMm: String(checkResult.maxRainfallMm),
      stations: String(checkResult.rainingStations.length),
    },
  });
  ```
- INSERT a row into the captures table:
  ```sql
  INSERT INTO captures (checked_at, is_raining, max_mm, stations, radar_key, radar_bytes, alert_sent)
  VALUES (?, 1, ?, ?, ?, ?, ?)
  ```
  - `stations` column: `JSON.stringify(checkResult.rainingStations)`
- Return the capture ID and R2 key

### alert-svc.ts

**checkCooldown(db, cooldownMin)**
- Query: `SELECT sent_at FROM alert_logs WHERE channel = 'telegram' AND success = 1 ORDER BY sent_at DESC LIMIT 1`
- If no result, return true (OK to send)
- If last sent_at is more than `cooldownMin` minutes ago, return true
- Otherwise return false

**sendTelegramAlert(env, checkResult)**
- If `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is not set, return silently
- Check cooldown. If cooldown active, return silently
- Build message:
  ```
  🌧️ Rain Detected

  Max rainfall: {max_mm}mm
  Stations reporting rain:
    • {station_name}: {rainfall_mm}mm ({distance_km}km away)
    • ...

  {timestamp in SGT}
  ```
- POST to `https://api.telegram.org/bot{TOKEN}/sendMessage` with:
  ```json
  { "chat_id": CHAT_ID, "text": message, "parse_mode": "Markdown" }
  ```
- Log result to alert_logs table (success or failure with error detail)

---

## Route Handlers

### Router Pattern

Use a simple path-matching router. No external routing library needed for Workers.

```typescript
// router.ts
type Handler = (req: Request, env: Env, params?: Record<string, string>) => Promise<Response>;

interface Route {
  method: string;
  pattern: string;
  handler: Handler;
}

export function createRouter(routes: Route[]) {
  return async (req: Request, env: Env): Promise<Response> => {
    const url = new URL(req.url);
    const method = req.method;

    for (const route of routes) {
      if (route.method === method && matchPath(url.pathname, route.pattern)) {
        // Extract params, call handler, wrap in try/catch
        // Return JSON responses with proper CORS headers
      }
    }

    return new Response("Not Found", { status: 404 });
  };
}
```

All API responses must include CORS headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

Handle OPTIONS preflight requests globally.

### API Endpoints

**GET /api/rainfall/stations**
- Call `fetchRainfall()` + `filterNearbyStations()`
- Return: `{ stations: NearbyStation[], apiTimestamp: string }`

**POST /api/rainfall/check**
- Call `fullCheck(env)`
- If raining: call `saveCapture()` + `sendTelegramAlert()`
- Return full result including whether capture was saved and alert sent

**GET /api/captures?limit=50&offset=0**
- Query D1: `SELECT * FROM captures WHERE is_raining = 1 ORDER BY checked_at DESC LIMIT ? OFFSET ?`
- Also: `SELECT COUNT(*) FROM captures WHERE is_raining = 1` for total
- Return: `{ total, captures: [...] }`

**GET /api/captures/:id/image**
- Look up capture by ID in D1 to get `radar_key`
- Fetch from R2: `await env.CAPTURES.get(radar_key)`
- Return the PNG bytes with `Content-Type: image/png`
- If not found, return 404

**GET /api/summary/monthly?year=2026&month=3**
- Query D1:
  ```sql
  SELECT
    DATE(checked_at) AS day,
    COUNT(*) AS captures,
    MAX(max_mm) AS peak_mm
  FROM captures
  WHERE is_raining = 1
    AND checked_at >= '{year}-{month}-01'
    AND checked_at < '{next_month_start}'
  GROUP BY DATE(checked_at)
  ORDER BY day
  ```
- Read check interval from settings (default 5)
- Calculate rain_hours per day: `captures * interval / 60`
- Calculate totals
- Return:
  ```json
  {
    "year": 2026, "month": 3,
    "checkIntervalMin": 5,
    "totalCaptures": 142,
    "estimatedRainHours": 11.83,
    "rainDays": 18,
    "daily": [
      { "date": "2026-03-01", "captures": 8, "rainHours": 0.67, "peakMm": 3.2 },
      ...
    ]
  }
  ```

**GET /api/alerts/log?limit=20**
- Query D1: `SELECT * FROM alert_logs ORDER BY sent_at DESC LIMIT ?`
- Return array of alert records

**GET /api/settings**
- Query D1: `SELECT * FROM settings`
- Merge with env var defaults (settings table overrides env vars)
- Return as key-value object

**PUT /api/settings**
- Accept JSON body with key-value pairs
- For each key: `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`
- Return updated settings

---

## Worker Entry Point (index.ts)

```typescript
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // This is the cron handler
    // 1. Call fullCheck(env)
    // 2. If raining and radar image exists: saveCapture() + sendTelegramAlert()
    // 3. Log outcome
    // Wrap everything in try/catch — a cron failure must never crash the Worker
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle OPTIONS preflight
    // Route to API handlers
    // Catch all errors, return 500 JSON response
  },
};
```

---

## Frontend (React + Vite + Tailwind)

### Setup

- Vite with React + TypeScript template
- Tailwind CSS for styling
- React Router for page navigation
- No additional UI library — keep it lightweight

### API Client (api/client.ts)

```typescript
const API_BASE = import.meta.env.VITE_API_URL || "";

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

### Pages

**Dashboard.tsx**
- On mount: fetch `/api/rainfall/stations`
- Display: monitor status, last check time, current rain status, station readings table
- "Check Now" button: POST `/api/rainfall/check`, display result
- Auto-refresh station data every 60 seconds

**History.tsx**
- Year/month selector (defaults to current month)
- On change: fetch `/api/summary/monthly?year=X&month=Y`
- Display: total captures, estimated rain hours, rain days count
- Daily breakdown table with horizontal bar visualization for relative rain per day

**Captures.tsx**
- On mount: fetch `/api/captures?limit=50`
- Grid of radar image thumbnails
- Each card shows: timestamp, rainfall mm, station count
- Click to view full-size image (fetches `/api/captures/:id/image`)
- Pagination (load more)

**Settings.tsx**
- On mount: fetch `/api/settings`
- Editable fields: file naming pattern, check interval, station radius, alert cooldown
- Save button: PUT `/api/settings`
- Below settings: alert log table from `/api/alerts/log`

### Design

- Dark theme (dark gray background, card-based layout)
- Sidebar navigation with 4 page links
- Responsive (works on mobile)
- Use blue accent for rain indicators, green for "no rain" / "running", red for errors / "stopped"

---

## Utility Functions

### geo.ts

**haversine(lat1, lng1, lat2, lng2) → number (km)**
- Standard haversine formula, Earth radius = 6371km

**pointInPolygon(lat, lng, polygon: [number, number][]) → boolean**
- Ray-casting algorithm
- polygon is array of [lat, lng] pairs

### file-naming.ts

**expandPattern(pattern, timestamp: Date) → string**
- Replace tokens:
  - `{year}` → "2026"
  - `{month}` → "03"
  - `{day}` → "05"
  - `{hour}` → "14"
  - `{minute}` → "30"
  - `{second}` → "00"
  - `{date}` → "20260305"
  - `{time}` → "143000"
  - `{datetime}` → "20260305_143000"
- All numeric tokens are zero-padded

---

## Error Handling

- **NEA API down:** Log warning, return empty station list. The cron runs again in 5 minutes. Do not throw.
- **Radar image unavailable:** Log warning, skip capture. Station data alone can still detect rain.
- **R2 write failure:** Log error, still try to send alert. Don't lose the alert because storage failed.
- **Telegram API failure:** Log to alert_logs with `success = 0` and error detail. Don't retry.
- **D1 query failure:** Log error, return 500 to frontend. This is the one critical failure — if the database is down, the app is degraded.

Never let an error in one service crash the entire cron cycle. Each step should be wrapped in its own try/catch.

---

## Local Development

```bash
cd worker
npm install
wrangler dev
# Local server at http://localhost:8787
# D1 and R2 simulated locally

# Test cron manually:
curl "http://localhost:8787/__scheduled?cron=*/5+*+*+*+*"

# Frontend (separate terminal):
cd frontend
npm install
npm run dev
# Vite dev server at http://localhost:5173
# Set VITE_API_URL=http://localhost:8787 in .env
```

---

## Deployment

```bash
# One-time setup:
wrangler d1 create rain-monitor-db
# Copy database_id into wrangler.toml

wrangler r2 bucket create rain-captures

wrangler d1 execute rain-monitor-db --file=schema.sql

wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID

# Deploy backend:
cd worker
wrangler deploy

# Deploy frontend:
cd frontend
npm run build
wrangler pages deploy dist --project-name=nea-rain-monitor-ui
```

---

## Implementation Order

Build in this exact sequence — each step is testable before moving to the next:

1. **Worker scaffold** — `wrangler.toml`, `tsconfig.json`, `package.json`, `index.ts` with minimal scheduled + fetch handlers that return "ok"
2. **D1 schema** — Create `schema.sql`, apply with `wrangler d1 execute`
3. **config.ts** — Env type definition, region config parser
4. **utils/** — `geo.ts` (haversine + point-in-polygon), `file-naming.ts` (pattern expander)
5. **nea-client.ts** — Fetch rainfall API + radar image. Test with `wrangler dev` + manual curl
6. **rain-detector.ts** — Station filtering + fullCheck(). Test via cron trigger
7. **capture-svc.ts** — R2 storage + D1 insert. Verify files appear in R2 dashboard
8. **alert-svc.ts** — Telegram dispatch + cooldown. Test with a real Telegram bot
9. **routes/** — All API endpoints. Test each with curl
10. **Frontend scaffold** — Vite + React + Tailwind + Router setup
11. **API client + hooks** — Generic fetch wrapper
12. **Dashboard page** — Live status + check now
13. **History page** — Monthly summary
14. **Captures page** — Image gallery
15. **Settings page** — Config editor + alert log
16. **Deploy** — Worker + Pages to Cloudflare

---

## Critical Rules

- **One detection code path.** `fullCheck()` is called by the cron AND the manual check API. Never duplicate detection logic.
- **Services don't call each other.** The orchestration (check → capture → alert) happens in the cron handler and the route handler, not inside services.
- **No external dependencies for the Worker.** No Express, no ORM, no axios. Use native `fetch()`, D1 bindings, and R2 bindings directly. Keep the Worker bundle small.
- **Frontend fetches from `/api/*` only.** Never call data.gov.sg or weather.gov.sg from the browser — that's the Worker's job.
- **All D1 queries use parameterized statements.** Never concatenate user input into SQL strings.
- **All timestamps in ISO 8601 format** stored in D1. Convert to SGT (UTC+8) only for display in the frontend.
- **CORS headers on every response.** The frontend (Pages) and Worker are on different subdomains.
