import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { scanUrl, mergeWithBrowserSignals } from "./scanner";
import { browserScan, interactionProbe, detectAIFromNetwork, detectFrameworkFromHints } from "./probeScanner";
import { insertScanSchema } from "@shared/schema";

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
  // Progressive scan endpoint - returns immediately after passive, queues render
  app.post("/api/scan", async (req, res) => {
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

      // Set initial phase status
      (scanResult as any).scanPhases = {
        passive: "complete",
        render: "pending",
        probe: "locked",
      };
      scanResult.scanMode = "passive";

      // Save to database
      const validatedScan = insertScanSchema.parse(scanResult);
      const savedScan = await storage.createScan(validatedScan);
      
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
      const scans = await storage.getRecentScans(limit);
      return res.json(scans);
    } catch (error) {
      console.error("Get recent scans error:", error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to retrieve scans" 
      });
    }
  });

  return httpServer;
}
