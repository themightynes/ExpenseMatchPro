# Smart Matching System

Intelligent algorithm that automatically links receipts to AMEX charges based on multiple matching criteria and confidence scoring.

## Overview

The smart matching system uses sophisticated algorithms to identify potential matches between uploaded receipts and imported AMEX charges, with automatic data completion and cross-statement support.

## Matching Algorithm

### Primary Matching Criteria

1. **Amount Matching**
   - Exact amount comparison preferred
   - Tolerance threshold: ±$0.01 for rounding differences
   - Confidence score: High (90-100%) for exact matches

2. **Date Range Matching**
   - Primary window: ±1 day from receipt date
   - Extended window: ±3 days for weekend/holiday adjustments
   - Confidence score: Decreases with larger date differences

3. **Merchant Similarity**
   - Text similarity scoring using fuzzy matching
   - Common abbreviation handling (e.g., "CORP" → "CORPORATION")
   - Confidence score: Based on similarity percentage

4. **Combined Scoring**
   - Weighted algorithm combining all criteria
   - Minimum confidence threshold: 70%
   - Multiple match handling with confidence ranking

### Advanced Features

#### Cross-Statement Matching
- **Universal Search**: Receipts can match charges from any statement period
- **Date Range Freedom**: Not restricted by statement date boundaries
- **Historical Matching**: Match older receipts to previously imported statements
- **Future Matching**: Handle receipts uploaded before statement import

#### Intelligent Data Completion
When a match is confirmed:
- **Missing Merchant**: Populated from AMEX charge description
- **Missing Amount**: Uses exact charge amount
- **Missing Date**: Uses charge transaction date
- **Statement Assignment**: Auto-assigns receipt to charge's statement period

## Matching Interface

### User Experience
- **Visual Similarity Indicators**: Color-coded confidence levels
- **Side-by-Side Comparison**: Receipt details vs charge details
- **One-Click Matching**: Simple confirm/reject interface
- **Bulk Operations**: Match multiple receipts efficiently

### Confidence Levels
- **High (90-100%)**: Green indicator, auto-match candidate
- **Medium (70-89%)**: Yellow indicator, user review recommended
- **Low (<70%)**: Red indicator, manual verification required

### Match Validation
```javascript
// Example matching logic
{
  confidence: 95,
  criteria: {
    amount: { exact: true, score: 100 },
    date: { daysDiff: 0, score: 100 },
    merchant: { similarity: 85, score: 85 }
  },
  receipt: { /* receipt data */ },
  charge: { /* charge data */ }
}
```

## Automatic Matching

### Background Processing
- **New Receipt Analysis**: Check all unmatched charges when receipt uploaded
- **New Statement Processing**: Attempt matching with existing unassigned receipts
- **Confidence Thresholds**: Auto-match only high-confidence pairs
- **User Notification**: Alert users to potential automatic matches

### Match Quality Scoring

#### High-Quality Matches (Auto-Match Eligible)
- Exact amount match
- Date within ±1 day
- Merchant similarity >80%
- No competing matches with similar confidence

#### Medium-Quality Matches (User Review)
- Amount match within tolerance
- Date within ±3 days
- Merchant similarity 60-80%
- Clear best match among options

#### Low-Quality Matches (Manual Only)
- Amount differences >$1.00
- Date differences >3 days
- Low merchant similarity
- Multiple competing matches

## Manual Matching Interface

### Receipt-Centric View
- **Receipt Details**: Complete receipt information display
- **Potential Matches**: Ranked list of possible charges
- **Match Actions**: Confirm, reject, or skip options
- **Data Preview**: Show how receipt data will be updated

### Charge-Centric View
- **Charge Details**: AMEX charge information
- **Available Receipts**: List of potential receipt matches
- **Filter Options**: Date range, amount range, merchant filters
- **Batch Matching**: Select multiple receipts for same charge

### Matching Actions

#### Confirm Match
1. Link receipt to charge (bidirectional relationship)
2. Update receipt data with charge information
3. Set both records as "matched"
4. Trigger automatic reorganization
5. Update statement counts and statistics

#### Reject Match
1. Mark specific receipt-charge pair as "not a match"
2. Remove from future automatic suggestions
3. Continue searching for alternative matches
4. Log rejection for algorithm improvement

#### Skip Match
1. Leave both records unmatched
2. Keep in suggestion pool for future review
3. No permanent decision recorded
4. Allow for later manual matching

## Data Synchronization

### Bidirectional Linking
- **Receipt → Charge**: `matchedChargeId` field
- **Charge → Receipt**: `receiptId` field
- **Status Flags**: Both records marked as `isMatched: true`
- **Data Integrity**: Automatic cleanup on unmatch operations

### Automatic Updates
When match is confirmed:
```javascript
// Receipt updates
{
  isMatched: true,
  matchedChargeId: "charge-uuid",
  statementId: "statement-uuid",
  merchant: charge.description,    // if missing
  amount: charge.amount,          // if missing
  date: charge.date              // if missing
}

// Charge updates
{
  isMatched: true,
  receiptId: "receipt-uuid"
}
```

## Performance Optimization

### Efficient Algorithms
- **Indexed Queries**: Database indexes on amount, date, merchant fields
- **Caching**: Cache expensive similarity calculations
- **Batch Processing**: Group matching operations for efficiency
- **Lazy Loading**: Load match suggestions on demand

### Scalability Considerations
- **Pagination**: Handle large datasets with pagination
- **Background Jobs**: Process intensive matching in background
- **Rate Limiting**: Prevent overwhelming database with rapid matches
- **Memory Management**: Efficient handling of large charge/receipt sets

## Analytics and Reporting

### Matching Statistics
- **Match Rate**: Percentage of receipts successfully matched
- **Confidence Distribution**: Breakdown of match confidence levels
- **Time to Match**: Average time from upload to match confirmation
- **Algorithm Performance**: Success rates by matching criteria

### Quality Metrics
- **False Positive Rate**: Incorrectly matched pairs
- **False Negative Rate**: Missed potential matches
- **User Override Rate**: Manual corrections to automatic matches
- **Match Stability**: Matches that remain stable over time

## Error Handling

### Common Issues
- **Multiple Potential Matches**: Present ranked options to user
- **No Potential Matches**: Clear messaging and manual entry options
- **Data Conflicts**: Handle mismatched amounts or dates gracefully
- **System Errors**: Graceful fallback to manual matching

### Recovery Mechanisms
- **Unmatch Operations**: Clean reversal of incorrect matches
- **Data Correction**: Update match after correcting receipt/charge data
- **Re-matching**: Trigger new match attempts after data updates
- **Audit Trail**: Complete logging of all matching decisions

## Integration Points

### Receipt Processing
- Automatic match attempts on receipt completion
- Data validation before matching
- Reorganization triggers after successful matches

### AMEX Import
- Immediate matching attempts with existing receipts
- Statement assignment updates
- Bulk matching operations for efficiency

### Oracle Export
- Include matching status in export data
- Proper categorization based on matched charges
- Cross-reference receipt and charge information

## Future Enhancements

### Machine Learning
- **Pattern Recognition**: Learn from user matching decisions
- **Merchant Normalization**: Improve merchant name standardization
- **Predictive Matching**: Suggest matches based on historical patterns
- **Confidence Calibration**: Improve confidence scoring accuracy

### Advanced Features
- **Receipt Splitting**: Match one receipt to multiple charges
- **Charge Combining**: Match multiple receipts to one charge
- **Partial Matching**: Handle receipts that partially match charges
- **Category Suggestions**: Propose expense categories based on matches

See [Pending Features](./pending-features.md) for detailed roadmap of matching system enhancements.