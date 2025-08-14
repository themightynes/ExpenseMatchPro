# Database Performance Optimization

## Overview

This document outlines the database indexing strategy implemented in Phase 2 to optimize query performance for the Work Expense App matching algorithms.

## Performance Analysis

### Query Patterns Identified

The application's matching algorithm performs several types of queries that were optimized:

1. **Matching Candidate Queries**:
   - Find unmatched receipts by statement: `WHERE statement_id = ? AND is_matched = false`
   - Find unmatched charges by statement: `WHERE statement_id = ? AND is_matched = false` 
   - Filter receipts by amount range: `WHERE amount BETWEEN ? AND ?`
   - Filter charges by date range: `WHERE date BETWEEN ? AND ?`
   - Search by merchant name: `WHERE merchant ILIKE ?`
   - Search by charge description: `WHERE description ILIKE ?`

2. **Manual Review Workflow**:
   - Find receipts needing review: `WHERE needs_manual_review = true AND is_matched = false`
   - Filter by review status: `WHERE needs_manual_review = ? AND is_matched = ?`

3. **Statement Management**:
   - Find active statement: `WHERE is_active = true`
   - Date range validation: `WHERE start_date <= ? AND end_date >= ?`

## Indexes Implemented

### Single Column Indexes

| Table | Column | Purpose |
|-------|--------|---------|
| receipts | amount | Amount filtering in matching |
| receipts | date | Date filtering in matching |
| receipts | merchant | Merchant name search |
| receipts | statement_id | Statement-based filtering |
| receipts | is_matched | Matched/unmatched filtering |
| receipts | needs_manual_review | Manual review workflow |
| amex_charges | amount | Amount filtering in matching |
| amex_charges | date | Date filtering in matching |
| amex_charges | description | Description search |
| amex_charges | statement_id | Statement-based filtering |
| amex_charges | is_matched | Matched/unmatched filtering |
| amex_statements | is_active | Active statement lookup |

### Composite Indexes

| Table | Columns | Purpose |
|-------|---------|---------|
| receipts | (statement_id, is_matched) | Common filtering pattern |
| amex_charges | (statement_id, is_matched) | Common filtering pattern |
| receipts | (date, amount) | Multi-criteria matching |
| amex_charges | (date, amount) | Multi-criteria matching |
| receipts | (needs_manual_review, is_matched) | Manual review workflow |
| amex_statements | (start_date, end_date) | Date range queries |

## Expected Performance Improvements

### Before Optimization
- Matching candidate queries: Full table scans on large datasets
- Manual review queries: Sequential scanning of all receipts
- Cross-statement matching: Multiple full table scans

### After Optimization
- **Matching Performance**: 10-50x improvement for candidate filtering
- **Manual Review**: 5-20x improvement for review workflow queries
- **Statement Queries**: Near-instant lookup of active statements
- **Cross-Statement Matching**: Efficient index-based filtering

## Index Maintenance

### Monitoring
- Monitor index usage with PostgreSQL's `pg_stat_user_indexes`
- Track query performance with `pg_stat_statements`
- Review slow query log regularly

### Considerations
- Indexes consume additional storage (~10-20% increase expected)
- Write operations slightly slower due to index maintenance
- Benefits compound with dataset growth (currently 70+ receipts, 86+ charges)

## Query Optimization Examples

### Before (Full Table Scan)
```sql
-- Inefficient: scans entire receipts table
SELECT * FROM receipts 
WHERE statement_id = '123' AND is_matched = false;
```

### After (Index Usage)
```sql
-- Efficient: uses idx_receipts_statement_matched composite index
SELECT * FROM receipts 
WHERE statement_id = '123' AND is_matched = false;
```

### Matching Algorithm Optimization
```sql
-- Efficient candidate finding with multiple indexes
SELECT r.*, c.* FROM receipts r
CROSS JOIN amex_charges c
WHERE r.statement_id = ?
  AND c.statement_id = ?
  AND r.is_matched = false
  AND c.is_matched = false
  AND ABS(CAST(r.amount AS DECIMAL) - ABS(CAST(c.amount AS DECIMAL))) < 1.0
ORDER BY ABS(CAST(r.amount AS DECIMAL) - ABS(CAST(c.amount AS DECIMAL)));
```

## Future Considerations

### Phase 3 Optimizations
- Implement materialized views for complex matching analytics
- Consider partitioning large tables by date ranges
- Add full-text search indexes for merchant/description text search

### Monitoring Metrics
- Query execution time targets: <100ms for matching queries
- Index hit ratio targets: >95% for core matching queries
- Storage overhead: Monitor index size vs table size ratios

---

**Implementation Date**: August 2025 (Phase 2)
**Next Review**: Phase 3 planning
**Impact**: Expected 10-50x performance improvement for matching algorithms