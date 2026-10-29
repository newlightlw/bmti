import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { legacy } from "../lib/legacy";

type Value = string | number | null;
class Statement {
  constructor(
    private database: DatabaseSync,
    private sql: string,
    private values: Value[] = [],
  ) {}
  bind(...values: Value[]) {
    return new Statement(this.database, this.sql, values);
  }
  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const row = this.database.prepare(this.sql).get(...this.values);
    return row ? ({ ...row } as T) : null;
  }
  execute() {
    return this.database.prepare(this.sql).run(...this.values);
  }
  async run() {
    this.execute();
    return { success: true };
  }
}
export class SQLiteBinding {
  private database: DatabaseSync;
  constructor(path: string, migrations: string) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.database = new DatabaseSync(path);
    this.database.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;",
    );
    const migrationTable = this.database.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    ).get(legacy.migrationTable) ? legacy.migrationTable : "_bmti_migrations";
    this.database.exec(
      `CREATE TABLE IF NOT EXISTS ${migrationTable}(name TEXT PRIMARY KEY,checksum TEXT NOT NULL)`,
    );
    for (const name of readdirSync(migrations)
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const sql = readFileSync(join(migrations, name), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = this.database
        .prepare(`SELECT checksum FROM ${migrationTable} WHERE name=?`)
        .get(name);
      if (existing) {
        if (existing.checksum !== checksum)
          throw new Error("Applied migration changed: " + name);
        continue;
      }
      this.database.exec("BEGIN IMMEDIATE");
      try {
        this.database.exec(sql);
        this.database
          .prepare(`INSERT INTO ${migrationTable} VALUES(?,?)`)
          .run(name, checksum);
        this.database.exec("COMMIT");
      } catch (error) {
        this.database.exec("ROLLBACK");
        throw error;
      }
    }
  }
  prepare(sql: string) {
    return new Statement(this.database, sql);
  }
  async batch(statements: Statement[]) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((s) => s.execute());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
  close() {
    this.database.close();
  }
}
