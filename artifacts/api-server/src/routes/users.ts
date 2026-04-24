import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  GetCurrentUserResponse,
  UpdateCurrentUserBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { type AuthRequest } from "../middlewares/authMiddleware";

const router: IRouter = Router();

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const clerkUserId = authReq.clerkUserId ?? (authReq.auth ? String(authReq.auth.authId) : undefined);

  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId));

  if (existing) {
    res.json(GetCurrentUserResponse.parse({ 
      ...existing, 
      createdAt: existing.createdAt.toISOString(), 
      updatedAt: existing.updatedAt.toISOString() 
    }));
    return;
  }

  const [created] = await db
    .insert(usersTable)
    .values({ 
      clerkUserId,
      email: authReq.auth.email,
      name: authReq.auth.email.split("@")[0],
    })
    .returning();

  res.json(GetCurrentUserResponse.parse({ 
    ...created, 
    createdAt: created.createdAt.toISOString(), 
    updatedAt: created.updatedAt.toISOString() 
  }));
});

router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const clerkUserId = authReq.clerkUserId ?? (authReq.auth ? String(authReq.auth.authId) : undefined);

  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = UpdateCurrentUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId));

  let user: typeof usersTable.$inferSelect;

  if (existing) {
    const [updated] = await db
      .update(usersTable)
      .set(parsed.data)
      .where(eq(usersTable.clerkUserId, clerkUserId))
      .returning();
    user = updated;
  } else {
    const [created] = await db
      .insert(usersTable)
      .values({ clerkUserId, ...parsed.data })
      .returning();
    user = created;
  }

  res.json(GetCurrentUserResponse.parse({ 
    ...user, 
    createdAt: user.createdAt.toISOString(), 
    updatedAt: user.updatedAt.toISOString() 
  }));
});

export default router;

