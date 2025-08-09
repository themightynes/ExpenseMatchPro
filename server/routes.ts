import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertReceiptSchema, 
  insertAmexStatementSchema, 
  insertAmexChargeSchema,
  insertExpenseTemplateSchema,
  EXPENSE_CATEGORIES 
} from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // Serve uploaded files
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Get upload URL for object storage
  app.post("/api/objects/upload", async (req, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getProcessingStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting stats:", error);
      res.status(500).json({ error: "Failed to get dashboard stats" });
    }
  });

  // Receipt endpoints
  app.post("/api/receipts", async (req, res) => {
    try {
      const validatedData = insertReceiptSchema.parse(req.body);
      const receipt = await storage.createReceipt(validatedData);
      res.status(201).json(receipt);
    } catch (error) {
      console.error("Error creating receipt:", error);
      res.status(400).json({ error: "Invalid receipt data" });
    }
  });

  app.get("/api/receipts", async (req, res) => {
    try {
      const receipts = await storage.getAllReceipts();
      res.json(receipts);
    } catch (error) {
      console.error("Error getting receipts:", error);
      res.status(500).json({ error: "Failed to get receipts" });
    }
  });

  app.get("/api/receipts/:id", async (req, res) => {
    try {
      const receipt = await storage.getReceipt(req.params.id);
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      res.json(receipt);
    } catch (error) {
      console.error("Error getting receipt:", error);
      res.status(500).json({ error: "Failed to get receipt" });
    }
  });

  app.put("/api/receipts/:id", async (req, res) => {
    try {
      const receipt = await storage.updateReceipt(req.params.id, req.body);
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      res.json(receipt);
    } catch (error) {
      console.error("Error updating receipt:", error);
      res.status(500).json({ error: "Failed to update receipt" });
    }
  });

  // Process uploaded receipt file
  app.post("/api/receipts/process", async (req, res) => {
    try {
      if (!req.body.fileUrl) {
        return res.status(400).json({ error: "fileUrl is required" });
      }

      const objectPath = objectStorageService.normalizeObjectEntityPath(req.body.fileUrl);
      
      // Create receipt record
      const receipt = await storage.createReceipt({
        fileName: req.body.fileName || 'uploaded-receipt',
        originalFileName: req.body.originalFileName || req.body.fileName || 'uploaded-receipt',
        fileUrl: objectPath,
        processingStatus: 'processing',
      });

      res.status(201).json(receipt);
    } catch (error) {
      console.error("Error processing receipt:", error);
      res.status(500).json({ error: "Failed to process receipt" });
    }
  });

  // AMEX Statement endpoints
  app.get("/api/statements", async (req, res) => {
    try {
      const statements = await storage.getAllAmexStatements();
      
      // Add receipt counts for each statement
      const statementsWithCounts = await Promise.all(
        statements.map(async (statement) => {
          const receipts = await storage.getReceiptsByStatement(statement.id);
          const charges = await storage.getChargesByStatement(statement.id);
          return {
            ...statement,
            receiptCount: receipts.length,
            matchedCount: receipts.filter(r => r.isMatched).length,
            chargeCount: charges.length,
          };
        })
      );

      res.json(statementsWithCounts);
    } catch (error) {
      console.error("Error getting statements:", error);
      res.status(500).json({ error: "Failed to get statements" });
    }
  });

  app.post("/api/statements", async (req, res) => {
    try {
      const validatedData = insertAmexStatementSchema.parse(req.body);
      const statement = await storage.createAmexStatement(validatedData);
      res.status(201).json(statement);
    } catch (error) {
      console.error("Error creating statement:", error);
      res.status(400).json({ error: "Invalid statement data" });
    }
  });

  app.get("/api/statements/active", async (req, res) => {
    try {
      const activeStatement = await storage.getActiveStatement();
      if (!activeStatement) {
        return res.status(404).json({ error: "No active statement found" });
      }
      res.json(activeStatement);
    } catch (error) {
      console.error("Error getting active statement:", error);
      res.status(500).json({ error: "Failed to get active statement" });
    }
  });

  // AMEX Charge endpoints
  app.post("/api/charges", async (req, res) => {
    try {
      const validatedData = insertAmexChargeSchema.parse(req.body);
      const charge = await storage.createAmexCharge(validatedData);
      res.status(201).json(charge);
    } catch (error) {
      console.error("Error creating charge:", error);
      res.status(400).json({ error: "Invalid charge data" });
    }
  });

  app.get("/api/charges/unmatched/:statementId", async (req, res) => {
    try {
      const charges = await storage.getUnmatchedCharges(req.params.statementId);
      res.json(charges);
    } catch (error) {
      console.error("Error getting unmatched charges:", error);
      res.status(500).json({ error: "Failed to get unmatched charges" });
    }
  });

  // Matching endpoints
  app.post("/api/matching/match", async (req, res) => {
    try {
      const { receiptId, chargeId } = req.body;
      
      if (!receiptId || !chargeId) {
        return res.status(400).json({ error: "receiptId and chargeId are required" });
      }

      // Update receipt as matched
      const receipt = await storage.updateReceipt(receiptId, { 
        isMatched: true 
      });

      // Update charge as matched
      const charge = await storage.updateAmexCharge(chargeId, { 
        isMatched: true,
        receiptId: receiptId 
      });

      if (!receipt || !charge) {
        return res.status(404).json({ error: "Receipt or charge not found" });
      }

      res.json({ receipt, charge });
    } catch (error) {
      console.error("Error matching receipt to charge:", error);
      res.status(500).json({ error: "Failed to match receipt to charge" });
    }
  });

  // Get matching candidates
  app.get("/api/matching/candidates/:statementId", async (req, res) => {
    try {
      const statementId = req.params.statementId;
      
      // Get unmatched receipts for the statement
      const receipts = await storage.getReceiptsByStatement(statementId);
      const unmatchedReceipts = receipts.filter(r => !r.isMatched && r.processingStatus === 'completed');
      
      // Get unmatched charges for the statement
      const unmatchedCharges = await storage.getUnmatchedCharges(statementId);

      res.json({
        receipts: unmatchedReceipts,
        charges: unmatchedCharges,
      });
    } catch (error) {
      console.error("Error getting matching candidates:", error);
      res.status(500).json({ error: "Failed to get matching candidates" });
    }
  });

  // Export endpoints
  app.post("/api/export/oracle", async (req, res) => {
    try {
      const { statementId, includeAttachments = true, preFillCategories = true, groupByType = false } = req.body;
      
      if (!statementId) {
        return res.status(400).json({ error: "statementId is required" });
      }

      const receipts = await storage.getReceiptsByStatement(statementId);
      const matchedReceipts = receipts.filter(r => r.isMatched);

      // Generate Oracle iExpense template data
      const templateData = {
        receipts: matchedReceipts.map(receipt => ({
          id: receipt.id,
          merchant: receipt.merchant,
          amount: receipt.amount,
          date: receipt.date,
          category: receipt.category,
          fileUrl: includeAttachments ? receipt.fileUrl : null,
          extractedData: receipt.extractedData,
        })),
        options: {
          includeAttachments,
          preFillCategories,
          groupByType,
        },
        generatedAt: new Date().toISOString(),
      };

      // Save template
      const template = await storage.createExpenseTemplate({
        statementId,
        templateData,
      });

      res.json(template);
    } catch (error) {
      console.error("Error generating Oracle export:", error);
      res.status(500).json({ error: "Failed to generate Oracle export" });
    }
  });

  // Get expense categories
  app.get("/api/categories", async (req, res) => {
    try {
      res.json(EXPENSE_CATEGORIES);
    } catch (error) {
      console.error("Error getting categories:", error);
      res.status(500).json({ error: "Failed to get categories" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
