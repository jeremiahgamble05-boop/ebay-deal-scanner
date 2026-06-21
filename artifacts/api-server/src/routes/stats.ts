import { Router, type IRouter } from "express";
import { db, dealsTable } from "@workspace/db";
import { eq, count, avg, sql } from "drizzle-orm";
import { GetStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/stats", async (_req, res): Promise<void> => {
  const [totals] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where status = 'active')`,
      dismissed: sql<number>`count(*) filter (where status = 'dismissed')`,
      avgDiscount: avg(dealsTable.discountPercent),
      avgScore: avg(dealsTable.aiScore),
      totalSavings: sql<number>`coalesce(sum(case when original_price is not null then original_price - current_price else 0 end), 0)`,
    })
    .from(dealsTable);

  const categoryRows = await db
    .select({
      category: dealsTable.category,
      count: count(),
    })
    .from(dealsTable)
    .where(eq(dealsTable.status, "active"))
    .groupBy(dealsTable.category)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  const recentRows = await db
    .select({
      hour: sql<string>`date_trunc('hour', created_at)::text`,
      count: count(),
    })
    .from(dealsTable)
    .groupBy(sql`date_trunc('hour', created_at)`)
    .orderBy(sql`date_trunc('hour', created_at) desc`)
    .limit(24);

  res.json(GetStatsResponse.parse({
    totalDeals: Number(totals?.total ?? 0),
    activeDeals: Number(totals?.active ?? 0),
    dismissedDeals: Number(totals?.dismissed ?? 0),
    avgDiscount: parseFloat(String(totals?.avgDiscount ?? 0)) || 0,
    avgAiScore: parseFloat(String(totals?.avgScore ?? 0)) || 0,
    totalSavings: parseFloat(String(totals?.totalSavings ?? 0)) || 0,
    topCategories: categoryRows.map(r => ({
      category: r.category ?? "Uncategorized",
      count: Number(r.count),
    })),
    recentActivity: recentRows.map(r => ({
      hour: r.hour,
      count: Number(r.count),
    })),
  }));
});

export default router;
