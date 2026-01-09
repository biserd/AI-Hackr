import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { scanUrl } from "./scanner";
import { probeScan, mergeProbeResults } from "./probeScanner";
import { insertScanSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Passive scan - fast, HTML/header analysis only
  app.post("/api/scan", async (req, res) => {
    try {
      const { url, mode = "passive" } = req.body;
      
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }

      // Perform passive scan first
      let scanResult = await scanUrl(url);

      // If probe mode requested, run Playwright scan
      if (mode === "probe") {
        try {
          const probeResult = await probeScan(url);
          scanResult = mergeProbeResults(scanResult, probeResult);
        } catch (probeError) {
          console.error("Probe scan failed, using passive results:", probeError);
        }
      }
      
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

  // Probe scan only - deep AI detection with browser automation
  app.post("/api/scan/probe", async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }

      // Run both passive and probe scans
      const passiveResult = await scanUrl(url);
      const probeResult = await probeScan(url);
      const mergedResult = mergeProbeResults(passiveResult, probeResult);
      
      // Validate and save to database
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
