import "dotenv/config";

import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL!;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY!;
if (!RAPIDAPI_KEY) throw new Error("RAPIDAPI_KEY env var is required");
const RAPIDAPI_HOST = "uae-real-estate2.p.rapidapi.com";
const DELAY_MS = 300;
const PROJECT_MIN_TXNS = 800;

type BayutLocation = {
  id: number;
  name: string;
  level: string;
  coordinates: { lat: number; lng: number } | null;
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchBayutLocation(query: string): Promise<BayutLocation[]> {
  const url = `https://${RAPIDAPI_HOST}/locations_search?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": RAPIDAPI_HOST,
      "x-rapidapi-key": RAPIDAPI_KEY,
    },
  });
  if (!res.ok) {
    console.error(`  Bayut API error ${res.status}: ${await res.text()}`);
    return [];
  }
  const data = await res.json();
  return (data.results || []) as BayutLocation[];
}

function pickBestMatch(
  results: BayutLocation[],
  searchName: string,
  preferLevel: string
): BayutLocation | null {
  if (results.length === 0) return null;

  const normalized = searchName.trim().toLowerCase();

  // Exact name match at preferred level
  const exactPreferred = results.find(
    (r) =>
      r.level === preferLevel &&
      r.name.toLowerCase() === normalized &&
      r.coordinates
  );
  if (exactPreferred) return exactPreferred;

  // Exact name match at any level
  const exact = results.find(
    (r) => r.name.toLowerCase() === normalized && r.coordinates
  );
  if (exact) return exact;

  // Preferred level with coordinates
  const levelMatch = results.find(
    (r) => r.level === preferLevel && r.coordinates
  );
  if (levelMatch) return levelMatch;

  // Any result with coordinates
  return results.find((r) => r.coordinates) || null;
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Load already-geocoded entities to skip them
    const existing = await pool.query<{ entity_type: string; entity_name: string }>(
      `SELECT entity_type, entity_name FROM geo_coordinates`
    );
    const done = new Set(existing.rows.map((r) => `${r.entity_type}:${r.entity_name}`));
    console.log(`Already geocoded: ${done.size} entities`);

    // Load areas
    const areas = await pool.query<{
      display_area: string;
      normalized_area: string;
      txn_count: string;
    }>(`
      SELECT display_area, normalized_area, COUNT(*)::int as txn_count
      FROM transactions_live
      WHERE trans_group_en = 'Sales'
      GROUP BY display_area, normalized_area
      ORDER BY txn_count DESC
    `);

    // Load top projects
    const projects = await pool.query<{
      project_name_en: string;
      display_area: string;
      normalized_area: string;
      txn_count: string;
    }>(`
      SELECT project_name_en, display_area, normalized_area, COUNT(*)::int as txn_count
      FROM transactions_live
      WHERE trans_group_en = 'Sales' AND project_name_en != ''
      GROUP BY project_name_en, display_area, normalized_area
      HAVING COUNT(*) >= ${PROJECT_MIN_TXNS}
      ORDER BY txn_count DESC
    `);

    // Build work queue
    type WorkItem = {
      entityType: string;
      entityName: string;
      displayName: string;
      searchQuery: string;
      preferLevel: string;
      txnCount: number;
    };

    const queue: WorkItem[] = [];

    for (const row of areas.rows) {
      if (done.has(`area:${row.normalized_area}`)) continue;
      // Search by display name (user-friendly) — better match on Bayut
      queue.push({
        entityType: "area",
        entityName: row.normalized_area,
        displayName: row.display_area,
        searchQuery: row.display_area,
        preferLevel: "community",
        txnCount: Number(row.txn_count),
      });
    }

    for (const row of projects.rows) {
      if (done.has(`project:${row.project_name_en}`)) continue;
      queue.push({
        entityType: "project",
        entityName: row.project_name_en,
        displayName: row.project_name_en,
        searchQuery: row.project_name_en,
        preferLevel: "sub_community",
        txnCount: Number(row.txn_count),
      });
    }

    console.log(`Work queue: ${queue.length} entities (${areas.rows.length} areas, ${projects.rows.length} projects)`);
    console.log(`Skipping ${done.size} already done\n`);

    let resolved = 0;
    let failed = 0;
    let apiCalls = 0;

    for (const item of queue) {
      apiCalls++;
      process.stdout.write(
        `[${apiCalls}/${queue.length}] ${item.entityType}:${item.searchQuery.slice(0, 40).padEnd(40)} `
      );

      const results = await searchBayutLocation(item.searchQuery);
      const match = pickBestMatch(results, item.searchQuery, item.preferLevel);

      if (match && match.coordinates) {
        await pool.query(
          `INSERT INTO geo_coordinates (entity_type, entity_name, display_name, bayut_id, bayut_level, bayut_name, lat, lng, txn_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (entity_type, entity_name) DO UPDATE SET
             lat = EXCLUDED.lat, lng = EXCLUDED.lng, bayut_id = EXCLUDED.bayut_id,
             bayut_level = EXCLUDED.bayut_level, bayut_name = EXCLUDED.bayut_name,
             display_name = EXCLUDED.display_name, txn_count = EXCLUDED.txn_count`,
          [
            item.entityType,
            item.entityName,
            item.displayName,
            match.id,
            match.level,
            match.name,
            match.coordinates.lat,
            match.coordinates.lng,
            item.txnCount,
          ]
        );
        resolved++;
        console.log(`✓ ${match.name} (${match.level}) [${match.coordinates.lat}, ${match.coordinates.lng}]`);
      } else {
        failed++;
        console.log(`✗ no match (${results.length} results)`);
      }

      await sleep(DELAY_MS);
    }

    console.log(`\nDone. Resolved: ${resolved}, Failed: ${failed}, API calls: ${apiCalls}`);

    const total = await pool.query(`SELECT COUNT(*) as cnt FROM geo_coordinates`);
    console.log(`Total in DB: ${total.rows[0].cnt}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
