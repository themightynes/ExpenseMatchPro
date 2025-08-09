# API Reference

This document provides comprehensive information about the Receipt Manager API endpoints, request/response formats, and integration guidelines.

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Receipts API](#receipts-api)
3. [AMEX Statements API](#amex-statements-api)
4. [Charges API](#charges-api)
5. [Matching API](#matching-api)
6. [Email Processing API](#email-processing-api)
7. [Dashboard API](#dashboard-api)
8. [File Organization API](#file-organization-api)
9. [Error Handling](#error-handling)
10. [Rate Limiting](#rate-limiting)

## 🔐 Authentication

The Receipt Manager API uses session-based authentication with secure HTTP-only cookies.

### Session Management
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "user": {
    "id": "user-id",
    "username": "user@example.com",
    "createdAt": "2025-08-09T00:00:00.000Z"
  },
  "message": "Login successful"
}
```

## 📄 Receipts API

### List All Receipts
```http
GET /api/receipts
```

**Response:**
```json
[
  {
    "id": "receipt-id",
    "fileName": "receipt.pdf",
    "originalFileName": "receipt.pdf",
    "fileUrl": "/objects/uploads/receipt-id",
    "merchant": "Starbucks",
    "amount": "4.75",
    "date": "2025-08-09T00:00:00.000Z",
    "category": "Meals",
    "ocrText": "Extracted text content",
    "extractedData": {
      "merchant": "Starbucks",
      "amount": "4.75",
      "items": ["Coffee", "Tax"]
    },
    "processingStatus": "completed",
    "statementId": "statement-id",
    "isMatched": true,
    "matchedChargeId": "charge-id",
    "organizedPath": "/March_2025/Meals/2025-08-09_STARBUCKS_$4.75_RECEIPT.pdf",
    "createdAt": "2025-08-09T00:00:00.000Z",
    "updatedAt": "2025-08-09T00:00:00.000Z"
  }
]
```

### Create Receipt
```http
POST /api/receipts
Content-Type: multipart/form-data

FormData:
- file: [receipt file]
- merchant: "Starbucks" (optional)
- amount: "4.75" (optional)
- date: "2025-08-09" (optional)
- category: "Meals" (optional)
```

**Response:**
```json
{
  "id": "receipt-id",
  "fileName": "receipt.pdf",
  "fileUrl": "/objects/uploads/receipt-id",
  "processingStatus": "processing",
  "message": "Receipt uploaded successfully"
}
```

### Get Receipt Details
```http
GET /api/receipts/:id
```

**Response:**
```json
{
  "id": "receipt-id",
  "fileName": "receipt.pdf",
  "originalFileName": "receipt.pdf",
  "fileUrl": "/objects/uploads/receipt-id",
  "merchant": "Starbucks",
  "amount": "4.75",
  "date": "2025-08-09T00:00:00.000Z",
  "category": "Meals",
  "ocrText": "Extracted text content",
  "extractedData": {
    "merchant": "Starbucks",
    "amount": "4.75",
    "date": "2025-08-09",
    "items": ["Coffee", "Tax"]
  },
  "processingStatus": "completed",
  "statementId": "statement-id",
  "isMatched": true,
  "matchedChargeId": "charge-id",
  "organizedPath": "/March_2025/Meals/2025-08-09_STARBUCKS_$4.75_RECEIPT.pdf",
  "createdAt": "2025-08-09T00:00:00.000Z",
  "updatedAt": "2025-08-09T00:00:00.000Z"
}
```

### Update Receipt
```http
PUT /api/receipts/:id
Content-Type: application/json

{
  "merchant": "Starbucks Coffee",
  "amount": "4.75",
  "date": "2025-08-09",
  "category": "Meals"
}
```

**Response:**
```json
{
  "id": "receipt-id",
  "merchant": "Starbucks Coffee",
  "amount": "4.75",
  "date": "2025-08-09T00:00:00.000Z",
  "category": "Meals",
  "updatedAt": "2025-08-09T00:00:00.000Z",
  "message": "Receipt updated successfully"
}
```

### Delete Receipt
```http
DELETE /api/receipts/:id
```

**Response:**
```json
{
  "message": "Receipt deleted successfully"
}
```

### Process OCR
```http
POST /api/receipts/:id/process-ocr
```

**Response:**
```json
{
  "extractedData": {
    "merchant": "Starbucks",
    "amount": "4.75",
    "date": "2025-08-09",
    "items": ["Grande Latte", "Sales Tax"]
  },
  "ocrText": "Full extracted text content",
  "processingStatus": "completed",
  "message": "OCR processing completed"
}
```

## 🏛️ AMEX Statements API

### List All Statements
```http
GET /api/statements
```

**Response:**
```json
[
  {
    "id": "statement-id",
    "periodName": "March 2025",
    "startDate": "2025-03-01T00:00:00.000Z",
    "endDate": "2025-03-31T00:00:00.000Z",
    "totalCharges": 45,
    "totalAmount": "2303.45",
    "importStatus": "completed",
    "createdAt": "2025-08-09T00:00:00.000Z"
  }
]
```

### Get Statement Details
```http
GET /api/statements/:id
```

**Response:**
```json
{
  "id": "statement-id",
  "periodName": "March 2025",
  "startDate": "2025-03-01T00:00:00.000Z",
  "endDate": "2025-03-31T00:00:00.000Z",
  "totalCharges": 45,
  "totalAmount": "2303.45",
  "importStatus": "completed",
  "createdAt": "2025-08-09T00:00:00.000Z",
  "charges": [
    {
      "id": "charge-id",
      "date": "2025-03-15T00:00:00.000Z",
      "description": "STARBUCKS #12345",
      "amount": "4.75",
      "cardMember": "JOHN DOE",
      "isMatched": true,
      "receiptId": "receipt-id"
    }
  ]
}
```

### Get Active Statement
```http
GET /api/statements/active
```

**Response:**
```json
{
  "id": "statement-id",
  "periodName": "Current Period",
  "startDate": "2025-08-01T00:00:00.000Z",
  "endDate": "2025-08-31T00:00:00.000Z",
  "totalCharges": 12,
  "totalAmount": "456.78",
  "importStatus": "active"
}
```

### Get Statement Charges
```http
GET /api/statements/:id/charges
```

**Response:**
```json
[
  {
    "id": "charge-id",
    "statementId": "statement-id",
    "date": "2025-03-15T00:00:00.000Z",
    "description": "STARBUCKS #12345",
    "cardMember": "JOHN DOE",
    "accountNumber": "-12345",
    "amount": "4.75",
    "extendedDetails": "RESTAURANT",
    "isMatched": true,
    "receiptId": "receipt-id",
    "createdAt": "2025-08-09T00:00:00.000Z"
  }
]
```

### Get Statement Receipts
```http
GET /api/statements/:id/receipts
```

**Response:**
```json
[
  {
    "id": "receipt-id",
    "fileName": "receipt.pdf",
    "merchant": "Starbucks",
    "amount": "4.75",
    "date": "2025-03-15T00:00:00.000Z",
    "isMatched": true,
    "matchedChargeId": "charge-id",
    "statementId": "statement-id"
  }
]
```

## 💳 Charges API

### Import AMEX CSV
```http
POST /api/charges/import-csv
Content-Type: multipart/form-data

FormData:
- csvFile: [AMEX CSV file]
- periodName: "March 2025"
```

**Response:**
```json
{
  "statement": {
    "id": "statement-id",
    "periodName": "March 2025",
    "startDate": "2025-03-01T00:00:00.000Z",
    "endDate": "2025-03-31T00:00:00.000Z"
  },
  "imported": 45,
  "errors": 0,
  "duplicates": 0,
  "message": "CSV imported successfully"
}
```

### List All Charges
```http
GET /api/charges
```

**Response:**
```json
[
  {
    "id": "charge-id",
    "statementId": "statement-id",
    "date": "2025-03-15T00:00:00.000Z",
    "description": "STARBUCKS #12345",
    "cardMember": "JOHN DOE",
    "accountNumber": "-12345",
    "amount": "4.75",
    "extendedDetails": "RESTAURANT",
    "isMatched": false,
    "receiptId": null,
    "createdAt": "2025-08-09T00:00:00.000Z"
  }
]
```

### Get Charge Details
```http
GET /api/charges/:id
```

**Response:**
```json
{
  "id": "charge-id",
  "statementId": "statement-id",
  "date": "2025-03-15T00:00:00.000Z",
  "description": "STARBUCKS #12345",
  "cardMember": "JOHN DOE",
  "accountNumber": "-12345",
  "amount": "4.75",
  "extendedDetails": "RESTAURANT",
  "statementAs": "",
  "address": "123 Main St",
  "cityState": "New York, NY",
  "zipCode": "10001",
  "country": "US",
  "reference": "REF123456",
  "category": "Meals",
  "isMatched": false,
  "receiptId": null,
  "createdAt": "2025-08-09T00:00:00.000Z"
}
```

## 🔗 Matching API

### Get Matching Candidates
```http
GET /api/matching/candidates/:statementId
```

**Response:**
```json
{
  "statementId": "statement-id",
  "pairs": [
    {
      "receipt": {
        "id": "receipt-id",
        "merchant": "Starbucks",
        "amount": "4.75",
        "date": "2025-03-15T00:00:00.000Z",
        "fileName": "receipt.pdf"
      },
      "charge": {
        "id": "charge-id",
        "description": "STARBUCKS #12345",
        "amount": "4.75",
        "date": "2025-03-15T00:00:00.000Z",
        "cardMember": "JOHN DOE"
      },
      "confidence": 95,
      "reasons": [
        "Exact amount match",
        "Same date",
        "Merchant name similarity: 87%"
      ]
    }
  ],
  "unmatchedReceipts": 2,
  "unmatchedCharges": 8
}
```

### Confirm Match
```http
POST /api/matching/confirm
Content-Type: application/json

{
  "receiptId": "receipt-id",
  "chargeId": "charge-id"
}
```

**Response:**
```json
{
  "receipt": {
    "id": "receipt-id",
    "matchedChargeId": "charge-id",
    "statementId": "statement-id",
    "isMatched": true
  },
  "charge": {
    "id": "charge-id",
    "receiptId": "receipt-id",
    "isMatched": true
  },
  "message": "Match confirmed successfully"
}
```

### Unmatch Receipt
```http
POST /api/matching/unmatch
Content-Type: application/json

{
  "receiptId": "receipt-id"
}
```

**Response:**
```json
{
  "receipt": {
    "id": "receipt-id",
    "matchedChargeId": null,
    "isMatched": false
  },
  "message": "Receipt unmatched successfully"
}
```

## 📧 Email Processing API

### Process Email Content
```http
POST /api/email/process-content
Content-Type: application/json

{
  "subject": "Receipt from Starbucks",
  "sender": "noreply@starbucks.com",
  "body": "Thank you for your purchase...",
  "receivedDate": "2025-08-09"
}
```

**Response:**
```json
{
  "receipt": {
    "id": "receipt-id",
    "fileName": "Email Receipt - Receipt from Starbucks",
    "merchant": "Starbucks",
    "amount": "4.75",
    "date": "2025-08-09T00:00:00.000Z"
  },
  "extractedData": {
    "merchant": "Starbucks",
    "amount": "4.75",
    "date": "2025-08-09"
  },
  "message": "Email content processed successfully"
}
```

### Search Email Receipts
```http
POST /api/email/search
Content-Type: application/json

{
  "userEmail": "user@company.com",
  "daysBack": 30
}
```

**Response:**
```json
{
  "emails": [
    {
      "id": "email-id",
      "subject": "Receipt from Starbucks",
      "sender": "noreply@starbucks.com",
      "receivedDateTime": "2025-08-09T00:00:00.000Z",
      "attachmentCount": 1,
      "hasReceiptContent": true
    }
  ],
  "totalFound": 1,
  "searchPeriod": "last 30 days"
}
```

## 📊 Dashboard API

### Get Processing Statistics
```http
GET /api/dashboard/stats
```

**Response:**
```json
{
  "processedCount": 27,
  "pendingCount": 0,
  "readyCount": 25,
  "processingCount": 2,
  "totalReceipts": 27,
  "matchedReceipts": 25,
  "organizedReceipts": 23
}
```

### Get Financial Statistics
```http
GET /api/dashboard/financial-stats
```

**Response:**
```json
{
  "totalStatementAmount": "2303.45",
  "totalReceiptAmount": "2156.78",
  "matchedAmount": "2089.34",
  "unmatchedAmount": "67.44",
  "coveragePercentage": 90.7,
  "categories": [
    {
      "name": "Meals",
      "amount": "456.78",
      "count": 12,
      "percentage": 19.8
    },
    {
      "name": "Travel",
      "amount": "1234.56",
      "count": 8,
      "percentage": 53.6
    }
  ]
}
```

## 🗂️ File Organization API

### Organize Receipts
```http
POST /api/organize
Content-Type: application/json

{
  "receiptIds": ["receipt-id-1", "receipt-id-2"],
  "force": false
}
```

**Response:**
```json
{
  "organized": 2,
  "fixed": 1,
  "reorganized": 2,
  "errors": 0,
  "statusMessages": [
    "Organized receipt.pdf",
    "Fixed missing data for invoice.pdf"
  ],
  "message": "Organization completed successfully"
}
```

### Get Organization Status
```http
GET /api/organize/status
```

**Response:**
```json
{
  "totalReceipts": 27,
  "organizedReceipts": 25,
  "pendingOrganization": 2,
  "organizationProgress": 92.6,
  "lastOrganized": "2025-08-09T00:00:00.000Z"
}
```

## ❌ Error Handling

All API endpoints return consistent error responses:

### Error Response Format
```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific field error",
    "validation": "Validation details"
  },
  "timestamp": "2025-08-09T00:00:00.000Z"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 429 | Rate Limited |
| 500 | Internal Server Error |

### Common Error Codes

| Code | Description |
|------|-------------|
| `RECEIPT_NOT_FOUND` | Requested receipt does not exist |
| `INVALID_FILE_FORMAT` | Unsupported file format |
| `FILE_TOO_LARGE` | File exceeds maximum size limit |
| `DUPLICATE_STATEMENT` | Statement period already exists |
| `INVALID_CSV_FORMAT` | CSV file format is invalid |
| `MATCHING_FAILED` | Unable to process matching request |
| `OCR_PROCESSING_FAILED` | OCR extraction failed |
| `ORGANIZATION_ERROR` | File organization failed |

## 🚦 Rate Limiting

The API implements rate limiting to ensure fair usage:

### Limits
- **General API calls**: 1000 requests per hour per user
- **File uploads**: 100 files per hour per user
- **OCR processing**: 50 requests per hour per user
- **Email processing**: 20 requests per hour per user

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1691568000
```

### Rate Limit Exceeded Response
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 3600,
  "limit": 1000,
  "reset": 1691568000
}
```

---

This API reference provides comprehensive information for integrating with the Receipt Manager system. All endpoints are designed to be RESTful and return consistent JSON responses for easy integration with client applications.