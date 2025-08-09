# PDF Text Extraction Guide

## How PDF Text Extraction Works

When you click "Extract PDF Text" on a PDF receipt, here's what happens:

### 1. **Processing Time**
- **Expected Duration**: 30-60 seconds for most receipts
- **PDF Conversion**: 15-30 seconds to convert PDF to high-resolution image
- **Text Extraction**: 15-30 seconds to analyze the image and extract text
- **Complex PDFs**: May take up to 2 minutes for multi-page or complex layouts

### 2. **User Feedback System**
- **Progress Indicator**: Live spinner with "Extracting PDF Text..." message
- **Real-time Updates**: Status changes from "Extract PDF Text" → "Starting..." → "Extracting PDF Text..."
- **Completion Notification**: Badge changes to "PDF Text Extracted" when done
- **Auto-refresh**: Receipt list updates automatically when processing completes

### 3. **What Happens During Processing**
1. **PDF Conversion**: PDF is converted to a high-resolution PNG image (200 DPI)
2. **Text Analysis**: Advanced pattern matching extracts:
   - Merchant name (business name, restaurant, store)
   - Total amount (looks for "Total:", "$XX.XX", "Amount Due:")
   - Date (MM/DD/YYYY, "Mar 15 2025", "Date: 3/15")
   - Category (auto-detects: Meals, Gas, Travel, Office Supplies, etc.)
3. **Data Population**: Extracted information automatically fills the receipt form fields
4. **Auto-matching**: System immediately attempts to match against AMEX charges

### 4. **Types of PDFs Supported**
- ✅ **Text-based PDFs**: Restaurant receipts, store receipts, invoices
- ✅ **Scanned PDFs**: Converted to images then processed with OCR
- ✅ **Mixed PDFs**: Combination of text and images
- ❌ **Password-protected PDFs**: Cannot be processed
- ❌ **Heavily encrypted PDFs**: May fail processing

### 5. **Receipt Field Modification System**
After text extraction, you can:

- **Edit any field**: Click on merchant, amount, date, or category to modify
- **Real-time matching**: Changes trigger immediate re-matching with AMEX charges
- **Auto-save**: All edits are saved automatically
- **Match preview**: See potential AMEX matches as you type
- **Category suggestions**: Dropdown with common expense categories

### 6. **Matching Algorithm**
The system uses extracted data to find AMEX charges:

1. **Amount Priority**: Exact dollar amount matches score highest
2. **Date Proximity**: Transactions within ±3 days of receipt date
3. **Merchant Similarity**: Fuzzy matching between receipt merchant and AMEX description
4. **Confidence Scoring**: Combines all factors for match reliability

### 7. **Error Handling**
If extraction fails:
- **Clear error message**: Explains what went wrong
- **Fallback option**: Manual entry form remains available
- **Retry capability**: Can attempt extraction again
- **Progressive degradation**: System still works without automatic extraction

### 8. **Performance Optimization**
- **First page only**: Only processes page 1 for speed
- **Background processing**: Doesn't block UI during extraction
- **Smart caching**: Avoids re-processing same files
- **Resource cleanup**: Automatically cleans up temporary files

## Tips for Best Results

1. **PDF Quality**: Higher resolution PDFs produce better text extraction
2. **Standard Formats**: Restaurant and retail receipts work best
3. **Clear Text**: Avoid handwritten or extremely stylized fonts
4. **File Size**: Smaller PDFs (under 5MB) process faster
5. **Single Page**: Multi-page PDFs only process the first page

## Troubleshooting

- **"PDF processing failed"**: Try manual entry or contact support
- **"Minimal readable text"**: PDF might be an image - manual entry recommended
- **Long processing time**: Large or complex PDFs take longer - be patient
- **No text extracted**: Scanned receipt might need manual entry