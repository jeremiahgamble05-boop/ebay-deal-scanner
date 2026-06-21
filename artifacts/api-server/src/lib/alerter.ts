import { db, alertConfigsTable, alertLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface DealPayload {
  id: number;
  title: string;
  currentPrice: number;
  aiScore: number | null;
  aiAnalysis: string | null;
  itemUrl: string;
  seller: string;
  condition: string;
  category: string | null;
  keyword: string;
  source?: string;
}

function formatDiscordEmbed(deal: DealPayload) {
  const score = deal.aiScore ?? 0;
  const emoji = score >= 9 ? "🔥" : score >= 7 ? "⚡" : "💡";
  return {
    username: "Deal Scanner",
    embeds: [
      {
        title: `${emoji} ${deal.title}`,
        url: deal.itemUrl,
        color: score >= 9 ? 0xff4500 : score >= 7 ? 0xf5a623 : 0x4a90e2,
        fields: [
          {
            name: "Price",
            value: deal.currentPrice > 0 ? `$${deal.currentPrice.toFixed(2)}` : "See listing",
            inline: true,
          },
          {
            name: "AI Score",
            value: `${score}/10`,
            inline: true,
          },
          {
            name: "Condition",
            value: deal.condition,
            inline: true,
          },
          {
            name: "Seller",
            value: deal.seller,
            inline: true,
          },
          {
            name: "Keyword",
            value: deal.keyword,
            inline: true,
          },
          ...(deal.aiAnalysis
            ? [{ name: "AI Analysis", value: deal.aiAnalysis, inline: false }]
            : []),
        ],
        footer: { text: "Deal Scanner • " + new Date().toUTCString() },
      },
    ],
  };
}

function formatSlackPayload(deal: DealPayload) {
  const score = deal.aiScore ?? 0;
  const priceStr = deal.currentPrice > 0 ? `$${deal.currentPrice.toFixed(2)}` : "See listing";
  return {
    text: `*New Deal: ${deal.title}*`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*<${deal.itemUrl}|${deal.title}>*\n${deal.aiAnalysis ?? ""}`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Price:*\n${priceStr}` },
          { type: "mrkdwn", text: `*AI Score:*\n${score}/10` },
          { type: "mrkdwn", text: `*Condition:*\n${deal.condition}` },
          { type: "mrkdwn", text: `*Keyword:*\n${deal.keyword}` },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Deal" },
            url: deal.itemUrl,
            style: "primary",
          },
        ],
      },
    ],
  };
}

function formatGenericPayload(deal: DealPayload) {
  return {
    event: "new_deal",
    timestamp: new Date().toISOString(),
    deal: {
      id: deal.id,
      title: deal.title,
      price: deal.currentPrice,
      url: deal.itemUrl,
      score: deal.aiScore,
      analysis: deal.aiAnalysis,
      condition: deal.condition,
      seller: deal.seller,
      keyword: deal.keyword,
      category: deal.category,
    },
  };
}

async function sendWebhook(
  type: string,
  url: string,
  deal: DealPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    let body: unknown;
    if (type === "discord") {
      body = formatDiscordEmbed(deal);
    } else if (type === "slack") {
      body = formatSlackPayload(deal);
    } else {
      body = formatGenericPayload(deal);
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function fireDealAlerts(deal: DealPayload): Promise<void> {
  const score = deal.aiScore ?? 0;

  const configs = await db
    .select()
    .from(alertConfigsTable)
    .where(eq(alertConfigsTable.enabled, true));

  for (const config of configs) {
    const minScore = parseFloat(String(config.minScore));
    if (score < minScore) continue;

    const result = await sendWebhook(config.type, config.url, deal);

    await db.insert(alertLogsTable).values({
      alertConfigId: config.id,
      dealId: deal.id,
      success: result.success,
      errorMessage: result.error ?? null,
    });

    if (result.success) {
      logger.info({ configId: config.id, dealId: deal.id, type: config.type }, "Alert sent");
    } else {
      logger.warn({ configId: config.id, error: result.error }, "Alert failed");
    }
  }
}

export async function sendTestAlert(configId: number): Promise<{ success: boolean; message: string }> {
  const [config] = await db
    .select()
    .from(alertConfigsTable)
    .where(eq(alertConfigsTable.id, configId))
    .limit(1);

  if (!config) return { success: false, message: "Alert config not found" };

  const testDeal: DealPayload = {
    id: 0,
    title: "Test Deal — Mechanical Keyboard (Test Alert)",
    currentPrice: 49.99,
    aiScore: 8.5,
    aiAnalysis: "This is a test alert from Deal Scanner. Your webhook is configured correctly.",
    itemUrl: "https://example.com/test-deal",
    seller: "DealScanner",
    condition: "New",
    category: "Electronics",
    keyword: "mechanical keyboard",
  };

  const result = await sendWebhook(config.type, config.url, testDeal);
  return {
    success: result.success,
    message: result.success ? "Test alert sent successfully." : `Failed: ${result.error}`,
  };
}
