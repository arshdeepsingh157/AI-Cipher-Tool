import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const encryptionHistoryTable = pgTable("encryption_history", {
  id: serial("id").primaryKey(),
  operation: text("operation").notNull(),
  algorithm: text("algorithm").notNull(),
  inputLength: integer("input_length").notNull(),
  outputLength: integer("output_length").notNull(),
  processingTime: real("processing_time").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEncryptionHistorySchema = createInsertSchema(encryptionHistoryTable).omit({ id: true, createdAt: true });
export type InsertEncryptionHistory = z.infer<typeof insertEncryptionHistorySchema>;
export type EncryptionHistory = typeof encryptionHistoryTable.$inferSelect;
