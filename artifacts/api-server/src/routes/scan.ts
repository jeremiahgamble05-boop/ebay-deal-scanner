import { Router, type IRouter } from "express";
import { startScan, stopScan, getStatus } from "../lib/scanner";
import {
  StartScanBody,
  StartScanResponse,
  StopScanResponse,
  GetScanStatusResponse,
} from "@workspace/api-zod";
import { db, keywordsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/v1/scan/start", async (req, res): Promise<void> => {
  const parsed = StartScanBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.keywords && parsed.data.keywords.length > 0) {
    for (const kw of parsed.data.keywords) {
      await db.insert(keywordsTable)
        .values({ keyword: kw, maxPrice: parsed.data.maxPrice ? String(parsed.data.maxPrice) : null, active: true })
        .onConflictDoNothing();
    }
  }

  startScan();
  const status = getStatus();
  res.json(StartScanResponse.parse({
    id: "scan-1",
    status: status.status,
    startedAt: status.startedAt,
    stoppedAt: status.stoppedAt,
    itemsScanned: status.itemsScanned,
    dealsFound: status.dealsFound,
  }));
});

router.post("/v1/scan/stop", async (_req, res): Promise<void> => {
  stopScan();
  const status = getStatus();
  res.json(StopScanResponse.parse({
    id: "scan-1",
    status: status.status,
    startedAt: status.startedAt,
    stoppedAt: status.stoppedAt,
    itemsScanned: status.itemsScanned,
    dealsFound: status.dealsFound,
  }));
});

router.get("/v1/scan/status", async (_req, res): Promise<void> => {
  const status = getStatus();
  const keywords = await db.select({ keyword: keywordsTable.keyword })
    .from(keywordsTable)
    .where(eq(keywordsTable.active, true));

  res.json(GetScanStatusResponse.parse({
    status: status.status,
    itemsScanned: status.itemsScanned,
    dealsFound: status.dealsFound,
    lastScanAt: status.lastScanAt,
    activeKeywords: keywords.map(k => k.keyword),
    connectedClients: status.connectedClients,
  }));
});

export default router;
