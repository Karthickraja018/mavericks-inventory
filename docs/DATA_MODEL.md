# Mavericks Inventory — Data Model

**Status:** Gate 0 proposal. **No schema change has been applied.** Part 1 is the current schema as built. Part 2 is the proposed delta. Part 3 is the supplied import data model, preserved verbatim; where it differs from Part 2, Part 2 governs (it reflects PTD-01…PTD-12).

# Part 1 — Current schema (`prisma/schema.prisma`)
User, Item, StockMovement, Request, RequestLine, Approval, AuditLog. No migrations are in the repository; the real database state is unknown (OQ-28).

# Part 2 — Proposed delta

| Model | Change | Decision |
|---|---|---|
| Product (new) | `id`, `name`, optional category | PTD-03 |
| Item (variant) | Add `productId`, `size`, `color`, `brand` (NOT NULL, canonical value per OQ-15), `@@unique([productId,size,color,brand])`. `sku` becomes nullable. Add `CHECK(quantity >= 0)`. Keep `quantity` as a ledger-verified cache. Backfill one Product per existing Item; balances untouched. | PTD-02/03 |
| StockMovement | Rename `type` to an enum: `PROCUREMENT_IN`, `DISTRIBUTION_OUT`, `RECONCILIATION_ADJUSTMENT`, `OPENING_ADJUSTMENT`. Add `sourceType`, `sourceId`, `sourceRowId?`, `idempotencyKey? @unique`, `createdById` FK, `approvedById?` FK, `approvedAt?`, `reason?`. `CHECK(change <> 0)`. Trigger forbidding UPDATE/DELETE. Backfill: `DISTRIBUTION`→`DISTRIBUTION_OUT` with `sourceType=REQUEST`; `OPENING`→`OPENING_ADJUSTMENT`, flagged legacy/unapproved. `RETURN_IN` and `OTHER_APPROVED_TYPE` are not added. | PTD-01/09 |
| Employee (new) | `empId` unique required, `name`, `baseLocation`. Not linked to User. | PTD-04 |
| ImportJob (new) | type, mode, filename, checksum, `idempotencyKey @unique`, status, row counts, uploader and committer FKs, timestamps, error summary. `CHECK` on valid type/mode pairs (STOCK_COUNT only with RECONCILIATION). Statuses from the supplied model plus a rejected/cancelled state (open). | PTD-04 |
| ImportRow (new) | `@@unique([importJobId, sourceRowNumber])`, raw and normalized JSON, validation status/errors, matched variant and employee FKs. | PTD-04 |
| ReconciliationReview (new) | `@@unique([importJobId, itemId])`, before, target, variance, cross-check values, status, requester, reviewer, reason NOT NULL before approval. Granularity pending OQ-24. | PTD-04 |
| ProcurementRecord (new) | No equivalent exists. Mode, date, quantity, source job/row, nullable ledger link. Duplicate key pending OQ-7/17. | PTD-11 |
| Request / RequestLine | Add `NEEDS_REVIEW` to `Status`; review reason/reviewer fields; optional import-job link; recipient employee link (shape pending OQ-25/32). No `DistributionRecord` for the approved path. | PTD-05 |
| Approval | Add `approverId` FK (keep `approverName` as snapshot). Reconciliation/procurement approvals: polymorphic subject or separate table, undecided. | PTD-06 |
| AuditLog | Add `detail Json?`, `outcome`, `correlationId`, actor FK, index on `(entity, entityId)`. | PTD-07 |
| Workflow config | Replace env `APPROVAL_LEVELS` with a stored config for reconciliation; snapshot per record. | PTD-02/PBD-15 |

## Constraint and migration rules
1. Inspect the real database and any local `prisma/migrations` before writing a migration (PTD-12).
2. Test every migration on a copy; verify per-item balances are identical before and after.
3. Postgres treats NULLs as distinct in unique indexes. Use NOT NULL with a canonical sentinel, or `NULLS NOT DISTINCT` (PG 15+) once OQ-15 is answered.
4. Seed and `createItem` must stop writing balances without an approved ledger entry (PTD-10).
5. Verify `Item.quantity == SUM(StockMovement.change)` per item; report mismatches, never auto-correct.
6. Do not change ID conventions (PTD-08).

---
# Part 3 — Supplied import data model (verbatim)

# Mavericks Inventory — Data Model Additions for Excel Imports

This is a logical schema proposal. Adapt names/types to the project's existing ORM and migrations; do not create duplicate concepts if equivalent tables already exist.

## 1. Core entities

### ProductVariant
- `id` UUID primary key
- `product_id` foreign key
- `size` nullable normalized value
- `color` nullable normalized value
- `brand` nullable normalized value
- `sku` nullable unique identifier, if available
- Unique constraint on the normalized product/size/color/brand identity where business rules permit
- Store `NA`/not-applicable consistently; do not rely on display strings as keys.

