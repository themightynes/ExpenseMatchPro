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

// Helper function to create statement folder structure
async function createStatementFolder(statementId: string | null) {
  if (!statementId) return;
  
  try {
    const statement = await storage.getAmexStatement(statementId);
    if (!statement) return;
    
    // Create folder structure: /statements/{periodName}/unmatched/ and /statements/{periodName}/matched/
    console.log(`Creating folder structure for statement: ${statement.periodName}`);
    // Note: In a full implementation, you would create actual folders in object storage
    // For now, we're using the logical folder structure in receipt paths
  } catch (error) {
    console.error("Error creating statement folder:", error);
  }
}
import { fileOrganizer } from "./fileOrganizer";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // Serve uploaded files
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      console.log("Serving object path:", req.path);
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        console.log("Object not found:", req.path);
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get upload URL for object storage
  app.post("/api/objects/upload", async (req, res) => {
    try {
      console.log("Getting upload URL...");
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      console.log("Generated upload URL:", uploadURL);
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      
      // Check if object storage is properly configured
      try {
        const privateDir = process.env.PRIVATE_OBJECT_DIR;
        console.log("PRIVATE_OBJECT_DIR:", privateDir);
        if (!privateDir) {
          return res.status(500).json({ 
            error: "Object storage not configured. Please set PRIVATE_OBJECT_DIR environment variable." 
          });
        }
      } catch (envError) {
        console.error("Environment check error:", envError);
      }
      
      res.status(500).json({ error: "Failed to get upload URL. Object storage may not be configured." });
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

  // Get comprehensive financial stats
  app.get("/api/dashboard/financial-stats", async (req, res) => {
    try {
      const financialStats = await storage.getFinancialStats();
      res.json(financialStats);
    } catch (error) {
      console.error("Error getting financial stats:", error);
      res.status(500).json({ error: "Failed to get financial stats" });
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
      const receiptId = req.params.id;
      const updates = req.body;
      
      console.log(`Updating receipt with data:`, updates);
      
      const updatedReceipt = await storage.updateReceipt(receiptId, updates);
      if (!updatedReceipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      
      console.log(`Receipt updated successfully:`, updatedReceipt);
      
      // Progressive matching: try to match as soon as we have some useful data
      const hasUsefulData = updatedReceipt.merchant || updatedReceipt.amount || updatedReceipt.date;
      let autoMatchResult = null;
      
      if (hasUsefulData && !updatedReceipt.isMatched) {
        // If receipt doesn't have a statement assigned, try to assign it to the active statement
        if (!updatedReceipt.statementId) {
          const statements = await storage.getAllAmexStatements();
          const activeStatement = statements.find(s => s.isActive);
          if (activeStatement) {
            console.log(`Assigning receipt ${receiptId} to active statement ${activeStatement.periodName}`);
            await storage.updateReceipt(receiptId, { statementId: activeStatement.id });
            updatedReceipt.statementId = activeStatement.id;
          }
        }
        
        if (updatedReceipt.statementId) {
          console.log(`Receipt ${receiptId} has useful data, attempting progressive auto-match...`);
          autoMatchResult = await fileOrganizer.attemptAutoMatch(receiptId);
          
          if (autoMatchResult.matched) {
            console.log(`Successfully auto-matched receipt ${receiptId} with ${autoMatchResult.confidence}% confidence`);
            // Refetch the updated receipt after matching
            const matchedReceipt = await storage.getReceipt(receiptId);
            return res.json({
              ...matchedReceipt,
              autoMatched: true,
              matchConfidence: autoMatchResult.confidence,
              matchReason: autoMatchResult.reason
            });
          }
        }
      }
      
      // Reorganize file after update
      await fileOrganizer.organizeReceipt(updatedReceipt);
      
      res.json({
        ...updatedReceipt,
        autoMatched: false
      });
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
      
      // Create receipt record - set to 'completed' immediately for manual processing
      // OCR is disabled due to performance issues (was taking 30+ mins per receipt)
      const receipt = await storage.createReceipt({
        fileName: req.body.fileName || 'uploaded-receipt',
        originalFileName: req.body.originalFileName || req.body.fileName || 'uploaded-receipt',
        fileUrl: objectPath,
        processingStatus: 'completed', // Changed from 'processing' to skip OCR
        ocrText: 'Manual entry required', // Indicate manual processing needed
      });

      // Set ACL policy for the uploaded receipt
      try {
        await objectStorageService.trySetObjectEntityAclPolicy(req.body.fileUrl, {
          owner: "system", // Or use authenticated user ID when auth is implemented
          visibility: "private",
        });
      } catch (aclError) {
        console.error("Error setting ACL policy:", aclError);
        // Continue even if ACL fails
      }

      // Try to auto-assign to statement and organize
      try {
        const organizedReceipt = await storage.autoAssignReceiptToStatement(receipt.id);
        if (organizedReceipt && organizedReceipt.statementId) {
          // Create organized folder structure when receipt gets assigned
          await createStatementFolder(organizedReceipt.statementId);
          
          // Update receipt with organized path
          const organizedPath = storage.getOrganizedPath(organizedReceipt);
          await storage.updateReceiptPath(receipt.id, organizedPath);
        }
      } catch (orgError) {
        console.error("Error organizing receipt:", orgError);
        // Continue even if organization fails
      }

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
      let minDate: Date | null = null; // Will be set to first valid date
      let maxDate: Date | null = null; // Will be set to first valid date
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

          // Parse MM/DD/YYYY format properly
          const dateParts = validatedRow.Date.split('/');
          if (dateParts.length !== 3) {
            console.error(`Invalid date format: ${validatedRow.Date}`);
            continue;
          }
          
          const month = parseInt(dateParts[0]);
          const day = parseInt(dateParts[1]);
          const year = parseInt(dateParts[2]);
          
          // Validate date components
          if (isNaN(month) || isNaN(day) || isNaN(year) || month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
            console.error(`Invalid date components: ${validatedRow.Date} -> month:${month}, day:${day}, year:${year}`);
            continue;
          }
          
          const chargeDate = new Date(year, month - 1, day);
          
          // Validate that the date was created correctly
          if (isNaN(chargeDate.getTime())) {
            console.error(`Failed to create valid date from: ${validatedRow.Date}`);
            continue;
          }
          
          // Track date range for statement period
          if (!minDate || chargeDate < minDate) minDate = chargeDate;
          if (!maxDate || chargeDate > maxDate) maxDate = chargeDate;

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
          console.error("Row data:", line);
          errors++;
        }
      }

      if (charges.length === 0) {
        return res.status(400).json({ error: "No valid charges found in CSV file" });
      }

      // Validate date range before creating statement
      if (!minDate || !maxDate) {
        console.error("No valid dates found in CSV");
        return res.status(400).json({ error: "No valid dates found in CSV file" });
      }

      if (minDate > maxDate) {
        console.error("Invalid date range:", { minDate, maxDate });
        return res.status(400).json({ error: "Invalid date range detected in CSV" });
      }

      console.log("Creating statement with date range:", { minDate, maxDate, periodName: periodName.trim() });

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

      // Create folder structure for new statement
      await createStatementFolder(statement.id);
      
      // Try to auto-assign unmatched receipts to this new statement
      const unmatchedReceipts = await storage.getReceiptsByStatus('completed');
      for (const receipt of unmatchedReceipts) {
        if (!receipt.statementId && receipt.date) {
          const receiptDate = new Date(receipt.date);
          if (receiptDate >= statement.startDate && receiptDate <= statement.endDate) {
            try {
              await storage.updateReceipt(receipt.id, { statementId: statement.id });
              const organizedPath = storage.getOrganizedPath({ ...receipt, statementId: statement.id });
              await storage.updateReceiptPath(receipt.id, organizedPath);
            } catch (error) {
              console.error(`Error auto-assigning receipt ${receipt.id}:`, error);
            }
          }
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
  // Utility endpoint to reorganize ALL receipts (for fixing existing data)
  app.post("/api/receipts/reorganize-all", async (req, res) => {
    try {
      const allReceipts = await storage.getAllReceipts();
      let reorganized = 0;
      let errors = 0;

      for (const receipt of allReceipts) {
        try {
          await fileOrganizer.organizeReceipt(receipt);
          reorganized++;
        } catch (error) {
          console.error(`Error reorganizing receipt ${receipt.id}:`, error);
          errors++;
        }
      }

      res.json({ 
        message: `Reorganized ${reorganized} receipts`, 
        reorganized, 
        errors,
        total: allReceipts.length 
      });
    } catch (error) {
      console.error("Error reorganizing all receipts:", error);
      res.status(500).json({ error: "Failed to reorganize receipts" });
    }
  });

  // Utility endpoint to reorganize already matched receipts with proper Oracle naming
  app.post("/api/receipts/reorganize-matched", async (req, res) => {
    try {
      const matchedReceipts = await storage.getMatchedReceipts();
      let reorganized = 0;
      let errors = 0;
      let statusMessages: string[] = [];

      for (const receipt of matchedReceipts) {
        try {
          // First ensure the receipt has the correct statementId from its matched charge
          if (receipt.matchedChargeId) {
            const charge = await storage.getAmexCharge(receipt.matchedChargeId);
            if (charge && charge.statementId !== receipt.statementId) {
              // Update receipt's statement ID to match the charge
              await storage.updateReceipt(receipt.id, {
                statementId: charge.statementId
              });
              receipt.statementId = charge.statementId; // Update local copy
              statusMessages.push(`Updated statement ID for ${receipt.fileName}`);
            }
          }
          
          // Only reorganize if receipt has required data for Oracle naming
          if (receipt.date && receipt.merchant && receipt.amount && receipt.statementId) {
            await fileOrganizer.organizeReceipt(receipt);
            reorganized++;
            statusMessages.push(`Reorganized ${receipt.fileName} with Oracle naming`);
          } else {
            statusMessages.push(`Skipped ${receipt.fileName} - missing required data (date: ${!!receipt.date}, merchant: ${!!receipt.merchant}, amount: ${!!receipt.amount}, statementId: ${!!receipt.statementId})`);
          }
          
        } catch (error) {
          console.error(`Error reorganizing receipt ${receipt.id}:`, error);
          errors++;
          statusMessages.push(`Error: ${receipt.fileName} - ${error.message}`);
        }
      }

      res.json({ 
        message: `Reorganized ${reorganized} matched receipts with Oracle naming convention`, 
        reorganized, 
        errors,
        total: matchedReceipts.length,
        details: statusMessages.slice(0, 10) // Show first 10 status messages
      });
    } catch (error) {
      console.error("Error reorganizing matched receipts:", error);
      res.status(500).json({ error: "Failed to reorganize receipts" });
    }
  });

  app.post("/api/matching/match", async (req, res) => {
    try {
      const { receiptId, chargeId } = req.body;
      
      if (!receiptId || !chargeId) {
        return res.status(400).json({ error: "receiptId and chargeId are required" });
      }

      // Get the charge first to determine the statement ID
      const charge = await storage.getAmexCharge(chargeId);
      if (!charge) {
        return res.status(404).json({ error: "Charge not found" });
      }

      // Update receipt as matched AND associate it with the statement
      const receipt = await storage.updateReceipt(receiptId, { 
        isMatched: true,
        matchedChargeId: chargeId,
        statementId: charge.statementId  // This is the key fix!
      });

      // Update charge as matched
      const updatedCharge = await storage.updateAmexCharge(chargeId, { 
        isMatched: true,
        receiptId: receiptId 
      });

      // Move receipt to matched folder when it gets matched
      if (receipt && receipt.statementId) {
        try {
          const organizedPath = storage.getOrganizedPath(receipt);
          await storage.updateReceiptPath(receiptId, organizedPath);
          
          // Create statement folder if it doesn't exist
          await createStatementFolder(receipt.statementId);
        } catch (orgError) {
          console.error("Error organizing matched receipt:", orgError);
        }
      }

      if (!receipt || !updatedCharge) {
        return res.status(404).json({ error: "Receipt or charge not found" });
      }

      // Reorganize file after matching (receipt now has correct statementId)
      if (receipt) {
        await fileOrganizer.organizeReceipt(receipt);
      }

      res.json({ receipt, charge: updatedCharge });
    } catch (error) {
      console.error("Error matching receipt to charge:", error);
      res.status(500).json({ error: "Failed to match receipt to charge" });
    }
  });

  // Get matching candidates with intelligent pairing
  app.get("/api/matching/candidates/:statementId", async (req, res) => {
    try {
      const statementId = req.params.statementId;
      
      // Get ALL unmatched receipts (not restricted to statement) - let users match across all periods
      const allReceipts = await storage.getAllReceipts();
      const unmatchedReceipts = allReceipts.filter(r => 
        !r.isMatched && 
        r.processingStatus === 'completed' &&
        r.amount && // Only include receipts with amount data
        parseFloat(r.amount) > 0 // Exclude zero or negative amounts
      );
      
      // Get ALL unmatched charges across ALL statements - not just the current one
      const allCharges = await storage.getAllCharges();
      const unmatchedCharges = allCharges.filter(c => !c.isMatched);

      // Create intelligent receipt-charge pairs
      const pairs = [];
      for (const receipt of unmatchedReceipts) {
        const bestMatches = unmatchedCharges
          .map(charge => {
            const amountDiff = Math.abs(parseFloat(receipt.amount) - parseFloat(charge.amount));
            const dateDiff = receipt.date && charge.date ? 
              Math.abs(new Date(receipt.date).getTime() - new Date(charge.date).getTime()) / (1000 * 60 * 60 * 24) : 999;
            
            // Merchant similarity (simple contains check for now)
            const merchantMatch = receipt.merchant && charge.description ?
              (charge.description.toLowerCase().includes(receipt.merchant.toLowerCase()) ||
               receipt.merchant.toLowerCase().includes(charge.description.toLowerCase())) : false;
            
            // Calculate confidence score (lower is better)
            let confidence = amountDiff * 10; // Amount difference weighted heavily
            confidence += dateDiff * 2; // Date difference weighted moderately
            confidence -= merchantMatch ? 50 : 0; // Merchant match is a big bonus
            
            return {
              receipt,
              charge,
              confidence,
              amountDiff,
              dateDiff,
              merchantMatch
            };
          })
          .sort((a, b) => a.confidence - b.confidence); // Sort by best match first
        
        if (bestMatches.length > 0) {
          pairs.push(bestMatches[0]); // Take the best match for this receipt
        }
      }

      // Sort pairs by confidence (best matches first)
      const sortedPairs = pairs.sort((a, b) => a.confidence - b.confidence);

      console.log("Intelligent matching candidates:", { 
        statementId, 
        totalReceipts: allReceipts.length,
        unmatchedReceipts: unmatchedReceipts.length, 
        unmatchedChargesAllStatements: unmatchedCharges.length,
        pairsGenerated: sortedPairs.length,
        bestMatch: sortedPairs.length > 0 ? {
          receiptAmount: sortedPairs[0].receipt.amount,
          chargeAmount: sortedPairs[0].charge.amount,
          amountDiff: sortedPairs[0].amountDiff,
          dateDiff: Math.round(sortedPairs[0].dateDiff),
          merchantMatch: sortedPairs[0].merchantMatch,
          confidence: Math.round(sortedPairs[0].confidence)
        } : null
      });

      res.json({
        pairs: sortedPairs,
        receipts: unmatchedReceipts,
        charges: unmatchedCharges,
      });
    } catch (error) {
      console.error("Error getting matching candidates:", error);
      res.status(500).json({ error: "Failed to get matching candidates" });
    }
  });

  // Toggle personal expense flag for a charge
  app.put("/api/charges/:id/toggle-personal", async (req, res) => {
    try {
      const chargeId = req.params.id;
      const updatedCharge = await storage.toggleChargePersonalExpense(chargeId);
      
      if (!updatedCharge) {
        return res.status(404).json({ error: "Charge not found" });
      }

      res.json({ 
        charge: updatedCharge, 
        message: updatedCharge.isPersonalExpense 
          ? "Charge marked as personal expense" 
          : "Charge marked as work expense" 
      });
    } catch (error) {
      console.error("Error toggling personal expense:", error);
      res.status(500).json({ error: "Failed to toggle personal expense status" });
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
