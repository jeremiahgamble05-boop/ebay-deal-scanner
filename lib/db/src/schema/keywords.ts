import { pgTable, text, serial, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const keywordsTable = pgTable("keywords", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull().unique(),
  maxPrice: numeric("max_price", { precision: 10, scale: 2 }),
  minDiscount: numeric("min_discount", { precision: 5, scale: 2 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertKeywordSchema = createInsertSchema(keywordsTable).omit({ id: true, createdAt: true });
export type InsertKeyword = z.infer<typeof insertKeywordSchema>;
export type Keyword = typeof keywordsTable.$inferSelect;
