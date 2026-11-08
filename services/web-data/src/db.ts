import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
export type Query = {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
};
export class Database {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    public driver: Query,
    private pool?: pg.Pool,
    private local?: PGlite,
  ) {}
  static async open(url?: string, localPath?: string) {
    if (url) {
      const pool = new pg.Pool({ connectionString: url, max: 10 });
      return new Database(pool, pool);
    }
    const local = new PGlite(localPath);
    await local.waitReady;
    return new Database(local as unknown as Query, undefined, local);
  }
  async migrate() {
    const sql = await readFile("migrations/001.sql", "utf8");
    if (this.local) await this.local.exec(sql);
    else await this.driver.query(sql);
  }
  async tx<T>(fn: (q: Query) => Promise<T>): Promise<T> {
    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }
    const task = this.tail.then(async () => {
      await this.driver.query("BEGIN");
      try {
        const result = await fn(this.driver);
        await this.driver.query("COMMIT");
        return result;
      } catch (e) {
        await this.driver.query("ROLLBACK");
        throw e;
      }
    });
    this.tail = task.catch(() => {});
    return task;
  }
  async close() {
    await this.tail;
    if (this.pool) await this.pool.end();
    else await this.local?.close();
  }
}
