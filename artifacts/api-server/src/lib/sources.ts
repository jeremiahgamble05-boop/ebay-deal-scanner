import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { logger } from "./logger";

export interface SourceItem {
  itemId: string;
  title: string;
  currentPrice: number | null;
  imageUrl: string | null;
  itemUrl: string;
  seller: string;
  sellerFeedbackScore: number | null;
  condition: string;
  category: string | null;
  source: string;
  description: string | null;
}

const rssParser = new Parser({
  customFields: {
    item: ["media:thumbnail", "media:content", "enclosure"],
  },
});

const USER_AGENT =
  "Mozilla/5.0 (compatible; DealScanner/1.0; +https://github.com/dealscanner)";

async function safeFetch(url: string, opts: RequestInit = {}): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      ...opts,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml,application/json,*/*",
        ...(opts.headers ?? {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      logger.warn({ url, status: res.status }, "Fetch returned non-OK status");
      return null;
    }
    return res;
  } catch (err) {
    logger.warn({ url, err }, "Fetch failed");
    return null;
  }
}

function extractPrice(text: string): number | null {
  const match = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return null;
  return parseFloat(match[1].replace(/,/g, ""));
}

function slugId(source: string, id: string): string {
  return `${source}::${id}`;
}

/* ─────────────────────────────────────────────
   1. Slickdeals RSS
   ───────────────────────────────────────────── */
export async function fetchSlickdeals(keyword: string): Promise<SourceItem[]> {
  const url = `https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&q=${encodeURIComponent(keyword)}&rss=1`;
  const res = await safeFetch(url);
  if (!res) return [];

  try {
    const xml = await res.text();
    const feed = await rssParser.parseString(xml);
    return (feed.items ?? []).slice(0, 10).map((item) => {
      const price = extractPrice(item.title ?? "") ?? extractPrice(item.contentSnippet ?? "");
      const thumb =
        (item as any)["media:thumbnail"]?.["$"]?.url ??
        (item as any)["media:content"]?.["$"]?.url ??
        null;
      return {
        itemId: slugId("slickdeals", item.guid ?? item.link ?? item.title ?? ""),
        title: item.title ?? "Slickdeals deal",
        currentPrice: price,
        imageUrl: thumb,
        itemUrl: item.link ?? "",
        seller: "Slickdeals",
        sellerFeedbackScore: null,
        condition: "New",
        category: "Deals",
        source: "slickdeals",
        description: item.contentSnippet ?? null,
      };
    });
  } catch (err) {
    logger.error({ err }, "Slickdeals RSS parse error");
    return [];
  }
}

/* ─────────────────────────────────────────────
   2. DealNews RSS
   ───────────────────────────────────────────── */
export async function fetchDealNews(keyword: string): Promise<SourceItem[]> {
  const url = `https://www.dealnews.com/rss.html?cat=l&keyword=${encodeURIComponent(keyword)}`;
  const res = await safeFetch(url);
  if (!res) return [];

  try {
    const xml = await res.text();
    const feed = await rssParser.parseString(xml);
    return (feed.items ?? []).slice(0, 10).map((item) => {
      const price = extractPrice(item.title ?? "") ?? extractPrice(item.contentSnippet ?? "");
      return {
        itemId: slugId("dealnews", item.guid ?? item.link ?? item.title ?? ""),
        title: item.title ?? "DealNews deal",
        currentPrice: price,
        imageUrl: null,
        itemUrl: item.link ?? "",
        seller: "DealNews",
        sellerFeedbackScore: null,
        condition: "New",
        category: item.categories?.[0] ?? "Deals",
        source: "dealnews",
        description: item.contentSnippet ?? null,
      };
    });
  } catch (err) {
    logger.error({ err }, "DealNews RSS parse error");
    return [];
  }
}

/* ─────────────────────────────────────────────
   3. Reddit JSON API (no credentials needed)
   Scans r/deals, r/buildapcsales, r/frugalmalefashion
   ───────────────────────────────────────────── */
const REDDIT_DEAL_SUBS = ["deals", "buildapcsales", "frugalmalefashion", "gamedeals"];

export async function fetchRedditDeals(keyword: string): Promise<SourceItem[]> {
  const results: SourceItem[] = [];

  for (const sub of REDDIT_DEAL_SUBS) {
    const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(keyword)}&sort=new&limit=10&restrict_sr=1`;
    const res = await safeFetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res) continue;

    try {
      const data = (await res.json()) as any;
      const posts = data?.data?.children ?? [];
      for (const post of posts) {
        const p = post?.data;
        if (!p || p.is_self === false && !p.url) continue;
        if (p.score < 10) continue;

        const price = extractPrice(p.title ?? "");
        results.push({
          itemId: slugId("reddit", p.id ?? p.url ?? ""),
          title: p.title ?? "Reddit deal",
          currentPrice: price,
          imageUrl: p.thumbnail?.startsWith("http") ? p.thumbnail : null,
          itemUrl: p.url ?? `https://reddit.com${p.permalink}`,
          seller: `r/${sub}`,
          sellerFeedbackScore: p.score ?? null,
          condition: "Unknown",
          category: sub,
          source: "reddit",
          description: p.selftext?.slice(0, 300) ?? null,
        });
      }
    } catch (err) {
      logger.warn({ sub, err }, "Reddit parse error");
    }
  }

  return results;
}

