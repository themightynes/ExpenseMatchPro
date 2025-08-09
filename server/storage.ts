import { 
  receipts,
  amexStatements,
  amexCharges,
  expenseTemplates,
  type User, 
  type InsertUser,
  type Receipt,
  type InsertReceipt,
  type AmexStatement,
  type InsertAmexStatement,
  type AmexCharge,
  type InsertAmexCharge,
  type ExpenseTemplate,
  type InsertExpenseTemplate
} from "@shared/schema";
import { db } from "./db";
import { eq, and, isNull, desc, between, count, lte, gte } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Receipt methods
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
  getReceipt(id: string): Promise<Receipt | undefined>;
  getAllReceipts(): Promise<Receipt[]>;
  updateReceipt(id: string, updates: Partial<Receipt>): Promise<Receipt | undefined>;
  deleteReceipt(id: string): Promise<boolean>;
  getReceiptsByStatus(status: string): Promise<Receipt[]>;
  getReceiptsByStatement(statementId: string): Promise<Receipt[]>;
  autoAssignReceiptToStatement(receiptId: string): Promise<Receipt | undefined>;
  
  // AMEX Statement methods
  createAmexStatement(statement: InsertAmexStatement): Promise<AmexStatement>;
  getAmexStatement(id: string): Promise<AmexStatement | undefined>;
  getAllAmexStatements(): Promise<AmexStatement[]>;
  updateAmexStatement(id: string, updates: Partial<AmexStatement>): Promise<AmexStatement | undefined>;
  getActiveStatement(): Promise<AmexStatement | undefined>;

  // AMEX Charge methods
  createAmexCharge(charge: InsertAmexCharge): Promise<AmexCharge>;
  getAmexCharge(id: string): Promise<AmexCharge | undefined>;
  getChargesByStatement(statementId: string): Promise<AmexCharge[]>;
  updateAmexCharge(id: string, updates: Partial<AmexCharge>): Promise<AmexCharge | undefined>;
  getUnmatchedCharges(statementId: string): Promise<AmexCharge[]>;

  // Expense Template methods
  createExpenseTemplate(template: InsertExpenseTemplate): Promise<ExpenseTemplate>;
  getExpenseTemplate(id: string): Promise<ExpenseTemplate | undefined>;
  getTemplatesByStatement(statementId: string): Promise<ExpenseTemplate[]>;

  // Dashboard stats
  getProcessingStats(): Promise<{
    processedCount: number;
    pendingCount: number;
    readyCount: number;
    processingCount: number;
  }>;
  
  // File organization
  getOrganizedPath(receipt: Receipt): string;
  updateReceiptPath(receiptId: string, organizedPath: string): Promise<Receipt | undefined>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    this.initializeSampleData();
  }

  private async initializeSampleData() {
    try {
      // Check if we already have data
      const existingStatements = await db.select().from(amexStatements).limit(1);
      if (existingStatements.length > 0) return;

      // Create sample statement periods
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      // Current statement period
      const [currentStatement] = await db.insert(amexStatements).values({
        periodName: `${currentYear} - ${String(currentMonth + 1).padStart(2, '0')} Statement`,
        startDate: new Date(currentYear, currentMonth, 1),
        endDate: new Date(currentYear, currentMonth + 1, 0),
        isActive: true,
      }).returning();

      // Add sample receipts
      await db.insert(receipts).values([
        {
          fileName: "starbucks_receipt_080525.jpg",
          originalFileName: "IMG_4733.JPG",
          fileUrl: "/objects/uploads/receipt-001",
          merchant: "Starbucks",
          amount: "5.95",
          date: new Date("2025-08-05"),
          category: "Restaurant-Bar & Café",
          processingStatus: "completed",
          statementId: currentStatement.id,
          isMatched: false,
        },
        {
          fileName: "uber_receipt_080825.pdf", 
          originalFileName: "Receipt - Cebtro Jardinero Del Sur - Jul 7, 2025.pdf",
          fileUrl: "/objects/uploads/receipt-002",
          merchant: "Uber Eats",
          amount: "23.45",
          date: new Date("2025-08-08"),
          category: "Restaurant-Restaurant",
          processingStatus: "completed",
          statementId: currentStatement.id,
          isMatched: false,
        }
      ]);

      // Add sample AMEX charges
      await db.insert(amexCharges).values([
        {
          date: new Date("2025-08-05"),
          statementId: currentStatement.id,
          description: "AplPay STARBUCKS STOLOS ANGELES         CA",
          cardMember: "ERNESTO CHAPA",
          accountNumber: "-73007",
          amount: "5.95",
          extendedDetails: "1F401DEEA7F FAST FOOD RESTAURANT\nAplPay STARBUCKS STORE 2416\nLOS ANGELES\nCA\nFAST FOOD RESTAURANT",
          statementAs: "AplPay STARBUCKS STOLOS ANGELES         CA",
          address: "700 WEST 7TH ST",
          cityState: "LOS ANGELES\nCA",
          zipCode: "90017",
          country: "UNITED STATES",
          reference: "320250980454476712",
          category: "Restaurant-Bar & Café",
          isMatched: false,
        },
        {
          date: new Date("2025-08-08"),
          statementId: currentStatement.id,
          description: "UBER EATS           help.uber.com       CA",
          cardMember: "ERNESTO CHAPA",
          accountNumber: "-73007",
          amount: "23.45",
          extendedDetails: "RT93WKEN   FK6L7SUN         94103\nUBER EATS\nhelp.uber.com\nCA\nFK6L7SUN         94103",
          statementAs: "UBER EATS           help.uber.com       CA",
          address: "1455 MARKET ST\n-",
          cityState: "SAN FRANCISCO\nCA",
          zipCode: "94103",
          country: "UNITED STATES",
          reference: "320250980453880764",
          category: "Restaurant-Restaurant",
          isMatched: false,
        }
      ]);
      
    } catch (error) {
      console.error("Error initializing sample data:", error);
    }
  }

  // User methods (not implemented for this receipt management app)
  async getUser(id: string): Promise<User | undefined> {
    return undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return undefined; // Not implemented for this app
  }

  async createUser(user: InsertUser): Promise<User> {
    throw new Error("User creation not implemented");
  }

  // Receipt methods
  async createReceipt(receipt: InsertReceipt): Promise<Receipt> {
    const [newReceipt] = await db.insert(receipts).values(receipt).returning();
    return newReceipt;
  }

  async getReceipt(id: string): Promise<Receipt | undefined> {
    const [receipt] = await db.select().from(receipts).where(eq(receipts.id, id));
    return receipt || undefined;
  }

  async getAllReceipts(): Promise<Receipt[]> {
    return await db.select().from(receipts).orderBy(desc(receipts.createdAt));
  }

  async updateReceipt(id: string, updates: Partial<Receipt>): Promise<Receipt | undefined> {
    const [updated] = await db.update(receipts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(receipts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteReceipt(id: string): Promise<boolean> {
    const result = await db.delete(receipts).where(eq(receipts.id, id));
    return (result as any).rowCount > 0;
  }

  async getReceiptsByStatus(status: string): Promise<Receipt[]> {
    return await db.select().from(receipts)
      .where(eq(receipts.processingStatus, status))
      .orderBy(desc(receipts.createdAt));
  }

  async getReceiptsByStatement(statementId: string): Promise<Receipt[]> {
    return await db.select().from(receipts)
      .where(eq(receipts.statementId, statementId))
      .orderBy(desc(receipts.createdAt));
  }

  async autoAssignReceiptToStatement(receiptId: string): Promise<Receipt | undefined> {
    const receipt = await this.getReceipt(receiptId);
    if (!receipt || !receipt.date) return receipt;

    // Find statement that contains this date
    const statements = await db.select().from(amexStatements)
      .where(and(
        lte(amexStatements.startDate, receipt.date),
        gte(amexStatements.endDate, receipt.date)
      ));

    if (statements.length > 0) {
      return await this.updateReceipt(receiptId, { 
        statementId: statements[0].id 
      });
    }

    return receipt;
  }

  // AMEX Statement methods
  async createAmexStatement(statement: InsertAmexStatement): Promise<AmexStatement> {
    const [newStatement] = await db.insert(amexStatements).values(statement).returning();
    return newStatement;
  }

  async getAmexStatement(id: string): Promise<AmexStatement | undefined> {
    const [statement] = await db.select().from(amexStatements).where(eq(amexStatements.id, id));
    return statement || undefined;
  }

  async getAllAmexStatements(): Promise<AmexStatement[]> {
    return await db.select().from(amexStatements).orderBy(desc(amexStatements.startDate));
  }

  async updateAmexStatement(id: string, updates: Partial<AmexStatement>): Promise<AmexStatement | undefined> {
    const [updated] = await db.update(amexStatements)
      .set(updates)
      .where(eq(amexStatements.id, id))
      .returning();
    return updated || undefined;
  }

  async getActiveStatement(): Promise<AmexStatement | undefined> {
    const [activeStatement] = await db.select().from(amexStatements)
      .where(eq(amexStatements.isActive, true));
    return activeStatement || undefined;
  }

  // AMEX Charge methods
  async createAmexCharge(charge: InsertAmexCharge): Promise<AmexCharge> {
    const [newCharge] = await db.insert(amexCharges).values(charge).returning();
    return newCharge;
  }

  async getAmexCharge(id: string): Promise<AmexCharge | undefined> {
    const [charge] = await db.select().from(amexCharges).where(eq(amexCharges.id, id));
    return charge || undefined;
  }

  async getChargesByStatement(statementId: string): Promise<AmexCharge[]> {
    return await db.select().from(amexCharges)
      .where(eq(amexCharges.statementId, statementId))
      .orderBy(desc(amexCharges.date));
  }

  async updateAmexCharge(id: string, updates: Partial<AmexCharge>): Promise<AmexCharge | undefined> {
    const [updated] = await db.update(amexCharges)
      .set(updates)
      .where(eq(amexCharges.id, id))
      .returning();
    return updated || undefined;
  }

  async getUnmatchedCharges(statementId: string): Promise<AmexCharge[]> {
    return await db.select().from(amexCharges)
      .where(and(
        eq(amexCharges.statementId, statementId),
        eq(amexCharges.isMatched, false)
      ))
      .orderBy(desc(amexCharges.date));
  }

  // Expense Template methods
  async createExpenseTemplate(template: InsertExpenseTemplate): Promise<ExpenseTemplate> {
    const [newTemplate] = await db.insert(expenseTemplates).values(template).returning();
    return newTemplate;
  }

  async getExpenseTemplate(id: string): Promise<ExpenseTemplate | undefined> {
    const [template] = await db.select().from(expenseTemplates).where(eq(expenseTemplates.id, id));
    return template || undefined;
  }

  async getTemplatesByStatement(statementId: string): Promise<ExpenseTemplate[]> {
    return await db.select().from(expenseTemplates)
      .where(eq(expenseTemplates.statementId, statementId))
      .orderBy(desc(expenseTemplates.generatedAt));
  }

  // Dashboard stats
  async getProcessingStats(): Promise<{
    processedCount: number;
    pendingCount: number;
    readyCount: number;
    processingCount: number;
  }> {
    const [processedResult] = await db.select({ count: count() })
      .from(receipts)
      .where(eq(receipts.processingStatus, "completed"));

    const [pendingResult] = await db.select({ count: count() })
      .from(receipts)
      .where(eq(receipts.processingStatus, "pending"));

    const [processingResult] = await db.select({ count: count() })
      .from(receipts)
      .where(eq(receipts.processingStatus, "processing"));

    const [readyResult] = await db.select({ count: count() })
      .from(receipts)
      .where(and(
        eq(receipts.processingStatus, "completed"),
        eq(receipts.isMatched, false)
      ));

    return {
      processedCount: processedResult.count,
      pendingCount: pendingResult.count,
      readyCount: readyResult.count,
      processingCount: processingResult.count,
    };
  }

  // File organization
  getOrganizedPath(receipt: Receipt): string {
    if (!receipt.statementId || !receipt.date || !receipt.merchant || !receipt.amount) {
      return `/Inbox_New/${receipt.fileName}`;
    }

    const statement = receipt.statementId;
    const dateStr = receipt.date.toISOString().split('T')[0]; // YYYY-MM-DD
    const merchant = receipt.merchant.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    const amount = receipt.amount.replace('.', '_');
    const ext = receipt.fileName.split('.').pop();
    
    const newFileName = `${dateStr}_${merchant}_$${amount}.${ext}`;
    const folder = receipt.isMatched ? 'matched' : 'unmatched';
    
    return `/objects/${statement}/${folder}/${newFileName}`;
  }

  async updateReceiptPath(receiptId: string, organizedPath: string): Promise<Receipt | undefined> {
    return await this.updateReceipt(receiptId, { organizedPath });
  }
}

export const storage = new DatabaseStorage();