import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { buildCuratedWhere, normalizedPropertyTypeSql, serializeForJson } from "@/lib/sql";
import { parseFilterParams } from "@/lib/filters";

const SORT_COLUMNS: Record<string, string> = {
  instance_date: "instance_date",
  amount: "amount",
  meter_sale_price: "meter_sale_price",
  procedure_area: "procedure_area",
  display_area: "display_area",
  trans_group_en: "trans_group_en",
};

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = parseInt(sp.get("page") || "1", 10);
  const pageSize = Math.min(parseInt(sp.get("pageSize") || "50", 10), 100);
  const sortColumn = SORT_COLUMNS[sp.get("sortBy") || "instance_date"] || SORT_COLUMNS.instance_date;
  const sortDir = sp.get("sortDir") === "asc" ? "ASC" : "DESC";

  const filters = parseFilterParams(sp);
  const where = buildCuratedWhere(filters, "t");
  const offset = (page - 1) * pageSize;

  const [data, totalCountRows] = await Promise.all([
    prisma.$queryRaw(
      Prisma.sql`
        SELECT
          transaction_id,
          instance_date,
          trans_group_en,
          procedure_name_en,
          is_offplan,
          property_usage_en,
          normalized_area,
          display_area,
          ${normalizedPropertyTypeSql("t")} AS property_type_en,
          property_sub_type_en,
          amount::double precision AS amount,
          procedure_area::double precision AS procedure_area,
          meter_sale_price::double precision AS meter_sale_price,
          rooms_en,
          project_name_en,
          master_project_en
        FROM transactions_live AS t
        ${where}
        ORDER BY ${Prisma.raw(`"${sortColumn}"`)} ${Prisma.raw(sortDir)}
        OFFSET ${offset}
        LIMIT ${pageSize}
      `
    ),
    prisma.$queryRaw<{ total_count: number }[]>(
      Prisma.sql`
        SELECT COUNT(*)::int AS total_count
        FROM transactions_live AS t
        ${where}
      `
    ),
  ]);

  const totalCount = totalCountRows[0]?.total_count || 0;
  return NextResponse.json(
    serializeForJson({
      data,
      meta: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    })
  );
}
