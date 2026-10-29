import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SQLiteBinding } from "./sqlite";
process.umask(0o077);
const release = dirname(fileURLToPath(import.meta.url));
if (!process.env.HGP_DATABASE_PATH)
  throw new Error("HGP_DATABASE_PATH is required");
export const env = {
  DB: new SQLiteBinding(
    process.env.HGP_DATABASE_PATH,
    join(release, "migrations"),
  ),
  HGP_ADMIN_HASH: process.env.HGP_ADMIN_HASH,
};
