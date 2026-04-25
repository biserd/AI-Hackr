import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";
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
  // Plan tier: "free" | "pro"
  planTier: text("plan_tier").default("free").notNull(),
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

/**
 * Watchlist entry (table physically named `subscriptions` for backwards
 * compatibility with the original schema). Each row represents one domain
 * a user has added to their watchlist.
 */
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

  // Watchlist v1 — alert behavior
  alertThreshold: text("alert_threshold").default("any_change").notNull(),
  // "any_change" | "high_confidence_only" | "provider_added_removed" | "no_alerts"
  slackEnabled: boolean("slack_enabled").default(false),

  // Scheduling + status
  nextScanAt: timestamp("next_scan_at"),
  scanStatus: text("scan_status").default("pending"),
  // "pending" | "scanning" | "complete" | "error" | "unreachable"
  consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
  unreachableNotifiedAt: timestamp("unreachable_notified_at"),
  lastChangedAt: timestamp("last_changed_at"),
  pausedUntil: timestamp("paused_until"),
  manualScansToday: integer("manual_scans_today").default(0).notNull(),
  manualScanResetAt: timestamp("manual_scan_reset_at"),

  // Provider state — list of currently detected providers and the
  // pending-removal counter (provider name → consecutive missing scans).
  providersDetected: jsonb("providers_detected").$type<Array<{
    provider: string;
    displayName: string;
    confidence: "high" | "medium" | "low";
    confidenceScore: number;
    modelHints?: string[];
    firstDetectedAt?: string;
    lastSeenAt?: string;
  }>>().default(sql`'[]'::jsonb`),
  pendingRemovals: jsonb("pending_removals").$type<Record<string, number>>().default(sql`'{}'::jsonb`),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).pick({
  userId: true,
  url: true,
  domain: true,
  displayLabel: true,
  alertThreshold: true,
});

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
// Watchlist alias for the new naming
export type WatchlistEntry = Subscription;

/**
 * Stack change record (table physically named `change_events` for
 * backwards compatibility). One row per detected change.
 */
export const changeEvents = pgTable("change_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  oldScanId: varchar("old_scan_id"),
  newScanId: varchar("new_scan_id").notNull(),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  // "provider_added" | "provider_removed" | "confidence_upgraded" | "confidence_downgraded" | "model_hint_changed"
  changeType: text("change_type").notNull(),
  changeSummary: text("change_summary"),
  changes: jsonb("changes").$type<{
    added: string[];
    removed: string[];
    modified: Array<{ tech: string; from: string; to: string }>;
  }>(),
  notificationSent: boolean("notification_sent").default(false),
  notificationSentAt: timestamp("notification_sent_at"),

  // Stack-change v1 fields
  provider: text("provider"),
  providerDisplayName: text("provider_display_name"),
  priorConfidence: text("prior_confidence"), // "high" | "medium" | "low" | "none"
  newConfidence: text("new_confidence"),
  severity: text("severity").default("major"), // "major" | "minor"
  alertedAt: timestamp("alerted_at"),
  alertSuppressed: boolean("alert_suppressed").default(false),
  dismissedUntil: timestamp("dismissed_until"),
  modelHints: jsonb("model_hints").$type<{ from: string[]; to: string[] }>(),
});

export type ChangeEvent = typeof changeEvents.$inferSelect;
export type StackChange = ChangeEvent;

/**
 * Per-user global alert + digest preferences.
 */
export const userSettings = pgTable("user_settings", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),

  emailAlertsEnabled: boolean("email_alerts_enabled").default(true).notNull(),
  slackAlertsEnabled: boolean("slack_alerts_enabled").default(false).notNull(),
  slackWebhookUrl: text("slack_webhook_url"),

  // "immediate" | "max_1_per_day" | "max_1_per_week"
  alertFrequencyCap: text("alert_frequency_cap").default("immediate").notNull(),
  // "any_change" | "high_confidence_only" | "provider_added_removed"
  globalAlertThreshold: text("global_alert_threshold").default("any_change").notNull(),
  // "low" | "medium" | "high"
  minConfidenceToAlert: text("min_confidence_to_alert").default("medium").notNull(),

  // Quiet hours (in user's timezone). null = no quiet hours.
  quietHoursStart: integer("quiet_hours_start"), // 0-23
  quietHoursEnd: integer("quiet_hours_end"),
  timezone: text("timezone").default("UTC").notNull(),

  // "individual" | "daily_bundle"
  alertDigestMode: text("alert_digest_mode").default("individual").notNull(),

  digestEnabled: boolean("digest_enabled").default(true).notNull(),
  lastDigestSentAt: timestamp("last_digest_sent_at"),
  lastDailyBundleAt: timestamp("last_daily_bundle_at"),

  // Free-plan weekly cap (5 alerts/week total)
  alertsThisWeek: integer("alerts_this_week").default(0).notNull(),
  weekResetAt: timestamp("week_reset_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  createdAt: true,
  updatedAt: true,
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;

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
  
  // Scan phase tracking. Stored as plain strings rather than literal unions so that
  // upstream call sites that compose values dynamically (worker, batch scanner) type-check
  // without forcing a runtime narrowing layer.
  scanPhases: jsonb("scan_phases").$type<{
    passive: string;
    render: string;
    probe: string;
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

// Use Drizzle's inferred insert type for the InsertScan type so that nested
// optional fields on `evidence` (which use `.$type<{...}>()`) keep their
// precise types. drizzle-zod conversion of `.$type<>()` collapses every
// nested property to `unknown`, which breaks `db.insert(scans).values(...)`
// and `db.update(scans).set(...)` overload resolution. The Zod schema is
// still used for runtime validation; insert sites cast the parsed result
// back to InsertScan when calling the storage layer.
export type InsertScan = typeof scans.$inferInsert;
export type Scan = typeof scans.$inferSelect;

export const showHnProducts = pgTable("show_hn_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hnId: text("hn_id").notNull().unique(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  createdAt: timestamp("created_at").notNull(),
  score: text("score").notNull(),
  commentsCount: text("comments_count"),
  hnLink: text("hn_link").notNull(),
  productUrl: text("product_url").notNull(),
  domain: text("domain").notNull(),
  scanId: varchar("scan_id").references(() => scans.id, { onDelete: "set null" }),
  scanStatus: text("scan_status").default("pending"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

export type ShowHnProduct = typeof showHnProducts.$inferSelect;

export const showHnReports = pgTable("show_hn_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  productCount: text("product_count").notNull(),
  dateRangeStart: timestamp("date_range_start").notNull(),
  dateRangeEnd: timestamp("date_range_end").notNull(),
  aggregateStats: jsonb("aggregate_stats").$type<{
    topFrameworks: Array<{ name: string; count: number; percentage: number }>;
    topHosting: Array<{ name: string; count: number; percentage: number }>;
    topPayments: Array<{ name: string; count: number; percentage: number }>;
    topAuth: Array<{ name: string; count: number; percentage: number }>;
    topAnalytics: Array<{ name: string; count: number; percentage: number }>;
    topAiProviders: Array<{ name: string; count: number; percentage: number }>;
    aiSignalPercentage: number;
    topStackCombos: Array<{ stack: string; count: number }>;
  }>(),
});

export type ShowHnReport = typeof showHnReports.$inferSelect;
