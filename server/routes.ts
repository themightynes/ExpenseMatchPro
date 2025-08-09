import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertReceiptSchema, 
  insertAmexStatementSchema, 
  insertAmexChargeSchema,
  insertExpenseTemplateSchema,
  amexCsvRowSchema,
  EXPENSE_CATEGORIES 
} from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { fileOrganizer } from "./fileOrganizer";
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

  app.patch("/api/receipts/:id", async (req, res) => {
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

  // AMEX CSV Import endpoint - Creates new statement period automatically
  app.post("/api/charges/import-csv", upload.single('csvFile'), async (req: Request & { file?: Express.Multer.File }, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No CSV file uploaded" });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const lines = csvContent.split('\n');
      const headers = lines[0].split(',').map((h: string) => h.trim().replace(/"/g, ''));
      
      const { periodName } = req.body;
      if (!periodName) {
        return res.status(400).json({ error: "Period name is required" });
      }

      // First pass: analyze CSV data to determine date range
      const charges = [];
      let minDate = new Date();
      let maxDate = new Date(0);
      let imported = 0;
      let errors = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
          // Parse CSV line (handle quoted values)
          const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
          const cleanValues = values.map((v: string) => v.replace(/^"|"$/g, '').trim());
          
          const rowData: any = {};
          headers.forEach((header: string, index: number) => {
            rowData[header] = cleanValues[index] || '';
          });

          // Validate with schema
          const validatedRow = amexCsvRowSchema.parse(rowData);

          // Skip payments and credits (negative amounts or "AUTOPAY")
          if (validatedRow.Description.includes('AUTOPAY') || validatedRow.Description.includes('PAYMENT')) {
            continue;
          }

          const chargeDate = new Date(validatedRow.Date);
          
          // Track date range for statement period
          if (chargeDate < minDate) minDate = chargeDate;
          if (chargeDate > maxDate) maxDate = chargeDate;

          // Store charge data for later insertion
          charges.push({
            date: chargeDate,
            description: validatedRow.Description,
            cardMember: validatedRow["Card Member"],
            accountNumber: validatedRow["Account #"],
            amount: validatedRow.Amount,
            extendedDetails: validatedRow["Extended Details"],
            statementAs: validatedRow["Appears On Your Statement As"],
            address: validatedRow.Address,
            cityState: validatedRow["City/State"],
            zipCode: validatedRow["Zip Code"],
            country: validatedRow.Country,
            reference: validatedRow.Reference,
            category: validatedRow.Category,
            isMatched: false,
            receiptId: null,
          });

        } catch (error) {
          console.error(`Error processing row ${i}:`, error);
          errors++;
        }
      }

      if (charges.length === 0) {
        return res.status(400).json({ error: "No valid charges found in CSV file" });
      }

      // Create new statement period with detected date range
      const statement = await storage.createAmexStatement({
        periodName: periodName.trim(),
        startDate: minDate,
        endDate: maxDate,
        isActive: false, // Let user activate if needed
      });

      // Insert all charges with the new statement ID
      for (const chargeData of charges) {
        try {
          await storage.createAmexCharge({
            ...chargeData,
            statementId: statement.id,
          });
          imported++;
        } catch (error) {
          console.error("Error creating charge:", error);
          errors++;
        }
      }

      res.json({ 
        message: `Import completed. ${imported} charges imported, ${errors} errors.`,
        imported,
        errors,
        statementName: statement.periodName,
        statementId: statement.id
      });
    } catch (error) {
      console.error("Error importing CSV:", error);
      res.status(500).json({ error: "Failed to import CSV" });
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

      // Reorganize file after matching
      if (receipt) {
        await fileOrganizer.organizeReceipt(receipt);
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

  // Auto-assignment and intelligent matching
  app.post("/api/receipts/:id/auto-assign", async (req, res) => {
    try {
      const receipt = await fileOrganizer.autoAssignToStatement(req.params.id);
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      res.json(receipt);
    } catch (error) {
      console.error("Error auto-assigning receipt:", error);
      res.status(500).json({ error: "Failed to auto-assign receipt" });
    }
  });

  app.get("/api/receipts/:id/suggestions", async (req, res) => {
    try {
      const suggestions = await fileOrganizer.suggestMatching(req.params.id);
      res.json(suggestions);
    } catch (error) {
      console.error("Error getting matching suggestions:", error);
      res.status(500).json({ error: "Failed to get matching suggestions" });
    }
  });

  // Get charges for a specific statement
  app.get("/api/statements/:id/charges", async (req, res) => {
    try {
      const charges = await storage.getChargesByStatement(req.params.id);
      res.json(charges);
    } catch (error) {
      console.error("Error getting statement charges:", error);
      res.status(500).json({ error: "Failed to get statement charges" });
    }
  });

  // Get receipts for a specific statement
  app.get("/api/statements/:id/receipts", async (req, res) => {
    try {
      const receipts = await storage.getReceiptsByStatement(req.params.id);
      res.json(receipts);
    } catch (error) {
      console.error("Error getting statement receipts:", error);
      res.status(500).json({ error: "Failed to get statement receipts" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
