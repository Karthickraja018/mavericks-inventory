# Mavericks Inventory — Decision Log

Status vocabulary: **Confirmed** (formally approved) · **Proposed** (owner-supplied, awaiting formal confirmation) · **Pending** (open).
Nothing marked Proposed may be treated as confirmed by an implementer.

# 1. Confirmed business decisions — Excel import (verbatim, unchanged)


| ID | Decision | Consequence |
|---|---|---|
| IMP-001 | Stock Count is a reconciliation sheet | Compare with ledger; do not treat as procurement/distribution |
| IMP-002 | Stock Count may establish initial stock when the system has no ledger balance for that variant | Post an auditable opening/reconciliation adjustment after approval |
| IMP-003 | Imported `Available` is the reconciliation target | `Procured` and `Distributed Qty` are cross-checks only |
| IMP-004 | Every stock adjustment requires approval | No automatic posting of reconciliation variances |
| IMP-005 | Duplicate rows/transactions are rejected and reported | No silent skip, overwrite or upsert |
| IMP-006 | Missing product variants are rejected | Product must be created before import |
| IMP-007 | Negative stock is blocked and reviewed | No stock-out transaction may take available balance below zero |
| IMP-008 | `Emp ID` is the primary recipient match | Name and base location are validation fields |
| IMP-009 | Every row must pass validation before file commit | No partial file import |
| IMP-010 | Commit is all-or-nothing | Database rollback on commit failure |
| IMP-011 | Idempotency controls are required | Retries must not repeat stock side effects |
| IMP-012 | Procurement supports Historical and New modes | Historical does not increase stock by default; New posts stock-in |
| IMP-013 | Recipient supports Historical and New modes | Historical does not deduct stock by default; New follows approval and deducts stock |
| IMP-014 | Import mode must be explicitly selected | Never infer mode from filename/date |


# 2. Pending amendments to confirmed decisions
| Confirmed | Proposed change | Source | Status |
|---|---|---|---|
| IMP-002 (per variant) | Global empty-ledger only; no per-variant initialisation | PBD-01 | Pending confirmation |
| IMP-012 (stock-in on commit) | Approval required before stock-in | PBD-05 | Pending confirmation |
| Template column rule | Add `Quantity` to Recipient | PBD-14 | Pending (OQ-32) |

# 3. Proposed business decisions (owner-supplied)
| ID | Decision |
|---|---|
| PBD-01 | Initial stock only when the global ledger has no stock transactions; recorded as auditable opening adjustment transactions. Missing variants are not initialised individually. |
| PBD-02 | `variance = imported Available − current ledger-derived balance`; positive increases, negative decreases. Every non-zero adjustment needs approval by an authorised person other than the requester. |
| PBD-03 | `Procured` and `Distributed Qty` are cross-checks only in Stock Count. |
| PBD-04 | Historical procurement: records only, no stock change by default. |
| PBD-05 | New procurement: authorised approval before stock-in (MVP); record and movement committed atomically. |
| PBD-06 | Historical recipient: no stock deduction by default. |
| PBD-07 | New recipient: pending requests via existing Request/RequestLine. Import is not distribution. Deduct only after final approval and successful stock validation. |
| PBD-08 | Reject duplicates and report source rows. Use stable source IDs when available; no invented composite key. |
| PBD-09 | Reject rows for missing variants; products created and mapped beforehand. |
| PBD-10 | Match employees on unique Emp ID; block commit on unresolved name/location mismatch. |
| PBD-11 | Negative stock blocked and routed to an explicit review state. |
| PBD-12 | All rows validated before commit; business writes all-or-nothing with rollback and idempotency. |
| PBD-13 | Variants absent from a Stock Count file stay unchanged and are reported separately; omission is never zero. |
| PBD-14 | Recipient template has no numeric quantity. Recommend a separate `Quantity` column; never assume one row = one unit. |
| PBD-15 | One reconciliation approval level for MVP, with separation of duties; extensible to configurable stages. |
| PBD-16 | Insufficient stock: `NEEDS_REVIEW` state, recorded reason, authorised reviewer, no deduction, revalidate before retry. |

# 4. Proposed technical decisions
| ID | Decision |
|---|---|
| PTD-01 | Extend `StockMovement` as the only stock ledger; no `StockLedgerTransaction` table. |
| PTD-02 | If `Item.quantity` stays, it is a transactionally maintained cache verified against the ledger. |
| PTD-03 | Evolve `Item` into the variant where feasible; map existing SKUs explicitly, never silently. |
| PTD-04 | Add `Employee`, `ImportJob`, `ImportRow`, reconciliation review only where no equivalent exists. |
| PTD-05 | Reuse `Request`/`RequestLine` for new distributions; no duplicate `DistributionRecord` for that path. |
| PTD-06 | `Approval` stores approver user ID; separation of duties enforced server-side. |
| PTD-07 | `AuditLog` gains structured detail, outcome, correlation/import ID, actor references. |
| PTD-08 | Keep CUID ids. |
| PTD-09 | Posted stock movements are immutable; corrections are compensating transactions. |
| PTD-10 | Seed data and `createItem` must not bypass the opening-stock workflow. |
| PTD-11 | Procurement records and stock-in imports in scope; PO/vendor management out. |
| PTD-12 | Inspect the real database before any migration; never assume repo migration history. |

# 5. Unconfirmed defaults from the original BRD
Original Q-01…Q-22 defaults are **proposed only** and are not confirmed decisions, including "no self-approval" (Q-04) and "single location" (Q-01).

# 6. Recommended technical practices (from supplied log, unchanged)

- Stage raw rows before touching business tables.
- Use a unique import idempotency key and unique source references.
- Preserve original source row numbers.
- Maintain immutable stock-ledger transactions; correct errors through compensating transactions, not edits to posted ledger history.
- Enforce authorization and approval rules on the server.
- Treat `NA` consistently and normalize whitespace before matching variants.
- Record import and approval actions in the audit log.

# 7. Provisional engineering choices made during Gate 1/2 (reversible; not business decisions)
| ID | Choice | Reason |
|---|---|---|
| PE-01 | Import upload/preview is ADMIN-only | Original BRD default; OQ-19 open |
| PE-02 | Required fields: Stock Count `Product`; Procurement `Product`; Recipient `Emp ID`, `Product`. Numeric columns and Date are always required (blank is invalid). | BRD §6; per-column rules not specified |
| PE-03 | Dates accepted: Excel date cells or `YYYY-MM-DD` only | OQ-12 open; conservative |
| PE-04 | `NA` and blank are not canonicalised yet | OQ-15 open |
| PE-05 | Duplicate-within-file and variant/employee matching not implemented | OQ-7, 15, 17, 21 |
| PE-06 | A file with blocking errors is stored as `FAILED`; same file+type+mode reuses the existing job | No validation-failed status in the supplied enum |
| PE-07 | `createItem` no longer accepts opening stock; seed adds stock only with `SEED_DEV_STOCK=1`, via a labelled ledger entry | PTD-10 |
