# API Documentation

Complete reference for all REST endpoints in the Receipt Manager application.

## Base URL
```
Development: http://localhost:5000
Production: https://your-replit-domain.replit.dev
```

## Authentication

All API endpoints require user authentication via Replit Auth sessions.

### Headers
```
Cookie: replit_auth_session=[session-token]
Content-Type: application/json
```

---

## Receipts API

### List Receipts
Get all receipts for the authenticated user.

**Endpoint**: `GET /api/receipts`

**Query Parameters**:
- `status` (optional): Filter by processing status
- `matched` (optional): Filter by matching status (true/false)
- `statement` (optional): Filter by statement ID

**Response**:
```json
[
  {
    "id": "uuid",
    "originalFileName": "IMG_1234.JPG",
    "organizedPath": "/objects/statements/uuid/Matched/2025-03-06_CAFE_LANDWER_$14DOT79_RECEIPT.JPG",
    "merchant": "CAFE LANDWER",
    "amount": "14.79",
    "date": "2025-03-06T00:00:00.000Z",
    "category": "Meals",
    "processingStatus": "completed",
    "isMatched": true,
    "matchedChargeId": "charge-uuid",
    "statementId": "statement-uuid",
    "createdAt": "2025-08-09T10:30:00.000Z"
  }
]
```

### Get Single Receipt
Get details for a specific receipt.

**Endpoint**: `GET /api/receipts/:id`

**Response**: Same structure as single receipt object above.

### Update Receipt
Update receipt information.

**Endpoint**: `PUT /api/receipts/:id`

**Request Body**:
```json
{
  "merchant": "Updated Merchant Name",
  "amount": "25.50",
  "date": "2025-03-07",
  "category": "Office Supplies",
  "notes": "Business supplies"
}
```

**Response**: Updated receipt object.

### Delete Receipt
Permanently delete a receipt and unlink from any matched charges.

**Endpoint**: `DELETE /api/receipts/:id`

**Response**:
```json
{
  "message": "Receipt deleted successfully",
  "deletedReceipt": { /* receipt object */ }
}
```

### Bulk Reorganize Receipts
Force reorganization of all receipts with Oracle naming.

**Endpoint**: `POST /api/receipts/fix-and-reorganize`

**Response**:
```json
{
  "message": "Fixed 0 receipt connections, reorganized 3 with Oracle naming",
  "fixed": 0,
  "reorganized": 3,
  "errors": 0,
  "total": 4,
  "details": [
    "Reorganized IMG_1590.JPG → Oracle naming (complete data)",
    "Reorganized IMG_1568.JPG → Oracle naming (used fallbacks for: merchant)"
  ]
}
```

---

## AMEX Integration API

### List Statements
Get all AMEX statement periods.

**Endpoint**: `GET /api/statements`

**Response**:
```json
[
  {
    "id": "uuid",
    "periodName": "2025 - August Statement",
    "startDate": "2025-07-04T00:00:00.000Z",
    "endDate": "2025-07-23T00:00:00.000Z",
    "isActive": true,
    "chargeCount": 27,
    "receiptCount": 1,
    "matchedCount": 1,
    "createdAt": "2025-08-09T06:08:53.247Z"
  }
]
```

### Import AMEX CSV
Import AMEX statement from CSV file.

**Endpoint**: `POST /api/charges/import-csv`

**Request**: Multipart form data
- `csvFile`: CSV file upload
- `periodName`: Statement period name

**Response**:
```json
{
  "statement": { /* statement object */ },
  "imported": 25,
  "errors": 2,
  "autoAssigned": 3,
  "message": "Successfully imported 25 charges"
}
```

**Error Response** (Duplicate Detected):
```json
{
  "error": "Duplicate statement detected",
  "duplicates": [
    {
      "existingStatement": { /* statement object */ },
      "overlappingCharges": 15,
      "periodOverlap": "7/4/2025 - 7/23/2025"
    }
  ],
  "message": "Found 1 potential duplicate statement(s). Please review before uploading."
}
```

### List Charges
Get AMEX charges for a statement or all charges.

**Endpoint**: `GET /api/amex-charges`

**Query Parameters**:
- `statement` (optional): Filter by statement ID
- `matched` (optional): Filter by matching status
- `personal` (optional): Filter by personal expense flag

**Response**:
```json
[
  {
    "id": "uuid",
    "date": "2025-03-06T00:00:00.000Z",
    "description": "CAFE LANDWER",
    "amount": "14.79",
    "category": "Restaurant",
    "cardMember": "JOHN DOE",
    "statementId": "statement-uuid",
    "isMatched": true,
    "receiptId": "receipt-uuid",
    "isPersonalExpense": false
  }
]
```

### Toggle Personal Expense
Mark charge as personal or business expense.

**Endpoint**: `POST /api/amex-charges/:id/toggle-personal`

**Response**:
```json
{
  "id": "uuid",
  "isPersonalExpense": true,
  "message": "Charge marked as personal expense"
}
```

---

## Matching API

### Match Receipt to Charge
Create a match between a receipt and AMEX charge.

**Endpoint**: `POST /api/matching/match`

**Request Body**:
```json
{
  "receiptId": "receipt-uuid",
  "chargeId": "charge-uuid"
}
```

