import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const directory = mkdtempSync(join(tmpdir(), "bmti-compat-"));
buildSync({entryPoints:["lib/legacy.ts"],outfile:join(directory,"legacy.mjs"),bundle:true,platform:"node",format:"esm"});
const { environmentValue, displayVersion, readDraft, clearDraft, draftKey } = await import(join(directory,"legacy.mjs"));
process.on("exit", () => rmSync(directory,{recursive:true,force:true}));
test("new environment names take priority and old configuration remains readable", () => {
  assert.equal(environmentValue("BMTI_ADMIN_HASH", {BMTI_ADMIN_HASH:"new",HGP_ADMIN_HASH:"old"}),"new");
  assert.equal(environmentValue("BMTI_ADMIN_HASH", {HGP_ADMIN_HASH:"old"}),"old");
  assert.equal(environmentValue("BMTI_DATABASE_PATH", {HGP_DATABASE_PATH:"existing.sqlite3"}),"existing.sqlite3");
});
test("legacy report versions display BMTI without changing stored versions", () => {
  const report={version:"HGP-0.2"};
  assert.equal(displayVersion(report.version),"BMTI-0.2");
  assert.equal(report.version,"HGP-0.2");
  assert.equal(displayVersion("BMTI-0.3"),"BMTI-0.3");
});
test("drafts retain legacy fallback, prefer current answers and clear both keys", () => {
  const values=new Map([["hgp-draft-record",'{"N01":3}']]);
  const storage={getItem:key=>values.get(key)??null,removeItem:key=>values.delete(key)};
  assert.equal(readDraft(storage,"record"),'{"N01":3}');
  values.set(draftKey("record"),'{"N01":4}');
  assert.equal(readDraft(storage,"record"),'{"N01":4}');
  clearDraft(storage,"record");
  assert.equal(values.size,0);
});