/* ─────────────────────────────────────────────
   4. Craigslist RSS (US, for sale category)
   ───────────────────────────────────────────── */
const CRAIGSLIST_CITIES = ["sfbay", "newyork", "chicago", "losangeles", "seattle"];

export async function fetchCraigslist(keyword: string, maxPrice?: number): Promise<SourceItem[]> {
  const results: SourceItem[] = [];

  for (const city of CRAIGSLIST_CITIES) {
    const priceParam = maxPrice ? `&max_price=${maxPrice}` : "";
    const url = `https://${city}.craigslist.org/search/sss?format=rss&query=${encodeURIComponent(keyword)}${priceParam}`;
    const res = await safeFetch(url);
    if (!res) continue;

    try {
      const xml = await res.text();
      const feed = await rssParser.parseString(xml);
      for (const item of (feed.items ?? []).slice(0, 5)) {
        const price = extractPrice(item.title ?? "") ?? extractPrice(item.contentSnippet ?? "");
        const enclosure = (item as any).enclosure;
        results.push({
          itemId: slugId("craigslist", item.guid ?? item.link ?? ""),
          title: item.title ?? "Craigslist listing",
          currentPrice: price,
          imageUrl: enclosure?.url ?? null,
          itemUrl: item.link ?? "",
          seller: `Craigslist / ${city}`,
          sellerFeedbackScore: null,
          condition: "Unknown",
          category: "For Sale",
          source: "craigslist",
          description: item.contentSnippet ?? null,
        });
      }
    } catch (err) {
      logger.warn({ city, err }, "Craigslist RSS parse error");
    }
  }

  return results;
}

/* ─────────────────────────────────────────────
   5. Google Shopping (scrape, no API key)
   ───────────────────────────────────────────── */
export async function fetchGoogleShopping(keyword: string, maxPrice?: number): Promise<SourceItem[]> {
  const priceParam = maxPrice ? `&tbs=mr:1,price:1,ppr_max:${maxPrice}` : "";
  const url = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&tbm=shop${priceParam}&num=10`;
  const res = await safeFetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res) return [];

  try {
    const html = await res.text();
    const $ = cheerio.load(html);
    const results: SourceItem[] = [];

    $(".sh-dgr__content, .sh-pr__product-results-grid .sh-dlr__list-result").each((i, el) => {
      if (i >= 8) return false;
      const title = $(el).find("h3, .tAxDx, .Xjkr3b").first().text().trim();
      const priceText = $(el).find(".a8Pemb, .OFFNJ").first().text().trim();
      const price = extractPrice(priceText);
      const link = $(el).find("a").first().attr("href");
      const img = $(el).find("img").first().attr("src");
      const seller = $(el).find(".aULzUe, .IuHnof").first().text().trim();

      if (!title || !link) return;

      results.push({
        itemId: slugId("google-shopping", `${keyword}-${i}`),
        title,
        currentPrice: price,
        imageUrl: img?.startsWith("http") ? img : null,
        itemUrl: link.startsWith("http") ? link : `https://www.google.com${link}`,
        seller: seller || "Google Shopping",
        sellerFeedbackScore: null,
        condition: "New",
        category: "Shopping",
        source: "google-shopping",
        description: null,
      });
    });

    return results;
  } catch (err) {
    logger.error({ err }, "Google Shopping scrape error");
    return [];
  }
}

/* ─────────────────────────────────────────────
   Aggregate all sources
   ───────────────────────────────────────────── */
export async function fetchAllSources(
  keyword: string,
  maxPrice?: number
): Promise<SourceItem[]> {
  const [slickdeals, dealnews, reddit, craigslist, google] = await Promise.allSettled([
    fetchSlickdeals(keyword),
    fetchDealNews(keyword),
    fetchRedditDeals(keyword),
    fetchCraigslist(keyword, maxPrice),
    fetchGoogleShopping(keyword, maxPrice),
  ]);

  const all: SourceItem[] = [
    ...(slickdeals.status === "fulfilled" ? slickdeals.value : []),
    ...(dealnews.status === "fulfilled" ? dealnews.value : []),
    ...(reddit.status === "fulfilled" ? reddit.value : []),
    ...(craigslist.status === "fulfilled" ? craigslist.value : []),
    ...(google.status === "fulfilled" ? google.value : []),
  ];

  logger.info(
    {
      keyword,
      slickdeals: slickdeals.status === "fulfilled" ? slickdeals.value.length : 0,
      dealnews: dealnews.status === "fulfilled" ? dealnews.value.length : 0,
      reddit: reddit.status === "fulfilled" ? reddit.value.length : 0,
      craigslist: craigslist.status === "fulfilled" ? craigslist.value.length : 0,
      google: google.status === "fulfilled" ? google.value.length : 0,
      total: all.length,
    },
    "Source aggregation complete"
  );

  return all;
}
