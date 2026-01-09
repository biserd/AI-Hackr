import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, desc } from "drizzle-orm";
import { users, scans, type User, type InsertUser, type Scan, type InsertScan } from "@shared/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Scan methods
  createScan(scan: InsertScan): Promise<Scan>;
  getScan(id: string): Promise<Scan | undefined>;
  getRecentScans(limit?: number): Promise<Scan[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createScan(insertScan: InsertScan): Promise<Scan> {
    const result = await db.insert(scans).values(insertScan).returning();
    return result[0];
  }

  async getScan(id: string): Promise<Scan | undefined> {
    const result = await db.select().from(scans).where(eq(scans.id, id));
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
}

export const storage = new DatabaseStorage();
