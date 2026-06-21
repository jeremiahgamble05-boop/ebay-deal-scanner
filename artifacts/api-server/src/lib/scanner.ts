import { db, dealsTable, keywordsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { fetchAllSources } from "./sources";
import { analyzeDeal } from "./anthropic";
import { fireDealAlerts } from "./alerter";
import { logger } from "./logger";
import type WebSocket from "ws";

export type ScannerStatus = "idle" | "running" | "stopped";

interface ScannerState {
  status: ScannerStatus;
  itemsScanned: number;
  dealsFound: number;
  lastScanAt: Date | null;
  startedAt: Date | null;
  stoppedAt: Date | null;
  timer: ReturnType<typeof setTimeout> | null;
  clients: Set<WebSocket>;
}

const state: ScannerState = {
  status: "idle",
  itemsScanned: 0,
  dealsFound: 0,
  lastScanAt: null,
  startedAt: null,
  stoppedAt: null,
  timer: null,
  clients: new Set(),
};

export function getStatus() {
  return {
    status: state.status,
    itemsScanned: state.itemsScanned,
    dealsFound: state.dealsFound,
    lastScanAt: state.lastScanAt?.toISOString() ?? null,
    startedAt: state.startedAt?.toISOString() ?? null,
    stoppedAt: state.stoppedAt?.toISOString() ?? null,
    connectedClients: state.clients.size,
  };
}

export function addWebSocketClient(ws: WebSocket) {
  state.clients.add(ws);
  ws.on("close", () => state.clients.delete(ws));
  ws.on("error", () => state.clients.delete(ws));
}

function broadcast(deal: object) {
  const msg = JSON.stringify(deal);
  for (const client of state.clients) {
    try {
      if ((client as any).readyState === 1) {
        client.send(msg);
      }
    } catch (err) {
      logger.error({ err }, "WebSocket send error");
    }
  }
}

export function startScan() {
  if (state.status === "running") return;
  state.status = "running";
  state.startedAt = new Date();
  state.stoppedAt = null;
  logger.info("Scan started");
  scheduleScan();
}

export function stopScan() {
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.status = "stopped";
  state.stoppedAt = new Date();
  logger.info("Scan stopped");
}

function scheduleScan() {
  if (state.status !== "running") return;
  runScanCycle()
    .catch((err) => logger.error({ err }, "Scan cycle error"))
    .finally(() => {
      if (state.status === "running") {
        // Re-scan every 5 minutes
        state.timer = setTimeout(scheduleScan, 5 * 60_000);
      }
    });
}

async function runScanCycle() {
  const keywords = await db
    .select()
    .from(keywordsTable)
    .where(eq(keywordsTable.active, true));

  if (keywords.length === 0) {
    logger.info("No active keywords — seeding defaults");
    await ensureDefaultKeywords();
    return;
  }

  state.lastScanAt = new Date();
  logger.info({ keywords: keywords.map((k) => k.keyword) }, "Starting scan cycle");

  for (const kw of keywords) {
    if (state.status !== "running") break;

    const maxPrice = kw.maxPrice ? parseFloat(String(kw.maxPrice)) : undefined;
    const items = await fetchAllSources(kw.keyword, maxPrice);
    state.itemsScanned += items.length;

    for (const item of items) {
      if (state.status !== "running") break;

      // Skip items without a URL
      if (!item.itemUrl) continue;

      // De-duplicate by itemId (unique per source+id)
      const existing = await db
        .select({ id: dealsTable.id })
        .from(dealsTable)
        .where(eq(dealsTable.ebayItemId, item.itemId))
        .limit(1);

      if (existing.length > 0) continue;

      const analysis = await analyzeDeal({
        title: item.title,
        currentPrice: item.currentPrice ?? 0,
        condition: item.condition,
        seller: item.seller,
        sellerFeedbackScore: item.sellerFeedbackScore,
        category: item.category,
        description: item.description,
        source: item.source,
      });

      // Filter low-quality results
      if (analysis.score < 4) continue;

      const minDiscount = kw.minDiscount ? parseFloat(String(kw.minDiscount)) : null;
      if (minDiscount && analysis.score < 5) continue;

      const [deal] = await db
        .insert(dealsTable)
        .values({
          ebayItemId: item.itemId,
          title: item.title,
          currentPrice: String(item.currentPrice ?? 0),
          originalPrice: null,
          discountPercent: null,
          imageUrl: item.imageUrl,
          itemUrl: item.itemUrl,
          seller: item.seller,
          sellerRating:
            item.sellerFeedbackScore !== null ? String(item.sellerFeedbackScore) : null,
          condition: item.condition,
          aiScore: String(analysis.score),
          aiAnalysis: analysis.analysis,
          category: item.category ?? item.source,
          keyword: kw.keyword,
          status: "active",
        })
        .returning();

      state.dealsFound += 1;

      broadcast({
        id: deal.id,
        ebayItemId: deal.ebayItemId,
        title: deal.title,
        currentPrice: parseFloat(String(deal.currentPrice)),
        originalPrice: deal.originalPrice ? parseFloat(String(deal.originalPrice)) : null,
        discountPercent: deal.discountPercent
          ? parseFloat(String(deal.discountPercent))
          : null,
        imageUrl: deal.imageUrl,
        itemUrl: deal.itemUrl,
        seller: deal.seller,
        sellerRating: deal.sellerRating ? parseFloat(String(deal.sellerRating)) : null,
        condition: deal.condition,
        aiScore: deal.aiScore ? parseFloat(String(deal.aiScore)) : null,
        aiAnalysis: deal.aiAnalysis,
        category: deal.category,
        keyword: deal.keyword,
        status: deal.status,
        createdAt: deal.createdAt.toISOString(),
      });

      logger.info(
        { title: deal.title, score: analysis.score, source: item.source },
        "New deal saved"
      );

      // Fire webhook alerts (non-blocking, errors are logged inside)
      fireDealAlerts({
        id: deal.id,
        title: deal.title,
        currentPrice: parseFloat(String(deal.currentPrice)),
        aiScore: deal.aiScore ? parseFloat(String(deal.aiScore)) : null,
        aiAnalysis: deal.aiAnalysis,
        itemUrl: deal.itemUrl,
        seller: deal.seller,
        condition: deal.condition,
        category: deal.category,
        keyword: deal.keyword,
        source: item.source,
      }).catch((err) => logger.error({ err }, "fireDealAlerts error"));
    }
  }

  logger.info(
    { itemsScanned: state.itemsScanned, dealsFound: state.dealsFound },
    "Scan cycle complete"
  );
}

async function ensureDefaultKeywords() {
  const defaults = [
    { keyword: "mechanical keyboard", maxPrice: "150" },
    { keyword: "vintage camera", maxPrice: null },
    { keyword: "graphics card", maxPrice: "400" },
    { keyword: "vinyl records", maxPrice: "30" },
    { keyword: "lego sets", maxPrice: "60" },
  ];
  for (const d of defaults) {
    await db
      .insert(keywordsTable)
      .values({ keyword: d.keyword, maxPrice: d.maxPrice, active: true })
      .onConflictDoNothing();
  }
}
