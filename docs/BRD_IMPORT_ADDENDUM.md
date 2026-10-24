# Mavericks Inventory — BRD Addendum: Excel Imports

**Status:** Gate 0 draft for review. **Not approved.**
**Relationship to the original BRD:** This is an addendum to the original `docs/BRD.md` (v1.0, 16 sections). The original is not modified. Place the original file at `docs/BRD.md` unchanged; this addendum is referenced from it.
**Precedence:** The amendment notices in Part A take precedence over the verbatim import BRD in Part B wherever they differ. Part B is the supplied import BRD, preserved unaltered.

# Part A — Amendment notices (pending confirmation unless marked Confirmed)

## A1. Effect on the original BRD
| Original BRD reference | Effect | Basis |
|---|---|---|
| §2.2 "Procurement and purchase-order management" out of scope | Amended: procurement **records** and stock-in via import are in scope. Purchase orders, vendors and supplier management stay out. | PTD-11 (proposed) |
| §5.6 Excel import, FR-IMP-001…014, "Import policy requiring confirmation" | Superseded for the three templates: no partial file commit; all-or-nothing business writes. Alternatives (partial success, staged-optional) are withdrawn. | IMP-009, IMP-010 (confirmed) |
| FR-IMP-007 error report fields | Extended: row number, field, **error code** and message. | BRD Part B §7 |
| Q-09 (partial success), Q-10 (existing SKU) | Resolved by IMP-005, IMP-006, IMP-009, IMP-010. | confirmed |
| Q-02 (reservation) | Unchanged: no reservation while pending. | IMPLEMENTATION_REQUIREMENTS §5 |
| Q-04 (self-approval) | Proposed to extend to reconciliation approvals. Q-04 itself was only a proposed default. | PBD-02 |
| Q-11 (adjustments outside requests) | Reconciliation adjustment is the only adjustment path in this addendum. | IMP-004 |
| §5.4 "controlled exception state" | Named `NEEDS_REVIEW` (proposed). Reason, reviewer and retry rules are open. | PBD-16, OQ-27 |
| FR-STK-006/007, FR-TXN-010 | Opening balances and adjustments are ledger transactions. Seed data and `createItem` must not bypass this. | PTD-09, PTD-10 |
| FR-AUD-002 | Audit entries gain structured detail, outcome, import/correlation ID and actor references. | PTD-07 |
| §3.5 permission matrix | Import, reconciliation-approval and file-download permissions are undefined. | OQ-5, OQ-19 |

## A2. Amendments to confirmed decisions (not applied until confirmed)
- **IMP-002** is worded per variant ("no ledger balance for that variant"). PBD-01 proposes: initial stock only when the **global** ledger has no stock transactions; individual missing variants are not initialised through ordinary reconciliation. Until confirmed, no initial-stock posting is built.
- **IMP-012** says New procurement posts stock-in on commit. PBD-05 proposes approval before posting. Until confirmed, no procurement stock-in is built.
- **BRD Part B §2** requires templates to keep the supplied columns and order. PBD-14 recommends adding a `Quantity` column to Recipient, which conflicts. Needs a decision on template versioning (OQ-32).

## A3. Interpretation of "commit" (proposed, for confirmation)
- Stock Count and New procurement: file validated, then staged, then approved, then stock posted atomically.
- Recipient New: commit atomically creates **pending** Requests with no stock effect. Stock moves only at final approval of each Request.
- Whether approval is per file or per row, and how a file maps to Requests, is open (OQ-24, OQ-25, OQ-31).

---
# Part B — Supplied import BRD (verbatim)

# Mavericks Inventory — Business Requirements Document (Import Update)

**Status:** Updated from the supplied Excel templates and confirmed business decisions  
**Scope:** Stock Count reconciliation, Procurement import, Recipient import

## 1. Purpose

Provide a controlled Excel import workflow for the existing Mavericks Inventory workbook formats while protecting inventory accuracy, preventing duplicate stock movements, and preserving an audit trail.

## 2. Supported Excel templates

### Stock Count
`S.N`, `Product Details`, `Product`, `Size / Quantity`, `Color`, `Brand`, `Procured`, `Distributed Qty`, `Available`

### Procurement
`Date`, `Product Details`, `Product`, `Size / Quantity`, `Color`, `Brand`, `Procured`

### Recipient
`Date`, `Emp ID`, `Name`, `Base Location`, `Category`, `POC`, `Product Details`, `Product`, `Size / Quantity`, `Color`, `Brand`, `Status`

The application must preserve the supplied column names/order in downloadable templates. Header detection and optional column mapping may be supported. Template selection must be explicit if detection is ambiguous.

