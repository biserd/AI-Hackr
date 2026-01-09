import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, desc, and, lt, isNull } from "drizzle-orm";
import { 
  users, 
  sessions,
  magicLinks,
  subscriptions,
  changeEvents,
  scans, 
  type User, 
  type InsertUser, 
  type Session,
  type MagicLink,
  type Subscription,
  type InsertSubscription,
  type ChangeEvent,
  type Scan, 
  type InsertScan 
} from "@shared/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Session methods
  createSession(userId: string, token: string, expiresAt: Date, userAgent?: string, ipAddress?: string): Promise<Session>;
  getSessionByToken(token: string): Promise<Session | undefined>;
  deleteSession(id: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;
  
  // Magic link methods
  createMagicLink(email: string, tokenHash: string, expiresAt: Date): Promise<MagicLink>;
  getMagicLinkByTokenHash(tokenHash: string): Promise<MagicLink | undefined>;
  consumeMagicLink(id: string): Promise<void>;
  cleanupExpiredMagicLinks(): Promise<void>;
  
  // Subscription methods
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getSubscription(id: string): Promise<Subscription | undefined>;
  getUserSubscriptions(userId: string): Promise<Subscription[]>;
  updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription | undefined>;
  deleteSubscription(id: string): Promise<void>;
  getActiveSubscriptions(): Promise<Subscription[]>;
  
  // Change event methods
  createChangeEvent(event: Omit<ChangeEvent, 'id' | 'detectedAt'>): Promise<ChangeEvent>;
  getSubscriptionChangeEvents(subscriptionId: string): Promise<ChangeEvent[]>;
  markChangeEventNotified(id: string): Promise<void>;
  getPendingNotifications(): Promise<ChangeEvent[]>;
  
  // Scan methods
  createScan(scan: InsertScan): Promise<Scan>;
  getScan(id: string): Promise<Scan | undefined>;
  getScanByDomain(domain: string): Promise<Scan | undefined>;
  getRecentScans(limit?: number): Promise<Scan[]>;
  getUserScans(userId: string, limit?: number): Promise<Scan[]>;
  updateScan(id: string, updates: Partial<InsertScan>): Promise<Scan | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User methods
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

  // Session methods
  async createSession(userId: string, token: string, expiresAt: Date, userAgent?: string, ipAddress?: string): Promise<Session> {
    const result = await db.insert(sessions).values({
      userId,
      token,
      expiresAt,
      userAgent,
      ipAddress,
    }).returning();
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

  // Magic link methods
  async createMagicLink(email: string, tokenHash: string, expiresAt: Date): Promise<MagicLink> {
    const result = await db.insert(magicLinks).values({
      email: email.toLowerCase(),
      tokenHash,
      expiresAt,
    }).returning();
    return result[0];
  }

  async getMagicLinkByTokenHash(tokenHash: string): Promise<MagicLink | undefined> {
    const result = await db.select().from(magicLinks).where(
      and(
        eq(magicLinks.tokenHash, tokenHash),
        isNull(magicLinks.consumedAt)
      )
    );
    return result[0];
  }

  async consumeMagicLink(id: string): Promise<void> {
    await db.update(magicLinks).set({ consumedAt: new Date() }).where(eq(magicLinks.id, id));
  }

  async cleanupExpiredMagicLinks(): Promise<void> {
    await db.delete(magicLinks).where(lt(magicLinks.expiresAt, new Date()));
  }

  // Subscription methods
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

  // Change event methods
  async createChangeEvent(event: Omit<ChangeEvent, 'id' | 'detectedAt'>): Promise<ChangeEvent> {
    const result = await db.insert(changeEvents).values(event).returning();
    return result[0];
  }

  async getSubscriptionChangeEvents(subscriptionId: string): Promise<ChangeEvent[]> {
    return await db.select().from(changeEvents)
      .where(eq(changeEvents.subscriptionId, subscriptionId))
      .orderBy(desc(changeEvents.detectedAt));
  }

  async markChangeEventNotified(id: string): Promise<void> {
    await db.update(changeEvents).set({
      notificationSent: true,
      notificationSentAt: new Date(),
    }).where(eq(changeEvents.id, id));
  }

  async getPendingNotifications(): Promise<ChangeEvent[]> {
    return await db.select().from(changeEvents).where(eq(changeEvents.notificationSent, false));
  }

  // Scan methods
  async createScan(insertScan: InsertScan): Promise<Scan> {
    const result = await db.insert(scans).values(insertScan).returning();
    return result[0];
  }

  async getScan(id: string): Promise<Scan | undefined> {
    const result = await db.select().from(scans).where(eq(scans.id, id));
    return result[0];
  }

  async getScanByDomain(domain: string): Promise<Scan | undefined> {
    const result = await db
      .select()
      .from(scans)
      .where(eq(scans.domain, domain))
      .orderBy(desc(scans.scannedAt))
      .limit(1);
    return result[0];
  }

  async getRecentScans(limit: number = 10): Promise<Scan[]> {
    const result = await db
      .select()
      .from(scans)
      .orderBy(desc(scans.scannedAt))
      .limit(limit);
    return result;
  }

  async getUserScans(userId: string, limit: number = 50): Promise<Scan[]> {
    return await db
      .select()
      .from(scans)
      .where(eq(scans.userId, userId))
      .orderBy(desc(scans.scannedAt))
      .limit(limit);
  }

  async updateScan(id: string, updates: Partial<InsertScan>): Promise<Scan | undefined> {
    const result = await db
      .update(scans)
      .set(updates)
      .where(eq(scans.id, id))
      .returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
