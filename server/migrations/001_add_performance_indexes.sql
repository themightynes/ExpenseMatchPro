-- Performance optimization indexes for Phase 2
-- These indexes support the matching algorithm's query patterns

-- Indexes for receipts table (used heavily in matching)
CREATE INDEX IF NOT EXISTS idx_receipts_amount ON receipts(amount);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date);
CREATE INDEX IF NOT EXISTS idx_receipts_merchant ON receipts(merchant);
CREATE INDEX IF NOT EXISTS idx_receipts_statement_id ON receipts(statement_id);
CREATE INDEX IF NOT EXISTS idx_receipts_is_matched ON receipts(is_matched);
CREATE INDEX IF NOT EXISTS idx_receipts_needs_manual_review ON receipts(needs_manual_review);

-- Indexes for amex_charges table (used heavily in matching)
CREATE INDEX IF NOT EXISTS idx_amex_charges_amount ON amex_charges(amount);
CREATE INDEX IF NOT EXISTS idx_amex_charges_date ON amex_charges(date);
CREATE INDEX IF NOT EXISTS idx_amex_charges_description ON amex_charges(description);
CREATE INDEX IF NOT EXISTS idx_amex_charges_statement_id ON amex_charges(statement_id);
CREATE INDEX IF NOT EXISTS idx_amex_charges_is_matched ON amex_charges(is_matched);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_receipts_statement_matched ON receipts(statement_id, is_matched);
CREATE INDEX IF NOT EXISTS idx_amex_charges_statement_matched ON amex_charges(statement_id, is_matched);
CREATE INDEX IF NOT EXISTS idx_receipts_date_amount ON receipts(date, amount);
CREATE INDEX IF NOT EXISTS idx_amex_charges_date_amount ON amex_charges(date, amount);

-- Index for manual review workflow
CREATE INDEX IF NOT EXISTS idx_receipts_manual_review_status ON receipts(needs_manual_review, is_matched);

-- Indexes for amex_statements table
CREATE INDEX IF NOT EXISTS idx_amex_statements_period_dates ON amex_statements(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_amex_statements_active ON amex_statements(is_active);