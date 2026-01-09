import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  emailVerified: boolean("email_verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
  notificationsEnabled: boolean("notifications_enabled").default(true),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  displayName: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
});

export type Session = typeof sessions.$inferSelect;

export const magicLinks = pgTable("magic_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  consumedAt: timestamp("consumed_at"),
});

export type MagicLink = typeof magicLinks.$inferSelect;

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  domain: text("domain").notNull(),
  displayLabel: text("display_label"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastScannedAt: timestamp("last_scanned_at"),
  lastScanId: varchar("last_scan_id"),
  isActive: boolean("is_active").default(true),
  notifyOnChange: boolean("notify_on_change").default(true),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).pick({
  userId: true,
  url: true,
  domain: true,
  displayLabel: true,
});

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

export const changeEvents = pgTable("change_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  oldScanId: varchar("old_scan_id"),
  newScanId: varchar("new_scan_id").notNull(),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  changeType: text("change_type").notNull(),
  changeSummary: text("change_summary"),
  changes: jsonb("changes").$type<{
    added: string[];
    removed: string[];
    modified: Array<{ tech: string; from: string; to: string }>;
  }>(),
  notificationSent: boolean("notification_sent").default(false),
  notificationSentAt: timestamp("notification_sent_at"),
});

export type ChangeEvent = typeof changeEvents.$inferSelect;

export const scans = pgTable("scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  domain: text("domain"),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
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
    // Probe diagnostics
    probeDiagnostics?: {
      pageLoaded?: boolean;
      elementsClicked?: number;
      elementsAttempted?: number;
      chatUiFound?: boolean;
      totalRequests?: number;
      externalDomains?: number;
    };
    // Grouped detections by technology
    groupedDetections?: Record<string, {
      confidence: string;
      score?: number;
      patterns: string[];
    }>;
    // Third-party services grouped by category
    thirdPartyServices?: Record<string, {
      services: string[];
      domains: string[];
    }>;
  }>(),
});

export const insertScanSchema = createInsertSchema(scans).omit({
  id: true,
  scannedAt: true,
});

export type InsertScan = z.infer<typeof insertScanSchema>;
export type Scan = typeof scans.$inferSelect;
