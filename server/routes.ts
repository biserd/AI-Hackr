import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { scanUrl, mergeWithBrowserSignals } from "./scanner";
import { browserScan, interactionProbe, detectAIFromNetwork, detectFrameworkFromHints } from "./probeScanner";
import { insertScanSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Scan endpoint - supports passive and probe modes
  app.post("/api/scan", async (req, res) => {
    try {
      const { url, mode = "passive" } = req.body;
      
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }

      console.log(`[API] Starting ${mode} scan for: ${url}`);
      const startTime = Date.now();

      // Perform passive scan first
      let scanResult = await scanUrl(url);
      const passiveTime = Date.now() - startTime;
      console.log(`[API] Passive scan completed in ${passiveTime}ms`);
      console.log(`[API] Detected: framework=${scanResult.framework}, hosting=${scanResult.hosting}, ai=${scanResult.aiProvider}`);

      // If probe mode requested, run browser scan with Playwright
      if (mode === "probe") {
        console.log("[API] Starting browser scan with Playwright...");
        const probeStartTime = Date.now();
        try {
          const browserSignals = await browserScan(url);
          const probeTime = Date.now() - probeStartTime;
          console.log(`[API] Browser scan completed in ${probeTime}ms`);
          console.log(`[API] Browser results: ${browserSignals.network.requests.length} requests, ${browserSignals.html.length} bytes HTML, ${browserSignals.network.domains.length} domains`);
          
          const aiFromNetwork = detectAIFromNetwork(browserSignals);
          const frameworkFromHints = detectFrameworkFromHints(browserSignals.windowHints);
          
          console.log(`[API] Detected from network: provider=${aiFromNetwork.provider}, gateway=${aiFromNetwork.gateway}`);
          console.log(`[API] Detected from hints: framework=${frameworkFromHints.framework}`);
          
          scanResult = mergeWithBrowserSignals(scanResult, browserSignals, aiFromNetwork, frameworkFromHints);
        } catch (probeError) {
          console.error("[API] Browser scan failed, using passive results:", probeError);
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`[API] Total scan time: ${totalTime}ms`);
      
      // Validate and save to database
      const validatedScan = insertScanSchema.parse(scanResult);
      const savedScan = await storage.createScan(validatedScan);
      
      return res.json(savedScan);
    } catch (error) {
      console.error("Scan error:", error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : "Scan failed" 
      });
    }
  });

  // Probe scan with interaction - deep AI detection with chat interaction
  app.post("/api/scan/probe", async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }

      console.log(`[API] Starting full probe scan with interaction for: ${url}`);

      const passiveResult = await scanUrl(url);
      const browserSignals = await browserScan(url);
      const aiFromNetwork = detectAIFromNetwork(browserSignals);
      const frameworkFromHints = detectFrameworkFromHints(browserSignals.windowHints);
      
      let mergedResult = mergeWithBrowserSignals(passiveResult, browserSignals, aiFromNetwork, frameworkFromHints);
      
      const interactionResult = await interactionProbe(url);
      if (interactionResult.detectedProvider) {
        mergedResult.aiProvider = interactionResult.detectedProvider;
        mergedResult.aiConfidence = "High";
      }
      if (interactionResult.inferredModel) {
        mergedResult.inferredModel = interactionResult.inferredModel;
      }
      if (interactionResult.aiInteraction) {
        mergedResult.ttft = `${interactionResult.aiInteraction.ttft}ms`;
        mergedResult.tps = `${interactionResult.aiInteraction.tps} tokens/sec`;
      }
      
      const validatedScan = insertScanSchema.parse(mergedResult);
      const savedScan = await storage.createScan(validatedScan);
      
      return res.json(savedScan);
    } catch (error) {
      console.error("Probe scan error:", error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : "Probe scan failed" 
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
