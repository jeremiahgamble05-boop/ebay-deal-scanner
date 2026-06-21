import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export interface DealAnalysis {
  score: number;
  analysis: string;
}

export async function analyzeDeal(item: {
  title: string;
  currentPrice: number;
  condition: string;
  seller: string;
  sellerFeedbackScore: number | null;
  category: string | null;
  description?: string | null;
  source?: string;
}): Promise<DealAnalysis> {
  const anthropic = getClient();
  if (!anthropic) {
    return heuristicScore(item);
  }

  try {
    const prompt = `You are an expert deal analyst. Score this listing from 0–10 (10 = exceptional deal) and give a 1–2 sentence analysis.

Title: ${item.title}
Price: ${item.currentPrice > 0 ? `$${item.currentPrice}` : "unknown"}
Condition: ${item.condition}
Seller/Source: ${item.seller}${item.source ? ` (via ${item.source})` : ""}
Category: ${item.category ?? "unknown"}
${item.description ? `Description: ${item.description.slice(0, 200)}` : ""}

Consider: price-to-value ratio, condition, seller credibility, deal scarcity.
Respond with JSON only: {"score": <0-10>, "analysis": "<1-2 sentences>"}`;

    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") return heuristicScore(item);

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return heuristicScore(item);

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      score: Math.min(10, Math.max(0, Number(parsed.score) || 5)),
      analysis: String(parsed.analysis || ""),
    };
  } catch (err) {
    logger.error({ err }, "Anthropic analysis failed, falling back to heuristic");
    return heuristicScore(item);
  }
}

function heuristicScore(item: {
  currentPrice: number;
  condition: string;
  sellerFeedbackScore: number | null;
  title?: string;
}): DealAnalysis {
  let score = 5;

  if (item.condition === "New") score += 1;
  else if (item.condition.toLowerCase().includes("like new")) score += 0.5;
  else if (item.condition.toLowerCase().includes("parts")) score -= 1;

  if (item.sellerFeedbackScore !== null) {
    if (item.sellerFeedbackScore > 1000) score += 0.5;
    if (item.sellerFeedbackScore > 5000) score += 0.5;
  }

  if (item.currentPrice > 0 && item.currentPrice < 25) score += 0.5;
  else if (item.currentPrice === 0) score -= 0.5;

  score = Math.min(10, Math.max(0, Math.round(score * 10) / 10));

  return {
    score,
    analysis: `Heuristic score. Price: ${item.currentPrice > 0 ? `$${item.currentPrice}` : "unknown"}, condition: ${item.condition}.`,
  };
}
