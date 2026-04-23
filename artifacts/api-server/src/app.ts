import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const allowedOrigins = (() => {
  const origins: string[] = [];
  // Dev preview domain set by Replit
  const devDomain = process.env["REPLIT_DEV_DOMAIN"];
  if (devDomain) origins.push(`https://${devDomain}`);
  // Explicit production origins — set ALLOWED_ORIGINS=https://your-app.replit.app at deploy time
  const domains = process.env["ALLOWED_ORIGINS"];
  if (domains) origins.push(...domains.split(",").map(o => o.trim()).filter(Boolean));
  return origins;
})();

app.use(cors({
  credentials: true,
  origin: (requestOrigin, callback) => {
    // Allow same-origin / server-to-server (no Origin header)
    if (!requestOrigin) return callback(null, true);
    // Exact match against explicit allowlist
    if (allowedOrigins.some(o => o === requestOrigin)) return callback(null, true);
    // Localhost is only permitted in development
    if (
      process.env["NODE_ENV"] !== "production" &&
      (requestOrigin.startsWith("http://localhost:") || requestOrigin.startsWith("http://127.0.0.1:"))
    ) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"), false);
  },
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", router);

export default app;
