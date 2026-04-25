import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { scanUrl, mergeWithBrowserSignals } from "./scanner";
import { browserScan, interactionProbe, detectAIFromNetwork, detectFrameworkFromHints } from "./probeScanner";
import { insertScanSchema, insertSubscriptionSchema, type InsertUserSettings, type InsertScan } from "@shared/schema";
import { authMiddleware, requireAuth, requestMagicLink, verifyMagicLink, logout, type AuthenticatedRequest } from "./auth";
import { sendAdminNewScanNotification } from "./email";
import { sendSlackTestMessage } from "./slack";
import { manualScanNow, triggerImmediateScan } from "./background-worker";
import { showHnProducts, showHnReports, scans } from "@shared/schema";
import { db } from "./storage";
import { sql, desc as descOrder } from "drizzle-orm";
import { z } from "zod";

// In-memory queue for background scans
const backgroundScanQueue: Map<string, { phase: "render" | "probe"; url: string }> = new Map();

// Process background scans
async function processBackgroundScan(scanId: string, url: string, phase: "render" | "probe") {
  try {
    const existingScan = await storage.getScan(scanId);
    if (!existingScan) {
      console.error(`[Background] Scan ${scanId} not found`);
      return;
    }

    if (phase === "render") {
      console.log(`[Background] Starting render scan for ${scanId}`);
      
      await storage.updateScan(scanId, {
        scanPhases: { ...existingScan.scanPhases, render: "running" } as any,
      });

      try {
        const browserSignals = await browserScan(url);
        const aiFromNetwork = detectAIFromNetwork(browserSignals);
        const frameworkFromHints = detectFrameworkFromHints(browserSignals.windowHints);
        
        console.log(`[Background] Render complete for ${scanId}: ${browserSignals.network.domains.length} domains, ${browserSignals.network.paths.length} paths`);
        
        // Get current scan state to merge evidence
        const currentScan = await storage.getScan(scanId);
        if (!currentScan) return;

        const existingEvidence = currentScan.evidence || {};
        const mergedEvidence = {
          ...existingEvidence,
          networkDomains: browserSignals.network.domains,
          networkPaths: browserSignals.network.paths,
          websockets: browserSignals.network.websockets,
          windowHints: browserSignals.windowHints,
        };

        // Update detections from browser signals
        const updates: any = {
          scanPhases: { ...currentScan.scanPhases, render: "complete" },
          evidence: mergedEvidence,
          scanMode: "render",
        };

        // Upgrade detections if browser found better evidence
        if (aiFromNetwork.provider && (!currentScan.aiProvider || aiFromNetwork.confidence === "High")) {
          updates.aiProvider = aiFromNetwork.provider;
          updates.aiConfidence = aiFromNetwork.confidence;
        }
        if (aiFromNetwork.gateway) {
          updates.aiGateway = aiFromNetwork.gateway;
        }
        if (frameworkFromHints.framework && !currentScan.framework) {
          updates.framework = frameworkFromHints.framework;
          updates.frameworkConfidence = frameworkFromHints.confidence;
        }

        await storage.updateScan(scanId, updates);
        console.log(`[Background] Render scan saved for ${scanId}`);
      } catch (renderError) {
        console.error(`[Background] Render scan failed for ${scanId}:`, renderError);
        await storage.updateScan(scanId, {
          scanPhases: { ...existingScan.scanPhases, render: "failed" } as any,
        });
      }
    } else if (phase === "probe") {
      console.log(`[Background] Starting probe scan for ${scanId}`);
      
      await storage.updateScan(scanId, {
        scanPhases: { ...existingScan.scanPhases, probe: "running" } as any,
      });

      try {
        const interactionResult = await interactionProbe(url);
        
        const currentScan = await storage.getScan(scanId);
        if (!currentScan) return;

        const updates: any = {
          scanPhases: { ...currentScan.scanPhases, probe: "complete" },
          scanMode: "probe",
        };

        if (interactionResult.detectedProvider) {
          updates.aiProvider = interactionResult.detectedProvider;
          updates.aiConfidence = "High";
        }
        if (interactionResult.inferredModel) {
          updates.inferredModel = interactionResult.inferredModel;
        }
        if (interactionResult.aiInteraction) {
          updates.ttft = `${interactionResult.aiInteraction.ttft}ms`;
          updates.tps = `${interactionResult.aiInteraction.tps} tokens/sec`;
        }

        await storage.updateScan(scanId, updates);
        console.log(`[Background] Probe scan saved for ${scanId}`);
      } catch (probeError) {
        console.error(`[Background] Probe scan failed for ${scanId}:`, probeError);
        await storage.updateScan(scanId, {
          scanPhases: { ...existingScan.scanPhases, probe: "failed" } as any,
        });
      }
    }
  } catch (error) {
    console.error(`[Background] Error processing scan ${scanId}:`, error);
  } finally {
    backgroundScanQueue.delete(scanId);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Apply auth middleware to all routes
  app.use(authMiddleware);

  // === AUTH ROUTES ===
  
  // Request magic link
  app.post("/api/auth/magic-link", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }

      const protocol = req.headers["x-forwarded-proto"] || "http";
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      const result = await requestMagicLink(email, baseUrl);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json({ success: true, message: "Check your email for a sign-in link" });
    } catch (error) {
      console.error("Magic link error:", error);
      return res.status(500).json({ error: "Failed to send magic link" });
    }
  });

  // Verify magic link
  app.get("/api/auth/verify", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Invalid token" });
      }

      const userAgent = req.headers["user-agent"];
      const ipAddress = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.ip;

      const result = await verifyMagicLink(token, res, userAgent, ipAddress);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json({ success: true, user: result.user });
    } catch (error) {
      console.error("Verify error:", error);
      return res.status(500).json({ error: "Verification failed" });
    }
  });

  // Get current user
  app.get("/api/auth/me", (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    return res.json({ user: req.user });
  });

  // Logout
  app.post("/api/auth/logout", async (req: AuthenticatedRequest, res) => {
    await logout(req, res);
    return res.json({ success: true });
  });

  // === USER DASHBOARD ROUTES ===

  // Get user's scans
  app.get("/api/me/scans", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const scans = await storage.getUserScans(req.user!.id, limit);
      return res.json(scans);
    } catch (error) {
      console.error("Get user scans error:", error);
      return res.status(500).json({ error: "Failed to get scans" });
    }
  });

  // Get user's subscriptions
  app.get("/api/me/subscriptions", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const subscriptions = await storage.getUserSubscriptions(req.user!.id);
      return res.json(subscriptions);
    } catch (error) {
      console.error("Get subscriptions error:", error);
      return res.status(500).json({ error: "Failed to get subscriptions" });
    }
  });

  // Create subscription / watchlist entry — enforces Free 5-domain cap
  app.post("/api/me/subscriptions", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { url, displayLabel, alertThreshold } = req.body;
      
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }

      // Extract domain from URL
      let domain: string;
      try {
        const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
        domain = urlObj.hostname.replace(/^www\./, "");
      } catch {
        return res.status(400).json({ error: "Invalid URL" });
      }

      // Free-plan 5-domain cap
      const isPro = req.user!.planTier === "pro";
      if (!isPro) {
        const count = await storage.countUserSubscriptions(req.user!.id);
        if (count >= 5) {
          return res.status(402).json({
            error: "free-plan-watchlist-cap",
            message: "Free plan is limited to 5 watched domains. Upgrade to Pro for unlimited.",
          });
        }
      }

      // De-dup by domain per user
      const existing = await storage.getSubscriptionByDomain(req.user!.id, domain);
      if (existing) {
        return res.status(409).json({ error: "already-watching", subscription: existing });
      }

      const subscription = await storage.createSubscription({
        userId: req.user!.id,
        url: url.startsWith("http") ? url : `https://${url}`,
        domain,
        displayLabel: displayLabel || domain,
        alertThreshold: alertThreshold || "any_change",
      });

      // Schedule the first scan immediately + fire-and-forget the actual scan so the
      // baseline result is captured without waiting for the next worker tick.
      await storage.updateSubscription(subscription.id, { nextScanAt: new Date() });
      void triggerImmediateScan(subscription.id);

      return res.json(subscription);
    } catch (error) {
      console.error("Create subscription error:", error);
      return res.status(500).json({ error: "Failed to create subscription" });
    }
  });

  // Update subscription / watchlist entry
  app.patch("/api/me/subscriptions/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const subscription = await storage.getSubscription(id);
      
      if (!subscription || subscription.userId !== req.user!.id) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      const { isActive, notifyOnChange, displayLabel, alertThreshold, slackEnabled, pausedUntil } = req.body;
      const updates: any = {};
      
      if (typeof isActive === "boolean") updates.isActive = isActive;
      if (typeof notifyOnChange === "boolean") updates.notifyOnChange = notifyOnChange;
      if (typeof displayLabel === "string") updates.displayLabel = displayLabel;
      if (typeof alertThreshold === "string") updates.alertThreshold = alertThreshold;
      if (typeof slackEnabled === "boolean") updates.slackEnabled = slackEnabled;
      if (pausedUntil === null) updates.pausedUntil = null;
      else if (typeof pausedUntil === "string") updates.pausedUntil = new Date(pausedUntil);

      const updated = await storage.updateSubscription(id, updates);
      return res.json(updated);
    } catch (error) {
      console.error("Update subscription error:", error);
      return res.status(500).json({ error: "Failed to update subscription" });
    }
  });

  // Manual "Scan Now" — Pro 3×/day, Free 1×/week
  app.post("/api/me/subscriptions/:id/scan-now", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const subscription = await storage.getSubscription(id);
      if (!subscription || subscription.userId !== req.user!.id) {
        return res.status(404).json({ error: "Subscription not found" });
      }
      const result = await manualScanNow(id);
      if (!result.ok) {
        const status = result.reason?.startsWith("limit-") ? 429 : 400;
        return res.status(status).json({ error: result.reason || "scan-failed" });
      }
      return res.json({ ok: true, scan: result.scan });
    } catch (error) {
      console.error("Scan-now error:", error);
      return res.status(500).json({ error: "Failed to trigger scan" });
    }
  });

  // Dismiss a change event as a false positive (suppresses similar alerts for 30 days)
  app.post("/api/me/subscriptions/:id/changes/:changeId/dismiss", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id, changeId } = req.params;
      const subscription = await storage.getSubscription(id);
      if (!subscription || subscription.userId !== req.user!.id) {
        return res.status(404).json({ error: "Subscription not found" });
      }
      const change = await storage.getChangeEvent(changeId);
      if (!change || change.subscriptionId !== id) {
        return res.status(404).json({ error: "Change not found" });
      }
      const dismissUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await storage.dismissChangeEvent(changeId, dismissUntil);
      return res.json({ ok: true, dismissedUntil: dismissUntil });
    } catch (error) {
      console.error("Dismiss change error:", error);
      return res.status(500).json({ error: "Failed to dismiss change" });
    }
  });

  // Delete subscription
  app.delete("/api/me/subscriptions/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const subscription = await storage.getSubscription(id);
      
      if (!subscription || subscription.userId !== req.user!.id) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      await storage.deleteSubscription(id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Delete subscription error:", error);
      return res.status(500).json({ error: "Failed to delete subscription" });
    }
  });

  // Get subscription change events
  app.get("/api/me/subscriptions/:id/changes", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const subscription = await storage.getSubscription(id);
      
      if (!subscription || subscription.userId !== req.user!.id) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      const changes = await storage.getSubscriptionChangeEvents(id);
      return res.json(changes);
    } catch (error) {
      console.error("Get change events error:", error);
      return res.status(500).json({ error: "Failed to get change events" });
    }
  });

  // Update user profile (displayName / global notifications toggle)
  app.patch("/api/me/settings", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { displayName, notificationsEnabled } = req.body;
      const updates: any = {};
      
      if (typeof displayName === "string") updates.displayName = displayName;
      if (typeof notificationsEnabled === "boolean") updates.notificationsEnabled = notificationsEnabled;

      const updated = await storage.updateUser(req.user!.id, updates);
      return res.json(updated);
    } catch (error) {
      console.error("Update settings error:", error);
      return res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // ─── Alert settings (per playbook §3.5) ───
  app.get("/api/me/alert-settings", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      let settings = await storage.getUserSettings(req.user!.id);
      if (!settings) {
        settings = await storage.upsertUserSettings(req.user!.id, {});
      }
      // Don't leak the raw webhook URL — return a masked indicator
      return res.json({
        ...settings,
        slackWebhookUrl: settings.slackWebhookUrl ? "***configured***" : null,
        slackWebhookConfigured: !!settings.slackWebhookUrl,
      });
    } catch (error) {
      console.error("Get alert settings error:", error);
      return res.status(500).json({ error: "Failed to get alert settings" });
    }
  });

  app.patch("/api/me/alert-settings", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const ianaTz = z.string().min(1).max(64).refine(
        (tz) => {
          try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
        },
        { message: "Invalid IANA timezone" },
      );
      const slackUrl = z.string().trim().refine(
        (s) => s === "" || /^https:\/\/hooks\.slack\.com\//.test(s),
        { message: "Slack webhook must start with https://hooks.slack.com/" },
      );
      const hour = z.number().int().min(0).max(23);

      const alertSettingsPatchSchema = z.object({
        emailAlertsEnabled: z.boolean().optional(),
        slackAlertsEnabled: z.boolean().optional(),
        slackWebhookUrl: slackUrl.optional().nullable(),
        alertFrequencyCap: z.enum(["immediate", "max_1_per_day", "max_1_per_week"]).optional(),
        globalAlertThreshold: z.enum(["any_change", "high_confidence_only", "provider_added_removed"]).optional(),
        minConfidenceToAlert: z.enum(["low", "medium", "high"]).optional(),
        quietHoursStart: hour.nullable().optional(),
        quietHoursEnd: hour.nullable().optional(),
        timezone: ianaTz.optional(),
        alertDigestMode: z.enum(["individual", "daily_bundle"]).optional(),
        digestEnabled: z.boolean().optional(),
      }).strict();

      const parsed = alertSettingsPatchSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid alert settings",
          issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        });
      }
      const updates: Partial<InsertUserSettings> = { ...parsed.data };
      // Normalize empty Slack webhook to null so we can clear it
      if (typeof updates.slackWebhookUrl === "string") {
        updates.slackWebhookUrl = updates.slackWebhookUrl.trim() || null;
      }

      const settings = await storage.upsertUserSettings(req.user!.id, updates);
      return res.json({
        ...settings,
        slackWebhookUrl: settings.slackWebhookUrl ? "***configured***" : null,
        slackWebhookConfigured: !!settings.slackWebhookUrl,
      });
    } catch (error) {
      console.error("Update alert settings error:", error);
      return res.status(500).json({ error: "Failed to update alert settings" });
    }
  });

  // Test the user's saved Slack webhook
  app.post("/api/me/alert-settings/slack-test", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const settings = await storage.getUserSettings(req.user!.id);
      if (!settings?.slackWebhookUrl) {
        return res.status(400).json({ error: "No Slack webhook configured" });
      }
      const ok = await sendSlackTestMessage(settings.slackWebhookUrl);
      if (!ok) return res.status(502).json({ error: "Slack webhook delivery failed" });
      return res.json({ ok: true });
    } catch (error) {
      console.error("Slack test error:", error);
      return res.status(500).json({ error: "Failed to test webhook" });
    }
  });

  // Progressive scan endpoint - returns immediately after passive, queues render
  app.post("/api/scan", async (req: AuthenticatedRequest, res) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }

      console.log(`[API] Starting progressive scan for: ${url}`);
      const startTime = Date.now();

      // Phase 1: Passive scan (immediate)
      let scanResult = await scanUrl(url);
      const passiveTime = Date.now() - startTime;
      console.log(`[API] Passive scan completed in ${passiveTime}ms`);

      // Set initial phase status + link to user if authenticated.
      const enriched: Record<string, unknown> = {
        ...scanResult,
        scanPhases: { passive: "complete", render: "pending", probe: "locked" },
        scanMode: "passive",
        ...(req.user ? { userId: req.user.id } : {}),
      };

      // Save to database. The Zod parse return-type does not include
      // server-defaulted columns (id, scannedAt) that Drizzle's $inferInsert
      // accepts as optional, so cast to InsertScan for the storage layer.
      const validatedScan = insertScanSchema.parse(enriched) as InsertScan;
      const savedScan = await storage.createScan(validatedScan);
      
      // Notify admin of new scan (fire and forget)
      sendAdminNewScanNotification(
        savedScan.domain || new URL(savedScan.url).hostname,
        savedScan.url,
        req.user?.email
      ).catch(err => {
        console.error("[API] Failed to notify admin of scan:", err);
      });
      
      // Queue render scan in background
      console.log(`[API] Queuing render scan for ${savedScan.id}`);
      backgroundScanQueue.set(savedScan.id, { phase: "render", url: savedScan.url });
      
      // Start background scan (don't await)
      processBackgroundScan(savedScan.id, savedScan.url, "render").catch(err => {
        console.error(`[API] Background render scan error:`, err);
      });
      
      return res.json(savedScan);
    } catch (error) {
      console.error("Scan error:", error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : "Scan failed" 
      });
    }
  });

  // Trigger probe scan for existing scan
  app.post("/api/scan/:id/probe", async (req, res) => {
    try {
      const { id } = req.params;
      const scan = await storage.getScan(id);
      
      if (!scan) {
        return res.status(404).json({ error: "Scan not found" });
      }

      // Check if render is complete before allowing probe
      if (scan.scanPhases?.render !== "complete" && scan.scanPhases?.render !== "failed") {
        return res.status(400).json({ error: "Wait for render scan to complete first" });
      }

      // Check if probe is already running
      if (scan.scanPhases?.probe === "running") {
        return res.status(400).json({ error: "Probe scan already in progress" });
      }

      console.log(`[API] Triggering probe scan for ${id}`);
      
      // Queue probe scan
      backgroundScanQueue.set(id, { phase: "probe", url: scan.url });
      
      // Update status to pending
      await storage.updateScan(id, {
        scanPhases: { ...scan.scanPhases, probe: "pending" } as any,
      });
      
      // Start background probe (don't await)
      processBackgroundScan(id, scan.url, "probe").catch(err => {
        console.error(`[API] Background probe scan error:`, err);
      });
      
      return res.json({ message: "Probe scan started", scanId: id });
    } catch (error) {
      console.error("Probe trigger error:", error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to start probe scan" 
      });
    }
  });

  // Get scan status (for polling)
  app.get("/api/scan/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const scan = await storage.getScan(id);
      
      if (!scan) {
        return res.status(404).json({ error: "Scan not found" });
      }
      
      return res.json({
        id: scan.id,
        phases: scan.scanPhases || { passive: "complete", render: "pending", probe: "locked" },
        scanMode: scan.scanMode,
      });
    } catch (error) {
      console.error("Get status error:", error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to get status" 
      });
    }
  });

  // Get a scan by domain (most recent scan for that domain)
  app.get("/api/scan/domain/:domain", async (req, res) => {
    try {
      const { domain } = req.params;
      const scan = await storage.getScanByDomain(decodeURIComponent(domain));
      
      if (!scan) {
        return res.status(404).json({ error: "Scan not found" });
      }
      
      return res.json(scan);
    } catch (error) {
      console.error("Get scan by domain error:", error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to retrieve scan" 
      });
    }
  });

  // Get a scan by ID
  app.get("/api/scan/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const scan = await storage.getScan(id);
      
      if (!scan) {
        return res.status(404).json({ error: "Scan not found" });
      }
      
      return res.json(scan);
    } catch (error) {
      console.error("Get scan error:", error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to retrieve scan" 
      });
    }
  });

  // Get recent scans
  app.get("/api/scans/recent", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const recentScans = await storage.getRecentScans(limit);
      return res.json(recentScans);
    } catch (error) {
      console.error("Get recent scans error:", error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to retrieve scans" 
      });
    }
  });

  // === SHOW HN REPORT ROUTES ===
  
  // Get latest Show HN report
  app.get("/api/showhn/report", async (req, res) => {
    try {
      const [report] = await db.select()
        .from(showHnReports)
        .orderBy(descOrder(showHnReports.generatedAt))
        .limit(1);
      
      if (!report) {
        return res.status(404).json({ error: "No report found. Run the Show HN job first." });
      }
      
      return res.json(report);
    } catch (error) {
      console.error("Get Show HN report error:", error);
      return res.status(500).json({ error: "Failed to get report" });
    }
  });

  // Get Show HN products with scan data
  app.get("/api/showhn/products", async (req, res) => {
    try {
      const products = await db.select({
        product: showHnProducts,
        scan: scans,
      })
        .from(showHnProducts)
        .leftJoin(scans, sql`${showHnProducts.scanId} = ${scans.id}`)
        .orderBy(descOrder(sql`CAST(${showHnProducts.score} AS INTEGER)`));
      
      return res.json(products);
    } catch (error) {
      console.error("Get Show HN products error:", error);
      return res.status(500).json({ error: "Failed to get products" });
    }
  });

  // Get Show HN CSV export
  app.get("/api/showhn/export.csv", async (req, res) => {
    try {
      const products = await db.select({
        product: showHnProducts,
        scan: scans,
      })
        .from(showHnProducts)
        .leftJoin(scans, sql`${showHnProducts.scanId} = ${scans.id}`)
        .orderBy(descOrder(sql`CAST(${showHnProducts.score} AS INTEGER)`));
      
      const headers = [
        "HN ID", "Title", "Author", "Score", "Comments", "Domain",
        "Product URL", "HN Link", "Framework", "Hosting", "Payments",
        "Auth", "Analytics", "AI Provider", "Report Link"
      ];
      
      const rows = products.map(({ product, scan }) => [
        product.hnId,
        `"${(product.title || "").replace(/"/g, '""')}"`,
        product.author,
        product.score,
        product.commentsCount,
        product.domain,
        product.productUrl,
        product.hnLink,
        scan?.framework || "",
        scan?.hosting || "",
        scan?.payments || "",
        scan?.auth || "",
        scan?.analytics || "",
        scan?.aiProvider || "",
        scan ? `/scan/${product.domain}` : "",
      ]);
      
      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=showhn-stack-report.csv");
      return res.send(csv);
    } catch (error) {
      console.error("Export CSV error:", error);
      return res.status(500).json({ error: "Failed to export CSV" });
    }
  });

  return httpServer;
}
