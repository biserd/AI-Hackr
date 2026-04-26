import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, ne, desc, and, lt, gt, isNull, isNotNull, sql, inArray, or, gte, lte } from "drizzle-orm";
import {
  users,
  sessions,
  magicLinks,
  subscriptions,
  changeEvents,
  scans,
  userSettings,
  trackedCompanies,
  providerRollups,
  leaderboardSnapshots,
  type User,
  type InsertUser,
  type Session,
  type MagicLink,
  type Subscription,
  type InsertSubscription,
  type ChangeEvent,
  type Scan,
  type InsertScan,
  type UserSettings,
  type InsertUserSettings,
  type TrackedCompany,
  type InsertTrackedCompany,
  type ProviderRollup,
  type LeaderboardSnapshot,
  type InsertLeaderboardSnapshot,
} from "@shared/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export interface IStorage {
  // User
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // Session
  createSession(userId: string, token: string, expiresAt: Date, userAgent?: string, ipAddress?: string): Promise<Session>;
  getSessionByToken(token: string): Promise<Session | undefined>;
  deleteSession(id: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;

  // Magic link
  createMagicLink(email: string, tokenHash: string, expiresAt: Date): Promise<MagicLink>;
  getMagicLinkByTokenHash(tokenHash: string): Promise<MagicLink | undefined>;
  consumeMagicLink(id: string): Promise<void>;
  cleanupExpiredMagicLinks(): Promise<void>;

  // Watchlist (subscriptions)
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getSubscription(id: string): Promise<Subscription | undefined>;
  getUserSubscriptions(userId: string): Promise<Subscription[]>;
  countUserSubscriptions(userId: string): Promise<number>;
  updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription | undefined>;
  deleteSubscription(id: string): Promise<void>;
  getActiveSubscriptions(): Promise<Subscription[]>;
  getAllSubscriptions(): Promise<Subscription[]>;
  /** All entries due for re-scan, ordered by user plan (Pro first). */
  getDueSubscriptions(now: Date): Promise<Array<Subscription & { planTier: string }>>;
  getSubscriptionByDomain(userId: string, domain: string): Promise<Subscription | undefined>;

  // Stack changes
  createChangeEvent(event: typeof changeEvents.$inferInsert): Promise<ChangeEvent>;
  getSubscriptionChangeEvents(subscriptionId: string, limit?: number): Promise<ChangeEvent[]>;
  getChangeEvent(id: string): Promise<ChangeEvent | undefined>;
  markChangeEventNotified(id: string): Promise<void>;
  markChangeEventAlerted(id: string): Promise<void>;
  getPendingNotifications(): Promise<ChangeEvent[]>;
  /** Find any prior alert sent for the same (entry, provider, changeType) within `sinceMs` ms */
  findRecentAlert(entryId: string, provider: string, changeType: string, sinceMs: number): Promise<ChangeEvent | undefined>;
  /** Stack changes detected within a date range, optional user filter */
  getChangeEventsForUser(userId: string, since: Date): Promise<ChangeEvent[]>;
  /** Pending (un-alerted, un-suppressed) change events for a user since a given time. Used by the daily-bundle digest. */
  getPendingBundleEventsForUser(userId: string, since: Date): Promise<ChangeEvent[]>;
  /** Mark a batch of change events as alerted (used after a daily-bundle email is delivered). */
  markChangeEventsAlertedBulk(ids: string[]): Promise<void>;
  /** Stamp the user's last daily-bundle send timestamp. */
  markDailyBundleSent(userId: string): Promise<void>;
  /** All users whose alertDigestMode = "daily_bundle" and emailAlertsEnabled = true. */
  getUsersWithDailyBundleMode(): Promise<User[]>;
  /** Mark a change as dismissed (false-positive suppression) */
  dismissChangeEvent(id: string, dismissedUntil: Date): Promise<void>;
  /** Get any active dismissal in effect for (entry, provider, newConfidence) — used to suppress repeat alerts */
  hasActiveDismissal(entryId: string, provider: string, newConfidence: string | null): Promise<boolean>;
  /** Has the user received any alert (across all subscriptions) since the given time? Used for per-user frequency caps. */
  hasUserAlertSince(userId: string, since: Date): Promise<boolean>;
  /**
   * Atomically claim a subscription for scanning. Returns true if this caller won
   * the claim (scan_status flipped from non-'scanning' to 'scanning'); false if
   * another scanner already owns the row. Used to prevent the immediate-scan +
   * worker-tick double-fire race.
   */
  claimSubscriptionForScan(subscriptionId: string): Promise<boolean>;

  // Scans
  createScan(scan: InsertScan): Promise<Scan>;
  getScan(id: string): Promise<Scan | undefined>;
  getScanByDomain(domain: string): Promise<Scan | undefined>;
  getScansByDomain(domain: string, limit?: number): Promise<Scan[]>;
  getRecentScans(limit?: number): Promise<Scan[]>;
  getUserScans(userId: string, limit?: number): Promise<Scan[]>;
  updateScan(id: string, updates: Partial<InsertScan>): Promise<Scan | undefined>;

  // User settings
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  upsertUserSettings(userId: string, updates: Partial<InsertUserSettings>): Promise<UserSettings>;
  /** Create default user_settings rows for any user who has subscriptions but no settings.
   *  Idempotent — used by the digest cron to ensure every watcher receives a Monday digest
   *  (incl. the "no changes this week" fallback) even if they never visited /settings/alerts. */
  backfillUserSettingsForWatchers(): Promise<number>;
  /** Users whose digest is due (active + digestEnabled + last sent > 6 days ago or never) */
  getUsersDueForDigest(now: Date): Promise<User[]>;
  markDigestSent(userId: string): Promise<void>;

  // ───── Tracked companies (the seeded SaaS list) ─────
  /** All live tracked companies (excludes "queued" requests). Optional filters. */
  listTrackedCompanies(opts?: {
    status?: string;
    category?: string;
    search?: string;
  }): Promise<TrackedCompany[]>;
  getTrackedCompanyBySlug(slug: string): Promise<TrackedCompany | undefined>;
  /** Insert a "queued" company request from a logged-in user. */
  requestTrackedCompany(input: InsertTrackedCompany): Promise<TrackedCompany>;
  /** Live companies whose nextScanAt has passed (or who have never been scanned). */
  getCompaniesNeedingScan(now: Date, limit?: number): Promise<TrackedCompany[]>;
  claimTrackedCompanyForScan(id: string): Promise<boolean>;
  bumpTrackedCompanyScan(slug: string): Promise<"bumped" | "alreadyScanned" | "notFound">;
  /** Update a tracked company row after a scan completes. */
  updateTrackedCompany(id: string, updates: Partial<TrackedCompany>): Promise<TrackedCompany | undefined>;
  /**
   * Leaderboard rows — joins tracked_companies to its lastScanId scan row so the
   * frontend can render Rank/Provider/Confidence/etc in one query.
   */
  getLeaderboardRows(opts?: {
    provider?: string;
    category?: string;
    confidence?: string;
    ycBatch?: string;
    changedThisWeek?: boolean;
  }): Promise<Array<TrackedCompany & { lastScan: Scan | null }>>;
  /** Companies whose primary AI provider changed in the last 7 days. */
  getCompaniesChangedThisWeek(): Promise<Array<TrackedCompany & { lastScan: Scan | null }>>;
  /** Distinct categories in the tracked_companies table — used for filter UIs. */
  getTrackedCompanyCategories(): Promise<string[]>;

  // ───── Bulk ingestion + paginated reads (programmatic SEO) ─────
  /**
   * Insert many tracked companies idempotently. Skips rows whose slug OR
   * domain already exists. Returns counts so the importer can report.
   */
  bulkImportCompanies(rows: InsertTrackedCompany[]): Promise<{ inserted: number; skipped: number; total: number }>;
  /**
   * Companies awaiting their first scan (lastScanId IS NULL). Used by the
   * stub-drain worker. Caps in-flight scans per host so we never hammer
   * a single domain.
   */
  getCompaniesNeedingFirstScan(limit: number, perHostMax?: number): Promise<TrackedCompany[]>;
  /** Paginated company list with filters; returns rows + total. */
  getTrackedCompaniesPaginated(opts: {
    page: number;
    pageSize: number;
    category?: string;
    scanStatus?: "scanned" | "pending" | "failed" | "all";
    ycBatch?: string;
    provider?: string;
    search?: string;
  }): Promise<{ companies: TrackedCompany[]; total: number }>;
  getTrackedCompanyYcBatches(): Promise<string[]>;
  /** Total scanned vs pending counts — drives the index page header. */
  getTrackedCompanyCounts(): Promise<{ total: number; scanned: number; pending: number; failed: number }>;
  /** Total tracked-company count (for sitemap pagination). */
  countAllTrackedCompanies(): Promise<number>;
  /** Page slugs for sitemap chunking (fast — slugs only). */
  listTrackedCompanySlugsPaginated(offset: number, limit: number): Promise<Array<{ slug: string; lastScannedAt: Date | null }>>;

  // ───── Provider rollups ─────
  listProviderRollups(): Promise<ProviderRollup[]>;
  getProviderRollupBySlug(slug: string): Promise<ProviderRollup | undefined>;
  /** Get all live tracked companies whose latest scan's primary AI provider matches this rollup's aliases. */
  getCompaniesForProvider(rollup: ProviderRollup): Promise<Array<TrackedCompany & { lastScan: Scan | null }>>;
}