## 3. Confirmed business rules

1. **Stock Count is a reconciliation sheet.** It compares imported figures with the application's ledger-derived inventory and can correct discrepancies.
2. **Initial stock:** If the system has no stock ledger for the relevant product variant, an authorized Stock Count reconciliation may establish initial stock. This must be recorded as an opening/reconciliation adjustment, not fabricated procurement.
3. **Reconciliation target:** Imported `Available` is the target balance. Imported `Procured` and `Distributed Qty` are cross-checks and must not independently create stock movements.
4. **Every stock adjustment requires approval.** No reconciliation adjustment may be posted before an authorized approver approves it.
5. **Duplicate handling:** Reject duplicate rows/transactions and report the conflicting rows. Do not silently skip or overwrite.
6. **Missing product variants:** Reject rows that do not match an existing product variant. Product creation must happen before import.
7. **Negative stock:** Block the stock-changing transaction and route it for review; do not permit negative stock.
8. **Recipient matching:** `Emp ID` is the primary employee matching field. Name and base location are validation fields; mismatches must be reported for review.
9. **Validation and commit:** All rows must pass validation before the file can be committed.
10. **Transaction policy:** Commit all accepted rows atomically. On any commit error, roll back the transaction. Use idempotency controls to prevent duplicate effects on retries.

## 4. Import modes

### Procurement
The user must explicitly choose:
- **Historical migration:** Import prior procurement records. Do not increase current stock by default. If historical data is intended to reconstruct the stock ledger, that must be a separately authorized migration procedure.
- **New procurement:** Create procurement records and stock-in ledger entries exactly once on commit.

### Recipient
The user must explicitly choose:
- **Historical migration:** Import prior completed distribution records. Do not deduct stock again by default. Historical migration must not silently rebuild stock movements.
- **New distribution:** Create a new distribution transaction. Apply the configured approval workflow and deduct stock only after final approval, with an atomic availability check.

The import type cannot be inferred solely from filename or dates.

## 5. Workflow

1. User selects import type and mode.
2. Upload workbook.
3. Parse and validate template headers, types and rows.
4. Match product variants and employees.
5. Detect duplicate rows and previously imported transactions.
6. Show a preview with row counts, errors, warnings, stock impact and reconciliation variances.
7. If any row has a blocking validation error, disable commit until the file is corrected and revalidated.
8. Require an authorized user to approve any stock adjustment.
9. Commit the file atomically with an idempotency key.
10. Record outcome and audit details; provide a downloadable error report when validation fails.

## 6. Validation

- Required fields, date formats and non-negative integer quantities.
- `XXX`, blank numeric values, malformed dates and invalid quantities must not be accepted as valid data.
- Normalize whitespace and case where appropriate.
- Treat `NA` consistently as not applicable, without confusing it with a valid product attribute.
- Product variant identity uses a stable product/variant record or SKU; display text is not a database key.
- `Available` is a reconciliation target, not a direct balance update without approval.
- Validate `Procured` and `Distributed Qty` as cross-checks and report discrepancies; they do not independently change stock in Stock Count imports.
- Recipient status must be checked against a documented allowed-status list. The exact list remains open until confirmed.
- A repeated upload must not duplicate stock movements or historical records.

## 7. Audit and security

For each import, record the importing user, timestamp, source filename/checksum, import type/mode, row count, validation result, approval, commit result, and linked stock-ledger entries. Row-level failures must include row number, field and actionable message. Enforce authorization on the server, not only in the UI.

## 8. Acceptance criteria

- The three supplied templates can be uploaded and recognized or mapped.
- The user must choose Historical vs New for Procurement and Recipient.
- Invalid files cannot be committed.
- Duplicate records are reported with conflicting row numbers.
- Missing product variants are rejected.
- Employee matching uses Emp ID and flags name/location mismatches.
- Stock Count compares imported Available to the ledger balance and requires approval for every adjustment.
- A Stock Count import can establish initial stock only when the system has no existing ledger balance for that variant, and the posting is auditable.
- New procurement increases stock exactly once.
- Historical procurement does not increase stock by default.
- New distribution deducts stock only after final approval and only if stock is sufficient.
- Historical distribution does not deduct stock by default.
- Any commit failure rolls back the entire import transaction.
- Repeated requests with the same idempotency key do not repeat side effects.
- Tests cover duplicate uploads, concurrency, rollback, missing variants, quantity validation and audit records.

## 9. Scope boundaries

This update defines import behavior. It does not authorize silent stock overwrites, auto-creation of product variants/employees, partial file commits, negative inventory, or automatic approval of reconciliation adjustments.
