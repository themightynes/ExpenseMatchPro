# OCR Extraction Analysis: Webhook vs Manual "Extract Text"

## Problem Statement
When receipts are forwarded via email webhook:
- Receipt is created ✅
- File information (original name, upload date) is saved ✅
- Merchant is extracted and loaded ✅
- But user must manually click "Extract Text" to see OCR results ❌

## Root Cause Analysis

### Both Flows Use the Same OCR Service
Both the webhook flow and manual "Extract Text" button use the **same** `ocrService.processReceipt()` method, which means they use the **same Claude Vision prompt**. The prompt is defined in `server/ocrService.ts` lines 650-716.

### Key Differences Found

#### 1. Filename Parameter
- **Webhook flow** (`server/emailWebhookService.ts:429`):
  ```typescript
  ocrService.processReceipt(receipt.fileUrl, receipt.fileName)
  ```
  Uses `receipt.fileName` (actual filename with extension, e.g., `email-attachment-xxx-CHAPA_91843.pdf`)

- **Manual OCR** (`server/routes.ts:725`):
  ```typescript
  ocrService.processReceipt(receipt.fileUrl, receipt.originalFileName)
  ```
  Uses `receipt.originalFileName` (for webhook receipts, this is the email subject, e.g., `Fw: Your Monday, Oct 27, 2025...`)

**Impact**: The manual OCR endpoint uses the wrong filename for webhook-processed receipts, which could affect file type detection.

#### 2. OCR Text Extraction Logic
The issue is in `server/ocrService.ts` lines 824-843:

```typescript
// Line 825: Extract ocrText from Claude's JSON response
const ocrText = parsedResponse.ocrText || textContent; // Fallback to full text if ocrText not in JSON

// Line 843: Return with fallback if ocrText is falsy
ocrText: ocrText || `Extracted via Claude Vision API. Merchant: ${extractedData.merchant || 'N/A'}, Amount: ${extractedData.amount || 'N/A'}, Date: ${extractedData.date || 'N/A'}`,
```

**Problem**: 
- If Claude Vision returns JSON without an `ocrText` field (or with an empty/short `ocrText`), the fallback string is used
- The fallback string is short (e.g., `"Extracted via Claude Vision API. Merchant: Residence Inn by Marriott, Amount: N/A, Date: N/A"` = ~80 chars)
- But if only merchant is extracted, the string might be shorter
- The UI requires `ocrText.length > 50` to display the extracted text (`client/src/components/ReceiptViewer.tsx:1022`)

#### 3. UI Display Logic
The UI only shows OCR text if:
- `receipt.ocrText` exists
- `receipt.ocrText !== 'Processing...'`
- `receipt.ocrText !== 'Manual entry required'`
- `receipt.ocrText.length > 50` ⚠️

If the `ocrText` is shorter than 50 characters, the UI won't display it, making it appear as if OCR didn't run.

### What's Actually Happening

Based on the logs provided:
```
Claude Vision extraction successful: { merchant: 'Residence Inn by Marriott' }
Claude-provided confidence: 25%
```

1. ✅ Claude Vision IS running and extracting data
2. ✅ Merchant is being extracted
3. ❓ But `ocrText` might be:
   - Missing from Claude's JSON response
   - Too short (< 50 chars)
   - Or the fallback string is being used but is too short

### The Real Issue

The most likely scenario:
1. Claude Vision extracts structured data (merchant, amount, date, etc.) correctly
2. But Claude Vision might not be returning a complete `ocrText` field in the JSON
3. The fallback to `textContent` should work, but `textContent` is the full Claude response (which includes JSON), not the OCR text
4. If `parsedResponse.ocrText` is undefined/empty, it falls back to the summary string
5. The summary string might be shorter than 50 characters if not all fields are extracted
6. The UI doesn't show OCR text if it's < 50 characters, so the user thinks OCR didn't run

## Solutions

### Solution 1: Fix Manual OCR Endpoint to Use Correct Filename
Update `server/routes.ts:725` to use `receipt.fileName` instead of `receipt.originalFileName`:

```typescript
ocrService.processReceipt(receipt.fileUrl, receipt.fileName || receipt.originalFileName)
```

### Solution 2: Improve OCR Text Extraction
Ensure `ocrText` is always populated with meaningful content:

1. **Better fallback logic** in `server/ocrService.ts:825`:
   ```typescript
   // If ocrText is missing from JSON, use textContent (full Claude response)
   // But extract just the text part, not the JSON wrapper
   const ocrText = parsedResponse.ocrText || (textContent.length > 100 ? textContent : '');
   ```

2. **Always use full Claude response as fallback**:
   ```typescript
   // Line 825: Use Claude's full response if ocrText is missing
   const ocrText = parsedResponse.ocrText || textContent;
   
   // Line 843: Only use summary if ocrText is truly empty
   ocrText: ocrText && ocrText.length > 50 ? ocrText : textContent || `Extracted via Claude Vision API...`,
   ```

3. **Log OCR text length** for debugging:
   ```typescript
   console.log(`OCR text length: ${ocrText?.length || 0} characters`);
   ```

### Solution 3: Lower UI Threshold or Show Partial Text
Update `client/src/components/ReceiptViewer.tsx:1022` to show OCR text even if shorter:

```typescript
{receipt.ocrText && receipt.ocrText !== 'Processing...' && receipt.ocrText !== 'Manual entry required' && receipt.ocrText.length > 0 && (
```

Or show a different message for short OCR text:
```typescript
{receipt.ocrText && receipt.ocrText.length > 0 && (
  <Card>
    <CardTitle>Extracted Text {receipt.ocrText.length < 50 && '(Partial)'}</CardTitle>
    ...
  </Card>
)}
```

## Recommended Fixes

1. **Fix manual OCR endpoint** to use correct filename (Solution 1)
2. **Improve OCR text extraction** to always use Claude's full response as fallback (Solution 2.2)
3. **Add logging** to debug OCR text length (Solution 2.3)
4. **Consider lowering UI threshold** or showing partial text (Solution 3)

## Testing Checklist

After fixes:
- [ ] Forward an email with PDF attachment
- [ ] Verify receipt is created with merchant populated
- [ ] Verify `ocrText` is saved with meaningful content (> 50 chars)
- [ ] Verify UI shows "Extracted Text" section without manual click
- [ ] Verify manual "Extract Text" button also works correctly
- [ ] Check logs for OCR text length

