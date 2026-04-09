# Dubai Real Estate Dashboard

Analytics dashboard for Dubai's real estate market built on official Dubai Land Department (DLD) transaction data. Covers **1.68M+ transactions** from January 2004 to April 2026 across **289 areas** and **thousands of projects**.

## Features

**Market Overview** — KPI cards (sales volume, avg price/sqm, off-plan ratio), trend charts with day/week/month granularity, transaction type breakdown

**Interactive Map** — Geocoded heatmap of 232 areas and 225 projects with color-coded metrics (price/sqm, volume, off-plan ratio). Built on Leaflet with dark CARTO tiles

**Area Analysis** — Scatter plot (price vs YoY change), sortable table with MoM/YoY metrics, deep-dive charts per area (price trends, room breakdown, top projects)

**Property Analysis** — Price trends by property type (Unit, Villa, Land, Building), bedroom price comparisons, price/sqm distribution histogram

**Project Intelligence** — Top projects ranked by volume, filterable by area and date range

**Crisis Monitor** — Before/after comparison for market events (COVID-19, Hormuz Strait Disruption), geographic impact map, daily transaction charts, YoY pacing, historical crisis indexing

**Transaction Explorer** — Paginated, searchable, filterable table of all transactions

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database**: PostgreSQL with Prisma ORM
- **Charts**: Recharts
- **Maps**: Leaflet + react-leaflet
- **Styling**: Tailwind CSS 4
- **Data Fetching**: TanStack React Query

## Project Structure

```
src/
  app/
    api/              # 20+ REST endpoints
      kpis/           # Market KPI aggregations
      areas/          # Area-level stats and detail
      trends/         # Volume, price, off-plan trends
      crisis/         # Crisis comparison, daily, sectors, geo
      geo/            # Geocoded map data
      ...
    map/              # Interactive map page
    areas/            # Area analysis page
    properties/       # Property type analysis
    projects/         # Project rankings
    crisis/           # Crisis monitor page
    transactions/     # Transaction explorer
  components/
    charts/           # Chart components (dubai-map, crisis-map)
    layout/           # Sidebar navigation
    kpi/              # KPI card components
    ui/               # Shared UI primitives
  hooks/
    use-dashboard.ts  # React Query hooks for all endpoints
  lib/
    constants.ts      # Area name maps, formatters, crisis dates
    sql.ts            # Query builders, property type normalization
    db.ts             # Prisma client singleton
    cache.ts          # In-memory LRU cache
    filters.ts        # URL param parsing
scripts/
  ingest.ts           # CSV ingest pipeline (historical + current year)
  geocode.ts          # Bayut API geocoding batch script
prisma/
  schema.prisma       # Database schema
  migrations/         # SQL migrations
```

## Database Schema

**`transactions`** — Core fact table with all DLD transaction fields, normalization flags, and source tracking

**`transactions_live`** — View filtering out invalid dates, duplicates, and cutoff-excluded rows

**`monthly_market_stats`** — View aggregating monthly KPIs (sales count/volume/avg price, off-plan ratio, property type splits)

**`area_monthly_market_stats`** — View with per-area monthly aggregations

**`project_monthly_market_stats`** — View with per-project monthly aggregations

**`geo_coordinates`** — Geocoded lat/lng for areas and projects (sourced from Bayut + Nominatim)

**`area_aliases`** — Mapping table for DLD area name normalization

**`ingest_runs`** — Tracks each ingest execution with row counts and status

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 15+

### Install

```bash
npm install
```

### Environment

Create `.env.local`:

```env
DATABASE_URL=postgresql://user:password@host:port/dbname
```

### Database

Run migrations:

```bash
npx prisma migrate deploy
```

### Ingest Data

Place CSV files in the parent directory and run:

```bash
# Ingest both historical and current year CSVs
npx tsx scripts/ingest.ts ../Transactions.csv ../transactions-2026-04-08.csv

# Or let it auto-detect files in the parent directory
npx tsx scripts/ingest.ts
```

The ingest pipeline:
- Auto-detects CSV format (historical vs current year) from headers
- Normalizes area names via `AREA_NAME_MAP` (marketing name -> DLD name)
- Normalizes property types (villa sub-types classified as "Building" in current year CSV)
- Deduplicates via canonical row hashing
- Applies date cutoffs to prevent overlap between sources

### Geocode Areas

```bash
# Requires RAPIDAPI_KEY env var (or uses default)
npx tsx scripts/geocode.ts
```

Fetches coordinates from Bayut API for all areas and top projects (800+ sales). Run once; results are cached permanently in the database.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data Normalization

The two DLD CSV formats use different naming conventions. The ingest pipeline handles:

**Area Names** — The current year CSV uses marketing names (`DUBAI MARINA`, `JUMEIRAH VILLAGE CIRCLE`) while historical uses DLD official names (`Marsa Dubai`, `Al Barsha South Fourth`). The `AREA_NAME_MAP` in `constants.ts` maps 30+ marketing names to their DLD equivalents.

**Property Types** — The current year CSV classifies villas as `PROP_TYPE_EN = "Building"` with `PROP_SB_TYPE_EN = "Villa"`. The ingest script and database views apply `normalizePropertyType` to reclassify these correctly.

**Room Values** — `"NA"` values in the current year CSV are normalized to empty strings.

**Date Handling** — Historical CSV uses `DD-MM-YYYY`, current year uses `YYYY-MM-DD HH:MM:SS`. Both are normalized to UTC dates. Historical data after `2026-01-01` is excluded to prevent overlap with current year data.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/kpis` | GET | Market KPI cards with MoM/YoY changes and sparklines |
| `/api/areas` | GET | Area rankings with volume and price changes |
| `/api/areas/[area]` | GET | Area detail: trends, room breakdown, top projects |
| `/api/trends/volume` | GET | Transaction volume trends (day/week/month) |
| `/api/trends/prices` | GET | Price trends (avg price, avg/sqm) |
| `/api/trends/offplan` | GET | Off-plan vs ready ratio trends |
| `/api/property-types` | GET | Property type breakdown over time |
| `/api/rooms` | GET | Bedroom type price trends |
| `/api/projects` | GET | Project rankings by volume |
| `/api/transactions` | GET | Paginated transaction explorer |
| `/api/distribution` | GET | Price/sqm histogram |
| `/api/filters/areas` | GET | Area dropdown values |
| `/api/geo` | GET | Geocoded area/project data for maps |
| `/api/crisis/comparison` | GET | Before/after crisis metrics |
| `/api/crisis/daily` | GET | Daily transaction breakdown |
| `/api/crisis/areas-impact` | GET | Per-area crisis impact |
| `/api/crisis/geo` | GET | Geographic crisis impact with coordinates |
| `/api/crisis/indexed` | GET | Historical crisis comparison (indexed to 100) |
| `/api/crisis/resilience` | GET | Area resilience scoring |
| `/api/crisis/sectors` | GET | Property type/off-plan crisis breakdown |
| `/api/crisis/market-composition` | GET | Weekly sales composition |
| `/api/crisis/yoy-pacing` | GET | Week-by-week YoY comparison |
| `/api/crisis/projects-impact` | GET | Project-level crisis winners/losers |

All endpoints support date range filtering. Most are cached in-memory (LRU, 1h default).

## License

Private.
