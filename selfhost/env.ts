import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SQLiteBinding } from "./sqlite";
import { environmentValue } from "../lib/legacy";
process.umask(0o077);
const release = dirname(fileURLToPath(import.meta.url));
const databasePath = environmentValue("BMTI_DATABASE_PATH", process.env);
if (!databasePath)
  throw new Error("BMTI_DATABASE_PATH is required");
export const env = {
  DB: new SQLiteBinding(
    databasePath,
    join(release, "migrations"),
  ),
  BMTI_ADMIN_HASH: environmentValue("BMTI_ADMIN_HASH", process.env),
};
