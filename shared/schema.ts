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
  // NULL means "inherit user's globalAlertThreshold". Any explicit non-null
  // value (any_change | provider_added_removed | high_confidence_only |
  // no_alerts) overrides the global setting for this domain.
  alertThreshold: text("alert_threshold"),
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

  // Advanced AI attributes — derived from evidence in scanner.inferAdvancedAIAttributes.
  // Stored on the scan row so the leaderboard, stack-detail page, and change-detection
  // diff can all read them without re-deriving from raw evidence on every request.
  // - inferenceHost: where the model is actually served (anthropic_direct, aws_bedrock,
  //   azure_openai, google_agent_platform, vertex_ai, self_hosted, unknown)
  // - orchestrationFramework: agent/LLM orchestration layer if any (langchain, langgraph,
  //   llamaindex, crewai, autogen, semantic_kernel, mcp, custom). null if none detected.
  // - modelTier: rolled up from inferredModel + provider into a coarse business tier
  //   (frontier / balanced / efficiency). null if no model hint.
  // - isAgentic: true when an orchestration framework or MCP endpoint is observed.
  inferenceHost: text("inference_host"),
  orchestrationFramework: text("orchestration_framework"),
  modelTier: text("model_tier"),
  isAgentic: boolean("is_agentic").default(false),
  
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
    // Paths visited by the multi-page passive scanner. The first entry is
    // always the entry URL's path; subsequent entries are high-signal
    // candidates (/pricing, /login, /signup, etc.) that returned 200.
    pagesScanned?: string[];
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

/**
 * Tracked companies — the seeded SaaS list that powers /stack/[slug],
 * /leaderboard, and /provider/[slug]. Each row gets a recurring 7-day
 * scan via the background worker; the latest scan's id is denormalized
 * onto `lastScanId` for fast leaderboard reads.
 */
export const trackedCompanies = pgTable("tracked_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  url: text("url").notNull(),
  category: text("category").notNull(),
  ycBatch: text("yc_batch"),
  logoUrl: text("logo_url"),
  description: text("description"),

  // Lifecycle. "live" rows are scanned on cadence and surfaced everywhere;
  // "queued" rows came from the request-a-company form and need approval.
  status: text("status").default("live").notNull(),
  // When non-null, this is the requesting user_id (for queued requests).
  requestedBy: varchar("requested_by"),

  // Latest scan denormalization (rebuilt on each successful re-scan).
  lastScanId: varchar("last_scan_id"),
  lastScannedAt: timestamp("last_scanned_at"),
  nextScanAt: timestamp("next_scan_at"),
  scanStatus: text("scan_status").default("pending"),

  // Snapshot of the prior scan's primary AI provider, so we can compute
  // week-over-week deltas for the leaderboard "What changed" panel cheaply.
  priorAiProvider: text("prior_ai_provider"),
  priorAiConfidence: text("prior_ai_confidence"),
  // ISO timestamp string when the primary provider last changed.
  providerChangedAt: timestamp("provider_changed_at"),

  // Provenance — for bulk-imported rows we record where the row came from
  // (e.g. "yc-w26", "g2-productivity-top-200", "manual") and when the row
  // was first imported. Manually-added rows leave both null.
  source: text("source"),
  importedAt: timestamp("imported_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTrackedCompanySchema = createInsertSchema(trackedCompanies).omit({
  id: true,
  createdAt: true,
});

export type TrackedCompany = typeof trackedCompanies.$inferSelect;
export type InsertTrackedCompany = z.infer<typeof insertTrackedCompanySchema>;

/**
 * Provider rollup pages — canonical list of AI providers we want
 * /provider/[slug] pages for. Decoupled from the scanner's emitted
 * provider strings so we can map "OpenAI" / "openai" / "Azure OpenAI"
 * to the correct rollup via `aliases`.
 */
export const providerRollups = pgTable("provider_rollups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  logoUrl: text("logo_url"),
  // Lowercased strings the scanner may emit that should map to this rollup.
  aliases: text("aliases").array().default(sql`ARRAY[]::text[]`).notNull(),
  // For ordering on the index page (lower = earlier).
  sortOrder: integer("sort_order").default(100).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProviderRollupSchema = createInsertSchema(providerRollups).omit({
  id: true,
  createdAt: true,
});

export type ProviderRollup = typeof providerRollups.$inferSelect;
export type InsertProviderRollup = z.infer<typeof insertProviderRollupSchema>;

/**
 * Weekly archived leaderboard snapshots.
 * One row per ISO week (e.g. "2026-W17"). The `payload` column holds the
 * full ranked-rows array, top-line stats, and provider distribution at the
 * moment the snapshot was taken so /leaderboard/:week and the weekly OG
 * image can be served without re-joining live data.
 */
export const leaderboardSnapshots = pgTable("leaderboard_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  isoWeek: text("iso_week").notNull().unique(),
  takenAt: timestamp("taken_at").defaultNow().notNull(),
  totalCompanies: integer("total_companies").notNull(),
  topProvider: text("top_provider"),
  changesCount: integer("changes_count").default(0).notNull(),
  payload: jsonb("payload").notNull(),
});

export const insertLeaderboardSnapshotSchema = createInsertSchema(leaderboardSnapshots).omit({
  id: true,
  takenAt: true,
});

export type LeaderboardSnapshot = typeof leaderboardSnapshots.$inferSelect;
export type InsertLeaderboardSnapshot = z.infer<typeof insertLeaderboardSnapshotSchema>;
