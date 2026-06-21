import { pgTable, text, serial, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const alertConfigsTable = pgTable("alert_configs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("webhook"), // webhook | discord | slack
  url: text("url").notNull(),
  minScore: numeric("min_score", { precision: 4, scale: 2 }).notNull().default("7"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAlertConfigSchema = createInsertSchema(alertConfigsTable).omit({ id: true, createdAt: true });
export type InsertAlertConfig = z.infer<typeof insertAlertConfigSchema>;
export type AlertConfig = typeof alertConfigsTable.$inferSelect;
