import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getCached, setCache } from "@/lib/cache";
import { serializeForJson } from "@/lib/sql";

export async function GET() {
  const cacheKey = "filter_areas";
  const cached = getCached<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const data = await prisma.$queryRaw(
    Prisma.sql`
      SELECT
        normalized_area AS value,
        MIN(display_area) AS label,
        COUNT(*)::int AS count
      FROM transactions_live
      WHERE trans_group_en = 'Sales'
      GROUP BY normalized_area
      ORDER BY count DESC
    `
  );

  const result = serializeForJson({ data });
  setCache(cacheKey, result, 1000 * 60 * 60 * 24);
  return NextResponse.json(result);
}
