import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }
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
}): Promise<DealAnalysis> {
  const anthropic = getClient();

  if (!anthropic) {
    logger.warn("ANTHROPIC_API_KEY not set — using heuristic scoring");
    return heuristicScore(item);
  }

  try {
    const prompt = `You are an expert eBay deal analyst. Analyze this listing and provide a deal score from 0-10 (10 being the best deal) and a brief 1-2 sentence analysis.

Item: ${item.title}
Price: $${item.currentPrice}
Condition: ${item.condition}
Seller: ${item.seller} (feedback score: ${item.sellerFeedbackScore ?? "unknown"})
Category: ${item.category ?? "unknown"}

Respond with JSON only:
{"score": <number 0-10>, "analysis": "<brief analysis>"}`;

    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return heuristicScore(item);
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return heuristicScore(item);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      score: Math.min(10, Math.max(0, Number(parsed.score) || 5)),
      analysis: String(parsed.analysis || ""),
    };
  } catch (err) {
    logger.error({ err }, "Anthropic analysis failed");
    return heuristicScore(item);
  }
}

function heuristicScore(item: {
  currentPrice: number;
  condition: string;
  sellerFeedbackScore: number | null;
}): DealAnalysis {
  let score = 5;

  if (item.condition === "New") score += 1;
  else if (item.condition.includes("Like New")) score += 0.5;
  else if (item.condition.includes("parts")) score -= 1;

  if (item.sellerFeedbackScore !== null) {
    if (item.sellerFeedbackScore > 1000) score += 1;
    if (item.sellerFeedbackScore > 5000) score += 0.5;
  }

  if (item.currentPrice < 10) score += 1;
  else if (item.currentPrice < 25) score += 0.5;

  score = Math.min(10, Math.max(0, score));

  return {
    score: Math.round(score * 10) / 10,
    analysis: `Heuristic analysis: Price point $${item.currentPrice}, condition ${item.condition}. Score based on price, condition and seller rating.`,
  };
}
