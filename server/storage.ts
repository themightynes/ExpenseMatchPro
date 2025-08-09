import { 
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
import { randomUUID } from "crypto";

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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private receipts: Map<string, Receipt>;
  private amexStatements: Map<string, AmexStatement>;
  private amexCharges: Map<string, AmexCharge>;
  private expenseTemplates: Map<string, ExpenseTemplate>;

  constructor() {
    this.users = new Map();
    this.receipts = new Map();
    this.amexStatements = new Map();
    this.amexCharges = new Map();
    this.expenseTemplates = new Map();
    
    // Initialize with sample statement periods
    this.initializeSampleData();
  }

  private async initializeSampleData() {
    // Create sample statement periods
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Current statement period
    const currentStatement = await this.createAmexStatement({
      periodName: `${currentYear} - ${String(currentMonth + 1).padStart(2, '0')} Statement`,
      startDate: new Date(currentYear, currentMonth, 1),
      endDate: new Date(currentYear, currentMonth + 1, 0),
      isActive: true,
    });

    // Previous statement periods
    for (let i = 1; i <= 3; i++) {
      const month = currentMonth - i;
      const year = month < 0 ? currentYear - 1 : currentYear;
      const adjustedMonth = month < 0 ? month + 12 : month;

      await this.createAmexStatement({
        periodName: `${year} - ${String(adjustedMonth + 1).padStart(2, '0')} Statement`,
        startDate: new Date(year, adjustedMonth, 1),
        endDate: new Date(year, adjustedMonth + 1, 0),
        isActive: false,
      });
    }
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Receipt methods
  async createReceipt(insertReceipt: InsertReceipt): Promise<Receipt> {
    const id = randomUUID();
    const now = new Date();
    const receipt: Receipt = {
      ...insertReceipt,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.receipts.set(id, receipt);
    return receipt;
  }

  async getReceipt(id: string): Promise<Receipt | undefined> {
    return this.receipts.get(id);
  }

  async getAllReceipts(): Promise<Receipt[]> {
    return Array.from(this.receipts.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async updateReceipt(id: string, updates: Partial<Receipt>): Promise<Receipt | undefined> {
    const receipt = this.receipts.get(id);
    if (!receipt) return undefined;

    const updatedReceipt = {
      ...receipt,
      ...updates,
      updatedAt: new Date(),
    };
    this.receipts.set(id, updatedReceipt);
    return updatedReceipt;
  }

  async deleteReceipt(id: string): Promise<boolean> {
    return this.receipts.delete(id);
  }

  async getReceiptsByStatus(status: string): Promise<Receipt[]> {
    return Array.from(this.receipts.values()).filter(
      receipt => receipt.processingStatus === status
    );
  }

  async getReceiptsByStatement(statementId: string): Promise<Receipt[]> {
    return Array.from(this.receipts.values()).filter(
      receipt => receipt.amexStatementId === statementId
    );
  }

  // AMEX Statement methods
  async createAmexStatement(insertStatement: InsertAmexStatement): Promise<AmexStatement> {
    const id = randomUUID();
    const statement: AmexStatement = {
      ...insertStatement,
      id,
      createdAt: new Date(),
    };
    this.amexStatements.set(id, statement);
    return statement;
  }

  async getAmexStatement(id: string): Promise<AmexStatement | undefined> {
    return this.amexStatements.get(id);
  }

  async getAllAmexStatements(): Promise<AmexStatement[]> {
    return Array.from(this.amexStatements.values()).sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
  }

  async updateAmexStatement(id: string, updates: Partial<AmexStatement>): Promise<AmexStatement | undefined> {
    const statement = this.amexStatements.get(id);
    if (!statement) return undefined;

    const updatedStatement = { ...statement, ...updates };
    this.amexStatements.set(id, updatedStatement);
    return updatedStatement;
  }

  async getActiveStatement(): Promise<AmexStatement | undefined> {
    return Array.from(this.amexStatements.values()).find(
      statement => statement.isActive
    );
  }

  // AMEX Charge methods
  async createAmexCharge(insertCharge: InsertAmexCharge): Promise<AmexCharge> {
    const id = randomUUID();
    const charge: AmexCharge = {
      ...insertCharge,
      id,
      createdAt: new Date(),
    };
    this.amexCharges.set(id, charge);
    return charge;
  }

  async getAmexCharge(id: string): Promise<AmexCharge | undefined> {
    return this.amexCharges.get(id);
  }

  async getChargesByStatement(statementId: string): Promise<AmexCharge[]> {
    return Array.from(this.amexCharges.values()).filter(
      charge => charge.statementId === statementId
    );
  }

  async updateAmexCharge(id: string, updates: Partial<AmexCharge>): Promise<AmexCharge | undefined> {
    const charge = this.amexCharges.get(id);
    if (!charge) return undefined;

    const updatedCharge = { ...charge, ...updates };
    this.amexCharges.set(id, updatedCharge);
    return updatedCharge;
  }

  async getUnmatchedCharges(statementId: string): Promise<AmexCharge[]> {
    return Array.from(this.amexCharges.values()).filter(
      charge => charge.statementId === statementId && !charge.isMatched
    );
  }

  // Expense Template methods
  async createExpenseTemplate(insertTemplate: InsertExpenseTemplate): Promise<ExpenseTemplate> {
    const id = randomUUID();
    const template: ExpenseTemplate = {
      ...insertTemplate,
      id,
      generatedAt: new Date(),
    };
    this.expenseTemplates.set(id, template);
    return template;
  }

  async getExpenseTemplate(id: string): Promise<ExpenseTemplate | undefined> {
    return this.expenseTemplates.get(id);
  }

  async getTemplatesByStatement(statementId: string): Promise<ExpenseTemplate[]> {
    return Array.from(this.expenseTemplates.values()).filter(
      template => template.statementId === statementId
    );
  }

  // Dashboard stats
  async getProcessingStats(): Promise<{
    processedCount: number;
    pendingCount: number;
    readyCount: number;
    processingCount: number;
  }> {
    const receipts = Array.from(this.receipts.values());
    
    return {
      processedCount: receipts.filter(r => r.processingStatus === 'completed').length,
      pendingCount: receipts.filter(r => r.processingStatus === 'pending' || !r.isMatched).length,
      readyCount: receipts.filter(r => r.processingStatus === 'completed' && r.isMatched).length,
      processingCount: receipts.filter(r => r.processingStatus === 'processing').length,
    };
  }
}

export const storage = new MemStorage();
