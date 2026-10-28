import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  questionCount: integer("question_count").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const attempts = sqliteTable("attempts", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  nickname: text("nickname").notNull(),
  questionIds: text("question_ids").notNull(),
  answers: text("answers"),
  report: text("report"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const adminSessions = sqliteTable("admin_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  expiresAt: integer("expires_at").notNull(),
});
export const adminLimits = sqliteTable("admin_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
