import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, authTable, usersTable } from "@workspace/db";
import { hashPassword, comparePassword, generateToken } from "../lib/auth-local";
import { requireAuth, type AuthRequest } from "../middlewares/authMiddleware";

const router: IRouter = Router();

/**
 * Check if this is first-time setup (no users exist yet)
 */
router.get("/auth/setup", async (req, res): Promise<void> => {
  const count = await db.select().from(authTable);
  res.json({
    setupRequired: count.length === 0,
    userCount: count.length,
  });
});

/**
 * Register new user
 * First account is admin; all others are standard users.
 */
router.post("/auth/register", async (req, res): Promise<void> => {
  const rawEmail = String(req.body?.email ?? "");
  const rawPassword = String(req.body?.password ?? "");
  const email = rawEmail.trim().toLowerCase();
  const password = rawPassword.trim();

  // Validate input
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  try {
    // First account becomes admin.
    const [firstUser] = await db.select().from(authTable).limit(1);
    const isFirstUser = !firstUser;

    // Check if email already exists
    const [existing] = await db
      .select()
      .from(authTable)
      .where(eq(authTable.email, email));

    if (existing) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create auth record
    const [authRecord] = await db
      .insert(authTable)
      .values({
        email,
        password: hashedPassword,
        isAdmin: isFirstUser,
        active: true,
      })
      .returning();

    // Create associated user record
    await db
      .insert(usersTable)
      .values({
        email: authRecord.email,
        name: email.split("@")[0],
        clerkUserId: String(authRecord.id),
      })
      .returning();

    // Generate token
    const token = generateToken({
      authId: authRecord.id,
      email: authRecord.email,
      isAdmin: authRecord.isAdmin,
    });

    res.status(201).json({
      success: true,
      token,
      isFirstUser,
      user: {
        id: authRecord.id,
        email: authRecord.email,
        isAdmin: authRecord.isAdmin,
        isFirstUser,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * Login with email and password
 */
router.post("/auth/login", async (req, res): Promise<void> => {
  const rawEmail = String(req.body?.email ?? "");
  const rawPassword = String(req.body?.password ?? "");
  const email = rawEmail.trim().toLowerCase();
  const password = rawPassword.trim();

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    // Find user by email
    const [authRecord] = await db
      .select()
      .from(authTable)
      .where(eq(authTable.email, email));

    if (!authRecord) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (!authRecord.active) {
      res.status(403).json({ error: "Account is disabled" });
      return;
    }

    // Verify password
    const passwordMatch = await comparePassword(password, authRecord.password);
    if (!passwordMatch) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Generate token
    const token = generateToken({
      authId: authRecord.id,
      email: authRecord.email,
      isAdmin: authRecord.isAdmin,
    });

    res.json({
      success: true,
      token,
      user: {
        id: authRecord.id,
        email: authRecord.email,
        isAdmin: authRecord.isAdmin,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * Get current user info (requires auth)
 */
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  if (!authReq.auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [authRecord] = await db
      .select()
      .from(authTable)
      .where(eq(authTable.id, authReq.auth.authId));

    if (!authRecord) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: authRecord.id,
      email: authRecord.email,
      isAdmin: authRecord.isAdmin,
      active: authRecord.active,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

/**
 * Logout (client-side: just delete the token)
 * This endpoint is mainly for symmetry
 */
router.post("/auth/logout", requireAuth, (req, res): void => {
  // Token is stored client-side, so logout is just client-side deletion
  res.json({ success: true, message: "Logged out successfully" });
});

export default router;
