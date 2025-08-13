import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { setupGoogleAuth, requireAuth } from "./googleAuth";
import { 
  insertReceiptSchema, 
  insertAmexStatementSchema, 
  insertAmexChargeSchema,
  insertExpenseTemplateSchema,
  amexCsvRowSchema,
  EXPENSE_CATEGORIES 
} from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient, parseObjectPath } from "./objectStorage";
import { ocrService } from "./ocrService";
import { EmailService } from "./emailService";
import archiver from 'archiver';

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
import { fixReceiptsWithBadMerchants } from "./fixReceiptData";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Function to check for duplicate statements
async function checkForDuplicateStatements(csvContent: string, existingStatements: any[]): Promise<any[]> {
  const lines = csvContent.split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h: string) => h.trim().replace(/"/g, ''));
  const charges = [];

  // Parse first few rows to get date range
  for (let i = 1; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
      const cleanValues = values.map((v: string) => v.replace(/^"|"$/g, '').trim());

      const rowData: any = {};
      headers.forEach((header: string, index: number) => {
        rowData[header] = cleanValues[index] || '';
      });

      if (rowData.Date) {
        const dateParts = rowData.Date.split('/');
        if (dateParts.length === 3) {
          const month = parseInt(dateParts[0]);
          const day = parseInt(dateParts[1]);
          const year = parseInt(dateParts[2]);

          if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
            const chargeDate = new Date(year, month - 1, day);
            charges.push({
              date: chargeDate,
              description: rowData.Description || '',
              amount: rowData.Amount || ''
            });
          }
        }
      }
    } catch (error) {
      continue;
    }
  }

  if (charges.length === 0) return [];

  // Check for overlapping date ranges and similar charges
  const duplicates = [];
  for (const statement of existingStatements) {
    if (!statement.startDate || !statement.endDate) continue;

    const statementStart = new Date(statement.startDate);
    const statementEnd = new Date(statement.endDate);

    // Check if any charges fall within existing statement period
    const overlappingCharges = charges.filter(charge => 
      charge.date >= statementStart && charge.date <= statementEnd
    );

    if (overlappingCharges.length > 0) {
      duplicates.push({
        existingStatement: statement,
        overlappingCharges: overlappingCharges.length,
        periodOverlap: `${statementStart.toLocaleDateString()} - ${statementEnd.toLocaleDateString()}`
      });
    }
  }

  return duplicates;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Google authentication first
  setupGoogleAuth(app);

  const objectStorageService = new ObjectStorageService();
  const emailService = new EmailService();

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

  // Direct file upload to object storage using configured Replit authentication
  app.post("/api/objects/upload", requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      console.log("Uploading file directly:", req.file.originalname);

      // Generate a unique object path
      const objectId = randomUUID();
      const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;

      if (!privateObjectDir) {
        return res.status(500).json({ 
          error: "Object storage not configured. Please set PRIVATE_OBJECT_DIR environment variable." 
        });
      }

      const objectPath = `${privateObjectDir}/uploads/${objectId}`;

      // Use the existing parseObjectPath utility and configured storage client
      const { bucketName, objectName } = parseObjectPath(objectPath);

      // Use the pre-configured objectStorageClient with Replit authentication
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Upload the file buffer
      await file.save(req.file.buffer, {
        metadata: {
          contentType: req.file.mimetype,
        },
      });

      console.log(`File uploaded successfully to: ${objectPath}`);

      // Return the object path for processing
      res.json({ 
        success: true, 
        objectPath: `/objects/uploads/${objectId}`,
        fileName: req.file.originalname 
      });

    } catch (error) {
      console.error("Error uploading file:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: "Failed to upload file: " + errorMessage });
    }
  });

  // Dashboard stats (protected)
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getProcessingStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting stats:", error);
      res.status(500).json({ error: "Failed to get dashboard stats" });
    }
  });

  // Get comprehensive financial stats (protected)
  app.get("/api/dashboard/financial-stats", requireAuth, async (req, res) => {
    try {
      const financialStats = await storage.getFinancialStats();
      res.json(financialStats);
    } catch (error) {
      console.error("Error getting financial stats:", error);
      res.status(500).json({ error: "Failed to get financial stats" });
    }
  });

  // Receipt endpoints (protected)
  app.post("/api/receipts", requireAuth, async (req, res) => {
    try {
      const validatedData = insertReceiptSchema.parse(req.body);
      const receipt = await storage.createReceipt(validatedData);
      res.status(201).json(receipt);
    } catch (error) {
      console.error("Error creating receipt:", error);
      res.status(400).json({ error: "Invalid receipt data" });
    }
  });

  app.get("/api/receipts", requireAuth, async (req, res) => {
    try {
      const receipts = await storage.getAllReceipts();
      res.json(receipts);
    } catch (error) {
      console.error("Error getting receipts:", error);
      res.status(500).json({ error: "Failed to get receipts" });
    }
  });

  app.get("/api/receipts/:id", requireAuth, async (req, res) => {
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

  app.put("/api/receipts/:id", requireAuth, async (req, res) => {
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

  // Delete receipt endpoint
  app.delete("/api/receipts/:id", requireAuth, async (req, res) => {
    try {
      const receiptId = req.params.id;

      // Get receipt details before deletion
      const receipt = await storage.getReceipt(receiptId);
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      // If receipt was matched, unmark the charge
      if (receipt.isMatched && receipt.matchedChargeId) {
        await storage.updateAmexCharge(receipt.matchedChargeId, { 
          isMatched: false, 
          receiptId: null 
        });
      }

      // Delete receipt from storage
      const deleted = await storage.deleteReceipt(receiptId);
      if (!deleted) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      res.json({ message: "Receipt deleted successfully", deletedReceipt: receipt });
    } catch (error) {
      console.error("Error deleting receipt:", error);
      res.status(500).json({ error: "Failed to delete receipt" });
    }
  });

  // Mark receipt for manual review endpoint
  app.post("/api/receipts/:id/mark-for-review", requireAuth, async (req, res) => {
    try {
      const receiptId = req.params.id;
      
      const updatedReceipt = await storage.updateReceipt(receiptId, { 
        needsManualReview: true 
      });
      
      if (!updatedReceipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      
      console.log(`Receipt ${receiptId} marked for manual review`);
      res.json(updatedReceipt);
    } catch (error) {
      console.error("Error marking receipt for manual review:", error);
      res.status(500).json({ error: "Failed to mark receipt for manual review" });
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
        // Auto-assign to correct statement based on date (even if already assigned to wrong one)
        if (updatedReceipt.date) {
          console.log(`Auto-assigning receipt ${receiptId} to correct statement based on date`);
          const reassignedReceipt = await storage.autoAssignReceiptToStatement(receiptId);
          if (reassignedReceipt?.statementId && reassignedReceipt.statementId !== updatedReceipt.statementId) {
            updatedReceipt.statementId = reassignedReceipt.statementId;
            console.log(`Receipt ${receiptId} reassigned to correct statement ${reassignedReceipt.statementId}`);
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

  // Trigger OCR for existing receipt
  app.post("/api/receipts/:id/ocr", async (req, res) => {
    try {
      const receiptId = req.params.id;
      const receipt = await storage.getReceipt(receiptId);

      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      // Update status to processing
      await storage.updateReceipt(receiptId, {
        processingStatus: 'processing',
        ocrText: 'Processing...'
      });

      // Start OCR processing asynchronously
      ocrService.processReceipt(receipt.fileUrl, receipt.originalFileName)
        .then(async ({ ocrText, extractedData }) => {
          console.log(`Manual OCR completed for receipt ${receiptId}`);

          const updates: any = {
            ocrText,
            extractedData,
            processingStatus: 'completed'
          };

          // For PDF guidance messages, clear any extracted merchant data
          if (ocrText.includes("PDF receipt detected")) {
            updates.extractedData = { items: [] }; // Clear extracted data for PDFs
            // If the merchant field was set to the guidance text, clear it
            if (receipt.merchant && receipt.merchant.includes("PDF receipt detected")) {
              updates.merchant = null;
            }
          } else {
            // If we extracted useful data, populate the fields (but don't overwrite existing data)
            if (extractedData.merchant && !receipt.merchant) {
              updates.merchant = extractedData.merchant;
            }
          }
          if (extractedData.amount && !receipt.amount) updates.amount = extractedData.amount;
          if (extractedData.date && !receipt.date) updates.date = extractedData.date;
          if (extractedData.category && !receipt.category) updates.category = extractedData.category;

          await storage.updateReceipt(receiptId, updates);

          // Try auto-assignment and matching after OCR
          try {
            const updatedReceipt = await storage.autoAssignReceiptToStatement(receiptId);
            if (updatedReceipt?.statementId) {
              await fileOrganizer.attemptAutoMatch(receiptId);
            }
          } catch (error) {
            console.error('Error in post-OCR processing:', error);
          }
        })
        .catch(async (error) => {
          console.error(`Manual OCR failed for receipt ${receiptId}:`, error);
          await storage.updateReceipt(receiptId, {
            ocrText: 'OCR failed - manual entry required',
            processingStatus: 'completed',
            extractedData: null
          });
        });

      res.json({ message: "OCR processing started", receiptId });
    } catch (error) {
      console.error("Error starting OCR:", error);
      res.status(500).json({ error: "Failed to start OCR processing" });
    }
  });

  // Process uploaded receipt file  
  app.post("/api/receipts/process", async (req, res) => {
    try {
      console.log("Processing receipt - fileUrl:", req.body.fileUrl?.substring(0, 50) + "...");
      if (!req.body.fileUrl) {
        return res.status(400).json({ error: "fileUrl is required" });
      }

      const objectPath = objectStorageService.normalizeObjectEntityPath(req.body.fileUrl);

      // Create receipt record and start OCR processing
      const receipt = await storage.createReceipt({
        fileName: req.body.fileName || 'uploaded-receipt',
        originalFileName: req.body.originalFileName || req.body.fileName || 'uploaded-receipt',
        fileUrl: objectPath,
        processingStatus: 'processing', // Start with processing status
        ocrText: 'Processing...', // Indicate OCR is in progress
      });

      // Return success immediately and process OCR in background
      res.status(201).json(receipt);

      // Start OCR processing asynchronously
      ocrService.processReceipt(objectPath, req.body.originalFileName || req.body.fileName)
        .then(async ({ ocrText, extractedData }) => {
          console.log(`OCR completed for receipt ${receipt.id}`);

          // Update receipt with OCR results
          const updates: any = {
            ocrText,
            extractedData,
            processingStatus: 'completed'
          };

          // If we extracted useful data, populate the fields
          if (extractedData.merchant) updates.merchant = extractedData.merchant;
          if (extractedData.amount) updates.amount = extractedData.amount;
          if (extractedData.date) updates.date = extractedData.date;
          if (extractedData.category) updates.category = extractedData.category;

          await storage.updateReceipt(receipt.id, updates);

          // Try auto-assignment and matching after OCR
          try {
            const updatedReceipt = await storage.autoAssignReceiptToStatement(receipt.id);
            if (updatedReceipt?.statementId) {
              await fileOrganizer.attemptAutoMatch(receipt.id);
            }
          } catch (error) {
            console.error('Error in post-OCR processing:', error);
          }
        })
        .catch(async (error) => {
          console.error(`OCR failed for receipt ${receipt.id}:`, error);

          // Update receipt with failed status but allow manual entry
          await storage.updateReceipt(receipt.id, {
            ocrText: 'OCR failed - manual entry required',
            processingStatus: 'completed', // Still mark as completed for manual entry
            extractedData: null
          });
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

      // Try to auto-assign to statement and organize (in background)
      Promise.resolve().then(async () => {
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
      });
    } catch (error) {
      console.error("Error processing receipt:", error);
      res.status(500).json({ error: "Failed to process receipt" });
    }
  });

  // Process web URLs for receipt extraction
  app.post("/api/receipts/process-url", requireAuth, async (req, res) => {
    try {
      console.log("Processing URL for receipt data:", req.body.url);
      if (!req.body.url) {
        return res.status(400).json({ error: "URL is required" });
      }

      const url = req.body.url.trim();
      
      // Validate URL format
      try {
        new URL(url);
      } catch (error) {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      // Create initial receipt record
      const receipt = await storage.createReceipt({
        fileName: `url-receipt-${Date.now()}`,
        originalFileName: `url-receipt-${Date.now()}`,
        fileUrl: url, // Store the URL as fileUrl for now
        processingStatus: 'processing',
        ocrText: 'Processing web link...',
        merchant: 'URL Import',
        notes: `Imported from: ${url}`,
      });

      // Return success immediately
      res.status(201).json({
        ...receipt,
        message: "URL processing started successfully"
      });

      // Process URL in background
      processUrlInBackground(url, receipt.id);

    } catch (error) {
      console.error("Error processing URL:", error);
      res.status(500).json({ error: "Failed to process URL" });
    }
  });

  // Helper function to process URL in background
  async function processUrlInBackground(url: string, receiptId: string) {
    try {
      let extractedData: any = {};
      let ocrText = 'URL processed - manual entry required';
      let actualFileUrl = url;
      
      // Try to fetch content from the URL
      try {
        // For Gmail attachment URLs, try to fetch the actual content
        if (url.includes('mail.google.com') || url.includes('googleusercontent.com')) {
          console.log('Attempting to fetch Gmail attachment...');
          
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          
          if (response.ok) {
            const contentType = response.headers.get('content-type') || '';
            
            if (contentType.includes('image') || contentType.includes('pdf')) {
              // Get the file content as buffer
              const fileBuffer = Buffer.from(await response.arrayBuffer());
              
              // Upload to our object storage
              const objectStorageService = new ObjectStorageService(objectStorageClient);
              const uploadURL = await objectStorageService.getObjectEntityUploadURL();
              
              const uploadResponse = await fetch(uploadURL, {
                method: 'PUT',
                body: fileBuffer,
                headers: {
                  'Content-Type': contentType,
                },
              });

              if (uploadResponse.ok) {
                // Extract the object path from the upload URL
                const urlParts = uploadURL.split('?')[0];
                const pathMatch = urlParts.match(/\/([^\/]+\/[^\/]+)$/);
                if (pathMatch) {
                  actualFileUrl = `/objects/${pathMatch[1]}`;
                  console.log('Successfully uploaded content from URL to:', actualFileUrl);
                  
                  // Start OCR processing for the uploaded file
                  const fileName = url.includes('googleusercontent.com') ? 'gmail-attachment' : 'web-content';
                  const fileExtension = contentType.includes('pdf') ? '.pdf' : 
                                      contentType.includes('jpeg') ? '.jpg' : 
                                      contentType.includes('png') ? '.png' : '';
                  
                  try {
                    const ocrResult = await ocrService.processReceipt(actualFileUrl, fileName + fileExtension);
                    ocrText = ocrResult.ocrText || 'File uploaded successfully - add details manually';
                    extractedData = ocrResult.extractedData || {};
                    
                    if (extractedData.merchant) extractedData.merchant = extractedData.merchant;
                    if (extractedData.amount) extractedData.amount = extractedData.amount;
                    if (extractedData.date) extractedData.date = extractedData.date;
                  } catch (ocrError) {
                    console.error('OCR processing failed:', ocrError);
                    ocrText = 'File uploaded successfully - OCR failed, add details manually';
                  }
                }
              }
            }
          }
        }
      } catch (fetchError) {
        console.error('Failed to fetch content from URL:', fetchError);
        // Fall back to URL reference
      }
      
      // Set default values based on URL type if we couldn't fetch content
      if (!extractedData.merchant) {
        if (url.includes('mail.google.com') || url.includes('googleusercontent.com')) {
          extractedData.merchant = 'Gmail Import';
          extractedData.notes = 'Receipt imported from Gmail. Please add merchant, amount, and date manually.';
        } else if (url.includes('drive.google.com')) {
          extractedData.merchant = 'Google Drive Import';
          extractedData.notes = 'Receipt imported from Google Drive. Please add merchant, amount, and date manually.';
        } else {
          extractedData.merchant = 'Web Import';
          extractedData.notes = `Receipt imported from web link: ${url}. Please add merchant, amount, and date manually.`;
        }
      }

      // Update receipt with processed data
      const updates: any = {
        fileUrl: actualFileUrl, // Use the actual file URL or original URL
        ocrText,
        extractedData,
        processingStatus: 'completed',
        notes: extractedData.notes
      };

      if (extractedData.merchant) updates.merchant = extractedData.merchant;
      if (extractedData.amount) updates.amount = extractedData.amount;
      if (extractedData.date) updates.date = extractedData.date;
      if (extractedData.category) updates.category = extractedData.category;
      
      // Transportation-specific fields
      if (extractedData.fromAddress) updates.fromAddress = extractedData.fromAddress;
      if (extractedData.toAddress) updates.toAddress = extractedData.toAddress;
      if (extractedData.tripDistance) updates.tripDistance = extractedData.tripDistance;
      if (extractedData.tripDuration) updates.tripDuration = extractedData.tripDuration;
      if (extractedData.driverName) updates.driverName = extractedData.driverName;
      if (extractedData.vehicleInfo) updates.vehicleInfo = extractedData.vehicleInfo;

      await storage.updateReceipt(receiptId, updates);

      // Try auto-assignment to statement
      try {
        const updatedReceipt = await storage.autoAssignReceiptToStatement(receiptId);
        if (updatedReceipt?.statementId) {
          await fileOrganizer.attemptAutoMatch(receiptId);
        }
      } catch (error) {
        console.error('Error in post-URL processing:', error);
      }

      console.log(`URL processing completed for receipt ${receiptId}`);
    } catch (error) {
      console.error(`URL processing failed for receipt ${receiptId}:`, error);
      
      // Update receipt with failed status
      await storage.updateReceipt(receiptId, {
        ocrText: 'URL processing failed - manual entry required',
        processingStatus: 'completed',
        extractedData: null
      });
    }
  }

  // AMEX Statement endpoints
  app.get("/api/statements", requireAuth, async (req, res) => {
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

  // Get single AMEX statement
  app.get("/api/statements/:id", requireAuth, async (req, res) => {
    try {
      const statementId = req.params.id;
      const statement = await storage.getAmexStatement(statementId);

      if (!statement) {
        return res.status(404).json({ error: "Statement not found" });
      }

      res.json(statement);
    } catch (error) {
      console.error("Error getting statement:", error);
      res.status(500).json({ error: "Failed to get statement" });
    }
  });

  // Oracle export route
  app.get("/api/statements/:id/export/oracle", requireAuth, async (req, res) => {
    try {
      const statementId = req.params.id;
      const exportData = await storage.getOracleExportData(statementId);

      if (!exportData) {
        return res.status(404).json({ error: "Statement not found" });
      }

      const { statement, charges } = exportData;

      // Generate CSV headers
      const headers = [
        "Expense_Date",
        "Expense_Type", 
        "Merchant",
        "Amount",
        "Currency",
        "Receipt_File",
        "Receipt_URL",
        "Business_Purpose",
        "Statement_Period",
        "Card_Member",
        "Transaction_Type",
        "Address",
        "Transportation_From",
        "Transportation_To",
        "Match_Status"
      ];

      // Generate CSV rows
      const rows = charges.map(charge => {
        const receipt = charge.receipt;
        const receiptPath = receipt ? storage.getOrganizedPath(receipt) : '';
        const receiptUrl = receipt ? `${process.env.BASE_URL || 'https://your-domain.replit.dev'}${receipt.fileUrl}` : '';
        
        return [
          charge.date.toISOString().split('T')[0], // Expense_Date
          receipt?.category || charge.category || 'General', // Expense_Type
          charge.description || 'Unknown Merchant', // Merchant
          Math.abs(parseFloat(charge.amount || '0')).toFixed(2), // Amount (remove negative signs)
          'USD', // Currency
          receiptPath.replace('/objects/', ''), // Receipt_File (clean path)
          receiptUrl, // Receipt_URL
          receipt?.notes || charge.userNotes || charge.category || 'Business expense', // Business_Purpose
          statement.periodName, // Statement_Period
          charge.cardMember, // Card_Member
          charge.isPersonalExpense ? 'Personal' : (charge.isNonAmex ? 'Non-AMEX Business' : 'AMEX Business'), // Transaction_Type
          `${charge.address || ''} ${charge.cityState || ''}`.trim(), // Address
          receipt?.fromAddress || '', // Transportation_From
          receipt?.toAddress || '', // Transportation_To
          charge.isMatched ? 'Matched' : (charge.noReceiptRequired ? 'No Receipt Required' : 'Unmatched') // Match_Status
        ];
      });

      // Generate CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(field => 
          // Escape fields containing commas or quotes
          typeof field === 'string' && (field.includes(',') || field.includes('"')) 
            ? `"${field.replace(/"/g, '""')}"` 
            : field
        ).join(','))
      ].join('\n');

      // Set response headers for CSV download
      const filename = `Oracle_Export_${statement.periodName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      res.send(csvContent);
    } catch (error) {
      console.error("Error generating Oracle export:", error);
      res.status(500).json({ error: "Failed to generate Oracle export" });
    }
  });

  app.post("/api/statements", requireAuth, async (req, res) => {
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

      // Check for duplicate statements before processing
      const existingStatements = await storage.getAllAmexStatements();
      const potentialDuplicates = await checkForDuplicateStatements(csvContent, existingStatements);

      if (potentialDuplicates.length > 0) {
        return res.status(409).json({ 
          error: "Duplicate statement detected",
          duplicates: potentialDuplicates,
          message: `Found ${potentialDuplicates.length} potential duplicate statement(s). Please review before uploading.`
        });
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

      // Check for gaps and overlaps with existing statements
      const dateValidation = await storage.validateStatementDates(minDate, maxDate, existingStatements);
      if (!dateValidation.isValid) {
        return res.status(400).json({
          error: "Statement period validation failed",
          validation: dateValidation,
          suggestedDates: {
            startDate: minDate.toISOString().split('T')[0],
            endDate: maxDate.toISOString().split('T')[0]
          },
          message: dateValidation.message
        });
      }

      // First pass: analyze CSV data to determine date range
      const charges = [];
      let minDate: Date | null = null; // Will be set to first valid date
      let maxDate: Date | null = null; // Will be set to first valid date
      let imported = 0;
      let errors = 0;
      let skipped = 0;
      const skippedReasons: string[] = [];

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
            skipped++;
            skippedReasons.push(`Row ${i}: PAYMENT/AUTOPAY - ${validatedRow.Description}`);
            console.log(`Skipped PAYMENT/AUTOPAY: ${validatedRow.Description}`);
            continue;
          }

          // Parse MM/DD/YYYY format properly
          const dateParts = validatedRow.Date.split('/');
          if (dateParts.length !== 3) {
            skipped++;
            skippedReasons.push(`Row ${i}: Invalid date format - ${validatedRow.Date}`);
            console.error(`Invalid date format: ${validatedRow.Date}`);
            continue;
          }

          const month = parseInt(dateParts[0]);
          const day = parseInt(dateParts[1]);
          const year = parseInt(dateParts[2]);

          // Validate date components
          if (isNaN(month) || isNaN(day) || isNaN(year) || month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
            skipped++;
            skippedReasons.push(`Row ${i}: Invalid date components - ${validatedRow.Date} (month:${month}, day:${day}, year:${year})`);
            console.error(`Invalid date components: ${validatedRow.Date} -> month:${month}, day:${day}, year:${year}`);
            continue;
          }

          const chargeDate = new Date(year, month - 1, day);

          // Validate that the date was created correctly
          if (isNaN(chargeDate.getTime())) {
            skipped++;
            skippedReasons.push(`Row ${i}: Failed to create valid date - ${validatedRow.Date}`);
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

      // Log skipped information
      if (skipped > 0) {
        console.log(`CSV Import Summary: ${imported} imported, ${skipped} skipped, ${errors} errors`);
        console.log('Skipped charges details:');
        skippedReasons.forEach(reason => console.log(`  - ${reason}`));
      }

      res.json({ 
        message: `Import completed. ${imported} charges imported, ${skipped} skipped, ${errors} errors.`,
        imported,
        skipped,
        errors,
        skippedReasons,
        statementName: statement.periodName,
        statementId: statement.id
      });
    } catch (error) {
      console.error("Error importing CSV:", error);
      res.status(500).json({ error: "Failed to import CSV" });
    }
  });

  // AMEX Charge endpoints
  // Get all charges (global endpoint)
  app.get("/api/charges", async (req, res) => {
    try {
      const charges = await storage.getAllCharges();
      res.json(charges);
    } catch (error) {
      console.error("Error getting all charges:", error);
      res.status(500).json({ error: "Failed to get charges" });
    }
  });

  app.post("/api/charges", async (req, res) => {
    try {
      // Convert date string to Date object if needed
      const requestData = { ...req.body };
      if (requestData.date && typeof requestData.date === 'string') {
        requestData.date = new Date(requestData.date);
      }
      
      const validatedData = insertAmexChargeSchema.parse(requestData);
      const charge = await storage.createAmexCharge(validatedData);
      res.status(201).json(charge);
    } catch (error) {
      console.error("Error creating charge:", error);
      res.status(400).json({ error: "Invalid charge data" });
    }
  });

  // Create non-AMEX charge from receipt
  app.post("/api/charges/create-from-receipt", requireAuth, async (req, res) => {
    try {
      const { receiptId, statementId } = req.body;
      
      if (!receiptId || !statementId) {
        return res.status(400).json({ error: "receiptId and statementId are required" });
      }

      const charge = await storage.createNonAmexChargeFromReceipt(receiptId, statementId);
      
      if (!charge) {
        return res.status(400).json({ error: "Failed to create non-AMEX charge. Receipt may be missing required data or already matched." });
      }

      // Invalidate cache for both charges and receipts
      // This ensures the UI updates immediately
      await createStatementFolder(statementId);
      
      res.status(201).json(charge);
    } catch (error) {
      console.error("Error creating non-AMEX charge from receipt:", error);
      res.status(500).json({ error: "Failed to create non-AMEX charge" });
    }
  });

  // Assign receipt to statement period
  app.put("/api/receipts/:receiptId/assign-to-statement", requireAuth, async (req, res) => {
    try {
      const receiptId = req.params.receiptId;
      const { statementId } = req.body;
      
      if (!receiptId || !statementId) {
        return res.status(400).json({ error: "receiptId and statementId are required" });
      }

      const updatedReceipt = await storage.assignReceiptToStatement(receiptId, statementId);
      
      if (!updatedReceipt) {
        return res.status(404).json({ error: "Receipt not found or failed to assign to statement" });
      }

      res.json(updatedReceipt);
    } catch (error) {
      console.error("Error assigning receipt to statement:", error);
      res.status(500).json({ error: "Failed to assign receipt to statement" });
    }
  });

  // Download all receipts for a statement period as ZIP
  app.get("/api/statements/:statementId/download-receipts", requireAuth, async (req, res) => {
    try {
      const statementId = req.params.statementId;
      
      // Get receipts, charges, and statement data
      const downloadData = await storage.getReceiptDownloadData(statementId);
      if (!downloadData) {
        return res.status(404).json({ error: "Statement not found" });
      }

      const { receipts, charges, statement } = downloadData;
      console.log(`Creating ZIP for statement ${statement.periodName} with ${receipts.length} receipts`);
      
      // Create ZIP archive
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      // Set response headers
      const filename = `receipts_${statement.periodName.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Pipe archive to response
      archive.pipe(res);

      // Function to create clean filename from receipt/charge data
      const createReceiptFilename = (receipt: any, charge: any | null) => {
        const date = receipt.date ? new Date(receipt.date).toISOString().split('T')[0].replace(/-/g, '') : 'NODATE';
        const merchant = (receipt.merchant || 'Unknown').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
        const amount = receipt.amount ? parseFloat(receipt.amount).toFixed(2).replace('.', '') : '000';
        const suffix = charge?.isNonAmex ? '_NON_AMEX' : '';
        const extension = receipt.originalFileName?.split('.').pop() || 'pdf';
        
        return `${date}_${merchant}_${amount}${suffix}.${extension}`;
      };

      let addedFiles = 0;
      let skippedFiles = 0;

      // Add receipts to ZIP
      for (const receipt of receipts) {
        try {
          if (!receipt.fileUrl) {
            console.log(`Skipping receipt ${receipt.id} - no file URL`);
            skippedFiles++;
            continue;
          }
          
          // Find associated charge to determine if non-AMEX
          const associatedCharge = charges.find(c => c.receiptId === receipt.id);
          
          // Skip personal expenses
          if (associatedCharge?.isPersonalExpense) {
            console.log(`Skipping receipt ${receipt.id} - personal expense`);
            skippedFiles++;
            continue;
          }
          
          console.log(`Adding receipt ${receipt.id} with fileUrl: ${receipt.fileUrl}`);
          
          // Get receipt file from object storage
          const objectFile = await objectStorageService.getObjectEntityFile(receipt.fileUrl);
          
          // Use the file's download stream method directly
          const [fileBuffer] = await objectFile.download();
          
          const filename = createReceiptFilename(receipt, associatedCharge);
          console.log(`Adding file to ZIP: ${filename}`);
          
          archive.append(fileBuffer, { name: filename });
          addedFiles++;
        } catch (error) {
          console.error(`Error adding receipt ${receipt.id} to ZIP:`, error);
          skippedFiles++;
          // Continue with other receipts even if one fails
        }
      }

      console.log(`ZIP creation: ${addedFiles} files added, ${skippedFiles} files skipped`);

      // Create summary CSV content
      const businessReceipts = receipts.filter(receipt => {
        const associatedCharge = charges.find(c => c.receiptId === receipt.id);
        return !associatedCharge?.isPersonalExpense;
      });

      const summaryRows = businessReceipts.map(receipt => {
        const associatedCharge = charges.find(c => c.receiptId === receipt.id);
        return {
          'Receipt_Date': receipt.date || '',
          'Merchant': receipt.merchant || '',
          'Amount': receipt.amount || '',
          'Category': receipt.category || '',
          'Status': receipt.isMatched ? 'Matched' : 'Unmatched',
          'Charge_Type': associatedCharge?.isNonAmex ? 'Non-AMEX' : 'AMEX',
          'Personal_Expense': 'No',
          'Original_Filename': receipt.originalFileName || '',
          'ZIP_Filename': createReceiptFilename(receipt, associatedCharge),
          'Notes': receipt.notes || ''
        };
      });

      // Convert to CSV
      if (summaryRows.length > 0) {
        const csvHeaders = Object.keys(summaryRows[0]).join(',');
        const csvRows = summaryRows.map(row => 
          Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
        );
        const summaryCSV = [csvHeaders, ...csvRows].join('\n');
        archive.append(summaryCSV, { name: 'receipt_summary.csv' });
        console.log('Added summary CSV to ZIP');
      }

      // Add Oracle export CSV
      try {
        const oracleData = await storage.getOracleExportData(statementId);
        if (oracleData) {
          const oracleCSV = [
            'Expense_Date,Expense_Type,Merchant,Amount,Currency,Receipt_File,Receipt_URL,Business_Purpose,Statement_Period,Card_Member,Transaction_Type,Address,Transportation_From,Transportation_To,Match_Status',
            ...oracleData.charges.map(charge => {
              const receipt = charge.receipt;
              const receiptUrl = receipt?.fileUrl ? 
                `${req.protocol}://${req.get('host')}${receipt.fileUrl}` : '';
              
              return [
                charge.date ? new Date(charge.date).toISOString().split('T')[0] : '',
                charge.category || 'General',
                charge.description || '',
                Math.abs(parseFloat(charge.amount || '0')).toFixed(2),
                'USD',
                receipt ? createReceiptFilename(receipt, charge) : '',
                receiptUrl,
                receipt?.notes || charge.userNotes || charge.category || 'Business expense',
                statement.periodName,
                charge.cardMember || '',
                charge.isPersonalExpense ? 'Personal' : (charge.isNonAmex ? 'Non-AMEX Business' : 'AMEX Business'),
                `${charge.address || ''} ${charge.cityState || ''}`.trim(),
                receipt?.fromAddress || '',
                receipt?.toAddress || '',
                charge.isMatched ? 'Matched' : (charge.noReceiptRequired ? 'No Receipt Required' : 'Unmatched')
              ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
            })
          ].join('\n');
          
          archive.append(oracleCSV, { name: 'oracle_export.csv' });
          console.log('Added Oracle export CSV to ZIP');
        }
      } catch (error) {
        console.error("Error adding Oracle CSV to ZIP:", error);
      }

      // Handle archive events
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to create ZIP archive' });
        }
      });

      archive.on('end', () => {
        console.log('ZIP archive finalized successfully');
      });

      // Finalize the archive
      await archive.finalize();
      
    } catch (error) {
      console.error("Error creating receipt ZIP:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create receipt download" });
      }
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

  app.delete("/api/charges/:chargeId", async (req, res) => {
    try {
      const chargeId = req.params.chargeId;
      const success = await storage.deleteAmexCharge(chargeId);
      
      if (success) {
        res.json({ message: "Charge deleted successfully" });
      } else {
        res.status(404).json({ error: "Charge not found" });
      }
    } catch (error) {
      console.error("Error deleting charge:", error);
      res.status(500).json({ error: "Failed to delete charge" });
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

  // Fix matched receipts missing charge connections and reorganize with Oracle naming
  app.post("/api/receipts/fix-and-reorganize", async (req, res) => {
    try {
      const matchedReceipts = await storage.getMatchedReceipts();
      const allCharges = await storage.getAllCharges();
      let fixed = 0;
      let reorganized = 0;
      let errors = 0;
      let statusMessages: string[] = [];

      for (const receipt of matchedReceipts) {
        try {
          let needsUpdate = false;
          let updateData: any = {};

          // If receipt is marked as matched but has no matchedChargeId, try to find the charge
          if (!receipt.matchedChargeId && receipt.amount) {
            const matchingCharge = allCharges.find(charge => 
              Math.abs(parseFloat(charge.amount) - parseFloat(receipt.amount || '0')) < 0.01 &&
              Math.abs(new Date(charge.date).getTime() - new Date(receipt.date || new Date()).getTime()) < 7 * 24 * 60 * 60 * 1000 // Within 7 days
            );

            if (matchingCharge) {
              updateData.matchedChargeId = matchingCharge.id;
              updateData.statementId = matchingCharge.statementId;
              updateData.merchant = matchingCharge.description;
              updateData.date = matchingCharge.date;
              receipt.matchedChargeId = matchingCharge.id;
              receipt.statementId = matchingCharge.statementId;
              receipt.merchant = matchingCharge.description;
              receipt.date = matchingCharge.date;
              needsUpdate = true;
              fixed++;
              statusMessages.push(`Fixed ${receipt.fileName} - linked to charge ${matchingCharge.description} $${matchingCharge.amount}`);
            }
          }

          // For receipts that already have matchedChargeId, ensure data completeness
          if (receipt.matchedChargeId) {
            const charge = await storage.getAmexCharge(receipt.matchedChargeId);
            if (charge) {
              if (charge.statementId !== receipt.statementId) {
                updateData.statementId = charge.statementId;
                receipt.statementId = charge.statementId;
                needsUpdate = true;
              }

              if (!receipt.merchant && charge.description) {
                updateData.merchant = charge.description;
                receipt.merchant = charge.description;
                needsUpdate = true;
              }

              if (!receipt.amount && charge.amount) {
                updateData.amount = charge.amount;
                receipt.amount = charge.amount;
                needsUpdate = true;
              }

              if (!receipt.date && charge.date) {
                updateData.date = charge.date;
                receipt.date = charge.date;
                needsUpdate = true;
              }
            }
          }

          // Apply updates if needed
          if (needsUpdate) {
            await storage.updateReceipt(receipt.id, updateData);
          }

          // Always reorganize if receipt has statement assignment - use intelligent fallbacks
          if (receipt.statementId) {
            await fileOrganizer.organizeReceipt(receipt);
            reorganized++;
            const missingData = [
              !receipt.date ? 'date' : null,
              !receipt.merchant ? 'merchant' : null,
              !receipt.amount ? 'amount' : null
            ].filter(Boolean);

            if (missingData.length > 0) {
              statusMessages.push(`Reorganized ${receipt.fileName} → Oracle naming (used fallbacks for: ${missingData.join(', ')})`);
            } else {
              statusMessages.push(`Reorganized ${receipt.fileName} → Oracle naming (complete data)`);
            }
          } else {
            statusMessages.push(`${receipt.fileName} - no statement assignment, staying in Inbox`);
          }

        } catch (error: any) {
          console.error(`Error processing receipt ${receipt.id}:`, error);
          errors++;
          statusMessages.push(`Error: ${receipt.fileName} - ${error?.message || 'Unknown error'}`);
        }
      }

      res.json({ 
        message: `Fixed ${fixed} receipt connections, reorganized ${reorganized} with Oracle naming`, 
        fixed,
        reorganized, 
        errors,
        total: matchedReceipts.length,
        details: statusMessages.slice(0, 20)
      });
    } catch (error) {
      console.error("Error fixing and reorganizing receipts:", error);
      res.status(500).json({ error: "Failed to fix and reorganize receipts" });
    }
  });

  // Utility endpoint to reorganize already matched receipts with proper Oracle naming
  app.post("/api/receipts/reorganize-matched", async (req, res) => {
    try {
      const matchedReceipts = await storage.getMatchedReceipts();
      let reorganized = 0;
      let errors = 0;
      let statusMessages: string[] = [];
      let updated = 0;

      for (const receipt of matchedReceipts) {
        try {
          let needsUpdate = false;
          let updateData: any = {};

          // First ensure the receipt has the correct statementId from its matched charge
          if (receipt.matchedChargeId) {
            const charge = await storage.getAmexCharge(receipt.matchedChargeId);
            if (charge) {
              // Update statement ID if different
              if (charge.statementId !== receipt.statementId) {
                updateData.statementId = charge.statementId;
                receipt.statementId = charge.statementId; // Update local copy
                needsUpdate = true;
                statusMessages.push(`Updated statement ID for ${receipt.fileName}`);
              }

              // Fill in missing merchant data from charge  
              if (!receipt.merchant && charge.description) {
                updateData.merchant = charge.description;
                receipt.merchant = charge.description; // Update local copy
                needsUpdate = true;
                statusMessages.push(`Added merchant "${charge.description}" to ${receipt.fileName}`);
              }

              // Fill in missing amount data from charge  
              if (!receipt.amount && charge.amount) {
                updateData.amount = charge.amount;
                receipt.amount = charge.amount; // Update local copy
                needsUpdate = true;
                statusMessages.push(`Added amount $${charge.amount} to ${receipt.fileName}`);
              }

              // Fill in missing date from charge
              if (!receipt.date && charge.date) {
                updateData.date = charge.date;
                receipt.date = charge.date; // Update local copy
                needsUpdate = true;
                statusMessages.push(`Added date ${charge.date.toISOString().split('T')[0]} to ${receipt.fileName}`);
              }
            }
          }

          // Apply updates if needed
          if (needsUpdate) {
            await storage.updateReceipt(receipt.id, updateData);
            updated++;
          }

          // Now reorganize if receipt has required data for Oracle naming
          if (receipt.date && receipt.merchant && receipt.amount && receipt.statementId) {
            await fileOrganizer.organizeReceipt(receipt);
            reorganized++;
            statusMessages.push(`Reorganized ${receipt.fileName} with Oracle naming`);
          } else {
            statusMessages.push(`Skipped ${receipt.fileName} - still missing required data (date: ${!!receipt.date}, merchant: ${!!receipt.merchant}, amount: ${!!receipt.amount}, statementId: ${!!receipt.statementId})`);
          }

        } catch (error: any) {
          console.error(`Error reorganizing receipt ${receipt.id}:`, error);
          errors++;
          statusMessages.push(`Error: ${receipt.fileName} - ${error?.message || 'Unknown error'}`);
        }
      }

      res.json({ 
        message: `Reorganized ${reorganized} matched receipts with Oracle naming convention`, 
        reorganized, 
        updated,
        errors,
        total: matchedReceipts.length,
        details: statusMessages.slice(0, 15) // Show first 15 status messages
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

      // Get current receipt to check for missing data
      const currentReceipt = await storage.getReceipt(receiptId);
      if (!currentReceipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      // Auto-populate missing data from charge
      const updateData: any = {
        isMatched: true,
        matchedChargeId: chargeId,
        statementId: charge.statementId
      };

      // Fill missing fields with charge data
      if (!currentReceipt.merchant && charge.description) {
        updateData.merchant = charge.description;
      }
      if (!currentReceipt.amount && charge.amount) {
        updateData.amount = charge.amount;
      }
      if (!currentReceipt.date && charge.date) {
        updateData.date = charge.date;
      }

      // Update receipt with all data
      const receipt = await storage.updateReceipt(receiptId, updateData);

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
            const amountDiff = Math.abs(parseFloat(receipt.amount || '0') - parseFloat(charge.amount));
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

  // Toggle no receipt required flag for a charge
  app.put("/api/charges/:id/toggle-no-receipt-required", async (req, res) => {
    try {
      const chargeId = req.params.id;
      const updatedCharge = await storage.toggleChargeNoReceiptRequired(chargeId);

      if (!updatedCharge) {
        return res.status(404).json({ error: "Charge not found" });
      }

      res.json({ 
        charge: updatedCharge, 
        message: updatedCharge.noReceiptRequired 
          ? "Charge marked as no receipt required" 
          : "Charge marked as receipt required" 
      });
    } catch (error) {
      console.error("Error toggling no receipt required:", error);
      res.status(500).json({ error: "Failed to toggle no receipt required status" });
    }
  });

  // Update charge (including notes)
  app.put("/api/charges/:id", async (req, res) => {
    try {
      const chargeId = req.params.id;
      const updates = req.body;

      const updatedCharge = await storage.updateAmexCharge(chargeId, updates);
      if (!updatedCharge) {
        return res.status(404).json({ error: "Charge not found" });
      }

      res.json(updatedCharge);
    } catch (error) {
      console.error("Error updating charge:", error);
      res.status(500).json({ error: "Failed to update charge" });
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
      const statementId = req.params.id;
      const charges = await storage.getChargesByStatement(statementId);
      res.json(charges);
    } catch (error) {
      console.error("Error getting statement charges:", error);
      res.status(500).json({ error: "Failed to get statement charges" });
    }
  });

  // Validate statement dates for gaps/overlaps
  app.post("/api/statements/validate-dates", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate, excludeStatementId } = req.body;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start >= end) {
        return res.status(400).json({ 
          error: "Start date must be before end date",
          isValid: false 
        });
      }

      const existingStatements = await storage.getAllAmexStatements();
      const otherStatements = excludeStatementId 
        ? existingStatements.filter(s => s.id !== excludeStatementId)
        : existingStatements;

      const validation = await storage.validateStatementDates(start, end, otherStatements);
      res.json(validation);
    } catch (error) {
      console.error("Error validating statement dates:", error);
      res.status(500).json({ error: "Failed to validate dates" });
    }
  });

  // Update statement
  app.put("/api/statements/:id", async (req, res) => {
    try {
      const statementId = req.params.id;
      const updateData = req.body;

      // If updating dates, validate them first
      if (updateData.startDate || updateData.endDate) {
        const statement = await storage.getAmexStatement(statementId);
        if (!statement) {
          return res.status(404).json({ error: "Statement not found" });
        }

        const startDate = updateData.startDate ? new Date(updateData.startDate) : statement.startDate;
        const endDate = updateData.endDate ? new Date(updateData.endDate) : statement.endDate;

        if (startDate >= endDate) {
          return res.status(400).json({ 
            error: "Start date must be before end date" 
          });
        }

        const existingStatements = await storage.getAllAmexStatements();
        const otherStatements = existingStatements.filter(s => s.id !== statementId);
        
        const validation = await storage.validateStatementDates(startDate, endDate, otherStatements);
        if (!validation.isValid) {
          return res.status(400).json({
            error: "Statement date validation failed",
            validation,
            message: validation.message
          });
        }

        // Convert dates to proper format
        if (updateData.startDate) updateData.startDate = startDate;
        if (updateData.endDate) updateData.endDate = endDate;
      }

      // Update the statement
      const updatedStatement = await storage.updateAmexStatement(statementId, updateData);

      if (updatedStatement) {
        res.json(updatedStatement);
      } else {
        res.status(404).json({ error: "Statement not found" });
      }
    } catch (error) {
      console.error("Error updating statement:", error);
      res.status(500).json({ error: "Failed to update statement" });
    }
  });

  // Delete statement and all its charges
  app.delete("/api/statements/:id", async (req, res) => {
    try {
      const statementId = req.params.id;

      // First, unlink any receipts that were matched to charges in this statement
      const charges = await storage.getChargesByStatement(statementId);
      for (const charge of charges) {
        if (charge.isMatched && charge.receiptId) {
          // Unlink the receipt
          await storage.updateReceipt(charge.receiptId, {
            isMatched: false,
            statementId: null,
            matchedChargeId: null
          });
        }
      }

      // Delete all charges for this statement
      await storage.deleteChargesByStatement(statementId);

      // Delete the statement
      await storage.deleteStatement(statementId);

      res.json({ success: true, message: "Statement deleted successfully" });
    } catch (error) {
      console.error("Error deleting statement:", error);
      res.status(500).json({ error: "Failed to delete statement" });
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

  // Get unmatched receipts within a specific statement period
  app.get("/api/statements/:id/unmatched-receipts", async (req, res) => {
    try {
      const statementId = req.params.id;

      // Get statement to determine date range
      const statement = await storage.getAmexStatement(statementId);
      if (!statement) {
        return res.status(404).json({ error: "Statement not found" });
      }

      // Get all unmatched receipts that fall within the statement period
      const unmatchedReceipts = await storage.getUnmatchedReceiptsInPeriod(
        statement.startDate, 
        statement.endDate
      );

      res.json(unmatchedReceipts);
    } catch (error) {
      console.error("Error getting unmatched receipts for statement:", error);
      res.status(500).json({ error: "Failed to get unmatched receipts" });
    }
  });

  // Fix receipts with bad merchant names (utility endpoint)
  app.post("/api/receipts/fix-merchants", async (req, res) => {
    try {
      const fixedCount = await fixReceiptsWithBadMerchants();
      res.json({ 
        message: `Fixed ${fixedCount} receipts with invalid merchant names`,
        fixedCount 
      });
    } catch (error) {
      console.error("Error fixing receipt merchants:", error);
      res.status(500).json({ error: "Failed to fix receipt merchants" });
    }
  });

  // Upload receipt directly to a charge
  app.post("/api/receipts/upload-to-charge", upload.single('receipt'), async (req, res) => {
    try {
      const { chargeId } = req.body;
      const file = req.file;

      if (!file || !chargeId) {
        return res.status(400).json({ error: "File and chargeId are required" });
      }

      // Get the charge to extract information
      const charge = await storage.getAmexCharge(chargeId);
      if (!charge) {
        return res.status(404).json({ error: "Charge not found" });
      }

      // Create receipt with charge information pre-filled
      const receiptData = {
        fileName: file.originalname,
        originalFileName: file.originalname,
        merchant: charge.description,
        amount: charge.amount,
        date: charge.date,
        category: charge.category || null,
        ocrText: "Direct upload - linked to charge",
        extractedData: null,
        processingStatus: "completed" as const,
        statementId: charge.statementId,
        isMatched: true,
        matchedChargeId: chargeId,
      };

      // Upload file to object storage using signed URL pattern
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Extract the object path from the upload URL for our file reference
      const urlParts = uploadURL.split('?')[0]; // Remove query parameters
      const pathMatch = urlParts.match(/\/([^\/]+\/[^\/]+)$/);
      if (!pathMatch) {
        throw new Error('Could not extract path from upload URL');
      }
      const objectPath = `/objects/${pathMatch[1]}`;

      // Upload file directly to the signed URL
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: file.buffer,
        headers: {
          'Content-Type': file.mimetype || 'application/octet-stream',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      // Create receipt record
      const receipt = await storage.createReceipt({
        ...receiptData,
        fileUrl: objectPath
      });

      // Organize the receipt with Oracle naming
      await fileOrganizer.organizeReceipt(receipt);

      // Update charge to mark as matched with proper receipt linking
      await storage.updateAmexCharge(chargeId, { 
        isMatched: true, 
        receiptId: receipt.id 
      });

      res.json({ 
        message: "Receipt uploaded and matched successfully",
        receipt,
        charge
      });
    } catch (error) {
      console.error("Error uploading receipt to charge:", error);
      res.status(500).json({ error: "Failed to upload receipt" });
    }
  });

  // Email Integration Routes

  // Initialize email service with credentials
  app.post("/api/email/setup", async (req, res) => {
    try {
      const { clientId, clientSecret, tenantId } = req.body;

      if (!clientId || !clientSecret || !tenantId) {
        return res.status(400).json({ 
          error: "Missing required fields: clientId, clientSecret, tenantId" 
        });
      }

      await emailService.initializeAuth(clientId, clientSecret, tenantId);
      res.json({ message: "Email service initialized successfully" });
    } catch (error) {
      console.error("Error setting up email service:", error);
      res.status(500).json({ error: "Failed to setup email service" });
    }
  });

  // Import receipts from Outlook emails
  app.post("/api/email/import", async (req, res) => {
    try {
      const { userEmail, daysBack = 30 } = req.body;

      if (!userEmail) {
        return res.status(400).json({ error: "userEmail is required" });
      }

      const result = await emailService.importEmailReceipts(userEmail, storage, daysBack);

      res.json({
        message: `Import completed: ${result.imported} receipts imported`,
        imported: result.imported,
        errors: result.errors
      });
    } catch (error) {
      console.error("Error importing email receipts:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to import email receipts" 
      });
    }
  });

  // Search and preview receipt emails without importing
  app.post("/api/email/search", async (req, res) => {
    try {
      const { userEmail, daysBack = 30 } = req.body;

      if (!userEmail) {
        return res.status(400).json({ error: "userEmail is required" });
      }

      const emails = await emailService.searchReceiptEmails(userEmail, daysBack);

      const preview = emails.map(email => ({
        id: email.id,
        subject: email.subject,
        sender: email.sender,
        receivedDateTime: email.receivedDateTime,
        attachmentCount: email.attachments.length,
        attachments: email.attachments.map(att => ({
          name: att.name,
          contentType: att.contentType,
          size: att.size
        })),
        hasReceiptContent: email.body.toLowerCase().includes('receipt') || 
                          email.body.toLowerCase().includes('invoice') ||
                          email.body.includes('$')
      }));

      res.json({
        emails: preview,
        totalFound: preview.length,
        searchPeriod: `${daysBack} days`
      });
    } catch (error) {
      console.error("Error searching email receipts:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to search email receipts" 
      });
    }
  });

  // Process email content manually (copy-paste method)
  app.post("/api/email/process-content", async (req, res) => {
    try {
      const { subject, sender, body, receivedDate } = req.body;

      if (!subject || !body) {
        return res.status(400).json({ error: "subject and body are required" });
      }

      // Extract receipt information from email content
      const extractedData = emailService.extractReceiptFromEmailBody(body, subject, sender);

      if (!extractedData) {
        return res.status(400).json({ error: "No receipt information found in email content" });
      }

      // Create receipt with extracted data
      const receiptData = {
        fileName: `Email Receipt - ${subject}`,
        originalFileName: `Email Receipt - ${subject}`,
        fileUrl: `/email-receipts/${Date.now()}-${subject.replace(/[^a-zA-Z0-9]/g, '_')}`,
        merchant: extractedData.merchant || '',
        amount: extractedData.amount || '',
        date: extractedData.date ? new Date(extractedData.date) : (receivedDate ? new Date(receivedDate) : new Date()),
        category: '',
        ocrText: `Email from: ${sender}\nSubject: ${subject}\n\n${body}`,
        extractedData: extractedData,
        processingStatus: 'completed' as const,
      };

      const receipt = await storage.createReceipt(receiptData);

      res.json({
        receipt,
        extractedData,
        message: "Email content processed successfully"
      });
    } catch (error) {
      console.error("Error processing email content:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to process email content" 
      });
    }
  });

  // Manual fix endpoint for specific receipt
  app.post("/api/receipts/manual-fix", async (req, res) => {
    try {
      const { receiptId, chargeId, forceMatch } = req.body;

      if (!receiptId) {
        return res.status(400).json({ error: "receiptId is required" });
      }

      // Get the receipt
      const receipt = await storage.getReceipt(receiptId);
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      // If chargeId is provided, match to specific charge
      if (chargeId) {
        const charge = await storage.getAmexCharge(chargeId);
        if (!charge) {
          return res.status(404).json({ error: "Charge not found" });
        }

        // Update receipt as matched
        const updatedReceipt = await storage.updateReceipt(receiptId, {
          isMatched: true,
          matchedChargeId: chargeId,
          statementId: charge.statementId,
          merchant: receipt.merchant || charge.description,
          amount: receipt.amount || charge.amount,
          date: receipt.date || charge.date
        });

        // Update charge as matched
        await storage.updateAmexCharge(chargeId, {
          isMatched: true,
          receiptId: receiptId
        });

        return res.json({ 
          message: "Receipt manually matched successfully",
          receipt: updatedReceipt 
        });
      }

      // If no chargeId provided but forceMatch is true, just mark receipt as matched
      if (forceMatch) {
        const updatedReceipt = await storage.updateReceipt(receiptId, {
          isMatched: true
        });

        return res.json({ 
          message: "Receipt manually marked as matched",
          receipt: updatedReceipt 
        });
      }

      // Otherwise, try to find matching charge automatically
      if (receipt.amount) {
        const allCharges = await storage.getAllCharges();
        const matchingCharge = allCharges.find(charge => 
          !charge.isMatched &&
          Math.abs(parseFloat(charge.amount) - parseFloat(receipt.amount || '0')) < 0.01 &&
          Math.abs(new Date(charge.date).getTime() - new Date(receipt.date || new Date()).getTime()) < 7 * 24 * 60 * 60 * 1000
        );

        if (matchingCharge) {
          const updatedReceipt = await storage.updateReceipt(receiptId, {
            isMatched: true,
            matchedChargeId: matchingCharge.id,
            statementId: matchingCharge.statementId,
            merchant: receipt.merchant || matchingCharge.description,
            amount: receipt.amount || matchingCharge.amount,
            date: receipt.date || matchingCharge.date
          });

          await storage.updateAmexCharge(matchingCharge.id, {
            isMatched: true,
            receiptId: receiptId
          });

          return res.json({ 
            message: "Receipt automatically matched to charge",
            receipt: updatedReceipt,
            charge: matchingCharge
          });
        }
      }

      return res.json({ 
        message: "No matching charge found",
        receipt 
      });

    } catch (error) {
      console.error("Error in manual fix:", error);
      res.status(500).json({ error: "Failed to fix receipt" });
    }
  });

  // Find and fix receipt by specific details
  app.post("/api/receipts/find-and-fix", async (req, res) => {
    try {
      const { amount, date, merchant } = req.body;

      // Get all receipts
      const allReceipts = await storage.getAllReceipts();
      const allCharges = await storage.getAllCharges();

      // Find receipt matching the criteria
      let targetReceipt = null;
      if (amount) {
        targetReceipt = allReceipts.find(r => 
          r.amount && Math.abs(parseFloat(r.amount) - parseFloat(amount)) < 0.01
        );
      }

      if (!targetReceipt && merchant) {
        targetReceipt = allReceipts.find(r => 
          r.merchant && r.merchant.toLowerCase().includes(merchant.toLowerCase())
        );
      }

      if (!targetReceipt) {
        return res.status(404).json({ error: "Receipt not found with given criteria" });
      }

      // Find matching charge
      const matchingCharge = allCharges.find(c => 
        !c.isMatched &&
        Math.abs(parseFloat(c.amount) - parseFloat(targetReceipt.amount || '0')) < 0.01 &&
        (Math.abs(new Date(c.date).getTime() - new Date(targetReceipt.date || new Date()).getTime()) < 7 * 24 * 60 * 60 * 1000 ||
         c.description.toLowerCase().includes('astr') || 
         c.description.toLowerCase().includes('chicago'))
      );

      if (matchingCharge) {
        // Update receipt as matched
        const updatedReceipt = await storage.updateReceipt(targetReceipt.id, {
          isMatched: true,
          matchedChargeId: matchingCharge.id,
          statementId: matchingCharge.statementId,
          merchant: targetReceipt.merchant || matchingCharge.description,
          amount: targetReceipt.amount || matchingCharge.amount,
          date: targetReceipt.date || matchingCharge.date
        });

        // Update charge as matched
        await storage.updateAmexCharge(matchingCharge.id, {
          isMatched: true,
          receiptId: targetReceipt.id
        });

        return res.json({
          message: "Receipt found and matched successfully",
          receipt: updatedReceipt,
          charge: matchingCharge
        });
      } else {
        // Just mark as matched if no charge found
        const updatedReceipt = await storage.updateReceipt(targetReceipt.id, {
          isMatched: true
        });

        return res.json({
          message: "Receipt found and marked as matched (no charge found)",
          receipt: updatedReceipt
        });
      }

    } catch (error) {
      console.error("Error finding and fixing receipt:", error);
      res.status(500).json({ error: "Failed to find and fix receipt" });
    }
  });

  // Fix bidirectional matching - ensure both receipt and charge show matched status
  app.post("/api/receipts/fix-bidirectional-matching", async (req, res) => {
    try {
      const allReceipts = await storage.getAllReceipts();
      const allCharges = await storage.getAllCharges();
      
      let fixed = 0;
      let errors = 0;
      const fixes = [];

      // Find receipts that are matched but their corresponding charges aren't
      for (const receipt of allReceipts) {
        if (receipt.isMatched && receipt.matchedChargeId) {
          const charge = allCharges.find(c => c.id === receipt.matchedChargeId);
          if (charge && !charge.isMatched) {
            try {
              await storage.updateAmexCharge(charge.id, {
                isMatched: true,
                receiptId: receipt.id
              });
              fixes.push(`Fixed charge ${charge.description} $${charge.amount} - now shows as matched`);
              fixed++;
            } catch (error) {
              console.error(`Error fixing charge ${charge.id}:`, error);
              errors++;
            }
          }
        }
      }

      // Find charges that are matched but their corresponding receipts aren't
      for (const charge of allCharges) {
        if (charge.isMatched && charge.receiptId) {
          const receipt = allReceipts.find(r => r.id === charge.receiptId);
          if (receipt && !receipt.isMatched) {
            try {
              await storage.updateReceipt(receipt.id, {
                isMatched: true,
                matchedChargeId: charge.id,
                statementId: charge.statementId
              });
              fixes.push(`Fixed receipt ${receipt.fileName} $${receipt.amount} - now shows as matched`);
              fixed++;
            } catch (error) {
              console.error(`Error fixing receipt ${receipt.id}:`, error);
              errors++;
            }
          }
        }
      }

      return res.json({
        message: `Fixed ${fixed} bidirectional matching issues`,
        fixed,
        errors,
        details: fixes
      });

    } catch (error) {
      console.error("Error fixing bidirectional matching:", error);
      res.status(500).json({ error: "Failed to fix bidirectional matching" });
    }
  });

  // Database inspection endpoint - check specific receipt and charge status
  app.get("/api/debug/receipt-charge-status/:amount", async (req, res) => {
    try {
      const targetAmount = req.params.amount;
      const allReceipts = await storage.getAllReceipts();
      const allCharges = await storage.getAllCharges();

      // Find receipts matching the amount
      const matchingReceipts = allReceipts.filter(r => 
        r.amount && Math.abs(parseFloat(r.amount) - parseFloat(targetAmount)) < 0.01
      );

      // Find charges matching the amount
      const matchingCharges = allCharges.filter(c => 
        Math.abs(parseFloat(c.amount) - parseFloat(targetAmount)) < 0.01
      );

      const analysis = {
        searchAmount: targetAmount,
        receipts: matchingReceipts.map(r => ({
          id: r.id,
          fileName: r.fileName,
          merchant: r.merchant,
          amount: r.amount,
          date: r.date,
          isMatched: r.isMatched,
          matchedChargeId: r.matchedChargeId,
          statementId: r.statementId
        })),
        charges: matchingCharges.map(c => ({
          id: c.id,
          description: c.description,
          amount: c.amount,
          date: c.date,
          isMatched: c.isMatched,
          receiptId: c.receiptId,
          statementId: c.statementId
        })),
        potentialMatches: []
      };

      // Check for potential matches
      for (const receipt of matchingReceipts) {
        for (const charge of matchingCharges) {
          if (Math.abs(parseFloat(receipt.amount || '0') - parseFloat(charge.amount)) < 0.01) {
            analysis.potentialMatches.push({
              receiptId: receipt.id,
              receiptFileName: receipt.fileName,
              chargeId: charge.id,
              chargeDescription: charge.description,
              bothMatched: receipt.isMatched && charge.isMatched,
              receiptMatchedToThis: receipt.matchedChargeId === charge.id,
              chargeMatchedToThis: charge.receiptId === receipt.id,
              bidirectionalMatch: receipt.matchedChargeId === charge.id && charge.receiptId === receipt.id
            });
          }
        }
      }

      res.json(analysis);
    } catch (error) {
      console.error("Error inspecting database:", error);
      res.status(500).json({ error: "Failed to inspect database" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}