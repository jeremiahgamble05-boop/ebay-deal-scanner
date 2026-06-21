import { logger } from "./logger";

const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_API_URL = "https://svcs.ebay.com/services/search/FindingService/v1";

export interface EbayItem {
  itemId: string;
  title: string;
  currentPrice: number;
  imageUrl: string | null;
  itemUrl: string;
  seller: string;
  sellerFeedbackScore: number | null;
  condition: string;
  category: string | null;
}

export async function searchEbayItems(keyword: string, maxPrice?: number): Promise<EbayItem[]> {
  if (!EBAY_APP_ID) {
    logger.warn("EBAY_APP_ID not set — returning mock data");
    return getMockItems(keyword);
  }

  try {
    const params = new URLSearchParams({
      "OPERATION-NAME": "findItemsByKeywords",
      "SERVICE-VERSION": "1.0.0",
      "SECURITY-APPNAME": EBAY_APP_ID,
      "RESPONSE-DATA-FORMAT": "JSON",
      "REST-PAYLOAD": "",
      "keywords": keyword,
      "paginationInput.entriesPerPage": "20",
      "sortOrder": "PricePlusShippingLowest",
      "outputSelector(0)": "SellerInfo",
      "outputSelector(1)": "PictureURLSuperSize",
      "itemFilter(0).name": "ListingType",
      "itemFilter(0).value": "FixedPrice",
      "itemFilter(1).name": "Condition",
      "itemFilter(1).value(0)": "1000",
      "itemFilter(1).value(1)": "2000",
      "itemFilter(1).value(2)": "2500",
    });

    if (maxPrice) {
      params.append("itemFilter(2).name", "MaxPrice");
      params.append("itemFilter(2).value", String(maxPrice));
    }

    const response = await fetch(`${EBAY_API_URL}?${params.toString()}`);
    if (!response.ok) {
      logger.error({ status: response.status }, "eBay API error");
      return [];
    }

    const data = await response.json() as any;
    const searchResult = data?.findItemsByKeywordsResponse?.[0];
    if (searchResult?.ack?.[0] !== "Success") {
      logger.warn({ ack: searchResult?.ack }, "eBay search not successful");
      return [];
    }

    const items = searchResult?.searchResult?.[0]?.item ?? [];
    return items.map((item: any): EbayItem => {
      const price = parseFloat(item?.sellingStatus?.[0]?.currentPrice?.[0]?.["__value__"] ?? "0");
      return {
        itemId: item?.itemId?.[0] ?? "",
        title: item?.title?.[0] ?? "Unknown Item",
        currentPrice: price,
        imageUrl: item?.pictureURLSuperSize?.[0] ?? item?.galleryURL?.[0] ?? null,
        itemUrl: item?.viewItemURL?.[0] ?? "",
        seller: item?.sellerInfo?.[0]?.sellerUserName?.[0] ?? "Unknown",
        sellerFeedbackScore: item?.sellerInfo?.[0]?.feedbackScore?.[0]
          ? parseInt(item.sellerInfo[0].feedbackScore[0])
          : null,
        condition: item?.condition?.[0]?.conditionDisplayName?.[0] ?? "Unknown",
        category: item?.primaryCategory?.[0]?.categoryName?.[0] ?? null,
      };
    });
  } catch (err) {
    logger.error({ err }, "Error searching eBay");
    return [];
  }
}

function getMockItems(keyword: string): EbayItem[] {
  const mockItems: EbayItem[] = [
    {
      itemId: `mock-${Date.now()}-1`,
      title: `${keyword} - Excellent Deal Found`,
      currentPrice: 49.99,
      imageUrl: null,
      itemUrl: "https://www.ebay.com",
      seller: "top_seller_123",
      sellerFeedbackScore: 4892,
      condition: "Used",
      category: "Electronics",
    },
    {
      itemId: `mock-${Date.now()}-2`,
      title: `Vintage ${keyword} Bundle Lot`,
      currentPrice: 24.50,
      imageUrl: null,
      itemUrl: "https://www.ebay.com",
      seller: "vintage_finds",
      sellerFeedbackScore: 1204,
      condition: "For parts or not working",
      category: "Collectibles",
    },
    {
      itemId: `mock-${Date.now()}-3`,
      title: `${keyword} New Sealed Box`,
      currentPrice: 89.00,
      imageUrl: null,
      itemUrl: "https://www.ebay.com",
      seller: "electronics_deals",
      sellerFeedbackScore: 7843,
      condition: "New",
      category: "Electronics",
    },
  ];
  return mockItems;
}
