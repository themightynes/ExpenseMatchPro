import { 
  receipts,
  amexStatements,
  amexCharges,
  expenseTemplates,
  users,
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
import { eq, and, isNull, isNotNull, desc, between, count, lte, gte } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // Receipt methods
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
  getReceipt(id: string): Promise<Receipt | undefined>;
  getAllReceipts(): Promise<Receipt[]>;
  updateReceipt(id: string, updates: Partial<Receipt>): Promise<Receipt | undefined>;
  deleteReceipt(id: string): Promise<boolean>;
  getReceiptsByStatus(status: string): Promise<Receipt[]>;
  getReceiptsByStatement(statementId: string): Promise<Receipt[]>;
  getUnmatchedReceiptsInPeriod(startDate: Date, endDate: Date): Promise<Receipt[]>;
  autoAssignReceiptToStatement(receiptId: string): Promise<Receipt | undefined>;

  // AMEX Statement methods
  createAmexStatement(statement: InsertAmexStatement): Promise<AmexStatement>;
  getAmexStatement(id: string): Promise<AmexStatement | undefined>;
  getAllAmexStatements(): Promise<AmexStatement[]>;
  updateAmexStatement(id: string, updates: Partial<AmexStatement>): Promise<AmexStatement | undefined>;
  deleteAmexStatement(id: string): Promise<boolean>;
  deleteChargesByStatement(statementId: string): Promise<boolean>;
  deleteStatement(statementId: string): Promise<boolean>;
  deleteAmexChargesByStatement(statementId: string): Promise<boolean>;
  getActiveStatement(): Promise<AmexStatement | undefined>;

  // AMEX Charge methods
  createAmexCharge(charge: InsertAmexCharge): Promise<AmexCharge>;
  getAmexCharge(id: string): Promise<AmexCharge | undefined>;
  getAllCharges(): Promise<AmexCharge[]>;
  getChargesByStatement(statementId: string): Promise<AmexCharge[]>;
  updateAmexCharge(id: string, updates: Partial<AmexCharge>): Promise<AmexCharge | undefined>;
  getUnmatchedCharges(statementId: string): Promise<AmexCharge[]>;
  toggleChargePersonalExpense(chargeId: string): Promise<AmexCharge | undefined>;
  toggleChargeNoReceiptRequired(chargeId: string): Promise<AmexCharge | undefined>;
  createNonAmexChargeFromReceipt(receiptId: string, statementId: string): Promise<AmexCharge | undefined>;

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

  // Oracle export
  getOracleExportData(statementId: string): Promise<{
    statement: AmexStatement;
    charges: (AmexCharge & { receipt?: Receipt })[];
  } | null>;
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
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
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
    // Handle date conversion and empty string cleanup
    const processedUpdates: any = { ...updates };

    // Convert date field - handle empty strings and null values
    if ('date' in processedUpdates) {
      if (typeof processedUpdates.date === 'string') {
        if (processedUpdates.date.trim() === '') {
          processedUpdates.date = null;
        } else {
          processedUpdates.date = new Date(processedUpdates.date);
        }
      }
    }

    // Convert amount field - handle empty strings
    if ('amount' in processedUpdates && typeof processedUpdates.amount === 'string') {
      if (processedUpdates.amount.trim() === '') {
        processedUpdates.amount = null;
      }
    }

    // Convert merchant field - handle empty strings
    if ('merchant' in processedUpdates && typeof processedUpdates.merchant === 'string') {
      if (processedUpdates.merchant.trim() === '') {
        processedUpdates.merchant = null;
      }
    }

    // Convert category field - handle empty strings
    if ('category' in processedUpdates && typeof processedUpdates.category === 'string') {
      if (processedUpdates.category.trim() === '') {
        processedUpdates.category = null;
      }
    }

    // Don't manually set updatedAt as it should be handled by database default
    const [updated] = await db.update(receipts)
      .set(processedUpdates)
      .where(eq(receipts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteReceipt(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(receipts)
        .where(eq(receipts.id, id));

      // Check if the deletion was successful
      // Drizzle returns an array for delete operations, check the length
      return Array.isArray(result) ? result.length > 0 : (result as any).rowCount > 0;
    } catch (error) {
      console.error("Error in deleteReceipt:", error);
      return false;
    }
  }

  async getReceiptsByStatus(status: string): Promise<Receipt[]> {
    return await db.select().from(receipts)
      .where(eq(receipts.processingStatus, status))
      .orderBy(desc(receipts.createdAt));
  }

  async getMatchedReceipts(): Promise<Receipt[]> {
    return await db.select().from(receipts)
      .where(eq(receipts.isMatched, true))
      .orderBy(desc(receipts.createdAt));
  }

  async getReceiptsByStatement(statementId: string): Promise<Receipt[]> {
    // Get statement date range
    const [statement] = await db.select().from(amexStatements).where(eq(amexStatements.id, statementId));
    if (!statement) {
      return [];
    }

    // Find receipts that fall within the statement period (both assigned and date-matched)
    const result = await db.select().from(receipts).where(
      and(
        gte(receipts.date, statement.startDate),
        lte(receipts.date, statement.endDate)
      )
    ).orderBy(desc(receipts.createdAt));

    return result;
  }

  async getUnmatchedReceiptsInPeriod(startDate: Date, endDate: Date): Promise<Receipt[]> {
    // Find unmatched receipts that fall within the specified date range
    const result = await db.select().from(receipts).where(
      and(
        eq(receipts.isMatched, false),
        gte(receipts.date, startDate),
        lte(receipts.date, endDate),
        isNotNull(receipts.date) // Only include receipts with actual dates
      )
    ).orderBy(desc(receipts.date));

    return result;
  }

  async autoAssignReceiptToStatement(receiptId: string): Promise<Receipt | undefined> {
    const receipt = await this.getReceipt(receiptId);
    if (!receipt || !receipt.date) return receipt;

    // Find statement that contains this date (receipt date should be between start and end)
    const allStatements = await db.select().from(amexStatements);
    console.log(`All statements:`, allStatements.map(s => ({ 
      id: s.id, 
      name: s.periodName, 
      start: s.startDate, 
      end: s.endDate 
    })));

    const statements = allStatements.filter(s => 
      receipt.date && s.startDate <= receipt.date && receipt.date <= s.endDate
    );

    if (statements.length > 0) {
      console.log(`Found matching statement for receipt date ${receipt.date}: ${statements[0].periodName}`);
      return await this.updateReceipt(receiptId, { 
        statementId: statements[0].id 
      });
    } else {
      console.log(`No matching statement found for receipt date ${receipt.date}`);
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

  async deleteAmexStatement(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(amexStatements)
        .where(eq(amexStatements.id, id));
      
      return Array.isArray(result) ? result.length > 0 : (result as any).rowCount > 0;
    } catch (error) {
      console.error("Error in deleteAmexStatement:", error);
      return false;
    }
  }

  async deleteChargesByStatement(statementId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(amexCharges)
        .where(eq(amexCharges.statementId, statementId));
        
      return Array.isArray(result) ? result.length > 0 : (result as any).rowCount > 0;
    } catch (error) {
      console.error("Error in deleteChargesByStatement:", error);
      return false;
    }
  }

  async deleteStatement(statementId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(amexStatements)
        .where(eq(amexStatements.id, statementId));
      
      return Array.isArray(result) ? result.length > 0 : (result as any).rowCount > 0;
    } catch (error) {
      console.error("Error in deleteStatement:", error);
      return false;
    }
  }

  async deleteAmexChargesByStatement(statementId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(amexCharges)
        .where(eq(amexCharges.statementId, statementId));
        
      return Array.isArray(result) ? result.length > 0 : (result as any).rowCount > 0;
    } catch (error) {
      console.error("Error in deleteAmexChargesByStatement:", error);
      return false;
    }
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

  async getAllCharges(): Promise<AmexCharge[]> {
    return await db.select().from(amexCharges)
      .orderBy(desc(amexCharges.date));
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

  async toggleChargePersonalExpense(chargeId: string): Promise<AmexCharge | undefined> {
    try {
      // First get the current charge
      const charge = await this.getAmexCharge(chargeId);
      if (!charge) return undefined;

      // Toggle the personal expense flag
      const newPersonalStatus = !charge.isPersonalExpense;
      
      return await this.updateAmexCharge(chargeId, {
        isPersonalExpense: newPersonalStatus
      });
    } catch (error) {
      console.error("Error in toggleChargePersonalExpense:", error);
      return undefined;
    }
  }

  async toggleChargeNoReceiptRequired(chargeId: string): Promise<AmexCharge | undefined> {
    try {
      // First get the current charge
      const charge = await this.getAmexCharge(chargeId);
      if (!charge) return undefined;

      // Toggle the no receipt required flag
      const newNoReceiptStatus = !charge.noReceiptRequired;
      
      return await this.updateAmexCharge(chargeId, {
        noReceiptRequired: newNoReceiptStatus
      });
    } catch (error) {
      console.error("Error in toggleChargeNoReceiptRequired:", error);
      return undefined;
    }
  }

  async getUnmatchedCharges(statementId: string): Promise<AmexCharge[]> {
    return await db.select().from(amexCharges)
      .where(and(
        eq(amexCharges.statementId, statementId),
        eq(amexCharges.isMatched, false)
      ))
      .orderBy(desc(amexCharges.date));
  }

  async deleteAmexCharge(chargeId: string): Promise<boolean> {
    try {
      // First unlink any receipt that was matched to this charge
      await db.update(receipts)
        .set({ isMatched: false, matchedChargeId: null })
        .where(eq(receipts.matchedChargeId, chargeId));

      // Delete the charge
      const result = await db.delete(amexCharges)
        .where(eq(amexCharges.id, chargeId));
      
      return Array.isArray(result) ? result.length > 0 : (result as any).rowCount > 0;
    } catch (error) {
      console.error("Error in deleteAmexCharge:", error);
      return false;
    }
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

    // Count receipts ready for matching (have amount and not matched)
    const allReceipts = await db.select().from(receipts);
    const readyCount = allReceipts.filter(r => 
      r.processingStatus === 'completed' && 
      r.amount && 
      parseFloat(r.amount) > 0 &&
      !r.isMatched
    ).length;

    return {
      processedCount: processedResult.count,
      pendingCount: pendingResult.count,
      readyCount: readyCount,
      processingCount: processingResult.count,
    };
  }

  async getFinancialStats(): Promise<{
    totalStatementAmount: number;
    totalMatchedAmount: number;
    totalUnmatchedReceiptAmount: number;
    totalMissingReceiptAmount: number;
    noReceiptRequiredAmount: number;
    personalExpensesAmount: number;
    matchedCount: number;
    unmatchedReceiptCount: number;
    missingReceiptCount: number;
    noReceiptRequiredCount: number;
    totalCharges: number;
    personalExpensesCount: number;
    matchingPercentage: number;
  }> {
    // Get all charges and receipts
    const allCharges = await db.select().from(amexCharges);
    const allReceipts = await db.select().from(receipts);

    // Separate work and personal expenses
    const workCharges = allCharges.filter(charge => !charge.isPersonalExpense);
    const personalCharges = allCharges.filter(charge => charge.isPersonalExpense);

    // Calculate total statement amount (work charges only)
    const totalStatementAmount = workCharges.reduce((sum, charge) => 
      sum + parseFloat(charge.amount || '0'), 0);

    // Calculate personal expenses amount
    const personalExpensesAmount = personalCharges.reduce((sum, charge) => 
      sum + parseFloat(charge.amount || '0'), 0);

    // Calculate matched amounts
    const matchedReceipts = allReceipts.filter(r => r.isMatched && r.amount);
    const totalMatchedAmount = matchedReceipts.reduce((sum, receipt) => 
      sum + parseFloat(receipt.amount || '0'), 0);

    // Calculate unmatched receipt amount (receipts that exist but aren't matched)
    const unmatchedReceipts = allReceipts.filter(r => 
      !r.isMatched && 
      r.amount && 
      parseFloat(r.amount) > 0 &&
      r.processingStatus === 'completed'
    );
    const totalUnmatchedReceiptAmount = unmatchedReceipts.reduce((sum, receipt) => 
      sum + parseFloat(receipt.amount || '0'), 0);

    // Calculate missing receipt amount (work charges without matching receipts AND not marked as no receipt required)
    const matchedChargeIds = matchedReceipts
      .map(r => r.matchedChargeId)
      .filter(id => id !== null);

    const missingReceiptCharges = workCharges.filter(charge => 
      !matchedChargeIds.includes(charge.id) && !charge.noReceiptRequired);

    const totalMissingReceiptAmount = missingReceiptCharges.reduce((sum, charge) => 
      sum + parseFloat(charge.amount || '0'), 0);

    // Calculate charges that don't need receipts (for completion percentage)
    const noReceiptRequiredCharges = workCharges.filter(charge => charge.noReceiptRequired);
    const noReceiptRequiredAmount = noReceiptRequiredCharges.reduce((sum, charge) => 
      sum + parseFloat(charge.amount || '0'), 0);

    // Calculate matching percentage (matched + no receipt required vs total work charges)
    const completedAmount = totalMatchedAmount + noReceiptRequiredAmount;
    const matchingPercentage = totalStatementAmount > 0 
      ? (completedAmount / totalStatementAmount) * 100 
      : 0;

    return {
      totalStatementAmount,
      totalMatchedAmount,
      totalUnmatchedReceiptAmount,
      totalMissingReceiptAmount,
      noReceiptRequiredAmount,
      personalExpensesAmount,
      matchedCount: matchedReceipts.length,
      unmatchedReceiptCount: unmatchedReceipts.length,
      missingReceiptCount: missingReceiptCharges.length,
      noReceiptRequiredCount: noReceiptRequiredCharges.length,
      totalCharges: workCharges.length,
      personalExpensesCount: personalCharges.length,
      matchingPercentage,
    };
  }

  // File organization
  getOrganizedPath(receipt: Receipt): string {
    // For unassigned receipts, keep in inbox
    if (!receipt.statementId) {
      return `/objects/Inbox_New/${receipt.fileName}`;
    }

    // Use available data with intelligent fallbacks
    const dateStr = receipt.date ? receipt.date.toISOString().split('T')[0] : 'UNKNOWN_DATE';

    let merchant = 'UNKNOWN_MERCHANT';
    if (receipt.merchant) {
      merchant = receipt.merchant
        .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .toUpperCase()
        .substring(0, 25); // Limit length for Oracle compatibility
    }

    const amount = receipt.amount ? receipt.amount.replace(/\./g, 'DOT') : 'UNKNOWN_AMOUNT';
    const ext = receipt.fileName.split('.').pop();

    // Oracle-friendly format: DATE_MERCHANT_$AMOUNT_RECEIPT.ext
    const newFileName = `${dateStr}_${merchant}_$${amount}_RECEIPT.${ext}`;

    // Determine folder based on matching status
    const folder = receipt.isMatched ? 'Matched' : 'Unmatched';

    return `/objects/statements/${receipt.statementId}/${folder}/${newFileName}`;
  }

  async updateReceiptPath(receiptId: string, organizedPath: string): Promise<Receipt | undefined> {
    return await this.updateReceipt(receiptId, { organizedPath });
  }

  // Oracle export
  async getOracleExportData(statementId: string): Promise<{
    statement: AmexStatement;
    charges: (AmexCharge & { receipt?: Receipt })[];
  } | null> {
    try {
      // Get the statement
      const statement = await this.getAmexStatement(statementId);
      if (!statement) return null;

      // Get all charges for this statement
      const statementCharges = await this.getChargesByStatement(statementId);
      
      // Get all receipts for this statement
      const statementReceipts = await this.getReceiptsByStatement(statementId);
      
      // Create a map of charge ID to receipt for quick lookup
      const receiptMap = new Map<string, Receipt>();
      statementReceipts.forEach(receipt => {
        if (receipt.matchedChargeId) {
          receiptMap.set(receipt.matchedChargeId, receipt);
        }
      });

      // Combine charges with their matched receipts
      const chargesWithReceipts = statementCharges.map(charge => ({
        ...charge,
        receipt: receiptMap.get(charge.id)
      }));

      return {
        statement,
        charges: chargesWithReceipts
      };
    } catch (error) {
      console.error("Error in getOracleExportData:", error);
      return null;
    }
  }

  async createNonAmexChargeFromReceipt(receiptId: string, statementId: string): Promise<AmexCharge | undefined> {
    try {
      // Get the receipt
      const receipt = await this.getReceipt(receiptId);
      if (!receipt) {
        console.error("Receipt not found:", receiptId);
        return undefined;
      }

      // Check if receipt is already matched
      if (receipt.isMatched) {
        console.error("Receipt is already matched:", receiptId);
        return undefined;
      }

      // Validate receipt has required data
      if (!receipt.date || !receipt.amount || !receipt.merchant) {
        console.error("Receipt missing required data for charge creation:", receiptId);
        return undefined;
      }

      // Create charge from receipt data
      const chargeData = {
        statementId: statementId,
        date: receipt.date,
        description: receipt.merchant,
        cardMember: "Non-AMEX", // Default since it's not from AMEX
        accountNumber: "NON-AMEX", // Default identifier
        amount: receipt.amount,
        extendedDetails: receipt.notes || "",
        statementAs: receipt.merchant,
        address: receipt.fromAddress || "",
        cityState: "",
        zipCode: "",
        country: "",
        reference: `NON-AMEX-${receiptId.slice(0, 8)}`,
        category: receipt.category || "General",
        isMatched: true, // Automatically matched to the receipt
        receiptId: receiptId,
        isPersonalExpense: false, // Default to business expense
        noReceiptRequired: false, // Has receipt attached
        isNonAmex: true, // Mark as non-AMEX charge
        userNotes: receipt.notes || ""
      };

      // Create the charge
      const newCharge = await this.createAmexCharge(chargeData);

      // Update receipt to mark as matched
      await this.updateReceipt(receiptId, {
        isMatched: true,
        matchedChargeId: newCharge.id,
        statementId: statementId // Ensure receipt is associated with the statement
      });

      console.log("Created non-AMEX charge from receipt:", {
        chargeId: newCharge.id,
        receiptId: receiptId,
        merchant: receipt.merchant,
        amount: receipt.amount
      });

      return newCharge;
    } catch (error) {
      console.error("Error creating non-AMEX charge from receipt:", error);
      return undefined;
    }
  }
}

export const storage = new DatabaseStorage();