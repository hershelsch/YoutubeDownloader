import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const downloads = pgTable("downloads", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  format: text("format").notNull(),
  quality: text("quality").notNull(),
  status: text("status").notNull().default("pending"), // pending, downloading, completed, failed
  progress: integer("progress").default(0),
  fileName: text("file_name"),
  fileSize: text("file_size"),
  zipPath: text("zip_path"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertDownloadSchema = createInsertSchema(downloads).pick({
  url: true,
  format: true,
  quality: true,
});

export const downloadRequestSchema = z.object({
  url: z.string().url().refine((url) => {
    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/
    ];
    return patterns.some(pattern => pattern.test(url));
  }, "Must be a valid YouTube URL"),
  format: z.enum(["mp4", "mp3", "webm"]),
  quality: z.enum(["1080p", "720p", "480p", "360p", "best"])
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertDownload = z.infer<typeof insertDownloadSchema>;
export type Download = typeof downloads.$inferSelect;
export type DownloadRequest = z.infer<typeof downloadRequestSchema>;
