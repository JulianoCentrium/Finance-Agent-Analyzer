import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userSettingsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import type { AuthRequest } from "../lib/auth";
import { maskKey } from "../lib/openrouter";

const router: IRouter = Router();

router.get("/settings/openrouter", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const [row] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.clerkUserId, clerkUserId));
  res.json({
    configured: !!row?.openrouterApiKey,
    keyMasked: maskKey(row?.openrouterApiKey ?? null),
    model: row?.openrouterModel ?? null,
  });
});

router.put("/settings/openrouter", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : null;
  const model = typeof req.body?.model === "string" ? req.body.model.trim() || null : null;

  if (apiKey !== null && apiKey !== "" && !apiKey.startsWith("sk-")) {
    res.status(400).json({ error: "Chave inválida. Cole sua chave do OpenRouter (começa com sk-)." });
    return;
  }

  const [existing] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.clerkUserId, clerkUserId));
  if (existing) {
    await db
      .update(userSettingsTable)
      .set({
        openrouterApiKey: apiKey === "" ? existing.openrouterApiKey : apiKey,
        openrouterModel: model,
      })
      .where(eq(userSettingsTable.clerkUserId, clerkUserId));
  } else {
    await db.insert(userSettingsTable).values({
      clerkUserId,
      openrouterApiKey: apiKey,
      openrouterModel: model,
    });
  }

  const [row] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.clerkUserId, clerkUserId));
  res.json({
    configured: !!row?.openrouterApiKey,
    keyMasked: maskKey(row?.openrouterApiKey ?? null),
    model: row?.openrouterModel ?? null,
  });
});

router.delete("/settings/openrouter", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  await db
    .update(userSettingsTable)
    .set({ openrouterApiKey: null })
    .where(eq(userSettingsTable.clerkUserId, clerkUserId));
  res.sendStatus(204);
});

export default router;