export class DatabaseStorage implements IStorage {
  // ───── User ─────
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values({
      ...insertUser,
      email: insertUser.email.toLowerCase(),
    }).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }

  // ───── Session ─────
  async createSession(userId: string, token: string, expiresAt: Date, userAgent?: string, ipAddress?: string): Promise<Session> {
    const result = await db.insert(sessions).values({ userId, token, expiresAt, userAgent, ipAddress }).returning();
    return result[0];
  }

  async getSessionByToken(token: string): Promise<Session | undefined> {
    const result = await db.select().from(sessions).where(eq(sessions.token, token));
    return result[0];
  }

  async deleteSession(id: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  // ───── Magic link ─────
  async createMagicLink(email: string, tokenHash: string, expiresAt: Date): Promise<MagicLink> {
    const result = await db.insert(magicLinks).values({ email: email.toLowerCase(), tokenHash, expiresAt }).returning();
    return result[0];
  }

  async getMagicLinkByTokenHash(tokenHash: string): Promise<MagicLink | undefined> {
    const result = await db.select().from(magicLinks).where(
      and(eq(magicLinks.tokenHash, tokenHash), isNull(magicLinks.consumedAt))
    );
    return result[0];
  }

  async consumeMagicLink(id: string): Promise<void> {
    await db.update(magicLinks).set({ consumedAt: new Date() }).where(eq(magicLinks.id, id));
  }

  async cleanupExpiredMagicLinks(): Promise<void> {
    await db.delete(magicLinks).where(lt(magicLinks.expiresAt, new Date()));
  }

  // ───── Watchlist (subscriptions) ─────
  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const result = await db.insert(subscriptions).values(subscription).returning();
    return result[0];
  }

  async getSubscription(id: string): Promise<Subscription | undefined> {
    const result = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    return result[0];
  }

  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    return await db.select().from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));
  }

  async countUserSubscriptions(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
    return result[0]?.count ?? 0;
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription | undefined> {
    const result = await db.update(subscriptions).set(updates).where(eq(subscriptions.id, id)).returning();
    return result[0];
  }

  async deleteSubscription(id: string): Promise<void> {
    await db.delete(subscriptions).where(eq(subscriptions.id, id));
  }

  async getActiveSubscriptions(): Promise<Subscription[]> {
    return await db.select().from(subscriptions).where(eq(subscriptions.isActive, true));
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    return await db.select().from(subscriptions);
  }

  async getDueSubscriptions(now: Date): Promise<Array<Subscription & { planTier: string }>> {
    // Active + not paused + (next_scan_at IS NULL OR next_scan_at <= now) +
    // scan_status != 'scanning' so we never double-fire the same row when an
    // immediate-scan (POST /api/me/subscriptions) is racing with the worker tick.
    // Joined with users to read planTier; ordered by Pro first then by next_scan_at asc.
    const rows = await db
      .select({
        sub: subscriptions,
        planTier: users.planTier,
      })
      .from(subscriptions)
      .innerJoin(users, eq(subscriptions.userId, users.id))
      .where(
        and(
          eq(subscriptions.isActive, true),
          or(
            isNull(subscriptions.pausedUntil),
            lt(subscriptions.pausedUntil, now)
          ),
          or(
            isNull(subscriptions.nextScanAt),
            lte(subscriptions.nextScanAt, now)
          ),
          or(
            isNull(subscriptions.scanStatus),
            sql`${subscriptions.scanStatus} <> 'scanning'`
          )
        )
      )
      .orderBy(desc(users.planTier), subscriptions.nextScanAt);
    return rows.map((r) => ({ ...r.sub, planTier: r.planTier }));
  }

  async getSubscriptionByDomain(userId: string, domain: string): Promise<Subscription | undefined> {
    const result = await db.select().from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.domain, domain)));
    return result[0];
  }

  // ───── Stack changes ─────
  async createChangeEvent(
    event: typeof changeEvents.$inferInsert
  ): Promise<ChangeEvent> {
    const result = await db.insert(changeEvents).values(event).returning();
    return result[0];
  }

  async getSubscriptionChangeEvents(subscriptionId: string, limit: number = 50): Promise<ChangeEvent[]> {
    return await db.select().from(changeEvents)
      .where(eq(changeEvents.subscriptionId, subscriptionId))
      .orderBy(desc(changeEvents.detectedAt))
      .limit(limit);
  }

  async getChangeEvent(id: string): Promise<ChangeEvent | undefined> {
    const result = await db.select().from(changeEvents).where(eq(changeEvents.id, id));
    return result[0];
  }

  async markChangeEventNotified(id: string): Promise<void> {
    await db.update(changeEvents).set({
      notificationSent: true,
      notificationSentAt: new Date(),
    }).where(eq(changeEvents.id, id));
  }

  async markChangeEventAlerted(id: string): Promise<void> {
    await db.update(changeEvents).set({
      alertedAt: new Date(),
      notificationSent: true,
      notificationSentAt: new Date(),
    }).where(eq(changeEvents.id, id));
  }

  async getPendingNotifications(): Promise<ChangeEvent[]> {
    return await db.select().from(changeEvents).where(eq(changeEvents.notificationSent, false));
  }

  async findRecentAlert(
    entryId: string,
    provider: string,
    changeType: string,
    sinceMs: number,
    opts?: { includePendingBundle?: boolean; excludeChangeEventId?: string }
  ): Promise<ChangeEvent | undefined> {
    const since = new Date(Date.now() - sinceMs);
    // Default mode (individual digest): only alerted events count toward dedup,
    // because suppressed/un-alerted events never went out.
    //
    // Bundle mode: also count pending bundle events (alertedAt IS NULL but
    // detected within the window AND not explicitly suppressed). This prevents
    // a daily bundle from accumulating multiple identical (provider, changeType)
    // entries between flushes — the second occurrence is suppressed exactly the
    // way it would be in individual mode. The current event is excluded via
    // excludeChangeEventId so it does not match itself.
    if (opts?.includePendingBundle) {
      const conds = [
        eq(changeEvents.subscriptionId, entryId),
        eq(changeEvents.provider, provider),
        eq(changeEvents.changeType, changeType),
        gte(changeEvents.detectedAt, since),
        eq(changeEvents.alertSuppressed, false),
      ];
      if (opts.excludeChangeEventId) {
        conds.push(ne(changeEvents.id, opts.excludeChangeEventId));
      }
      const result = await db.select().from(changeEvents)
        .where(and(...conds))
        .orderBy(desc(changeEvents.detectedAt))
        .limit(1);
      return result[0];
    }
    const result = await db.select().from(changeEvents)
      .where(
        and(
          eq(changeEvents.subscriptionId, entryId),
          eq(changeEvents.provider, provider),
          eq(changeEvents.changeType, changeType),
          isNotNull(changeEvents.alertedAt),
          gte(changeEvents.alertedAt, since)
        )
      )
      .limit(1);
    return result[0];
  }

  async getChangeEventsForUser(userId: string, since: Date): Promise<ChangeEvent[]> {
    const rows = await db
      .select({ ev: changeEvents })
      .from(changeEvents)
      .innerJoin(subscriptions, eq(changeEvents.subscriptionId, subscriptions.id))
      .where(
        and(
          eq(subscriptions.userId, userId),
          gte(changeEvents.detectedAt, since)
        )
      )
      .orderBy(desc(changeEvents.detectedAt));
    return rows.map((r) => r.ev);
  }

  async getPendingBundleEventsForUser(userId: string, since: Date): Promise<ChangeEvent[]> {
    const rows = await db
      .select({ ev: changeEvents })
      .from(changeEvents)
      .innerJoin(subscriptions, eq(changeEvents.subscriptionId, subscriptions.id))
      .where(
        and(
          eq(subscriptions.userId, userId),
          gte(changeEvents.detectedAt, since),
          isNull(changeEvents.alertedAt),
          eq(changeEvents.alertSuppressed, false)
        )
      )
      .orderBy(desc(changeEvents.detectedAt));
    return rows.map((r) => r.ev);
  }

  async markChangeEventsAlertedBulk(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const now = new Date();
    await db.update(changeEvents).set({
      alertedAt: now,
      notificationSent: true,
      notificationSentAt: now,
    }).where(inArray(changeEvents.id, ids));
  }

  async markDailyBundleSent(userId: string): Promise<void> {
    await db.update(userSettings).set({
      lastDailyBundleAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(userSettings.userId, userId));
  }

  async dismissChangeEvent(id: string, dismissedUntil: Date): Promise<void> {
    await db.update(changeEvents).set({ dismissedUntil }).where(eq(changeEvents.id, id));
  }

  async hasActiveDismissal(
    entryId: string,
    provider: string,
    newConfidence: string | null
  ): Promise<boolean> {
    if (!newConfidence) return false;
    const now = new Date();
    const result = await db.select().from(changeEvents)
      .where(
        and(
          eq(changeEvents.subscriptionId, entryId),
          eq(changeEvents.provider, provider),
          eq(changeEvents.newConfidence, newConfidence),
          isNotNull(changeEvents.dismissedUntil),
          gt(changeEvents.dismissedUntil, now)
        )
      )
      .limit(1);
    return result.length > 0;
  }

  async claimSubscriptionForScan(subscriptionId: string): Promise<boolean> {
    // Atomic compare-and-swap: only flip to 'scanning' if not already 'scanning'.
    // RETURNING id lets us tell whether we actually won the claim.
    const rows = await db
      .update(subscriptions)
      .set({ scanStatus: "scanning" })
      .where(
        and(
          eq(subscriptions.id, subscriptionId),
          or(
            isNull(subscriptions.scanStatus),
            sql`${subscriptions.scanStatus} <> 'scanning'`,
          ),
        ),
      )
      .returning({ id: subscriptions.id });
    return rows.length > 0;
  }

  async hasUserAlertSince(userId: string, since: Date): Promise<boolean> {
    // Join change_events to subscriptions to scope by user. We're only interested
    // in events where alertedAt is set (i.e. an email/Slack actually went out).
    const result = await db
      .select({ id: changeEvents.id })
      .from(changeEvents)
      .innerJoin(subscriptions, eq(changeEvents.subscriptionId, subscriptions.id))
      .where(
        and(
          eq(subscriptions.userId, userId),
          isNotNull(changeEvents.alertedAt),
          gte(changeEvents.alertedAt, since),
        ),
      )
      .limit(1);
    return result.length > 0;
  }

  // ───── Scans ─────
  async createScan(insertScan: InsertScan): Promise<Scan> {
    const result = await db.insert(scans).values(insertScan).returning();
    return result[0];
  }

  async getScan(id: string): Promise<Scan | undefined> {
    const result = await db.select().from(scans).where(eq(scans.id, id));
    return result[0];
  }

  async getScanByDomain(domain: string): Promise<Scan | undefined> {
    const result = await db.select().from(scans)
      .where(eq(scans.domain, domain))
      .orderBy(desc(scans.scannedAt))
      .limit(1);
    return result[0];
  }

  async getScansByDomain(domain: string, limit: number = 10): Promise<Scan[]> {
    return await db.select().from(scans)
      .where(eq(scans.domain, domain))
      .orderBy(desc(scans.scannedAt))
      .limit(limit);
  }

  async getRecentScans(limit: number = 10): Promise<Scan[]> {
    return await db.select().from(scans)
      .orderBy(desc(scans.scannedAt))
      .limit(limit);
  }

  async getUserScans(userId: string, limit: number = 50): Promise<Scan[]> {
    return await db.select().from(scans)
      .where(eq(scans.userId, userId))
      .orderBy(desc(scans.scannedAt))
      .limit(limit);
  }

  async updateScan(id: string, updates: Partial<InsertScan>): Promise<Scan | undefined> {
    const result = await db.update(scans).set(updates).where(eq(scans.id, id)).returning();
    return result[0];
  }

  // ───── User settings ─────
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return result[0];
  }

  async upsertUserSettings(userId: string, updates: Partial<InsertUserSettings>): Promise<UserSettings> {
    const existing = await this.getUserSettings(userId);
    if (existing) {
      const result = await db.update(userSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(userSettings.userId, userId))
        .returning();
      return result[0];
    }
    const result = await db.insert(userSettings).values({
      ...updates,
      userId,
    }).returning();
    return result[0];
  }

  async backfillUserSettingsForWatchers(): Promise<number> {
    // Find userIds that have at least one subscription but no user_settings row, then
    // insert default rows. We rely on the (unique) PK on user_settings.user_id +
    // ON CONFLICT DO NOTHING for idempotency under concurrent runs.
    const orphanRows = await db.execute(sql`
      SELECT DISTINCT s.user_id
      FROM ${subscriptions} s
      LEFT JOIN ${userSettings} us ON us.user_id = s.user_id
      WHERE us.user_id IS NULL
    `);
    const rows = (orphanRows as unknown as { rows: Array<{ user_id: string }> }).rows ?? [];
    if (rows.length === 0) return 0;
    let inserted = 0;
    for (const r of rows) {
      try {
        await db.insert(userSettings).values({ userId: r.user_id }).onConflictDoNothing();
        inserted++;
      } catch (err) {
        console.error(`[storage] backfillUserSettings failed for ${r.user_id}:`, err);
      }
    }
    return inserted;
  }

  async getUsersDueForDigest(now: Date): Promise<User[]> {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    // Users who have digestEnabled=true and either lastDigestSentAt is null or > 6.5 days ago.
    const sixHalfDaysAgo = new Date(now.getTime() - 6.5 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({ user: users })
      .from(users)
      .innerJoin(userSettings, eq(users.id, userSettings.userId))
      .where(
        and(
          eq(userSettings.digestEnabled, true),
          or(
            isNull(userSettings.lastDigestSentAt),
            lt(userSettings.lastDigestSentAt, sixHalfDaysAgo)
          )
        )
      );
    return rows.map((r) => r.user);
  }

  async markDigestSent(userId: string): Promise<void> {
    await db.update(userSettings)
      .set({ lastDigestSentAt: new Date(), updatedAt: new Date() })
      .where(eq(userSettings.userId, userId));
  }

  async getUsersWithDailyBundleMode(): Promise<User[]> {
    const rows = await db
      .select({ user: users })
      .from(users)
      .innerJoin(userSettings, eq(users.id, userSettings.userId))
      .where(
        and(
          eq(userSettings.alertDigestMode, "daily_bundle"),
          eq(userSettings.emailAlertsEnabled, true)
        )
      );
    return rows.map((r) => r.user);
  }

  // ───── Tracked companies ─────
  async listTrackedCompanies(opts: {
    status?: string;
    category?: string;
    search?: string;
  } = {}): Promise<TrackedCompany[]> {
    const conds = [eq(trackedCompanies.status, opts.status ?? "live")];
    if (opts.category) conds.push(eq(trackedCompanies.category, opts.category));
    if (opts.search) {
      const q = `%${opts.search.toLowerCase()}%`;
      conds.push(
        or(
          sql`LOWER(${trackedCompanies.name}) LIKE ${q}`,
          sql`LOWER(${trackedCompanies.domain}) LIKE ${q}`,
          sql`LOWER(${trackedCompanies.category}) LIKE ${q}`,
        )!
      );
    }
    return await db
      .select()
      .from(trackedCompanies)
      .where(and(...conds))
      .orderBy(trackedCompanies.name);
  }

  async getTrackedCompanyBySlug(slug: string): Promise<TrackedCompany | undefined> {
    const result = await db.select().from(trackedCompanies).where(eq(trackedCompanies.slug, slug));
    return result[0];
  }

  async requestTrackedCompany(input: InsertTrackedCompany): Promise<TrackedCompany> {
    const result = await db.insert(trackedCompanies).values(input).returning();
    return result[0];
  }

  async getCompaniesNeedingScan(now: Date, limit = 20): Promise<TrackedCompany[]> {
    // Rescan loop owns rows that already have at least one scan (lastScanId IS NOT NULL).
    // Never-scanned rows (CSV stubs) are owned by runStubDrainCycle so we can rate-limit
    // their first scan independently — see getCompaniesNeedingFirstScan.
    return await db
      .select()
      .from(trackedCompanies)
      .where(
        and(
          eq(trackedCompanies.status, "live"),
          sql`${trackedCompanies.lastScanId} IS NOT NULL`,
          or(
            isNull(trackedCompanies.nextScanAt),
            lte(trackedCompanies.nextScanAt, now),
          ),
          or(
            isNull(trackedCompanies.scanStatus),
            sql`${trackedCompanies.scanStatus} <> 'scanning'`,
          ),
        )
      )
      .orderBy(sql`${trackedCompanies.lastScannedAt} ASC NULLS FIRST`)
      .limit(limit);
  }

  // Atomic optimistic claim — flips scan_status to 'scanning' only if no other
  // tick has already claimed the row. Returns true on success, false if a
  // concurrent worker beat us. Both runTrackedCompanyScans and runStubDrainCycle
  // use this so they can't double-scan the same row.
  async claimTrackedCompanyForScan(id: string): Promise<boolean> {
    const result = await db
      .update(trackedCompanies)
      .set({ scanStatus: "scanning" })
      .where(
        and(
          eq(trackedCompanies.id, id),
          or(
            isNull(trackedCompanies.scanStatus),
            sql`${trackedCompanies.scanStatus} <> 'scanning'`,
          ),
        ),
      )
      .returning({ id: trackedCompanies.id });
    return result.length > 0;
  }

  async updateTrackedCompany(id: string, updates: Partial<TrackedCompany>): Promise<TrackedCompany | undefined> {
    const result = await db.update(trackedCompanies).set(updates).where(eq(trackedCompanies.id, id)).returning();
    return result[0];
  }

  // Atomic bump-scan: only updates the row if it is still a true stub
  // (lastScanId IS NULL) AND not currently mid-scan. If a worker has just
  // landed a scan in between the route's read and this update, the WHERE
  // clause filters us out — preventing a TOCTOU race that would otherwise
  // overwrite scanStatus="ok" with "pending" or reset nextScanAt on a
  // freshly-scanned row.
  async bumpTrackedCompanyScan(slug: string): Promise<"bumped" | "alreadyScanned" | "notFound"> {
    const existing = await db
      .select({ id: trackedCompanies.id, lastScanId: trackedCompanies.lastScanId })
      .from(trackedCompanies)
      .where(eq(trackedCompanies.slug, slug));
    if (existing.length === 0) return "notFound";
    if (existing[0].lastScanId) return "alreadyScanned";

    const result = await db
      .update(trackedCompanies)
      .set({
        nextScanAt: new Date(),
        scanStatus: sql`CASE WHEN ${trackedCompanies.scanStatus} = 'failed' THEN 'pending' ELSE ${trackedCompanies.scanStatus} END`,
      })
      .where(
        and(
          eq(trackedCompanies.slug, slug),
          isNull(trackedCompanies.lastScanId),
          or(
            isNull(trackedCompanies.scanStatus),
            sql`${trackedCompanies.scanStatus} <> 'scanning'`,
          ),
        ),
      )
      .returning({ id: trackedCompanies.id });
    return result.length > 0 ? "bumped" : "alreadyScanned";
  }

  async getLeaderboardRows(opts: {
    provider?: string;
    category?: string;
    confidence?: string;
    ycBatch?: string;
    changedThisWeek?: boolean;
  } = {}): Promise<Array<TrackedCompany & { lastScan: Scan | null }>> {
    // LEFT JOIN scans on lastScanId so companies awaiting their first scan still appear.
    const rows = await db
      .select({ company: trackedCompanies, scan: scans })
      .from(trackedCompanies)
      .leftJoin(scans, eq(trackedCompanies.lastScanId, scans.id))
      .where(eq(trackedCompanies.status, "live"));

    let merged = rows.map((r) => ({ ...r.company, lastScan: r.scan }));

    if (opts.category) merged = merged.filter((r) => r.category === opts.category);
    if (opts.ycBatch) merged = merged.filter((r) => r.ycBatch === opts.ycBatch);
    if (opts.confidence) {
      merged = merged.filter((r) => (r.lastScan?.aiConfidence ?? "").toLowerCase() === opts.confidence!.toLowerCase());
    }
    if (opts.provider) {
      const target = opts.provider.toLowerCase();
      merged = merged.filter((r) => (r.lastScan?.aiProvider ?? "").toLowerCase().includes(target));
    }
    if (opts.changedThisWeek) {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      merged = merged.filter((r) => r.providerChangedAt && r.providerChangedAt >= cutoff);
    }

    // Default rank per playbook: most-recently-scanned first (so the
    // leaderboard reads as a "live" feed). Companies awaiting their first
    // scan sink to the bottom; ties are broken by High>Medium>Low confidence
    // and then by name for deterministic ordering.
    const confRank = (c?: string | null) => (c === "High" ? 0 : c === "Medium" ? 1 : c === "Low" ? 2 : 3);
    merged.sort((a, b) => {
      const ta = a.lastScannedAt ? new Date(a.lastScannedAt).getTime() : 0;
      const tb = b.lastScannedAt ? new Date(b.lastScannedAt).getTime() : 0;
      if (ta !== tb) return tb - ta;
      const ca = confRank(a.lastScan?.aiConfidence);
      const cb = confRank(b.lastScan?.aiConfidence);
      if (ca !== cb) return ca - cb;
      return a.name.localeCompare(b.name);
    });

    return merged;
  }

  async getYcBatches(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ ycBatch: trackedCompanies.ycBatch })
      .from(trackedCompanies)
      .where(eq(trackedCompanies.status, "live"));
    return rows
      .map((r) => r.ycBatch)
      .filter((b): b is string => !!b)
      .sort();
  }

  async getCompaniesChangedThisWeek(): Promise<Array<TrackedCompany & { lastScan: Scan | null }>> {
    return this.getLeaderboardRows({ changedThisWeek: true });
  }

  async getTrackedCompanyCategories(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ category: trackedCompanies.category })
      .from(trackedCompanies)
      .where(eq(trackedCompanies.status, "live"))
      .orderBy(trackedCompanies.category);
    return rows.map((r) => r.category);
  }

  // Distinct YC batches across the live index, used to populate the YC batch
  // filter Select on /stack. Skips rows with NULL ycBatch — many of the
  // bulk-imported long-tail companies aren't YC-funded.
  async getTrackedCompanyYcBatches(): Promise<string[]> {
    // Sort chronologically newest-first: parse the 2-digit year then sort by
    // year DESC, season DESC (W=winter > F=fall > S=summer within same year).
    // Plain alphabetical sort would put F24 before S06 which is misleading.
    const rows = await db
      .selectDistinct({ ycBatch: trackedCompanies.ycBatch })
      .from(trackedCompanies)
      .where(
        and(
          eq(trackedCompanies.status, "live"),
          sql`${trackedCompanies.ycBatch} IS NOT NULL`,
        ),
      );
    const seasonRank: Record<string, number> = { W: 3, F: 2, S: 1 };
    return rows
      .map((r) => r.ycBatch)
      .filter((b): b is string => Boolean(b))
      .sort((a, b) => {
        const ua = a.toUpperCase();
        const ub = b.toUpperCase();
        const yearA = parseInt(ua.slice(1), 10) || 0;
        const yearB = parseInt(ub.slice(1), 10) || 0;
        if (yearA !== yearB) return yearB - yearA;
        const rankDelta = (seasonRank[ub[0]] ?? 0) - (seasonRank[ua[0]] ?? 0);
        if (rankDelta !== 0) return rankDelta;
        // Final tiebreaker so two unknown season prefixes in the same year
        // (e.g. "X25" vs "Y25") sort deterministically rather than relying
        // on Array.sort's input order.
        return ua.localeCompare(ub);
      });
  }

  // ───── Bulk ingestion + paginated reads (programmatic SEO) ─────
  async bulkImportCompanies(rows: InsertTrackedCompany[]): Promise<{
    inserted: number;
    skipped: number;
    total: number;
  }> {
    if (rows.length === 0) return { inserted: 0, skipped: 0, total: 0 };

    // Pre-fetch existing slug/domain → (id, logoUrl) so we can skip
    // duplicates without round-tripping per row, and also backfill
    // `logo_url` onto existing rows whose value is null when the CSV
    // provides one. We dedupe within the input batch first to avoid
    // two rows in the same CSV both trying to claim the same domain.
    const existing = await db
      .select({
        id: trackedCompanies.id,
        slug: trackedCompanies.slug,
        domain: trackedCompanies.domain,
        logoUrl: trackedCompanies.logoUrl,
      })
      .from(trackedCompanies);
    const existingBySlug = new Map(existing.map((r) => [r.slug, r]));
    const existingByDomain = new Map(existing.map((r) => [r.domain.toLowerCase(), r]));

    const seen = new Set<string>();
    const seenDomain = new Set<string>();
    const toInsert: InsertTrackedCompany[] = [];
    const toBackfillLogo: Array<{ id: string; logoUrl: string }> = [];
    let skipped = 0;

    for (const row of rows) {
      const dom = row.domain.toLowerCase();
      const dup = existingBySlug.get(row.slug) ?? existingByDomain.get(dom);
      if (dup) {
        // Backfill the logo onto the existing row if the CSV has one
        // and the DB doesn't. Re-imports never overwrite an existing
        // logo — the CSV is treated as the seed, not as the source of
        // truth.
        if (row.logoUrl && !dup.logoUrl) {
          toBackfillLogo.push({ id: dup.id, logoUrl: row.logoUrl });
        }
        skipped++;
        continue;
      }
      if (seen.has(row.slug) || seenDomain.has(dom)) {
        skipped++;
        continue;
      }
      seen.add(row.slug);
      seenDomain.add(dom);
      toInsert.push(row);
    }

    let inserted = 0;
    if (toInsert.length > 0) {
      // Insert in 500-row chunks so a single Postgres call can't exceed
      // its parameter limit on huge CSVs (~65k params per statement).
      const CHUNK = 500;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const slice = toInsert.slice(i, i + CHUNK);
        const result = await db.insert(trackedCompanies).values(slice).returning({ id: trackedCompanies.id });
        inserted += result.length;
      }
    }

    if (toBackfillLogo.length > 0) {
      // One UPDATE per row — these only fire on first re-import after
      // a CSV gains the column, so the volume is bounded (~1.3k rows
      // for the YC seed) and per-row keeps the SQL trivial.
      for (const { id, logoUrl } of toBackfillLogo) {
        await db
          .update(trackedCompanies)
          .set({ logoUrl })
          .where(eq(trackedCompanies.id, id));
      }
      console.log(`[bulkImport] backfilled logo_url on ${toBackfillLogo.length} existing rows`);
    }

    return { inserted, skipped, total: rows.length };
  }

  async getCompaniesNeedingFirstScan(limit: number, perHostMax = 1): Promise<TrackedCompany[]> {
    // Pull more than we need so we can apply the per-host cap on the
    // application side. The cap exists so a CSV import of 200 Vercel-hosted
    // sites doesn't ask the worker to fan out 200 simultaneous requests
    // to vercel.com — instead we trickle one per host per tick.
    //
    // Honor `nextScanAt` so failed first scans get a real backoff window
    // (set to RETRY_DELAY_MS in the worker) instead of being re-picked
    // every tick.
    const now = new Date();
    const candidates = await db
      .select()
      .from(trackedCompanies)
      .where(
        and(
          eq(trackedCompanies.status, "live"),
          isNull(trackedCompanies.lastScanId),
          or(
            isNull(trackedCompanies.scanStatus),
            sql`${trackedCompanies.scanStatus} <> 'scanning'`,
          ),
          or(
            isNull(trackedCompanies.nextScanAt),
            lte(trackedCompanies.nextScanAt, now),
          ),
        ),
      )
      // Newest imports first — when an editor drops a fresh CSV in, those
      // rows should land on the index quickly so the new pages get scanned
      // before older stubs that have been queued for a while.
      .orderBy(sql`${trackedCompanies.importedAt} DESC NULLS LAST, ${trackedCompanies.createdAt} DESC`)
      .limit(limit * 5);

    const perHost = new Map<string, number>();
    const picked: TrackedCompany[] = [];
    for (const c of candidates) {
      if (picked.length >= limit) break;
      const host = c.domain.toLowerCase();
      const used = perHost.get(host) ?? 0;
      if (used >= perHostMax) continue;
      perHost.set(host, used + 1);
      picked.push(c);
    }
    return picked;
  }

  async getTrackedCompaniesPaginated(opts: {
    page: number;
    pageSize: number;
    category?: string;
    scanStatus?: "scanned" | "pending" | "failed" | "all";
    ycBatch?: string;
    provider?: string;
    search?: string;
  }): Promise<{ companies: TrackedCompany[]; total: number }> {
    const conds = [eq(trackedCompanies.status, "live")];
    if (opts.category) conds.push(eq(trackedCompanies.category, opts.category));
    if (opts.ycBatch) conds.push(eq(trackedCompanies.ycBatch, opts.ycBatch));
    if (opts.search) {
      const q = `%${opts.search.toLowerCase()}%`;
      conds.push(
        or(
          sql`LOWER(${trackedCompanies.name}) LIKE ${q}`,
          sql`LOWER(${trackedCompanies.domain}) LIKE ${q}`,
          sql`LOWER(${trackedCompanies.category}) LIKE ${q}`,
        )!,
      );
    }
    if (opts.scanStatus === "scanned") {
      conds.push(sql`${trackedCompanies.lastScanId} IS NOT NULL`);
    } else if (opts.scanStatus === "pending") {
      conds.push(sql`${trackedCompanies.lastScanId} IS NULL`);
    } else if (opts.scanStatus === "failed") {
      conds.push(eq(trackedCompanies.scanStatus, "failed"));
    }
    // Provider filter — needs to join the latest scan via lastScanId so the
    // filter applies to the FULL dataset (not just one page slice).
    if (opts.provider) {
      conds.push(
        sql`EXISTS (SELECT 1 FROM ${scans} WHERE ${scans.id} = ${trackedCompanies.lastScanId} AND LOWER(${scans.aiProvider}) = LOWER(${opts.provider}))`,
      );
    }

    const where = and(...conds);

    const page = Math.max(1, opts.page | 0);
    const pageSize = Math.min(200, Math.max(1, opts.pageSize | 0));

    const [companies, totalRow] = await Promise.all([
      db
        .select()
        .from(trackedCompanies)
        .where(where)
        .orderBy(
          // Scanned rows first (most recently scanned), then alphabetical for the long tail
          sql`${trackedCompanies.lastScanId} IS NULL`,
          sql`${trackedCompanies.lastScannedAt} DESC NULLS LAST`,
          trackedCompanies.name,
        )
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(trackedCompanies).where(where),
    ]);

    return { companies, total: Number(totalRow[0]?.count ?? 0) };
  }

  async getTrackedCompanyCounts(): Promise<{ total: number; scanned: number; pending: number; failed: number }> {
    const rows = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        scanned: sql<number>`SUM(CASE WHEN ${trackedCompanies.lastScanId} IS NOT NULL THEN 1 ELSE 0 END)::int`,
        pending: sql<number>`SUM(CASE WHEN ${trackedCompanies.lastScanId} IS NULL AND COALESCE(${trackedCompanies.scanStatus}, '') <> 'failed' THEN 1 ELSE 0 END)::int`,
        failed: sql<number>`SUM(CASE WHEN ${trackedCompanies.scanStatus} = 'failed' THEN 1 ELSE 0 END)::int`,
      })
      .from(trackedCompanies)
      .where(eq(trackedCompanies.status, "live"));
    const r = rows[0];
    return {
      total: Number(r?.total ?? 0),
      scanned: Number(r?.scanned ?? 0),
      pending: Number(r?.pending ?? 0),
      failed: Number(r?.failed ?? 0),
    };
  }

  async countAllTrackedCompanies(): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(trackedCompanies)
      .where(eq(trackedCompanies.status, "live"));
    return Number(rows[0]?.count ?? 0);
  }

  async listTrackedCompanySlugsPaginated(
    offset: number,
    limit: number,
  ): Promise<Array<{ slug: string; lastScannedAt: Date | null }>> {
    const rows = await db
      .select({ slug: trackedCompanies.slug, lastScannedAt: trackedCompanies.lastScannedAt })
      .from(trackedCompanies)
      .where(eq(trackedCompanies.status, "live"))
      .orderBy(trackedCompanies.slug)
      .limit(limit)
      .offset(offset);
    return rows;
  }

  // ───── Provider rollups ─────
  async listProviderRollups(): Promise<ProviderRollup[]> {
    return await db.select().from(providerRollups).orderBy(providerRollups.sortOrder, providerRollups.name);
  }

  async getProviderRollupBySlug(slug: string): Promise<ProviderRollup | undefined> {
    const result = await db.select().from(providerRollups).where(eq(providerRollups.slug, slug));
    return result[0];
  }

  async getCompaniesForProvider(rollup: ProviderRollup): Promise<Array<TrackedCompany & { lastScan: Scan | null }>> {
    const all = await this.getLeaderboardRows();
    const aliases = rollup.aliases.map((a) => a.toLowerCase());
    return all.filter((r) => {
      const p = (r.lastScan?.aiProvider ?? "").toLowerCase();
      if (rollup.slug === "unknown") return !p || p === "none" || aliases.some((a) => p.includes(a));
      return aliases.some((a) => p === a || p.includes(a));
    });
  }

  /**
   * Provider-aware "similar companies" for /stack/:slug.
   * 1. Companies on the same primary AI provider (excluding self) come first
   * 2. Then same category as a fallback so the section is never empty
   * 3. Always limited to `limit` rows
   */
  async getSimilarCompanies(
    company: TrackedCompany,
    primaryProvider: string | null,
    limit = 6,
  ): Promise<Array<TrackedCompany & { lastScan: Scan | null }>> {
    const all = await this.getLeaderboardRows();
    const target = (primaryProvider || "").toLowerCase().trim();

    const sameProvider = target
      ? all.filter(
          (c) =>
            c.slug !== company.slug &&
            (c.lastScan?.aiProvider ?? "").toLowerCase().trim() === target,
        )
      : [];

    const seen = new Set(sameProvider.map((c) => c.slug));
    const sameCategory = all.filter(
      (c) => c.slug !== company.slug && c.category === company.category && !seen.has(c.slug),
    );

    return [...sameProvider, ...sameCategory].slice(0, limit);
  }

  // ───── Leaderboard snapshots (weekly archive) ─────
  async getLeaderboardSnapshot(isoWeek: string): Promise<LeaderboardSnapshot | undefined> {
    const result = await db
      .select()
      .from(leaderboardSnapshots)
      .where(eq(leaderboardSnapshots.isoWeek, isoWeek));
    return result[0];
  }

  async upsertLeaderboardSnapshot(snap: InsertLeaderboardSnapshot): Promise<LeaderboardSnapshot> {
    const [row] = await db
      .insert(leaderboardSnapshots)
      .values(snap)
      .onConflictDoUpdate({
        target: leaderboardSnapshots.isoWeek,
        set: {
          totalCompanies: snap.totalCompanies,
          topProvider: snap.topProvider,
          changesCount: snap.changesCount,
          payload: snap.payload,
          takenAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async listLeaderboardSnapshots(limit = 20): Promise<LeaderboardSnapshot[]> {
    return await db
      .select()
      .from(leaderboardSnapshots)
      .orderBy(desc(leaderboardSnapshots.takenAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
