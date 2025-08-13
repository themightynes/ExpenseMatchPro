import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  googleId: text("google_id").unique(),
  profilePicture: text("profile_picture"),
  isAuthorized: boolean("is_authorized").default(false), // Only authorized user can access
  createdAt: timestamp("created_at").default(sql`now()`),
  lastLoginAt: timestamp("last_login_at"),
});

export const receipts = pgTable("receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: text("file_name").notNull(),
  originalFileName: text("original_file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  merchant: text("merchant"),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  date: timestamp("date"),
  category: text("category"),
  ocrText: text("ocr_text"),
  extractedData: jsonb("extracted_data"),
  processingStatus: text("processing_status").notNull().default("pending"), // pending, processing, completed, failed
  statementId: varchar("statement_id").references(() => amexStatements.id),
  isMatched: boolean("is_matched").default(false),
  matchedChargeId: varchar("matched_charge_id").references(() => amexCharges.id),
  organizedPath: text("organized_path"), // Path after file reorganization
  needsManualReview: boolean("needs_manual_review").default(false), // Flag for manual review requirement
  // Transportation-specific fields
  fromAddress: text("from_address"), // Pickup location for rideshare/taxi
  toAddress: text("to_address"), // Dropoff location for rideshare/taxi
  tripDistance: text("trip_distance"), // Distance traveled
  tripDuration: text("trip_duration"), // Duration of trip
  driverName: text("driver_name"), // Driver information
  vehicleInfo: text("vehicle_info"), // Vehicle details
  notes: text("notes"), // Additional notes
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const amexStatements = pgTable("amex_statements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  periodName: text("period_name").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").default(false),
  userNotes: text("user_notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const amexCharges = pgTable("amex_charges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  statementId: varchar("statement_id").notNull(),
  date: timestamp("date").notNull(),
  description: text("description").notNull(), // AMEX Description field
  cardMember: text("card_member").notNull(),
  accountNumber: text("account_number").notNull(),
  amount: text("amount").notNull(), // Keep as text to preserve negative values and formatting
  extendedDetails: text("extended_details"),
  statementAs: text("statement_as"), // "Appears On Your Statement As"
  address: text("address"),
  cityState: text("city_state"),
  zipCode: text("zip_code"),
  country: text("country"),
  reference: text("reference"),
  category: text("category"),
  isMatched: boolean("is_matched").default(false),
  receiptId: varchar("receipt_id"),
  isPersonalExpense: boolean("is_personal_expense").default(false),
  noReceiptRequired: boolean("no_receipt_required").default(false), // Marks expense as not requiring a receipt
  isNonAmex: boolean("is_non_amex").default(false), // Marks expense as created from non-AMEX receipt
  userNotes: text("user_notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const expenseTemplates = pgTable("expense_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  statementId: varchar("statement_id").notNull(),
  templateData: jsonb("template_data").notNull(),
  generatedAt: timestamp("generated_at").default(sql`now()`),
});

// Insert schemas
export const insertReceiptSchema = createInsertSchema(receipts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAmexStatementSchema = createInsertSchema(amexStatements).omit({
  id: true,
  createdAt: true,
});

export const insertAmexChargeSchema = createInsertSchema(amexCharges).omit({
  id: true,
  createdAt: true,
});

// CSV import schema for AMEX charges
export const amexCsvRowSchema = z.object({
  Date: z.string(),
  Description: z.string(),
  "Card Member": z.string(),
  "Account #": z.string(),
  Amount: z.string(),
  "Extended Details": z.string().optional(),
  "Appears On Your Statement As": z.string().optional(),
  Address: z.string().optional(),
  "City/State": z.string().optional(),
  "Zip Code": z.string().optional(),
  Country: z.string().optional(),
  Reference: z.string(),
  Category: z.string(),
});

export const insertExpenseTemplateSchema = createInsertSchema(expenseTemplates).omit({
  id: true,
  generatedAt: true,
});

// Types
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receipts.$inferSelect;
export type InsertAmexStatement = z.infer<typeof insertAmexStatementSchema>;
export type AmexStatement = typeof amexStatements.$inferSelect;
export type InsertAmexCharge = z.infer<typeof insertAmexChargeSchema>;
export type AmexCharge = typeof amexCharges.$inferSelect;
export type InsertExpenseTemplate = z.infer<typeof insertExpenseTemplateSchema>;
export type ExpenseTemplate = typeof expenseTemplates.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true,
  createdAt: true,
  lastLoginAt: true
});

// Expense categories from the uploaded images
export const EXPENSE_CATEGORIES = [
  "Meals - Travel Individual",
  "Meals - Travel Multiple TJX Associates",
  "Meals - Vendor/Client",
  "Hotel",
  "Hotel Room Night",
  "Hotel Tax",
  "Airfare",
  "Airline Luggage Fees",
  "Car Rental",
  "Taxi",
  "Gas",
  "Parking",
  "Telephone",
  "Cellular Wireless",
  "Supplies",
  "Photography",
  "Event Sponsorship",
  "Flowers",
  "Gift Cards / Gift",
  "Limousine",
  "Membership",
  "Natural Disaster",
  "Overnight Travel (no hotel)",
  "Pre-Opening - Help Wanted",
  "Pre-Opening - Other",
  "Pre-Opening - Travel",
  "REPDOT",
  "Rail",
  "Samples",
  "Seminar - External",
  "Seminar - Internal",
  "Tolls/Cash Tips",
  "Tri-Brand Photography",
  "Misc. Non-Travel",
  "Misc. Travel Related",
  "Associate Breakroom Supplies",
  "EBO L Expenses",
  "MarmaxxField ServiceAward Assoc Luncheon",
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];
