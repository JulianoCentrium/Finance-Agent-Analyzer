import type { Request, Response, NextFunction } from "express";
import { extractTokenFromHeader, verifyToken, type JWTPayload } from "../lib/auth-local";

export interface AuthRequest extends Request {
  auth?: JWTPayload;
  authId?: number;
  clerkUserId?: string;
}

/**
 * Middleware to verify JWT token
 * Token should be in Authorization header: Bearer <token>
 * If no token is provided, auth will be undefined (optional)
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.auth = payload;
      req.authId = payload.authId;
      req.clerkUserId = String(payload.authId);
    }
  }

  next();
}

/**
 * Middleware that requires authentication
 * Returns 401 if no valid token is provided
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
