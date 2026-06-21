import { Router, type IRouter } from "express";
import { db, alertConfigsTable, alertLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateAlertConfigBody,
  UpdateAlertConfigBody,
  ListAlertConfigsResponse,
  UpdateAlertConfigParams,
  UpdateAlertConfigResponse,
  DeleteAlertConfigParams,
  DeleteAlertConfigResponse,
  TestAlertConfigParams,
  TestAlertConfigResponse,
  ListAlertLogsParams,
  ListAlertLogsResponse,
} from "@workspace/api-zod";
import { sendTestAlert } from "../lib/alerter";

const router: IRouter = Router();

function serializeConfig(c: typeof alertConfigsTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    type: c.type as "webhook" | "discord" | "slack",
    url: c.url,
    minScore: parseFloat(String(c.minScore)),
    enabled: c.enabled,
    createdAt: c.createdAt.toISOString(),
  };
}

function serializeLog(l: typeof alertLogsTable.$inferSelect) {
  return {
    id: l.id,
    alertConfigId: l.alertConfigId,
    dealId: l.dealId,
    success: l.success,
    errorMessage: l.errorMessage,
    sentAt: l.sentAt.toISOString(),
  };
}

router.get("/v1/alerts", async (_req, res): Promise<void> => {
  const configs = await db
    .select()
    .from(alertConfigsTable)
    .orderBy(alertConfigsTable.createdAt);
  res.json(ListAlertConfigsResponse.parse(configs.map(serializeConfig)));
});

router.post("/v1/alerts", async (req, res): Promise<void> => {
  const parsed = CreateAlertConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [config] = await db
    .insert(alertConfigsTable)
    .values({
      name: parsed.data.name,
      type: parsed.data.type ?? "webhook",
      url: parsed.data.url,
      minScore: parsed.data.minScore != null ? String(parsed.data.minScore) : "7",
      enabled: parsed.data.enabled ?? true,
    })
    .returning();

  res.status(201).json(serializeConfig(config));
});

router.patch("/v1/alerts/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateAlertConfigParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAlertConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof alertConfigsTable.$inferInsert> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.type != null) updates.type = parsed.data.type;
  if (parsed.data.url != null) updates.url = parsed.data.url;
  if (parsed.data.minScore != null) updates.minScore = String(parsed.data.minScore);
  if (parsed.data.enabled != null) updates.enabled = parsed.data.enabled;

  const [config] = await db
    .update(alertConfigsTable)
    .set(updates)
    .where(eq(alertConfigsTable.id, params.data.id))
    .returning();

  if (!config) {
    res.status(404).json({ error: "Alert config not found" });
    return;
  }

  res.json(UpdateAlertConfigResponse.parse(serializeConfig(config)));
});

router.delete("/v1/alerts/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteAlertConfigParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [config] = await db
    .delete(alertConfigsTable)
    .where(eq(alertConfigsTable.id, params.data.id))
    .returning();

  if (!config) {
    res.status(404).json({ error: "Alert config not found" });
    return;
  }

  res.json(DeleteAlertConfigResponse.parse(serializeConfig(config)));
});

router.post("/v1/alerts/:id/test", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = TestAlertConfigParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await sendTestAlert(params.data.id);
  res.json(TestAlertConfigResponse.parse(result));
});

router.get("/v1/alerts/:id/logs", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ListAlertLogsParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const logs = await db
    .select()
    .from(alertLogsTable)
    .where(eq(alertLogsTable.alertConfigId, params.data.id))
    .orderBy(desc(alertLogsTable.sentAt))
    .limit(20);

  res.json(ListAlertLogsResponse.parse(logs.map(serializeLog)));
});

export default router;
