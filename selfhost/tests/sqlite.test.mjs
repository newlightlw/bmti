import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "hgp-sqlite-"));
buildSync({
  entryPoints: ["selfhost/sqlite.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: join(root, "sqlite.mjs"),
});
const { SQLiteBinding } = await import(join(root, "sqlite.mjs"));
process.on("exit", () => rmSync(root, { recursive: true, force: true }));
function fixture(name) {
  const directory = join(root, name);
  mkdirSync(directory);
  const migrations = join(directory, "migrations");
  mkdirSync(migrations);
  writeFileSync(
    join(migrations, "0000.sql"),
    "CREATE TABLE entries(id TEXT PRIMARY KEY, value INTEGER NOT NULL);",
  );
  return { path: join(directory, "data/store.sqlite3"), migrations };
}
test("migrations apply once and records persist after restart", async () => {
  const f = fixture("persist");
  let db = new SQLiteBinding(f.path, f.migrations);
  await db.prepare("INSERT INTO entries VALUES(?,?)").bind("a", 24).run();
  db.close();
  db = new SQLiteBinding(f.path, f.migrations);
  assert.deepEqual(
    await db.prepare("SELECT * FROM entries WHERE id=?").bind("a").first(),
    { id: "a", value: 24 },
  );
  assert.equal(
    await db
      .prepare("SELECT * FROM entries WHERE id=?")
      .bind("missing")
      .first(),
    null,
  );
  db.close();
});
test("batch rolls back completely on a failed statement", async () => {
  const f = fixture("atomic");
  const db = new SQLiteBinding(f.path, f.migrations);
  await assert.rejects(
    db.batch([
      db.prepare("INSERT INTO entries VALUES(?,?)").bind("a", 1),
      db.prepare("INSERT INTO entries VALUES(?,?)").bind("a", 2),
    ]),
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) as n FROM entries").first()).n,
    0,
  );
  db.close();
});
test("applied migrations cannot silently change", () => {
  const f = fixture("immutability");
  const db = new SQLiteBinding(f.path, f.migrations);
  db.close();
  writeFileSync(
    join(f.migrations, "0000.sql"),
    "CREATE TABLE other(id INTEGER);",
  );
  assert.throws(
    () => new SQLiteBinding(f.path, f.migrations),
    /Applied migration changed/,
  );
});
test("SQL values remain bound, not interpreted", async () => {
  const f = fixture("binding");
  const db = new SQLiteBinding(f.path, f.migrations);
  const id = "a'); DROP TABLE entries;--";
  await db.prepare("INSERT INTO entries VALUES(?,?)").bind(id, 7).run();
  assert.equal(
    (await db.prepare("SELECT value FROM entries WHERE id=?").bind(id).first())
      .value,
    7,
  );
  db.close();
});
