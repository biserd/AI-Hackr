import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, desc, and, lt, gt, isNull, isNotNull, sql, inArray, or, gte, lte } from "drizzle-orm";
import {
  users,
  sessions,
  magicLinks,
  subscriptions,
  changeEvents,
  scans,
  userSettings,
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
  createChangeEvent(event: Partial<ChangeEvent> & { subscriptionId: string; newScanId: string; changeType: string }): Promise<ChangeEvent>;
  getSubscriptionChangeEvents(subscriptionId: string, limit?: number): Promise<ChangeEvent[]>;
  getChangeEvent(id: string): Promise<ChangeEvent | undefined>;
  markChangeEventNotified(id: string): Promise<void>;
  markChangeEventAlerted(id: string): Promise<void>;
  getPendingNotifications(): Promise<ChangeEvent[]>;
  /** Find any prior alert sent for the same (entry, provider, changeType) within `sinceMs` ms */
  findRecentAlert(entryId: string, provider: string, changeType: string, sinceMs: number): Promise<ChangeEvent | undefined>;
  /** Stack changes detected within a date range, optional user filter */
  getChangeEventsForUser(userId: string, since: Date): Promise<ChangeEvent[]>;
  /** Mark a change as dismissed (false-positive suppression) */
  dismissChangeEvent(id: string, dismissedUntil: Date): Promise<void>;
  /** Get any active dismissal in effect for (entry, provider, newConfidence) — used to suppress repeat alerts */
  hasActiveDismissal(entryId: string, provider: string, newConfidence: string | null): Promise<boolean>;

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
  /** Users whose digest is due (active + digestEnabled + last sent > 6 days ago or never) */
  getUsersDueForDigest(now: Date): Promise<User[]>;
  markDigestSent(userId: string): Promise<void>;
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
    // Active + not paused + (next_scan_at IS NULL OR next_scan_at <= now)
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
    event: Partial<ChangeEvent> & { subscriptionId: string; newScanId: string; changeType: string }
  ): Promise<ChangeEvent> {
    const result = await db.insert(changeEvents).values(event as any).returning();
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
    sinceMs: number
  ): Promise<ChangeEvent | undefined> {
    const since = new Date(Date.now() - sinceMs);
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
      userId,
      ...updates,
    } as any).returning();
    return result[0];
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
}

export const storage = new DatabaseStorage();
