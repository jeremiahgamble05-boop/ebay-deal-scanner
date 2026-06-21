import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const alertLogsTable = pgTable("alert_logs", {
  id: serial("id").primaryKey(),
  alertConfigId: integer("alert_config_id").notNull(),
  dealId: integer("deal_id").notNull(),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAlertLogSchema = createInsertSchema(alertLogsTable).omit({ id: true });
export type InsertAlertLog = z.infer<typeof insertAlertLogSchema>;
export type AlertLog = typeof alertLogsTable.$inferSelect;
