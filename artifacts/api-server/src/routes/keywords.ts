import { Router, type IRouter } from "express";
import { db, keywordsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  AddKeywordBody,
  DeleteKeywordParams,
  ListKeywordsResponse,
  DeleteKeywordResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeKeyword(kw: typeof keywordsTable.$inferSelect) {
  return {
    id: kw.id,
    keyword: kw.keyword,
    maxPrice: kw.maxPrice ? parseFloat(String(kw.maxPrice)) : null,
    minDiscount: kw.minDiscount ? parseFloat(String(kw.minDiscount)) : null,
    active: kw.active,
    createdAt: kw.createdAt.toISOString(),
  };
}

router.get("/v1/keywords", async (_req, res): Promise<void> => {
  const keywords = await db
    .select()
    .from(keywordsTable)
    .orderBy(keywordsTable.createdAt);

  res.json(ListKeywordsResponse.parse(keywords.map(serializeKeyword)));
});

router.post("/v1/keywords", async (req, res): Promise<void> => {
  const parsed = AddKeywordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [kw] = await db.insert(keywordsTable).values({
    keyword: parsed.data.keyword,
    maxPrice: parsed.data.maxPrice ? String(parsed.data.maxPrice) : null,
    minDiscount: parsed.data.minDiscount ? String(parsed.data.minDiscount) : null,
    active: true,
  }).returning();

  res.status(201).json(serializeKeyword(kw));
});

router.delete("/v1/keywords/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteKeywordParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [kw] = await db
    .delete(keywordsTable)
    .where(eq(keywordsTable.id, params.data.id))
    .returning();

  if (!kw) {
    res.status(404).json({ error: "Keyword not found" });
    return;
  }

  res.json(DeleteKeywordResponse.parse(serializeKeyword(kw)));
});

export default router;