### Employee
- `id` UUID primary key
- `employee_code` / `emp_id` unique and required for import matching
- `name`
- `base_location`
- Additional fields only if already supported by the application

### ImportJob
- `id` UUID primary key
- `import_type`: `STOCK_COUNT | PROCUREMENT | RECIPIENT`
- `import_mode`: `RECONCILIATION | HISTORICAL | NEW`
- `source_filename`
- `source_checksum`
- `idempotency_key` unique within the relevant tenant/system scope
- `status`: `UPLOADED | VALIDATING | VALIDATED | AWAITING_APPROVAL | COMMITTING | COMMITTED | FAILED | ROLLED_BACK`
- `total_rows`, `valid_rows`, `invalid_rows`
- `uploaded_by`, `uploaded_at`
- `committed_by`, `committed_at`
- `error_summary`
- Store source file securely according to retention policy; avoid storing sensitive content unnecessarily.

### ImportRow
- `id` UUID primary key
- `import_job_id` foreign key
- `source_row_number`
- `raw_data` JSON
- `normalized_data` JSON
- `validation_status`: `VALID | INVALID | DUPLICATE | WARNING`
- `validation_errors` JSON
- `matched_product_variant_id` nullable foreign key
- `matched_employee_id` nullable foreign key
- Unique constraint on `(import_job_id, source_row_number)`

### StockLedgerTransaction
- `id` UUID primary key
- `product_variant_id` foreign key
- `transaction_type`: `PROCUREMENT_IN | DISTRIBUTION_OUT | RECONCILIATION_ADJUSTMENT | OPENING_ADJUSTMENT | RETURN_IN | OTHER_APPROVED_TYPE`
- `quantity_delta` signed integer; positive for stock-in and negative for stock-out
- `source_type`, `source_id`, `source_row_id`
- `idempotency_key` or unique source reference preventing duplicate posting
- `created_by`, `created_at`
- `approved_by`, `approved_at` where approval applies
- `reason` / `notes`
- Reference the business transaction that caused the movement.

### ReconciliationReview
- `id` UUID primary key
- `import_job_id` foreign key
- `product_variant_id` foreign key
- `system_available_before`
- `imported_available_target`
- `variance` = target minus current balance
- `procured_cross_check`
- `distributed_qty_cross_check`
- `status`: `PENDING_APPROVAL | APPROVED | REJECTED | POSTED`
- `requested_by`, `reviewed_by`, timestamps
- `reason` required before approval/posting
- Ensure an approver cannot approve their own adjustment if the global self-approval rule applies.

### ProcurementRecord
- `id` UUID primary key
- `product_variant_id` foreign key
- `procurement_date`
- `quantity`
- `import_mode`: `HISTORICAL | NEW`
- `source_import_job_id`, `source_row_id`
- `stock_ledger_transaction_id` nullable for historical records that do not post stock
- Unique external/source identifier when one exists

### DistributionRecord
- `id` UUID primary key
- `employee_id` foreign key
- `product_variant_id` foreign key
- `distribution_date`
- `quantity`
- `category`, `poc`, `status`
- `import_mode`: `HISTORICAL | NEW`
- `source_import_job_id`, `source_row_id`
- `stock_ledger_transaction_id` nullable for historical records that do not post stock
- Unique external/source identifier when one exists

## 2. Balance derivation

Current available stock must be derived from posted stock ledger transactions:

`available = SUM(quantity_delta)` for the relevant product variant and inventory location.

If the MVP has a single inventory location, location can be omitted initially or represented by a fixed default location; do not implement multi-location workflows unless separately approved.

Stock Count's imported `Available` is a target for reconciliation. `Procured` and `Distributed Qty` are cross-checks and must not independently post stock movements.

## 3. Atomic commit and idempotency

- Validate all rows before commit.
- Use a database transaction for each file commit.
- Enforce uniqueness at the database level for idempotency/source references.
- Lock or otherwise serialize affected stock balances during new distribution approval/commit to prevent concurrent overselling.
- If any row fails commit, roll back all business writes from that import.
- Store failed job status and diagnostics separately if necessary, without partially committing business transactions.
- The import job itself may persist outside the business transaction so failed attempts remain auditable.
- Avoid double-counting when retries occur after timeouts.

## 4. Migration considerations

Before migration:
1. Inspect existing schema and ORM models.
2. Reuse existing inventory, employee, procurement, distribution, audit and approval tables where possible.
3. Add only missing constraints and import metadata.
4. Create and test migrations against a copy of existing data.
5. Do not change production balances during schema migration.
