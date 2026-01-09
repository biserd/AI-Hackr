import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { scanUrl } from "./scanner";
import { insertScanSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Scan a URL
  app.post("/api/scan", async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }

      // Perform the scan
      const scanResult = await scanUrl(url);
      
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
