import { pgTable, text, serial, timestamp, numeric, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dealsTable = pgTable("deals", {
  id: serial("id").primaryKey(),
  ebayItemId: text("ebay_item_id").notNull().unique(),
  title: text("title").notNull(),
  currentPrice: numeric("current_price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: numeric("original_price", { precision: 10, scale: 2 }),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }),
  imageUrl: text("image_url"),
  itemUrl: text("item_url").notNull(),
  seller: text("seller").notNull(),
  sellerRating: numeric("seller_rating", { precision: 5, scale: 2 }),
  condition: text("condition").notNull().default("Unknown"),
  aiScore: numeric("ai_score", { precision: 4, scale: 2 }),
  aiAnalysis: text("ai_analysis"),
  category: text("category"),
  keyword: text("keyword").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDealSchema = createInsertSchema(dealsTable).omit({ id: true, createdAt: true });
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof dealsTable.$inferSelect;