**Response**:
```json
{
  "receipt": { /* updated receipt object */ },
  "charge": { /* updated charge object */ }
}
```

### Unmatch Receipt
Remove the match between a receipt and charge.

**Endpoint**: `POST /api/matching/unmatch`

**Request Body**:
```json
{
  "receiptId": "receipt-uuid"
}
```

**Response**:
```json
{
  "receipt": { /* updated receipt object */ },
  "charge": { /* updated charge object */ },
  "message": "Receipt unmatched successfully"
}
```

---

## File Storage API

### Get Object
Serve receipt files and images.

**Endpoint**: `GET /objects/:objectPath(*)`

**Response**: Binary file data with appropriate Content-Type header.

### Upload Presigned URL
Get presigned URL for direct file upload.

**Endpoint**: `POST /api/objects/upload`

**Response**:
```json
{
  "uploadURL": "https://storage.googleapis.com/bucket/object?signed-params"
}
```

---

## Dashboard API

### Get Statistics
Get dashboard statistics for the authenticated user.

**Endpoint**: `GET /api/dashboard/stats`

**Response**:
```json
{
  "processedCount": 32,
  "pendingCount": 0,
  "matchedCount": 28,
  "totalReceipts": 32,
  "totalStatements": 2,
  "totalCharges": 54
}
```

### Get Financial Statistics
Get financial overview and matching statistics.

**Endpoint**: `GET /api/dashboard/financial-stats`

**Response**:
```json
{
  "totalStatementAmount": 2303.45,
  "totalMatchedAmount": 1250.30,
  "totalUnmatchedReceiptAmount": 89.50,
  "totalMissingReceiptAmount": 963.65,
  "personalExpensesAmount": 450.25,
  "matchedCount": 15,
  "unmatchedReceiptCount": 3,
  "missingReceiptCount": 12,
  "totalCharges": 30,
  "personalExpensesCount": 8,
  "matchingPercentage": 54.2
}
```

---

## Error Handling

### Standard Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional error details"
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate data)
- `422` - Unprocessable Entity (validation errors)
- `500` - Internal Server Error

### Common Error Codes
- `RECEIPT_NOT_FOUND` - Receipt ID does not exist
- `CHARGE_NOT_FOUND` - Charge ID does not exist
- `DUPLICATE_STATEMENT` - Statement period already exists
- `INVALID_CSV_FORMAT` - CSV file format is invalid
- `FILE_UPLOAD_FAILED` - File upload to storage failed
- `VALIDATION_ERROR` - Request data validation failed

---

## Rate Limiting

### Limits
- **File Upload**: 10 files per request, 100MB total
- **API Requests**: 1000 requests per hour per user
- **CSV Import**: 5 imports per hour per user
- **Bulk Operations**: 1 per minute per user

### Headers
Rate limit information is included in response headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1625097600
```

---

## Pagination

### Query Parameters
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)
- `sort`: Sort field (default: createdAt)
- `order`: Sort order (asc/desc, default: desc)

### Response Headers
```
X-Total-Count: 150
X-Page: 1
X-Per-Page: 50
X-Total-Pages: 3
```

### Links Header
```
Link: <http://api.example.com/receipts?page=1>; rel="first",
      <http://api.example.com/receipts?page=2>; rel="next",
      <http://api.example.com/receipts?page=3>; rel="last"
```

---

## Webhook Events

### Event Types
- `receipt.created` - New receipt uploaded
- `receipt.processed` - Receipt processing completed
- `receipt.matched` - Receipt matched to charge
- `statement.imported` - AMEX statement imported
- `charge.updated` - Charge information modified

### Webhook Payload
```json
{
  "event": "receipt.matched",
  "timestamp": "2025-08-09T10:30:00.000Z",
  "data": {
    "receiptId": "receipt-uuid",
    "chargeId": "charge-uuid",
    "userId": "user-uuid"
  }
}
```

---

## SDK Examples

### JavaScript/TypeScript
```typescript
// Using fetch API
async function getReceipts() {
  const response = await fetch('/api/receipts', {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

// Using TanStack Query
import { useQuery } from '@tanstack/react-query';

function useReceipts() {
  return useQuery({
    queryKey: ['/api/receipts'],
    queryFn: () => fetch('/api/receipts').then(res => res.json())
  });
}
```

### curl Examples
```bash
# Get receipts
curl -X GET "http://localhost:5000/api/receipts" \
  -H "Cookie: replit_auth_session=session-token"

# Upload CSV
curl -X POST "http://localhost:5000/api/charges/import-csv" \
  -H "Cookie: replit_auth_session=session-token" \
  -F "csvFile=@statement.csv" \
  -F "periodName=2025 - August Statement"

# Match receipt to charge
curl -X POST "http://localhost:5000/api/matching/match" \
  -H "Cookie: replit_auth_session=session-token" \
  -H "Content-Type: application/json" \
  -d '{"receiptId":"receipt-uuid","chargeId":"charge-uuid"}'
```

---

## Testing

### Test Environment
```
Base URL: http://localhost:5000
Test User: Create via Replit Auth
```

### Test Data
Use the provided CSV samples and receipt images in the `/test-data` directory for testing API functionality.

### Postman Collection
Import the Postman collection from `/docs/api/Receipt-Manager-API.postman_collection.json` for comprehensive API testing.