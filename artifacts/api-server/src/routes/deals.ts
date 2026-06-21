import { Router, type IRouter } from "express";
import { db, dealsTable } from "@workspace/db";
import { eq, desc, gte, and } from "drizzle-orm";
import {
  ListDealsQueryParams,
  ListDealsResponse,
  GetDealParams,
  GetDealResponse,
  DismissDealParams,
  DismissDealResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeDeal(deal: typeof dealsTable.$inferSelect) {
  return {
    id: deal.id,
    ebayItemId: deal.ebayItemId,
    title: deal.title,
    currentPrice: parseFloat(String(deal.currentPrice)),
    originalPrice: deal.originalPrice ? parseFloat(String(deal.originalPrice)) : null,
    discountPercent: deal.discountPercent ? parseFloat(String(deal.discountPercent)) : null,
    imageUrl: deal.imageUrl,
    itemUrl: deal.itemUrl,
    seller: deal.seller,
    sellerRating: deal.sellerRating ? parseFloat(String(deal.sellerRating)) : null,
    condition: deal.condition,
    aiScore: deal.aiScore ? parseFloat(String(deal.aiScore)) : null,
    aiAnalysis: deal.aiAnalysis,
    category: deal.category,
    keyword: deal.keyword,
    status: deal.status as "active" | "dismissed",
    createdAt: deal.createdAt.toISOString(),
  };
}

router.get("/v1/deals", async (req, res): Promise<void> => {
  const params = ListDealsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { limit = 50, minScore, category } = params.data;

  const conditions = [eq(dealsTable.status, "active")];
  if (category) {
    conditions.push(eq(dealsTable.category, category));
  }

  const allDeals = await db
    .select()
    .from(dealsTable)
    .where(and(...conditions))
    .orderBy(desc(dealsTable.createdAt))
    .limit(limit ?? 50);

  let filtered = allDeals;
  if (minScore !== undefined && minScore !== null) {
    filtered = allDeals.filter(d => d.aiScore !== null && parseFloat(String(d.aiScore)) >= minScore);
  }

  res.json(ListDealsResponse.parse(filtered.map(serializeDeal)));
});

router.get("/v1/deals/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDealParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deal] = await db
    .select()
    .from(dealsTable)
    .where(eq(dealsTable.id, params.data.id))
    .limit(1);

  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  res.json(GetDealResponse.parse(serializeDeal(deal)));
});

router.post("/v1/deals/:id/dismiss", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DismissDealParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deal] = await db
    .update(dealsTable)
    .set({ status: "dismissed" })
    .where(eq(dealsTable.id, params.data.id))
    .returning();

  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  res.json(DismissDealResponse.parse(serializeDeal(deal)));
});

export default router;
