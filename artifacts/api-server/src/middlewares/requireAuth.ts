import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../lib/auth";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = (auth?.sessionClaims?.userId ?? auth?.userId) as string | null | undefined;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthRequest).clerkUserId = userId;
  next();
}
