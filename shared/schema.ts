import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const scans = pgTable("scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  scannedAt: timestamp("scanned_at").defaultNow().notNull(),
  
  // Core stack detection
  framework: text("framework"),
  frameworkConfidence: text("framework_confidence"),
  
  hosting: text("hosting"),
  hostingConfidence: text("hosting_confidence"),
  
  payments: text("payments"),
  paymentsConfidence: text("payments_confidence"),
  
  auth: text("auth"),
  authConfidence: text("auth_confidence"),
  
  analytics: text("analytics"),
  analyticsConfidence: text("analytics_confidence"),
  
  support: text("support"),
  supportConfidence: text("support_confidence"),
  
  // AI layer detection
  aiProvider: text("ai_provider"),
  aiConfidence: text("ai_confidence"),
  aiTransport: text("ai_transport"),
  aiGateway: text("ai_gateway"),
  
  // Scan phase tracking
  scanPhases: jsonb("scan_phases").$type<{
    passive: "pending" | "running" | "complete" | "failed";
    render: "pending" | "running" | "complete" | "failed" | "skipped";
    probe: "pending" | "running" | "complete" | "failed" | "locked";
  }>().default({ passive: "pending", render: "pending", probe: "locked" }),
  
  // Probe scan metrics
  scanMode: text("scan_mode").default("passive"),
  ttft: text("ttft"),
  tps: text("tps"),
  inferredModel: text("inferred_model"),
  
  // Evidence and metadata
  evidence: jsonb("evidence").$type<{
    domains?: string[];
    scripts?: string[];
    headers?: Record<string, string>;
    patterns?: string[];
    networkRequests?: Array<{
      url: string;
      method: string;
      contentType?: string;
    }>;
    payloadSignatures?: string[];
    timingMetrics?: {
      ttft?: number;
      tps?: number;
      totalTime?: number;
    };
    networkDomains?: string[];
    networkPaths?: string[];
    websockets?: string[];
    windowHints?: string[];
  }>(),
});

export const insertScanSchema = createInsertSchema(scans).omit({
  id: true,
  scannedAt: true,
});

export type InsertScan = z.infer<typeof insertScanSchema>;
export type Scan = typeof scans.$inferSelect;
